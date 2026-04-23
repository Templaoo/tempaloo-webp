/**
 * Adds a "WebP" / "AVIF" visual badge on admin thumbnails whose src points
 * to a Tempaloo-converted sibling (.webp or .avif). Works across the Media
 * Library (grid + list), the block editor, the featured image selector, and
 * any UI that surfaces attachment images.
 */
( function () {
    var BADGE_ATTR = "data-tempaloo-badge";

    function detectFormat( src ) {
        if ( ! src ) return null;
        // Look at the trailing path only (strip query string + hash).
        var clean = src.split( "?" )[ 0 ].split( "#" )[ 0 ].toLowerCase();
        if ( clean.indexOf( ".avif" ) !== -1 && clean.lastIndexOf( ".avif" ) > clean.lastIndexOf( "/" ) ) return "AVIF";
        if ( clean.indexOf( ".webp" ) !== -1 && clean.lastIndexOf( ".webp" ) > clean.lastIndexOf( "/" ) ) return "WebP";
        return null;
    }

    function findWrapper( img ) {
        // Walk up a few levels to find a suitable container we can position a badge on.
        var el = img.parentElement;
        for ( var i = 0; i < 5 && el; i++ ) {
            if (
                el.matches &&
                el.matches(
                    ".attachment, .thumbnail, .attachment-preview, .media-frame-menu + .media-frame-content .attachment, " +
                    "figure, .components-responsive-wrapper, .block-editor-media-placeholder__preview, " +
                    ".block-editor-block-list__block[data-type='core/image'] > div"
                )
            ) {
                return el;
            }
            el = el.parentElement;
        }
        return img.parentElement;
    }

    function badge( img ) {
        if ( img.getAttribute( BADGE_ATTR ) ) return;
        var fmt = detectFormat( img.currentSrc || img.src );
        if ( ! fmt ) return;
        var wrap = findWrapper( img );
        if ( ! wrap ) return;
        if ( wrap.getAttribute( BADGE_ATTR ) ) return;

        img.setAttribute( BADGE_ATTR, "1" );
        wrap.setAttribute( BADGE_ATTR, fmt );
        wrap.classList.add( "tempaloo-is-optimized" );
    }

    function scan( root ) {
        var imgs = ( root || document ).querySelectorAll( "img" );
        for ( var i = 0; i < imgs.length; i++ ) {
            badge( imgs[ i ] );
        }
    }

    function boot() {
        scan( document );
        var observer = new MutationObserver( function ( mutations ) {
            for ( var i = 0; i < mutations.length; i++ ) {
                var added = mutations[ i ].addedNodes;
                for ( var j = 0; j < added.length; j++ ) {
                    var n = added[ j ];
                    if ( n.nodeType === 1 ) {
                        if ( n.tagName === "IMG" ) {
                            badge( n );
                        } else {
                            scan( n );
                        }
                    }
                }
            }
        } );
        observer.observe( document.body, { childList: true, subtree: true } );
    }

    if ( document.readyState === "loading" ) {
        document.addEventListener( "DOMContentLoaded", boot );
    } else {
        boot();
    }
} )();
