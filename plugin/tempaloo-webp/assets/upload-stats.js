/**
 * Inline compression stats on the post-upload row of /wp-admin/media-new.php
 * and the Media Library list view.
 *
 * Implementation notes:
 *   - Zero dependency on wp.media — that script isn't reliably loaded on
 *     the legacy /wp-admin/media-new.php uploader and was the root cause
 *     of the previous releases failing silently.
 *   - Talks to admin-ajax.php (a vanilla fetch, nonce-protected) so the
 *     data path works on every page that enqueues this script.
 *   - Per-row MutationObserver re-injects whenever WP rewrites the row
 *     (which it does between the "uploading" and "complete" states).
 */
( function () {
    var STATS_CLASS = "tempaloo-upload-stats";
    var POLL_DELAY  = 600;   // ms between retries while conversion finishes
    var MAX_TRIES   = 25;    // 25 × 600 ms = 15 s window per row
    var DEBUG       = !! window.TEMPALOO_DEBUG;
    var BOOT        = window.TempalooStatsBoot;

    function log() {
        if ( DEBUG && window.console ) {
            console.log.apply( console, [ "[tempaloo]" ].concat( [].slice.call( arguments ) ) );
        }
    }

    if ( ! BOOT || ! BOOT.ajaxUrl ) {
        log( "boot config missing — script disabled" );
        return;
    }

    function formatBytes( n ) {
        if ( ! n || n < 0 ) return "0 B";
        var units = [ "B", "KB", "MB", "GB" ];
        var i = Math.min( units.length - 1, Math.floor( Math.log( n ) / Math.log( 1024 ) ) );
        return ( n / Math.pow( 1024, i ) ).toFixed( i === 0 ? 0 : 1 ) + " " + units[ i ];
    }

    function buildStatsNode( t ) {
        var div = document.createElement( "div" );
        div.className = STATS_CLASS;
        div.style.cssText = "margin-top:6px;display:inline-flex;align-items:center;gap:8px;font-size:12px;line-height:1.4;flex-wrap:wrap;";
        div.innerHTML =
            '<span style="display:inline-flex;align-items:center;padding:2px 7px;border-radius:4px;background:#dcfce7;color:#166534;font-weight:600;font-size:11px;">' +
              "✓ " + ( t.format || "WebP" ) +
            "</span>" +
            '<span style="color:#166534;font-weight:600;">−' + ( t.savedPct || 0 ) + "%</span>" +
            '<span style="color:#555;">' +
              formatBytes( t.bytesIn ) + " → " + formatBytes( t.bytesOut ) +
              ( t.sizes ? ' · <span style="color:#888;">' + t.sizes + " sizes</span>" : "" ) +
            "</span>";
        return div;
    }

    function alreadyInjected( row ) {
        return !! row.querySelector( "." + STATS_CLASS );
    }

    function inject( row, data ) {
        if ( alreadyInjected( row ) ) return;
        var anchor =
            row.querySelector( ".filename" ) ||
            row.querySelector( ".uploaded" ) ||
            row.querySelector( ".attachment-info" ) ||
            row.querySelector( ".describe" ) ||
            row.querySelector( "strong" ) ||
            row;
        var node = buildStatsNode( data );
        if ( anchor === row ) {
            row.appendChild( node );
        } else if ( anchor.nextSibling ) {
            anchor.parentNode.insertBefore( node, anchor.nextSibling );
        } else {
            anchor.parentNode.appendChild( node );
        }
        log( "injected stats", row.id, data );
    }

    function fetchStats( id ) {
        var body = "action=tempaloo_stats&id=" + encodeURIComponent( id ) +
                   "&nonce=" + encodeURIComponent( BOOT.nonce );
        return fetch( BOOT.ajaxUrl, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body,
        } ).then( function ( res ) { return res.json(); } );
    }

    function watchRow( row ) {
        if ( ! row || row.__tempalooBound ) return;
        row.__tempalooBound = true;

        var tries = 0;

        function rowAttachmentId() {
            var m = ( row.id || "" ).match( /^media-item-(\d+)$/ );
            return m ? Number( m[ 1 ] ) : null;
        }

        function attempt() {
            var id = rowAttachmentId();
            if ( ! id ) {
                // Plupload temp UID, not yet swapped for the WP id. Wait.
                tries++;
                if ( tries < MAX_TRIES ) setTimeout( attempt, POLL_DELAY );
                return;
            }
            fetchStats( id ).then( function ( j ) {
                if ( j && j.success && j.data && j.data.ready ) {
                    inject( row, j.data );
                } else {
                    // Conversion not done yet, retry.
                    tries++;
                    if ( tries < MAX_TRIES ) setTimeout( attempt, POLL_DELAY );
                    else log( "gave up after " + MAX_TRIES + " tries", id );
                }
            } ).catch( function ( e ) {
                log( "fetch error", e );
                tries++;
                if ( tries < MAX_TRIES ) setTimeout( attempt, POLL_DELAY * 2 );
            } );
        }
        attempt();

        // Re-inject if WP rewrites the row's content after our injection.
        var rowObserver = new MutationObserver( function () {
            if ( alreadyInjected( row ) ) return;
            var id = rowAttachmentId();
            if ( ! id ) return;
            fetchStats( id ).then( function ( j ) {
                if ( j && j.success && j.data && j.data.ready ) {
                    inject( row, j.data );
                }
            } );
        } );
        rowObserver.observe( row, { childList: true, subtree: true } );
    }

    function scanRoot( root ) {
        var rows = ( root || document ).querySelectorAll( '[id^="media-item-"]' );
        for ( var i = 0; i < rows.length; i++ ) watchRow( rows[ i ] );
    }

    function boot() {
        log( "boot ok" );
        scanRoot( document );
        var globalObserver = new MutationObserver( function ( mutations ) {
            for ( var i = 0; i < mutations.length; i++ ) {
                var added = mutations[ i ].addedNodes;
                for ( var j = 0; j < added.length; j++ ) {
                    var n = added[ j ];
                    if ( n.nodeType !== 1 ) continue;
                    if ( n.id && /^media-item-/.test( n.id ) ) {
                        watchRow( n );
                    } else if ( n.querySelectorAll ) {
                        scanRoot( n );
                    }
                }
            }
        } );
        globalObserver.observe( document.body, { childList: true, subtree: true } );
    }

    if ( document.readyState === "loading" ) {
        document.addEventListener( "DOMContentLoaded", boot );
    } else {
        boot();
    }
} )();
