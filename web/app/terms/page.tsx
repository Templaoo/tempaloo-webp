import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = {
    title: "Terms of Service — Tempaloo",
    description: "The rules of using Tempaloo: plans, refunds, acceptable use, and liability.",
};

export default function TermsPage() {
    return (
        <LegalPage title="Terms of Service" effectiveDate="24 April 2026">
            <p>
                These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the Tempaloo WebP plugin, the Tempaloo API, and the website at <code>tempaloo.com</code> (collectively, the &ldquo;Service&rdquo;), all provided by <strong>Tempaloo</strong> (&ldquo;Tempaloo&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
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
                <li>You can close your account at any time from the dashboard or through our <Link href="/contact">contact form</Link>.</li>
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

            <h2>4. Trial, refunds, and abuse safeguards</h2>

            <h3>4.1 Free trial</h3>
            <ul>
                <li><strong>7-day free trial</strong> on every paid plan. Your card is authorised but not charged during the trial period.</li>
                <li>Cancellation is one-click from the dashboard. If you cancel before the end of the trial, no charge is made.</li>
                <li>Trial usage is capped at <strong>500 conversions</strong> regardless of plan. This protects against trial-abuse patterns (sign up, bulk-convert, cancel) that materially harm us. Once the cap is reached, conversions pause until the trial converts to a paid period or a fresh paid plan is purchased — your converted images stay on disk untouched.</li>
                <li>You may use the trial <strong>once per natural person, household, payment method, or WordPress site</strong>. Repeat trials taken out under different email addresses, license keys, or sites are subject to §4.5 (Abuse).</li>
            </ul>

            <h3>4.2 Express consent &amp; waiver of EU withdrawal right</h3>
            <p>
                You expressly consent to immediate performance of the Service from the moment of activation. In accordance with article L.221-28 of the French Consumer Code (and Article 16(m) of EU Directive 2011/83/EU), <strong>once the Service has been fully delivered with your express consent, your right of withdrawal lapses</strong>. The 30-day satisfaction policy in §4.3 below is an additional commercial gesture from us — not a statutory right — and is subject to the conditions set out in §4.4.
            </p>

            <h3>4.3 30-day satisfaction guarantee</h3>
            <ul>
                <li><strong>30-day money-back window</strong> on the <em>first</em> paid period of <em>each licence</em>, applicable to the very first paid charge of a given Tempaloo account. Subsequent paid periods (renewals, upgrades) are not eligible.</li>
                <li>Refund requests must be sent in writing through our <Link href="/contact">contact form</Link> (pick the &ldquo;Sales&rdquo; topic) within 30 calendar days of the first paid charge.</li>
                <li>Approved refunds are processed within 14 working days through the original payment method, via Freemius.</li>
            </ul>

            <h3>4.4 Refund eligibility — usage caps</h3>
            <p>
                The 30-day satisfaction guarantee is intended for customers who tried the paid plan in good faith and concluded it was not the right fit. To prevent the documented abuse pattern of &ldquo;subscribe → bulk-convert → request refund → keep the converted assets&rdquo;, refund eligibility is conditional on:
            </p>
            <ul>
                <li><strong>Conversion usage at the time of request</strong> must not exceed:
                    <ul style={{ marginTop: 6 }}>
                        <li><strong>20%</strong> of the paid plan&rsquo;s monthly quota for plans up to 25,000 images / month;</li>
                        <li><strong>10%</strong> of the paid plan&rsquo;s monthly quota for plans above 25,000 images / month;</li>
                        <li>For the Unlimited plan: <strong>5,000 conversions</strong> in absolute terms.</li>
                    </ul>
                </li>
                <li><strong>Conversions consumed beyond these caps are not refundable</strong>: once an image has been converted via our infrastructure, the value has been delivered. We may, at our discretion, propose a partial refund equal to the unused portion of the period instead.</li>
                <li>A customer is entitled to <strong>one refund per Tempaloo account, per natural person, per household</strong>. Subsequent purchases — including under different email addresses or sites — are non-refundable except where statutory consumer law overrides this clause.</li>
                <li>Where the converted images are still present on the customer&rsquo;s WordPress site at the time of the refund request, we may, as a condition of the refund, require deletion of the <code>.webp</code> / <code>.avif</code> sibling files generated through our Service.</li>
            </ul>

            <h3>4.5 Abuse, chargebacks &amp; right to refuse</h3>
            <ul>
                <li>We reserve the right to refuse a refund where, at our reasonable judgement, the request fits an abuse pattern, including but not limited to: bulk consumption immediately followed by a refund request; refund requests on multiple linked accounts; refund requests after a chargeback or dispute on a sibling account; refund requests where the customer continues using the converted assets in production after the refund.</li>
                <li>If you initiate a credit-card chargeback or payment dispute <strong>after</strong> a refund has been issued, or in lieu of contacting support first, you owe Tempaloo the refunded amount plus any chargeback fees levied by Freemius or the issuing bank. We reserve the right to recover these amounts through any legal means available, including small-claims procedures in the courts of Paris (§13).</li>
                <li>Accounts found to abuse the trial, refund, or quota policies may be terminated under §11, with all generated <code>.webp</code> / <code>.avif</code> assets considered void of further support. Cumulative bad-faith activity across linked accounts may be reported to fraud-prevention networks used by our payment partners.</li>
            </ul>

            <h3>4.6 Beyond the first 30 days</h3>
            <p>
                Once the 30-day satisfaction window has elapsed, paid periods are non-refundable. Cancellation stops the next renewal — your account remains active until the end of the period you have already paid for, then automatically downgrades to Free (or the lowest plan you previously subscribed to). Mid-cycle downgrades from a higher plan to a lower paid plan do not generate a pro-rata refund of the price difference.
            </p>

            <p style={{ fontSize: "13px", color: "var(--ink-3)", fontStyle: "italic", marginTop: "20px" }}>
                Plain-English summary, in case the legal language is heavy: try us for 7 days free (cap 500 conversions), or pay and use up to 20% of your monthly quota; if it&rsquo;s not for you, email us within 30 days and we refund. After that, you keep what you paid for until the period ends, no surprises. We will turn down refund requests that look like fraud — using the API in volume and then asking for the money back is not what the policy is for.
            </p>

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
                The Tempaloo plugin is licensed under <strong>GPL-2.0-or-later</strong>. The Tempaloo API, dashboard, website design, documentation and trademarks remain the property of Tempaloo. You may use screenshots of the product to review or promote it under fair-use principles.
            </p>

            <h2>10. Availability and changes</h2>
            <ul>
                <li>We aim for 99.5% monthly uptime on the API but make no binding SLA commitment on the current plans. Major incidents are surfaced through our <Link href="/contact">contact page</Link> and changelog.</li>
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
                These Terms are governed by the laws of <strong>France</strong>, without regard to conflict-of-laws principles. Any dispute will be brought first through good-faith negotiation. If that fails, the courts of <strong>Paris, France</strong> have exclusive jurisdiction, except where mandatory consumer-protection law grants you the right to bring proceedings in the courts of your place of residence within the European Union.
            </p>

            <h2>16. Entire agreement and severability</h2>
            <p>
                These Terms, together with the <a href="/privacy">Privacy Policy</a> and any plan description referenced on <code>tempaloo.com</code>, constitute the entire agreement between you and us. If any clause is found unenforceable, the rest remains in effect. Our failure to enforce a provision is not a waiver of that provision.
            </p>

            <h2>17. Contact</h2>
            <div className="lp-callout">
                <p>
                    <strong>Tempaloo — legal</strong><br />
                    Use our <Link href="/contact">contact form</Link> for any legal or commercial query<br />
                    Tempaloo, 12 rue de la Paix, 75002 Paris, France<br />
                    
                </p>
            </div>
        </LegalPage>
    );
}
