"use client";

import { useState, type FormEvent } from "react";

type Topic = "support" | "sales" | "partnership" | "press" | "other";

interface FormState {
    name: string;
    email: string;
    company: string;
    topic: Topic;
    siteUrl: string;
    message: string;
    consent: boolean;
    /** Honeypot — hidden from real users via CSS, populated by bots that
     *  blindly fill every field. Server rejects any submission where it's
     *  non-empty. Cheap, no captcha, no third-party. */
    website: string;
}

const INITIAL: FormState = {
    name: "",
    email: "",
    company: "",
    topic: "support",
    siteUrl: "",
    message: "",
    consent: false,
    website: "",
};

const TOPICS: { value: Topic; label: string; hint: string }[] = [
    { value: "support",     label: "Support",     hint: "Stuck on something — bug, error, weird behavior." },
    { value: "sales",       label: "Sales",       hint: "Pricing, billing, plan upgrades, custom needs." },
    { value: "partnership", label: "Partnership", hint: "Integration, reseller, agency programs." },
    { value: "press",       label: "Press",       hint: "Quotes, interviews, press kit, briefing requests." },
    { value: "other",       label: "Something else", hint: "" },
];

export function ContactForm() {
    const [form, setForm] = useState<FormState>(INITIAL);
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
    const [serverError, setServerError] = useState<string | null>(null);

    function update<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((f) => ({ ...f, [key]: value }));
        if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    }

    function validate(): boolean {
        const next: typeof errors = {};
        if (!form.name.trim()) next.name = "Tell us your name.";
        if (!form.email.trim()) next.email = "We need an email to reply.";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Looks malformed — double-check?";
        if (form.message.trim().length < 10) next.message = "A bit more detail helps us help you (10+ chars).";
        if (form.message.length > 5000) next.message = "Message is too long (max 5000 chars).";
        if (!form.consent) next.consent = "We need your consent before contacting you back.";
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (status === "submitting") return;
        setServerError(null);
        if (!validate()) return;

        setStatus("submitting");
        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setServerError(
                    (data && data.error) ||
                    (res.status === 429
                        ? "Too many submissions. Try again in a minute."
                        : "Something went wrong on our end.")
                );
                setStatus("error");
                return;
            }
            setStatus("success");
        } catch {
            setServerError("Network error. Check your connection and try again.");
            setStatus("error");
        }
    }

    if (status === "success") {
        return (
            <div className="cf-success">
                <style dangerouslySetInnerHTML={{ __html: css }} />
                <div className="cf-success-icon" aria-hidden>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13 L10 18 L20 6" />
                    </svg>
                </div>
                <h2 className="cf-success-h">Message received.</h2>
                <p className="cf-success-p">
                    We&apos;ll get back to you at <strong>{form.email}</strong> within 24
                    hours. A confirmation copy is also on its way to your inbox.
                </p>
                <button
                    type="button"
                    className="cf-btn-secondary"
                    onClick={() => { setForm(INITIAL); setStatus("idle"); setErrors({}); }}
                >
                    Send another message
                </button>
            </div>
        );
    }

    const selectedTopic = TOPICS.find((t) => t.value === form.topic);

    return (
        <form className="cf-form" onSubmit={onSubmit} noValidate>
            <style dangerouslySetInnerHTML={{ __html: css }} />

            <div className="cf-row cf-row-2">
                <Field label="Your name" id="cf-name" error={errors.name} required>
                    <input
                        id="cf-name"
                        type="text"
                        autoComplete="name"
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        maxLength={120}
                        placeholder="Jane Doe"
                        aria-invalid={!!errors.name}
                    />
                </Field>
                <Field label="Email" id="cf-email" error={errors.email} required>
                    <input
                        id="cf-email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        maxLength={200}
                        placeholder="jane@company.com"
                        aria-invalid={!!errors.email}
                    />
                </Field>
            </div>

            <div className="cf-row cf-row-2">
                <Field label="Company (optional)" id="cf-company">
                    <input
                        id="cf-company"
                        type="text"
                        autoComplete="organization"
                        value={form.company}
                        onChange={(e) => update("company", e.target.value)}
                        maxLength={120}
                        placeholder="Acme Inc."
                    />
                </Field>
                <Field label="WordPress site (optional)" id="cf-site" hint="If you have one — speeds up support.">
                    <input
                        id="cf-site"
                        type="url"
                        autoComplete="url"
                        inputMode="url"
                        value={form.siteUrl}
                        onChange={(e) => update("siteUrl", e.target.value)}
                        maxLength={200}
                        placeholder="https://example.com"
                    />
                </Field>
            </div>

            <Field label="What can we help with?" id="cf-topic">
                <div className="cf-topics" role="radiogroup" aria-label="Topic">
                    {TOPICS.map((t) => (
                        <label
                            key={t.value}
                            className={`cf-topic ${form.topic === t.value ? "is-active" : ""}`}
                        >
                            <input
                                type="radio"
                                name="topic"
                                value={t.value}
                                checked={form.topic === t.value}
                                onChange={() => update("topic", t.value)}
                            />
                            <span>{t.label}</span>
                        </label>
                    ))}
                </div>
                {selectedTopic?.hint && (
                    <p className="cf-topic-hint">{selectedTopic.hint}</p>
                )}
            </Field>

            <Field
                label="Message"
                id="cf-message"
                error={errors.message}
                required
                hint={`${form.message.length}/5000`}
            >
                <textarea
                    id="cf-message"
                    rows={6}
                    value={form.message}
                    onChange={(e) => update("message", e.target.value)}
                    maxLength={5000}
                    placeholder="Tell us what's going on. Include error messages, screenshots, or steps to reproduce if relevant."
                    aria-invalid={!!errors.message}
                />
            </Field>

            {/* Honeypot — invisible to users, irresistible to bots. */}
            <div className="cf-honeypot" aria-hidden>
                <label htmlFor="cf-website">Leave this field empty</label>
                <input
                    id="cf-website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(e) => update("website", e.target.value)}
                />
            </div>

            <Field error={errors.consent}>
                <label className="cf-consent">
                    <input
                        type="checkbox"
                        checked={form.consent}
                        onChange={(e) => update("consent", e.target.checked)}
                        aria-invalid={!!errors.consent}
                    />
                    <span>
                        I agree that Tempaloo can store my message and email so they can
                        reply. See our{" "}
                        <a href="/privacy" target="_blank" rel="noreferrer">privacy policy</a>{" "}
                        for details.
                    </span>
                </label>
            </Field>

            {serverError && (
                <div className="cf-error-banner" role="alert">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{serverError}</span>
                </div>
            )}

            <div className="cf-actions">
                <button type="submit" className="cf-btn-primary" disabled={status === "submitting"}>
                    {status === "submitting" ? "Sending…" : "Send message"}
                </button>
                <span className="cf-actions-fine">
                    We typically reply within 24 hours, business days.
                </span>
            </div>
        </form>
    );
}

/* ── Field primitive ────────────────────────────────────────── */
function Field({
    label,
    id,
    error,
    required,
    hint,
    children,
}: {
    label?: string;
    id?: string;
    error?: string;
    required?: boolean;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={`cf-field ${error ? "has-error" : ""}`}>
            {label && (
                <div className="cf-field-head">
                    <label htmlFor={id}>
                        {label}
                        {required && <span className="cf-required" aria-hidden> *</span>}
                    </label>
                    {hint && <span className="cf-field-hint">{hint}</span>}
                </div>
            )}
            {children}
            {error && <div className="cf-field-error">{error}</div>}
        </div>
    );
}

const css = `
.cf-form { display: flex; flex-direction: column; gap: 20px; }
.cf-row { display: flex; flex-direction: column; gap: 20px; }
.cf-row-2 { gap: 16px; }
@media (min-width: 640px) {
  .cf-row-2 { display: grid; grid-template-columns: 1fr 1fr; }
}

.cf-field { display: flex; flex-direction: column; gap: 6px; }
.cf-field-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.cf-field label { font-size: 13.5px; font-weight: 500; color: var(--ink); }
.cf-required { color: var(--brand, #2a57e6); }
.cf-field-hint { font-size: 11.5px; color: var(--ink-3); font-family: var(--font-geist-mono), monospace; }

.cf-field input[type="text"],
.cf-field input[type="email"],
.cf-field input[type="url"],
.cf-field textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line-2);
  background: var(--surface, var(--bg));
  color: var(--ink);
  border-radius: 8px;
  font-size: 14.5px;
  font-family: inherit;
  line-height: 1.5;
  transition: border-color .15s, box-shadow .15s, background .15s;
}
.cf-field input:hover,
.cf-field textarea:hover { border-color: var(--ink-3); }
.cf-field input:focus,
.cf-field textarea:focus {
  outline: none;
  border-color: var(--ink);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--ink) 10%, transparent);
}
.cf-field textarea { resize: vertical; min-height: 120px; }

.cf-field.has-error input,
.cf-field.has-error textarea {
  border-color: #dc2626;
}
.cf-field.has-error input:focus,
.cf-field.has-error textarea:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12);
}
.cf-field-error { font-size: 12px; color: #dc2626; padding: 0 2px; }

/* ── Topic radio group ──────────────────────────────────────── */
.cf-topics { display: flex; flex-wrap: wrap; gap: 6px; }
.cf-topic {
  display: inline-flex; align-items: center;
  padding: 7px 12px; border-radius: 999px;
  border: 1px solid var(--line-2);
  background: var(--surface, var(--bg));
  color: var(--ink-2);
  font-size: 13px; font-weight: 450;
  cursor: pointer;
  transition: border-color .15s, background .15s, color .15s;
}
.cf-topic:hover { border-color: var(--ink-3); color: var(--ink); }
.cf-topic.is-active {
  border-color: var(--ink);
  background: var(--ink);
  color: var(--bg);
  font-weight: 500;
}
.cf-topic input { position: absolute; left: -9999px; opacity: 0; pointer-events: none; }
.cf-topic-hint { margin: 8px 0 0; font-size: 12.5px; color: var(--ink-3); line-height: 1.45; }

/* ── Honeypot — visually hidden ─────────────────────────────── */
.cf-honeypot {
  position: absolute; left: -9999px; top: auto; width: 1px; height: 1px;
  overflow: hidden;
}

/* ── Consent ────────────────────────────────────────────────── */
.cf-consent {
  display: flex; gap: 10px; align-items: flex-start;
  font-size: 13px; line-height: 1.55; color: var(--ink-2);
  cursor: pointer; padding: 8px 0;
}
.cf-consent input { margin-top: 2px; flex-shrink: 0; cursor: pointer; }
.cf-consent a { color: var(--ink); border-bottom: 1px solid var(--line-2); padding-bottom: 1px; }
.cf-consent a:hover { border-bottom-color: var(--ink); }

/* ── Error banner ───────────────────────────────────────────── */
.cf-error-banner {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px;
  color: #991b1b; font-size: 13px;
}
[data-theme="dark"] .cf-error-banner {
  background: rgba(220, 38, 38, 0.1); border-color: rgba(220, 38, 38, 0.4); color: #fca5a5;
}

/* ── Actions ────────────────────────────────────────────────── */
.cf-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 4px; }
.cf-actions-fine { font-size: 12px; color: var(--ink-3); }

.cf-btn-primary, .cf-btn-secondary {
  display: inline-flex; align-items: center; justify-content: center;
  height: 40px; padding: 0 20px;
  border-radius: 8px;
  font-size: 14px; font-weight: 500; font-family: inherit;
  cursor: pointer;
  transition: transform .12s, background .15s, border-color .15s;
}
.cf-btn-primary {
  background: var(--ink); color: var(--bg);
  border: 1px solid var(--ink);
}
.cf-btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
.cf-btn-primary:active:not(:disabled) { transform: translateY(0); }
.cf-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.cf-btn-secondary {
  background: var(--surface, var(--bg)); color: var(--ink);
  border: 1px solid var(--line-2);
}
.cf-btn-secondary:hover { border-color: var(--ink); }

/* ── Success state ──────────────────────────────────────────── */
.cf-success { padding: 32px; text-align: center; border: 1px solid var(--line); border-radius: 12px; background: var(--surface, var(--bg)); }
.cf-success-icon { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%; background: #dcfce7; color: #15803d; margin-bottom: 18px; }
[data-theme="dark"] .cf-success-icon { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
.cf-success-h { font-size: 22px; font-weight: 600; color: var(--ink); letter-spacing: -0.025em; margin: 0 0 8px; }
.cf-success-p { font-size: 14.5px; line-height: 1.6; color: var(--ink-2); margin: 0 0 20px; max-width: 460px; margin-left: auto; margin-right: auto; }
.cf-success-p a, .cf-success-p strong { color: var(--ink); }
.cf-success-p a { border-bottom: 1px solid var(--line-2); padding-bottom: 1px; }
`;
