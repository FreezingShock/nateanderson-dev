// Post bodies for the single-post route (app/blog/[slug]). Plain data, no MDX: paste text into the `body` of a post in
// lib/blog.ts and the layout for its kind (essay, quote or poem) does the rest.

/** One block of an essay. `t` is the block type. */
export type EssayBlock =
    | { t: "p"; text: string }
    | { t: "h"; text: string }
    | { t: "quote"; text: string; cite?: string }
    | { t: "list"; items: string[] }
    | { t: "code"; text: string };

export type PostBody =
    | { kind: "essay"; blocks: EssayBlock[] }
    | {
          kind: "quote";
          /** The line itself. Set at full size, casing kept as written. */
          text: string;
          attribution?: string;
          /** Where it is from: a book, talk, person, or "my notes". */
          source?: string;
          /** Optional paragraphs under the card: why the line stuck. */
          note?: string[];
      }
    | {
          kind: "poem";
          /** Each stanza is a list of lines. Every entry is one printed line, so breaks are kept exactly as written. */
          stanzas: string[][];
          epigraph?: { text: string; cite?: string };
          /** Optional short note under the poem. */
          note?: string;
      };

export const POST_KIND_LABEL: Record<PostBody["kind"], string> = {
    essay: "Essay",
    quote: "Quote",
    poem: "Poem",
};

/** Words in a body, used for the reading time. Poems are measured by line, not by minutes. */
export function bodyWordCount(body: PostBody): number {
    const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
    if (body.kind === "essay") {
        return body.blocks.reduce((n, b) => {
            if (b.t === "list") return n + b.items.reduce((m, item) => m + words(item), 0);
            return n + words(b.text);
        }, 0);
    }
    if (body.kind === "quote") {
        return words(body.text) + (body.note ?? []).reduce((n, p) => n + words(p), 0);
    }
    return 0;
}

export function poemLineCount(body: Extract<PostBody, { kind: "poem" }>): number {
    return body.stanzas.reduce((n, s) => n + s.length, 0);
}
