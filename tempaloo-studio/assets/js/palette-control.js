/* ============================================================
 * Tempaloo Studio — Palette control (Elementor editor)
 *
 * Wires the custom `tempaloo_palette` control's swatch grid to the
 * hidden <input data-setting="…"> that Elementor's editor model
 * reads. Marionette doesn't auto-bind clicks on arbitrary DOM —
 * we delegate from the editor's panel root and update the hidden
 * input + trigger `change`, which is the canonical Elementor
 * pattern for in-control writes.
 *
 * Loaded only inside the Elementor editor (admin context). Safe
 * no-op outside (jQuery dependency check + early return).
 * ============================================================ */
(function ($) {
    'use strict';
    if (!$ || !$.fn) return;

    /**
     * Click handler: when a swatch (or the Clear button) is clicked,
     * find the sibling hidden input that carries `data-setting`,
     * update its value, dispatch native + jQuery `change` so
     * Elementor's view layer picks the change up and saves it.
     */
    $(document).on(
        'click',
        '.tps-palette .tps-palette-swatch, .tps-palette .tps-palette-clear',
        function (e) {
            e.preventDefault();
            e.stopPropagation();

            var $btn   = $(this);
            var $field = $btn.closest('.tps-palette-field');
            var $input = $field.find('input[data-setting]').first();
            if (!$input.length) return;

            var value = $btn.attr('data-value') || '';
            $input.val(value);

            // Reflect the active state in the UI immediately — Elementor
            // will re-render the control after save, but visual snap
            // back to the user's click is important.
            $field.find('.tps-palette-swatch').removeClass('is-active');
            if (value) $btn.addClass('is-active');

            // Trigger BOTH events: jQuery 'change' for Marionette listeners,
            // native 'input' so the underlying model picks it up reliably.
            $input.get(0).dispatchEvent(new Event('input',  { bubbles: true }));
            $input.get(0).dispatchEvent(new Event('change', { bubbles: true }));
            $input.trigger('change');
        }
    );
})(window.jQuery);
