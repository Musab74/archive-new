import { lazy, Suspense, type ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Skeleton } from '../../shared/ui/Skeleton';
import { NotFoundPage } from '../../app/placeholders';

const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const TraineesPage = lazy(() => import('./pages/TraineesPage'));
const TraineeDetailPage = lazy(() => import('./pages/TraineeDetailPage'));
const CompletionPage = lazy(() => import('./pages/CompletionPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const NudgePage = lazy(() => import('./pages/NudgePage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const TraineeReportPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.TraineeReportPage })));
const EducationReportPage = lazy(() => import('./pages/EducationReportPage'));
const AssessmentReportPage = lazy(() => import('./pages/AssessmentReportPage'));

const fallback = <div className="section" aria-busy="true"><Skeleton height={28} width="40%" /><Skeleton lines={5} /></div>;
const el = (node: ReactNode) => <Suspense fallback={fallback}>{node}</Suspense>;

/** /manager/* children (rendered inside ManagerLayout → ManagerShell). Static report paths rank above :id. */
export const managerRoutes: RouteObject[] = [
  { path: 'manager', element: el(<OverviewPage />) },
  { path: 'manager/trainees', element: el(<TraineesPage />) },
  { path: 'manager/trainees/:id', element: el(<TraineeDetailPage />) },
  { path: 'manager/completion', element: el(<CompletionPage />) },
  { path: 'manager/payments', element: el(<PaymentsPage />) },
  { path: 'manager/nudge', element: el(<NudgePage />) },
  { path: 'manager/reports', element: el(<ReportsPage />) },
  { path: 'manager/reports/education-results', element: el(<EducationReportPage />) },
  { path: 'manager/reports/assessment-results', element: el(<AssessmentReportPage />) },
  { path: 'manager/reports/:id', element: el(<TraineeReportPage />) },
  { path: 'manager/*', element: <NotFoundPage /> },
];
