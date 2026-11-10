import { notFound } from "next/navigation";
import { getProjectBySlug, getAllProjectSlugs, statusLabel } from "@/lib/content";
import { PROJECT_GALLERY, PROJECT_LINKS, categoryById } from "@/lib/creations-data";
import { CreationsHead, IdCard } from "@/components/creations-sections";
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

// Individual project / renovation page, laid out as a case study. When the project has screenshots (PROJECT_GALLERY),
// the first one is the large lead image and the rest form a gallery; otherwise the hatched plate stands in. A detail
// sheet with the tags and the outbound link sits beside the status card, as before.
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const project = await getProjectBySlug(slug);
    if (!project) notFound();

    const isProject = project.section === "projects";
    const Icon = categoryById(isProject ? "projects" : "renovations").icon;
    const kind = isProject ? "Project" : "Renovation";
    const shots = PROJECT_GALLERY[slug] ?? [];
    const [lead, ...rest] = shots;
    const outbound = PROJECT_LINKS[slug] ?? (project.href ? { href: project.href, label: "Visit project" } : undefined);

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
                    {lead ? (
                        <figure className="cr-case-lead">
                            <img src={lead.src} alt={lead.alt} width={1600} height={1000} loading="eager" decoding="async" />
                            <figcaption>{lead.caption}</figcaption>
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

                    {rest.length > 0 && (
                        <div className="cr-case-gallery">
                            <span className="cm-lbl">Gallery</span>
                            <div className={rest.length > 1 ? "cr-case-grid is-multi" : "cr-case-grid"}>
                                {rest.map((shot) => (
                                    <figure key={shot.src} className="cr-case-shot">
                                        <img src={shot.src} alt={shot.alt} width={1600} height={1000} loading="lazy" decoding="async" />
                                        <figcaption>{shot.caption}</figcaption>
                                    </figure>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
