import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignInClient } from "@/components/auth/SignInClient";

export const metadata: Metadata = {
    title: "Sign in — Tempaloo",
    description:
        "Sign in to your Tempaloo account. Continue with Google or with your email — your dashboard, license keys, and billing are all in one place.",
    robots: { index: false, follow: false },
    alternates: { canonical: "https://tempaloo.com/sign-in" },
};

// Auth pages must reflect the current session immediately. Static
// generation would cache an auth-shaped HTML for everyone.
export const dynamic = "force-dynamic";

export default async function SignInPage({
    searchParams,
}: {
    searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
    const params = await searchParams;
    // If they're already signed in, take them to the dashboard
    // immediately instead of showing the form again.
    const user = await getCurrentUser();
    if (user) {
        redirect(params.redirect && params.redirect.startsWith("/") ? params.redirect : "/webp/dashboard");
    }

    return (
        <SignInClient
            redirectTo={params.redirect && params.redirect.startsWith("/") ? params.redirect : "/webp/dashboard"}
            initialError={params.error}
        />
    );
}
