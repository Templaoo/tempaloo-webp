/* Tempaloo WebP — per-row Convert / Restore buttons on wp-admin/upload.php
 *
 * Loaded only on upload.php (Media Library list view) where our
 * "Optimized" column renders one of two states per row:
 *  · Not converted → `.tempaloo-convert-now` button. Click runs
 *    convert_all_sizes server-side for that one attachment (1 credit,
 *    every size included), cell flips to the converted state on success.
 *  · Converted     → format badge + savings + `.tempaloo-restore-now`
 *    link. Click deletes our .webp / .avif siblings + clears meta,
 *    cell flips back to the "Convert now" state on success.
 *
 * Both buttons use the same AJAX delegation pattern. Defensive against:
 *   * Multiple clicks during a slow round-trip (button disabled while
 *     in flight).
 *   * Partial / quota / network errors (button restored, message
 *     surfaced; the retry queue handles real retries server-side).
 *   * Missing TempalooConvertOneBoot global (graceful no-op).
 *   * Restore needing user confirmation — destructive, shows a
 *     native confirm() before firing.
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

    /** Escapes a string for safe HTML interpolation. */
    function esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    /**
     * Renders the converted-state cell after a fresh conversion.
     * Mirrors the v1.13 PHP layout (badge, savings, byte breakdown,
     * action row + inline confirm panel) using the same CSS classes
     * so styling stays consistent with server-rendered cells.
     *
     * The Detail accordion is intentionally omitted: the AJAX convert
     * response only carries aggregates, not per-size bytes. A page
     * refresh re-renders the row server-side with the full breakdown.
     * Acceptable trade-off — users who want the detail can refresh.
     */
    function renderConverted(cell, id, savings, restoreNonce) {
        if (!cell) return;
        var format = String(savings.format || "webp").toUpperCase();
        var badgeClass = "tempaloo-badge-webp";
        if (format === "AVIF") badgeClass = "tempaloo-badge-avif";
        if (format === "BOTH" || format === "WEBP+AVIF") badgeClass = "tempaloo-badge-both";

        cell.innerHTML =
            '<div class="tempaloo-cell-summary">' +
                '<div class="tempaloo-cell-row">' +
                    '<span class="tempaloo-badge ' + badgeClass + '">' + esc(format) + '</span>' +
                    '<span class="tempaloo-saved">−' + (savings.saved_pct | 0) + '%</span>' +
                '</div>' +
                '<div class="tempaloo-cell-bytes">' +
                    esc(formatBytes(savings.bytes_in)) + ' → <strong>' + esc(formatBytes(savings.bytes_out)) + '</strong>' +
                '</div>' +
                (restoreNonce
                    ? '<div class="tempaloo-cell-actions">' +
                          '<button type="button" class="tempaloo-restore-now" data-id="' + id + '" data-nonce="' + esc(restoreNonce) + '" title="Delete the .webp / .avif siblings and revert this image to its uploaded state.">' +
                              '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                                  '<polyline points="1 4 1 10 7 10" />' +
                                  '<path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />' +
                              '</svg>' +
                              '<span>Restore</span>' +
                          '</button>' +
                      '</div>'
                    : "") +
            '</div>' +
            (restoreNonce
                ? '<div class="tempaloo-cell-confirm" hidden role="dialog" aria-label="Confirm restore">' +
                      '<div class="tempaloo-confirm-icon">' +
                          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                              '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />' +
                              '<line x1="12" y1="9" x2="12" y2="13" />' +
                              '<line x1="12" y1="17" x2="12.01" y2="17" />' +
                          '</svg>' +
                      '</div>' +
                      '<div class="tempaloo-confirm-body">' +
                          '<div class="tempaloo-confirm-title">Restore this image?</div>' +
                          '<div class="tempaloo-confirm-text">This deletes the .webp / .avif siblings and clears the conversion record. Your original image stays untouched.</div>' +
                          '<div class="tempaloo-confirm-actions">' +
                              '<button type="button" class="tempaloo-confirm-cancel">Cancel</button>' +
                              '<button type="button" class="tempaloo-confirm-yes" data-id="' + id + '" data-nonce="' + esc(restoreNonce) + '">Yes, restore</button>' +
                          '</div>' +
                      '</div>' +
                  '</div>'
                : "");
    }

    /**
     * Renders the "Convert now" cell — used both as the initial state
     * for unconverted images and as the post-restore state, so the
     * user can re-trigger a conversion right after restoring without
     * leaving the page.
     */
    function renderConvertButton(cell, id, convertNonce) {
        if (!cell) return;
        cell.innerHTML =
            '<button type="button" class="button button-small tempaloo-convert-now" data-id="' + id + '" data-nonce="' + esc(convertNonce) + '">Convert now</button>';
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

    /** Flashes a transient inline message under a button or cell.
     *  Used for restore success ("4 files removed"); error bubbles still
     *  use showError above with the longer-lived destructive style. */
    function showFlash(node, message, color) {
        if (!node || !node.parentNode) return;
        var old = node.parentNode.querySelector(".tempaloo-flash");
        if (old) old.remove();
        var f = document.createElement("div");
        f.className = "tempaloo-flash";
        f.style.cssText = "color:" + (color || "#15803d") + ";font-size:11px;margin-top:4px;line-height:1.4;";
        f.textContent = message;
        node.parentNode.appendChild(f);
        setTimeout(function () { if (f && f.parentNode) f.remove(); }, 4000);
    }

    /** Fetches the cell wrapper for a given action button so we can
     *  re-render its full content after a successful action. */
    function findCell(btn) {
        var cell = btn.closest(".tempaloo-media-cell");
        if (cell) return cell;
        // Fallback for legacy "Convert now" button rendered without a
        // wrapper (pre-v1.13). Find the parent <td>; its first child
        // is the button. Wrap it on the fly.
        return btn.closest("td");
    }

    /** Reads the convert nonce from the cell wrapper's data attribute. */
    function getConvertNonce(cell) {
        if (!cell) return "";
        return cell.getAttribute("data-convert-nonce") || "";
    }
    function getRestoreNonce(cell) {
        if (!cell) return "";
        return cell.getAttribute("data-restore-nonce") || "";
    }

    /**
     * Hides the inline confirm panel + summary actions and shows
     * "Restoring…" feedback. Called when user clicks "Yes, restore"
     * inside the confirm dialog.
     */
    function setRestoreInProgress(cell, yesBtn) {
        if (!yesBtn) return;
        yesBtn.disabled = true;
        yesBtn.textContent = "Restoring…";
        var cancelBtn = cell.querySelector(".tempaloo-confirm-cancel");
        if (cancelBtn) cancelBtn.disabled = true;
    }

    /**
     * Toggle the Detail accordion (chevron-rotation handled by CSS via
     * the aria-expanded attribute). Single source of truth for opening
     * / closing the per-size breakdown.
     */
    function toggleDetail(cell) {
        if (!cell) return;
        var toggle = cell.querySelector(".tempaloo-detail-toggle");
        var panel  = cell.querySelector(".tempaloo-cell-detail");
        if (!toggle || !panel) return;
        var isOpen = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
        if (isOpen) {
            panel.setAttribute("hidden", "");
        } else {
            panel.removeAttribute("hidden");
        }
    }

    /**
     * Open the inline confirm dialog for restore. Hides the summary
     * actions + closes any open Detail panel so focus is unambiguous.
     */
    function openConfirm(cell) {
        if (!cell) return;
        var confirmEl = cell.querySelector(".tempaloo-cell-confirm");
        if (!confirmEl) return;
        confirmEl.removeAttribute("hidden");
        // Move focus to the destructive button so Enter triggers it
        // and Esc cancels via the keydown handler below.
        var yes = confirmEl.querySelector(".tempaloo-confirm-yes");
        if (yes) yes.focus();
    }

    function closeConfirm(cell) {
        if (!cell) return;
        var confirmEl = cell.querySelector(".tempaloo-cell-confirm");
        if (confirmEl) confirmEl.setAttribute("hidden", "");
    }

    document.addEventListener("click", async function (e) {
        var target = e.target;
        if (!target || !target.closest) return;

        // Detail accordion toggle.
        var detailToggle = target.closest(".tempaloo-detail-toggle");
        if (detailToggle) {
            e.preventDefault();
            toggleDetail(detailToggle.closest(".tempaloo-media-cell"));
            return;
        }

        // Restore button — opens the inline confirm dialog (does NOT
        // fire the network request). The actual restore happens when
        // the user clicks "Yes, restore" inside the dialog.
        var restoreBtn = target.closest(".tempaloo-restore-now");
        if (restoreBtn) {
            e.preventDefault();
            if (restoreBtn.disabled) return;
            openConfirm(restoreBtn.closest(".tempaloo-media-cell"));
            return;
        }

        // Cancel — closes the confirm dialog without firing anything.
        var cancelBtn = target.closest(".tempaloo-confirm-cancel");
        if (cancelBtn) {
            e.preventDefault();
            closeConfirm(cancelBtn.closest(".tempaloo-media-cell"));
            return;
        }

        // Yes, restore — actually fires the AJAX restore.
        var confirmYes = target.closest(".tempaloo-confirm-yes");
        if (confirmYes) {
            e.preventDefault();
            if (confirmYes.disabled) return;
            var rcell = confirmYes.closest(".tempaloo-media-cell");
            var rid = confirmYes.getAttribute("data-id");
            var rnonce = confirmYes.getAttribute("data-nonce");
            if (!rid || !rnonce) return;

            setRestoreInProgress(rcell, confirmYes);

            var rfd = new FormData();
            rfd.append("action", "tempaloo_restore_one");
            rfd.append("id", rid);
            rfd.append("nonce", rnonce);

            try {
                var rres = await fetch(BOOT.ajaxUrl, {
                    method: "POST",
                    credentials: "same-origin",
                    body: rfd,
                });
                var rdata = null;
                try { rdata = await rres.json(); } catch (_) { /* fall through */ }

                if (rdata && rdata.success && rdata.data) {
                    var convertNonce = getConvertNonce(rcell);
                    if (rcell && convertNonce) {
                        renderConvertButton(rcell, rid, convertNonce);
                        showFlash(rcell, "Restored · " + (rdata.data.filesRemoved | 0) + " file(s) removed");
                    } else {
                        confirmYes.textContent = "Restored ✓";
                    }
                    return;
                }

                var rmsg = "Restore failed";
                if (rdata && rdata.data && rdata.data.message) rmsg = rdata.data.message;
                else if (!rres.ok) rmsg = "HTTP " + rres.status;
                confirmYes.disabled = false;
                confirmYes.textContent = "Yes, restore";
                showError(confirmYes, rmsg);
            } catch (rerr) {
                confirmYes.disabled = false;
                confirmYes.textContent = "Yes, restore";
                showError(confirmYes, "Network error: " + (rerr && rerr.message ? rerr.message : "unknown"));
            }
            return;
        }

        // Convert button — same path as before.
        var convertBtn = target.closest(".tempaloo-convert-now");
        if (!convertBtn) return;

        e.preventDefault();
        if (convertBtn.disabled) return;

        var id = convertBtn.getAttribute("data-id");
        var nonce = convertBtn.getAttribute("data-nonce");
        if (!id || !nonce) return;

        var cell = findCell(convertBtn);
        convertBtn.disabled = true;
        convertBtn.textContent = "Converting…";

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
                var restoreNonce = getRestoreNonce(cell);
                if (cell) {
                    renderConverted(cell, id, data.data.savings, restoreNonce);
                } else {
                    var td = convertBtn.closest("td");
                    if (td) renderConverted(td, id, data.data.savings, restoreNonce);
                }
                return;
            }

            var msg = "Conversion failed";
            if (data && data.data && data.data.message) msg = data.data.message;
            else if (!res.ok) msg = "HTTP " + res.status;
            showError(convertBtn, msg);
        } catch (err) {
            showError(convertBtn, "Network error: " + (err && err.message ? err.message : "unknown"));
        }
    });

    // Esc closes any open confirm dialog without firing the action.
    // Standard accessibility pattern — destructive dialogs MUST be
    // dismissable by keyboard.
    document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        var openDialogs = document.querySelectorAll(".tempaloo-cell-confirm:not([hidden])");
        for (var i = 0; i < openDialogs.length; i++) {
            openDialogs[i].setAttribute("hidden", "");
        }
    });
})();
