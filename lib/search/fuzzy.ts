// Fuzzy matching for the "/" search. Pure functions with no imports, so the same code runs in the browser and in a
// plain `node` check.
//
// A query is split into words. Every word has to match the entry somewhere (its label, or its extra text such as a
// blurb or a group name), and each word is scored by the best way it matches:
//   exact label > label starts with it > a word in the label starts with it > appears inside a word >
//   initials ("ofg" for Outline Flag Guesser) > letters in order with small gaps ("flgs" for Flag Guesser) >
//   a near miss on one word, one or two typos in (for words of four letters or more).
// Matches in the label come back as character indexes so the UI can highlight exactly the letters that matched.

export interface FuzzyHit {
    /** Higher is better. Roughly 0 to 100. */
    score: number;
    /** Indexes into the label (by character) that matched, sorted. Used for highlighting. */
    idx: number[];
}

/** Lower-case, drop accents, one array item per character so indexes line up with the original label. */
function chars(s: string): string[] {
    return Array.from(s, (c) => {
        const base = c.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        return base.length ? base.charAt(0) : c;
    });
}

const isWordChar = (c: string) => /[a-z0-9]/.test(c);
const isWordStart = (t: string[], i: number) => i === 0 || !isWordChar(t[i - 1]);

function range(from: number, to: number): number[] {
    const out: number[] = [];
    for (let i = from; i < to; i++) out.push(i);
    return out;
}

/** Edit distance, or limit + 1 as soon as it is clear it is larger than limit. */
function editDistance(a: string[], b: string[], limit: number): number {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
            cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
        }
        if (Math.min(...cur) > limit) return limit + 1;
        prev = cur;
    }
    return prev[b.length];
}

/** Scores one query word against one text (both as character arrays). Returns null when it does not match. */
function scoreWord(q: string[], t: string[]): { score: number; idx: number[] } | null {
    const n = q.length;
    if (!n || !t.length) return null;
    const startsAt = (i: number) => i + n <= t.length && q.every((c, k) => t[i + k] === c);

    if (n === t.length && startsAt(0)) return { score: 100, idx: range(0, n) };
    if (startsAt(0)) return { score: 95, idx: range(0, n) };

    // A word inside the text starts with it. Earlier words win.
    for (let i = 0; i < t.length; i++) {
        if (isWordStart(t, i) && startsAt(i)) return { score: 88 - Math.min(i, 30) * 0.2, idx: range(i, i + n) };
    }

    // Plain substring, anywhere inside a word.
    for (let i = 1; i < t.length; i++) {
        if (startsAt(i)) return { score: 72 - Math.min(i, 30) * 0.4, idx: range(i, i + n) };
    }

    // Initials: the first letters of consecutive words. "ofg" finds Outline Flag Guesser.
    if (n >= 2) {
        const starts: number[] = [];
        for (let i = 0; i < t.length; i++) if (isWordStart(t, i) && isWordChar(t[i])) starts.push(i);
        const picked: number[] = [];
        let s = 0;
        for (let k = 0; k < n; k++) {
            while (s < starts.length && t[starts[s]] !== q[k]) s++;
            if (s >= starts.length) break;
            picked.push(starts[s]);
            s++;
        }
        if (picked.length === n) return { score: 64, idx: picked };
    }

    // Letters in order, with small gaps. "flgs" finds Flag Guesser.
    if (n >= 2) {
        const picked: number[] = [];
        let pos = 0;
        for (let k = 0; k < n; k++) {
            let found = -1;
            for (let i = pos; i < t.length; i++) {
                if (t[i] === q[k]) {
                    found = i;
                    break;
                }
            }
            if (found < 0) break;
            picked.push(found);
            pos = found + 1;
        }
        if (picked.length === n) {
            const span = picked[n - 1] - picked[0] + 1;
            if (span <= n * 2 + 2) {
                const onStarts = picked.filter((p) => isWordStart(t, p)).length;
                const score = 42 + onStarts * 3 - (span - n) * 2;
                return { score: Math.max(20, Math.min(60, score)), idx: picked };
            }
        }
    }

    // Typo tolerance: one or two edits against a whole word, for words of four letters or more.
    if (n >= 4) {
        const limit = n >= 7 ? 2 : 1;
        let i = 0;
        while (i < t.length) {
            if (!isWordChar(t[i])) {
                i++;
                continue;
            }
            let j = i;
            while (j < t.length && isWordChar(t[j])) j++;
            if (editDistance(q, t.slice(i, j), limit) <= limit) return { score: 30, idx: range(i, j) };
            i = j;
        }
    }

    return null;
}

/**
 * Scores a query against an entry. `label` is what the user sees and can be highlighted. `extra` is searched too
 * (blurb, group, aliases) but scores lower and is never highlighted. Every word of the query has to match somewhere.
 */
export function fuzzyScore(query: string, label: string, extra = ""): FuzzyHit | null {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean).map((w) => chars(w));
    if (!words.length) return null;

    const L = chars(label);
    const X = chars(extra);
    let total = 0;
    const idx = new Set<number>();

    for (const w of words) {
        const onLabel = scoreWord(w, L);
        const onExtra = X.length ? scoreWord(w, X) : null;
        if (!onLabel && !onExtra) return null;
        const extraScore = onExtra ? onExtra.score * 0.6 : -1;
        if (onLabel && onLabel.score >= extraScore) {
            total += onLabel.score;
            onLabel.idx.forEach((i) => idx.add(i));
        } else {
            total += extraScore;
        }
    }

    // The whole query as one phrase inside the label gets a small bonus, so "flag guess" ranks Flag Guesser first.
    const phrase = words.map((w) => w.join("")).join(" ");
    const bonus = L.join("").includes(phrase) ? 4 : 0;

    return { score: total / words.length + bonus, idx: [...idx].sort((a, b) => a - b) };
}
