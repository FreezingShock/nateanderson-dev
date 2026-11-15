// One shared fetch of public/starwright/manifest.json for the scene sprites and the GUI sheets. Client only.
let p: Promise<unknown> | null = null;
export function fetchManifest(): Promise<unknown> {
    if (!p) {
        p = fetch("/starwright/manifest.json", { cache: "force-cache" })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no manifest"))))
            .catch((e) => { p = null; throw e; });
    }
    return p;
}
