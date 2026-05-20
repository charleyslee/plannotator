# Performance Findings — Multi-Session Frontend

Comprehensive sweep of performance killers in the multi-session keep-alive architecture. The app feels generally slow with 3+ sessions open — not during specific actions, but during normal use: scrolling, clicking files, hovering, navigating.

## Tier 1 — Causes general sluggishness during normal use

### 1. SessionSurface is not memoized

`apps/frontend/src/components/sessions/SessionSurface.tsx` is a plain function component with no `React.memo` wrapper. It's rendered inside `Layout.tsx`'s `Object.values(visitedSessions).map(...)`.

Every time Layout re-renders — sidebar toggle, session switch, dialog open/close, `addProjectOpen` changing — React walks the ENTIRE component tree of EVERY mounted session. Layout re-renders frequently because it subscribes to `activeSessionId`, `visitedSessions`, `addProjectOpen`, and `useSidebar()` (context).

With 3 sessions mounted: every sidebar toggle triggers 3 full code-review tree reconciliations.

### 2. DOM weight with visibility:hidden

Each code review session produces 20,000–40,000 DOM nodes (header, file tree, dockview, Pierre diffs, sidebar, modals). Pierre diffs mount lazily but never unmount — `LazyFileDiff` sets `mounted = true` but never resets to `false`. Once a user scrolls through 50 files, all 50 diff trees stay in the DOM permanently.

With 3 sessions: 60,000–120,000 nodes in the layout tree.

`visibility: hidden` hides pixels but the browser still computes layout for every hidden node on every style recalculation. The global `* { transition-property: ... }` rule in `theme.css` forces CSS selector matching against all 100k+ nodes on every style invalidation, even though `transition-duration: 0s` is applied to hidden subtrees.

`content-visibility: hidden` would tell the browser to skip layout AND style recalculation entirely on hidden subtrees. Currently not used.

### 3. 57 useState in App.tsx — the monolith re-renders on every interaction

`packages/plannotator-code-review/App.tsx` has 57 `useState` calls. ANY state change re-renders the entire 2500-line component. This includes:
- `allFilesVisibleFile` — set on file-boundary crossings while scrolling diffs (line 1425)
- `splitRatio` — set on every pointer pixel during split handle drag
- `isAllFilesActive` / `isDiffPanelActive` — set on every dockview panel focus change

Every one of these state changes cascades to the unmemoized `ReviewSidebar` and all other children.

### 4. ReviewSidebar has React.memo explicitly commented out

`packages/plannotator-code-review/components/ReviewSidebar.tsx` line 108 — `/* React.memo */` is commented out. ReviewSidebar is a child of the 2500-line App.tsx. Every one of App's 57 state changes triggers a ReviewSidebar reconciliation.

### 5. Sessions are never evicted from visitedSessions

`apps/frontend/src/stores/app-store.ts` — `removeSession` is defined but never called anywhere in the codebase. Sessions only accumulate. A user who opens 10 sessions over a working day has 10 full React trees mounted with ~200,000+ DOM nodes.

## Tier 2 — Cross-session interference (hidden sessions degrading active session)

### 6. StickyHeaderLane uses unscoped document.querySelector

`packages/ui/components/StickyHeaderLane.tsx` line 148 — queries `document.querySelector('[data-sticky-actions]')` with no container scoping. With 3 sessions, each StickyHeaderLane finds the FIRST matching element in the document — which belongs to a DIFFERENT session. It then attaches a ResizeObserver to that foreign element. Hidden sessions observe the active session's DOM nodes, firing N-1 extra ResizeObserver callbacks on every layout change.

### 7. CSS custom property stomping from hidden sessions

`packages/plannotator-code-review/App.tsx` line 170 — sets `document.documentElement.style.setProperty('--diffs-font-family', ...)` etc. when config changes. All sessions write to the same `:root` element. Each `setProperty` invalidates every CSS rule referencing those variables — full global style recalculation across the entire 60k-120k node document.

### 8. ThemeProvider race on document.documentElement.classList

`packages/ui/components/ThemeProvider.tsx` lines 44-57 — every session mounts its own ThemeProvider that strips and re-adds `theme-*` classes on `document.documentElement`. Three ThemeProviders racing to control the document class list. Each write triggers a full-document style recalculation.

### 9. Hidden session paste handlers eat clipboard events

`packages/editor/App.tsx` line 930 — unguarded `document.addEventListener('paste')` in every session. Hidden sessions call `e.preventDefault()` on image pastes, which suppresses the paste from reaching the active session. User's paste gets silently eaten.

### 10. PlanCleanDiffView uses unscoped querySelector + scrollIntoView

`packages/ui/components/plan-diff/PlanCleanDiffView.tsx` lines 103-107 — `document.querySelector('[data-diff-block-index]')` finds elements from ANY session. A hidden session's annotation event can add highlight classes and call `scrollIntoView` on the ACTIVE session's DOM — causing phantom scroll jumps.

### 11. TableOfContents uses unscoped querySelector

`packages/ui/components/TableOfContents.tsx` line 175 — `document.querySelector('[data-block-id="..."]')` finds the first matching element globally. Hidden session TOC clicks scroll the active session's content.

### 12. Hidden session document.title mutation

`packages/plannotator-code-review/App.tsx` line 225 — `useEffect` sets `document.title` on `repoInfo` change with no visibility guard. Hidden sessions overwrite the visible session's title.

### 13. useAnnotationHighlighter capture-phase mouseup in every session

`packages/ui/hooks/useAnnotationHighlighter.ts` line 99 — `document.addEventListener('mouseup', track, true)` with capture phase. All sessions register. Every click fires N capture-phase callbacks. Low per-call cost but adds up.

## Tier 3 — Component-level inefficiencies (within a single session)

### 14. ScrollFade double setState on every scroll tick

`packages/plannotator-code-review/components/ScrollFade.tsx` — calls `setShowTop` and `setShowBottom` on its scroll handler with no equality guard. Every scroll event triggers 2 state updates, re-rendering the file tree panel ~60 times per second while scrolling.

### 15. FileHeader ResizeObserver per file

`packages/plannotator-code-review/components/FileHeader.tsx` line 71 — each file header creates its own `ResizeObserver` that calls `setHeaderWidth`. During window resize, N observers fire N `setState` calls simultaneously. No quantization.

### 16. Pierre diffs never unmount

`packages/plannotator-code-review/components/LazyFileDiff.tsx` — `mounted` state is only ever set to `true`, never back to `false`. Once a file diff is mounted by IntersectionObserver, it stays in the DOM permanently. Node count is monotonically increasing per session throughout its lifetime.

### 17. allFilesVisibleFile scroll handler re-renders entire App

`packages/plannotator-code-review/App.tsx` line 1425 — `setAllFilesVisibleFile` called from scroll handler on file-boundary crossings. Each call re-renders the entire 2500-line App component.

### 18. splitRatio setState on every pointer move

`packages/plannotator-code-review/components/DiffViewer.tsx` — `setSplitRatio` fires on every `pointermove` while dragging the split handle. DiffViewer is not wrapped in `React.memo`.

### 19. AllFilesDiffView: getBoundingClientRect loop on every scroll tick

`packages/plannotator-code-review/components/AllFilesDiffView.tsx` lines 203-226 — the scroll handler loops through ALL expanded files calling `header.getBoundingClientRect()` on each one, synchronously, on every scroll event. With 50 files expanded, that's 50 forced layout reads per scroll tick. Each `getBoundingClientRect()` forces the browser to flush pending layout. This is layout thrashing — reading layout, potentially writing, reading again — at 60fps scroll rate.

### 20. reviewStateValue context invalidates on every line click

`packages/plannotator-code-review/App.tsx` line 1371 — `pendingSelection` is in the `reviewStateValue` useMemo dependency array. `pendingSelection` changes on every diff line click. Since `reviewStateValue` is the `ReviewStateContext.Provider` value, every line click invalidates the context and re-renders ALL dock panels (all-files, code-nav, PR comments, agents) — even panels that don't use `pendingSelection`.

### 21. getComputedStyle called 4-5 times per keypress across sessions

`packages/plannotator-code-review/App.tsx` lines 645, 712, 1085, 1688, 1721 — `isVisible()` calls `getComputedStyle(rootRef.current).visibility` as a guard. Each `getComputedStyle()` forces synchronous style recalculation. With 3 sessions × 4 handlers = 12 forced style recalcs per keystroke. Especially bad when typing in annotation inputs.

### 22. useActiveSection quad-threshold IntersectionObserver

`packages/ui/hooks/useActiveSection.ts` — configured with `threshold: [0, 0.1, 0.5, 1.0]`. Each heading fires up to 4 callbacks per scroll crossing, each calling `setActiveId` with no equality guard.

### 23. ToolbarHost global mousemove

`packages/plannotator-code-review/components/ToolbarHost.tsx` line 92 — `window.addEventListener('mousemove', handleMouseMove)` with no visibility guard. Every mouse movement fires a callback in every mounted session. Handler only writes to a ref (no re-render), but N function calls per mouse move.

## Tier 4 — Fires intermittently (settings/theme changes only)

### 24. configStore broadcasts to all subscribers

`packages/ui/config/configStore.ts` — `notify()` calls every listener on ANY setting change. 14 `useConfigValue` calls per session × N sessions. Only fires when user changes a setting — not during normal use.

### 25. ThemeProvider context re-renders all useTheme consumers

Only fires on theme change. Per session: `usePierreTheme`, `DiffHunkPreview`, `ReviewHeaderMenu` — 3 components × N sessions.

## What's NOT Causing It

- **Polling/transport hooks** — WebSocket is connected, no timers running when idle
- **Keyboard handlers** — already guarded with `isVisible()`, microsecond no-ops per keystroke
- **requestAnimationFrame loops** — none exist, all one-shot
- **Agent job processing** — only fires when jobs are actually running
