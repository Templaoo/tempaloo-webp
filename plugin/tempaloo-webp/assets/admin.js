( function () {
    if ( typeof TempalooWebP === "undefined" ) return;

    var $ = function ( id ) { return document.getElementById( id ); };
    var scanBtn   = $( "tempaloo-bulk-scan" );
    var startBtn  = $( "tempaloo-bulk-start" );
    var cancelBtn = $( "tempaloo-bulk-cancel" );
    var statusEl  = $( "tempaloo-bulk-status" );
    var barEl     = $( "tempaloo-bulk-bar" );
    var errorsEl  = $( "tempaloo-bulk-errors" );

    if ( ! scanBtn || ! startBtn || ! cancelBtn ) return;

    var running = false;

    function api( action, extra ) {
        var body = new URLSearchParams();
        body.append( "action", "tempaloo_webp_" + action );
        body.append( "nonce", TempalooWebP.nonce );
        if ( extra ) {
            Object.keys( extra ).forEach( function ( k ) { body.append( k, extra[ k ] ); } );
        }
        return fetch( TempalooWebP.ajaxUrl, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        } ).then( function ( r ) { return r.json(); } );
    }

    function setStatus( text ) { statusEl.textContent = text; }

    function setProgress( processed, total ) {
        var pct = total > 0 ? Math.min( 100, Math.round( ( processed / total ) * 100 ) ) : 0;
        barEl.style.width = pct + "%";
        barEl.textContent = pct + "%";
    }

    function renderErrors( errors ) {
        errorsEl.innerHTML = "";
        ( errors || [] ).forEach( function ( e ) {
            var li = document.createElement( "li" );
            li.textContent = "#" + e.id + " — " + e.code + ": " + e.message;
            errorsEl.appendChild( li );
        } );
    }

    function lockButtons( isRunning ) {
        running = isRunning;
        scanBtn.disabled   = isRunning;
        startBtn.disabled  = isRunning || startBtn.dataset.pending === "0";
        cancelBtn.disabled = ! isRunning;
    }

    scanBtn.addEventListener( "click", function () {
        setStatus( TempalooWebP.i18n.scanning );
        api( "bulk_scan" ).then( function ( res ) {
            if ( ! res.success ) { setStatus( "Error" ); return; }
            var n = res.data.pending;
            startBtn.dataset.pending = String( n );
            startBtn.disabled = n === 0;
            setStatus( n === 0 ? TempalooWebP.i18n.no_pending : ( n + " images pending" ) );
        } );
    } );

    cancelBtn.addEventListener( "click", function () {
        api( "bulk_cancel" ).then( function () {
            lockButtons( false );
            setStatus( TempalooWebP.i18n.canceled );
        } );
    } );

    function loop() {
        if ( ! running ) return;
        api( "bulk_tick" ).then( function ( res ) {
            if ( ! res.success ) { setStatus( "Error — stopped" ); lockButtons( false ); return; }
            var d = res.data;
            setProgress( d.processed, d.total );
            renderErrors( d.errors );
            if ( d.status === "running" ) {
                setStatus( d.processed + " / " + d.total );
                setTimeout( loop, 350 );
            } else if ( d.status === "paused_quota" ) {
                setStatus( TempalooWebP.i18n.quota_paused );
                lockButtons( false );
            } else if ( d.status === "done" ) {
                setStatus( TempalooWebP.i18n.done + " " + d.succeeded + " converted, " + d.failed + " failed." );
                lockButtons( false );
            } else {
                setStatus( d.status );
                lockButtons( false );
            }
        } );
    }

    startBtn.addEventListener( "click", function () {
        setStatus( TempalooWebP.i18n.starting );
        api( "bulk_start" ).then( function ( res ) {
            if ( ! res.success ) {
                setStatus( res.data && res.data.message ? res.data.message : "Error" );
                return;
            }
            lockButtons( true );
            setProgress( 0, res.data.total );
            setStatus( TempalooWebP.i18n.processing );
            loop();
        } );
    } );
} )();
