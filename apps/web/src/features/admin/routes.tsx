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
const LegacyPage = lazy(() => import('./pages/LegacyPage'));
const StaffListPage = lazy(() => import('./pages/members/StaffListPage'));
const DepartmentsPage = lazy(() => import('./pages/members/DepartmentsPage'));
const WithdrawnMembersPage = lazy(() => import('./pages/members/WithdrawnMembersPage'));
const PrivacyLogPage = lazy(() => import('./pages/members/PrivacyLogPage'));
const EnrollmentRegisterPage = lazy(() => import('./pages/members/EnrollmentRegisterPage'));
const AbilityQuestionsPage = lazy(() => import('./pages/content-archive/AbilityQuestionsPage'));
const AbilityResultsPage = lazy(() => import('./pages/content-archive/AbilityResultsPage'));
const SatisfactionPage = lazy(() => import('./pages/content-archive/SatisfactionPage'));
const ContentKeywordsPage = lazy(() => import('./pages/content-archive/ContentKeywordsPage'));
const CourseLikesPage = lazy(() => import('./pages/content-archive/CourseLikesPage'));
const CourseViewsPage = lazy(() => import('./pages/content-archive/CourseViewsPage'));
const LiveCoursesPage = lazy(() => import('./pages/content-archive/LiveCoursesPage'));
const LiveClassPage = lazy(() => import('./pages/content-archive/LiveClassPage'));
const ReviewsPage = lazy(() => import('./pages/site-cms/ReviewsPage'));
const ArchivingPage = lazy(() => import('./pages/site-cms/ArchivingPage'));
const EdudataPage = lazy(() => import('./pages/site-cms/EdudataPage'));
const LectureEventsPage = lazy(() => import('./pages/site-cms/LectureEventsPage'));
const PopupsPage = lazy(() => import('./pages/site-cms/PopupsPage'));
const BackupsPage = lazy(() => import('./pages/site-cms/BackupsPage'));
const VisitStatsPage = lazy(() => import('./pages/site-cms/VisitStatsPage'));
const MyInfoPage = lazy(() => import('./pages/site-cms/MyInfoPage'));
const StudyNudgePage = lazy(() => import('./pages/nudge/StudyNudgePage'));
const SmsReservationsPage = lazy(() => import('./pages/nudge/SmsReservationsPage'));
const AlarmLogPage = lazy(() => import('./pages/nudge/AlarmLogPage'));
const ManagerMailLogPage = lazy(() => import('./pages/nudge/MailLogPages').then((m) => ({ default: m.ManagerMailLogPage })));
const LearnerMailLogPage = lazy(() => import('./pages/nudge/MailLogPages').then((m) => ({ default: m.LearnerMailLogPage })));
const TemplatesPage = lazy(() => import('./pages/nudge/TemplatesPage'));
const RubyFaqPage = lazy(() => import('./pages/ruby-ops/RubyFaqPage'));
const RubyKbPage = lazy(() => import('./pages/ruby-ops/RubyKbPage'));
const RubyPromptsPage = lazy(() => import('./pages/ruby-ops/RubyPromptsPage'));
const RubyRuntimePage = lazy(() => import('./pages/ruby-ops/RubyRuntimePage'));
const RubyTicketsPage = lazy(() => import('./pages/ruby-ops/RubyTicketsPage'));
const RubyEmbeddingsPage = lazy(() => import('./pages/ruby-ops/RubyEmbeddingsPage'));
const IpMonitoringPage = lazy(() => import('./pages/ruby-ops/IpMonitoringPage'));
const EnrollmentImportPage = lazy(() => import('./pages/ruby-ops/EnrollmentImportPage'));
const StudyHistoryPage = lazy(() => import('./pages/learning/StudyHistoryPage'));
const ClosingsPage = lazy(() => import('./pages/learning/ClosingsPage'));
const IpMonitorPage = lazy(() => import('./pages/learning/IpMonitorPage'));
const IdentityChecksPage = lazy(() => import('./pages/learning/IdentityChecksPage'));
const NegativeTrainingPage = lazy(() => import('./pages/learning/NegativeTrainingPage'));
const AiAnalysisPage = lazy(() => import('./pages/learning/AiAnalysisPage'));
const CompletionDataPage = lazy(() => import('./pages/learning/CompletionDataPage'));
const SubjectCertificatesPage = lazy(() => import('./pages/learning/SubjectCertificatesPage'));
const CertificateTestPage = lazy(() => import('./pages/learning/CertificateTestPage'));
const CertificatePrintPage = lazy(() => import('./pages/learning/CertificatePrintPage'));
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
          { path: 'legacy/:slug', element: el(<LegacyPage />) },
          { path: 'members', element: grant('A2', <MembersPage />) },
          { path: 'members/withdrawn', element: grant('A4', <WithdrawnMembersPage />) },
          { path: 'members/:id', element: grant('A2', <MemberDetailPage />) },
          { path: 'staff-list/:dept', element: el(<StaffListPage />) },
          { path: 'departments', element: grant('A5', <DepartmentsPage />) },
          { path: 'privacy-log', element: grant('A9', <PrivacyLogPage />) },
          { path: 'enrollments/new', element: grant('A3', <EnrollmentRegisterPage />) },
          { path: 'archive-questions', element: el(<AbilityQuestionsPage />) },
          { path: 'ability-results', element: el(<AbilityResultsPage />) },
          { path: 'satisfaction-results', element: el(<SatisfactionPage />) },
          { path: 'content-keywords', element: el(<ContentKeywordsPage />) },
          { path: 'course-likes', element: el(<CourseLikesPage />) },
          { path: 'course-views', element: el(<CourseViewsPage />) },
          { path: 'live-courses', element: el(<LiveCoursesPage />) },
          { path: 'live-class', element: el(<LiveClassPage />) },
          { path: 'reviews', element: grant('F4', <ReviewsPage />) },
          { path: 'archiving', element: grant('F5', <ArchivingPage />) },
          { path: 'edudata', element: grant('F7', <EdudataPage />) },
          { path: 'lecture-events', element: grant('F7', <LectureEventsPage />) },
          { path: 'popups', element: grant('G2', <PopupsPage />) },
          { path: 'backups', element: grant('G3', <BackupsPage />) },
          { path: 'visit-stats', element: grant('G3', <VisitStatsPage />) },
          { path: 'my-info', element: el(<MyInfoPage />) },
          { path: 'nudge', element: grant('C1', <StudyNudgePage />) },
          { path: 'nudge/reservations', element: grant('C1', <SmsReservationsPage />) },
          { path: 'nudge/alarm-log', element: grant('C2', <AlarmLogPage />) },
          { path: 'nudge/manager-mail-log', element: grant('C3', <ManagerMailLogPage />) },
          { path: 'nudge/mail-log', element: grant('C4', <LearnerMailLogPage />) },
          { path: 'nudge/templates', element: grant('C5', <TemplatesPage />) },
          { path: 'ruby/faq', element: grant('F2', <RubyFaqPage />) },
          { path: 'ruby/kb', element: grant('F2', <RubyKbPage />) },
          { path: 'ruby/prompts', element: grant('F2', <RubyPromptsPage />) },
          { path: 'ruby/runtime', element: grant('F2', <RubyRuntimePage />) },
          { path: 'ruby/tickets', element: grant('F2', <RubyTicketsPage />) },
          { path: 'ruby/embeddings', element: grant('F2', <RubyEmbeddingsPage />) },
          { path: 'monitoring/ip', element: grant('B1', <IpMonitoringPage />) },
          { path: 'enrollments/import', element: grant('A3', <EnrollmentImportPage />) },
          { path: 'learning/history', element: grant('B5', <StudyHistoryPage />) },
          { path: 'learning/closings', element: grant('B6', <ClosingsPage />) },
          { path: 'learning/ip-monitor', element: grant('B1', <IpMonitorPage />) },
          { path: 'learning/identity-checks', element: grant('B2', <IdentityChecksPage />) },
          { path: 'learning/negative-training', element: grant('B4', <NegativeTrainingPage />) },
          { path: 'learning/ai-analysis', element: grant('B9', <AiAnalysisPage />) },
          { path: 'learning/completion-data', element: grant('B7', <CompletionDataPage />) },
          { path: 'learning/subject-certificates', element: grant('B8', <SubjectCertificatesPage />) },
          { path: 'learning/certificate-test', element: grant('B8', <CertificateTestPage />) },
          { path: 'learning/certificates/print', element: el(<CertificatePrintPage />) },
          { path: 'companies', element: grant('A1', <CompaniesPage />) },
          { path: 'companies/import', element: grant('A1', <CompanyImportPage />) },
          { path: 'companies/:idx', element: grant('A1', <CompanyDetailPage />) },
          { path: 'studies', element: grant('B5', <StudiesPage />) },
          { path: 'studies/:seq', element: grant('B5', <StudyDetailPage />) },
          { path: 'monitoring/daily', element: grant('B3', <MonitoringDailyPage />) },
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
          { path: 'faqs', element: grant('F2', <FaqsPage />) },
          { path: 'inquiries', element: grant('E7', <InquiriesPage />) },
          { path: 'counsel', element: grant('F3', <CounselPage />) },
          { path: 'cheating', element: grant('F6', <CheatingPage />) },
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
