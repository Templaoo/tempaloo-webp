/**
 * Curated font presets for the Tempaloo Studio admin.
 *
 * Picked from Google Fonts. The `value` is the CSS font-family string
 * that lands in the token; the `url` is the Google Fonts stylesheet
 * URL we lazily inject into the admin head so the preview renders in
 * the actual face the user picks.
 *
 * "system" entries don't load any external CSS — they hand off to OS
 * fonts only.
 */
export interface FontPreset {
  value: string;             // CSS font-family value
  label: string;             // human label
  type:  'sans' | 'serif' | 'display' | 'mono' | 'system';
  url?:  string;             // Google Fonts stylesheet URL
}

export const FONT_PRESETS: FontPreset[] = [
  // System / fallback
  { value: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif', label: 'System (default)', type: 'system' },

  // Sans-serif
  { value: "'Inter', sans-serif",      label: 'Inter',          type: 'sans',    url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
  { value: "'Manrope', sans-serif",    label: 'Manrope',        type: 'sans',    url: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap' },
  { value: "'Geist', sans-serif",      label: 'Geist',          type: 'sans',    url: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap' },
  { value: "'DM Sans', sans-serif",    label: 'DM Sans',        type: 'sans',    url: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap' },
  { value: "'Plus Jakarta Sans', sans-serif", label: 'Plus Jakarta Sans', type: 'sans', url: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap' },
  { value: "'Outfit', sans-serif",     label: 'Outfit',         type: 'sans',    url: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap' },
  { value: "'Space Grotesk', sans-serif", label: 'Space Grotesk', type: 'sans',  url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap' },

  // Serif
  { value: "'Hedvig Letters Serif', serif", label: 'Hedvig Letters Serif', type: 'serif', url: 'https://fonts.googleapis.com/css2?family=Hedvig+Letters+Serif:opsz,wght@12..24,400..600&display=swap' },
  { value: "'Instrument Serif', serif", label: 'Instrument Serif', type: 'serif', url: 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap' },
  { value: "'Playfair Display', serif", label: 'Playfair Display', type: 'serif', url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap' },
  { value: "'Cormorant Garamond', serif", label: 'Cormorant Garamond', type: 'serif', url: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap' },
  { value: "'Fraunces', serif",        label: 'Fraunces',       type: 'serif',   url: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&display=swap' },
  { value: "'EB Garamond', serif",     label: 'EB Garamond',    type: 'serif',   url: 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..700;1,400..700&display=swap' },

  // Display
  { value: "'Bricolage Grotesque', sans-serif", label: 'Bricolage Grotesque', type: 'display', url: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..700&display=swap' },
  { value: "'Caprasimo', display",     label: 'Caprasimo',      type: 'display', url: 'https://fonts.googleapis.com/css2?family=Caprasimo&display=swap' },
  { value: "'Unbounded', sans-serif",  label: 'Unbounded',      type: 'display', url: 'https://fonts.googleapis.com/css2?family=Unbounded:wght@400;500;600;700&display=swap' },

  // Mono
  { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono', type: 'mono', url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap' },
  { value: "'IBM Plex Mono', monospace",  label: 'IBM Plex Mono',  type: 'mono', url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap' },
];

const loadedUrls = new Set<string>();

/**
 * Inject a Google Fonts stylesheet into <head> exactly once. Idempotent
 * across re-renders. Returns immediately if the URL is missing or
 * already loaded.
 */
export function ensureFontLoaded(url?: string) {
  if (!url || loadedUrls.has(url)) return;
  loadedUrls.add(url);
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

/** Find the preset whose value matches the given CSS string. */
export function findPreset(value: string): FontPreset | undefined {
  if (!value) return undefined;
  return FONT_PRESETS.find((p) => p.value === value);
}
