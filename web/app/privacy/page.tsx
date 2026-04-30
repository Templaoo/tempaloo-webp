import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = {
    title: "Privacy Policy — Tempaloo",
    description: "How Tempaloo collects, uses and protects your data.",
};

export default function PrivacyPage() {
    return (
        <LegalPage title="Privacy Policy" effectiveDate="24 April 2026">
            <p>
                This Privacy Policy describes how <strong>Tempaloo SAS</strong> (&ldquo;Tempaloo&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, and protects personal data when you use the Tempaloo WebP plugin, the Tempaloo API, and the website at <code>tempaloo.com</code> (collectively, the &ldquo;Service&rdquo;).
            </p>
            <p>
                We take a deliberately minimalist approach to data: the Service is designed to process images, not to profile people. We collect only what we need to authenticate your licence, deliver the conversion, and bill your subscription.
            </p>

            <h2>1. Who we are</h2>
            <p>
                <strong>Data controller</strong>: Tempaloo SAS, 12 rue de la Paix, 75002 Paris, France. Registered under RCS Paris B 902 458 137, VAT FR12 902458137.
            </p>
            <p>
                For any privacy question, please reach us through our <Link href="/contact">contact form</Link> (pick the &ldquo;Other&rdquo; topic and mention &ldquo;privacy&rdquo; in your message). We aim to respond within 30 days as required by the GDPR.
            </p>

            <h2>2. What we collect</h2>

            <h3>2.1 Account and licence data</h3>
            <p>When you generate a licence or sign in:</p>
            <ul>
                <li><strong>Email address</strong>, collected either directly at activation or through Google OAuth.</li>
                <li><strong>Display name and profile picture URL</strong>, only if you choose to sign in with Google.</li>
                <li><strong>Licence key</strong> we issue, associated with your account.</li>
                <li><strong>Activated sites</strong>: the domain (e.g. <code>example.com</code>) of any WordPress install that uses your licence. You can deactivate a site at any time from your dashboard.</li>
            </ul>

            <h3>2.2 Technical data sent by the plugin</h3>
            <p>When the plugin runs on your WordPress site, it sends us:</p>
            <ul>
                <li><strong>The licence key</strong> (in the request header) to authenticate the call.</li>
                <li><strong>The site URL</strong> to bind activations to the licence.</li>
                <li><strong>Your WordPress and plugin version</strong> for diagnostics and compatibility statistics.</li>
                <li><strong>The image bytes you are converting</strong>, streamed to our API at the moment of the request. Images are held in memory only, converted, and streamed back. They are never written to disk on our servers and never shared.</li>
            </ul>

            <h3>2.3 Usage telemetry</h3>
            <ul>
                <li><strong>Per-conversion metadata</strong>: timestamp, input byte size, output byte size, conversion duration, format chosen (WebP or AVIF), and whether the call was <code>auto</code> (on upload) or <code>bulk</code>. We use this to enforce quotas, compute savings, and surface analytics in your dashboard.</li>
                <li><strong>Anonymous page analytics</strong> on <code>tempaloo.com</code> and its subdomains, collected by Vercel Analytics (no cookies, no cross-site tracking).</li>
            </ul>

            <h3>2.4 What we do NOT collect</h3>
            <ul>
                <li>We do not store or retain your images after conversion.</li>
                <li>We do not read, index, or analyse the content of your images.</li>
                <li>We do not set third-party advertising cookies.</li>
                <li>We do not sell, rent, or lend any personal data.</li>
            </ul>

            <h2>3. Why we process this data (legal basis)</h2>
            <p>Under Article 6 GDPR, we rely on:</p>
            <ul>
                <li><strong>Performance of a contract</strong> (Art. 6(1)(b)) — authenticating your licence, converting images you submit, enforcing your plan&rsquo;s quotas, billing paid plans. Without these, the Service cannot work.</li>
                <li><strong>Legitimate interest</strong> (Art. 6(1)(f)) — anonymous analytics to improve the product, protecting the Service against abuse, and compatibility diagnostics based on WordPress/plugin versions.</li>
                <li><strong>Consent</strong> (Art. 6(1)(a)) — only if we later introduce an explicit opt-in feature; at the moment we do not rely on consent for any processing.</li>
                <li><strong>Legal obligation</strong> (Art. 6(1)(c)) — retaining invoices as required by French/EU tax law.</li>
            </ul>

            <h2>4. How long we keep your data</h2>
            <table>
                <thead>
                    <tr><th>Data</th><th>Retention</th></tr>
                </thead>
                <tbody>
                    <tr><td>Account &amp; licence records</td><td>Until you delete your account. After deletion: 3 months in case you reopen, then full erasure.</td></tr>
                    <tr><td>Activated-sites list</td><td>Deleted immediately when you deactivate the site from your dashboard.</td></tr>
                    <tr><td>Per-conversion metadata (usage logs)</td><td>12 months rolling. Used for billing reconciliation and abuse analysis.</td></tr>
                    <tr><td>Image bytes</td><td>Never stored. Discarded at the end of the conversion request.</td></tr>
                    <tr><td>Invoices / tax records</td><td>10 years (French Code de commerce, art. L123-22).</td></tr>
                    <tr><td>Webhook and API logs</td><td>30 days for operational debugging.</td></tr>
                </tbody>
            </table>

            <h2>5. Who we share your data with</h2>
            <p>We share the minimum necessary with a short list of sub-processors, each contractually bound to process data only on our instructions and to GDPR standards:</p>
            <table>
                <thead>
                    <tr><th>Sub-processor</th><th>Purpose</th><th>Data hosted</th><th>Region</th></tr>
                </thead>
                <tbody>
                    <tr><td><a href="https://render.com">Render</a></td><td>API hosting</td><td>None stored — compute only</td><td>Frankfurt, EU</td></tr>
                    <tr><td><a href="https://neon.tech">Neon</a></td><td>Postgres database</td><td>Accounts, licences, usage metadata</td><td>Frankfurt, EU</td></tr>
                    <tr><td><a href="https://freemius.com">Freemius</a></td><td>Payment processing for paid plans</td><td>Payment details, billing address</td><td>US (SCCs)</td></tr>
                    <tr><td><a href="https://vercel.com">Vercel</a></td><td>Website hosting + analytics</td><td>Anonymous usage counters</td><td>EU edge</td></tr>
                    <tr><td><a href="https://console.cloud.google.com">Google LLC</a></td><td>OAuth sign-in only (if you choose to use it)</td><td>OAuth identifiers</td><td>US (SCCs)</td></tr>
                </tbody>
            </table>
            <p>
                Freemius acts as the <strong>merchant of record</strong> for all paid subscriptions. When you buy a paid plan, your payment is contractually between you and Freemius, and your billing details never touch our servers. Their full privacy policy is at <a href="https://freemius.com/privacy/">freemius.com/privacy</a>.
            </p>

            <h2>6. International data transfers</h2>
            <p>
                Your account and conversion data are stored in the European Union (Frankfurt region). Where a sub-processor is based outside the EU (Freemius, Google), we rely on the European Commission&rsquo;s <strong>Standard Contractual Clauses</strong> to safeguard the transfer, plus any additional measures documented in their data processing agreements.
            </p>

            <h2>7. Your rights under the GDPR</h2>
            <p>You can exercise the following rights at any time through our <Link href="/contact">contact form</Link>:</p>
            <ul>
                <li><strong>Access</strong> — receive a copy of the personal data we hold about you.</li>
                <li><strong>Rectification</strong> — ask us to correct data that is inaccurate.</li>
                <li><strong>Erasure</strong> — ask us to delete your account and associated data (subject to our legal retention duties for invoices).</li>
                <li><strong>Restriction</strong> — ask us to pause processing in certain cases.</li>
                <li><strong>Portability</strong> — receive your data in a structured, machine-readable format (JSON).</li>
                <li><strong>Objection</strong> — object to processing based on legitimate interest.</li>
                <li><strong>Withdraw consent</strong> — if any processing is ever based on consent, you can withdraw it at any time without affecting prior processing.</li>
                <li><strong>Lodge a complaint</strong> with your local data protection authority. In France, that is the <a href="https://www.cnil.fr/">CNIL</a>.</li>
            </ul>
            <p>We will respond within one month. For complex requests we may extend the response time by up to two more months, and will tell you if we do.</p>

            <h2>8. Cookies and similar technologies</h2>
            <p>
                Tempaloo does not use tracking cookies. We set exactly two technical cookies, both on <code>tempaloo.com</code>:
            </p>
            <ul>
                <li><strong>Session cookie</strong> (Better Auth) &mdash; maintains your login. Required for the dashboard to work. Deleted when you log out.</li>
                <li><strong>Theme preference</strong> (localStorage, not a cookie) &mdash; remembers your light/dark choice. Local to your browser, never sent to us.</li>
            </ul>
            <p>Analytics on the marketing pages are provided by <strong>Vercel Analytics</strong>, which is cookieless and does not cross-track users between sites.</p>

            <h2>9. Children</h2>
            <p>The Service is not directed at children under 16. We do not knowingly collect data from children. If you believe a minor has registered, send us a message via our <Link href="/contact">contact form</Link> and we will delete the account.</p>

            <h2>10. Security</h2>
            <p>We apply common-sense technical and organisational measures: TLS 1.2+ on every endpoint, HMAC-signed webhooks, hashed licence keys, key rotation on compromise, principle of least privilege for internal access, audit logs on all database changes. Despite these, no service can guarantee absolute security; in the event of a confirmed personal-data breach we will notify the CNIL within 72 hours as required by the GDPR and affected users without undue delay.</p>

            <h2>11. Changes to this policy</h2>
            <p>We will update this policy as the Service evolves. Material changes (new sub-processor, new category of data collected) will be announced by email to active account holders at least 30 days before taking effect. The current version and its effective date are always shown at the top of this page.</p>

            <h2>12. Contact</h2>
            <div className="lp-callout">
                <p>
                    <strong>Tempaloo — privacy</strong><br />
                    Use our <Link href="/contact">contact form</Link> for any privacy or data-protection request<br />
                    Tempaloo SAS, 12 rue de la Paix, 75002 Paris, France
                </p>
            </div>
        </LegalPage>
    );
}
