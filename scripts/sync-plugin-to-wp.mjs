#!/usr/bin/env node
/**
 * Mirror plugin/tempaloo-webp/ → Local Sites WP install.
 *
 * Why: Local by Flywheel sites read from
 *   C:\Users\otman\Local Sites\web\app\public\wp-content\plugins\tempaloo-webp
 * but we develop in
 *   C:\Users\otman\Documents\webp\plugin\tempaloo-webp
 *
 * Run after any plugin source change:
 *   cd plugin/tempaloo-webp/admin-app && npm run sync:wp
 *   (or `npm run build:sync` to rebuild + sync in one shot)
 *
 * Excludes the admin-app source folder (only the compiled build/ goes
 * to the WP install) and node_modules / .git for size + safety.
 *
 * Override the destination via env: WP_PLUGIN_DEST=...
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const SRC = path.join(REPO_ROOT, "plugin", "tempaloo-webp");
const DEST = process.env.WP_PLUGIN_DEST
    ?? "C:\\Users\\otman\\Local Sites\\web\\app\\public\\wp-content\\plugins\\tempaloo-webp";

if (!existsSync(SRC)) {
    console.error(`✗ Source not found: ${SRC}`);
    process.exit(1);
}
if (!existsSync(DEST)) {
    console.error(`✗ Destination not found: ${DEST}`);
    console.error(`  (override with WP_PLUGIN_DEST env var)`);
    process.exit(1);
}

console.log(`→ ${SRC}`);
console.log(`→ ${DEST}`);

// /MIR mirrors (deletes orphans), /XD excludes dirs, /XF excludes files
// /NFL /NDL /NJH /NJS keeps output minimal
const exclude = "/XD admin-app node_modules .git /XF *.log .DS_Store .gitignore";
const cmd = `robocopy "${SRC}" "${DEST}" /MIR ${exclude} /NFL /NDL /NJH /NJS`;

try {
    execSync(cmd, { stdio: "inherit", shell: "powershell.exe" });
} catch (e) {
    // robocopy uses non-zero exit codes for "files copied" too.
    // 0 = no change, 1 = copied, 2 = extras, 3 = both, 8+ = error.
    const code = (e?.status ?? 0);
    if (code >= 8) {
        console.error(`✗ robocopy failed with exit code ${code}`);
        process.exit(1);
    }
    // 1-7 are success-ish — treat as OK.
}

console.log("✓ Plugin synced.");
console.log("  Now hard-refresh wp-admin (Ctrl+Shift+R) to load the new admin.js.");
