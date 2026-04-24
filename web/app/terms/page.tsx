import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = {
    title: "Terms of Service — Tempaloo",
    description: "The rules of using Tempaloo: plans, refunds, acceptable use, and liability.",
};

/*
 * ─────────────────────────────────────────────────────────────────────────
 *  Before going public with this document, fill the placeholders below:
 *
 *    1. `[Tempaloo SAS]` → your real registered legal entity name
 *    2. `[1 rue Exemple, 75001 Paris, France]` → your registered address
 *    3. `[RCS Paris XXX XXX XXX]` → business registry number
 *    4. `[FRXXXXXXXXX]` → VAT / intra-EU number (if any)
 *    5. `[France]` / `[Paris]` → if your jurisdiction is different
 *
 *  A licensed lawyer should review this document before publication —
 *  especially §12 (Limitation of liability) and §15 (Governing law),
 *  which vary significantly by jurisdiction.
 * ─────────────────────────────────────────────────────────────────────────
 */

export default function TermsPage() {
    return (
        <LegalPage title="Terms of Service" effectiveDate="24 April 2026">
            <p>
                These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the Tempaloo WebP plugin, the Tempaloo API, and the website at <code>tempaloo.com</code> (collectively, the &ldquo;Service&rdquo;), all provided by <strong>[Tempaloo SAS]</strong> (&ldquo;Tempaloo&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
            </p>
            <p>
                By activating the plugin, creating an account, or using the API, you agree to these Terms. If you don&rsquo;t agree, don&rsquo;t use the Service. That&rsquo;s the whole idea.
            </p>

            <h2>1. The Service in one paragraph</h2>
            <p>
                Tempaloo converts the images you upload to your WordPress site into modern formats (WebP, and AVIF on paid plans). You install our plugin, paste a licence key, and new uploads are converted automatically via our hosted API. Our key product promise is this: <strong>one WordPress upload equals one credit</strong>, no matter how many thumbnail sizes WordPress generates.
            </p>

            <h2>2. Your account and licence</h2>
            <ul>
                <li>You must be at least 16 years old and able to enter a contract in your jurisdiction.</li>
                <li>One account per person or legal entity. You keep your licence key confidential; you are responsible for activity performed under your key.</li>
                <li>You can close your account at any time from the dashboard or by emailing <a href="mailto:support@tempaloo.com">support@tempaloo.com</a>.</li>
            </ul>

            <h2>3. Plans, pricing and sites-per-licence</h2>
            <p>We offer the following plans, each with an included monthly image quota and a maximum number of activated sites:</p>
            <table>
                <thead>
                    <tr><th>Plan</th><th>Images / month</th><th>Sites</th><th>Price (monthly / annual)</th></tr>
                </thead>
                <tbody>
                    <tr><td>Free</td><td>250</td><td>1</td><td>Free, no card required</td></tr>
                    <tr><td>Starter</td><td>5,000</td><td>1</td><td>€5 / €48</td></tr>
                    <tr><td>Growth</td><td>25,000</td><td>5</td><td>€12 / €115</td></tr>
                    <tr><td>Business</td><td>150,000</td><td>Unlimited</td><td>€29 / €278</td></tr>
                    <tr><td>Unlimited</td><td>Fair use (see §5)</td><td>Unlimited</td><td>€59 / €566</td></tr>
                </tbody>
            </table>
            <p>
                Prices are in euros and exclude VAT where applicable. VAT is handled by Freemius at checkout. We may change prices for new subscriptions at any time; an existing subscription keeps its current price until the end of its billing period, and we will give you at least 30 days&rsquo; notice by email before any change applicable to renewals.
            </p>

            <h3>3.1 Credit mechanics</h3>
            <ul>
                <li>One image uploaded through WordPress consumes one credit, no matter how many thumbnail sizes WordPress generates.</li>
                <li>The monthly quota resets on the 1st of each month at 00:00 UTC.</li>
                <li>On paid plans, <strong>unused credits roll over for 30 days</strong>, capped at one full month&rsquo;s quota. Free-plan credits do not roll over.</li>
                <li>If you run out of credits, uploads continue but are served as originals until the next reset or until you upgrade. We never interrupt your site.</li>
            </ul>

            <h3>3.2 Free-plan daily limit</h3>
            <p>
                The Free plan includes up to <strong>50 bulk-convert operations per UTC day</strong> (automatic conversion on new uploads stays unlimited within the monthly 250-image quota). This is to prevent one-shot abuse of the Free plan by someone bulk-converting an entire library before cancelling; it is not meant to throttle legitimate Free users.
            </p>

            <h2>4. Trial and refunds</h2>
            <ul>
                <li><strong>7-day free trial</strong> on every paid plan. Your card is authorised but not charged during the trial. You can cancel from the dashboard any time before the trial ends and will not be billed.</li>
                <li><strong>30-day money-back guarantee</strong> on the first paid period of every plan. Write to <a href="mailto:support@tempaloo.com">support@tempaloo.com</a> within 30 days of the first charge to receive a full refund — no justification required.</li>
                <li>Beyond the first 30 days, subscriptions are non-refundable for the current period. Cancelling stops the next renewal; you keep access until the end of the paid period.</li>
            </ul>

            <h2>5. Fair use on the Unlimited plan</h2>
            <p>
                The Unlimited plan includes image conversions without a hard cap. A fair-use guideline of <strong>500,000 conversions per month per licence</strong> applies. Above this threshold, we may contact you to discuss traffic patterns and, where appropriate, propose a custom plan. No service is interrupted automatically.
            </p>
            <p>
                In the event of manifestly abusive use (e.g. mass scraping bots, white-label resale of the API, or use unrelated to a legitimate WordPress site), we reserve the right to apply rate limiting or suspend access, with at least 7 days&rsquo; prior written notice except in operational emergencies.
            </p>

            <h2>6. Billing through Freemius</h2>
            <p>
                Paid plans are sold and invoiced by our payment partner <strong>Freemius, Inc.</strong>, acting as the <strong>merchant of record</strong>. When you click &ldquo;Start trial&rdquo; or &ldquo;Upgrade&rdquo;, you enter a separate contractual relationship with Freemius for the payment and invoicing of your subscription. Freemius handles:
            </p>
            <ul>
                <li>Collecting and processing payments (credit card, debit card, or any other supported method).</li>
                <li>Calculating and collecting VAT or sales tax based on your location.</li>
                <li>Issuing invoices and receipts in your name.</li>
                <li>Managing refunds (at our direction in accordance with §4).</li>
            </ul>
            <p>
                Their terms and privacy policy apply to the payment portion of the relationship: <a href="https://freemius.com/terms/">freemius.com/terms</a> and <a href="https://freemius.com/privacy/">freemius.com/privacy</a>.
            </p>

            <h2>7. Acceptable use</h2>
            <p>You agree not to use the Service to:</p>
            <ul>
                <li>Convert images containing illegal content, including child sexual abuse material, non-consensual imagery, or material that infringes someone else&rsquo;s rights.</li>
                <li>Attempt to reverse-engineer, resell, or provide the API as a white-label service without a written agreement from us.</li>
                <li>Bypass quota enforcement, site-count limits, or licence activations through technical circumvention.</li>
                <li>Upload malicious files (polyglot images, embedded scripts) with intent to exploit downstream consumers of the converted files.</li>
                <li>Use a Free account to stitch together what should be a paid subscription (e.g. multiple Free accounts for one production site).</li>
            </ul>
            <p>
                We may suspend or terminate an account that breaches this section, with written notice where operationally possible.
            </p>

            <h2>8. Your content</h2>
            <p>
                You retain all intellectual-property rights to the images you upload. You grant us a narrow, non-exclusive, temporary licence to receive, convert and return them through our API — for as long as necessary to complete the conversion and no longer. We do not store your images after conversion, do not use them to train any model, and do not share them with anyone.
            </p>

            <h2>9. Our content</h2>
            <p>
                The Tempaloo plugin is licensed under <strong>GPL-2.0-or-later</strong>. The Tempaloo API, dashboard, website design, documentation and trademarks remain the property of [Tempaloo SAS]. You may use screenshots of the product to review or promote it under fair-use principles.
            </p>

            <h2>10. Availability and changes</h2>
            <ul>
                <li>We aim for 99.5% monthly uptime on the API but make no binding SLA commitment on the current plans. Incident status is visible at [status.tempaloo.com] (coming soon).</li>
                <li>Scheduled maintenance is announced at least 24 hours in advance on our status page and, for maintenance longer than 15 minutes, by email.</li>
                <li>We may add, change or remove features. Breaking changes to the plugin↔API contract are announced at least 30 days in advance and kept backward-compatible for at least one release cycle.</li>
            </ul>

            <h2>11. Suspension and termination</h2>
            <p>You can terminate at any time from your dashboard. We may terminate or suspend your account if you:</p>
            <ul>
                <li>Breach §7 (Acceptable use).</li>
                <li>Fail to pay a paid subscription after reminders (typically three attempts over 14 days).</li>
                <li>Use the Service in a way that endangers other customers or the platform.</li>
            </ul>
            <p>
                When a licence terminates, your activated sites stop receiving conversions for new uploads. Images already converted stay on your server and keep being served as WebP/AVIF by the plugin (it caches locally). The plugin can be fully uninstalled without breaking your site.
            </p>

            <h2>12. Warranties and limitation of liability</h2>
            <p>
                The Service is provided <strong>as is</strong>. We make no warranty that it will be uninterrupted, error-free, or fit for any particular purpose beyond the explicit description in these Terms.
            </p>
            <p>
                To the maximum extent permitted by law, Tempaloo&rsquo;s total aggregate liability arising out of or related to these Terms, whether in contract, tort or any other theory, shall not exceed the amount you paid to us in the twelve (12) months preceding the event giving rise to the claim. We are not liable for indirect, incidental, consequential, or punitive damages, including lost profits or loss of data, even if we were advised of the possibility of such damages.
            </p>
            <p>
                Nothing in these Terms limits liability that cannot be limited under French or EU consumer law (e.g. for fraud or gross negligence).
            </p>

            <h2>13. Indemnification</h2>
            <p>
                You agree to indemnify and hold harmless Tempaloo and its officers from any third-party claim arising out of your breach of §7 (Acceptable use) or §8 (Your content). We&rsquo;ll notify you promptly of any such claim and give you a reasonable opportunity to defend it at your expense.
            </p>

            <h2>14. Changes to these Terms</h2>
            <p>
                We may update these Terms as the Service evolves. Substantive changes (new restrictions, pricing mechanics, jurisdiction) are announced by email to active account holders at least 30 days in advance. Continued use of the Service after the effective date of an update means you accept the updated Terms. If you don&rsquo;t, you can close your account and request a prorated refund of the current period.
            </p>

            <h2>15. Governing law and jurisdiction</h2>
            <p>
                These Terms are governed by the laws of <strong>[France]</strong>, without regard to conflict-of-laws principles. Any dispute will be brought first through good-faith negotiation. If that fails, the courts of <strong>[Paris, France]</strong> have exclusive jurisdiction, except where mandatory consumer-protection law grants you the right to bring proceedings in the courts of your place of residence within the European Union.
            </p>

            <h2>16. Entire agreement and severability</h2>
            <p>
                These Terms, together with the <a href="/privacy">Privacy Policy</a> and any plan description referenced on <code>tempaloo.com</code>, constitute the entire agreement between you and us. If any clause is found unenforceable, the rest remains in effect. Our failure to enforce a provision is not a waiver of that provision.
            </p>

            <h2>17. Contact</h2>
            <div className="lp-callout">
                <p>
                    <strong>Tempaloo — legal</strong><br />
                    <a href="mailto:legal@tempaloo.com">legal@tempaloo.com</a><br />
                    [Tempaloo SAS], [1 rue Exemple, 75001 Paris, France]<br />
                    [RCS Paris XXX XXX XXX] · VAT [FRXXXXXXXXX]
                </p>
            </div>
        </LegalPage>
    );
}
