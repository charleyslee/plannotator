import { createContext, useContext, useCallback, type ReactNode } from 'react';

type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface SessionContextValue {
  fetch: FetchFn;
}

const UNSET = Symbol('no-session');

const SessionContext = createContext<SessionContextValue | typeof UNSET>(UNSET);

export function SessionProvider({
  sessionId,
  children,
}: {
  sessionId: string;
  children: ReactNode;
}) {
  const sessionFetch = useCallback<FetchFn>(
    (input, init) => {
      if (typeof input === 'string') {
        if (input === '/api' || input.startsWith('/api/')) {
          return globalThis.fetch(`/s/${sessionId}/api${input.slice(4)}`, init);
        }
      }
      return globalThis.fetch(input, init);
    },
    [sessionId],
  );

  return (
    <SessionContext.Provider value={{ fetch: sessionFetch }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionFetch(): FetchFn {
  const ctx = useContext(SessionContext);
  if (ctx === UNSET) return globalThis.fetch;
  return ctx.fetch;
}
