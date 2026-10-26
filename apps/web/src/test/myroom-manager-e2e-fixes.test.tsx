import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { floorPct, secToMin } from '../features/manager/managerUi';
import { chapterColumns, dailyColumns } from '../features/manager/pages/TraineeDetailPage';
import type { ChapterProgressRow, DailyRow } from '../shared/api/schemas';

/**
 * Fixes from the 2026-10-26 나의학습실 / 교육담당자 e2e round (apps/web/e2e/myroom, e2e/manager).
 */
describe('manager study-time formatting is floored (agents.md rule 10, e2e manager/scope.spec.ts)', () => {
  it('never rounds stored seconds up to the next minute or hour', () => {
    expect(secToMin(3599)).toBe('59분'); // was "1시간" (Math.round)
    expect(secToMin(7259)).toBe('2시간'); // was "2시간 1분"
    expect(secToMin(179)).toBe('2분'); // was "3분"
    expect(secToMin(59)).toBe('0분');
    expect(secToMin(54_000)).toBe('15시간');
    expect(secToMin(null)).toBe('0분');
    expect(secToMin(-5)).toBe('0분');
  });
  it('floors the chapter percent', () => {
    expect(floorPct(99.6)).toBe('99%');
    expect(floorPct(24)).toBe('24%');
    expect(floorPct(undefined)).toBe('0%');
  });
  it('the 학습자 상세 chapter and daily columns use the floored values', () => {
    const ch = { chapterSeq: 1, lectureCode: 'E2EX01', courseName: 'X', order: 1, contentsIdx: 1, title: 't', lectureTimeMin: 240, progress: 99.7, studyTime: 3599, lastStudy: null, lastStudiedAt: null } as ChapterProgressRow;
    const time = chapterColumns.find((c) => c.key === 'studyTime')!;
    const pct = chapterColumns.find((c) => c.key === 'progress')!;
    expect(render(<>{time.render!(ch, 0)}</>).container.textContent).toBe('59분');
    expect(render(<>{pct.render!(ch, 0)}</>).container.textContent).toBe('99%');
    const day = { date: '2026-10-22', seconds: 7259, creditedSec: 7259, excessSec: 0, status: 'ok', statusLabel: '정상' } as DailyRow;
    const sec = dailyColumns.find((c) => c.key === 'seconds')!;
    expect(render(<>{sec.render!(day, 0)}</>).container.textContent).toBe('2시간');
  });
});

describe('나의학습실 print view hides the site chrome and the my-room menu (e2e myroom/report-ranking.spec.ts)', () => {
  const dir = path.resolve(__dirname, '../app/layouts');
  it('MyRoomLayout carries the roomShell class', () => {
    const src = fs.readFileSync(path.join(dir, 'index.tsx'), 'utf8');
    const body = src.slice(src.indexOf('export function MyRoomLayout'), src.indexOf('export function ManagerLayout'));
    expect(body).toContain('styles.roomShell');
  });
  it('the print rule keeps only <main> and drops the side menu', () => {
    const css = fs.readFileSync(path.join(dir, 'Layouts.module.css'), 'utf8');
    const print = /@media print\{([^@]*\.roomShell[^@]*)\}/.exec(css)?.[1] ?? '';
    expect(print).toContain('.roomShell > :not(main){display:none!important}');
    expect(print).toContain('.roomShell .side{display:none!important}');
  });
});
