import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformNotice } from '../app/layouts/PlatformNotice';
import { platformApi } from '../shared/api/endpoints/platform';

const NOTICE = '시험 환경입니다. 운영 데이터의 복사본으로 동작하며, 여기서의 학습·수정은 실제 학습기록과 고용노동부(EMON) 보고에 반영되지 않습니다.';

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><PlatformNotice /></QueryClientProvider>);
}

describe('PlatformNotice (GET /public/platform)', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows the 시험 환경 notice with the snapshot time when the API runs on a copy', async () => {
    vi.spyOn(platformApi, 'info').mockResolvedValue({ dataMode: 'copy', snapshotAt: '2026-10-27 02:10', notice: NOTICE });
    mount();
    expect(await screen.findByRole('status')).toHaveTextContent(`시험 환경${NOTICE} (데이터 기준 2026-10-27 02:10)`);
  });

  it('shows nothing on production or when the API does not answer', async () => {
    const info = vi.spyOn(platformApi, 'info').mockResolvedValue({ dataMode: 'production', snapshotAt: null, notice: null });
    const { container, unmount } = mount();
    await waitFor(() => expect(info).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    unmount();
    vi.spyOn(platformApi, 'info').mockRejectedValue(new Error('404'));
    const second = mount();
    await new Promise((r) => setTimeout(r, 20));
    expect(second.container).toBeEmptyDOMElement();
  });
});
