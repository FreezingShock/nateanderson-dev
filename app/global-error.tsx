"use client";

// Last-resort boundary: it replaces the root layout, so it needs its own html and body and its own styles.
// Naming follows app/camino/ctos.css (ground, white title block, cyan accent). Kept self-contained on purpose.
const CSS = `
*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{background:#1a1a1a;color:#f4f4f2;font:16px/1.5 "Helvetica Neue",Helvetica,Arimo,Arial,sans-serif;-webkit-font-smoothing:antialiased;position:relative;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;pointer-events:none;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cpath d='M0 8 L100 82 M0 96 L100 14' stroke='%23c23bd0' stroke-width='1' fill='none' vector-effect='non-scaling-stroke'/%3E%3C/svg%3E") center/100% 100% no-repeat;opacity:.5}
main{position:relative;z-index:1;min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:20px 16px}
.card{position:relative;width:min(560px,100%);background:#141414;border:1px solid rgba(226,238,240,.26);border-left:3px solid #2fd8e8}
.card::before,.card::after{content:"";position:absolute;width:14px;height:14px;pointer-events:none}
.card::before{right:-1px;top:-1px;border-top:2px solid #f4f4f2;border-right:2px solid #f4f4f2}
.card::after{left:-3px;bottom:-1px;border-bottom:2px solid #f4f4f2;border-left:2px solid #f4f4f2}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 14px;background:#f4f4f2;color:#1a1a1a;font:700 10.5px/1 "IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase}
.top span:last-child{font-weight:500;color:#4a4a47;letter-spacing:.08em}
.body{padding:22px 16px 18px;display:grid;gap:16px}
h1{margin:0;justify-self:start;background:#f4f4f2;color:#1a1a1a;font:700 clamp(40px,12vw,64px)/.86 "Helvetica Neue",Helvetica,Arimo,Arial,sans-serif;letter-spacing:-.055em;text-transform:lowercase;padding:.1em .16em .2em .06em}
p{margin:0;color:#a9a9a4;font-size:14px}
.row{display:flex;flex-wrap:wrap;gap:10px}
a,button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:120px;padding:0 14px;border:1px solid #2fd8e8;font:600 11px/1 "IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;letter-spacing:.13em;text-transform:uppercase;text-decoration:none;cursor:pointer}
button{background:#2fd8e8;color:#031417}
a{background:transparent;color:#2fd8e8}
a:focus-visible,button:focus-visible{outline:2px solid #2fd8e8;outline-offset:3px}
.foot{display:flex;align-items:center;gap:12px;padding:9px 14px;border-top:1px dashed rgba(226,238,240,.3);font:500 9px/1 "IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;letter-spacing:.16em;text-transform:uppercase;color:#77776f}
.foot i{display:inline-block;width:3px;height:12px;margin-right:2px;background:#2fd8e8;vertical-align:bottom}
`;

export default function GlobalError({
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1, viewport-fit=cover"
                />
                <meta name="robots" content="noindex" />
                <meta name="color-scheme" content="dark" />
                <title>System fault · Nate&apos;s Portfolio</title>
                <style dangerouslySetInnerHTML={{ __html: CSS }} />
            </head>
            <body>
                <main>
                    <section className="card" aria-labelledby="gerr-title">
                        <div className="top">
                            <span>naOS // fault</span>
                            <span>nateanderson.dev</span>
                        </div>
                        <div className="body">
                            <h1 id="gerr-title">system fault.</h1>
                            <p>
                                The whole site hit an error and could not
                                recover this view. Retry, or open the home page.
                            </p>
                            <div className="row">
                                <button type="button" onClick={() => reset()}>
                                    Retry
                                </button>
                                <a href="/">Home</a>
                            </div>
                        </div>
                        <div className="foot">
                            <span>
                                <i aria-hidden="true" />
                                <i aria-hidden="true" />
                                <i aria-hidden="true" />
                            </span>
                            <span>Signal lost / global</span>
                        </div>
                    </section>
                </main>
            </body>
        </html>
    );
}
