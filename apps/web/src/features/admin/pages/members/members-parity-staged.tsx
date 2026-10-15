import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminMembersParityApi, STAGED_KEYS, type StagedCommitResult, type StagedKey, type StagedRow } from '../../../../shared/api/endpoints/admin-members-parity';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import { AButton, AInput, ASelect, Callout, Card, ConfirmDialog, DateField, DetailDrawer, FieldRow } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';

const SERVICE_TYPES = [{ value: 'A', label: '패키지' }, { value: 'X', label: '이러닝' }, { value: 'Y', label: '숏폼' }, { value: 'Z', label: '마이크로닝' }, { value: 'W', label: '비환급' }];
const TRNEE = [['002', '구직자'], ['003', '채용예정자'], ['006', '전직/이직예정자'], ['007', '자사근로자'], ['008', '타사근로자'], ['013', '일용근로자'], ['983', '취득예정자(일용포함)'], ['984', '고용유지훈련'], ['985', '적용제외근로자']].map(([value, label]) => ({ value: value!, label: `${label} (${value})` }));
const IRGLBR = [['000', '비정규직해당없음'], ['012', '파견근로자'], ['013', '일용근로자'], ['014', '기간제근로자'], ['020', '단기간근로자'], ['021', '무급휴업/휴직자'], ['022', '임의가입자영업자'], ['987', '분류불능']].map(([value, label]) => ({ value: value!, label: `${label} (${value})` }));
const LABELS: Record<StagedKey, string> = { LectureCode: '과정코드', Tutor: '첨삭강사', Name: '수강생 이름', ResNo: '주민등록번호', Mobile: '휴대폰', Email: '이메일', CompanyCode: '사업자번호', Depart: '부서명', LectureStart: '수강시작일', LectureEnd: '수강종료일', LectureReStudy: '복습종료일', ServiceType: '서비스구분', UserID: '아이디', Pwd: '비밀번호', nwIno: '비용수급사업장', trneeSe: '훈련생구분', IrglbrSe: '비정규직구분', OpenChapter: '실시회차', SalesID: '영업담당자', EduManager: '교육담당자 여부' };

const red = (r: StagedRow, cell: string, v: string | null | undefined, empty = '미입력') => (r.errorCells.includes(cell) ? <span style={{ color: 'var(--danger, #c0392b)' }}>{v || empty}</span> : (v ?? ''));

/** lecture_reg_edit.php in a drawer. */
function StagedEditDrawer({ idx, onClose }: { idx: number | null; onClose: () => void }) {
  const row = useQuery({ queryKey: ['admin', 'enrollments', 'staged', idx], queryFn: ({ signal }) => adminMembersParityApi.stagedRow(idx!, signal), enabled: idx !== null });
  const opts = useQuery({ queryKey: ['admin', 'enrollments', 'options'], queryFn: ({ signal }) => adminApi.enrollmentOptions(signal), enabled: idx !== null, staleTime: 5 * 60_000 });
  const [f, setF] = useState<Record<StagedKey, string> | null>(null);
  useEffect(() => { if (row.data) { const v = {} as Record<StagedKey, string>; for (const k of STAGED_KEYS) v[k] = String(row.data[k] ?? ''); setF(v); } else setF(null); }, [row.data]);
  const save = useAdminMutation({ fn: (b: Record<string, string>) => adminMembersParityApi.updateStaged(idx!, b), invalidate: [['admin', 'enrollments', 'staged']], success: tr('수정 되었습니다.', 'Saved.'), onSuccess: onClose });
  const input = (k: StagedKey, extra: Record<string, unknown> = {}) => <AInput id={`st-${k}`} value={f?.[k] ?? ''} onChange={(e) => f && setF({ ...f, [k]: e.target.value })} {...extra} />;
  return (
    <DetailDrawer open={idx !== null} onClose={onClose} wide title={tr('엑셀 업로드 행 수정', 'Edit uploaded row')} subtitle={idx ? `#${idx}` : undefined}
      footer={<><AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton><AButton variant="primary" loading={save.isPending} disabled={!f} onClick={() => f && save.mutate(f)}>{tr('수정 하기', 'Save')}</AButton></>}>
      {!f ? <p className="muted">{tr('불러오는 중…', 'Loading…')}</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldRow label={tr('과정 선택', 'Course')} htmlFor="st-LectureCode"><>{input('LectureCode', { list: 'st-courses' })}<datalist id="st-courses">{(opts.data?.courses ?? []).map((c) => <option key={c.lectureCode} value={c.lectureCode}>{c.name}</option>)}</datalist></></FieldRow>
          {(['Tutor', 'Name', 'ResNo', 'Mobile', 'Email', 'CompanyCode', 'Depart'] as const).map((k) => <FieldRow key={k} label={LABELS[k]} htmlFor={`st-${k}`}>{input(k, k === 'ResNo' ? { autoComplete: 'off' } : {})}</FieldRow>)}
          <FieldRow label={tr('수강 기간', 'Period')}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><DateField aria-label={LABELS.LectureStart} value={f.LectureStart} onChange={(v) => setF({ ...f, LectureStart: v })} /> ~ <DateField aria-label={LABELS.LectureEnd} value={f.LectureEnd} onChange={(v) => setF({ ...f, LectureEnd: v })} /></div></FieldRow>
          <FieldRow label={tr('복습 기간', 'Review until')}><div style={{ paddingTop: 6 }}>{f.LectureReStudy || tr('종료일 + 7일', 'end + 7 days')}</div></FieldRow>
          <FieldRow label={LABELS.ServiceType} htmlFor="st-ServiceType"><ASelect id="st-ServiceType" value={f.ServiceType} onChange={(e) => setF({ ...f, ServiceType: e.target.value })} options={SERVICE_TYPES} placeholder="-" /></FieldRow>
          {(['UserID', 'Pwd', 'nwIno'] as const).map((k) => <FieldRow key={k} label={LABELS[k]} htmlFor={`st-${k}`}>{input(k)}</FieldRow>)}
          <FieldRow label={LABELS.trneeSe} htmlFor="st-trneeSe"><ASelect id="st-trneeSe" value={f.trneeSe} onChange={(e) => setF({ ...f, trneeSe: e.target.value })} options={TRNEE} placeholder="-" /></FieldRow>
          <FieldRow label={LABELS.IrglbrSe} htmlFor="st-IrglbrSe"><ASelect id="st-IrglbrSe" value={f.IrglbrSe} onChange={(e) => setF({ ...f, IrglbrSe: e.target.value })} options={IRGLBR} placeholder="-" /></FieldRow>
          {(['OpenChapter', 'SalesID'] as const).map((k) => <FieldRow key={k} label={LABELS[k]} htmlFor={`st-${k}`}>{input(k)}</FieldRow>)}
          <FieldRow label={LABELS.EduManager} htmlFor="st-EduManager"><ASelect id="st-EduManager" value={f.EduManager} onChange={(e) => setF({ ...f, EduManager: e.target.value })} options={[{ value: 'Y', label: '사용' }, { value: 'N', label: '미사용' }]} placeholder="-" /></FieldRow>
        </div>
      )}
    </DetailDrawer>
  );
}

/**
 * 수강 등록 › 엑셀 업로드 목록 (lecture_reg_list.php): rows this admin uploaded into StudyExcelTemp, with the PHP row checks,
 * 수정 (lecture_reg_edit.php), 선택항목 삭제 (lecture_reg_select_delete.php) and 수강 등록하기 (lecture_reg_complete.php → /admin/enrollments/import commit).
 */
export function StagedUploadList() {
  const { canWrite, readOnlyTitle } = useWriteGate();
  const list = useQuery({ queryKey: ['admin', 'enrollments', 'staged'], queryFn: ({ signal }) => adminMembersParityApi.staged(signal) });
  const rows = useMemo(() => list.data?.items ?? [], [list.data]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [edit, setEdit] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<'delete' | 'commit' | null>(null);
  const [result, setResult] = useState<StagedCommitResult | null>(null);
  useEffect(() => { setChecked((s) => new Set([...s].filter((i) => rows.some((r) => r.idx === i)))); }, [rows]);
  const del = useAdminMutation({ fn: (idxs: number[]) => adminMembersParityApi.deleteStaged(idxs), invalidate: [['admin', 'enrollments', 'staged']], success: tr('삭제되었습니다.', 'Deleted.'), onSuccess: () => { setConfirm(null); setChecked(new Set()); } });
  const commit = useAdminMutation({ fn: () => adminMembersParityApi.commitStaged({ skipInvalid: false }), invalidate: [['admin', 'enrollments', 'staged'], ['admin', 'studies'], ['admin', 'members']], onSuccess: (r) => { setConfirm(null); setResult(r); } });
  const allOn = rows.length > 0 && rows.every((r) => checked.has(r.idx));
  const errorCount = list.data?.errorCount ?? 0;
  const th = { padding: '4px 6px', fontSize: 12, borderBottom: '1px solid var(--line, #ddd)', whiteSpace: 'nowrap' as const, textAlign: 'center' as const };
  const td = { padding: '4px 6px', fontSize: 12, textAlign: 'center' as const, verticalAlign: 'top' as const };
  return (
    <Card title={tr('수강등록 엑셀파일로 등록', 'Register from an Excel file')} aside={<Link to="/admin/enrollments/import" style={{ fontSize: 12 }}>{tr('엑셀 파일 업로드 (엑셀 일괄 수강등록) →', 'Upload a file (bulk enrolment) →')}</Link>}>
      <Callout tone="warn" className="u-mb-8">{tr('이몬(Emon) 안내: 미사용·탈퇴·휴면 회원의 수강 정보는 이몬으로 전송되지 않습니다. 이미 전송된 데이터는 그대로 유지됩니다. 계정을 활성으로 되돌리면, 아직 보내지 않은 건은 다음 전송 때 나갈 수 있습니다.', 'EMON: enrolments of inactive, withdrawn or dormant members are not sent. Data already sent stays; when the account is reactivated, unsent rows may go out with the next run.')}</Callout>
      <p className="muted" style={{ fontSize: 12, margin: '0 0 8px' }}>
        {tr('* 붉은색으로 표시된 항목은 오류가 예상되는 항목입니다.', '* Red cells are expected errors.')}<br />
        {tr('* 상태 설명 : 대기(엑셀을 업로드 후 수강등록 대기 상태), 등록(정상적으로 등록 완료), 오류(회원가입오류, DB입력 오류, 동일한 과정·수강기간·서비스 구분이 이미 등록되어 있는 경우, 미사용/탈퇴/휴면 계정)', '* Status: waiting (uploaded, not registered yet), registered, error (member error, DB error, same course/period/service already registered, inactive/withdrawn/dormant account).')}
      </p>
      {result ? <Callout tone="ok" className="u-mb-8">{tr(`수강 ${result.applied?.enrolled ?? 0}건 등록 완료 (신규 회원 ${result.applied?.membersCreated ?? 0}, 새 회차 ${result.applied?.termsCreated ?? 0}). 등록된 ${result.stagedRemoved}행은 목록에서 삭제되었습니다.`, `${result.applied?.enrolled ?? 0} enrolled; ${result.stagedRemoved} rows removed from the list.`)}</Callout> : null}
      {commit.error && isAppError(commit.error) ? <Callout tone="warn" className="u-mb-8">{commit.error.message}</Callout> : null}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th rowSpan={2} style={th}><input type="checkbox" aria-label={tr('전체 선택', 'Select all')} checked={allOn} disabled={!rows.length} onChange={(e) => setChecked(e.target.checked ? new Set(rows.map((r) => r.idx)) : new Set())} /></th>
              <th rowSpan={2} style={th}>{tr('번호', 'No.')}</th>
              {['과정코드', '첨삭강사', '이름', '주민등록번호', '휴대폰', '이메일', '사업자번호', '부서명', '수강시작일', '수강종료일'].map((h) => <th key={h} style={th}>{h}</th>)}
              <th rowSpan={2} style={th}>{tr('상태', 'Status')}</th>
            </tr>
            <tr>{['복습종료일', '서비스구분', '아이디', '비밀번호', '비용수급사업장', '훈련생구분', '비정규직구분', '실시회차', '영업담당자', '교육담당자 여부'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          {rows.length ? rows.map((r, i) => (
            <tbody key={r.idx} style={{ background: i % 2 ? 'var(--zebra, #f6f6f6)' : undefined }}>
              <tr>
                <td rowSpan={2} style={td}><input type="checkbox" aria-label={`#${r.idx}`} checked={checked.has(r.idx)} onChange={(e) => setChecked((s) => { const n = new Set(s); if (e.target.checked) n.add(r.idx); else n.delete(r.idx); return n; })} /><br /><AButton size="xs" disabled={!canWrite} title={readOnlyTitle} onClick={() => setEdit(r.idx)}>{tr('수정', 'Edit')}</AButton></td>
                <td rowSpan={2} style={td}>{r.no}</td>
                <td style={td}>{red(r, 'LectureCode', r.lectureCode)}</td><td style={td}>{red(r, 'Tutor', r.tutor)}</td><td style={td}>{red(r, 'Name', r.name)}</td><td style={td}>{red(r, 'ResNo', r.resNo, '')}</td>
                <td style={td}>{r.mobile ?? ''}</td><td style={td}>{r.email ?? ''}</td><td style={td}>{red(r, 'CompanyCode', r.companyCode)}</td><td style={td}>{r.depart ?? ''}</td>
                <td style={td}>{red(r, 'LectureStart', r.lectureStart, '')}</td><td style={td}>{red(r, 'LectureEnd', r.lectureEnd, '')}</td>
                <td rowSpan={2} style={{ ...td, textAlign: 'left', minWidth: 200 }}>{r.status === 'error' ? <><b style={{ color: 'var(--danger, #c0392b)' }}>{tr('오류', 'Error')}</b><br /><b>{r.userId || r.name || tr(`엑셀 ${r.no}번`, `row ${r.no}`)}</b>{r.errors.map((e) => <div key={e}>- {e}</div>)}{r.studyOverlap ? <div style={{ marginTop: 4 }}><Link to="/admin/learning/closings">{tr('기존 수강 수강마감 열기', 'Open 수강마감')}</Link></div> : null}</> : tr('대기', 'Waiting')}</td>
              </tr>
              <tr>
                <td style={td}>{red(r, 'LectureReStudy', r.reStudy, '')}</td><td style={td}>{red(r, 'ServiceType', r.serviceType)}</td><td style={td}>{red(r, 'UserID', r.userIdLabel)}</td><td style={td}>{r.pwd ?? ''}</td>
                <td style={td}>{r.nwIno ?? ''}</td><td style={td}>{r.trneeSeLabel}</td><td style={td}>{r.irglbrSeLabel}</td><td style={td}>{red(r, 'OpenChapter', r.openChapter, '')}</td><td style={td}>{red(r, 'SalesID', r.salesId)}</td><td style={td}>{red(r, 'EduManager', r.eduManager, '')}</td>
              </tr>
            </tbody>
          )) : <tbody><tr><td colSpan={13} style={{ ...td, padding: 24 }} className="muted">{list.isPending ? tr('불러오는 중…', 'Loading…') : tr('업로드한 엑셀파일이 없습니다.', 'No uploaded rows.')}</td></tr></tbody>}
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <AButton disabled={!canWrite || checked.size === 0} title={readOnlyTitle} onClick={() => setConfirm('delete')}>{tr('선택항목 삭제', 'Delete selected')} ({checked.size})</AButton>
        {errorCount > 0 ? <span style={{ color: 'var(--danger, #c0392b)', fontWeight: 600 }}>{tr(`오류 건수가 [ ${errorCount.toLocaleString()} ]건이 있습니다. 각 행의 상태 칸에서 상세 사유를 확인하세요.`, `${errorCount} errors — see the status column.`)}</span>
          : <AButton variant="primary" disabled={!canWrite || !rows.length} title={readOnlyTitle} loading={commit.isPending} onClick={() => setConfirm('commit')}>{tr('수강 등록하기', 'Register enrolments')}</AButton>}
        <span />
      </div>
      <ConfirmDialog open={confirm === 'delete'} tone="danger" title={tr('선택항목 삭제', 'Delete selected')} body={<p>{tr('선택한 항목을 삭제하시겠습니까?', 'Delete the selected rows?')}</p>} loading={del.isPending} onCancel={() => setConfirm(null)} onConfirm={() => del.mutate([...checked])} />
      <ConfirmDialog open={confirm === 'commit'} title={tr('수강 등록하기', 'Register enrolments')} body={<p>{tr('등록한 엑셀파일로 수강등록을 시작하시겠습니까?', 'Start registering the uploaded rows?')}</p>} loading={commit.isPending} onCancel={() => setConfirm(null)} onConfirm={() => commit.mutate(undefined)} />
      <StagedEditDrawer idx={edit} onClose={() => setEdit(null)} />
    </Card>
  );
}
