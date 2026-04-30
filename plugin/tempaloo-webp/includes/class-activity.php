<?php
defined( 'ABSPATH' ) || exit;

/**
 * In-process activity log. Stores a rolling buffer of plugin events in a
 * single WP option so the React admin can render a "what happened, when"
 * timeline without an extra DB table or external service.
 *
 * Capacity: 200 events (oldest dropped on overflow). At ~150 bytes per
 * entry that's ~30 KB max in the option — well under any concern.
 *
 * Event shape:
 *   {
 *     id:      int        // monotonic counter
 *     at:      int        // unix seconds, UTC
 *     type:    string     // 'convert' | 'convert_failed' | 'bulk' | 'license' | 'restore' | 'retry' | 'upload'
 *     level:   string     // 'success' | 'info' | 'warn' | 'error'
 *     message: string
 *     meta:    array      // optional: { attachment_id?, code?, count?, format?, saved_pct? }
 *   }
 */
class Tempaloo_WebP_Activity {

    const OPTION   = 'tempaloo_webp_activity';
    const CAPACITY = 200;

    public static function log( $type, $level, $message, array $meta = [] ) {
        $stored = get_option( self::OPTION );
        $log = is_array( $stored ) && isset( $stored['events'] ) ? $stored : [ 'next_id' => 1, 'events' => [] ];

        $entry = [
            'id'      => (int) $log['next_id'],
            'at'      => time(),
            'type'    => (string) $type,
            'level'   => (string) $level,
            'message' => (string) $message,
            'meta'    => $meta,
        ];

        $log['next_id']++;
        $log['events'][] = $entry;

        // Trim to capacity (drop oldest first)
        $count = count( $log['events'] );
        if ( $count > self::CAPACITY ) {
            $log['events'] = array_slice( $log['events'], $count - self::CAPACITY );
        }

        update_option( self::OPTION, $log, false );
    }

    /**
     * Returns the most recent N events, newest first.
     */
    public static function recent( $limit = 50 ) {
        $stored = get_option( self::OPTION );
        if ( ! is_array( $stored ) || empty( $stored['events'] ) ) {
            return [];
        }
        $events = $stored['events'];
        $events = array_reverse( $events );
        return array_slice( $events, 0, max( 1, (int) $limit ) );
    }

    public static function clear() {
        delete_option( self::OPTION );
    }

    /**
     * Hooks into Tempaloo's own actions/filters so events get logged
     * automatically without each call site having to remember.
     */
    public static function register() {
        add_action( 'tempaloo_webp_after_convert', [ __CLASS__, 'on_convert' ], 10, 2 );
    }

    public static function on_convert( $attachment_id, $info ) {
        if ( empty( $info['converted'] ) ) return;
        $title = get_the_title( $attachment_id );
        self::log(
            'convert',
            'success',
            sprintf(
                /* translators: 1: number of sizes, 2: format, 3: attachment title */
                __( 'Converted %1$d sizes to %2$s · %3$s', 'tempaloo-webp' ),
                (int) $info['converted'],
                strtoupper( (string) $info['format'] ),
                $title ? $title : '#' . (int) $attachment_id
            ),
            [
                'attachment_id' => (int) $attachment_id,
                'format'        => (string) $info['format'],
                'sizes'         => (int) $info['converted'],
                'mode'          => (string) $info['mode'],
            ]
        );
    }
}
