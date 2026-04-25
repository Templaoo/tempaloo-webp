import { type ReactNode } from "react";
import { DocsShell } from "@/components/docs/DocsShell";

export const metadata = {
    title: "Docs — Tempaloo WebP",
    description: "How to install, configure, and integrate the Tempaloo WebP plugin in your WordPress workflow.",
};

export default function DocsLayout({ children }: { children: ReactNode }) {
    return <DocsShell>{children}</DocsShell>;
}
