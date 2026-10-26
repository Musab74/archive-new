import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { PageTransition } from '../shared/motion/PageTransition';

describe('PageTransition', () => {
  it('mounts the destination page once, so what is typed right after a navigation stays', async () => {
    const mounts: Record<string, number> = { a: 0, b: 0 };
    function Page({ name }: { name: 'a' | 'b' }) {
      useEffect(() => { mounts[name]++; }, [name]);
      return <label>{name}<input aria-label={`field-${name}`} /></label>;
    }
    const router = createMemoryRouter([{ element: <PageTransition><Outlet /></PageTransition>, children: [{ path: '/a', element: <Page name="a" /> }, { path: '/b', element: <Page name="b" /> }] }], { initialEntries: ['/a'] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByLabelText('field-a')).toBeInTheDocument();
    await act(async () => { await router.navigate('/b'); });
    fireEvent.change(await screen.findByLabelText('field-b'), { target: { value: 'typed at once' } });
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); }); // longer than the old 160 ms exit + 220 ms enter
    expect(screen.getByLabelText('field-b')).toHaveValue('typed at once');
    expect(screen.getAllByLabelText('field-b')).toHaveLength(1);
    expect(screen.queryByLabelText('field-a')).not.toBeInTheDocument();
    expect(mounts).toEqual({ a: 1, b: 1 });
  });
});
