import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { DataTable, type Column } from '../shared/ui/admin/DataTable';
import { nextSort, pageSlice, pageWindow, sortRows } from '../shared/ui/admin/tableSort';

interface Row { id: string; name: string; seconds: number; last: string | null }
const rows: Row[] = [
  { id: 'c', name: '다', seconds: 300, last: null },
  { id: 'a', name: '가', seconds: 100, last: '2026-10-02' },
  { id: 'b', name: '나', seconds: 200, last: '2026-10-01' },
];
const columns: Column<Row>[] = [
  { key: 'id', header: '아이디', sortable: true },
  { key: 'name', header: '이름' },
  { key: 'seconds', header: '학습시간', sortable: true, align: 'right' },
  { key: 'last', header: '최근', sortable: true },
];
const bodyIds = () => within(screen.getAllByRole('rowgroup')[1]!).getAllByRole('row').map((r) => within(r).getAllByRole('cell')[0]!.textContent);

describe('tableSort helpers', () => {
  it('cycles none → asc → desc → none', () => {
    expect(nextSort(null, 'id')).toEqual({ key: 'id', dir: 'asc' });
    expect(nextSort({ key: 'id', dir: 'asc' }, 'id')).toEqual({ key: 'id', dir: 'desc' });
    expect(nextSort({ key: 'id', dir: 'desc' }, 'id')).toBeNull();
    expect(nextSort({ key: 'id', dir: 'desc' }, 'seconds')).toEqual({ key: 'seconds', dir: 'asc' });
  });
  it('sorts numbers and strings, keeping empties last in both directions', () => {
    expect(sortRows(rows, { key: 'seconds', dir: 'desc' }).map((r) => r.id)).toEqual(['c', 'b', 'a']);
    expect(sortRows(rows, { key: 'id', dir: 'asc' }).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(sortRows(rows, { key: 'last', dir: 'asc' }).map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(sortRows(rows, { key: 'last', dir: 'desc' }).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(sortRows(rows, null).map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });
  it('pages client-side', () => {
    expect(pageSlice([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
    expect(pageWindow(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });
});

describe('DataTable', () => {
  it('sorts client-side when a sortable header is clicked and exposes aria-sort', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(bodyIds()).toEqual(['c', 'a', 'b']);
    const btn = screen.getByRole('button', { name: /학습시간/ });
    fireEvent.click(btn);
    expect(bodyIds()).toEqual(['a', 'b', 'c']);
    expect(screen.getByRole('columnheader', { name: /학습시간/ })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(btn);
    expect(bodyIds()).toEqual(['c', 'b', 'a']);
    expect(screen.getByRole('columnheader', { name: /학습시간/ })).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(btn);
    expect(bodyIds()).toEqual(['c', 'a', 'b']);
  });

  it('delegates sorting to the server when onSortChange is given', () => {
    const onSortChange = vi.fn();
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} sort={null} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByRole('button', { name: /아이디/ }));
    expect(onSortChange).toHaveBeenCalledWith({ key: 'id', dir: 'asc' });
    expect(bodyIds()).toEqual(['c', 'a', 'b']);
  });

  it('paginates client-side with size and server-side with onPageChange', () => {
    const { unmount } = render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} size={2} />);
    expect(bodyIds()).toEqual(['c', 'a']);
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(bodyIds()).toEqual(['b']);
    unmount();
    const onPageChange = vi.fn();
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} page={1} size={3} total={10} onPageChange={onPageChange} />);
    expect(bodyIds()).toHaveLength(3);
    expect(screen.getByText(/총 10건/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('renders empty, error and loading states and keyboard row activation', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<DataTable columns={columns} rows={[]} rowKey={(r) => r.id} emptyTitle="학습대상이 없습니다." />);
    expect(screen.getByText('학습대상이 없습니다.')).toBeInTheDocument();
    rerender(<DataTable columns={columns} rows={undefined} error={new Error('x')} onRetry={onRetry} rowKey={(r) => r.id} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(onRetry).toHaveBeenCalled();
    rerender(<DataTable columns={columns} rows={undefined} loading rowKey={(r) => r.id} skeletonRows={2} />);
    expect(screen.getAllByRole('rowgroup')[1]!.querySelectorAll('tr')).toHaveLength(2);
    const onRowClick = vi.fn();
    rerender(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />);
    const first = within(screen.getAllByRole('rowgroup')[1]!).getAllByRole('row')[0]!;
    fireEvent.keyDown(first, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});
