import { COMPETITORS } from "@/lib/competitors";
import { VsPage } from "@/components/vs/VsPage";

export const metadata = {
    title: "Tempaloo vs ShortPixel — Switch and pay 1 credit per upload",
    description: "ShortPixel charges 1 credit per WordPress thumbnail. Tempaloo charges 1 credit per upload, all sizes bundled. See how much you'd save with our interactive calculator.",
    alternates: { canonical: "/webp/vs-shortpixel" },
};

export default function VsShortPixel() {
    return <VsPage competitor={COMPETITORS.shortpixel} />;
}
