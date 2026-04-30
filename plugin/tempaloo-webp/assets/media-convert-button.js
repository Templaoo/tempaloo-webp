/* Tempaloo WebP — per-row "Convert now" button on wp-admin/upload.php
 *
 * Loaded only on upload.php (Media Library list view) where our
 * "Optimized" column adds a `.tempaloo-convert-now` button to each
 * unconverted attachment. One AJAX call per click → server runs
 * convert_all_sizes for that one attachment (1 credit, every size
 * included) → cell updates in place to show the post-conversion
 * stats, no full page reload.
 *
 * Defensive against:
 *   * Multiple clicks during a slow conversion (button disabled
 *     while in flight).
 *   * Partial / quota / network errors (button restored, message
 *     surfaced; the retry queue handles the actual retry server-side).
 *   * Missing TempalooConvertOneBoot global (graceful no-op rather
 *     than runtime error).
 */
(function () {
    "use strict";

    var BOOT = window.TempalooConvertOneBoot || null;
    if (!BOOT || !BOOT.ajaxUrl) {
        // Asset enqueued but boot data missing — bail quietly.
        return;
    }

    function formatBytes(n) {
        n = Number(n) || 0;
        if (n <= 0) return "0 B";
        var units = ["B", "KB", "MB", "GB"];
        var i = 0;
        while (n >= 1024 && i < units.length - 1) {
            n /= 1024;
            i++;
        }
        return (i === 0 ? n.toFixed(0) : n.toFixed(1)) + " " + units[i];
    }

    function renderConverted(cell, savings) {
        if (!cell) return;
        cell.innerHTML =
            '<span style="color:#1a7f37;font-weight:600;">✓ ' + savings.format + "</span><br>" +
            '<span style="color:#555;font-size:11px;">' +
            "−" + (savings.saved_pct | 0) + "% · " +
            formatBytes(savings.bytes_in) + " → " + formatBytes(savings.bytes_out) +
            "</span>";
    }

    function showError(btn, message) {
        // Keep the button so the user can retry — but surface why.
        btn.disabled = false;
        btn.textContent = "Convert now";
        // Inline error below the button. Replace any previous inline
        // error so consecutive failures don't stack.
        var parent = btn.parentNode;
        if (!parent) return;
        var old = parent.querySelector(".tempaloo-convert-error");
        if (old) old.remove();
        var note = document.createElement("div");
        note.className = "tempaloo-convert-error";
        note.style.cssText = "color:#b91c1c;font-size:11px;margin-top:4px;line-height:1.4;";
        note.textContent = message;
        parent.appendChild(note);
    }

    document.addEventListener("click", async function (e) {
        var target = e.target;
        if (!target || !target.closest) return;
        var btn = target.closest(".tempaloo-convert-now");
        if (!btn) return;
        e.preventDefault();
        if (btn.disabled) return;

        var id = btn.getAttribute("data-id");
        var nonce = btn.getAttribute("data-nonce");
        if (!id || !nonce) return;

        btn.disabled = true;
        btn.textContent = "Converting…";

        var fd = new FormData();
        fd.append("action", "tempaloo_convert_one");
        fd.append("id", id);
        fd.append("nonce", nonce);

        try {
            var res = await fetch(BOOT.ajaxUrl, {
                method: "POST",
                credentials: "same-origin",
                body: fd,
            });
            var data = null;
            try { data = await res.json(); } catch (_) { /* fall through */ }

            if (data && data.success && data.data && data.data.savings) {
                renderConverted(btn.closest("td"), data.data.savings);
                return;
            }

            var msg = "Conversion failed";
            if (data && data.data && data.data.message) msg = data.data.message;
            else if (!res.ok) msg = "HTTP " + res.status;
            showError(btn, msg);
        } catch (err) {
            showError(btn, "Network error: " + (err && err.message ? err.message : "unknown"));
        }
    });
})();
