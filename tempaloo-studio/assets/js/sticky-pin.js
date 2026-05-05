/* ============================================================
 * Tempaloo Studio — Sticky / Pin Element + Header Sticky runtime
 *
 * Verbatim port of Animation Addons Pro v2.6.3 `assets/js/sticky-pin.js`
 * (423 lines), with three changes:
 *
 *   1. Control IDs read from `tw_pin_*` / `tw_hsticky_*` (instead of
 *      `wcf_*` / `aae_*`) so the runtime matches our PHP extension
 *      (Tempaloo\Studio\Elementor\Pin_Element).
 *   2. Active CSS class is `tw-pin-active` (the source uses
 *      `aae-pro-sticky-active`). The user-defined Toggle Class control
 *      is added in addition.
 *   3. Translating-state class is `tw-pin-is-translating` (source
 *      uses `aae-is-translating`).
 *
 * Architecture (matching Animation Addons exactly):
 *
 *   - elementorModules.frontend.handlers.Base.extend({})
 *   - Hooks on BOTH `frontend/element_ready/section` and
 *     `frontend/element_ready/container`.
 *   - getResponsiveSetting() walks device cascade (mobile → widescreen).
 *   - bindEvents() bails on this.isEdit then dispatches:
 *       • stickyElement()  if tw_pin_enable_pin_area === 'yes'
 *       • headerSticky()   if tw_hsticky_enable === 'yes'
 *
 * stickyElement():
 *   Reads 14 controls, resolves custom values, builds a single
 *   ScrollTrigger.create({ ... onToggle, onUpdate }) on the element.
 *   onToggle adds `tw-pin-active` (+ user toggle class) when active.
 *   onUpdate tracks translateY changes to add `tw-pin-is-translating`
 *   for live styling hooks.
 *
 * headerSticky():
 *   Clones the header element, positions the clone absolute, and uses
 *   ScrollTrigger pin: wrapper + opacity + Y tweens to animate clone
 *   reveal. With Up Scroll Sticky enabled, also tracks scrollY and
 *   reveals on scroll-up only. Without it, reveals while in pin range.
 * ============================================================ */
( function ( $ ) {

    // Guard — Elementor frontend module needs to exist for handlers.Base.
    if ( typeof window.elementorFrontend === 'undefined' ) return;

    window.addEventListener( 'elementor/frontend/init', function () {

        if ( typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined' ) {
            if ( window.console ) console.warn(
                '[tw-pin] gsap or ScrollTrigger missing — extension disabled'
            );
            return;
        }
        gsap.registerPlugin( ScrollTrigger );

        var Modules = elementorModules.frontend.handlers.Base;

        var PinAreaHandler = Modules.extend( {

            /* ── Responsive setting resolver — copied verbatim from
             *    Animation Addons. Walks UP from current device-mode,
             *    then DOWN, then falls back to the base control value.
             *    Returns the first non-empty value found. */
            getResponsiveSetting: function ( controlName ) {
                var settings      = this.getElementSettings();
                var currentDevice = elementorFrontend.getCurrentDeviceMode();
                var devices       = [ 'mobile', 'mobile_extra', 'tablet', 'tablet_extra', 'laptop', 'desktop', 'widescreen' ];
                var currentIndex  = devices.indexOf( currentDevice );
                var start         = currentIndex >= 0 ? currentIndex : devices.indexOf( 'desktop' );

                for ( var i = start; i < devices.length; i++ ) {
                    var v = elementorFrontend.utils.controls
                        .getResponsiveControlValue( settings, controlName, '', devices[ i ] );
                    if ( v && typeof v === 'object' ) {
                        if ( v.size !== undefined && v.size !== '' && ! isNaN( v.size ) ) return v;
                    } else if ( v !== undefined && v !== null && v !== '' ) {
                        return v;
                    }
                }
                for ( var j = start - 1; j >= 0; j-- ) {
                    var w = elementorFrontend.utils.controls
                        .getResponsiveControlValue( settings, controlName, '', devices[ j ] );
                    if ( w && typeof w === 'object' ) {
                        if ( w.size !== undefined && w.size !== '' && ! isNaN( w.size ) ) return w;
                    } else if ( w !== undefined && w !== null && w !== '' ) {
                        return w;
                    }
                }
                return this.getElementSettings( controlName );
            },

            /* ── Lifecycle: bindEvents — Editor bail + feature dispatch */
            bindEvents: function bindEvents() {
                if ( this.isEdit ) return;

                if ( 'yes' === this.getResponsiveSetting( 'tw_pin_enable_pin_area' ) ) {
                    this.stickyElement();
                }
                if ( 'yes' === this.getResponsiveSetting( 'tw_hsticky_enable' ) ) {
                    this.headerSticky();
                }
            },

            /* =====================================================
             * STICKY / PIN ELEMENT — port of Animation Addons stickyElement()
             * ==================================================== */
            stickyElement: function stickyElement() {

                var pin_area          = this.$element;
                var pin_area_start    = this.getResponsiveSetting( 'tw_pin_pin_area_start' );
                var pin_area_end      = this.getResponsiveSetting( 'tw_pin_pin_area_end' );
                var end_trigger       = this.getResponsiveSetting( 'tw_pin_pin_end_trigger' );
                var end_trigger_type  = this.getResponsiveSetting( 'tw_pin_pin_end_trigger_type' );
                var pin_status        = this.getResponsiveSetting( 'tw_pin_pin_status' );
                var wcf_pin_spacing   = this.getResponsiveSetting( 'tw_pin_pin_spacing' );
                var wcf_pin_markers   = this.getElementSettings( 'tw_pin_pin_markers' );
                var wcf_pin_active_cls = String( this.getElementSettings( 'tw_pin_pin_active_cls' ) || '' )
                                            .trim().replace( /^\.+/, '' );

                // Backward-compat — server-rendered fallback for end-trigger
                // (set via Pin_Element::fix_default_end_trigger filter).
                if ( pin_area[ 0 ].dataset && pin_area[ 0 ].dataset.twPinEndTrigger &&
                     pin_area[ 0 ].dataset.twPinEndTrigger !== '' ) {
                    end_trigger = pin_area[ 0 ].dataset.twPinEndTrigger;
                }

                // Resolve custom values — Pin Spacing.
                if ( 'custom' === wcf_pin_spacing ) {
                    wcf_pin_spacing = this.getResponsiveSetting( 'tw_pin_pin_spacing_custom' );
                } else {
                    wcf_pin_spacing = wcf_pin_spacing === 'true' ? true : false;
                }

                // Resolve custom values — Pin status.
                if ( 'custom' === pin_status ) {
                    pin_status = this.getResponsiveSetting( 'tw_pin_pin_custom' );
                } else {
                    pin_status = pin_status === 'true' ? true : false;
                }

                // Resolve custom values — Pin Start.
                if ( 'custom' === pin_area_start ) {
                    pin_area_start = this.getResponsiveSetting( 'tw_pin_pin_area_start_custom' );
                    if ( this.getResponsiveSetting( 'tw_pin_pin_area_start_custom' ) !== undefined ) {
                        pin_area_start = this.getResponsiveSetting( 'tw_pin_pin_area_start_custom' );
                    }
                }

                // Resolve custom values — Pin End.
                if ( 'custom' === pin_area_end ) {
                    pin_area_end = this.getResponsiveSetting( 'tw_pin_pin_area_end_custom' );
                    if ( this.getResponsiveSetting( 'tw_pin_pin_area_end_custom' ) !== undefined ) {
                        pin_area_end = this.getResponsiveSetting( 'tw_pin_pin_area_end_custom' );
                    }
                }

                // Custom Pin Area — pin a parent OR sibling element by selector.
                if ( this.getResponsiveSetting( 'tw_pin_custom_pin_area' ) ) {
                    pin_area = this.getResponsiveSetting( 'tw_pin_custom_pin_area' );
                    if ( ! ( pin_area instanceof HTMLElement ) ) {
                        if ( typeof pin_area === 'string' && pin_area.trim() !== '' ) {
                            pin_area = document.querySelector( pin_area );
                        }
                    }
                }

                // Kill CSS transitions before tweening — prevents the theme's
                // `transition: 0.3s ease` from fighting GSAP's tween updates.
                this.$element.css( 'transition', 'unset' );
                gsap.set( this.$element, { transition: 'none' } );

                // ── Translation tracking — adds `tw-pin-is-translating`
                //    class on the element while its translateY is changing.
                //    Useful for live debugging + style hooks. EPS:0.5 ignores
                //    sub-pixel scroll noise.
                var prevY        = null;
                var EPS          = 0.5;
                var translating  = false;

                var setTranslating = function ( isOn ) {
                    if ( isOn === translating ) return;
                    translating = isOn;
                    if ( pin_area.length ) {
                        pin_area[ 0 ].classList.toggle( 'tw-pin-is-translating', isOn );
                        if ( pin_area[ 0 ].parentElement ) {
                            pin_area[ 0 ].parentElement.classList.toggle( 'tw-pin-is-translating', isOn );
                        }
                    }
                };

                var tempConfig = {
                    trigger:     pin_area,
                    endTrigger:  end_trigger,
                    pin:         pin_status,
                    pinSpacing:  wcf_pin_spacing,
                    start:       pin_area_start,
                    end:         pin_area_end,
                    markers:     wcf_pin_markers === 'true',

                    onToggle: function ( self ) {
                        if ( self.isActive ) {
                            self.trigger.classList.add( 'tw-pin-active' );
                            if ( wcf_pin_active_cls ) {
                                self.trigger.classList.add( wcf_pin_active_cls );
                            }
                        } else {
                            self.trigger.classList.remove( 'tw-pin-active' );
                            if ( wcf_pin_active_cls ) {
                                self.trigger.classList.remove( wcf_pin_active_cls );
                            }
                        }
                    },

                    onUpdate: function () {
                        if ( ! pin_area.length ) return;
                        var y = gsap.getProperty( pin_area[ 0 ], 'y' ) || 0;
                        if ( prevY === null ) prevY = y;

                        var changed = Math.abs( y - prevY ) > EPS;
                        setTranslating( changed );
                        prevY = y;

                        // After a stable frame, drop the translating class on next rAF.
                        if ( ! changed && translating ) {
                            requestAnimationFrame( function () {
                                var y2 = gsap.getProperty( pin_area[ 0 ], 'y' ) || 0;
                                setTranslating( Math.abs( y2 - y ) > EPS );
                            } );
                        }
                    },
                };

                // Drop endTrigger entirely if not provided — ScrollTrigger
                // computes `end` against the trigger itself in that case.
                if ( typeof end_trigger === 'undefined' || end_trigger === '' ) {
                    delete tempConfig.endTrigger;
                }

                ScrollTrigger.create( tempConfig );
            },

            /* =====================================================
             * HEADER STICKY — port of Animation Addons headerSticky()
             *
             * Pattern: clone the header → position clone absolute →
             * ScrollTrigger pin the wrapper → tween opacity + Y on clone.
             * With Up Scroll Sticky on, also tracks scrollY direction so
             * the clone reveals only when scrolling UP within pin range.
             * ==================================================== */
            headerSticky: function headerSticky() {

                var pin_area         = this.$element;
                var pin_area_end     = this.getResponsiveSetting( 'tw_hsticky_end_trigger' );
                var start_position   = this.getResponsiveSetting( 'tw_hsticky_start_position' );
                var z_index          = this.getResponsiveSetting( 'tw_hsticky_z_index' );
                var up_scroll_sticky = this.getResponsiveSetting( 'tw_hsticky_up_scroll_sticky' );
                up_scroll_sticky     = up_scroll_sticky === 'yes';
                var ease             = this.getResponsiveSetting( 'tw_hsticky_ease' );
                var duration         = this.getResponsiveSetting( 'tw_hsticky_duration' );
                var style_class      = this.getElementSettings( 'tw_hsticky_style_cls' );

                this.$element.css( 'transition', 'unset' );
                gsap.set( this.$element, { transition: 'none' } );

                var defaultTop      = 0;
                var defaultDuration = duration || 0.3;
                var item            = pin_area[ 0 ];
                var endClass        = pin_area_end || '.tw-pin-footer-sticky-trigger';
                var startPosition   = start_position;
                var startPositionPx = this.convertToPixels( startPosition ) + 0;

                // Clone the original header into an absolute-positioned twin.
                // The clone receives the slide-in tweens; the original stays
                // visible until the clone reveals (then opacity flip).
                var itemClone = item.cloneNode( true );
                if ( style_class && typeof style_class === 'string' ) {
                    var cleanClass = style_class.replace( /^[.#]/, '' );
                    itemClone.classList.add( cleanClass );
                }

                // Wrap original + clone in a positioned container so
                // ScrollTrigger has a stable element to pin (clones can
                // get re-rendered by Elementor; the wrapper is owned by us).
                var wrapper = document.createElement( 'div' );
                wrapper.style.position = 'relative';
                wrapper.style.width    = '100%';
                wrapper.style.zIndex   = z_index || 999;
                item.parentNode.insertBefore( wrapper, item );
                wrapper.appendChild( item );
                wrapper.appendChild( itemClone );

                gsap.set( itemClone, {
                    position:   'absolute',
                    width:      '100%',
                    top:        0,
                    left:       0,
                    right:      0,
                    zIndex:     z_index || 999,
                    opacity:    0,
                    y:          defaultTop,
                    transition: 'none',
                    willChange: 'transform, opacity',
                } );

                // Cleanup any previously-attached ScrollTrigger / scroll listener
                // on this clone. Idempotent re-init on Elementor preview re-render.
                var cleanup = function () {
                    ScrollTrigger.getAll().forEach( function ( trigger ) {
                        if ( trigger.vars.trigger === itemClone ) trigger.kill();
                    } );
                    gsap.killTweensOf( itemClone );
                    if ( window.twHStickyScrollHandler ) {
                        window.removeEventListener( 'scroll', window.twHStickyScrollHandler );
                        window.twHStickyScrollHandler = null;
                    }
                };
                cleanup();

                var lastScrollY = window.scrollY;
                var isVisible   = false;
                var isInRange   = false;

                if ( up_scroll_sticky ) {

                    // ── Up-scroll-only reveal mode ──
                    // The pin range tracks isInRange. The scroll handler
                    // (below) tweens clone IN on scroll-up, OUT on scroll-down,
                    // but only WHILE inside the pin range.
                    gsap.timeline( {
                        scrollTrigger: {
                            trigger:        wrapper,
                            endTrigger:     endClass,
                            pin:            wrapper,
                            pinType:        'transform',
                            anticipatePin:  1,
                            start:          'top+=' + startPositionPx + ' top',
                            end:            'bottom bottom-=600',
                            pinSpacing:     false,
                            invalidateOnRefresh: true,
                            onEnter: function () {
                                isInRange   = true;
                                lastScrollY = window.scrollY;
                                gsap.to( item, { opacity: 0 } );
                            },
                            onLeave: function () {
                                isInRange = false;
                                isVisible = false;
                                gsap.killTweensOf( itemClone );
                                gsap.to( itemClone, {
                                    y: defaultTop, opacity: 0,
                                    duration: defaultDuration, ease: ease || 'power2.out',
                                    overwrite: true,
                                } );
                                gsap.to( item, { opacity: 1 } );
                            },
                            onEnterBack: function () {
                                isInRange   = true;
                                lastScrollY = window.scrollY;
                                gsap.to( item, { opacity: 0 } );
                            },
                            onLeaveBack: function () {
                                isInRange = false;
                                isVisible = false;
                                gsap.killTweensOf( itemClone );
                                gsap.to( itemClone, {
                                    y: defaultTop, opacity: 0,
                                    duration: defaultDuration, ease: ease || 'power2.out',
                                    overwrite: true,
                                } );
                                gsap.to( item, { opacity: 1 } );
                            },
                        },
                    } );

                    var scrollHandler = function () {
                        if ( ! isInRange ) return;
                        var currentScrollY = window.scrollY;
                        var scrollDiff     = currentScrollY - lastScrollY;
                        var isScrollingUp   = scrollDiff < -5;
                        var isScrollingDown = scrollDiff > 5;

                        if ( isScrollingUp && ! isVisible ) {
                            gsap.killTweensOf( itemClone );
                            gsap.to( itemClone, {
                                y: startPositionPx, opacity: 1,
                                duration: defaultDuration, ease: ease || 'power2.out',
                                overwrite: true,
                            } );
                            isVisible = true;
                        } else if ( isScrollingDown && isVisible ) {
                            gsap.killTweensOf( itemClone );
                            gsap.to( itemClone, {
                                y: defaultTop, opacity: 0,
                                duration: defaultDuration, ease: ease || 'power2.out',
                                overwrite: true,
                            } );
                            isVisible = false;
                        }
                        lastScrollY = currentScrollY;
                    };

                    window.addEventListener( 'scroll', scrollHandler, { passive: true } );
                    window.twHStickyScrollHandler = scrollHandler;

                } else {

                    // ── Always-reveal-in-pin-range mode ──
                    // Clone fades in on enter, fades out on leave. Scroll
                    // direction doesn't matter.
                    var lastScrollY2 = window.scrollY;

                    gsap.timeline( {
                        scrollTrigger: {
                            trigger:        wrapper,
                            endTrigger:     endClass,
                            pin:            wrapper,
                            pinType:        'transform',
                            anticipatePin:  1,
                            start:          'top+=' + startPositionPx + ' top',
                            end:            'bottom bottom-=600',
                            pinSpacing:     false,
                            invalidateOnRefresh: true,
                            onEnter: function () {
                                gsap.killTweensOf( itemClone );
                                gsap.to( itemClone, {
                                    y: startPositionPx, opacity: 1,
                                    duration: defaultDuration, ease: ease || 'power2.out',
                                    overwrite: true,
                                } );
                                gsap.to( item, { opacity: 0 } );
                            },
                            onLeave: function () {
                                gsap.killTweensOf( itemClone );
                                gsap.to( itemClone, {
                                    y: defaultTop, opacity: 0,
                                    duration: defaultDuration, ease: ease || 'power2.out',
                                    overwrite: true,
                                } );
                                gsap.to( item, { opacity: 1 } );
                            },
                            onEnterBack: function () {
                                gsap.killTweensOf( itemClone );
                                gsap.to( itemClone, {
                                    y: startPositionPx, opacity: 1,
                                    duration: defaultDuration, ease: ease || 'power2.out',
                                    overwrite: true,
                                } );
                                gsap.to( item, { opacity: 0 } );
                            },
                            onLeaveBack: function () {
                                gsap.killTweensOf( itemClone );
                                gsap.to( itemClone, {
                                    y: defaultTop, opacity: 0,
                                    duration: defaultDuration, ease: ease || 'power2.out',
                                    overwrite: true,
                                } );
                                gsap.to( item, { opacity: 1 } );
                            },
                        },
                    } );

                    var scrollHandler2 = function () {
                        var currentScrollY = window.scrollY;
                        var scrollDiff     = currentScrollY - lastScrollY2;
                        var isScrollingDown = scrollDiff > 5;
                        if ( isScrollingDown ) {
                            gsap.to( itemClone, { y: startPositionPx } );
                        }
                        lastScrollY2 = currentScrollY;
                    };
                    window.addEventListener( 'scroll', scrollHandler2, { passive: true } );
                    window.twHStickyScrollHandler = scrollHandler2;
                }
            },

            /* ── Convert "300px" / "300" / "20rem" → pixel number ── */
            convertToPixels: function convertToPixels( value ) {
                if ( typeof value === 'number' ) return value;
                if ( /^\d+(\.\d+)?$/.test( value ) ) return parseFloat( value );

                var el = document.createElement( 'div' );
                el.style.position   = 'absolute';
                el.style.visibility = 'hidden';
                el.style.height     = value;
                document.body.appendChild( el );
                var px = el.offsetHeight;
                document.body.removeChild( el );
                return px;
            },
        } );

        // ── Register handler on BOTH section AND container.
        //    Animation Addons only registers on `container`; we add
        //    `section` too for users still on legacy section layouts.
        elementorFrontend.hooks.addAction( 'frontend/element_ready/section', function ( $scope ) {
            elementorFrontend.elementsHandler.addHandler( PinAreaHandler, { $element: $scope } );
        } );
        elementorFrontend.hooks.addAction( 'frontend/element_ready/container', function ( $scope ) {
            elementorFrontend.elementsHandler.addHandler( PinAreaHandler, { $element: $scope } );
        } );

    } );

} )( jQuery );
