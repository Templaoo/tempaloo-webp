import { useEffect, useMemo, useState } from 'react';
import { api, type AnimationLibrary, type AnimationRule } from '../api';
import { toast } from '../components/Toast';
import { RuleEditor } from '../pages/animation/RuleEditor';

/**
 * AnimateMode — click-driven element animator (step 2).
 *
 * UX flow:
 *   1. User clicks "Animate" → enters mode.
 *   2. Hovering any element on the page draws a cyan outline.
 *   3. Clicking an element pins it + opens a popover anchored to it.
 *   4. Popover shows: detected element type · CSS selector · preset
 *      dropdown filtered by element-type compatibility · params editor.
 *   5. Save → POST /animation/v2/selector-override and call
 *      ts.animations.applyRuleToElement(node, rule) for instant
 *      preview without reload.
 *
 * Excluded from picking: anything inside the floating panel itself
 * (#tempaloo-studio-floating-root) and elements without a stable
 * tag/class. WordPress admin bar / debug bar are also skipped.
 */
export function AnimateMode({ active, onClose }: { active: boolean; onClose: () => void }) {
  const [hover,    setHover]    = useState<HTMLElement | null>(null);
  const [pinned,   setPinned]   = useState<HTMLElement | null>(null);
  const [hoverBox, setHoverBox] = useState<DOMRect | null>(null);

  // Library + existing override (for the pinned element)
  const [lib, setLib] = useState<AnimationLibrary | null>(null);
  const [rule, setRule] = useState<AnimationRule>(() => makeDefaultRule('fade-up'));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!active) {
      setHover(null); setPinned(null); setHoverBox(null);
      return;
    }
    if (!lib) {
      api.getAnimationLibrary().then(setLib).catch((e) => toast.error(`Library load failed: ${(e as Error).message}`));
    }

    const isExcluded = (el: Element): boolean => {
      if (!el || el === document.documentElement || el === document.body) return true;
      if ((el as HTMLElement).closest('#tempaloo-studio-floating-root')) return true;
      if ((el as HTMLElement).closest('#wpadminbar')) return true;
      if ((el as HTMLElement).closest('.tsa-am-popover')) return true;
      if ((el as HTMLElement).closest('.tsa-am-overlay')) return true;
      return false;
    };

    const onMove = (e: MouseEvent) => {
      if (pinned) return; // freeze hover when one is pinned
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!el || isExcluded(el)) { setHover(null); setHoverBox(null); return; }
      setHover(el);
      setHoverBox(el.getBoundingClientRect());
    };

    const onClick = (e: MouseEvent) => {
      if (pinned) return; // popover open — click outside should be handled by popover
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!el || isExcluded(el)) return;
      e.preventDefault();
      e.stopPropagation();
      setPinned(el);
      // Try to read existing override for the generated selector.
      const sel = generateSelector(el);
      try {
        api.getAnimationV2().then((s) => {
          const existing = s.selectorOverrides?.[sel];
          if (existing && existing.rule) setRule(existing.rule);
          else setRule(makeDefaultRule(detectPreset(el)));
        });
      } catch { /* noop */ }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPinned(null); }
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click',     onClick,  true);
    document.addEventListener('keydown',   onKey);
    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click',     onClick,  true);
      document.removeEventListener('keydown',   onKey);
    };
  }, [active, pinned, lib]);

  const pinnedSelector = useMemo(() => (pinned ? generateSelector(pinned) : ''), [pinned]);
  const pinnedTypeId   = useMemo(() => (pinned ? detectElementType(pinned) : ''), [pinned]);
  const pinnedRect     = useMemo(() => (pinned ? pinned.getBoundingClientRect() : null), [pinned]);

  if (!active) return null;

  async function save() {
    if (!pinned || !pinnedSelector || !rule.preset) return;
    setSaving(true);
    try {
      await api.setSelectorOverride(pinnedSelector, rule, label(pinned));
      // Apply live without reload.
      const w = window as unknown as { tempaloo?: { studio?: { animations?: { applyRuleToElement?: (el: Element, r: AnimationRule) => void } } } };
      const fn = w.tempaloo?.studio?.animations?.applyRuleToElement;
      if (fn) fn(pinned, rule);
      // Update the runtime payload in-place so future reloads / re-applies see it.
      const animV2 = (window as unknown as { tempaloo?: { studio?: { animV2?: { selectorOverrides?: Record<string, unknown> } } } }).tempaloo?.studio?.animV2;
      if (animV2) {
        animV2.selectorOverrides = animV2.selectorOverrides || {};
        animV2.selectorOverrides[pinnedSelector] = { rule, label: label(pinned), savedAt: Date.now() };
      }
      toast.info(`Saved animation for ${pinnedSelector}`);
      setPinned(null);
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!pinnedSelector) return;
    setSaving(true);
    try {
      await api.deleteSelectorOverride(pinnedSelector);
      // Clear from runtime payload + revert any context.
      const animV2 = (window as unknown as { tempaloo?: { studio?: { animV2?: { selectorOverrides?: Record<string, unknown> } } } }).tempaloo?.studio?.animV2;
      if (animV2 && animV2.selectorOverrides) delete animV2.selectorOverrides[pinnedSelector];
      const ctx = (pinned as unknown as { __tw_anim_ctx?: { revert: () => void } } | null)?.__tw_anim_ctx;
      if (ctx && typeof ctx.revert === 'function') ctx.revert();
      toast.info(`Removed override for ${pinnedSelector}`);
      setPinned(null);
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Hover outline */}
      {hover && hoverBox && !pinned && (
        <div
          className="tsa-am-overlay"
          style={{
            top:    hoverBox.top + window.scrollY,
            left:   hoverBox.left + window.scrollX,
            width:  hoverBox.width,
            height: hoverBox.height,
          }}
        >
          <span className="tsa-am-overlay__label">{tagDescriptor(hover)}</span>
        </div>
      )}

      {/* Pinned outline */}
      {pinned && pinnedRect && (
        <div
          className="tsa-am-overlay tsa-am-overlay--pinned"
          style={{
            top:    pinnedRect.top + window.scrollY,
            left:   pinnedRect.left + window.scrollX,
            width:  pinnedRect.width,
            height: pinnedRect.height,
          }}
        />
      )}

      {/* Popover */}
      {pinned && pinnedRect && lib && (
        <div
          className="tsa-am-popover"
          style={popoverPosition(pinnedRect)}
          role="dialog"
          aria-label="Animate element"
        >
          <header className="tsa-am-popover__head">
            <strong>Animate · {tagDescriptor(pinned)}</strong>
            <button type="button" className="tsa-am-popover__close" onClick={() => setPinned(null)} aria-label="Close">×</button>
          </header>
          <div className="tsa-am-popover__sel">
            Selector: <code>{pinnedSelector}</code>
          </div>

          <div className="tsa-am-popover__body">
            <RuleEditor
              rule={rule}
              lib={lib}
              elementTypeId={pinnedTypeId}
              onChange={setRule}
            />
          </div>

          <footer className="tsa-am-popover__foot">
            <button type="button" className="tsa-btn-ghost" onClick={() => setPinned(null)}>Cancel</button>
            <button type="button" className="tsa-btn-ghost" onClick={remove} disabled={saving}>Remove</button>
            <button type="button" className="tsa-btn-primary" onClick={save} disabled={saving || !rule.preset}>
              {saving ? 'Saving…' : 'Save & apply'}
            </button>
          </footer>
        </div>
      )}

      {/* Hint banner — top of viewport */}
      <div className="tsa-am-hint">
        <span>Animate Mode — hover any element, click to animate it. <kbd>Esc</kbd> to deselect.</span>
        <button type="button" className="tsa-am-hint__exit" onClick={onClose}>Exit</button>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────
 * Helpers — selector generation, element-type detection, etc.
 * ──────────────────────────────────────────────────────────── */

/**
 * Build a stable, reasonably specific CSS selector for an element.
 * Strategy (in order of preference):
 *   1. id selector if id is present and unique-looking
 *   2. tag.class.class up to 3 classes from the element
 *   3. tag.parent-class > tag fallback
 * Always sanitises against the schema-permitted charset.
 */
function generateSelector(el: HTMLElement): string {
  if (el.id && /^[a-zA-Z][\w-]*$/.test(el.id)) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList)
    .filter((c) => /^[a-zA-Z_][\w-]*$/.test(c))
    .filter((c) => !c.startsWith('elementor-element-')) // skip Elementor's auto-IDs (per-page random)
    .slice(0, 3);
  if (classes.length) return `${tag}.${classes.join('.')}`;
  // Fallback: walk up to find a parent with classes.
  let parent: HTMLElement | null = el.parentElement;
  while (parent && parent !== document.body) {
    const pclasses = Array.from(parent.classList).filter((c) => /^[a-zA-Z_][\w-]*$/.test(c)).slice(0, 2);
    if (pclasses.length) return `${parent.tagName.toLowerCase()}.${pclasses.join('.')} > ${tag}`;
    parent = parent.parentElement;
  }
  return tag;
}

function detectElementType(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'h1') return 'h1';
  if (tag === 'h2') return 'h2';
  if (tag === 'h3') return 'h3';
  if (tag === 'p')  return 'p';
  if (tag === 'img' || tag === 'picture') return 'img';
  if (tag === 'button') return 'button';
  if (tag === 'a' && /(btn|button|cta)/.test(el.className)) return 'button';
  if (tag === 'a') return 'link';
  if (tag === 'section' || tag === 'header' || tag === 'footer' || tag === 'div') return 'container';
  return 'container';
}

function detectPreset(el: HTMLElement): string {
  const t = detectElementType(el);
  if (t === 'h1') return 'word-fade-blur';
  if (t === 'h2') return 'word-fade-up';
  if (t === 'h3') return 'fade-up';
  if (t === 'p')  return 'fade-up';
  if (t === 'img') return 'scale-in';
  if (t === 'button') return 'fade-up';
  return 'fade-up';
}

function tagDescriptor(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const cls = Array.from(el.classList).slice(0, 2).join('.');
  return cls ? `${tag}.${cls}` : tag;
}

function label(el: HTMLElement): string {
  const txt = (el.textContent || '').trim().slice(0, 40);
  return txt || tagDescriptor(el);
}

function makeDefaultRule(presetId: string): AnimationRule {
  return {
    enabled: true,
    preset: presetId,
    params: {},
    scrollTrigger: {},
  };
}

/**
 * Place the popover next to the pinned element. Tries: right of element,
 * then left, then below, falling back to viewport-anchored top-right.
 */
function popoverPosition(rect: DOMRect): React.CSSProperties {
  const W = 380, H = 460;
  const margin = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = rect.right + margin;
  let top  = rect.top;
  if (left + W > vw - margin) left = rect.left - W - margin;        // try left
  if (left < margin)          left = vw - W - margin;                // last resort: pin right
  if (top + H > vh - margin)  top  = Math.max(margin, vh - H - margin);
  if (top < margin)           top  = margin;
  return {
    position: 'fixed',
    top,
    left,
    width:  W,
    maxHeight: H,
  };
}
