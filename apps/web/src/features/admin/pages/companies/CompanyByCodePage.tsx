import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AdminPage } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { tr } from '../../../../shared/i18n/adminLang';
import { companiesApi } from './companiesApi';

/**
 * /admin/companies/by-code/:code — the CompanyInfo(CompanyCode) popup (company_info_pop.php) opened from 학습관리 and the
 * 문자/메일 로그 screens: resolves the CompanyCode and replaces the URL with the 사업주 상세 page (same 상세 필드, 수강생 정보 masked).
 * `?year=all&order=asc` makes 수강 정보 match the popup: every term, LectureStart ASC / LectureEnd ASC (no year filter).
 */
export default function CompanyByCodePage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['admin', 'companies', 'by-code', code], queryFn: ({ signal }) => companiesApi.byCode(code, signal), enabled: !!code, retry: false });
  useEffect(() => { if (q.data) navigate(`/admin/companies/${q.data.idx}?year=all&order=asc`, { replace: true }); }, [q.data, navigate]);
  return (
    <AdminPage title={tr('사업주 상세 정보', 'Company detail')}>
      {q.isError ? <StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /> : <Skeleton lines={6} />}
    </AdminPage>
  );
}
