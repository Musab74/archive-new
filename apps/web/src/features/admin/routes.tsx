import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Outlet, type RouteObject } from 'react-router-dom';
import { Skeleton } from '../../shared/ui/Skeleton';
import { NotFoundPage } from '../../app/placeholders';
import { AdminSessionProvider } from '../../app/providers/AdminSessionProvider';
import { RequireAdmin } from '../../app/guards/RequireAdmin';
import { AdminLayout } from '../../app/layouts';
import { ConsoleLangContext, getAdminLang } from '../../shared/i18n/adminLang';

// Everything admin-specific stays in lazy chunks; only the provider/guard/route table is eager.
const GrantGate = lazy(() => import('./GrantGate').then((m) => ({ default: m.GrantGate })));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MembersPage = lazy(() => import('./pages/members/MembersPage'));
const MemberDetailPage = lazy(() => import('./pages/members/MemberDetailPage'));
const CompaniesPage = lazy(() => import('./pages/companies/CompaniesPage'));
const CompanyDetailPage = lazy(() => import('./pages/companies/CompanyDetailPage'));
const CompanyImportPage = lazy(() => import('./pages/companies/CompanyImportPage'));
const StudiesPage = lazy(() => import('./pages/studies/StudiesPage'));
const StudyDetailPage = lazy(() => import('./pages/studies/StudyDetailPage'));
const MonitoringDailyPage = lazy(() => import('./pages/studies/MonitoringPages').then((m) => ({ default: m.MonitoringDailyPage })));
const MonitoringOverlapPage = lazy(() => import('./pages/studies/MonitoringPages').then((m) => ({ default: m.MonitoringOverlapPage })));
const MonitoringAbnormalPage = lazy(() => import('./pages/studies/MonitoringPages').then((m) => ({ default: m.MonitoringAbnormalPage })));
const CoursesPage = lazy(() => import('./pages/courses/CoursesPage'));
const CourseEditPage = lazy(() => import('./pages/courses/CourseEditPage'));
const CourseChaptersPage = lazy(() => import('./pages/courses/CourseChaptersPage'));
const ContentsPage = lazy(() => import('./pages/courses/ContentsPage'));
const ContentDetailPage = lazy(() => import('./pages/courses/ContentDetailPage'));
const CategoriesPage = lazy(() => import('./pages/courses/CategoriesPage'));
const ListsPage = lazy(() => import('./pages/courses/ListsPage'));
const NoticesPage = lazy(() => import('./pages/community/NoticesPage'));
const FaqsPage = lazy(() => import('./pages/community/FaqsPage'));
const InquiriesPage = lazy(() => import('./pages/community/InquiryPages').then((m) => ({ default: m.InquiriesPage })));
const CounselPage = lazy(() => import('./pages/community/InquiryPages').then((m) => ({ default: m.CounselPage })));
const CheatingPage = lazy(() => import('./pages/community/InquiryPages').then((m) => ({ default: m.CheatingPage })));
const SiteInfoPage = lazy(() => import('./pages/site/SitePages').then((m) => ({ default: m.SiteInfoPage })));
const StaffPage = lazy(() => import('./pages/site/SitePages').then((m) => ({ default: m.StaffPage })));
const EmonPage = lazy(() => import('./pages/emon/EmonPages').then((m) => ({ default: m.EmonPage })));
const EmonPendingPage = lazy(() => import('./pages/emon/EmonPages').then((m) => ({ default: m.EmonPendingPage })));
const EmonDiagnosisPage = lazy(() => import('./pages/emon/EmonPages').then((m) => ({ default: m.EmonDiagnosisPage })));
const EmonPreviewPage = lazy(() => import('./pages/emon/EmonPages').then((m) => ({ default: m.EmonPreviewPage })));
const DesignLayout = lazy(() => import('./design/DesignLayout'));
const DesignOverviewPage = lazy(() => import('./design/pages/OverviewPage'));
const PresetsPage = lazy(() => import('./design/pages/PresetsPage'));
const TokensPage = lazy(() => import('./design/pages/TokensPage'));
const TypographyPage = lazy(() => import('./design/pages/TypographyPage'));
const BrandingPage = lazy(() => import('./design/pages/BrandingPage'));
const MediaPage = lazy(() => import('./design/pages/MediaPage'));
const LayoutPage = lazy(() => import('./design/pages/LayoutPage'));
const LinksPage = lazy(() => import('./design/pages/LinksPage'));
const PreviewPage = lazy(() => import('./design/pages/PreviewPage'));
const VersionsPage = lazy(() => import('./design/pages/VersionsPage'));
const AuditPage = lazy(() => import('./design/pages/AuditPage'));

const fallback = <div className="section" aria-busy="true"><Skeleton height={28} width="40%" /><Skeleton lines={5} /></div>;
const el = (node: ReactNode) => <Suspense fallback={fallback}>{node}</Suspense>;
/** Page gated by a sub-menu grant code (mirrors the API @Grant). */
const grant = (code: string, node: ReactNode) => el(<GrantGate grant={code}>{node}</GrantGate>);

/** Pins the console theme (shared/styles/console.css) and the console language on <html> while any /admin route is mounted. */
function useConsoleTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const prevLang = root.lang;
    root.setAttribute('data-console', 'admin');
    root.lang = getAdminLang();
    return () => { root.removeAttribute('data-console'); root.lang = prevLang || 'ko'; };
  }, []);
}

/** The console language reaches shared UI (admin kit, StateBlock, AppSelect) through context; elsewhere it stays 'ko'. */
function AdminRoot() {
  useConsoleTheme();
  return <ConsoleLangContext.Provider value={getAdminLang()}><AdminSessionProvider><Outlet /></AdminSessionProvider></ConsoleLangContext.Provider>;
}

/** /admin subtree: own session provider, /admin/login outside the guard, everything else behind RequireAdmin + AdminLayout. */
export const adminRouteTree: RouteObject = {
  path: 'admin',
  element: <AdminRoot />,
  children: [
    { path: 'login', element: el(<AdminLoginPage />) },
    {
      element: <RequireAdmin />,
      children: [{
        element: <AdminLayout />,
        children: [
          { index: true, element: el(<DashboardPage />) },
          { path: 'members', element: grant('A1', <MembersPage />) },
          { path: 'members/:id', element: grant('A1', <MemberDetailPage />) },
          { path: 'companies', element: grant('A1', <CompaniesPage />) },
          { path: 'companies/import', element: grant('A1', <CompanyImportPage />) },
          { path: 'companies/:idx', element: grant('A1', <CompanyDetailPage />) },
          { path: 'studies', element: grant('B1', <StudiesPage />) },
          { path: 'studies/:seq', element: grant('B1', <StudyDetailPage />) },
          { path: 'monitoring/daily', element: grant('B1', <MonitoringDailyPage />) },
          { path: 'monitoring/overlap', element: grant('B1', <MonitoringOverlapPage />) },
          { path: 'monitoring/abnormal', element: grant('B1', <MonitoringAbnormalPage />) },
          { path: 'emon', element: grant('B1', <EmonPage />) },
          { path: 'emon/pending', element: grant('B1', <EmonPendingPage />) },
          { path: 'emon/diagnosis', element: grant('B1', <EmonDiagnosisPage />) },
          { path: 'emon/preview/:job', element: grant('B1', <EmonPreviewPage />) },
          { path: 'courses', element: grant('D1', <CoursesPage />) },
          { path: 'courses/:idx', element: grant('D1', <CourseEditPage />) },
          { path: 'courses/:lectureCode/chapters', element: grant('D1', <CourseChaptersPage />) },
          { path: 'contents', element: grant('D1', <ContentsPage />) },
          { path: 'contents/:idx', element: grant('D1', <ContentDetailPage />) },
          { path: 'categories', element: grant('D1', <CategoriesPage />) },
          { path: 'lists', element: grant('D1', <ListsPage />) },
          { path: 'notices', element: grant('F1', <NoticesPage />) },
          { path: 'faqs', element: grant('F1', <FaqsPage />) },
          { path: 'inquiries', element: grant('F1', <InquiriesPage />) },
          { path: 'counsel', element: grant('F1', <CounselPage />) },
          { path: 'cheating', element: grant('F1', <CheatingPage />) },
          { path: 'site-info', element: grant('G1', <SiteInfoPage />) },
          { path: 'staff', element: grant('G1', <StaffPage />) },
          {
            path: 'design',
            element: grant('G1', <DesignLayout />),
            children: [
              { index: true, element: el(<DesignOverviewPage />) },
              { path: 'presets', element: el(<PresetsPage />) },
              { path: 'tokens', element: el(<TokensPage />) },
              { path: 'typography', element: el(<TypographyPage />) },
              { path: 'branding', element: el(<BrandingPage />) },
              { path: 'media', element: el(<MediaPage />) },
              { path: 'layout', element: el(<LayoutPage />) },
              { path: 'links', element: el(<LinksPage />) },
              { path: 'preview', element: el(<PreviewPage />) },
              { path: 'versions', element: el(<VersionsPage />) },
              { path: 'audit', element: el(<AuditPage />) },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      }],
    },
  ],
};
