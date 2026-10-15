import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminLearningApi } from '../../../../shared/api/endpoints/admin-learning';
import { AButton, Card, DataTable, DescList, DetailDrawer, StatusBadge } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { tr } from '../../../../shared/i18n/adminLang';
import { sanitizeLegacyHtml } from '../../../../shared/utils/legacyHtml';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { hasGrant } from '../../../../shared/auth/adminMenu';
import { adm } from '../../strings';

const yn = (v: string | null | undefined) => (v === 'Y' ? tr('사용', 'On') : v === 'N' ? tr('미사용', 'Off') : v ?? '');

/**
 * member_info_pop.php (MemberInfo(ID)) as a read-only drawer reachable with the 수강 관리 grants (the PHP popup only needed a
 * login): 기본정보 (with [미사용 계정] and 대리수강방지), 소속 정보, 로그인 내역, 본인인증 내역, 1:1 문의 내역. Contact data stays masked.
 */
export function MemberInfoDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['admin', 'learning', 'member-info', id], queryFn: ({ signal }) => adminLearningApi.memberInfo(id!, signal), enabled: !!id });
  const d = q.data; const p = d?.profile; const co = d?.company;
  const [inquiry, setInquiry] = useState<number | null>(null);
  return (
    <DetailDrawer open={!!id} onClose={onClose} title={tr('수강생 상세 정보', 'Learner details')} subtitle={p ? `${p.name ?? ''} (${p.id})` : id ?? ''} wide
      footer={<>{id ? <AButton to={`/admin/members/${encodeURIComponent(id)}`}>{tr('수강생 상세 화면', 'Open member page')}</AButton> : null}<AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton></>}>
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : !p ? <p className="muted">{adm.common.loading}</p> : (
        <div style={{ display: 'grid', gap: 12 }}>
          <Card title={tr('기본정보', 'Profile')}>
            <DescList cols={2} items={[
              [tr('아이디', 'ID'), <span key="i"><b>{p.id}</b>{p.useYN === 'N' ? <span style={{ color: 'var(--c-danger)' }}> [{tr('미사용 계정', 'inactive')}]</span> : null}</span>], [tr('이름', 'Name'), p.name],
              [tr('성별', 'Gender'), p.genderLabel], [tr('이메일', 'E-mail'), p.email],
              [tr('전화번호', 'Phone'), p.tel], [tr('휴대폰', 'Mobile'), p.mobile],
              [tr('영문 이름', 'English name'), p.nameEng], [tr('주소', 'Address'), [p.address.zipcode ? `(${p.address.zipcode})` : '', p.address.address01, p.address.address02].filter(Boolean).join(' ')],
              [tr('부서', 'Department'), p.depart], [tr('직위', 'Position'), p.position],
              [tr('관심분야', 'Interests'), p.etc01], [tr('가입경로', 'Joined via'), p.etc02],
              [tr('메일링', 'Mailing'), p.mailling], [tr('ACS', 'ACS'), p.acs],
              [tr('가입일', 'Joined'), p.regDate], [tr('교육 담당자', 'Training manager'), p.eduManager],
              [tr('대리수강방지', 'Proxy-study guard'), yn(p.protectId)], [tr('마케팅수신동의', 'Marketing'), p.marketingLabel || p.marketing],
              [tr('내일배움카드', 'Learning card'), [p.cardName, p.cardNumber].filter(Boolean).join(' ')],
            ]} />
          </Card>
          {co ? <Card title={tr('소속 정보', 'Company')}>
            <DescList cols={2} items={[
              [tr('회사 규모', 'Scale'), co.scaleLabel], [tr('회사명', 'Company'), co.companyName], [tr('사업자 번호', 'Biz no.'), co.companyCode], [tr('HRD 번호', 'HRD no.'), co.hrd],
              [tr('사업주 ID', 'Company ID'), co.companyId], [tr('대표자명', 'CEO'), co.ceo], [tr('대표 전화번호', 'Phone'), co.tel], [tr('고객센터전화번호', 'Support phone'), co.tel2],
              [tr('업태', 'Business type'), co.uptae], [tr('업종', 'Industry'), co.upjong], [tr('대표 팩스번호', 'Fax'), co.fax], [tr('고객센터팩스번호', 'Support fax'), co.fax2],
              [tr('주소', 'Address'), [co.address.zipcode ? `(${co.address.zipcode})` : '', co.address.address01, co.address.address02].filter(Boolean).join(' ')], [tr('계좌정보', 'Bank'), [co.bankName, co.bankNumber].filter(Boolean).join(' ')],
              [tr('이메일', 'E-mail'), co.email], [tr('홈페이지', 'Website'), co.homePage], [tr('교육담당자명', 'Training manager'), co.eduManager], [tr('영업담당자명', 'Sales rep'), co.salesName ?? co.salesManager],
              [tr('메모', 'Memo'), co.remark], [tr('사이버교육센터', 'Cyber centre'), co.cyberEnabled ? co.cyberUrl : ''],
            ]} />
          </Card> : null}
          <Card title={tr('로그인 내역', 'Login history')}>
            <DataTable dense rows={d.loginHistory} rowKey={(r) => r.idx} emptyTitle={tr('로그인 내역이 없습니다.', 'No logins.')} columns={[
              { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => d.loginTotal - i },
              { key: 'at', header: tr('로그인 시각', 'Login time'), nowrap: true, render: (r) => r.at ?? '' },
              { key: 'ip', header: tr('아이피', 'IP'), render: (r) => <span className="mono">{r.ip ?? ''}</span> },
              { key: 'device', header: tr('유형', 'Type'), align: 'center', render: (r) => r.device ?? '' },
              { key: 'ua', header: tr('브라우저 정보', 'Browser'), render: (r) => <span title={r.userAgent ?? ''}>{r.uaLabel}</span> },
            ]} />
          </Card>
          <Card title={tr('본인인증 내역', 'Identity checks')}>
            <DataTable dense rows={d.certHistory} rowKey={(r) => r.seq} emptyTitle={tr('본인인증 내역이 없습니다.', 'No identity checks.')} columns={[
              { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => d.certHistory.length - i },
              { key: 'course', header: tr('교육과정', 'Course'), render: (r) => r.courseName ?? r.lectureCode },
              { key: 'at', header: tr('인증시간', 'Checked at'), nowrap: true, render: (r) => r.at ?? '' },
            ]} />
          </Card>
          <Card title={tr('1:1 문의 내역', '1:1 inquiries')}>
            <DataTable dense rows={d.inquiries} rowKey={(r) => r.idx} emptyTitle={tr('문의 내역이 없습니다.', 'No inquiries.')} columns={[
              { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => d.inquiries.length - i },
              { key: 'category', header: tr('문의종류', 'Category'), render: (r) => r.categoryLabel },
              { key: 'name', header: tr('이름', 'Name'), render: (r) => r.name ?? '' },
              { key: 'title', header: tr('제목', 'Title'), render: (r) => <a href={`#inquiry-${r.idx}`} onClick={(e) => { e.preventDefault(); setInquiry(r.idx); }}>{r.title ?? ''}</a> },
              { key: 'regDate', header: tr('등록일', 'Registered'), nowrap: true, render: (r) => r.regDate ?? '' },
              { key: 'status', header: tr('처리상태', 'Status'), align: 'center', render: (r) => <StatusBadge tone={r.status === 'B' ? 'ok' : 'warn'}>{r.statusLabel}</StatusBadge> },
            ]} />
          </Card>
        </div>
      )}
      {id ? <LearningInquiryDrawer memberId={id} idx={inquiry} onClose={() => setInquiry(null)} /> : null}
    </DetailDrawer>
  );
}

/**
 * qna_read.php?idx= opened from the 1:1 문의 제목 of member_info_pop.php — read-only, through the 수강 관리 grants (GET
 * /admin/learning/member-info/:id/inquiries/:idx), so staff without the 1:1 상담문의 menu (F3) can read it. Same blocks as the PHP
 * page: 과정명/차시명 (course inquiries), 문의 제목, 이름, 아이디, 연락처·이메일 (masked), 등록일시, 답변일시, 내용, 첨부, then 답변.
 * Answering / deleting stays on 1:1 상담문의 (link shown to F3 holders).
 */
export function LearningInquiryDrawer({ memberId, idx, onClose }: { memberId: string; idx: number | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['admin', 'learning', 'member-info', memberId, 'inquiry', idx], queryFn: ({ signal }) => adminLearningApi.memberInquiry(memberId, idx!, signal), enabled: idx !== null });
  const { admin } = useAdminSession();
  const d = q.data;
  return (
    <DetailDrawer open={idx !== null} onClose={onClose} wide title={tr('1:1 상담문의 / 학습상담', '1:1 inquiry')} subtitle={idx ? `#${idx}` : undefined}
      footer={<>{hasGrant(admin, 'F3') && idx ? <Link to={`/admin/counsel?col=ID&q=${encodeURIComponent(memberId)}&open=${idx}`} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'center', fontSize: 13 }}>{tr('1:1 상담문의에서 답변하기', 'Answer in 1:1 inquiries')}</Link> : null}<AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton></>}>
      {q.isError ? <StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /> : !d ? <p className="muted">{adm.common.loading}</p> : (
        <div style={{ display: 'grid', gap: 12 }}>
          <Card title={tr('문의', 'Inquiry')}>
            <DescList cols={1} items={[
              ...(d.lectureCode ? [[tr('과정명', 'Course'), d.courseName], [tr('차시명', 'Chapter'), d.contentsTitle]] as [string, string | null | undefined][] : []),
              [tr('문의 제목', 'Title'), d.title], [tr('이름', 'Name'), d.name], [tr('아이디', 'User ID'), d.id], [tr('연락처', 'Phone'), d.mobile], [tr('이메일', 'Email'), d.email],
              [tr('등록일시', 'Registered'), d.regDate], [tr('답변일시', 'Answered'), d.answeredAt ?? '-'],
              [tr('내용', 'Contents'), <div key="c" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: sanitizeLegacyHtml(d.contents) }} />],
              ...(d.studentFile ? [[tr('첨부된 파일', 'Attachment'), d.studentFile]] as [string, string][] : []),
            ]} />
          </Card>
          <Card title={tr('답변', 'Answer')}>
            <DescList cols={1} items={[
              [tr('처리 상태', 'Status'), <StatusBadge key="s" tone={d.status === 'B' ? 'ok' : 'warn'}>{d.statusLabel || '-'}</StatusBadge>], [tr('작성자', 'Answered by'), d.answerName],
              ...d.answerFiles.map((f) => [tr(`첨부파일 ${f.no}`, `File ${f.no}`), f.name] as [string, string]),
              [tr('답변 내용', 'Answer'), d.answer ? <div key="a" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: sanitizeLegacyHtml(d.answer) }} /> : '-'],
            ]} />
          </Card>
        </div>
      )}
    </DetailDrawer>
  );
}

/** Button-styled link that opens MemberInfoDrawer (훈련생명/아이디 cells). */
export function useMemberInfo(): [(id: string, children?: ReactNode) => ReactNode, ReactNode] {
  const [id, setId] = useState<string | null>(null);
  const link = (mid: string, children?: ReactNode) => <button type="button" onClick={() => setId(mid)} style={{ background: 'none', border: 0, padding: 0, color: 'var(--c-link, #1e6bd6)', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>{children ?? mid}</button>;
  return [link, <MemberInfoDrawer key="member-info" id={id} onClose={() => setId(null)} />];
}

export const MemberPageLink = ({ id }: { id: string }) => <Link to={`/admin/members/${encodeURIComponent(id)}`}>{id}</Link>;
