#!/usr/bin/env bash
# Build a clean ZIP of the plugin for WordPress.org submission.
# Strips node_modules, dev caches, source maps, and anything that shouldn't
# ship to end users' wp-content/plugins folder.
#
# Usage:
#   ./scripts/build-wp-org-zip.sh          # uses version from tempaloo-webp.php
#   ./scripts/build-wp-org-zip.sh 0.4.0    # override version
#
# Output:
#   dist/tempaloo-webp-<version>.zip

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="$REPO_ROOT/plugin/tempaloo-webp"
DIST_DIR="$REPO_ROOT/dist"

# Resolve version: explicit arg > header constant
if [[ -n "${1:-}" ]]; then
    VERSION="$1"
else
    VERSION="$(grep -E "TEMPALOO_WEBP_VERSION" "$PLUGIN_DIR/tempaloo-webp.php" \
               | head -1 \
               | sed -E "s/.*'([0-9.]+)'.*/\1/")"
fi

if [[ -z "$VERSION" ]]; then
    echo "ERROR: could not resolve plugin version" >&2
    exit 1
fi

ZIP_NAME="tempaloo-webp-$VERSION.zip"
ZIP_PATH="$DIST_DIR/$ZIP_NAME"

echo "→ Building admin-app bundle"
(cd "$PLUGIN_DIR/admin-app" && npm ci --no-audit --no-fund && npm run build)

echo "→ Verifying the built bundle exists"
if [[ ! -f "$PLUGIN_DIR/build/admin.js" ]]; then
    echo "ERROR: $PLUGIN_DIR/build/admin.js not found — build failed?" >&2
    exit 1
fi

echo "→ Preparing dist/"
mkdir -p "$DIST_DIR"
rm -f "$ZIP_PATH"

echo "→ Zipping $ZIP_NAME"
cd "$REPO_ROOT/plugin"
# admin-app/ is excluded entirely — only build/admin.js + build/admin.css
# are needed at runtime. The React source has zero value to a WP install
# and would more than triple the ZIP size + raise the WP.org review's
# eyebrow ("why is there a Vite project in the plugin?").
zip -r "$ZIP_PATH" tempaloo-webp \
    -x "tempaloo-webp/admin-app/*" \
    -x "tempaloo-webp/**/.DS_Store" \
    -x "tempaloo-webp/**/Thumbs.db" \
    -x "tempaloo-webp/**/*.map" \
    -x "tempaloo-webp/**/.gitkeep" \
    > /dev/null

echo ""
echo "✓ Built $ZIP_PATH"
echo ""
echo "Contents summary:"
unzip -l "$ZIP_PATH" | tail -5
echo ""
echo "Next: upload this ZIP at https://wordpress.org/plugins/developers/add/"
