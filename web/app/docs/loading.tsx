/**
 * Skeleton state for /docs/* navigation. Renders a faint outline of
 * the article content (eyebrow → h1 → lead → 4 prose blocks) so the
 * tab change feels responsive even when the next page is server-
 * rendering.
 */
export default function DocsLoading() {
    return (
        <article className="docs-loading">
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <div className="dl-eyebrow" />
            <div className="dl-h1" />
            <div className="dl-lead" />
            <div className="dl-lead dl-lead-short" />

            <div className="dl-section">
                <div className="dl-h2" />
                <div className="dl-p" />
                <div className="dl-p" />
                <div className="dl-p dl-p-short" />
            </div>
            <div className="dl-section">
                <div className="dl-h2" />
                <div className="dl-p" />
                <div className="dl-p" />
            </div>
        </article>
    );
}

const css = `
.docs-loading { max-width: 760px; padding: 48px 0 96px; }
.docs-loading > div { background: var(--bg-2); border-radius: 6px; animation: dl-pulse 1.4s ease-in-out infinite; }
.dl-eyebrow { width: 140px; height: 11px; margin-bottom: 14px; }
.dl-h1 { width: 70%; height: 44px; margin-bottom: 18px; border-radius: 8px !important; }
.dl-lead { width: 100%; height: 18px; margin-bottom: 8px; }
.dl-lead-short { width: 60%; margin-bottom: 32px; }
.dl-section { margin-top: 48px; }
.dl-h2 { width: 40%; height: 26px; margin-bottom: 16px; }
.dl-p { width: 100%; height: 16px; margin-bottom: 10px; }
.dl-p-short { width: 75%; }

@keyframes dl-pulse {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 0.9; }
}
@media (prefers-reduced-motion: reduce) {
  .docs-loading > div { animation: none; }
}
`;
