/**
 * Inline compression stats on the post-upload row of /wp-admin/media-new.php
 * and the Media Library list view.
 *
 * Why this works where the previous versions didn't:
 *
 *   The multi-file uploader on media-new.php gives each row an id of the
 *   form `media-item-{plupload_uid}` (e.g. "media-item-o_1foo123bar") —
 *   NOT `media-item-{wp_attachment_id}`. Earlier releases tried to extract
 *   a numeric WP id from the row id and silently failed.
 *
 *   The real WP attachment id lives INSIDE the row: typically in the Edit
 *   link's `?post=N` query string, sometimes in input names like
 *   `attachments[N][...]`, or on a `data-id` attribute. We sniff all three.
 *
 * Data path: vanilla fetch → admin-ajax.php?action=tempaloo_stats — no
 * dependency on wp.media (which isn't loaded on media-new.php anyway).
 */
( function () {
    var STATS_CLASS = "tempaloo-upload-stats";
    var POLL_DELAY  = 600;
    var MAX_TRIES   = 25;
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
        log( "injected", row.id, data );
    }

    /**
     * Hunt for the WP attachment id inside a row. Returns the integer id
     * or null if nothing usable is found yet (caller will retry on the
     * next row mutation).
     */
    function findAttachmentId( row ) {
        // 1. Direct: data-id on row or any descendant
        var dataIdEl = row.matches && row.matches( "[data-id]" ) ? row : row.querySelector( "[data-id]" );
        if ( dataIdEl ) {
            var d = parseInt( dataIdEl.getAttribute( "data-id" ), 10 );
            if ( d > 0 ) return d;
        }
        // 2. Edit link: <a href="post.php?post=N&action=edit">
        var editLink = row.querySelector( 'a[href*="post.php?post="], a[href*="post="]' );
        if ( editLink ) {
            var m = editLink.getAttribute( "href" ).match( /[?&]post=(\d+)/ );
            if ( m ) return Number( m[ 1 ] );
        }
        // 3. Input names: attachments[N][...] or send[N]
        var inputs = row.querySelectorAll( 'input[name^="attachments["], input[name^="send["]' );
        for ( var i = 0; i < inputs.length; i++ ) {
            var n = inputs[ i ].getAttribute( "name" );
            var im = n && n.match( /\[(\d+)\]/ );
            if ( im ) return Number( im[ 1 ] );
        }
        // 4. Plupload id swap: WP sometimes rewrites id="media-item-N" once
        // the upload finishes (older flow). Last resort.
        var rm = ( row.id || "" ).match( /^media-item-(\d+)$/ );
        if ( rm ) return Number( rm[ 1 ] );

        return null;
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

        function attempt() {
            if ( alreadyInjected( row ) ) return;
            var id = findAttachmentId( row );
            if ( ! id ) {
                tries++;
                if ( tries < MAX_TRIES ) setTimeout( attempt, POLL_DELAY );
                else log( "no attachment id resolved", row.id );
                return;
            }
            log( "resolved id", row.id, "→", id );
            fetchStats( id ).then( function ( j ) {
                if ( j && j.success && j.data && j.data.ready ) {
                    inject( row, j.data );
                } else {
                    tries++;
                    if ( tries < MAX_TRIES ) setTimeout( attempt, POLL_DELAY );
                    else log( "gave up — conversion never ready for", id );
                }
            } ).catch( function ( e ) {
                log( "fetch error", e );
                tries++;
                if ( tries < MAX_TRIES ) setTimeout( attempt, POLL_DELAY * 2 );
            } );
        }
        attempt();

        var rowObserver = new MutationObserver( function () {
            if ( ! alreadyInjected( row ) ) attempt();
        } );
        rowObserver.observe( row, { childList: true, subtree: true, attributes: true } );
    }

    function scanRoot( root ) {
        // Multi-file uploader rows AND legacy/new structures.
        var rows = ( root || document ).querySelectorAll(
            '[id^="media-item-"], .upload-attachment, .media-item'
        );
        for ( var i = 0; i < rows.length; i++ ) watchRow( rows[ i ] );
    }

    function boot() {
        log( "boot ok, ajaxUrl=" + BOOT.ajaxUrl );
        scanRoot( document );
        var globalObserver = new MutationObserver( function ( mutations ) {
            for ( var i = 0; i < mutations.length; i++ ) {
                var added = mutations[ i ].addedNodes;
                for ( var j = 0; j < added.length; j++ ) {
                    var n = added[ j ];
                    if ( n.nodeType !== 1 ) continue;
                    if ( ( n.id && /^media-item-/.test( n.id ) ) || ( n.classList && ( n.classList.contains( "upload-attachment" ) || n.classList.contains( "media-item" ) ) ) ) {
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
