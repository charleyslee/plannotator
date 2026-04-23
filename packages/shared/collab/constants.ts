/** Plannotator Live Rooms protocol constants. */

/** Room secret is a 256-bit raw byte value. */
export const ROOM_SECRET_LENGTH_BYTES = 32;

/** Admin secret is a 256-bit raw byte value. Distinct symbol from the room
 * secret so the intent at each call site is explicit (even though the V1
 * protocol uses the same length for both). */
export const ADMIN_SECRET_LENGTH_BYTES = 32;

/**
 * WebSocket close code the server uses when the room is no longer available
 * (deleted by admin, auto-expired at the 30-day mark, or never existed in
 * the first place). Client code treats this as a terminal close and surfaces
 * the same "link doesn't resolve" screen for all three cases — the server
 * does not distinguish them to the client.
 */
export const WS_CLOSE_ROOM_UNAVAILABLE = 4006;

/**
 * Close reason string paired with WS_CLOSE_ROOM_UNAVAILABLE for every
 * terminal close path (admin delete, auto-expiry, unknown-room connect).
 * The server logs the specific trigger internally; the client sees only
 * this one reason.
 */
export const WS_CLOSE_REASON_ROOM_UNAVAILABLE = 'Room unavailable';

/**
 * Admin-scoped error codes — the contract between server emit sites (in
 * `apps/room-service/core/room-do.ts` admin handlers) and client handling
 * (in `packages/shared/collab/client-runtime/client.ts` pending-admin
 * rejection path).
 *
 * The server MUST emit admin-command errors only with codes from this
 * namespace, and the client treats receipt of any of these while an
 * admin command is pending as a rejection of that command (vs. ignoring
 * event-channel errors like `validation_error` /
 * `event_persist_failed` that are not part of the admin contract).
 *
 * Adding a new admin error code:
 *   1. Add a key here.
 *   2. Emit it server-side via `sendAdminError`.
 *   3. `ADMIN_ERROR_CODES` and the runtime Set derive from this object
 *      automatically; the client's contract test (see
 *      `client-runtime/client.test.ts`) iterates the tuple and asserts
 *      every code rejects a pending admin promise, so new entries are
 *      enforced end-to-end.
 */
export const AdminErrorCode = {
  ValidationError: 'admin_validation_error',
  ClientIdMismatch: 'client_id_mismatch',
  NoAdminChallenge: 'no_admin_challenge',
  UnknownAdminChallenge: 'unknown_admin_challenge',
  AdminChallengeExpired: 'admin_challenge_expired',
  InvalidAdminProof: 'invalid_admin_proof',
  DeleteFailed: 'delete_failed',
} as const;

export type AdminErrorCode = typeof AdminErrorCode[keyof typeof AdminErrorCode];

export const ADMIN_ERROR_CODES: readonly AdminErrorCode[] =
  Object.values(AdminErrorCode);
