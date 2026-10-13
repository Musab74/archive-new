import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { EditorialHero, type HeroArea } from '../features/home/editorial/EditorialHero';
import { home } from '../shared/strings/ko';

const areas = { ...home.editorial.areas, items: home.editorial.areas.items as HeroArea[] };
const stats = [
  { key: 'courses', value: 1240, unit: '개', caption: '공개 콘텐츠' },
  { key: 'categories', value: 48, unit: '개', caption: '세부 분야' },
  { key: 'types', value: null, unit: '가지', caption: '콘텐츠 유형' },
];

function CatalogProbe() { const loc = useLocation(); return <p data-testid="catalog">{loc.search}</p>; }

const mount = () => render(
  <MemoryRouter initialEntries={['/']}><MotionConfig reducedMotion="always">
    <Routes>
      <Route path="/" element={<EditorialHero eyebrow="eyebrow" title={'필요한 배움을,\n필요한 순간에.'} lead="lead" cta={{ label: '콘텐츠 둘러보기', to: '/catalog' }} secondary={{ label: '로그인', to: '/auth/login' }} areas={areas} stats={stats} statsLabel="현황" />} />
      <Route path="/catalog" element={<CatalogProbe />} />
    </Routes>
  </MotionConfig></MemoryRouter>,
);

describe('EditorialHero', () => {
  it('renders the headline lines, both actions, the stats strip and every learning area as a link', () => {
    mount();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('필요한 배움을,필요한 순간에.');
    expect(h1.children).toHaveLength(2); // one block per line (the tagline breaks after its comma)
    expect(h1.children[1]!.querySelector('svg')).not.toBeNull(); // the last line carries the drawn underline
    expect(screen.getByRole('link', { name: /콘텐츠 둘러보기/ })).toHaveAttribute('href', '/catalog');
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/auth/login');
    expect(screen.getByRole('group', { name: '공개 콘텐츠 1,240개' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '콘텐츠 유형' })).toHaveTextContent('—'); // unknown count, never 0
    expect(screen.getByRole('heading', { level: 2, name: '학습 영역' })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-area]')).toHaveLength(areas.items.length);
    expect(screen.getByRole('link', { name: /AI ZONE/ })).toHaveAttribute('href', '/ai-zone');
  });

  it('the panel search opens the catalog with the trimmed query', () => {
    mount();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  생성형 AI ' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByTestId('catalog')).toHaveTextContent('?q=%EC%83%9D%EC%84%B1%ED%98%95%20AI');
  });
});
