import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConsoleLangContext, ADMIN_LANG_KEY, tr } from '../shared/i18n/adminLang';
import { FilterBar, FilterField, DataTable, YnBadge } from '../shared/ui/admin';
import { StateBlock } from '../shared/ui/StateBlock';

afterEach(() => { localStorage.removeItem(ADMIN_LANG_KEY); vi.resetModules(); });

describe('admin language (KO / EN)', () => {
  it('defaults to Korean', () => {
    expect(tr('검색', 'Search')).toBe('검색');
  });

  it('reads the stored choice at load: admin copy, menu and tr() switch to English', async () => {
    localStorage.setItem(ADMIN_LANG_KEY, 'en');
    vi.resetModules();
    const lang = await import('../shared/i18n/adminLang');
    const { adm } = await import('../features/admin/strings');
    const { ADMIN_MENU, GRANT_LABELS } = await import('../shared/auth/adminMenu');
    expect(lang.getAdminLang()).toBe('en');
    expect(lang.tr('검색', 'Search')).toBe('Search');
    expect(adm.studies.title).toBe('Enrollments');
    expect(adm.common.total(1234)).toBe('1,234 total');
    expect(GRANT_LABELS.B).toBe('Learning');
    expect(ADMIN_MENU.flatMap((g) => g.items.map((i) => i.label))).toContain('Website design');
  });

  it('shared kit follows the console context and stays Korean outside it (public site / manager)', () => {
    const bar = (
      <FilterBar onSubmit={() => {}} onReset={() => {}}>
        <FilterField label="ID" htmlFor="f-id" width={240}><input id="f-id" /></FilterField>
      </FilterBar>
    );
    const { unmount } = render(bar);
    expect(screen.getByRole('button', { name: '검색' })).toBeInTheDocument();
    expect(screen.getByRole('search', { name: '검색 조건' })).toBeInTheDocument();
    unmount();

    render(<ConsoleLangContext.Provider value="en">{bar}<YnBadge value="Y" /><DataTable<{ a: string }> columns={[{ key: 'a', header: 'A' }]} rows={[]} rowKey={(r) => r.a} /></ConsoleLangContext.Provider>);
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    expect(screen.getByRole('search', { name: 'Search filters' })).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Nothing to show.')).toBeInTheDocument();
  });

  it('wide filter fields span two grid tracks instead of a fixed pixel width', () => {
    render(<FilterBar onSubmit={() => {}}><FilterField label="Q" htmlFor="q" width={240}><input id="q" /></FilterField><FilterField label="S" htmlFor="s" width={120}><input id="s" /></FilterField></FilterBar>);
    const wide = screen.getByLabelText('Q').closest('label')!;
    const narrow = screen.getByLabelText('S').closest('label')!;
    expect(wide.getAttribute('style')).toBeNull();
    expect(wide.className).not.toBe(narrow.className);
  });

  it('StateBlock copy switches with the console language', () => {
    render(<MemoryRouter><ConsoleLangContext.Provider value="en"><StateBlock code="LIST_ERROR" /></ConsoleLangContext.Provider></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'The list could not be loaded.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
