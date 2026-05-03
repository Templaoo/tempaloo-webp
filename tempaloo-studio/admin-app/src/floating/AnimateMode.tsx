import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type AnimationLibrary, type AnimationRule } from '../api';
import { toast } from '../components/Toast';
import { RuleEditor } from '../pages/animation/RuleEditor';

/**
 * AnimateMode — click-driven element animator (step 2).
 *
 * UX flow:
 *   1. User clicks "Animate any element" → enters mode.
 *   2. Hovering any element draws a GREEN outline directly on it
 *      (inline style, never a separate div — no occlusion issues).
 *   3. Clicking the element pins it + opens a popover anchored to its
 *      bounding rect.
 *   4. Popover: detected element type · auto-generated CSS selector ·
 *      preset dropdown (filtered by element-type compatibility) ·
 *      params editor (auto-generated from the schema).
 *   5. Save → POST /animation/v2/selector-override and call
 *      ts.animations.applyRuleToElement(node, rule) for instant
 *      preview without page reload.
 *
 * Mirrors the existing InspectOverlay pattern (e.target + inline
 * outline) which is proven to work across the Avero / Elementor
 * markup. Color theme is GREEN to differentiate from Inspect's blue.
 */
export function AnimateMode({ active, onClose }: { active: boolean; onClose: () => void }) {
  const [pinned, setPinned] = useState<HTMLElement | null>(null);
  const [pinnedRect, setPinnedRect] = useState<DOMRect | null>(null);
  const [lib, setLib]   = useState<AnimationLibrary | null>(null);
  const [rule, setRule] = useState<AnimationRule>(() => makeDefaultRule('fade-up'));
  const [saving, setSaving] = useState(false);

  // Live preview support — apply the rule to the pinned element on
  // every change (debounced) so the user sees the animation BEFORE
  // saving. If they Cancel, we restore the original snapshot so the
  // page is left exactly as it was before opening the popover.
  const previewTimer  = useRef<number | null>(null);
  const savedRef      = useRef(false);                  // set true when user clicks Save (skip revert)
  const originalRule  = useRef<AnimationRule | null>(null); // pre-edit snapshot

  // Drag offset for the popover header (free-move).
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  // Load library once when mode activates.
  useEffect(() => {
    if (active && !lib) {
      api.getAnimationLibrary()
        .then(setLib)
        .catch((e) => toast.error(`Library load failed: ${(e as Error).message}`));
    }
  }, [active, lib]);

  // Hover + click capture — matches InspectOverlay's proven pattern.
  useEffect(() => {
    if (!active) return;

    let lastHover: HTMLElement | null  = null;
    let prevOutline    = '';
    let prevOutlineOff = '';

    // Tooltip showing the element descriptor near the cursor.
    const tip = document.createElement('div');
    tip.className = 'tsa-am-tip';
    tip.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;background:#0a0a0a;color:#10b981;font:600 11px/1.4 ui-monospace,SF Mono,Menlo,monospace;padding:6px 9px;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.4);transform:translate(-50%,calc(-100% - 12px));opacity:0;transition:opacity 120ms';
    document.body.appendChild(tip);

    const isPanel = (el: Element | null): boolean => {
      if (!el) return false;
      const e = el as HTMLElement;
      if (e.closest && e.closest('#tempaloo-studio-floating-root')) return true;
      if (e.closest && e.closest('#wpadminbar')) return true;
      if (e.closest && e.closest('.tsa-am-popover')) return true;
      if (e.closest && e.closest('.tsa-am-hint')) return true;
      return false;
    };

    const restoreLastOutline = () => {
      if (!lastHover) return;
      lastHover.style.outline       = prevOutline;
      lastHover.style.outlineOffset = prevOutlineOff;
      lastHover = null;
    };

    const onMouseMove = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el || isPanel(el)) {
        tip.style.opacity = '0';
        restoreLastOutline();
        return;
      }
      // Don't move the hover ring while a popover is open.
      if (lastHover !== el) {
        restoreLastOutline();
        prevOutline    = el.style.outline       || '';
        prevOutlineOff = el.style.outlineOffset || '';
        el.style.outline       = '2px solid #10b981';
        el.style.outlineOffset = '-2px';
        lastHover = el;
      }
      tip.innerHTML  = tagDescriptor(el);
      tip.style.left    = e.clientX + 'px';
      tip.style.top     = e.clientY + 'px';
      tip.style.opacity = '1';
    };

    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el || isPanel(el)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      restoreLastOutline();
      tip.style.opacity = '0';
      setPinned(el);
      setPinnedRect(el.getBoundingClientRect());
      // Apply a persistent green pinned outline so the user can see
      // which element the popover is editing.
      el.style.outline       = '2px solid #2563eb';
      el.style.outlineOffset = '-2px';
      // Try to read existing override for the generated selector.
      // Snapshot whatever rule is in force right now (existing override
      // or null = "no animation") so Cancel can revert cleanly.
      const sel = generateSelector(el);
      savedRef.current = false;
      setDragOffset({ x: 0, y: 0 });
      api.getAnimationV2().then((s) => {
        const existing = s.selectorOverrides?.[sel];
        if (existing && existing.rule) {
          originalRule.current = existing.rule;
          setRule(existing.rule);
        } else {
          originalRule.current = null;
          setRule(makeDefaultRule(detectPreset(el)));
        }
      }).catch(() => {
        originalRule.current = null;
        setRule(makeDefaultRule(detectPreset(el)));
      });
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        restoreLastOutline();
        onClose();
      }
    };

    document.body.style.cursor = 'crosshair';
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click',     onClick,     true);
    document.addEventListener('keydown',   onKey);

    return () => {
      document.body.style.cursor = '';
      restoreLastOutline();
      if (tip.parentNode) tip.parentNode.removeChild(tip);
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click',     onClick,     true);
      document.removeEventListener('keydown',   onKey);
    };
  }, [active, onClose]);

  // Update pinned rect on scroll/resize so the popover stays glued.
  useEffect(() => {
    if (!pinned) return;
    const update = () => setPinnedRect(pinned.getBoundingClientRect());
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [pinned]);

  // Live preview — re-apply the rule to the pinned element whenever
  // it changes. Debounced 200ms so dragging a slider doesn't replay
  // the animation on every input event.
  useEffect(() => {
    if (!pinned || !rule.preset) return;
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => {
      type Win = { tempaloo?: { studio?: { animations?: { applyRuleToElement?: (el: Element, r: AnimationRule) => void } } } };
      const fn = (window as unknown as Win).tempaloo?.studio?.animations?.applyRuleToElement;
      if (fn) fn(pinned, rule);
    }, 200);
    return () => {
      if (previewTimer.current) window.clearTimeout(previewTimer.current);
    };
  }, [pinned, rule]);

  // When the popover closes, clear the pinned outline.
  useEffect(() => {
    if (pinned) return;
    // No-op — the previous pinned element's outline was cleared by
    // closePopover() / save() / remove() through the explicit cleanup.
  }, [pinned]);

  function closePopover() {
    // If the user previewed but didn't save, revert to the original
    // state so the page stays exactly as it was before they opened
    // the popover. Either re-apply the previous saved override, or
    // clear the gsap.context() entirely.
    if (pinned && !savedRef.current) {
      type Win = { tempaloo?: { studio?: { animations?: { applyRuleToElement?: (el: Element, r: AnimationRule) => void } } } };
      const fn = (window as unknown as Win).tempaloo?.studio?.animations?.applyRuleToElement;
      if (originalRule.current && fn) {
        fn(pinned, originalRule.current);
      } else {
        const ctx = (pinned as unknown as { __tw_anim_ctx?: { revert: () => void } }).__tw_anim_ctx;
        if (ctx && typeof ctx.revert === 'function') ctx.revert();
      }
    }
    if (pinned) {
      pinned.style.outline       = '';
      pinned.style.outlineOffset = '';
    }
    setPinned(null);
    setPinnedRect(null);
    originalRule.current = null;
    savedRef.current     = false;
    setDragOffset({ x: 0, y: 0 });
  }

  const pinnedSelector = useMemo(() => (pinned ? generateSelector(pinned) : ''), [pinned]);
  const pinnedTypeId   = useMemo(() => (pinned ? detectElementType(pinned) : ''), [pinned]);

  if (!active) return null;

  async function save() {
    if (!pinned || !pinnedSelector || !rule.preset) return;
    setSaving(true);
    try {
      await api.setSelectorOverride(pinnedSelector, rule, label(pinned));

      // Apply live without reload.
      type Win = { tempaloo?: { studio?: {
        animations?: { applyRuleToElement?: (el: Element, r: AnimationRule) => void };
        animV2?: { selectorOverrides?: Record<string, unknown> };
      } } };
      const w = window as unknown as Win;
      const fn = w.tempaloo?.studio?.animations?.applyRuleToElement;
      if (fn && pinned) fn(pinned, rule);
      const animV2 = w.tempaloo?.studio?.animV2;
      if (animV2) {
        animV2.selectorOverrides = animV2.selectorOverrides || {};
        animV2.selectorOverrides[pinnedSelector] = { rule, label: label(pinned), savedAt: Date.now() };
      }
      savedRef.current = true; // skip revert in closePopover
      toast.info(`Saved animation for ${pinnedSelector}`);
      closePopover();
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
      type Win = { tempaloo?: { studio?: { animV2?: { selectorOverrides?: Record<string, unknown> } } } };
      const animV2 = (window as unknown as Win).tempaloo?.studio?.animV2;
      if (animV2 && animV2.selectorOverrides) delete animV2.selectorOverrides[pinnedSelector];
      const ctx = (pinned as unknown as { __tw_anim_ctx?: { revert: () => void } } | null)?.__tw_anim_ctx;
      if (ctx && typeof ctx.revert === 'function') ctx.revert();
      savedRef.current = true; // intentional removal — don't revert
      toast.info(`Removed override for ${pinnedSelector}`);
      closePopover();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  // ── Drag handlers (popover header is grabbable) ────────
  function startDrag(e: React.PointerEvent) {
    dragStart.current = {
      mx: e.clientX, my: e.clientY,
      ox: dragOffset.x, oy: dragOffset.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function moveDrag(e: React.PointerEvent) {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    setDragOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
  }
  function endDrag(e: React.PointerEvent) {
    dragStart.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  }

  return (
    <>
      {pinned && pinnedRect && lib && (
        <div
          className="tsa-am-popover"
          style={popoverPosition(pinnedRect, dragOffset)}
          role="dialog"
          aria-label="Animate element"
        >
          <header
            className="tsa-am-popover__head"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{ cursor: dragStart.current ? 'grabbing' : 'grab' }}
          >
            <span className="tsa-am-popover__grip" aria-hidden="true">⋮⋮</span>
            <strong className="tsa-am-popover__title">{tagDescriptor(pinned)}</strong>
            <button
              type="button"
              className="tsa-am-popover__icon"
              onClick={(e) => {
                e.stopPropagation();
                type Win = { tempaloo?: { studio?: { animations?: { applyRuleToElement?: (el: Element, r: AnimationRule) => void } } } };
                const fn = (window as unknown as Win).tempaloo?.studio?.animations?.applyRuleToElement;
                if (fn && pinned) fn(pinned, rule);
              }}
              title="Replay preview"
              aria-label="Replay preview"
            >↻</button>
            <button
              type="button"
              className="tsa-am-popover__icon tsa-am-popover__icon--close"
              onClick={(e) => { e.stopPropagation(); closePopover(); }}
              aria-label="Close"
              title="Cancel — revert preview"
            >×</button>
          </header>
          <div className="tsa-am-popover__sel" title={pinnedSelector}>
            <span className="tsa-am-popover__selpill">SELECTOR</span>
            <code>{pinnedSelector}</code>
          </div>
          <div className="tsa-am-popover__livehint">
            <span className="tsa-am-popover__livedot" /> Live preview — changes apply immediately
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
            <button type="button" className="tsa-btn-ghost tsa-am-popover__cancel" onClick={closePopover}>Cancel</button>
            <button type="button" className="tsa-btn-ghost" onClick={remove} disabled={saving} title="Delete this selector override">Remove</button>
            <button type="button" className="tsa-btn-primary" onClick={save} disabled={saving || !rule.preset}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </footer>
        </div>
      )}

      <div className="tsa-am-hint">
        <span><span className="tsa-am-hint__dot" /> Animate Mode — hover any element, click to animate. <kbd>Esc</kbd> to exit.</span>
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
 * Same priority order as InspectOverlay (FloatingPanel.tsx) so the
 * two pickers produce consistent selectors:
 *   1. Tempaloo BEM    (tw-…__elem)
 *   2. Tempaloo root   (tw-…)
 *   3. Elementor unique class on element OR closest ancestor
 *   4. data-tw-anim-scope ancestor + tag
 *   5. tag.class.class fallback
 *   6. plain tag
 * Skips elementor-element-* random hashes (per-page volatile).
 */
function generateSelector(el: HTMLElement): string {
  const cls = (el.className && typeof el.className === 'string') ? el.className : '';
  const classes = cls.split(/\s+/).filter(Boolean);

  const bem = classes.filter((c) => /^tw-/.test(c) && c.includes('__'));
  if (bem.length) return '.' + bem[0];

  const tw = classes.filter((c) => /^tw-/.test(c));
  if (tw.length) return '.' + tw[0];

  const elementorOnEl = classes.filter((c) => /^elementor-element-[a-z0-9]{6,}$/.test(c));
  if (elementorOnEl.length) return '.' + elementorOnEl[0];
  const elementorAncestor = el.closest('.elementor-element[class*="elementor-element-"]') as HTMLElement | null;
  if (elementorAncestor && elementorAncestor !== el) {
    const aClasses = (elementorAncestor.className || '').split(/\s+/);
    const aHit     = aClasses.find((c) => /^elementor-element-[a-z0-9]{6,}$/.test(c));
    if (aHit) return '.' + aHit + ' ' + el.tagName.toLowerCase();
  }

  const scopeEl = el.closest('[data-tw-anim-scope]') as HTMLElement | null;
  if (scopeEl) {
    const scope = scopeEl.getAttribute('data-tw-anim-scope');
    return `[data-tw-anim-scope="${scope}"] ${el.tagName.toLowerCase()}`;
  }

  const cleanCls = classes.filter((c) => /^[a-zA-Z_][\w-]*$/.test(c) && !/^elementor-element-/.test(c)).slice(0, 2);
  if (cleanCls.length) return el.tagName.toLowerCase() + '.' + cleanCls.join('.');

  return el.tagName.toLowerCase();
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
  const cls = Array.from(el.classList)
    .filter((c) => /^[a-zA-Z_][\w-]*$/.test(c) && !/^elementor-element-/.test(c))
    .slice(0, 2)
    .join('.');
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
 * then left, then fallback to viewport corner. Adds the user's drag
 * offset so the popover follows wherever they last moved it.
 */
function popoverPosition(rect: DOMRect, offset: { x: number; y: number }): React.CSSProperties {
  const W  = 340;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const H  = Math.min(540, vh - 48);
  const margin = 12;
  let left = rect.right + margin;
  let top  = rect.top;
  if (left + W > vw - margin) left = rect.left - W - margin;
  if (left < margin)          left = vw - W - margin;
  if (top + H > vh - margin)  top  = Math.max(margin, vh - H - margin);
  if (top < margin)           top  = margin;
  return {
    position: 'fixed',
    top:    top  + offset.y,
    left:   left + offset.x,
    width:  W,
    maxHeight: H,
  };
}
