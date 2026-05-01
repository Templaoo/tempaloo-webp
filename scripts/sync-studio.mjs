/**
 * sync-studio.mjs
 *
 * Mirrors C:/Users/otman/Documents/webp/tempaloo-studio
 * → C:/Users/otman/Local Sites/web/app/public/wp-content/plugins/tempaloo-studio
 *
 * Excludes dev-only paths (node_modules, admin-app/src, .git) so the
 * destination is always a "shipping" copy.
 *
 * Use: `node scripts/sync-studio.mjs` from the repo root.
 *
 * Why a custom script (vs a symlink):
 * - On Windows, symlinks need admin privileges + sometimes break
 *   wp-cli / Local by Flywheel's PHP path resolution.
 * - Plain copy is dumb-simple, works everywhere, idempotent.
 */

import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync } from "node:fs";
import { join, basename, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const SRC = join(__dirname, "..", "tempaloo-studio");
const DST = "C:/Users/otman/Local Sites/web/app/public/wp-content/plugins/tempaloo-studio";

// Folders / files we never copy to the WP install.
const EXCLUDE_DIRS = new Set([
    "node_modules",
    ".git",
    ".idea",
    ".vscode",
    // Dev sources of the React admin — only the built bundle (under
    // build/) gets shipped.
    "admin-app/src",
    "admin-app/node_modules",
    "admin-app/.vite",
]);
const EXCLUDE_FILES = new Set([
    ".DS_Store",
    "Thumbs.db",
]);

function shouldSkip(absPath, isDir) {
    const rel = relative(SRC, absPath).replace(/\\/g, "/");
    if (EXCLUDE_FILES.has(basename(absPath))) return true;
    if (isDir) {
        for (const ex of EXCLUDE_DIRS) {
            if (rel === ex || rel.startsWith(ex + "/")) return true;
        }
    }
    return false;
}

function copyTree(src, dst) {
    if (!existsSync(dst)) mkdirSync(dst, { recursive: true });
    let copied = 0;
    let skipped = 0;
    for (const entry of readdirSync(src)) {
        const s = join(src, entry);
        const d = join(dst, entry);
        const st = statSync(s);
        if (shouldSkip(s, st.isDirectory())) {
            skipped++;
            continue;
        }
        if (st.isDirectory()) {
            const sub = copyTree(s, d);
            copied += sub.copied;
            skipped += sub.skipped;
        } else {
            copyFileSync(s, d);
            copied++;
        }
    }
    return { copied, skipped };
}

if (!existsSync(SRC)) {
    console.error(`✗ Source plugin not found: ${SRC}`);
    process.exit(1);
}

// Wipe destination FIRST so deletions in source propagate. Otherwise
// renamed/removed files would leave orphans in the WP install and you'd
// chase phantom bugs ("why does the old class still exist?").
if (existsSync(DST)) {
    rmSync(DST, { recursive: true, force: true });
}

console.log(`→ ${SRC}`);
console.log(`→ ${DST}`);

const result = copyTree(SRC, DST);
console.log(`\n✓ Plugin synced. ${result.copied} files copied, ${result.skipped} excluded.`);
console.log(`  In wp-admin → Plugins, hard-refresh if you don't see updates immediately.`);
