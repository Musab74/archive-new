import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { AdminCourseDetail } from '../../../../shared/api/schemas';
import { AButton, ACheckbox, AdminPage, AInput, ASelect, ATextarea, Callout, Card, DataTable, DescList, FieldRow, type Column } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { contentType } from '../../../../shared/strings/ko';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';

const KEYS = ['ContentsName', 'Category1', 'Category2', 'Keyword1', 'Keyword2', 'Keyword3', 'Keyword4', 'Intro', 'EduTarget', 'EduGoal', 'ContentsTime'] as const;
type Form = Record<(typeof KEYS)[number], string> & { UseYN: boolean };
const toForm = (d: AdminCourseDetail): Form => ({ ContentsName: d.name ?? '', Category1: d.category1 ?? '', Category2: d.category2 ?? '', Keyword1: d.keyword1 ?? '', Keyword2: d.keyword2 ?? '', Keyword3: d.keyword3 ?? '', Keyword4: d.keyword4 ?? '', Intro: d.intro ?? '', EduTarget: d.eduTarget ?? '', EduGoal: d.eduGoal ?? '', ContentsTime: d.contentsTime ?? '', UseYN: d.useYN === 'Y' });
export function courseDiff(base: Form, cur: Form): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of KEYS) if (base[k] !== cur[k]) out[k] = cur[k].trim() === '' ? (k === 'ContentsName' ? base[k] : null) : cur[k];
  if (base.UseYN !== cur.UseYN) out.UseYN = cur.UseYN ? 'Y' : 'N';
  return out;
}
type Term = AdminCourseDetail['terms'][number];
const termCols: Column<Term>[] = [
  { key: 'idx', header: 'idx', align: 'right' },
  { key: 'start', header: '시작', nowrap: true, render: (r) => r.start ?? '' },
  { key: 'end', header: '종료', nowrap: true, render: (r) => r.end ?? '' },
  { key: 'serviceType', header: '유형', render: (r) => r.serviceType ?? '' },
  { key: 'openYear', header: '연도', render: (r) => String(r.openYear ?? '') },
  { key: 'openTerme', header: '회차', render: (r) => String(r.openTerme ?? '') },
  { key: 'openChapter', header: '차시', render: (r) => String(r.openChapter ?? '') },
];

export default function CourseEditPage() {
  const { idx = '' } = useParams();
  const n = Number(idx);
  const { canWrite, readOnlyTitle } = useWriteGate();
  const q = useQuery({ queryKey: ['admin', 'course', n], queryFn: ({ signal }) => adminApi.course(n, signal), enabled: n > 0 });
  const cats = useQuery({ queryKey: ['admin', 'categories'], queryFn: ({ signal }) => adminApi.categories(signal), staleTime: 10 * 60_000 });
  const d = q.data;
  const [form, setForm] = useState<Form | null>(null);
  useEffect(() => { if (d) setForm(toForm(d)); }, [d]);
  const save = useAdminMutation({ fn: (body: Record<string, unknown>) => adminApi.patchCourse(n, body), invalidate: [['admin', 'course', n], ['admin', 'courses']], success: adm.common.saved });
  const dirty = useMemo(() => (d && form ? Object.keys(courseDiff(toForm(d), form)).length > 0 : false), [d, form]);
  const cat1 = useMemo(() => (cats.data?.tree ?? []).map((t) => ({ value: t.name ?? '', label: t.name ?? '' })), [cats.data]);
  const cat2 = useMemo(() => { const t = (cats.data?.tree ?? []).find((x) => x.name === form?.Category1); return (t?.children ?? []).map((ch) => ({ value: ch.name ?? '', label: ch.name ?? '' })); }, [cats.data, form?.Category1]);
  const e = adm.courses.edit;
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  return (
    <AdminPage title={`${e.title}${d ? ` · ${d.name ?? ''} (${d.lectureCode})` : ''}`} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: adm.courses.title, to: '/admin/courses' }, { label: idx }]}
      actions={<><AButton to="/admin/courses">{adm.common.back}</AButton>{d ? <AButton to={`/admin/courses/${encodeURIComponent(d.lectureCode)}/chapters`}>{e.chapters}</AButton> : null}<AButton variant="primary" disabled={!canWrite || !dirty} title={readOnlyTitle} loading={save.isPending} onClick={() => { if (d && form) save.mutate(courseDiff(toForm(d), form)); }}>{adm.common.save}</AButton></>}>
      {q.isError ? <StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /> : q.isPending || !d || !form ? <Skeleton lines={8} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 12, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title={e.basic}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FieldRow label={e.name} htmlFor="ce-name" required><AInput id="ce-name" value={form.ContentsName} onChange={(ev) => set({ ContentsName: ev.target.value })} maxLength={200} disabled={!canWrite} /></FieldRow>
                <FieldRow label={e.useYN} help={e.hideWarn}><ACheckbox label="사이트에 노출(UseYN=Y)" checked={form.UseYN} onChange={(ev) => set({ UseYN: ev.target.checked })} disabled={!canWrite} /></FieldRow>
                <FieldRow label={e.contentsTime} htmlFor="ce-time"><AInput id="ce-time" value={form.ContentsTime} onChange={(ev) => set({ ContentsTime: ev.target.value })} maxLength={20} style={{ width: 160 }} disabled={!canWrite} /></FieldRow>
              </div>
            </Card>
            <Card title={e.meta}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FieldRow label={e.category1} htmlFor="ce-c1">{cat1.length ? <ASelect id="ce-c1" value={form.Category1} onChange={(ev) => set({ Category1: ev.target.value, Category2: '' })} options={cat1} placeholder="선택" disabled={!canWrite} /> : <AInput id="ce-c1" value={form.Category1} onChange={(ev) => set({ Category1: ev.target.value })} maxLength={50} disabled={!canWrite} />}</FieldRow>
                <FieldRow label={e.category2} htmlFor="ce-c2">{cat2.length ? <ASelect id="ce-c2" value={form.Category2} onChange={(ev) => set({ Category2: ev.target.value })} options={cat2} placeholder="선택" disabled={!canWrite} /> : <AInput id="ce-c2" value={form.Category2} onChange={(ev) => set({ Category2: ev.target.value })} maxLength={50} disabled={!canWrite} />}</FieldRow>
                {([1, 2, 3, 4] as const).map((i) => { const k = `Keyword${i}` as const; return <FieldRow key={k} label={e.keyword(i)} htmlFor={`ce-${k}`}><AInput id={`ce-${k}`} value={form[k]} onChange={(ev) => set({ [k]: ev.target.value } as Partial<Form>)} maxLength={100} disabled={!canWrite} list="kw-list" /></FieldRow>; })}
                <datalist id="kw-list">{(cats.data?.keywords ?? []).map((k) => <option key={k.idx} value={k.keyword ?? ''} />)}</datalist>
              </div>
            </Card>
            <Card title={e.text}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FieldRow label={e.intro} htmlFor="ce-intro"><ATextarea id="ce-intro" value={form.Intro} onChange={(ev) => set({ Intro: ev.target.value })} rows={8} maxLength={20000} disabled={!canWrite} /></FieldRow>
                <FieldRow label={e.eduTarget} htmlFor="ce-target"><ATextarea id="ce-target" value={form.EduTarget} onChange={(ev) => set({ EduTarget: ev.target.value })} rows={4} maxLength={5000} disabled={!canWrite} /></FieldRow>
                <FieldRow label={e.eduGoal} htmlFor="ce-goal"><ATextarea id="ce-goal" value={form.EduGoal} onChange={(ev) => set({ EduGoal: ev.target.value })} rows={4} maxLength={5000} disabled={!canWrite} /></FieldRow>
              </div>
            </Card>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dirty ? <Callout tone="warn">{adm.courses.lists.dirty}</Callout> : null}
            <Card title={e.readonly}>
              <DescList items={[['코드', d.lectureCode], ['유형', `${d.ctype ?? ''} ${contentType[d.ctype ?? ''] ?? ''}`], ['HRD', `${d.hrdCode ?? '-'} / seq ${d.hrdSeq ?? '-'}`], ['패키지', d.isPackage ? d.packageCodes.join(', ') : 'N'], ['서비스·모바일', `${d.serviceType ?? '-'} · ${d.mobile ?? '-'}`], ['콘텐츠 URL', d.contentsUrl], ['모바일 URL', d.mobileUrl], ['제공기간', `${d.contentsStart ?? ''} ~ ${d.contentsEnd ?? ''}`], ['가격', d.prices ? `${d.prices.normal.toLocaleString('ko-KR')} / 우선 ${d.prices.priority.toLocaleString('ko-KR')} / 대 ${d.prices.large1.toLocaleString('ko-KR')} / ${d.prices.large2.toLocaleString('ko-KR')}` : null], ['법정교육', d.legalEduReq], ['수강 건수', d.enrollments], ['조회', d.views], ['강사', d.professor], ['등록·업로드', `${d.regDate ?? ''} · ${d.uploadDate ?? ''}`]]} />
            </Card>
            <Card title={`${e.terms} (${d.terms.length})`}><DataTable columns={termCols} rows={d.terms} rowKey={(r) => r.idx} dense emptyTitle="회차가 없습니다." emptyBody=" " /></Card>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
