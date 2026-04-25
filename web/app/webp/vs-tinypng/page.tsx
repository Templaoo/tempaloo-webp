import { COMPETITORS } from "@/lib/competitors";
import { VsPage } from "@/components/vs/VsPage";

export const metadata = {
    title: "Tempaloo vs TinyPNG — Pay-per-thumbnail kills your budget",
    description: "TinyPNG bills $0.009 per WordPress thumbnail compression. Tempaloo bills 1 credit per upload, all sizes bundled. See how much you'd save.",
    alternates: { canonical: "/webp/vs-tinypng" },
};

export default function VsTinyPNG() {
    return <VsPage competitor={COMPETITORS.tinypng} />;
}
