import type { SVGProps } from 'react';

export type IconName = 'search' | 'menu' | 'close' | 'arrow' | 'arrow-left' | 'chevron-down' | 'chevron-right' | 'external' | 'play' | 'heart' | 'star' | 'check' | 'user' | 'briefcase' | 'flag' | 'spark' | 'info' | 'alert' | 'lock' | 'clock' | 'file' | 'calendar' | 'phone' | 'plus' | 'minus' | 'filter' | 'video' | 'bolt' | 'shorts' | 'sparkles' | 'broadcast' | 'gauge' | 'mail';

const paths: Record<IconName, string> = {
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm9 17-4.4-4.4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  'arrow-left': 'M19 12H5m6 6-6-6 6-6',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-right': 'm9 6 6 6-6 6',
  external: 'M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5',
  play: 'M8 5v14l11-7z',
  heart: 'M12 20.5s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.3a4.5 4.5 0 0 1 7.5 3.2c0 5.4-7.5 10-7.5 10z',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z',
  check: 'm5 12 5 5 9-10',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0',
  briefcase: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  flag: 'M5 21V4h10l1 2h4v9h-9l-1-2H5',
  spark: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  info: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  lock: 'M6 11h12v10H6zM9 11V7a3 3 0 0 1 6 0v4',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  file: 'M6 3h8l5 5v13H6zM14 3v5h5M9 13h6M9 17h6',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4m8-4v4',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  video: 'M3 7h12v10H3zM15 10l6-3v10l-6-3',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  shorts: 'M8 3h8a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM10.5 9v6l5-3z',
  sparkles: 'M12 3 13.8 8.2 19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM5 18l.8 2.2L8 21l-2.2.8L5 24l-.8-2.2L2 21l2.2-.8zM19 2l.6 1.6L21 4.2l-1.4.6L19 6.4l-.6-1.6L17 4.2l1.4-.6z',
  broadcast: 'M12 12h.01M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8',
  gauge: 'M4 15a8 8 0 1 1 16 0M12 15l4-5M12 15h.01',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
};

export interface IconProps extends SVGProps<SVGSVGElement> { name: IconName; size?: number; title?: string }

/** Line icon (storyboard `.line-icon`: 1.65 px stroke, round caps). Decorative unless `title` is provided. */
export function Icon({ name, size = 20, title, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={name === 'play' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} focusable="false" {...rest}>
      {title ? <title>{title}</title> : null}
      <path d={paths[name]} />
    </svg>
  );
}
