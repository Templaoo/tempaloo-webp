import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { ContactShell } from "@/components/contact/ContactShell";

export const metadata: Metadata = {
    title: "Contact — Tempaloo",
    description:
        "Get in touch with the Tempaloo team. Sales, support, partnerships, or general questions — we read every message.",
    openGraph: {
        title: "Contact Tempaloo",
        description: "Get in touch with the team behind Tempaloo WebP.",
        url: "https://tempaloo.com/contact",
        type: "website",
    },
    alternates: { canonical: "https://tempaloo.com/contact" },
};

export default function ContactPage() {
    return (
        <ContactShell>
            <ContactForm />
        </ContactShell>
    );
}
