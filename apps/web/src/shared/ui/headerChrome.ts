import { createContext, useContext, useEffect } from 'react';

/** Lets a page (the editorial home hero) ask the sticky header to float transparently over it until the user scrolls. */
export interface HeaderChromeState { overlay: boolean; setOverlay: (v: boolean) => void }
export const HeaderChromeContext = createContext<HeaderChromeState>({ overlay: false, setOverlay: () => {} });

export function useHeaderChrome(): HeaderChromeState { return useContext(HeaderChromeContext); }

/** Call from a hero that starts at the very top of the page: header overlays it while mounted. */
export function useHeaderOverlay(): void {
  const { setOverlay } = useHeaderChrome();
  useEffect(() => { setOverlay(true); return () => setOverlay(false); }, [setOverlay]);
}
