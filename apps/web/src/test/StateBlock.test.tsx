import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { StateBlock } from '../shared/ui/StateBlock';
import { states, type StateCode } from '../shared/strings/ko';

function LocationProbe() { const l = useLocation(); return <output data-testid="loc">{l.pathname}{l.search}</output>; }
const wrap = (ui: React.ReactNode, path = '/catalog?q=ai') => render(
  <MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={<>{ui}<LocationProbe /></>} /></Routes></MemoryRouter>,
);

describe('StateBlock', () => {
  const codes = Object.keys(states) as StateCode[];
  it.each(codes)('renders Korean copy for %s', (code) => {
    wrap(<StateBlock code={code} />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(states[code].title);
    expect(screen.getByText(states[code].body)).toBeInTheDocument();
    expect(screen.getByText(states[code].kicker)).toBeInTheDocument();
    for (const a of states[code].actions) expect(screen.getByRole('button', { name: a.label })).toBeInTheDocument();
  });

  it('LOGIN action navigates to /auth/login with the current location as next', () => {
    wrap(<StateBlock code="LOGIN" />);
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/auth/login?next=%2Fcatalog%3Fq%3Dai');
  });

  it('retry action calls onRetry and overrides are applied', () => {
    const onRetry = vi.fn();
    wrap(<StateBlock code="LIST_ERROR" onRetry={onRetry} title="콘텐츠를 불러오지 못했습니다." />);
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('콘텐츠를 불러오지 못했습니다.');
  });

  it('exposes a labelled region with the state code', () => {
    wrap(<StateBlock code="NOT_FOUND" page />);
    const region = screen.getByRole('region');
    expect(region).toHaveAttribute('data-state', 'NOT_FOUND');
    expect(region).toHaveAccessibleName(states.NOT_FOUND.title);
  });
});
