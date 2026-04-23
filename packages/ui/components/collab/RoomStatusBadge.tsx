import React from 'react';
import type { ConnectionStatus } from '@plannotator/shared/collab/client';

/**
 * Pure status-pill for the live room. Renders a single label based on
 * connection health. Terminal states (room gone) no longer have a badge —
 * the caller transitions to `RoomUnavailableScreen` instead. No side
 * effects; identity driven entirely by props so memoization is trivial.
 *
 * Labels: reconnecting / connecting / offline / Live (default when
 * authenticated).
 */

export interface RoomStatusBadgeProps {
  connectionStatus: ConnectionStatus;
  className?: string;
}

interface Variant {
  label: string;
  dotClass: string;
  /** Bg/text utility class bundle for the pill itself. */
  pillClass: string;
}

function deriveVariant(connectionStatus: ConnectionStatus): Variant {
  if (connectionStatus === 'reconnecting') {
    return { label: 'Reconnecting', dotClass: 'bg-warning animate-pulse', pillClass: 'bg-warning/10 text-warning' };
  }
  if (connectionStatus === 'connecting' || connectionStatus === 'authenticating') {
    return { label: 'Connecting', dotClass: 'bg-primary animate-pulse', pillClass: 'bg-primary/10 text-primary' };
  }
  if (connectionStatus === 'disconnected' || connectionStatus === 'closed') {
    return { label: 'Offline', dotClass: 'bg-muted-foreground', pillClass: 'bg-muted text-muted-foreground' };
  }
  return { label: 'Live', dotClass: 'bg-success', pillClass: 'bg-success/10 text-success' };
}

export function RoomStatusBadge({
  connectionStatus,
  className = '',
}: RoomStatusBadgeProps): React.ReactElement {
  const variant = deriveVariant(connectionStatus);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${variant.pillClass} ${className}`}
      aria-live="polite"
      data-testid="room-status-badge"
      data-status-label={variant.label}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${variant.dotClass}`} aria-hidden />
      {variant.label}
    </span>
  );
}
