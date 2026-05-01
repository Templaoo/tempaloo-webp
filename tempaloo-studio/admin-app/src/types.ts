export interface BootData {
  rest:  { root: string; nonce: string };
  admin: { url: string };
  dev?:  boolean;
}

export interface TemplateSummary {
  slug:           string;
  name:           string;
  category:       string;
  version:        string;
  description:    string;
  thumbnail:      string;
  widgets_count:  number;
}

export interface TemplateFull extends TemplateSummary {
  fonts?:  { heading?: string; body?: string; google_fonts_url?: string };
  tokens?: {
    light?: Record<string, string>;
    dark?:  Record<string, string>;
    dark_selector?: string;
  };
  widgets?: string[];
  pages?:   Array<{ title: string; slug: string }>;
  dir_url?: string;
}

export type TokenOverrides = Record<string, { light?: Record<string, string>; dark?: Record<string, string> }>;

export interface AppState {
  active_slug: string | null;
  active:      TemplateFull | null;
  overrides:   TokenOverrides;
}

export type Theme = 'light' | 'dark';

export type Tab = 'overview' | 'templates' | 'settings' | 'components' | 'animation' | 'license';

declare global {
  interface Window {
    TempalooStudioBoot?: BootData;
  }
}
