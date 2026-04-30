import { COMPETITORS } from "@/lib/competitors";
import { VsPage } from "@/components/vs/VsPage";

export const metadata = {
    title: "Tempaloo vs TinyPNG — Pay-per-thumbnail kills your budget",
    description: "TinyPNG bills $0.009 per WordPress thumbnail compression. Tempaloo bills 1 credit per upload, all sizes bundled. See how much you'd save.",
    openGraph: {
        title: "Tempaloo vs TinyPNG — Pay-per-thumbnail kills your budget",
        description: "Side-by-side feature matrix + cost calculator. See how much you'd save switching from TinyPNG.",
        url: "https://tempaloo.com/webp/vs-tinypng",
        type: "article",
    },
    twitter: { card: "summary_large_image" },
    alternates: { canonical: "https://tempaloo.com/webp/vs-tinypng" },
};

export default function VsTinyPNG() {
    return <VsPage competitor={COMPETITORS.tinypng} />;
}
