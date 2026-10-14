import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { AppSelect } from '../shared/ui/AppSelect';
import { Select } from '../shared/ui/Form';

const SORTS = [{ value: 'latest', label: '운영 편성순' }, { value: 'popular', label: '인기순' }, { value: 'rating', label: '평점순' }, { value: 'title', label: '제목순' }];

function Sort({ onChange }: { onChange: (v: string) => void }) {
  const [v, setV] = useState('latest');
  return <AppSelect aria-label="콘텐츠 정렬" value={v} onValueChange={(next) => { setV(next); onChange(next); }} options={SORTS} prefix="정렬" />;
}

/** Keyboard open (Enter / Space / ArrowDown on the focused trigger) — jsdom has no PointerEvent for the mouse path. */
const open = (el: HTMLElement, key = 'ArrowDown') => { el.focus(); fireEvent.keyDown(el, { key }); };

describe('AppSelect', () => {
  it('is a labelled combobox showing the selected label, and picking an option reports its value', () => {
    const onChange = vi.fn();
    render(<Sort onChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: '콘텐츠 정렬' });
    expect(trigger).toHaveTextContent('운영 편성순');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    open(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['운영 편성순', '인기순', '평점순', '제목순']);
    expect(screen.getByRole('option', { name: '운영 편성순' })).toHaveAttribute('data-state', 'checked'); // current value is marked
    fireEvent.click(screen.getByRole('option', { name: '평점순' }));
    expect(onChange).toHaveBeenCalledWith('rating');
    expect(screen.getByRole('combobox', { name: '콘텐츠 정렬' })).toHaveTextContent('평점순');
  });

  it('Form.Select keeps "" as a real choice (placeholder row) and round-trips it', () => {
    const onChange = vi.fn();
    function Field() {
      const [v, setV] = useState('IT·SW');
      return <Select aria-label="직무 분야" value={v} placeholder="전체" onValueChange={(next) => { setV(next); onChange(next); }} options={[{ value: '기획·마케팅', label: '기획·마케팅' }, { value: 'IT·SW', label: 'IT·SW' }]} />;
    }
    render(<Field />);
    open(screen.getByRole('combobox', { name: '직무 분야' }), 'Enter');
    fireEvent.click(screen.getByRole('option', { name: '전체' }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.getByRole('combobox', { name: '직무 분야' })).toHaveTextContent('전체');
  });

  it('disabled and loading triggers do not open', () => {
    render(<><AppSelect aria-label="a" value="" onValueChange={() => {}} options={SORTS} disabled /><AppSelect aria-label="b" value="" onValueChange={() => {}} options={SORTS} loading /></>);
    for (const name of ['a', 'b']) {
      const t = screen.getByRole('combobox', { name });
      expect(t).toBeDisabled();
      open(t);
      expect(t).toHaveAttribute('aria-expanded', 'false');
    }
    expect(screen.getByRole('combobox', { name: 'b' })).toHaveAttribute('aria-busy', 'true');
  });
});
