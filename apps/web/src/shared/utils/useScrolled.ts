import { useEffect, useState } from 'react';

/** True once the window is scrolled past `threshold` px (passive listener; false on the server / in jsdom until scrolled). */
export function useScrolled(threshold = 8): boolean {
  const read = () => typeof window !== 'undefined' && window.scrollY > threshold;
  const [scrolled, setScrolled] = useState<boolean>(read);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}
