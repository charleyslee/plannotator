# Performance Findings — Multi-Session Frontend

Comprehensive sweep of performance killers in the multi-session keep-alive architecture. The app feels generally slow with 3+ sessions open — not during specific actions, but across all interactions including settings, theme changes, and basic navigation.

## Critical Findings

### 1. SessionSurface is not memoized

`apps/frontend/src/components/sessions/SessionSurface.tsx` is a plain function component with no `React.memo` wrapper. It's rendered inside `Layout.tsx`'s `Object.values(visitedSessions).map(...)`.

Every time Layout re-renders — sidebar toggle, session switch, dialog open/close, `addProjectOpen` changing — React walks the ENTIRE component tree of EVERY mounted session. Layout re-renders frequently because it subscribes to `activeSessionId`, `visitedSessions`, `addProjectOpen`, and `useSidebar()` (context).

With 3 sessions mounted: every sidebar toggle triggers 3 full code-review tree reconciliations. This is the single largest contributor to general sluggishness.

### 2. DOM weight with visibility:hidden

Each code review session produces 20,000–40,000 DOM nodes (header, file tree, dockview, Pierre diffs, sidebar, modals). Pierre diffs mount lazily but never unmount — `LazyFileDiff` sets `mounted = true` but never resets to `false`. Once a user scrolls through 50 files, all 50 diff trees stay in the DOM permanently.

With 3 sessions: 60,000–120,000 nodes in the layout tree.

`visibility: hidden` hides pixels but the browser still computes layout for every hidden node on every style recalculation. The global `* { transition-property: ... }` rule in `theme.css` forces CSS selector matching against all 100k+ nodes on every style invalidation, even though `transition-duration: 0s` is applied to hidden subtrees.

`content-visibility: hidden` would tell the browser to skip layout AND style recalculation entirely on hidden subtrees. Currently not used.

### 3. configStore broadcasts to all subscribers

`packages/ui/config/configStore.ts` — the `notify()` method calls every listener in `Set<Listener>` on ANY setting change. With 14 `useConfigValue` calls per code review session × 3 sessions = 42 synchronous `getSnapshot` invocations per single setting change. Even when values haven't changed, React must run each snapshot function to verify.

`configStore.init()` is worse — it overwrites all server-synced keys and calls `notify()` once, triggering all 42 subscribers to check all their values.

### 4. ThemeProvider is a React context shared across all sessions

`packages/ui/components/ThemeProvider.tsx` wraps the entire app. When theme changes, every `useTheme()` consumer in every mounted session re-renders. Per code review session: `usePierreTheme`, `DiffHunkPreview`, `ReviewHeaderMenu` — at minimum 3 components × N sessions.

## High-Impact Findings

### 5. ToolbarHost registers global mousemove with no visibility guard

`packages/plannotator-code-review/components/ToolbarHost.tsx` line 92: `window.addEventListener('mousemove', handleMouseMove)` — fires on every mouse movement for every mounted session. The handler only writes to a ref (no re-render), but it's N function calls per mouse pixel across all sessions.

### 6. ScrollFade double setState on every scroll tick

`packages/plannotator-code-review/components/ScrollFade.tsx` calls `setShowTop` and `setShowBottom` on its scroll handler with no equality guard. Every scroll event triggers 2 state updates and a re-render of the file tree panel.

### 7. FileHeader has a ResizeObserver per file

`packages/plannotator-code-review/components/FileHeader.tsx` line 71 — each file header creates its own `ResizeObserver` that calls `setHeaderWidth`. During window resize, N observers fire N `setState` calls simultaneously across all files in all sessions. No quantization.

### 8. ReviewSidebar has React.memo explicitly commented out

`packages/plannotator-code-review/components/ReviewSidebar.tsx` line 108 — `/* React.memo */` is commented out. ReviewSidebar is a child of the 2500-line App.tsx. Every one of App's 57 `useState` changes triggers a ReviewSidebar reconciliation, including scroll-driven state updates.

### 9. Pierre diffs never unmount

`packages/plannotator-code-review/components/LazyFileDiff.tsx` — `mounted` state is only ever set to `true`, never back to `false`. `AllFilesDiffView` has no cleanup path. Once a file diff is mounted by `IntersectionObserver`, it stays in the DOM permanently. Node count is monotonically increasing per session throughout its lifetime.

### 10. Sessions are never evicted from visitedSessions

`apps/frontend/src/stores/app-store.ts` — `removeSession` is defined but never called anywhere in the codebase. Sessions only accumulate. A user who opens 10 sessions over a working day has 10 full React trees mounted with ~200,000+ DOM nodes.

## Medium-Impact Findings

### 11. allFilesVisibleFile scroll handler re-renders entire App

`packages/plannotator-code-review/App.tsx` line 1425 — `setAllFilesVisibleFile` is called from `AllFilesDiffView`'s scroll handler on file-boundary crossings. Each call re-renders the entire 2500-line App component.

### 12. splitRatio setState on every pointer move during drag

`packages/plannotator-code-review/components/DiffViewer.tsx` — `setSplitRatio` fires on every `pointermove` while dragging the split handle. DiffViewer is not wrapped in `React.memo`.

### 13. useActiveSection fires quad-threshold IntersectionObserver

`packages/ui/hooks/useActiveSection.ts` — configured with `threshold: [0, 0.1, 0.5, 1.0]`. Each heading fires up to 4 callbacks per scroll crossing, each calling `setActiveId` with no equality guard.

### 14. Hidden session document.title mutation

`packages/plannotator-code-review/App.tsx` line 225 — `useEffect` sets `document.title` on `repoInfo` change with no visibility guard. A hidden session can overwrite the visible session's title.

### 15. CSS custom property mutation from hidden sessions

`packages/plannotator-code-review/App.tsx` line 170 — sets `document.documentElement.style.setProperty('--diffs-font-family', ...)` when config changes. All sessions write to the same document element. No visibility guard. Last writer wins.

## What's NOT Causing It

- **Polling/transport hooks** — WebSocket is connected, no timers running when idle
- **Keyboard handlers** — already guarded with `isVisible()`, microsecond no-ops per keystroke
- **requestAnimationFrame loops** — none exist, all one-shot
- **Agent job processing** — only fires when jobs are actually running
