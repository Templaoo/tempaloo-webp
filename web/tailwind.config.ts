import type { Config } from "tailwindcss";

export default {
    darkMode: "class",
    content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
            },
            colors: {
                brand: {
                    50:  "#eef2ff",
                    100: "#e0e7ff",
                    300: "#a5b4fc",
                    400: "#818cf8",
                    500: "#6366f1",
                    600: "#4f46e5",
                    700: "#4338ca",
                    800: "#3730a3",
                    900: "#312e81",
                },
                ink: {
                    50:  "#f8fafc",
                    100: "#f1f5f9",
                    200: "#e2e8f0",
                    300: "#cbd5e1",
                    400: "#94a3b8",
                    500: "#64748b",
                    600: "#475569",
                    700: "#334155",
                    800: "#1e293b",
                    900: "#0f172a",
                    950: "#05060c",
                },
            },
            boxShadow: {
                pop: "0 30px 80px -30px rgba(79, 70, 229, 0.35)",
            },
        },
    },
    plugins: [],
} satisfies Config;
