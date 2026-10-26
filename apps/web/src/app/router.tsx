import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Outlet, useRouteError } from 'react-router-dom';
import { AuthLayout, LearnerLayout, ManagerLayout, MyRoomLayout, PlayerLayout, PublicLayout } from './layouts';
import { RequireAuth } from './guards/RequireAuth';
import { RequireRole } from './guards/RequireRole';
import { DesignProvider } from './providers/DesignProvider';
import { SessionProvider } from './providers/SessionProvider';
import { ToastProvider } from './providers/ToastProvider';
import { Skeleton } from '../shared/ui/Skeleton';
import { StateBlock } from '../shared/ui/StateBlock';
import { NotFoundPage } from './placeholders';
import { managerRoutes } from '../features/manager/routes';
import { adminRouteTree } from '../features/admin/routes';
import { isAppError } from '../shared/api/client';

const PublicHome = lazy(() => import('../features/home/PublicHome'));
const CatalogPage = lazy(() => import('../features/catalog/CatalogPage'));
const ContentDetail = lazy(() => import('../features/content/ContentDetail'));
const AiZonePage = lazy(() => import('../features/aizone/AiZonePage'));
const AboutArchivePage = lazy(() => import('../features/about/AboutPages').then((m) => ({ default: m.AboutArchivePage })));
const AboutCompanyPage = lazy(() => import('../features/about/AboutPages').then((m) => ({ default: m.AboutCompanyPage })));
const SupportLayout = lazy(() => import('../features/support/SupportLayout'));
const GuidePage = lazy(() => import('../features/support/GuidePage'));
const NoticeListPage = lazy(() => import('../features/support/NoticeListPage'));
const NoticeDetailPage = lazy(() => import('../features/support/NoticeDetailPage'));
const FaqPage = lazy(() => import('../features/support/FaqPage'));
const InquiryNewPage = lazy(() => import('../features/support/InquiryNewPage'));
const CounselPage = lazy(() => import('../features/support/CounselPage'));
const ResourcesPage = lazy(() => import('../features/support/ResourcesPage'));
const EventsPage = lazy(() => import('../features/support/EventsPage'));
const RemotePage = lazy(() => import('../features/support/RemotePage'));
const LoginPage = lazy(() => import('../features/auth/LoginPage'));
const SignupTermsPage = lazy(() => import('../features/auth/SignupTermsPage'));
const SignupInfoPage = lazy(() => import('../features/auth/SignupInfoPage'));
const SignupCompletePage = lazy(() => import('../features/auth/SignupCompletePage'));
const FindIdPage = lazy(() => import('../features/auth/FindIdPage'));
const FindPasswordPage = lazy(() => import('../features/auth/FindPasswordPage'));
const FirstTermsPage = lazy(() => import('../features/auth/FirstTermsPage'));
const PasswordChangePage = lazy(() => import('../features/auth/PasswordChangePage'));
const DailyAuthPage = lazy(() => import('../features/auth/DailyAuthPage'));
const TermsPage = lazy(() => import('../features/legal/TermsPage'));
const PrivacyPage = lazy(() => import('../features/legal/PrivacyPage'));
// Learner core (AR-02 / 06..18)
const LearningHome = lazy(() => import('../features/home/LearningHome'));
const PlayerPage = lazy(() => import('../features/player/PlayerPage'));
const PreAssessmentPage = lazy(() => import('../features/assessment/PreAssessmentPage'));
const PostAssessmentPage = lazy(() => import('../features/assessment/PostAssessmentPage'));
const AssessmentResultPage = lazy(() => import('../features/assessment/AssessmentResultPage'));
const RoadmapPage = lazy(() => import('../features/roadmap/RoadmapPage'));
const LivePage = lazy(() => import('../features/live/LivePage'));
const MyDashboard = lazy(() => import('../features/my/MyDashboard'));
const MyRecords = lazy(() => import('../features/my/MyRecords'));
const MyRecordChapters = lazy(() => import('../features/my/MyRecords').then((m) => ({ default: m.MyRecordChapters })));
const MyCertificates = lazy(() => import('../features/my/MyCertificates'));
const MyCertificateDetail = lazy(() => import('../features/my/MyCertificates').then((m) => ({ default: m.MyCertificateDetail })));
const MySaved = lazy(() => import('../features/my/MySaved'));
const MyReport = lazy(() => import('../features/my/MyReport'));
const MyRanking = lazy(() => import('../features/my/MyRanking'));
const MyAssessmentHub = lazy(() => import('../features/my/MyAssessmentHub'));
const MyCompanyTraining = lazy(() => import('../features/my/MyCompanyTraining'));
const MySurveys = lazy(() => import('../features/my/MySurveys'));
const SatisfactionPage = lazy(() => import('../features/my/MySurveys').then((m) => ({ default: m.SatisfactionPage })));
const MyProfile = lazy(() => import('../features/my/MyProfile'));
const MyNotices = lazy(() => import('../features/my/MyNotices'));
const MyTickets = lazy(() => import('../features/my/MyTickets'));

const fallback = <div className="section" aria-busy="true"><Skeleton height={32} width="40%" /><Skeleton lines={5} /></div>;
const lazyEl = (node: ReactNode) => <Suspense fallback={fallback}>{node}</Suspense>;

/** Providers that need the router (SessionProvider navigates) live under the root route. */
function Root() {
  return (
    <DesignProvider>
      <ToastProvider>
        <SessionProvider>
          <Outlet />
        </SessionProvider>
      </ToastProvider>
    </DesignProvider>
  );
}

function RouteError() {
  const err = useRouteError();
  if (isAppError(err) && err.status === 404) return <StateBlock code="NOT_FOUND" page />;
  if (isAppError(err) && err.isAuth) return <StateBlock code="LOGIN" page />;
  return <StateBlock code="LIST_ERROR" page kicker="오류" title="화면을 표시하지 못했습니다." body="잠시 후 다시 시도해 주세요. 문제가 계속되면 고객지원으로 문의해 주세요." />;
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      {
        element: <PublicLayout />,
        errorElement: <RouteError />,
        children: [
          { index: true, element: lazyEl(<PublicHome />) },
          { path: 'catalog', element: lazyEl(<CatalogPage />) },
          { path: 'courses/:lectureCode', element: lazyEl(<ContentDetail />) },
          { path: 'contents/:lectureCode', element: lazyEl(<ContentDetail />) },
          { path: 'ai-zone', element: lazyEl(<AiZonePage />) },
          { path: 'about', element: lazyEl(<AboutArchivePage />) },
          { path: 'about/company', element: lazyEl(<AboutCompanyPage />) },
          {
            path: 'support',
            element: lazyEl(<SupportLayout />),
            children: [
              { index: true, element: lazyEl(<GuidePage />) },
              { path: 'guide', element: lazyEl(<GuidePage />) },
              { path: 'notice', element: lazyEl(<NoticeListPage />) },
              { path: 'notice/:id', element: lazyEl(<NoticeDetailPage />) },
              { path: 'faq', element: lazyEl(<FaqPage />) },
              { path: 'inquiry/new', element: lazyEl(<InquiryNewPage />) },
              { path: 'counsel', element: lazyEl(<CounselPage />) },
              { path: 'resources', element: lazyEl(<ResourcesPage />) },
              { path: 'events', element: lazyEl(<EventsPage />) },
              { path: 'remote', element: lazyEl(<RemotePage />) },
            ],
          },
          { path: 'terms', element: lazyEl(<TermsPage />) },
          { path: 'privacy', element: lazyEl(<PrivacyPage />) },
          { path: 'live', element: lazyEl(<LivePage />) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: 'auth',
        element: <AuthLayout />,
        children: [
          { path: 'login', element: lazyEl(<LoginPage />) },
          { path: 'signup', element: lazyEl(<SignupTermsPage />) },
          { path: 'signup/terms', element: lazyEl(<SignupTermsPage />) },
          { path: 'signup/info', element: lazyEl(<SignupInfoPage />) },
          { path: 'signup/complete', element: lazyEl(<SignupCompletePage />) },
          { path: 'find-id', element: lazyEl(<FindIdPage />) },
          { path: 'find-password', element: lazyEl(<FindPasswordPage />) },
          { path: 'first-terms', element: lazyEl(<FirstTermsPage />) },
          { path: 'password-change', element: lazyEl(<PasswordChangePage />) },
          { path: 'daily', element: lazyEl(<DailyAuthPage />) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <LearnerLayout />,
            children: [
              { path: 'home', element: lazyEl(<LearningHome />) },
              { path: 'assessment', element: lazyEl(<MyAssessmentHub />) },
              { path: 'assessment/pre', element: lazyEl(<PreAssessmentPage />) },
              { path: 'assessment/post', element: lazyEl(<PostAssessmentPage />) },
              { path: 'assessment/result', element: lazyEl(<AssessmentResultPage />) },
              { path: 'assessment/*', element: <NotFoundPage /> },
              { path: 'roadmap', element: lazyEl(<RoadmapPage />) },
              { path: 'surveys', element: lazyEl(<MySurveys />) },
              { path: 'satisfaction/:id', element: lazyEl(<SatisfactionPage />) },
            ],
          },
          {
            element: <MyRoomLayout />,
            children: [
              { path: 'my', element: lazyEl(<MyDashboard />) },
              { path: 'my/records', element: lazyEl(<MyRecords />) },
              { path: 'my/records/:studySeq', element: lazyEl(<MyRecordChapters />) },
              { path: 'my/certificates', element: lazyEl(<MyCertificates />) },
              { path: 'my/certificates/:studySeq', element: lazyEl(<MyCertificateDetail />) },
              { path: 'my/saved', element: lazyEl(<MySaved />) },
              { path: 'my/likes', element: lazyEl(<MySaved />) },
              { path: 'my/report', element: lazyEl(<MyReport />) },
              { path: 'my/ranking', element: lazyEl(<MyRanking />) },
              { path: 'my/assessment', element: lazyEl(<MyAssessmentHub />) },
              { path: 'my/company-training', element: lazyEl(<MyCompanyTraining />) },
              { path: 'my/surveys', element: lazyEl(<MySurveys />) },
              { path: 'my/profile', element: lazyEl(<MyProfile />) },
              { path: 'my/notices', element: lazyEl(<MyNotices />) },
              { path: 'my/tickets', element: lazyEl(<MyTickets />) },
              { path: 'my/*', element: <NotFoundPage /> },
            ],
          },
          { element: <PlayerLayout />, children: [{ path: 'learn/:studySeq/:chapterSeq', element: lazyEl(<PlayerPage />) }] },
        ],
      },
      // 기업 교육담당자: learner session with eduManager (AR-21)
      { element: <RequireRole roles={['manager', 'admin']} />, children: [{ element: <ManagerLayout />, children: managerRoutes }] },
      // 관리자: separate staff session (AdminSessionProvider) — /admin/login + RequireAdmin live inside the tree
      adminRouteTree,
    ],
  },
]);
