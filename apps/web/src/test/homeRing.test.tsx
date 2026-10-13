import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ringProps } from '../features/home/LearningHome';
import { ProgressRing } from '../shared/ui/ProgressRing';
import { usageOf } from '../features/my/queries';
import { hm } from '../shared/player/time';

describe('15h ring props (AR-02 usage strip)', () => {
  it('renders the aggregate as — (never 0) when /my/status failed', () => {
    const r = ringProps(undefined, true);
    expect(r).toEqual({ percent: null, label: '—', remaining: null, achieved: false });
    render(<ProgressRing percent={r.percent} label={r.label} ariaLabel="환급 인정 수강시간" />);
    const bar = screen.getByRole('progressbar', { name: '환급 인정 수강시간' });
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(bar).toHaveAttribute('aria-valuetext', '집계 미확인');
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('uses the server percent and formats recognised time / remaining to 15 h', () => {
    const r = ringProps({ completionSeconds: 34200, percent: 63, achieved: false, completionCriteriaSeconds: 54000 }, false);
    expect(r).toEqual({ percent: 63, label: '9시간 30분', remaining: '5시간 30분', achieved: false });
    render(<ProgressRing percent={r.percent} label={r.label} sub="/ 15시간" ariaLabel="환급 인정 수강시간" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '63');
  });

  it('achieved state keeps 100% and no remaining time; falls back to floor(sec/54000) without a server percent', () => {
    expect(ringProps({ completionSeconds: 55800, percent: 100, achieved: true, completionCriteriaSeconds: 54000 }, false)).toEqual({ percent: 100, label: '15시간 30분', remaining: null, achieved: true });
    expect(ringProps({ completionSeconds: 27000 }, false)).toMatchObject({ percent: 50, remaining: '7시간 30분' });
    expect(hm(0)).toBe('0분');
  });

  it('derives mode/state from status + enrollments (비환급 = W / NON_REFUND; BEFORE/ENDED only without an active one)', () => {
    const status = { studySeq: 1, serviceType: 'W', serviceTypeLabel: '비환급' } as Parameters<typeof usageOf>[0];
    expect(usageOf(status, [])).toMatchObject({ mode: 'general', state: 'ACTIVE' });
    const ended = [{ studySeq: 2, lectureCode: 'ARC2025', mode: 'REFUND', state: 'ENDED', serviceType: 'A', progress: 0, passOk: false, studyEnd: true, courseName: null, lectureStart: null, lectureEnd: null }];
    expect(usageOf({ studySeq: null } as Parameters<typeof usageOf>[0], ended as never)).toMatchObject({ mode: 'refund', state: 'ENDED' });
    expect(usageOf(null, [])).toMatchObject({ state: 'NONE' });
  });
});
