/**
 * Inline compression stats on the post-upload row of /wp-admin/media-new.php
 * and the Media Library list view.
 *
 * The data lands in `wp.media.attachment(id)` already (we set it server-side
 * via wp_prepare_attachment_for_js → response.tempaloo). All this script
 * does is pick the row by its `media-item-{id}` DOM id and inject a small
 * stats line next to the filename.
 */
( function () {
    var STATS_ATTR = "data-tempaloo-stats";

    function formatBytes( n ) {
        if ( ! n || n < 0 ) return "0 B";
        var units = [ "B", "KB", "MB", "GB" ];
        var i = Math.min( units.length - 1, Math.floor( Math.log( n ) / Math.log( 1024 ) ) );
        return ( n / Math.pow( 1024, i ) ).toFixed( i === 0 ? 0 : 1 ) + " " + units[ i ];
    }

    function render( t ) {
        // One element, inline, BEM-ish class so we can style + dedupe.
        var html =
            '<div class="tempaloo-upload-stats" style="margin-top:6px;display:inline-flex;align-items:center;gap:8px;font-size:12px;line-height:1.4;">' +
              '<span style="display:inline-flex;align-items:center;padding:2px 7px;border-radius:4px;background:#dcfce7;color:#166534;font-weight:600;font-size:11px;">' +
                "✓ " + ( t.format || "WebP" ) +
              "</span>" +
              '<span style="color:#166534;font-weight:600;">−' + ( t.savedPct || 0 ) + "%</span>" +
              '<span style="color:#555;">' + formatBytes( t.bytesIn ) + " → " + formatBytes( t.bytesOut ) +
              ( t.sizes ? ' · <span style="color:#888;">' + t.sizes + " sizes</span>" : "" ) +
              "</span>" +
            "</div>";
        var wrap = document.createElement( "div" );
        wrap.innerHTML = html;
        return wrap.firstChild;
    }

    function injectFromAttachment( id, row ) {
        if ( ! id || ! row ) return;
        if ( row.getAttribute( STATS_ATTR ) ) return;
        if ( ! window.wp || ! window.wp.media || ! window.wp.media.attachment ) return;

        var att = window.wp.media.attachment( id );
        if ( ! att ) return;

        // The model may not have been fetched yet — when it's still loading,
        // the `tempaloo` property is undefined. Fetch + retry once.
        var data = att.get( "tempaloo" );
        if ( ! data ) {
            if ( typeof att.fetch === "function" ) {
                att.fetch().done( function () {
                    var refreshed = att.get( "tempaloo" );
                    if ( refreshed ) {
                        row.setAttribute( STATS_ATTR, "1" );
                        var node = render( refreshed );
                        appendInto( row, node );
                    }
                } );
            }
            return;
        }
        row.setAttribute( STATS_ATTR, "1" );
        appendInto( row, render( data ) );
    }

    function appendInto( row, node ) {
        // Prefer placing the stats line under the filename / "Edit · Copy URL"
        // cluster. Falls back to appending to the row if WP changes its
        // markup down the road.
        var anchor =
            row.querySelector( ".filename" ) ||
            row.querySelector( ".uploaded" ) ||
            row.querySelector( ".attachment-info" ) ||
            row.querySelector( ".thumbnail + *" ) ||
            row;
        if ( anchor.nextSibling && anchor !== row ) {
            anchor.parentNode.insertBefore( node, anchor.nextSibling );
        } else {
            anchor.appendChild ? anchor.appendChild( node ) : row.appendChild( node );
        }
    }

    function scanRow( row ) {
        if ( ! row || row.nodeType !== 1 ) return;
        var idAttr = row.id || "";
        var match = idAttr.match( /^media-item-(\d+)$/ );
        var id = match ? Number( match[ 1 ] ) : ( row.getAttribute( "data-id" ) ? Number( row.getAttribute( "data-id" ) ) : null );
        if ( id ) injectFromAttachment( id, row );
    }

    function scanAll( root ) {
        var rows = ( root || document ).querySelectorAll( '[id^="media-item-"]' );
        for ( var i = 0; i < rows.length; i++ ) scanRow( rows[ i ] );
    }

    function boot() {
        scanAll( document );
        var observer = new MutationObserver( function ( mutations ) {
            for ( var i = 0; i < mutations.length; i++ ) {
                var added = mutations[ i ].addedNodes;
                for ( var j = 0; j < added.length; j++ ) {
                    var n = added[ j ];
                    if ( n.nodeType !== 1 ) continue;
                    if ( n.id && /^media-item-\d+$/.test( n.id ) ) {
                        scanRow( n );
                    } else {
                        scanAll( n );
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
