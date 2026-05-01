import type { AppState, BootData, TemplateFull, TemplateSummary } from './types';

const NS = 'tempaloo-studio/v1';

function boot(): BootData {
  if (!window.TempalooStudioBoot) {
    throw new Error('TempalooStudioBoot is missing — admin must run inside the WP page or with the dev stub.');
  }
  return window.TempalooStudioBoot;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const b = boot();
  const url = `${b.rest.root.replace(/\/$/, '')}/${NS}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce':   b.rest.nonce,
      ...(init?.headers ?? {}),
    },
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as T;
}

export const api = {
  listTemplates: () => call<{ templates: TemplateSummary[] }>('/templates'),
  getTemplate:   (slug: string) => call<TemplateFull>(`/template/${slug}`),
  state:         () => call<AppState>('/state'),
  activate:      (slug: string) => call<AppState>('/activate', { method: 'POST', body: JSON.stringify({ slug }) }),
  deactivate:    () => call<AppState>('/deactivate', { method: 'POST' }),
  saveTokens:    (slug: string, mode: 'light' | 'dark', vars: Record<string, string>) =>
    call<AppState>('/tokens/override', {
      method: 'POST',
      body: JSON.stringify({ slug, mode, vars }),
    }),
  importPages:   (slug: string, replace = false) =>
    call<{ pages: Record<string, ImportedPage> }>('/import-pages', {
      method: 'POST',
      body: JSON.stringify({ slug, replace }),
    }),
  getAnimation: () => call<AnimationState>('/animation'),
  setAnimation: (payload: { intensity?: string; template_slug?: string; presets?: Record<string, AnimationPreset> }) =>
    call<AnimationState>('/animation', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export interface AnimationPreset {
  entrance?: string;
  stagger?:  number;
  duration?: number;
  trigger?:  string;
}

export interface AnimationState {
  intensity:       string;
  allowed:         string[];
  presets_allowed: string[];
  presets_grouped: { element: string[]; text: string[] };
  template_slug:   string;
  widgets:         string[];
  presets:         Record<string, AnimationPreset>;
}

export interface ImportedPage {
  id:       number;
  action:   'created' | 'replaced' | 'skipped';
  edit_url: string;
  view_url: string;
}
