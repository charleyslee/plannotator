import React from 'react';
import type { ConnectionStatus } from '@plannotator/shared/collab/client';
import type { PresenceState } from '@plannotator/shared/collab';
import { RoomStatusBadge } from './RoomStatusBadge';
import { ParticipantAvatars } from './ParticipantAvatars';
import { RoomMenu } from './RoomMenu';
import type { AdminAction } from '../../hooks/collab/useRoomAdminActions';

/**
 * Compact header cluster that replaces the floating RoomPanel.
 * Renders inline in the editor header next to the existing PlanHeaderMenu
 * whenever the editor is in room mode.
 *
 * Layout (left → right):
 *   [conditional status pill] [peer avatars] [Room actions ▾]
 *
 * The status pill is only shown when the connection isn't authenticated
 * (reconnecting / connecting / offline). A healthy "Live" connection
 * shows nothing here, keeping the header quiet on the common case.
 * Terminal states (room gone) don't appear here — the caller swaps to
 * `RoomUnavailableScreen` instead of rendering the header at all.
 *
 * All mutations (delete, link copy, feedback copy) are owned by
 * the caller. This component is a pure surface.
 */

export interface RoomHeaderControlsProps {
  connectionStatus: ConnectionStatus;
  remotePresence: Record<string, PresenceState>;
  isAdmin: boolean;
  adminUrl?: string;
  pendingAdminAction?: AdminAction;
  onCopyParticipantUrl(): void;
  onCopyAdminUrl(): void;
  onCopyConsolidatedFeedback(): void;
  onCopyAgentInstructions(): void;
  onDelete(): void;
  className?: string;
}

export function RoomHeaderControls({
  connectionStatus,
  remotePresence,
  isAdmin,
  adminUrl,
  pendingAdminAction,
  onCopyParticipantUrl,
  onCopyAdminUrl,
  onCopyConsolidatedFeedback,
  onCopyAgentInstructions,
  onDelete,
  className = '',
}: RoomHeaderControlsProps): React.ReactElement {
  const showStatus = connectionStatus !== 'authenticated';
  const hasPeers = Object.keys(remotePresence).length > 0;

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      data-testid="room-header-controls"
    >
      {showStatus && (
        <RoomStatusBadge connectionStatus={connectionStatus} />
      )}
      {hasPeers && (
        <ParticipantAvatars remotePresence={remotePresence} />
      )}
      <RoomMenu
        isAdmin={isAdmin}
        adminUrl={adminUrl}
        pendingAdminAction={pendingAdminAction}
        onCopyParticipantUrl={onCopyParticipantUrl}
        onCopyAdminUrl={onCopyAdminUrl}
        onCopyConsolidatedFeedback={onCopyConsolidatedFeedback}
        onCopyAgentInstructions={onCopyAgentInstructions}
        onDelete={onDelete}
      />
    </div>
  );
}
