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
  setAnimation: (payload: {
    intensity?:     string;
    direction?:     string;
    template_slug?: string;
    presets?:       Record<string, AnimationPreset>;
  }) =>
    call<AnimationState>('/animation', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ── v2 endpoints (Plan A typed schema) ─────────────────
  getAnimationLibrary: () => call<AnimationLibrary>('/animation/library'),
  getAnimationV2:      () => call<AnimationStateV2>('/animation/v2'),
  setGlobals: (payload: { intensity?: string; direction?: string; reduceMotion?: string }) =>
    call<AnimationStateV2>('/animation/v2/globals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  setElementRule: (type_id: string, rule: AnimationRule) =>
    call<AnimationStateV2>('/animation/v2/element-rule', {
      method: 'POST',
      body: JSON.stringify({ type_id, rule }),
    }),
  resetElementRule: (type_id: string) =>
    call<AnimationStateV2>('/animation/v2/element-rule/reset', {
      method: 'POST',
      body: JSON.stringify({ type_id }),
    }),
  setWidgetOverride: (template_slug: string, widget: string, rule: AnimationRule) =>
    call<AnimationStateV2>('/animation/v2/widget-override', {
      method: 'POST',
      body: JSON.stringify({ template_slug, widget, rule }),
    }),
};

/* ── v2 schema types (Plan A) ────────────────────────────── */

export type ParamSpec =
  | { type: 'number'; value: number; min?: number; max?: number; step?: number; unit?: string; label?: string; tip?: string; locked?: boolean }
  | { type: 'enum';   value: string; enum: string;  label?: string; tip?: string; locked?: boolean }
  | { type: 'boolean'; value: boolean; label?: string; tip?: string; locked?: boolean }
  | { type: 'string'; value: string;  label?: string; tip?: string; locked?: boolean };

export interface PresetSchema {
  id:           string;
  label:        string;
  category:     'element' | 'text';
  description:  string;
  requires:     string[];
  splits?:      'words' | 'chars' | 'lines' | 'auto';
  scrubOnly?:   boolean;
  params:       Record<string, ParamSpec>;
  scrollTrigger?: Record<string, ParamSpec> | null;
  preview?:     string;
}

export interface ElementType {
  id:                string;
  label:             string;
  icon?:             string;
  selectors:         string[];
  recommendedPreset: string;
}

export interface BehaviorSchema {
  id:           string;
  label:        string;
  description:  string;
  requires?:    string[];
  params?:      Record<string, ParamSpec>;
}

export interface AnimationLibrary {
  version:      string;
  enums:        Record<string, Array<{ id: string; label: string }>>;
  elementTypes: ElementType[];
  presets:      PresetSchema[];
  behaviors:    BehaviorSchema[];
}

export interface AnimationRule {
  enabled?:      boolean;
  preset:        string;
  params:        Record<string, number | string | boolean>;
  scrollTrigger: Record<string, number | string | boolean>;
  direction?:    string;
}

export interface AnimationStateV2 {
  version:         string;
  globals: {
    intensity:    string;
    direction:    string;
    reduceMotion: string;
  };
  elementRules:    Record<string, AnimationRule>;
  widgetOverrides: Record<string, AnimationRule>;
  templateSlug:    string;
  widgets:         string[];
  allowed: {
    intensity:    string[];
    direction:    string[];
    reduceMotion: string[];
    elementTypes: string[];
    presets:      string[];
  };
}

export interface AnimationPreset {
  entrance?:  string;
  stagger?:   number;
  duration?:  number;
  trigger?:   string;
  direction?: string; // 'once' | 'replay' | 'bidirectional' | 'scrub'
}

export interface AnimationState {
  intensity:           string;
  direction:           string;
  allowed:             string[];
  directions_allowed:  string[];
  presets_allowed:     string[];
  presets_grouped:     { element: string[]; text: string[] };
  template_slug:       string;
  widgets:             string[];
  presets:             Record<string, AnimationPreset>;
}

export interface ImportedPage {
  id:       number;
  action:   'created' | 'replaced' | 'skipped';
  edit_url: string;
  view_url: string;
}
