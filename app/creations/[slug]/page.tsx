import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectBySlug, getAllProjectSlugs, getProjects, getRecentRenovations, statusLabel } from "@/lib/content";
import { PROJECT_GALLERY, PROJECT_LINKS, PROJECT_PREVIEW, categoryById } from "@/lib/creations-data";
import { CreationsHead, IdCard } from "@/components/creations-sections";
import { ProjectGallery } from "@/components/creations/project-gallery";
import { pageMeta } from "@/lib/seo";

import { NaosBackdrop } from "@/components/cm/naos-art";
import { PixelIcon } from "@/components/cm/pixel-icons";
export const revalidate = 60;

export async function generateStaticParams() {
    const slugs = await getAllProjectSlugs();
    return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const project = await getProjectBySlug(slug);
    if (!project) return { title: "Creation" };
    return pageMeta({ title: project.title, description: project.description, path: `/creations/${slug}` });
}

const tone = { active: "live", planning: "warn", idea: "" } as const;

// Individual project / renovation page, laid out as a case study:
//   1. the lead: a live preview when the project runs in the browser, otherwise its first screenshot, otherwise the plate
//   2. the details sheet with the tags and the outbound link
//   3. the full gallery (click any frame to open it full size)
//   4. previous / next within the same list
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const project = await getProjectBySlug(slug);
    if (!project) notFound();

    const isProject = project.section === "projects";
    const Icon = categoryById(isProject ? "projects" : "renovations").icon;
    const kind = isProject ? "Project" : "Renovation";
    const shots = PROJECT_GALLERY[slug] ?? [];
    const preview = PROJECT_PREVIEW[slug];
    const outbound = PROJECT_LINKS[slug] ?? (project.href ? { href: project.href, label: "Visit project" } : undefined);

    // Lead and gallery split: with a live preview, every screenshot goes in the gallery. Without one, the first
    // screenshot leads and the rest form the gallery.
    const [firstShot, ...restShots] = shots;
    const galleryShots = preview ? shots : restShots;

    // Neighbours come from the same list the hub links to, in its order.
    const siblings = isProject ? await getProjects() : await getRecentRenovations();
    const at = siblings.findIndex((p) => p.slug === slug);
    const prev = at > 0 ? siblings[at - 1] : null;
    const next = at >= 0 && at < siblings.length - 1 ? siblings[at + 1] : null;

    return (
        <div className="ctos cr-sub">
            <NaosBackdrop src="/naos/bg-default.webp" />
            <CreationsHead
                label={project.category}
                title={[project.title]}
                lead={project.description}
                back={{ href: isProject ? "/creations/projects" : "/creations/renovations", label: isProject ? "Back to Projects" : "Back to Renovations" }}
                aside={
                    <IdCard
                        label={`${kind.toLowerCase()} // file`}
                        badge={isProject ? "pj" : "rn"}
                        year={project.status}
                        live={false}
                        rows={[
                            { k: "Status", v: statusLabel[project.status] },
                            { k: "Category", v: project.category },
                            { k: "Section", v: kind },
                            { k: "Slug", v: project.slug },
                        ]}
                        foot={["file / " + project.slug, `${project.tags.length} tags`]}
                    />
                }
            />
            <section className="cm-section cr-detail-sec" id="detail">
                <div className="cm-wrap cr-detail" data-rx-auto="">
                    {preview ? (
                        <figure className="cr-preview">
                            <div className="cr-preview-frame">
                                <iframe
                                    src={preview.src}
                                    title={preview.title}
                                    loading="lazy"
                                    allow="fullscreen; gamepad; autoplay"
                                    allowFullScreen
                                    referrerPolicy="strict-origin-when-cross-origin"
                                />
                            </div>
                            {outbound && (
                                <figcaption className="cr-preview-bar">
                                    <span className="cm-lbl">Live</span>
                                    <a href={outbound.href} target="_blank" rel="noreferrer">
                                        {outbound.label} <span aria-hidden="true">↗</span>
                                    </a>
                                </figcaption>
                            )}
                        </figure>
                    ) : firstShot ? (
                        <figure className="cr-case-shot cr-case-lead">
                            <img src={firstShot.src} alt={firstShot.alt} width={1600} height={1000} loading="eager" decoding="async" />
                            <figcaption>{firstShot.caption}</figcaption>
                        </figure>
                    ) : (
                        <div className="cm-viz cr-plate">
                            <span className={`cm-tag flat ${tone[project.status]} cr-plate-tag`}>{statusLabel[project.status]}</span>
                            <Icon className="cr-plate-ic" aria-hidden="true" />
                        </div>
                    )}

                    <div className="cm-panel cr-sheet">
                        <div className="cm-hbar">
                            <span>Details</span>
                            <span>{kind}</span>
                        </div>
                        <div className="cr-sheet-cols">
                            {project.tags.length > 0 && (
                                <div className="cr-sheet-block">
                                    <span className="cm-lbl">Tags</span>
                                    <div className="cr-tags">
                                        {project.tags.map((t) => (
                                            <span key={t} className="cm-pill">{t}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="cr-sheet-block">
                                <span className="cm-lbl">Link</span>
                                {outbound ? (
                                    <div className="cm-row cta">
                                        <a className="cta-b a" href={outbound.href} target="_blank" rel="noreferrer">
                                            <i>GO</i><span>{outbound.label}</span><em aria-hidden="true"><PixelIcon name="external" /></em>
                                        </a>
                                    </div>
                                ) : (
                                    <p className="cm-body" style={{ margin: 0 }}>No outside link yet. This one lives on the site for now.</p>
                                )}
                            </div>
                        </div>
                        <div className="p-foot" aria-hidden="true">
                            <span className="id-bars"><i /><i /><i /><i /><i /></span>
                            <span>{kind.toLowerCase()} / {project.status}</span>
                            <span>{project.category}</span>
                        </div>
                    </div>

                    {galleryShots.length > 0 && (
                        <div className="cr-case-gallery">
                            <span className="cm-lbl">Gallery</span>
                            <ProjectGallery shots={galleryShots} />
                        </div>
                    )}

                    <nav className="cr-pn" aria-label="More creations">
                        {prev ? (
                            <Link href={`/creations/${prev.slug}`} className="cr-pn-link prev">
                                <span className="cm-lbl">← Previous</span>
                                <b>{prev.title}</b>
                            </Link>
                        ) : (
                            <span className="cr-pn-empty" aria-hidden="true" />
                        )}
                        {next ? (
                            <Link href={`/creations/${next.slug}`} className="cr-pn-link next">
                                <span className="cm-lbl">Next →</span>
                                <b>{next.title}</b>
                            </Link>
                        ) : (
                            <span className="cr-pn-empty" aria-hidden="true" />
                        )}
                    </nav>
                </div>
            </section>
        </div>
    );
}
