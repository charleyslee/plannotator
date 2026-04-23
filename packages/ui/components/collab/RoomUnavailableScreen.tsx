import React from 'react';

/**
 * Terminal screen shown when a room URL no longer resolves. Covers every
 * "link doesn't work" case: admin-initiated delete, auto-expiry at the
 * 30-day mark, or a request against a room that never existed / has
 * already been purged. The server does not surface the cause to the
 * client; the user experience is the same for all three.
 *
 * Minimal on purpose — this is the web-standard "gone resource" UX,
 * not a branded "session has ended" memorial.
 */
export function RoomUnavailableScreen(): React.ReactElement {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-background"
      data-testid="room-unavailable-screen"
    >
      <div className="text-center space-y-2 max-w-sm">
        <h2 className="text-lg font-semibold">This link doesn't go anywhere</h2>
        <p className="text-sm text-muted-foreground">Ask for a new one.</p>
      </div>
    </div>
  );
}
