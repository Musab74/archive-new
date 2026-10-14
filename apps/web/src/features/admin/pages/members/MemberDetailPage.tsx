import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { AdminMemberProfile, MemberDetail } from '../../../../shared/api/schemas';
import { AButton, ACheckbox, AdminPage, AInput, ATextarea, Bar, BoolBadge, Card, ConfirmDialog, DataTable, DescList, DetailDrawer, FieldRow, StatusBadge, YnBadge, type Column } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';

type Enrollment = MemberDetail['enrollments'][number];
type Login = MemberDetail['loginHistory'][number];

const enrollCols: Column<Enrollment>[] = [
  { key: 'studySeq', header: 'Seq', align: 'right', render: (r) => <Link to={`/admin/studies/${r.studySeq}`}>{r.studySeq}</Link> },
  { key: 'courseName', header: tr('과정', 'Course'), render: (r) => <span title={r.lectureCode}>{r.courseName}</span> },
  { key: 'companyCode', header: tr('기업', 'Company'), render: (r) => r.companyCode ?? '' },
  { key: 'period', header: tr('수강기간', 'Period'), nowrap: true, render: (r) => `${r.period.start} ~ ${r.period.end}` },
  { key: 'formatted', header: tr('학습시간', 'Study time'), align: 'right' },
  { key: 'percent', header: tr('달성률', 'Progress'), width: 110, render: (r) => <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Bar value={r.percent} tone={r.over15h ? 'ok' : undefined} /><span style={{ fontSize: 12 }}>{r.percent}%</span></div> },
  { key: 'passOk', header: tr('수료', 'Completion'), align: 'center', render: (r) => <BoolBadge value={r.passOk} yes={tr('수료', 'Completed')} no={r.studyEnd ? tr('미수료', 'Not completed') : tr('진행', 'In progress')} /> },
];
const loginCols: Column<Login>[] = [
  { key: 'at', header: tr('시각', 'Time'), nowrap: true, render: (r) => r.at ?? '' },
  { key: 'device', header: tr('기기', 'Device'), render: (r) => r.device ?? '' },
  { key: 'ip', header: 'IP', render: (r) => <span className="mono">{r.ip ?? ''}</span> },
  { key: 'userAgent', header: 'User-Agent', render: (r) => <span style={{ fontSize: 11 }} className="muted">{r.userAgent ?? ''}</span> },
];

const EDIT_KEYS = ['Name', 'Depart', 'Position', 'Email', 'Mobile', 'Tel', 'MemberRemark'] as const;
type EditForm = Record<(typeof EDIT_KEYS)[number], string> & { UseYN: boolean; EduManager: boolean; ProtectID: boolean };

function fromProfile(p: AdminMemberProfile): EditForm {
  return { Name: p.name ?? '', Depart: p.depart ?? '', Position: p.position ?? '', Email: p.email ?? '', Mobile: p.mobile ?? '', Tel: p.tel ?? '', MemberRemark: p.memberRemark ?? '', UseYN: p.useYN === 'Y', EduManager: p.eduManager === 'Y', ProtectID: p.protectId === 'Y' };
}
/** Only changed fields go into the PATCH body (strict schema on the API). */
export function diffPatch(base: EditForm, cur: EditForm): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of EDIT_KEYS) if (base[k] !== cur[k]) out[k] = cur[k].trim() === '' ? (k === 'Name' ? undefined : null) : cur[k].trim();
  for (const k of ['UseYN', 'EduManager', 'ProtectID'] as const) if (base[k] !== cur[k]) out[k] = cur[k] ? 'Y' : 'N';
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

export default function MemberDetailPage() {
  const { id = '' } = useParams();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const q = useQuery({ queryKey: ['admin', 'member', id], queryFn: ({ signal }) => adminApi.member(id, signal), enabled: !!id });
  const d = q.data;
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  useEffect(() => { if (d && editOpen) setForm(fromProfile(d.profile)); }, [d, editOpen]);

  const patch = useAdminMutation({ fn: (body: Record<string, unknown>) => adminApi.patchMember(id, body), invalidate: [['admin', 'member', id], ['admin', 'members']], success: adm.common.saved, onSuccess: () => setEditOpen(false) });
  const resetPw = useAdminMutation({ fn: (password: string) => adminApi.resetPassword(id, password), success: adm.members.detail.resetDone, onSuccess: () => { setPwOpen(false); setPw(''); } });
  const c = adm.members.detail;
  const p = d?.profile;

  return (
    <AdminPage title={`${c.title}${p ? ` · ${p.name ?? ''} (${p.id})` : ''}`} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: adm.members.title, to: '/admin/members' }, { label: id }]}
      actions={<><AButton to="/admin/members">{adm.common.back}</AButton><AButton onClick={() => setEditOpen(true)} disabled={!canWrite || !d} title={readOnlyTitle}>{c.edit}</AButton><AButton variant="danger" onClick={() => setPwOpen(true)} disabled={!canWrite || !d} title={readOnlyTitle}>{c.resetPw}</AButton></>}>
      {q.isError ? <StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /> : q.isPending || !d || !p ? <Skeleton lines={8} /> : (
        <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card title={c.profile}>
              <DescList items={[
                [tr('아이디', 'User ID'), p.id], [tr('이름', 'Name'), p.name], [tr('유형', 'Type'), p.memberType], [tr('기업', 'Company'), p.companyName ? `${p.companyName} (${p.companyCode})` : p.companyCode], [tr('부서·직위', 'Dept · title'), [p.depart, p.position].filter(Boolean).join(' · ')],
                [tr('상태', 'Status'), <span key="s" style={{ display: 'inline-flex', gap: 4 }}><YnBadge value={p.useYN} />{p.eduManager === 'Y' ? <StatusBadge tone="info">{tr('교육담당자', 'Training manager')}</StatusBadge> : null}{p.sleep === 'Y' ? <StatusBadge tone="warn">{tr('휴면', 'Dormant')} {p.sleepDate ?? ''}</StatusBadge> : null}{p.memberOut === 'Y' ? <StatusBadge tone="danger">{tr('탈퇴', 'Withdrawn')} {p.memberOutDate ?? ''}</StatusBadge> : null}{p.testId === 'Y' ? <StatusBadge>{tr('테스트', 'Test')}</StatusBadge> : null}</span>],
                [tr('대리수강방지', 'Proxy-study guard'), p.protectId], [tr('비밀번호 변경', 'Password change'), p.passChange === 'N' ? tr('다음 로그인 시 변경 필요', 'Required at next login') : tr('정상', 'OK')], [tr('약관', 'Terms'), p.mandatory === 'Y' ? tr('동의', 'Agreed') : tr('미동의', 'Not agreed')], [tr('마케팅', 'Marketing'), p.marketing], [tr('진단', 'Assessment'), tr(`사전 ${p.abilityYN ?? '-'} · 사후 ${p.abilityAfterYN ?? '-'}`, `Pre ${p.abilityYN ?? '-'} · Post ${p.abilityAfterYN ?? '-'}`)],
                [tr('가입일', 'Joined'), p.regDate], [tr('수정일', 'Updated'), p.editDate], [tr('최근 로그인', 'Last login'), p.lastLogin ? `${p.lastLogin} (${p.lastLoginIp ?? ''})` : null], [tr('메모', 'Memo'), p.memberRemark],
              ]} />
            </Card>
            <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Card title={c.contact}>
                <DescList items={[[tr('이메일', 'Email'), p.email], [tr('휴대폰', 'Mobile'), p.mobile], [tr('전화', 'Phone'), p.tel], [tr('생년월일', 'Date of birth'), p.birthDay], [tr('성별', 'Gender'), p.gender], [tr('주소', 'Address'), [p.address.zipcode, p.address.address01, p.address.address02].filter(Boolean).join(' ')], ['HRD', p.hrd ? `nwIno ${p.hrd.nwIno || '-'} · trneeSe ${p.hrd.trneeSe || '-'} · irglbrSe ${p.hrd.irglbrSe || '-'}` : null]]} />
              </Card>
              <Card title={c.identity}><DescList items={[[tr('인증 횟수', 'Checks'), d.identity.certCount], [tr('성공', 'Succeeded'), d.identity.certSuccess], [tr('최근 인증', 'Last check'), d.identity.lastCertAt]]} /></Card>
              <Card title={c.companies}>{d.managedCompanies.length ? <ul style={{ fontSize: 13 }}>{d.managedCompanies.map((m) => <li key={m.idx}>{m.companyCode} <span className="muted">({m.regDate ?? ''})</span></li>)}</ul> : <p className="muted" style={{ fontSize: 13 }}>{adm.common.none}</p>}</Card>
            </div>
          </div>
          <Card title={`${c.enrollments} (${d.enrollments.length})`}><DataTable columns={enrollCols} rows={d.enrollments} rowKey={(r) => r.studySeq} dense /></Card>
          <Card title={c.logins}><DataTable columns={loginCols} rows={d.loginHistory} rowKey={(r) => r.idx} dense /></Card>
        </div>
      )}

      <DetailDrawer open={editOpen} onClose={() => setEditOpen(false)} title={c.edit} subtitle={p ? `${p.id}` : ''}
        footer={<><AButton onClick={() => setEditOpen(false)}>{adm.common.cancel}</AButton><AButton variant="primary" loading={patch.isPending} disabled={!canWrite || !form || !p} onClick={() => { if (form && p) { const body = diffPatch(fromProfile(p), form); if (Object.keys(body).length) patch.mutate(body); else setEditOpen(false); } }}>{adm.common.save}</AButton></>}>
        {form ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FieldRow label={tr('이름', 'Name')} htmlFor="f-name" required><AInput id="f-name" value={form.Name} onChange={(e) => setForm({ ...form, Name: e.target.value })} maxLength={50} /></FieldRow>
            <FieldRow label={tr('부서', 'Department')} htmlFor="f-dep"><AInput id="f-dep" value={form.Depart} onChange={(e) => setForm({ ...form, Depart: e.target.value })} maxLength={100} /></FieldRow>
            <FieldRow label={tr('직위', 'Title')} htmlFor="f-pos"><AInput id="f-pos" value={form.Position} onChange={(e) => setForm({ ...form, Position: e.target.value })} maxLength={100} /></FieldRow>
            <FieldRow label={tr('이메일', 'Email')} htmlFor="f-email"><AInput id="f-email" type="email" value={form.Email} onChange={(e) => setForm({ ...form, Email: e.target.value })} maxLength={100} /></FieldRow>
            <FieldRow label={tr('휴대폰', 'Mobile')} htmlFor="f-mob" help={tr('숫자와 - 만', 'Digits and - only')}><AInput id="f-mob" value={form.Mobile} onChange={(e) => setForm({ ...form, Mobile: e.target.value.replace(/[^0-9-]/g, '') })} maxLength={20} /></FieldRow>
            <FieldRow label={tr('전화', 'Phone')} htmlFor="f-tel"><AInput id="f-tel" value={form.Tel} onChange={(e) => setForm({ ...form, Tel: e.target.value.replace(/[^0-9-]/g, '') })} maxLength={20} /></FieldRow>
            <FieldRow label={tr('플래그', 'Flags')}><div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}><ACheckbox label={tr('사용(UseYN)', 'Active (UseYN)')} checked={form.UseYN} onChange={(e) => setForm({ ...form, UseYN: e.target.checked })} /><ACheckbox label={tr('교육담당자', 'Training manager')} checked={form.EduManager} onChange={(e) => setForm({ ...form, EduManager: e.target.checked })} /><ACheckbox label={tr('대리수강방지', 'Proxy-study guard')} checked={form.ProtectID} onChange={(e) => setForm({ ...form, ProtectID: e.target.checked })} /></div></FieldRow>
            <FieldRow label={tr('메모', 'Memo')} htmlFor="f-memo"><ATextarea id="f-memo" value={form.MemberRemark} onChange={(e) => setForm({ ...form, MemberRemark: e.target.value })} maxLength={2000} rows={4} /></FieldRow>
          </div>
        ) : null}
      </DetailDrawer>

      <ConfirmDialog open={pwOpen} title={c.resetPw} tone="danger" confirmLabel={c.resetPw} loading={resetPw.isPending} onCancel={() => setPwOpen(false)} onConfirm={() => resetPw.mutate(pw)}
        body={<div><p>{c.resetPwBody}</p><div className="u-mt-16"><label htmlFor="f-pw" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{c.newPw}</label><AInput id="f-pw" type="text" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} maxLength={64} invalid={pw.length > 0 && pw.length < 8} /></div></div>} />
    </AdminPage>
  );
}
