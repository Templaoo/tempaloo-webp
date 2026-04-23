import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchLicensesByEmail } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";
import { LicenseCard } from "@/components/dashboard/LicenseCard";
import { StatsRow } from "@/components/dashboard/StatsRow";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Dashboard — Tempaloo WebP",
};

async function resolveUserEmail(searchEmail: string | undefined): Promise<{ email: string; name?: string; authed: boolean } | null> {
    // Preferred: real session via Neon Auth (Better Auth).
    const user = await getCurrentUser();
    if (user?.email) {
        return { email: user.email, name: user.name, authed: true };
    }
    // Dev fallback: ?email=... query param (explicit, never silent).
    if (searchEmail && /.+@.+\..+/.test(searchEmail)) {
        return { email: searchEmail, authed: false };
    }
    return null;
}

export default async function DashboardPage({ searchParams }: { searchParams: { email?: string; signup?: string } }) {
    const user = await resolveUserEmail(searchParams.email);

    if (!user) {
        // Not signed in and no email hint — push to activation.
        redirect("/webp/activate?redirect=dashboard");
    }

    let licenses = await fetchLicensesByEmail(user.email).catch(() => []);

    // Just signed in via Google with no existing license — auto-provision a Free one.
    if (user.authed && licenses.length === 0 && searchParams.signup) {
        const apiBase = process.env.TEMPALOO_API_BASE ?? "http://localhost:3000/v1";
        try {
            await fetch(`${apiBase}/license/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: user.email, site_url: "https://pending.tempaloo.local" }),
            });
            licenses = await fetchLicensesByEmail(user.email).catch(() => []);
        } catch {
            // fall through — empty state will prompt manual action
        }
    }

    return (
        <main className="mx-auto max-w-6xl px-6 py-10 md:py-14 space-y-10">
            <TopBar email={user.email} name={user.name} authed={user.authed} />

            {/* Hello banner */}
            <section className="rise">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
                    Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}.
                </h1>
                <p className="mt-2 text-white/60">Overview of your licenses, sites, and usage.</p>
            </section>

            <section className="rise rise-delay-1">
                <StatsRow licenses={licenses} />
            </section>

            {/* Main */}
            <section className="grid lg:grid-cols-3 gap-6 rise rise-delay-2">
                <div className="lg:col-span-2 space-y-4">
                    {licenses.length === 0 ? (
                        <EmptyState email={user.email} />
                    ) : (
                        licenses.map((l) => <LicenseCard key={l.id} license={l} />)
                    )}
                </div>

                <aside className="space-y-4">
                    <UpgradeCard hasPaid={licenses.some((l) => l.plan.code !== "free")} />
                    <BillingCard />
                    <SupportCard />
                </aside>
            </section>

            <footer className="text-center text-xs text-white/40 pt-10">
                © {new Date().getFullYear()} Tempaloo.
            </footer>
        </main>
    );
}

function TopBar({ email, name, authed }: { email: string; name?: string; authed: boolean }) {
    const initial = (name ?? email).trim()[0]?.toUpperCase() ?? "?";
    return (
        <header className="flex items-center justify-between">
            <Link href="/webp" className="flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                    T
                </span>
                <span className="text-sm font-semibold text-white/90">Tempaloo</span>
            </Link>
            <div className="flex items-center gap-3">
                {!authed && (
                    <span className="hidden sm:inline-flex items-center gap-2 rounded-full bg-amber-500/15 text-amber-200 px-3 py-1 text-[11px] font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                        Preview — sign in with Neon Auth to enable real sessions
                    </span>
                )}
                <div className="flex items-center gap-2.5 rounded-full glass pl-1 pr-3 py-1">
                    <span className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                        {initial}
                    </span>
                    <span className="text-sm text-white/90 truncate max-w-[180px]">{name ?? email}</span>
                </div>
                {authed ? (
                    <a
                        href="/api/auth/sign-out"
                        className="text-xs text-white/60 hover:text-white underline-offset-4 hover:underline"
                    >
                        Sign out
                    </a>
                ) : (
                    <a
                        href="/webp/activate"
                        className="text-xs text-white/60 hover:text-white underline-offset-4 hover:underline"
                    >
                        Sign in
                    </a>
                )}
            </div>
        </header>
    );
}

function EmptyState({ email }: { email: string }) {
    return (
        <div className="glass rounded-2xl p-10 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500/30 to-purple-500/30 flex items-center justify-center text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M2 12h20" />
                </svg>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-white">No license yet</h3>
            <p className="mt-1 text-sm text-white/60 max-w-md mx-auto">
                We couldn't find a license for <span className="text-white/90">{email}</span>. Generate one — it takes 10 seconds.
            </p>
            <a
                href="/webp/activate"
                className="mt-6 inline-flex h-11 items-center px-5 rounded-xl bg-gradient-to-r from-brand-500 to-purple-500 text-white font-semibold glow"
            >
                Generate a key →
            </a>
        </div>
    );
}

function UpgradeCard({ hasPaid }: { hasPaid: boolean }) {
    if (hasPaid) {
        return (
            <div className="glass rounded-2xl p-5">
                <div className="text-xs uppercase tracking-wider text-white/50">Plan</div>
                <div className="mt-2 text-white font-semibold">You're on a paid plan 🎉</div>
                <p className="mt-1 text-xs text-white/60">Manage your subscription from the billing section.</p>
            </div>
        );
    }
    return (
        <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-brand-600 via-brand-500 to-purple-600 text-white">
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
                background: "radial-gradient(80% 60% at 50% -10%, rgba(255,255,255,0.35), transparent 60%)",
            }} />
            <div className="relative">
                <div className="text-xs uppercase tracking-wider opacity-80">Upgrade</div>
                <div className="mt-1 text-lg font-semibold leading-tight">Ship lighter pages on more sites.</div>
                <ul className="mt-3 space-y-1.5 text-xs opacity-90">
                    <li>• AVIF + larger quotas</li>
                    <li>• Multi-site licences</li>
                    <li>• Priority support</li>
                </ul>
                <Link
                    href="/webp/activate?plan=growth"
                    className="mt-4 inline-flex h-9 items-center px-3 rounded-lg bg-white text-ink-950 text-xs font-semibold"
                >
                    See plans →
                </Link>
            </div>
        </div>
    );
}

function BillingCard() {
    return (
        <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-xs uppercase tracking-wider text-white/50">Billing</div>
                    <div className="mt-1 text-white font-medium">Invoices & payment</div>
                </div>
                <span className="rounded-full bg-white/10 text-white/70 text-[10px] font-semibold px-2 py-0.5">Soon</span>
            </div>
            <p className="mt-2 text-xs text-white/60">
                Your invoices will appear here once paid plans are live. Payments are handled securely by Freemius.
            </p>
        </div>
    );
}

function SupportCard() {
    return (
        <div className="glass rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-white/50">Need help?</div>
            <div className="mt-1 text-white font-medium">We answer fast.</div>
            <p className="mt-1 text-xs text-white/60">Docs, troubleshooting and direct contact.</p>
            <div className="mt-3 flex gap-2">
                <a href="/webp" className="h-8 px-3 rounded-lg text-xs flex items-center bg-white/10 hover:bg-white/15 text-white/90">Docs</a>
                <a href="mailto:support@tempaloo.com" className="h-8 px-3 rounded-lg text-xs flex items-center bg-white/10 hover:bg-white/15 text-white/90">Email</a>
            </div>
        </div>
    );
}
