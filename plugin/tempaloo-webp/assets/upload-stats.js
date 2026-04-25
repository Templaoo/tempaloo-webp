/**
 * Inline compression stats on the post-upload row of /wp-admin/media-new.php
 * and the Media Library list view.
 *
 * Survives WP's re-renders: when WP rewrites the inner HTML of a media-item
 * row after upload completes (which wipes our injected stats line), a
 * per-row MutationObserver re-injects automatically.
 *
 * Data sources, in order of preference:
 *   1. wp.media.attachment(id).get('tempaloo')       — synchronous, in cache
 *   2. wp.media.attachment(id).fetch() then re-read  — async, REST round-trip
 */
( function () {
    var STATS_CLASS = "tempaloo-upload-stats";
    var DEBUG = !! window.TEMPALOO_DEBUG;

    function log() {
        if ( DEBUG && window.console ) {
            console.log.apply( console, [ "[tempaloo]" ].concat( [].slice.call( arguments ) ) );
        }
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
        log( "injected stats into media-item-" + row.id, data );
    }

    function readData( id ) {
        if ( ! window.wp || ! window.wp.media || ! window.wp.media.attachment ) return null;
        var att = window.wp.media.attachment( id );
        return att && att.get ? att.get( "tempaloo" ) : null;
    }

    function ensureFetched( id, cb ) {
        if ( ! window.wp || ! window.wp.media || ! window.wp.media.attachment ) {
            cb( null );
            return;
        }
        var att = window.wp.media.attachment( id );
        if ( ! att || ! att.fetch ) { cb( null ); return; }
        att.fetch().done( function () {
            cb( att.get( "tempaloo" ) );
        } ).fail( function () {
            cb( null );
        } );
    }

    /**
     * Watch a single row: re-inject every time its inner DOM changes,
     * since WP rewrites it after upload completes (which removes our line).
     */
    function attachRow( row ) {
        if ( ! row || row.__tempalooBound ) return;
        row.__tempalooBound = true;

        var idMatch = ( row.id || "" ).match( /^media-item-(\d+)$/ );
        var id = idMatch ? Number( idMatch[ 1 ] ) : null;
        if ( ! id ) {
            log( "row without numeric id (still uploading?)", row.id );
        }

        var tries = 0;
        var maxTries = 30; // 30 × 250 ms = 7.5 s window after row appears

        function attempt() {
            // Re-resolve the id in case WP swapped the temp plupload UID
            // for the real attachment id between attempts.
            var nowIdMatch = ( row.id || "" ).match( /^media-item-(\d+)$/ );
            var resolvedId = nowIdMatch ? Number( nowIdMatch[ 1 ] ) : null;
            if ( ! resolvedId ) {
                tries++;
                if ( tries < maxTries ) setTimeout( attempt, 250 );
                return;
            }
            var data = readData( resolvedId );
            if ( data ) {
                inject( row, data );
                return; // success
            }
            // Trigger a fetch once if the cache is empty
            ensureFetched( resolvedId, function ( fetched ) {
                if ( fetched ) {
                    inject( row, fetched );
                } else {
                    tries++;
                    if ( tries < maxTries ) setTimeout( attempt, 250 );
                }
            } );
        }
        attempt();

        // Also re-inject if WP later replaces the row's inner HTML.
        var rowObserver = new MutationObserver( function () {
            if ( ! alreadyInjected( row ) ) {
                var rid = ( row.id || "" ).match( /^media-item-(\d+)$/ );
                var realId = rid ? Number( rid[ 1 ] ) : null;
                if ( ! realId ) return;
                var d = readData( realId );
                if ( d ) inject( row, d );
            }
        } );
        rowObserver.observe( row, { childList: true, subtree: true } );
    }

    function scanRoot( root ) {
        var rows = ( root || document ).querySelectorAll( '[id^="media-item-"]' );
        for ( var i = 0; i < rows.length; i++ ) attachRow( rows[ i ] );
    }

    function boot() {
        log( "boot, wp.media available?", !! ( window.wp && window.wp.media ) );
        scanRoot( document );

        var globalObserver = new MutationObserver( function ( mutations ) {
            for ( var i = 0; i < mutations.length; i++ ) {
                var added = mutations[ i ].addedNodes;
                for ( var j = 0; j < added.length; j++ ) {
                    var n = added[ j ];
                    if ( n.nodeType !== 1 ) continue;
                    if ( n.id && /^media-item-/.test( n.id ) ) {
                        attachRow( n );
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
