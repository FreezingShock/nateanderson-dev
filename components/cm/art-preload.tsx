/**
 * The header bands and section washes in components/cm/naos-art.css are CSS backgrounds, which the browser only
 * fetches once it lays the element out. They are a few kilobytes each, so a page asks for the ones it will paint
 * up front, from the component that renders the element.
 *
 * This is a plain <link> element, not ReactDOM.preload(): React hoists the element into <head> only when the page
 * itself renders. A preload() call travels as a hint inside the page's RSC payload, so a hover or prefetch of
 * another route applied it to the current page and the browser warned that it was never used.
 */
export type NaosArtName = "band-track" | "band-rail" | "band-seam" | "wash-a" | "wash-b" | "wash-c" | "wash-d";

export function ArtPreload({ name }: { name: NaosArtName }) {
    return <link rel="preload" as="image" href={`/naos/${name}.webp`} />;
}
