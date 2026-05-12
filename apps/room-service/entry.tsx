/**
 * Browser entry for room.plannotator.ai.
 *
 * Two surfaces share this bundle:
 *   - `/`           → LandingPage (upload a document, create a room)
 *   - `/c/:roomId`  → AppRoot (room editor via useRoomMode)
 *
 * Both branches are lazy-loaded so neither pays for the other's code.
 * Landing visitors (~10 KB) never download the editor bundle (~4 MB),
 * and room visitors never download the landing page chunk.
 *
 * TanStack Router is intentionally deferred until room-service has 3-4+
 * real routes with data/loading needs.
 */

import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@plannotator/ui/components/ThemeProvider';
// @ts-expect-error — Vite resolves CSS side-effect imports at build time;
// there is no .d.ts for the index.css file and adding one would not match
// the existing apps/hook pattern. TypeScript doesn't need to analyze it.
import '@plannotator/editor/styles';

const LandingPage = lazy(() =>
  import('@plannotator/ui/components/collab/LandingPage').then(m => ({ default: m.LandingPage })),
);

const AppRoot = lazy(() =>
  import('@plannotator/editor').then(m => ({ default: m.default })),
);

function RoomServiceEntry(): React.ReactElement {
  const pathname = window.location.pathname;

  if (pathname === '/') {
    return (
      <ThemeProvider defaultTheme="dark">
        <Suspense fallback={
          <div className="min-h-screen bg-background flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        }>
          <LandingPage />
        </Suspense>
      </ThemeProvider>
    );
  }

  return (
    <Suspense fallback={null}>
      <AppRoot />
    </Suspense>
  );
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('Plannotator entry: #root element missing from index.html');
}
createRoot(root).render(
  <React.StrictMode>
    <RoomServiceEntry />
  </React.StrictMode>,
);
