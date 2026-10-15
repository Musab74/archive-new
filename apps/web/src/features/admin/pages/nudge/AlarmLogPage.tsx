import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminNudgeApi, type AlarmRow } from '../../../../shared/api/endpoints/admin-nudge';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Callout, DataTable, DateField, DescList, DetailDrawer, FilterBar, FilterField, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { AppSelect } from '../../../../shared/ui/AppSelect';
import { useWriteGate } from '../../GrantGate';
import { adm } from '../../strings';
import { MessageBlock, addDaysIso, todayIso } from './nudgeShared';
import { InfoLink, useNudgeInfo } from './nudgeInfo';

const DEFAULTS = { from: '', to: '', sendType: 'ALL', category: '', result: '', col: 'name', q: '', page: 1 };
const SIZE = 30; // include_top.php $page_size
const CATEGORIES = ['20H 독려', '최종 독려', '80% 미만', '50% 미만'];
const COLS = [{ value: 'name', label: tr('이름', 'Name') }, { value: 'id', label: tr('아이디', 'User ID') }, { value: 'company', label: tr('사업주명', 'Company') }, { value: 'mobile', label: tr('휴대폰', 'Mobile') }, { value: 'message', label: tr('발송내역', 'Message') }, { value: 'batchKey', label: tr('배치키', 'Batch key') }];
const tone = (s: string) => (s === '전송성공' ? 'ok' : s.startsWith('접수') || s === '결과미기록' ? 'warn' : 'danger');

/** study_alarm_log.php — 알림발송내역 (C2): KakaoBulkSendLog ∪ SmsSendLog with result tallies and CSV export. */
export default function AlarmLogPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const defaultFrom = addDaysIso(todayIso(), -7); const defaultTo = todayIso();
  const [form, setForm] = useState({ from: p.from || defaultFrom, to: p.to || defaultTo, sendType: p.sendType, category: p.category, result: p.result, col: p.col, q: p.q });
  const { toast } = useToast();
  const { canWrite } = useWriteGate();
  const info = useNudgeInfo();
  const query = useMemo(() => ({ from: p.from || undefined, to: p.to || undefined, sendType: p.sendType, category: p.category || undefined, result: p.result || undefined, col: p.col, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'nudge', 'alarm-log', query], queryFn: ({ signal }) => adminNudgeApi.alarmLog(query, signal), placeholderData: keepPreviousData });
  const d = list.data; const total = d?.total ?? 0; const firstNo = total - (p.page - 1) * SIZE;
  const [sel, setSel] = useState<AlarmRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try { await adminNudgeApi.downloadAlarmLogCsv({ from: query.from, to: query.to, sendType: query.sendType, category: query.category, result: query.result, col: query.col, q: query.q }); }
    catch (err) { toast(isAppError(err) ? err.message : tr('목록을 내려받지 못했습니다.', 'Download failed.'), { tone: 'danger' }); }
    finally { setExporting(false); }
  };
  // study_alarm_log.php: choosing a 독려구분 forces SendType=KAKAO — show the type the API actually used
  useEffect(() => { if (d && d.sendType !== form.sendType && p.category) setForm((f) => ({ ...f, sendType: d.sendType })); }, [d?.sendType, p.category]); // eslint-disable-line react-hooks/exhaustive-deps
  // hrde_alarm_result_filters(): the 실패 reasons sit under an <optgroup label="실패"> (a disabled header row here)
  const resultOptions = useMemo(() => {
    const list = d?.resultFilters ?? [{ value: '', label: '전체', group: '', count: 0 }];
    const out: { value: string; label: string; disabled?: boolean }[] = [];
    let group = '';
    for (const f of list) {
      if (f.group && f.group !== group) out.push({ value: `__group_${f.group}`, label: `── ${f.group} ──`, disabled: true });
      group = f.group;
      out.push({ value: f.value, label: `${f.group ? '\u00a0\u00a0' : ''}${f.label}${d ? ` (${f.count.toLocaleString()})` : ''}` });
    }
    return out;
  }, [d]);
  const columns: Column<AlarmRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (_r, i) => firstNo - i },
    { key: 'typeLabel', header: tr('유형', 'Type'), align: 'center', nowrap: true, render: (r) => <StatusBadge tone={r.sendType === 'KAKAO' ? 'info' : 'neutral'}>{r.typeLabel}</StatusBadge> },
    { key: 'category', header: tr('독려구분', 'Category'), nowrap: true },
    { key: 'templateCode', header: tr('템플릿코드', 'Template'), nowrap: true, render: (r) => <span className="mono">{r.templateCode}</span> },
    { key: 'id', header: tr('아이디', 'User ID'), nowrap: true, render: (r) => r.id ? <InfoLink onClick={() => info.openMember(r.id)}>{r.id}</InfoLink> : '' },
    { key: 'name', header: tr('이름', 'Name'), nowrap: true, render: (r) => r.id ? <InfoLink onClick={() => info.openMember(r.id)}>{r.name ?? ''}</InfoLink> : (r.name ?? '') },
    { key: 'mobile', header: tr('휴대폰', 'Mobile'), nowrap: true, render: (r) => r.mobile ?? '' },
    { key: 'message', header: tr('발송내용', 'Message'), render: (r) => <div style={{ whiteSpace: 'pre-line', textAlign: 'left', minWidth: 220, maxWidth: 420, wordBreak: 'break-word' }}>{r.message ?? ''}</div> },
    { key: 'regDate', header: tr('발송일', 'Sent at'), nowrap: true, render: (r) => r.regDate ?? '' },
    { key: 'status', header: tr('상태', 'Status'), nowrap: true, render: (r) => <StatusBadge tone={tone(r.status)} title={r.apiMessage || undefined}>{r.status}</StatusBadge> },
    { key: 'companyName', header: tr('사업주', 'Company'), render: (r) => r.companyName ?? '' },
  ];
  const quick = (result: string) => setP({ ...form, from: form.from, to: form.to, result }, true);
  return (
    <AdminPage title={tr('알림발송내역', 'Notification log')} lead={tr('학습참여독려에서 보낸 알림톡·문자(SmsSendLog)와 일괄 카톡 발송(KakaoBulkSendLog) 내역입니다. 기본 조회기간은 최근 1주일입니다.', 'Kakao/SMS sent from Study nudges (SmsSendLog) and bulk Kakao sends (KakaoBulkSendLog). Default range: last 7 days.')}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ from: defaultFrom, to: defaultTo, sendType: 'ALL', category: '', result: '', col: 'name', q: '' }); reset(); }}
        extra={canWrite ? <AButton onClick={() => void exportCsv()} loading={exporting} disabled={!d || total === 0}>{tr('검색항목 엑셀(CSV) 출력', 'Export CSV')}</AButton> : undefined /* study_alarm_log.php: excel buttons only when AdminWrite=='Y' */}>
        <FilterField label={tr('조회기간 시작', 'From')} htmlFor="al-from" width={160}><DateField id="al-from" value={form.from} onChange={(v) => setForm({ ...form, from: v })} /></FilterField>
        <FilterField label={tr('조회기간 종료', 'To')} htmlFor="al-to" width={160}><DateField id="al-to" value={form.to} onChange={(v) => setForm({ ...form, to: v })} /></FilterField>
        <FilterField label={tr('발송유형', 'Channel')} htmlFor="al-type" width={150}><ASelect id="al-type" value={form.sendType} onChange={(e) => setForm({ ...form, sendType: e.target.value })} options={[{ value: 'ALL', label: tr('전체', 'All') }, { value: 'KAKAO', label: tr('알림톡/카톡', 'Kakao') }, { value: 'SMS', label: tr('문자(SMS)', 'SMS') }]} /></FilterField>
        <FilterField label={tr('독려구분', 'Category')} htmlFor="al-cat" width={150}><ASelect id="al-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, ...(e.target.value ? { sendType: 'KAKAO' } : {}) })} options={[{ value: '', label: tr('전체', 'All') }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} /></FilterField>
        <FilterField label={tr('발송결과', 'Result')} htmlFor="al-res" width={240}><AppSelect size="sm" id="al-res" value={form.result} onValueChange={(v) => { const next = { ...form, result: v }; setForm(next); setP(next, true); }} options={resultOptions} /></FilterField>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="al-col" width={130}><ASelect id="al-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={COLS} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="al-q" width={240}><AInput id="al-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      {d ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center', margin: '4px 0 10px' }}>
          <span className="muted">{d.from} ~ {d.to}</span>
          <AButton size="xs" variant={p.result === '' ? 'primary' : 'ghost'} onClick={() => quick('')}>{tr('전체', 'All')} <b>{d.counts.total.toLocaleString()}</b></AButton>
          <AButton size="xs" variant={p.result === 'success' ? 'primary' : 'ghost'} onClick={() => quick('success')}>{tr('성공', 'OK')} <b>{d.counts.ok.toLocaleString()}</b></AButton>
          <AButton size="xs" variant={p.result === 'fail' ? 'primary' : 'ghost'} onClick={() => quick('fail')}>{tr('실패', 'Failed')} <b>{d.counts.fail.toLocaleString()}</b></AButton>
          <AButton size="xs" variant={p.result === 'unknown' ? 'primary' : 'ghost'} onClick={() => quick('unknown')}>{tr('결과미기록', 'No result')} <b>{d.counts.unknown.toLocaleString()}</b></AButton>
          {p.result ? <span className="muted">({tr('현재 목록', 'current list')}: {total.toLocaleString()}{tr('건', '')})</span> : null}
          {!d.kakaoTableAvailable ? <StatusBadge tone="warn">{tr('일괄 카톡 로그 테이블 없음', 'bulk Kakao log table missing')}</StatusBadge> : null}
        </div>
      ) : null}
      <Callout tone="info">{tr('※ 발송 상태는 데이터 전송 여부가 아니라 카카오의 실제 수신결과를 확인한 뒤 표기됩니다. 결과 회신이 늦어지는 건은 "접수(결과대기)"로 표시되며 최대 10분 이내 실제 결과로 바뀝니다. 매일 새벽 04:25에 최근 발송분을 전수 재확인합니다(기존 사이트 크론).', 'Status reflects the carrier receipt, not just hand-off. Late receipts show as "접수(결과대기)" and settle within ~10 minutes; a nightly 04:25 job on the legacy site re-checks recent sends.')}</Callout>
      <DataTable columns={columns} rows={d?.items} rowKey={(r) => r.key} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={setSel} selectedKey={sel?.key ?? null} emptyTitle={tr('등록된 발송내역이 없습니다.', 'No records.')} dense />
      <DetailDrawer open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.typeLabel} · ${sel.status}` : ''} subtitle={sel ? `${sel.name ?? ''} (${sel.id ?? ''}) · ${sel.regDate ?? ''}` : ''} wide footer={<AButton onClick={() => setSel(null)}>{adm.common.close}</AButton>}>
        {sel ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <DescList cols={2} items={[[tr('유형', 'Type'), sel.typeLabel], [tr('독려구분', 'Category'), sel.category], [tr('템플릿코드', 'Template'), sel.templateCode], [tr('휴대폰', 'Mobile'), sel.mobile], [tr('사업주', 'Company'), sel.companyName], [tr('배치키 / Mid', 'Batch key / Mid'), sel.batchKey || sel.mid || '-'], [tr('결과코드', 'Code'), sel.code || '-'], [tr('API 코드', 'API code'), sel.apiCode || '-'], [tr('API 메시지', 'API message'), sel.apiMessage || '-'], [tr('로그 idx', 'Log idx'), String(sel.idx)]]} />
          <MessageBlock text={sel.message} />
        </div> : null}
      </DetailDrawer>
      {info.drawers}
    </AdminPage>
  );
}
