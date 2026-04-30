import { COMPETITORS } from "@/lib/competitors";
import { VsPage } from "@/components/vs/VsPage";

export const metadata = {
    title: "Tempaloo vs Imagify — Stop paying by the megabyte",
    description: "Imagify counts MB and charges per WordPress thumbnail. Tempaloo charges 1 credit per upload, every size bundled. Calculator + side-by-side feature matrix.",
    openGraph: {
        title: "Tempaloo vs Imagify — Stop paying by the megabyte",
        description: "Side-by-side feature matrix + cost calculator. See how much you'd save switching from Imagify.",
        url: "https://tempaloo.com/webp/vs-imagify",
        type: "article",
    },
    twitter: { card: "summary_large_image" },
    alternates: { canonical: "https://tempaloo.com/webp/vs-imagify" },
};

export default function VsImagify() {
    return <VsPage competitor={COMPETITORS.imagify} />;
}
