import { LandingPage } from "@/components/webp/LandingPage";
import { loadPlans } from "@/lib/plans";

export const metadata = {
    title: "Tempaloo WebP — Drop-in WebP & AVIF for WordPress",
    description:
        "One credit per image, every thumbnail size included. No visit counting, no surprise bills.",
};

// ISR: plans change a few times a year, not per request.
export const revalidate = 300;

export default async function WebPLanding() {
    const plans = await loadPlans();
    return <LandingPage plans={plans} />;
}
