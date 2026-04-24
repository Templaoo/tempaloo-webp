/**
 * Rasterize the WordPress.org asset SVGs into the PNG files the
 * plugin directory expects. Uses the `sharp` install we already have
 * in api/node_modules.
 *
 * Usage:
 *   node scripts/build-wp-org-assets.mjs
 *
 * Inputs  : plugin/tempaloo-webp/.wordpress-org/assets/*.svg
 * Outputs :
 *   - icon-256x256.png        (fallback — the SVG icon is also shipped)
 *   - banner-1544x500.png
 *   - banner-772x250.png
 *   - screenshot-1.png … screenshot-4.png
 *
 * Text rendering note: sharp uses librsvg which reads the host's fonts
 * via fontconfig. Our SVGs use `system-ui, sans-serif` fallbacks so they
 * render acceptably on any host. If you want pixel-perfect Geist
 * typography, open the SVG in Figma/Illustrator and re-export at the
 * same dimensions.
 */

import sharp from "../api/node_modules/sharp/lib/index.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(ROOT, "plugin/tempaloo-webp/.wordpress-org/assets");

const TARGETS = [
    { svg: "icon.svg",            png: "icon-256x256.png",    w: 256,  h: 256  },
    { svg: "banner-1544x500.svg", png: "banner-1544x500.png", w: 1544, h: 500  },
    { svg: "banner-772x250.svg",  png: "banner-772x250.png",  w: 772,  h: 250  },
    { svg: "screenshot-1.svg",    png: "screenshot-1.png",    w: 1280, h: 720  },
    { svg: "screenshot-2.svg",    png: "screenshot-2.png",    w: 1280, h: 720  },
    { svg: "screenshot-3.svg",    png: "screenshot-3.png",    w: 1280, h: 720  },
    { svg: "screenshot-4.svg",    png: "screenshot-4.png",    w: 1280, h: 720  },
];

async function run() {
    await mkdir(ASSETS_DIR, { recursive: true });

    for (const t of TARGETS) {
        const svgPath = path.join(ASSETS_DIR, t.svg);
        const pngPath = path.join(ASSETS_DIR, t.png);

        let svg;
        try {
            svg = await readFile(svgPath);
        } catch {
            console.warn(`skip ${t.svg} — source missing`);
            continue;
        }

        // density=300 renders at 3× effective DPI before resize → less
        // aliasing on text and thin strokes.
        const png = await sharp(svg, { density: 300 })
            .resize(t.w, t.h, { fit: "cover" })
            .png({ compressionLevel: 9, palette: false })
            .toBuffer();

        await writeFile(pngPath, png);
        console.log(`✓ ${t.png}  (${(png.byteLength / 1024).toFixed(0)} KB)`);
    }

    console.log(`\nAll assets written to:\n  ${ASSETS_DIR}\n`);
    console.log("Next steps:");
    console.log("  1. Review the PNGs visually. Text rendering depends on system fonts —");
    console.log("     if anything looks off, open the .svg in Figma/Illustrator and re-export.");
    console.log("  2. When pushing to the WordPress.org SVN, these files go into the repo's");
    console.log("     `/assets/` folder (NOT inside /trunk/ — so they never ship in the plugin ZIP).");
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
