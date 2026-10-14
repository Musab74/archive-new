import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { DateField, maskIsoDate, parseIsoDate } from '../shared/ui/admin';
import { ConsoleLangContext } from '../shared/i18n/adminLang';

function Harness({ initial = '', onChange, min }: { initial?: string; onChange: (v: string) => void; min?: string }) {
  const [v, setV] = useState(initial);
  return <><label htmlFor="d">기간</label><DateField id="d" value={v} min={min} onChange={(next) => { setV(next); onChange(next); }} /></>;
}

describe('DateField', () => {
  it('parses only real calendar days and masks typed digits as YYYY-MM-DD', () => {
    expect(parseIsoDate('2026-02-28')?.getDate()).toBe(28);
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('2026/02/01')).toBeNull();
    expect(maskIsoDate('20261014')).toBe('2026-10-14');
    expect(maskIsoDate('2026.10')).toBe('2026-10');
    expect(maskIsoDate('20261014999')).toBe('2026-10-14');
  });

  it('reports a value only once the typed date is complete and valid; clearing reports ""', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText('기간');
    expect(input).toHaveAttribute('placeholder', 'YYYY-MM-DD');
    fireEvent.change(input, { target: { value: '202610' } });
    expect(input).toHaveValue('2026-10');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '20261014' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-10-14');
    fireEvent.change(input, { target: { value: '2026-13-01' } });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.blur(input);
    expect(input).toHaveValue('2026-10-14'); // invalid text reverts to the last valid value
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('calendar: opens on the selected month, picks by click and by keyboard, honours min', () => {
    const onChange = vi.fn();
    render(<Harness initial="2026-10-14" min="2026-10-10" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '달력 열기' }));
    const dialog = screen.getByRole('dialog', { name: '날짜 선택' });
    expect(dialog).toHaveTextContent('2026년 10월');
    const selected = screen.getByRole('button', { name: /2026년 10월 14일/ });
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    expect(selected).toHaveFocus();
    expect(screen.getByRole('button', { name: /2026년 10월 9일/ })).toBeDisabled();
    fireEvent.keyDown(selected, { key: 'ArrowDown' });
    const nextWeek = screen.getByRole('button', { name: /2026년 10월 21일/ });
    expect(nextWeek).toHaveFocus();
    fireEvent.click(nextWeek);
    expect(onChange).toHaveBeenLastCalledWith('2026-10-21');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('기간')).toHaveFocus();
  });

  it('speaks English inside an EN admin console', () => {
    render(<ConsoleLangContext.Provider value="en"><Harness initial="2026-10-14" onChange={() => {}} /></ConsoleLangContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Open calendar' }));
    expect(screen.getByRole('dialog', { name: 'Choose a date' })).toHaveTextContent('October 2026');
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Sun' })).toBeInTheDocument();
  });
});
