import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { EditorialHero } from '../features/home/editorial/EditorialHero';
import { OrbitRing } from '../features/home/editorial/OrbitRing';
import { useOrbitClock } from '../features/home/editorial/useOrbitClock';
import { home } from '../shared/strings/ko';
import type { OrbitBadgeSpec } from '../features/home/editorial/OrbitBadge';

const badges = home.editorial.badges as OrbitBadgeSpec[];
const stats = [
  { key: 'courses', value: 1240, unit: '개', caption: '공개 콘텐츠' },
  { key: 'categories', value: 48, unit: '개', caption: '세부 분야' },
  { key: 'types', value: 3, unit: '가지', caption: '콘텐츠 유형' },
];

function Ring() { const clock = useOrbitClock(); return <div style={{ position: 'relative', width: 600, height: 640 }}><OrbitRing badges={badges} clock={clock} /></div>; }

describe('EditorialHero', () => {
  it('reduced motion: headline, ~3 static badge links, no streaks, final stat values, front deck card', () => {
    render(
      <MemoryRouter><MotionConfig reducedMotion="always">
        <EditorialHero eyebrow="AINEX ARCHIVE" title={'필요한 배움을,\n필요한 순간에.'} lead="lead" cta={{ label: '콘텐츠 둘러보기', to: '/catalog' }} deckLabel="학습 영역" badges={badges} cards={home.editorial.cards} stats={stats} statsLabel="현황" />
      </MotionConfig></MemoryRouter>,
    );
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('필요한 배움을,필요한 순간에.');
    expect(h1.querySelectorAll('span')).toHaveLength(2);
    const badgeLinks = document.querySelectorAll('[data-badge]');
    expect(badgeLinks.length).toBe(3);
    expect(screen.getByRole('link', { name: '이러닝' })).toBeInTheDocument();
    expect(document.querySelector('[class*="streak"]')).toBeNull();
    expect(screen.getByRole('group', { name: '공개 콘텐츠 1,240개' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /공통역량/ })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot]')).toHaveLength(home.editorial.cards.length);
    expect(document.querySelector('[data-slot="0"]')).toHaveTextContent('공통역량');
  });

  it('full motion: the frame loop moves badges without any SVG path APIs, and hovering slows the clock', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 600, height: 640, top: 0, left: 0, right: 600, bottom: 640, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    render(<MemoryRouter><Ring /></MemoryRouter>);
    expect(document.querySelectorAll('[class*="streak"]').length).toBe(badges.length);
    const box = document.querySelector('[data-orbit]') as HTMLElement;
    const firstVisible = () => Array.from(document.querySelectorAll<HTMLElement>('li')).find((li) => parseFloat(li.style.opacity || '0') > 0.5);
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    const li = firstVisible();
    expect(li).toBeDefined();
    const before = li!.style.transform;
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    expect(li!.style.transform).not.toBe(before);
    expect(box.dataset.speed).toBeDefined();
    fireEvent.pointerEnter(box);
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(parseFloat(box.dataset.speed!)).toBeLessThan(1);
    fireEvent.pointerLeave(box);
    await act(async () => { await new Promise((r) => setTimeout(r, 900)); });
    expect(parseFloat(box.dataset.speed!)).toBeGreaterThan(0.9);
  });
});
