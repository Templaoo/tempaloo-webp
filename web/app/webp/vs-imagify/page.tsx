import { COMPETITORS } from "@/lib/competitors";
import { VsPage } from "@/components/vs/VsPage";

export const metadata = {
    title: "Tempaloo vs Imagify — Stop paying by the megabyte",
    description: "Imagify counts MB and charges per WordPress thumbnail. Tempaloo charges 1 credit per upload, every size bundled. Calculator + side-by-side feature matrix.",
    alternates: { canonical: "/webp/vs-imagify" },
};

export default function VsImagify() {
    return <VsPage competitor={COMPETITORS.imagify} />;
}
