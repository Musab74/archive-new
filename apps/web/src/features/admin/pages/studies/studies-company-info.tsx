import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminStudiesParityApi } from '../../../../shared/api/endpoints/admin-studies-parity';
import type { NudgeCompanyCard, NudgeCompanyInfo } from '../../../../shared/api/endpoints/admin-nudge';
import { AButton, Callout, Card, DataTable, DescList, DetailDrawer, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { tr } from '../../../../shared/i18n/adminLang';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { hasGrant } from '../../../../shared/auth/adminMenu';
import { adm } from '../../strings';

type StudyRow = NudgeCompanyInfo['studies'][number];
type MemberRow = NudgeCompanyInfo['members'][number];

const won = (n: number) => n.toLocaleString('ko-KR');
const check = (on: boolean) => <StatusBadge tone={on ? 'ok' : 'neutral'}>{on ? tr('사용', 'On') : tr('미사용', 'Off')}</StatusBadge>;

/** company_info_pop.php 사업주 상세 정보 table, in the PHP order (4 × 2 columns per row). */
function CompanyCard({ c }: { c: NudgeCompanyCard }) {
  const items: [ReactNode, ReactNode][] = [
    [tr('회사 규모', 'Scale'), c.companyScaleLabel], [tr('회사명', 'Company'), c.companyName], [tr('사업자 번호', 'Business no.'), c.companyCode], [tr('HRD 번호', 'HRD no.'), c.hrd],
    [tr('사업주 ID', 'Company ID'), c.companyId], [tr('대표자명', 'CEO'), c.ceo], [tr('대표 전화번호', 'Main phone'), c.tel], [tr('고객센터 전화번호', 'CS phone'), <>{c.tel2} {check(c.csEnabled)}</>],
    [tr('업태', 'Business type'), c.uptae], [tr('업종', 'Industry'), c.upjong], [tr('대표 팩스번호', 'Main fax'), c.fax], [tr('고객센터 팩스번호', 'CS fax'), c.fax2],
    [tr('주소', 'Address'), `[${c.zipcode}] ${c.address01} ${c.address02}`.trim()], [tr('계좌정보', 'Bank account'), `${c.bankName} ${c.bankNumber}`.trim()], [tr('이메일', 'E-mail'), c.email], [tr('홈페이지', 'Homepage'), c.homePage],
    [tr('교육 담당자', 'Training manager'), `${c.eduManager} / ${c.eduManagerPhone} / ${c.eduManagerEmail}`], [tr('영업 담당자', 'Sales rep'), c.salesName], [tr('메모', 'Memo'), c.remark], [tr('사이버 교육센터', 'Cyber center'), <>{c.cyberUrl} {check(c.cyberEnabled)}</>],
    [tr('독려문자 수신', 'Nudge SMS'), c.sendSmsLabel], [tr('영업팀 카테고리', 'Sales team'), c.salesDeptName],
  ];
  return <DescList cols={2} items={items} />;
}

const studyCols: Column<StudyRow>[] = [
  { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56 }, { key: 'contentsName', header: tr('강의명', 'Course') },
  { key: 'period', header: tr('기간', 'Period'), nowrap: true, render: (r) => `${r.lectureStart} ~ ${r.lectureEnd}` },
  { key: 'counts', header: tr('수강/수료', 'Enrolled / passed'), align: 'center', render: (r) => `${r.studyCount} / ${r.passCount}` },
  { key: 'passRatio', header: tr('수료율', 'Pass rate'), align: 'right', render: (r) => `${r.passRatio}%` },
  { key: 'price', header: tr('교육비', 'Fee'), align: 'right', render: (r) => won(r.price) }, { key: 'rPrice', header: tr('환급비', 'Refund'), align: 'right', render: (r) => won(r.rPrice) },
];
const memberCols: Column<MemberRow>[] = [
  { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56 }, { key: 'id', header: tr('아이디', 'ID'), nowrap: true }, { key: 'name', header: tr('이름', 'Name'), nowrap: true },
  { key: 'birthDay', header: tr('생년월일', 'Birthday'), nowrap: true }, { key: 'genderLabel', header: tr('성별', 'Gender') }, { key: 'email', header: tr('이메일', 'E-mail') }, { key: 'mobile', header: tr('휴대폰', 'Mobile'), nowrap: true },
  { key: 'depart', header: tr('부서', 'Department') }, { key: 'position', header: tr('직위', 'Position') }, { key: 'lastLogin', header: tr('최종로그인', 'Last login'), nowrap: true }, { key: 'regDate', header: tr('가입일', 'Joined'), nowrap: true },
  { key: 'useYNLabel', header: tr('계정 사용유무', 'Account') },
];

/**
 * 학습관리 사업주 클릭 → CompanyInfo(CompanyCode) = company_info_pop.php: 사업주 상세 정보 / 수강 정보 / 수강생 정보 (masked).
 * Loaded from /admin/studies/company-info/:code (B5), so accounts without 사업주 관리 (A1) see it like the PHP popup;
 * A1 holders also get a link to the full 사업주 page.
 */
export function StudyCompanyInfoDrawer({ code, onClose }: { code: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['admin', 'studies', 'company-info', code], queryFn: ({ signal }) => adminStudiesParityApi.companyInfo(code!, signal), enabled: !!code, retry: false });
  const { admin } = useAdminSession();
  const d = q.data;
  return (
    <DetailDrawer open={!!code} onClose={onClose} title={tr('사업주 상세 정보', 'Company details')} subtitle={d ? `${d.company.companyName} (${d.company.companyCode})` : code ?? ''} wide
      footer={<>{d?.company.idx && hasGrant(admin, 'A1') ? <AButton to={`/admin/companies/${d.company.idx}`}>{tr('사업주 상세 페이지', 'Open company page')}</AButton> : null}<AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton></>}>
      {q.isError ? <Callout tone="warn">{isAppError(q.error) ? q.error.message : adm.common.failed}</Callout> : !d ? <p className="muted">{adm.common.loading}</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <CompanyCard c={d.company} />
          <Card title={tr('수강 정보', 'Enrollments')}><DataTable dense rows={d.studies} rowKey={(r) => r.no} columns={studyCols} emptyTitle={tr('수강 정보가 없습니다.', 'No enrollments.')} /></Card>
          <Card title={tr('수강생 정보', 'Learners')}><DataTable dense rows={d.members} rowKey={(r) => r.id} columns={memberCols} emptyTitle={tr('수강생 정보가 없습니다.', 'No learners.')} /></Card>
        </div>
      )}
    </DetailDrawer>
  );
}
