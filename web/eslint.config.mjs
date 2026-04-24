// Minimal ESLint flat config — bypass the eslint-config-next circular-JSON
// bug by not using it. Covers the big-hit issues: unused vars, no-console
// (off — we use it for tracking fallbacks), prefer-const, etc.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";

export default [
    { ignores: [".next/**", "node_modules/**", "dist/**"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx}"],
        plugins: { react: reactPlugin },
        rules: {
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "@typescript-eslint/no-explicit-any": "off",
            "react/jsx-uses-react": "off",
            "react/react-in-jsx-scope": "off",
            "prefer-const": "error",
            "no-var": "error",
        },
    },
];
