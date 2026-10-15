import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminStudiesParityApi, type BatchKind, type BatchResult, type PostCell, type PreCell, type StudyManageOptions } from '../../../../shared/api/endpoints/admin-studies-parity';
import { AButton, AInput, ASelect, ATextarea, Callout, DataTable, DateField, DescList, FieldRow, StatusBadge, toIsoDate, type Column } from '../../../../shared/ui/admin';
import { Modal } from '../../../../shared/ui/Modal';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';

/** Popups of hrd_manager study.php / progress_info_pop.php rebuilt as modals (study_time_info_pop, certificate_layer, pre_assessment_resume_pop, assessment_access_grant_pop, study_*_change_batch). */

const errText = (e: unknown, fallback: string) => (isAppError(e) ? e.message : fallback);
const pill = (bg: string, fg: string): CSSProperties => ({ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 999, background: bg, color: fg, fontSize: 11, fontWeight: 700 });

// ------------------------------------------------------------------------------------------- 사전 / 사후 cells (study_search_result.php)

export function PreCellView({ cell, onResume, onOpen }: { cell: PreCell; onResume: () => void; onOpen: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {cell.label === 'Y' && cell.date ? <><span>{tr('완료', 'Done')}</span><span className="muted" style={{ fontSize: 11 }}>{cell.date}</span></> : <span>{cell.label}</span>}
      {cell.showResume ? <AButton size="xs" onClick={onResume}>{tr('이어하기', 'Resume info')}</AButton> : null}
      {cell.open === 'auto' ? <span style={pill('#eff6ff', '#1d4ed8')}>{tr('자동 오픈', 'Auto open')}</span> : null}
      {cell.open === 'granted' ? <><span style={pill('#166534', '#fff')}>{tr('사전 열림', 'Pre open')}</span><span style={{ fontSize: 11, color: '#166534' }}>{tr(`${cell.grantExpiresAt ?? ''}까지`, `until ${cell.grantExpiresAt ?? ''}`)}</span></> : null}
      {cell.open === 'button' ? <AButton size="xs" variant="danger" onClick={onOpen}>{tr('사전 열기', 'Open pre')}</AButton> : null}
    </div>
  );
}

export function PostCellView({ cell, onOpen }: { cell: PostCell; onOpen: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {cell.yn === 'Y' && cell.date ? <><span>{tr('완료', 'Done')}</span><span className="muted" style={{ fontSize: 11 }}>{cell.date}</span></> : <span>{cell.yn}</span>}
      {cell.open === 'auto' ? <><span style={pill('#eff6ff', '#1d4ed8')}>{tr('자동 오픈', 'Auto open')}</span><span className="muted" style={{ fontSize: 11 }}>{cell.openReason === '15시간 충족' ? tr('15시간 충족', '15 h met') : tr('기존 시스템 조건 충족', 'Legacy condition met')}</span></> : null}
      {cell.open === 'granted' ? <><span style={pill('#166534', '#fff')}>{tr('사후 열림', 'Post open')}</span><span style={{ fontSize: 11, color: '#166534' }}>{tr(`${cell.grantExpiresAt ?? ''}까지`, `until ${cell.grantExpiresAt ?? ''}`)}</span></> : null}
      {cell.open === 'button' ? <AButton size="xs" variant="danger" onClick={onOpen}>{tr('사후 열기', 'Open post')}</AButton> : null}
    </div>
  );
}

const CloseBtn = ({ onClose }: { onClose: () => void }) => <AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton>;

// ------------------------------------------------------------------------------------------- 일자별 수강시간 정보 (study_time_info_pop.php)

export function DayTimeDialog({ seq, onClose }: { seq: number | null; onClose: () => void }) {
  const [date, setDate] = useState(toIsoDate(new Date()));
  useEffect(() => { if (seq) setDate(toIsoDate(new Date())); }, [seq]);
  const q = useQuery({ queryKey: ['admin', 'study-day-time', seq, date], queryFn: ({ signal }) => adminStudiesParityApi.dayTime(seq!, date || undefined, signal), enabled: !!seq });
  return (
    <Modal open={!!seq} onClose={onClose} title={tr('일자별 수강시간 정보', 'Study time by date')} size="lg" actions={<CloseBtn onClose={onClose} />}>
      <FieldRow label={tr('수강날짜', 'Date')} htmlFor="dt-date"><DateField id="dt-date" value={date} onChange={setDate} /></FieldRow>
      {q.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void q.refetch()} /> : (
        <table className="u-mt-8" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{[tr('수강날짜', 'Date'), tr('사업주 / 사업주번호', 'Company / code'), tr('이름 / ID', 'Name / ID'), tr('수강시간', 'Study time')].map((h) => <th key={h} style={{ borderBottom: '1px solid var(--c-line)', padding: 6, textAlign: 'center' }}>{h}</th>)}</tr></thead>
          <tbody><tr>
            <td style={{ padding: 6, textAlign: 'center' }}>{q.data?.date ?? date}</td>
            <td style={{ padding: 6, textAlign: 'center' }}>{q.data ? <>{q.data.companyName ?? ''}<br /><span className="mono">{q.data.companyCode ?? ''}</span></> : '…'}</td>
            <td style={{ padding: 6, textAlign: 'center' }}>{q.data ? <>{q.data.name ?? ''}<br />{q.data.id}</> : '…'}</td>
            <td style={{ padding: 6, textAlign: 'center' }}><b>{q.data?.label ?? '…'}</b></td>
          </tr></tbody>
        </table>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{tr('그날 갱신된 차시마다 그날 진도 로그의 최대 누적 − 최소 누적을 더한 값입니다(기존 화면과 같은 계산).', 'Sum over chapters touched that day of (max − min) cumulative seconds in that day’s progress log (same as the previous site).')}</p>
    </Modal>
  );
}

// ------------------------------------------------------------------------------------------- 수료증 출력 (certificate_layer.php)

export function CertificateDialog({ seq, onClose }: { seq: number | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['admin', 'study-certificate', seq], queryFn: ({ signal }) => adminStudiesParityApi.certificate(seq!, signal), enabled: !!seq, retry: false });
  const d = q.data;
  const batchHref = d && d.companyCode ? `/admin/learning/certificates/print?companyCode=${encodeURIComponent(d.companyCode)}&lectureStart=${d.lectureStart}&lectureEnd=${d.lectureEnd}` : null;
  return (
    <Modal open={!!seq} onClose={onClose} title={tr('수료증 출력', 'Certificate of completion')}
      actions={<>{d ? <AButton variant="primary" to={`/admin/studies/${d.studySeq}?print=certificate`}>{tr('수료증 PDF로 출력하기', 'Print certificate (PDF)')}</AButton> : null}{batchHref ? <AButton to={batchHref}>{tr('같은 사업주·기간 일괄 출력', 'Print all of this company & term')}</AButton> : null}<CloseBtn onClose={onClose} /></>}>
      {q.isError ? <Callout tone="warn">{errText(q.error, tr('수료여부를 확인하세요.', 'Check the completion status.'))}</Callout> : !d ? <p className="muted">…</p> : (
        <>
          <DescList items={[[tr('성명', 'Name'), d.name], [tr('생년월일', 'Birth date'), d.birthDay], [tr('소속', 'Company'), d.companyName], [tr('훈련과정', 'Course'), d.courseName], [tr('훈련기간', 'Period'), d.periodLabel]]} />
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{tr('“수료증 PDF로 출력하기”는 이 수강 1건의 수료증(certificate_pdf01)을 A4로 열어 브라우저 인쇄/PDF 저장합니다.', '“Print certificate” opens this enrollment’s certificate as an A4 page for print / PDF.')}</p>
        </>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------------------------------- 사전역량진단 이어하기 안내 (pre_assessment_resume_pop.php)

export function PreResumeDialog({ seq, onClose }: { seq: number | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['admin', 'study-pre-resume', seq], queryFn: ({ signal }) => adminStudiesParityApi.preResume(seq!, signal), enabled: !!seq });
  const d = q.data;
  return (
    <Modal open={!!seq} onClose={onClose} title={tr('사전역량진단 이어하기 안내', 'Resume the pre-assessment')} actions={<CloseBtn onClose={onClose} />}>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{tr('학습자에게 원시 URL을 전달하지 말고, 로그인 후 마이페이지의 사전역량진단 버튼으로 이어서 진행하도록 안내하세요.', 'Do not send raw URLs; ask the learner to continue from My page after logging in.')}</p>
      {q.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void q.refetch()} /> : !d ? <p className="muted">…</p> : (
        <DescList items={[
          [tr('학습자', 'Learner'), `${d.name ?? ''} (${d.id})`], [tr('수강 Seq', 'Enrollment Seq'), d.studySeq],
          [tr('진행상태', 'Status'), <span key="s">{d.label}<span className="muted" style={{ display: 'block', fontSize: 12 }}>{tr(`공통/리더십 ${d.commonAnswered}/${d.commonRequired}, 직급별 ${d.roleAnswered}/${d.roleRequired}`, `Common/leadership ${d.commonAnswered}/${d.commonRequired}, role ${d.roleAnswered}/${d.roleRequired}`)}</span></span>],
          [tr('다음 단계', 'Next step'), <span key="n"><b style={{ color: '#1d4ed8' }}>{d.stepLabel}</b><span style={{ display: 'block' }}>{d.stepDetail}</span></span>],
        ]} />
      )}
      <Callout className="u-mt-8">{tr('안내 문구: 학습자에게 로그인 후 마이페이지 > 역량진단 > 사전역량진단 이어하기 버튼을 클릭하도록 안내하세요. 새로고침이나 뒤로가기 이후에도 저장된 응답 기준으로 다음 단계가 자동 선택됩니다.', 'Script: after logging in, open My page > Assessment > Continue pre-assessment. Saved answers decide the next step automatically.')}</Callout>
    </Modal>
  );
}

// ------------------------------------------------------------------------------------------- 학습자 역량진단 접근 열기 (assessment_access_grant_pop.php)

export function GrantDialog({ target, onClose, onDone }: { target: { seq: number; type: 'PRE' | 'POST' } | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(''); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { setName(''); setReason(''); setMsg(null); }, [target]);
  const q = useQuery({ queryKey: ['admin', 'study-grant', target?.seq, target?.type], queryFn: ({ signal }) => adminStudiesParityApi.grantInfo(target!.seq, target!.type, signal), enabled: !!target });
  const d = q.data;
  const submit = async () => {
    if (!target) return;
    if (!name.trim()) { toast(tr('요청자 성명을 입력해 주세요.', 'Enter the requester name.'), { tone: 'danger' }); return; }
    if (reason.trim().length < 10) { toast(tr('개방 사유는 10자 이상 입력해 주세요.', 'The reason needs at least 10 characters.'), { tone: 'danger' }); return; }
    setBusy(true);
    try { const r = await adminStudiesParityApi.grantCreate(target.seq, { type: target.type, operatorName: name.trim(), reason: reason.trim() }); setMsg(r.message); toast(r.message, { tone: 'ok' }); onDone(); }
    catch (e) { toast(errText(e, tr('권한 부여 실패', 'Grant failed')), { tone: 'danger' }); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={!!target} onClose={onClose} title={tr('학습자 역량진단 접근 열기', 'Open assessment access')} size="lg"
      actions={<><AButton onClick={onClose}>{tr('취소', 'Cancel')}</AButton>{d?.canIssue && !msg ? <AButton variant="primary" loading={busy} onClick={() => void submit()}>{tr('학습자 진단 열기', 'Open for learner')}</AButton> : null}</>}>
      <p style={{ marginTop: 0, color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>{tr('1차와 2차는 별개 차수입니다. 아래 정보를 반드시 확인한 뒤 진행하세요.', 'Round 1 and round 2 are separate. Check the details below first.')}</p>
      {q.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void q.refetch()} /> : !d ? <p className="muted">…</p> : (
        <>
          <DescList items={[
            [tr('학습자', 'Learner'), `${d.name ?? ''} (${d.id})`], [tr('수강 Seq', 'Enrollment Seq'), <b key="s">{d.studySeq}</b>], [tr('차수 구분', 'Round'), <b key="r" style={{ color: '#1d4ed8' }}>{d.sessionLabel}</b>],
            [tr('진단 유형', 'Type'), `${d.typeLabel} (${d.type})`],
            ...(d.activeGrant ? [[tr('현재 권한', 'Active grant'), <span key="g" style={{ color: '#166534' }}>{tr('이미 활성 권한이 있습니다.', 'Already active.')} <span className="muted">{tr(`만료: ${d.activeGrant.expiresAt}`, `expires ${d.activeGrant.expiresAt}`)}</span></span>] as [ReactNode, ReactNode]] : []),
            ...(!d.canIssue ? [[tr('처리 불가', 'Not possible'), <span key="e" style={{ color: '#b91c1c' }}>{d.errors.join(' ')}</span>] as [ReactNode, ReactNode]] : []),
          ]} />
          {d.canIssue ? (
            <div className="u-mt-8">
              <Callout tone="warn">{tr(`요청자 성명과 개방 사유를 입력하면 학습자가 로그인 후 해당 차수의 ${d.typeLabel}을 마이페이지에서 진행할 수 있습니다. 관리자는 진단을 대신 수행하지 않습니다. 사후진단을 먼저 열어도 수료(PassOK)는 기존과 동일하게 현재 2차 수강의 15시간 충족 후에만 처리됩니다.`, `After you enter your name and a reason, the learner can take the ${d.typeLabel} from My page for this round. Admins never answer for the learner; PassOK still needs the 15 h rule.`)}</Callout>
              <FieldRow label={tr('요청자 성명', 'Requester')} htmlFor="g-name" required><AInput id="g-name" value={name} maxLength={50} placeholder={tr('본인 실명', 'Your real name')} onChange={(e) => setName(e.target.value)} /></FieldRow>
              <FieldRow label={tr('개방 사유', 'Reason')} htmlFor="g-reason" required><ATextarea id="g-reason" rows={4} value={reason} maxLength={1000} placeholder={tr('왜 이 차수의 진단 접근을 열어야 하는지 구체적으로 작성 (10자 이상)', 'Why this access is needed (10+ characters)')} onChange={(e) => setReason(e.target.value)} /></FieldRow>
              {msg ? <Callout tone="ok">{msg}</Callout> : null}
            </div>
          ) : null}
        </>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------------------------------- 일괄변경 팝업 (study_lectureterme / openchapter / sales / servicetype _change_batch.php)

const BATCH_TITLE: Record<BatchKind, string> = { term: tr('수강기간 일괄변경', 'Change study period'), openChapter: tr('실시회차 일괄변경', 'Change round'), sales: tr('영업담당자 일괄변경', 'Change sales rep'), serviceType: tr('개설용도 일괄변경', 'Change purpose') };
const CHUNK = 100;

export function BatchDialog({ kind, filters, options, onClose, onDone }: { kind: BatchKind | null; filters: Record<string, string | number | undefined>; options?: StudyManageOptions; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const q = useQuery({ queryKey: ['admin', 'study-batch-targets', kind, filters], queryFn: ({ signal }) => adminStudiesParityApi.batchTargets({ ...filters, kind: kind! }, signal), enabled: !!kind });
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<Map<number, { ok: boolean; message: string }>>(new Map());
  const [progress, setProgress] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { setChecked(new Set((q.data?.items ?? []).map((i) => i.studySeq))); setStatus(new Map()); setProgress(null); }, [q.data]);
  useEffect(() => { setValue(''); }, [kind]);
  const items = q.data?.items ?? [];
  const valueLabel = kind === 'sales' ? options?.salesStaff.find((s) => s.id === value)?.name ?? value : kind === 'serviceType' ? (value === 'A' ? tr('패키지(환급)', 'Package (refund)') : value === 'W' ? tr('비환급', 'Non-refund') : '') : value;
  const run = async () => {
    setConfirming(false);
    const seqs = items.filter((i) => checked.has(i.studySeq)).map((i) => i.studySeq);
    const next = new Map<number, { ok: boolean; message: string }>();
    setProgress(0);
    try {
      for (let i = 0; i < seqs.length; i += CHUNK) {
        const part = seqs.slice(i, i + CHUNK);
        let r: BatchResult;
        if (kind === 'term') r = await adminStudiesParityApi.changeLectureTerm(part, value);
        else if (kind === 'openChapter') r = await adminStudiesParityApi.changeOpenChapter(part, Number(value));
        else if (kind === 'sales') r = await adminStudiesParityApi.changeSales(part, value);
        else r = await adminStudiesParityApi.changeServiceType(part, value as 'A' | 'W');
        for (const it of r.items) next.set(it.seq, { ok: it.ok, message: it.message });
        setStatus(new Map(next)); setProgress(Math.round(((i + part.length) / seqs.length) * 10000) / 100);
      }
      const failed = [...next.values()].filter((v) => !v.ok).length;
      toast(failed ? tr(`변경 일괄처리가 완료되었습니다. 실패 ${failed}건`, `Done with ${failed} failure(s).`) : tr('변경 일괄처리가 완료되었습니다.', 'Batch change completed.'), { tone: failed ? 'warn' : 'ok' });
      onDone();
    } catch (e) { toast(errText(e, tr('처리중 문제가 발생했습니다.', 'The batch failed.')), { tone: 'danger' }); }
    finally { setProgress(null); }
  };
  const start = () => {
    if (!items.length) { toast(tr('검색된 항목이 없습니다.', 'Nothing found.'), { tone: 'warn' }); return; }
    if (!checked.size) { toast(tr('선택된 항목이 없습니다.', 'Nothing selected.'), { tone: 'warn' }); return; }
    if (!value) { toast(kind === 'term' ? tr('변경하려는 수강기간을 선택하세요.', 'Choose the new period.') : kind === 'openChapter' ? tr('변경하려는 실시회차를 선택하세요.', 'Enter the new round.') : kind === 'sales' ? tr('변경하려는 영업담당자를 선택하세요.', 'Choose the sales rep.') : tr('변경하려는 개설용도를 선택하세요.', 'Choose the purpose.'), { tone: 'warn' }); return; }
    setConfirming(true);
  };
  const cols: Column<(typeof items)[number]>[] = [
    { key: 'chk', header: <input type="checkbox" aria-label={tr('전체 선택', 'Select all')} checked={items.length > 0 && checked.size === items.length} onChange={(e) => setChecked(e.target.checked ? new Set(items.map((i) => i.studySeq)) : new Set())} />, width: 36, align: 'center', render: (r) => <input type="checkbox" aria-label={`Seq ${r.studySeq}`} checked={checked.has(r.studySeq)} onChange={(e) => { const n = new Set(checked); if (e.target.checked) n.add(r.studySeq); else n.delete(r.studySeq); setChecked(n); }} /> },
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56 },
    { key: 'serviceTypeLabel', header: tr('개설 용도', 'Purpose'), nowrap: true },
    { key: 'id', header: 'ID', nowrap: true },
    { key: 'name', header: tr('성명', 'Name'), render: (r) => r.name ?? '' },
    { key: 'period', header: tr('기간', 'Period'), nowrap: true },
    { key: 'openChapter', header: tr('실시회차', 'Round'), align: 'center', render: (r) => r.openChapter ?? '' },
    { key: 'courseName', header: tr('과정명', 'Course'), render: (r) => r.courseName ?? '' },
    { key: 'storedProgress', header: tr('진도율 (%)', 'Progress (%)'), align: 'right', render: (r) => `${r.storedProgress}%` },
    { key: 'passOkLabel', header: tr('수료여부', 'Passed'), align: 'center' },
    ...(kind === 'sales' ? [{ key: 'salesName', header: tr('영업담당자', 'Sales rep'), render: (r: (typeof items)[number]) => (r.salesId ? `${r.salesName ?? ''} (${r.salesId})` : '') }] : []),
    { key: 'status', header: tr('진행상태', 'Status'), align: 'center', render: (r) => { const s = status.get(r.studySeq); return s ? <StatusBadge tone={s.ok ? 'ok' : 'danger'}>{s.message}</StatusBadge> : progress !== null && !checked.has(r.studySeq) ? tr('제외', 'Skipped') : '-'; } },
  ];
  const picker = kind === 'term' ? <ASelect id="b-val" value={value} onChange={(e) => setValue(e.target.value)} options={[{ value: '', label: tr('-- 기간 선택 --', '-- period --') }, ...(options?.periods ?? []).map((p) => ({ value: p, label: p }))]} />
    : kind === 'openChapter' ? <AInput id="b-val" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
      : kind === 'sales' ? <ASelect id="b-val" value={value} onChange={(e) => setValue(e.target.value)} options={[{ value: '', label: tr('영업담당자 선택', 'Choose sales rep') }, ...(options?.salesStaff ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.id})` }))]} />
        : <ASelect id="b-val" value={value} onChange={(e) => setValue(e.target.value)} options={[{ value: '', label: tr('개설용도 선택', 'Choose purpose') }, { value: 'A', label: tr('패키지(환급)', 'Package (refund)') }, { value: 'W', label: tr('비환급', 'Non-refund') }]} />;
  return (
    <>
      <Modal open={!!kind && !confirming} onClose={progress === null ? onClose : () => undefined} title={kind ? BATCH_TITLE[kind] : ''} size="lg" dismissible={progress === null}
        actions={<><AButton onClick={onClose} disabled={progress !== null}>{tr('닫기', 'Close')}</AButton><AButton variant="primary" onClick={start} loading={progress !== null} disabled={!items.length}>{tr('체크항목 일괄 변경하기', 'Apply to checked rows')}</AButton></>}>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{tr('일괄변경 대상 | 변경을 원하지 않는 항목은 체크를 해제하세요. (현재 검색 조건의 수강 목록)', 'Targets = the current search. Uncheck rows you do not want to change.')}</p>
        <FieldRow label={kind === 'term' ? tr('변경할 수강기간', 'New period') : kind === 'openChapter' ? tr('변경할 실시회차', 'New round') : kind === 'sales' ? tr('변경할 영업담당자', 'New sales rep') : tr('변경할 개설용도', 'New purpose')} htmlFor="b-val">{picker}</FieldRow>
        {progress !== null ? <Callout>{tr(`진행률 ${progress.toFixed(2)} %`, `Progress ${progress.toFixed(2)} %`)}</Callout> : null}
        {q.data?.truncated ? <Callout tone="warn">{tr(`대상이 많아 처음 ${q.data.cap.toLocaleString('ko-KR')}건만 표시합니다. 검색 조건을 좁혀 주세요.`, `Only the first ${q.data.cap} rows are shown; narrow the search.`)}</Callout> : null}
        <div className="u-mt-8" style={{ maxHeight: '55vh', overflow: 'auto' }}>
          <DataTable columns={cols} rows={q.data?.items} rowKey={(r) => r.studySeq} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense emptyTitle={tr('검색된 내용이 없습니다.', 'No results.')} />
        </div>
      </Modal>
      <Modal open={confirming} onClose={() => setConfirming(false)} title={kind ? BATCH_TITLE[kind] : ''} symbol="alert" symbolTone="warn"
        actions={<><AButton onClick={() => setConfirming(false)}>{tr('취소', 'Cancel')}</AButton><AButton variant="primary" onClick={() => void run()}>{tr('확인', 'Confirm')}</AButton></>}>
        <p>{tr(`체크된 ${checked.size}건의 ${kind === 'term' ? '수강기간' : kind === 'openChapter' ? '실시회차' : kind === 'sales' ? '영업담당자' : '개설용도'}을(를) [ ${valueLabel} ] 로 변경하시겠습니까?`, `Change ${checked.size} checked row(s) to [ ${valueLabel} ]?`)}</p>
        <p className="muted">{tr('변경작업은 1번항목부터 순차적으로 진행됩니다. 작업이 완료 될 때 까지 기다려 주세요.', 'Rows are processed in order; wait until it finishes.')}</p>
      </Modal>
    </>
  );
}

// ------------------------------------------------------------------------------------------- 차시 상세 로그 (progress_info_pop_log.php)

export function ChapterTicks({ seq, lectureCode, studySeq, chapterSeq }: { seq: number; lectureCode: string; studySeq: number; chapterSeq: number }) {
  const q = useQuery({ queryKey: ['admin', 'study-chapter-log', seq, lectureCode, studySeq, chapterSeq], queryFn: ({ signal }) => adminStudiesParityApi.chapterLog(seq, { lectureCode, studySeq, chapterSeq }, signal) });
  const d = q.data && q.data.mode === 'ticks' ? q.data : null;
  const rows = useMemo(() => d?.items ?? [], [d]);
  type Tick = (typeof rows)[number];
  const cols: Column<Tick>[] = [
    { key: 'no', header: tr('순번', 'No.'), align: 'right', width: 56 },
    { key: 'progress', header: tr('차시 진도', 'Chapter progress'), align: 'right', render: (r) => `${r.progress}%` },
    { key: 'studyTimeLabel', header: tr('학습시간', 'Study time'), nowrap: true, render: (r) => <span style={r.sameMinute ? { color: 'var(--c-danger)', fontWeight: 700 } : undefined}>{r.studyTimeLabel}</span> },
    { key: 'positionSec', header: tr('재생위치', 'Position'), align: 'right', render: (r) => r.positionSec ?? '-' },
    { key: 'ip', header: tr('수강 IP', 'IP'), render: (r) => <span className="mono">{r.ip ?? ''}</span> },
    { key: 'at', header: tr('수강시간', 'Recorded at'), nowrap: true, render: (r) => <span style={r.sameMinute ? { color: 'var(--c-danger)' } : undefined}>{r.at}</span> },
    { key: 'lastStudy', header: tr('최종 강의 페이지', 'Last page'), render: (r) => r.lastStudy ?? '' },
  ];
  return (
    <div style={{ padding: '6px 0 6px 24px' }}>
      <b style={{ fontSize: 13 }}>{tr(`${d?.chapterNo ?? ''}차시 상세 로그`, `Chapter ${d?.chapterNo ?? ''} log`)}</b>
      {d && d.sameCount > 0 ? <Callout tone="warn" className="u-mt-8">{tr(`빨간색 ${d.sameCount}행은 같은 분에 다른 차시도 학습시간이 함께 늘어난 기록입니다.`, `${d.sameCount} red row(s): another chapter also gained time in the same minute.`)}</Callout> : null}
      <div className="u-mt-8"><DataTable columns={cols} rows={q.isPending ? undefined : rows} rowKey={(r) => r.idx} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense size={100} emptyTitle={tr('차시 상세 내역이 없습니다.', 'No log rows.')} emptyBody=" " /></div>
    </div>
  );
}

export const MemberLinkCell = ({ id, name }: { id: string; name?: string | null }) => <Link to={`/admin/members/${encodeURIComponent(id)}`}>{name ?? ''}<br />{id}</Link>;
