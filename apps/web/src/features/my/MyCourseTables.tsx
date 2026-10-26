import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from './My.module.css';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { isAppError } from '../../shared/api/client';
import { useToast } from '../../app/providers/ToastProvider';
import { Button } from '../../shared/ui/Button';
import { Pagination } from '../../shared/ui/Pagination';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { my as copy, contentType } from '../../shared/strings/ko';
import { fmtDateTime, resumeLink } from './queries';

const t = copy.home.tables;
/** lecture_status_tables.php order: 이러닝 X, 마이크로러닝 Z, 숏폼 Y (Course.ServiceType). */
const TYPES: { key: 'X' | 'Z' | 'Y'; label: string }[] = [{ key: 'X', label: contentType.X }, { key: 'Z', label: '마이크로러닝' }, { key: 'Y', label: '숏폼' }];

/** 학습현황 "상세보기": the three legacy per-type tables (GET /my/courses/tables), 10 rows each with their own pager. */
export default function MyCourseTables() {
  return <div className={styles.formGrid}>{TYPES.map((x) => <TypeTable key={x.key} type={x.key} label={x.label} />)}<p className={styles.note}>{t.note}</p></div>;
}

function TypeTable({ type, label }: { type: 'X' | 'Y' | 'Z'; label: string }) {
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const q = useQuery({ queryKey: ['my', 'course-table', type, page], queryFn: ({ signal }) => myRoomApi.courseTable(type, page, signal), placeholderData: keepPreviousData });
  const print = async (lectureCode: string, seq: number) => {
    const win = window.open('', '_blank');
    try { await myRoomApi.subjectCertificatePdf(lectureCode, seq || undefined, win); } catch (e) { toast(isAppError(e) ? e.message : copy.records.courses.certFail, { tone: 'danger' }); }
  };
  return (
    <section aria-label={label}>
      <div className={styles.cardHead}><h3 style={{ fontSize: 15, margin: 0 }}>{label}</h3>{q.data ? <span className={styles.note}>{t.total(q.data.total)}</span> : null}</div>
      {q.isPending ? <Skeleton lines={3} /> : q.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void q.refetch()} /> : (
        <>
          <table className={styles.table}>
            <thead><tr>{t.cols.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {q.data.items.length === 0 ? <tr><td colSpan={9}>{t.empty}</td></tr> : q.data.items.map((r) => (
                <tr key={`${r.lectureCode}-${r.studySeq}`}>
                  <td className={styles.num}>{r.no}</td>
                  <td><span className={styles.title}>{r.name ?? r.lectureCode}</span></td>
                  <td>{r.contentsTime}</td>
                  <td className={styles.num}>{r.studyTime}</td>
                  <td className={styles.num}>{r.progress}%</td>
                  <td>{fmtDateTime(r.startDate)}</td>
                  <td>{fmtDateTime(r.recentDate)}</td>
                  <td><Button size="xs" square to={resumeLink(r)}>{t.learn}</Button></td>
                  <td>{r.certificate.eligible ? <Button size="xs" square variant="secondary" onClick={() => void print(r.lectureCode, r.studySeq)}>{t.certificate}</Button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={q.data.total} size={10} onChange={setPage} />
        </>
      )}
    </section>
  );
}
