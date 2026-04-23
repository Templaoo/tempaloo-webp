import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: path.resolve(__dirname, "../build"),
        emptyOutDir: true,
        cssCodeSplit: false,
        sourcemap: false,
        rollupOptions: {
            input: path.resolve(__dirname, "src/index.tsx"),
            output: {
                entryFileNames: "admin.js",
                assetFileNames: (info) => {
                    if (info.name && info.name.endsWith(".css")) return "admin.css";
                    return "[name][extname]";
                },
                format: "iife",
                inlineDynamicImports: true,
            },
        },
        target: "es2020",
    },
});
