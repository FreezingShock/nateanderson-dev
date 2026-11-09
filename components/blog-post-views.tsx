import type { EssayBlock, PostBody } from "@/lib/blog-types";

/**
 * Renders the body of a post for its kind. Three layouts, all naOS:
 * - essay: dark long-form column with title-card headings, pull quotes and mono code plates
 * - quote: one paper plate with the line set at full size and a dither foot
 * - poem: paper plate with stanzas, one row per printed line, roman stanza numbers in the gutter
 * Each wrapper carries `data-rx-auto`, so the shared reveal engine tags the rows and text itself.
 */

export function EssayView({ blocks }: { blocks: EssayBlock[] }) {
    return (
        <div className="post-prose" data-rx-auto="">
            {blocks.map((b, i) => {
                switch (b.t) {
                    case "p":
                        return <p key={i}>{b.text}</p>;
                    case "h":
                        return (
                            <h2 key={i} className="post-h">
                                <span>{b.text}</span>
                            </h2>
                        );
                    case "quote":
                        return (
                            <blockquote key={i}>
                                <p>{b.text}</p>
                                {b.cite && <cite>{b.cite}</cite>}
                            </blockquote>
                        );
                    case "list":
                        return (
                            <ul key={i} className="post-list">
                                {b.items.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        );
                    case "code":
                        return (
                            <pre key={i} className="post-code">
                                <code>{b.text}</code>
                            </pre>
                        );
                }
            })}
        </div>
    );
}

export function QuoteView({
    body,
}: {
    body: Extract<PostBody, { kind: "quote" }>;
}) {
    return (
        <div className="post-quote" data-rx-auto="">
            <figure className="post-quote-card">
                <span className="post-quote-mark" aria-hidden="true">
                    “
                </span>
                <blockquote className="post-quote-text">
                    <p>{body.text}</p>
                </blockquote>
                <figcaption className="post-quote-foot">
                    <span className="post-quote-who">
                        {body.attribution && <b>{body.attribution}</b>}
                        {body.source && <span>{body.source}</span>}
                    </span>
                    <span className="id-bars" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                    </span>
                </figcaption>
            </figure>
            {body.note && body.note.length > 0 && (
                <div className="post-quote-note">
                    {body.note.map((p, i) => (
                        <p key={i}>{p}</p>
                    ))}
                </div>
            )}
        </div>
    );
}

export function PoemView({
    body,
}: {
    body: Extract<PostBody, { kind: "poem" }>;
}) {
    return (
        <div className="post-poem" data-rx-auto="">
            {body.epigraph && (
                <div className="post-epi">
                    <p>{body.epigraph.text}</p>
                    {body.epigraph.cite && <cite>{body.epigraph.cite}</cite>}
                </div>
            )}
            <div className="post-poem-card">
                {body.stanzas.map((stanza, si) => (
                    <div key={si} className="post-stanza">
                        <span className="post-stanza-no" aria-hidden="true">
                            {toRoman(si + 1)}
                        </span>
                        <div className="post-lines">
                            {stanza.map((line, li) => (
                                <p key={li} className="post-line">
                                    {line}
                                </p>
                            ))}
                        </div>
                    </div>
                ))}
                <div className="post-poem-foot" aria-hidden="true">
                    <span className="id-bars">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                    </span>
                    <span>{body.stanzas.length} stanzas</span>
                </div>
            </div>
            {body.note && <p className="post-poem-note">{body.note}</p>}
        </div>
    );
}

function toRoman(n: number): string {
    const map: [number, string][] = [
        [10, "X"],
        [9, "IX"],
        [5, "V"],
        [4, "IV"],
        [1, "I"],
    ];
    let out = "";
    let rest = n;
    for (const [v, s] of map) {
        while (rest >= v) {
            out += s;
            rest -= v;
        }
    }
    return out;
}
