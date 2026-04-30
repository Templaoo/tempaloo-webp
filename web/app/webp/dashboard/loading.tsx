/**
 * Skeleton state for /webp/dashboard. The dashboard waits on auth
 * verification + license fetch + quota fetch on every request — so
 * the user sees a brief white screen on cold-start without this.
 *
 * Renders the rough silhouette of the post-auth dashboard: header
 * card + 3 stat tiles + activity strip.
 */
export default function DashboardLoading() {
    return (
        <main className="dl-root">
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <div className="dl-header">
                <div className="dl-eyebrow" />
                <div className="dl-h1" />
                <div className="dl-sub" />
            </div>
            <div className="dl-stats">
                <div className="dl-tile" />
                <div className="dl-tile" />
                <div className="dl-tile" />
            </div>
            <div className="dl-strip" />
            <div className="dl-strip dl-strip-short" />
        </main>
    );
}

const css = `
.dl-root { max-width: 1080px; margin: 0 auto; padding: 64px clamp(16px, 3vw, 24px) 96px; }
.dl-root > div, .dl-root .dl-tile { background: var(--bg-2); border-radius: 10px; animation: dlt-pulse 1.4s ease-in-out infinite; }

.dl-header { padding: 0; background: transparent !important; animation: none !important; margin-bottom: 32px; }
.dl-eyebrow { width: 130px; height: 11px; margin-bottom: 12px; }
.dl-h1 { width: 60%; height: 36px; margin-bottom: 12px; }
.dl-sub { width: 50%; height: 16px; }

.dl-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 32px; background: transparent !important; animation: none !important; }
.dl-tile { height: 110px; }

.dl-strip { width: 100%; height: 56px; margin-bottom: 12px; }
.dl-strip-short { width: 80%; }

@keyframes dlt-pulse {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 0.9; }
}
@media (prefers-reduced-motion: reduce) {
  .dl-root > div, .dl-root .dl-tile { animation: none; }
}
`;
