/**
 * Skeleton placeholders rendered while the animation data prefetch
 * is in flight. Pure CSS shimmer (no JS animation cost). Mirrors the
 * real component layout so the user sees a "ghost" of what's coming
 * — the perception of speed (Facebook / LinkedIn / Slack pattern).
 *
 * No data needed — components render immediately, replaced once
 * useAnimationData() resolves.
 */

export function SkeletonBar({ width, height = 12, radius = 4 }: { width: string | number; height?: number; radius?: number }) {
  return (
    <span
      className="tsa-skel"
      style={{
        display:      'inline-block',
        width:        typeof width === 'number' ? `${width}px` : width,
        height:       `${height}px`,
        borderRadius: `${radius}px`,
        verticalAlign: 'middle',
      }}
    />
  );
}

export function SkeletonBlock({ height = 40, radius = 6, mb = 8 }: { height?: number; radius?: number; mb?: number }) {
  return (
    <div
      className="tsa-skel"
      style={{
        height:       `${height}px`,
        borderRadius: `${radius}px`,
        marginBottom: `${mb}px`,
      }}
    />
  );
}

/** Full skeleton mimicking the AnimationView layout (audit list +
 *  steps strip + step body). */
export function AnimationViewSkeleton() {
  return (
    <>
      {/* Audit list ghost */}
      <div className="tsa-am-audit" aria-hidden="true">
        <header className="tsa-am-audit__head">
          <SkeletonBar width={120} />
          <span className="tsa-am-audit__count"><SkeletonBar width={20} height={14} radius={999} /></span>
        </header>
        <ul className="tsa-am-audit__list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {[0, 1, 2].map((i) => (
            <li key={i} className="tsa-am-audit__row" style={{ display: 'flex', gap: 8, padding: '6px 10px' }}>
              <SkeletonBar width={18} height={18} radius={4} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <SkeletonBar width="60%" height={10} />
                <SkeletonBar width="40%" height={9} />
              </div>
              <SkeletonBar width={20} height={20} radius={4} />
              <SkeletonBar width={20} height={20} radius={4} />
            </li>
          ))}
        </ul>
      </div>

      {/* Steps strip ghost */}
      <nav className="tsa-fp-anim__steps" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="tsa-fp-anim__step" style={{ pointerEvents: 'none' }}>
            <SkeletonBar width={16} height={16} radius={999} />
            <SkeletonBar width={50} height={11} />
          </div>
        ))}
      </nav>

      {/* Step body ghost — matches StepStyle's vertical card layout */}
      <div className="tsa-fp-anim__body" aria-hidden="true">
        <div style={{ marginBottom: 12 }}>
          <SkeletonBar width={40}  height={9} />
          <div style={{ marginTop: 6 }}>
            <SkeletonBar width="55%" height={16} />
          </div>
          <div style={{ marginTop: 6 }}>
            <SkeletonBar width="80%" height={11} />
          </div>
        </div>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} height={56} radius={8} mb={8} />
        ))}
      </div>
    </>
  );
}
