import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// jsdom lacks matchMedia / IntersectionObserver used by framer-motion and useMediaQuery.
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }),
    });
  }
  if (!('IntersectionObserver' in window)) {
    class IO { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } root = null; rootMargin = ''; thresholds = []; }
    Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: IO });
  }
  if (!('ResizeObserver' in window)) {
    class RO { observe() {} unobserve() {} disconnect() {} }
    Object.defineProperty(window, 'ResizeObserver', { writable: true, value: RO });
  }
  Object.defineProperty(window, 'scrollTo', { writable: true, value: () => {} });
  // Radix Select (AppSelect) uses pointer capture and scrollIntoView, which jsdom does not implement.
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.scrollIntoView) proto.scrollIntoView = () => {};
}
