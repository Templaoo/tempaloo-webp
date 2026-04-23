/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{ts,tsx}"],
    // Scope everything under #tempaloo-app so we don't bleed into wp-admin.
    important: "#tempaloo-app",
    corePlugins: {
        preflight: false, // don't reset globally; we scope in styles.css
    },
    theme: {
        extend: {
            colors: {
                brand: {
                    50:  "#eff4ff",
                    100: "#dbe6ff",
                    200: "#bcd1ff",
                    300: "#8cb0ff",
                    400: "#5688ff",
                    500: "#3b6cff",
                    600: "#2a57e6",
                    700: "#1e42b8",
                    800: "#1a3891",
                    900: "#1a3373",
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
                },
            },
            fontFamily: {
                sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
            },
            boxShadow: {
                card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
                pop:  "0 10px 25px -10px rgba(15, 23, 42, 0.25)",
            },
            borderRadius: {
                xl: "12px",
            },
        },
    },
    plugins: [],
};
