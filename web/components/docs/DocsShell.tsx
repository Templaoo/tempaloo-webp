"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/Logo";

interface NavItem {
    label: string;
    href: string;
}
interface NavSection {
    title: string;
    items: NavItem[];
}

const NAV: NavSection[] = [
    {
        title: "GETTING STARTED",
        items: [
            { label: "Overview", href: "/docs" },
            { label: "Install & activate", href: "/docs#install" },
        ],
    },
    {
        title: "FEATURES",
        items: [
            { label: "Compression stats", href: "/docs/features#stats" },
            { label: "Restore originals",  href: "/docs/features#restore" },
            { label: "Resize on upload",   href: "/docs/features#resize" },
            { label: "Quality presets",    href: "/docs/features#presets" },
        ],
    },
    {
        title: "WP-CLI",
        items: [
            { label: "Overview",    href: "/docs/cli" },
            { label: "status",      href: "/docs/cli#status" },
            { label: "activate",    href: "/docs/cli#activate" },
            { label: "bulk",        href: "/docs/cli#bulk" },
            { label: "restore",     href: "/docs/cli#restore" },
            { label: "quota",       href: "/docs/cli#quota" },
            { label: "settings",    href: "/docs/cli#settings" },
        ],
    },
    {
        title: "DEVELOPER HOOKS",
        items: [
            { label: "Overview",                       href: "/docs/hooks" },
            { label: "tempaloo_webp_skip_attachment",  href: "/docs/hooks#skip" },
            { label: "tempaloo_webp_quality_for",      href: "/docs/hooks#quality" },
            { label: "tempaloo_webp_after_convert",    href: "/docs/hooks#after" },
        ],
    },
    {
        title: "GUIDES",
        items: [
            { label: "Media Library actions", href: "/docs/features#media-library" },
            { label: "Async upload pipeline", href: "/docs/features#async" },
            { label: "Diagnostic & repair",   href: "/docs/features#diagnostic" },
            { label: "Cache compatibility",   href: "/docs/features#cache" },
            { label: "Troubleshooting",       href: "/docs/features#troubleshooting" },
        ],
    },
    {
        title: "RESOURCES",
        items: [
            { label: "About",       href: "/about" },
            { label: "Changelog",   href: "/changelog" },
            { label: "Contact",     href: "/contact" },
            { label: "Privacy",     href: "/privacy" },
            { label: "Terms",       href: "/terms" },
        ],
    },
];

export function DocsShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [navOpen, setNavOpen] = useState(false);

    return (
        <div className="docs-root">
            <style dangerouslySetInnerHTML={{ __html: shellCss }} />

            <header className="docs-nav">
                <div className="docs-nav-inner">
                    <Link href="/webp" className="docs-nav-logo" aria-label="Tempaloo home">
                        <LogoMark size={28} />
                    </Link>
                    <nav className="docs-nav-links">
                        <Link href="/webp">Plugin</Link>
                        <Link href="/docs" className="is-active">Docs</Link>
                        <Link href="/webp#pricing">Pricing</Link>
                    </nav>
                    <div className="docs-nav-right">
                        <Link href="/webp/activate" className="btn btn-ghost btn-sm">Sign in</Link>
                        <Link href="/webp/activate?plan=free" className="btn btn-primary btn-sm">Get started</Link>
                        <button
                            type="button"
                            className="docs-nav-burger"
                            aria-label={navOpen ? "Close docs nav" : "Open docs nav"}
                            aria-expanded={navOpen}
                            onClick={() => setNavOpen(v => !v)}
                        >
                            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                                {navOpen ? <path d="M3 3 L13 13 M13 3 L3 13" /> : <path d="M2.5 4.5 H13.5 M2.5 8 H13.5 M2.5 11.5 H13.5" />}
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            <div className="docs-body">
                <aside className={`docs-side ${navOpen ? "is-open" : ""}`}>
                    {NAV.map((section) => (
                        <div key={section.title} className="docs-side-section">
                            <div className="docs-side-h">{section.title}</div>
                            <ul>
                                {section.items.map((item) => {
                                    const isCurrent = item.href.split("#")[0] === pathname;
                                    return (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                onClick={() => setNavOpen(false)}
                                                className={isCurrent ? "is-current" : ""}
                                            >
                                                {item.label}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </aside>

                <main className="docs-main">
                    {children}
                    <div className="docs-foot">
                        <span>Need help?</span>
                        <a href="mailto:support@tempaloo.com">support@tempaloo.com</a>
                    </div>
                </main>
            </div>
        </div>
    );
}

const shellCss = `
.docs-root { min-height: 100vh; background: var(--bg); color: var(--ink); font-family: var(--font-geist-sans), sans-serif; }

.docs-nav { position: sticky; top: 0; z-index: 50; background: color-mix(in oklab, var(--bg) 90%, transparent); backdrop-filter: blur(14px) saturate(180%); -webkit-backdrop-filter: blur(14px) saturate(180%); border-bottom: 1px solid var(--line); }
.docs-nav-inner { max-width: 1280px; margin: 0 auto; padding: 0 clamp(16px, 3vw, 24px); height: 60px; display: grid; grid-template-columns: auto 1fr auto; gap: 24px; align-items: center; }
.docs-nav-logo { display: inline-flex; color: var(--ink); }
.docs-nav-links { display: flex; gap: 4px; justify-self: center; }
.docs-nav-links a { font-size: 14px; color: var(--ink-2); padding: 6px 12px; font-weight: 450; border-radius: 6px; transition: color .15s, background .15s; }
.docs-nav-links a:hover { color: var(--ink); background: var(--bg-2); }
.docs-nav-links a.is-active { color: var(--ink); }
.docs-nav-right { display: flex; gap: 8px; align-items: center; }
.docs-nav-burger { display: none; height: 34px; width: 34px; border-radius: 7px; background: transparent; border: 1px solid var(--line-2); color: var(--ink); cursor: pointer; align-items: center; justify-content: center; }

.docs-body { max-width: 1280px; margin: 0 auto; padding: 0 clamp(16px, 3vw, 24px); display: grid; grid-template-columns: 240px 1fr; gap: 48px; align-items: start; }

.docs-side { position: sticky; top: 76px; padding: 32px 0; max-height: calc(100vh - 76px); overflow-y: auto; }
.docs-side-section { margin-bottom: 28px; }
.docs-side-h { font-family: var(--font-geist-mono), monospace; font-size: 11px; letter-spacing: 0.04em; color: var(--ink-3); margin-bottom: 10px; padding: 0 4px; }
.docs-side ul { list-style: none; padding: 0; margin: 0; }
.docs-side li { margin: 0; }
.docs-side a { display: block; font-size: 13.5px; padding: 6px 12px; border-radius: 6px; color: var(--ink-2); text-decoration: none; transition: color .15s, background .15s; }
.docs-side a:hover { color: var(--ink); background: var(--bg-2); }
.docs-side a.is-current { color: var(--ink); background: var(--bg-2); font-weight: 500; }

.docs-main { padding: 48px 0 96px; min-width: 0; }
.docs-foot { margin-top: 80px; padding-top: 24px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--ink-3); }
.docs-foot a { color: var(--ink); border-bottom: 1px solid var(--line-2); padding-bottom: 1px; }

@media (max-width: 880px) {
  .docs-body { grid-template-columns: 1fr; gap: 0; }
  .docs-side { position: fixed; top: 60px; left: 0; right: 0; bottom: 0; background: var(--bg); padding: 24px clamp(16px,3vw,24px); border-right: none; border-top: 1px solid var(--line); transform: translateX(-100%); transition: transform .25s; z-index: 40; max-height: none; }
  .docs-side.is-open { transform: translateX(0); }
  .docs-nav-burger { display: inline-flex; }
  .docs-nav-links { display: none; }
  .docs-nav-inner { grid-template-columns: auto 1fr auto; }
  .docs-main { padding: 32px 0 64px; }
}
`;
