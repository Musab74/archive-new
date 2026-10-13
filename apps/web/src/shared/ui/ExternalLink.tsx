import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { common } from '../strings/ko';

export interface ExternalLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> { href: string; children: ReactNode; mark?: boolean }

/** Anchor that opens in a new tab with rel=noopener noreferrer and a ↗ mark + screen-reader note. */
export function ExternalLink({ href, children, mark = true, ...rest }: ExternalLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
      {mark ? <> <span aria-hidden="true">↗</span></> : null}
      <span className="sr-only"> ({common.external})</span>
    </a>
  );
}
