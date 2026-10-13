/** Response schemas for endpoints the contracts package does not (yet) describe. */
import { z } from 'zod';
import { AdminSessionSchema, CourseCardSchema, DesignConfigSchema, DesignVersionMetaSchema, MediaAssetSchema, ThemeTokensSchema } from '@ainex/contracts';

export const pageOf = <T extends z.ZodTypeAny>(item: T) => z.object({ items: z.array(item), page: z.number().int(), size: z.number().int(), total: z.number().int() });
export const listOf = <T extends z.ZodTypeAny>(item: T) => z.object({ items: z.array(item) });
export const OkSchema = z.object({ ok: z.boolean() });

export const CategorySchema = z.object({ id: z.number().int(), name: z.string(), parentId: z.number().int().nullable().optional(), count: z.number().int().optional() });
export type Category = z.infer<typeof CategorySchema>;
export const KeywordSchema = z.object({ id: z.number().int().optional(), name: z.string(), count: z.number().int().optional() });
export type Keyword = z.infer<typeof KeywordSchema>;

export const ChapterSchema = z.object({ seq: z.number().int(), number: z.string(), title: z.string(), minutes: z.number().int().nullable().optional(), progress: z.number().nullable().optional(), completed: z.boolean().optional() });
export type Chapter = z.infer<typeof ChapterSchema>;
export const ReviewSchema = z.object({ idx: z.number().int(), name: z.string(), starPoint: z.number().int(), title: z.string().default(''), contents: z.string().default(''), regDate: z.string().nullable() });
export type Review = z.infer<typeof ReviewSchema>;

export const CourseDetailSchema = CourseCardSchema.extend({
  description: z.string().nullable().optional(),
  objective: z.string().nullable().optional(),
  teacher: z.string().nullable().optional(),
  teacherIntro: z.string().nullable().optional(),
  year: z.string().nullable().optional(),
  updatedDate: z.string().nullable().optional(),
  chapters: z.array(ChapterSchema).default([]),
  reviews: z.array(ReviewSchema).default([]),
  myRating: z.number().int().nullable().optional(),
  canRate: z.boolean().optional(),
  previewUrl: z.string().nullable().optional(),
  studySeq: z.number().int().nullable().optional(),
  lastChapterSeq: z.number().int().nullable().optional(),
  progress: z.number().nullable().optional(),
  isPublic: z.boolean().optional(),
});
export type CourseDetail = z.infer<typeof CourseDetailSchema>;

export const NoticeSchema = z.object({ idx: z.number().int(), title: z.string(), contents: z.string().nullable().optional(), regDate: z.string().nullable(), pinned: z.boolean().optional(), category: z.string().nullable().optional(), viewCount: z.number().int().optional(), attachments: z.array(z.object({ name: z.string(), url: z.string() })).optional() });
export type Notice = z.infer<typeof NoticeSchema>;
export const FaqSchema = z.object({ idx: z.number().int(), category: z.string().nullable().optional(), question: z.string(), answer: z.string(), link: z.string().nullable().optional() });
export type Faq = z.infer<typeof FaqSchema>;
export const ResourceSchema = z.object({ idx: z.number().int(), title: z.string(), description: z.string().nullable().optional(), url: z.string().nullable().optional(), regDate: z.string().nullable().optional() });
export type Resource = z.infer<typeof ResourceSchema>;
export const EventSchema = z.object({ idx: z.number().int(), title: z.string(), startsAt: z.string().nullable(), endsAt: z.string().nullable().optional(), place: z.string().nullable().optional(), url: z.string().nullable().optional(), description: z.string().nullable().optional() });
export type EventItem = z.infer<typeof EventSchema>;
export const InquiryResultSchema = z.object({ idx: z.number().int().optional(), ok: z.boolean().optional() });

export const IdCheckSchema = z.object({ available: z.boolean() });
export const FindIdResultSchema = z.object({ ids: z.array(z.object({ id: z.string(), regDate: z.string().nullable().optional() })).default([]) });
export const PasswordResetResultSchema = z.object({ sent: z.boolean(), tempPassword: z.string().optional() });
export const RoadmapStepSchema = z.object({ order: z.number().int(), lectureCode: z.string().nullable().optional(), title: z.string(), reason: z.string().nullable().optional(), minutes: z.number().int().nullable().optional(), ctype: z.string().nullable().optional() });
export const RoadmapSchema = z.object({ summary: z.string().nullable().optional(), items: z.array(RoadmapStepSchema) });
export type Roadmap = z.infer<typeof RoadmapSchema>;

// ---------------------------------------------------------------------------
// Learner core (AR-02 / 06..18) — shapes confirmed against the live API.
// ---------------------------------------------------------------------------

const ns = z.string().nullable().optional();
const num0 = z.number().default(0);

export const MyPeriodSchema = z.object({ start: ns, end: ns, label: z.string().default(''), daysLeft: z.number().nullable().optional() });

/** GET /my/status — 15 h completion clock for the current enrollment. */
export const MyStatusSchema = z.object({
  studySeq: z.number().int().nullable(),
  lectureCode: ns,
  serviceType: ns,
  serviceTypeLabel: z.string().default(''),
  period: MyPeriodSchema.nullable().optional(),
  activeSeconds: num0,
  carryoverSeconds: num0,
  carryoverPeriodLabel: z.string().optional(),
  totalSeconds: num0,
  completionSeconds: num0,
  completionCriteriaSeconds: z.number().default(54000),
  percent: num0,
  achieved: z.boolean().default(false),
  formatted: z.string().default(''),
  ratioLabel: z.string().default(''),
  passOk: z.boolean().default(false),
  studyEnd: z.boolean().default(false),
  preAssessment: z.object({ submitted: z.boolean() }).optional(),
  postAssessment: z.object({ submitted: z.boolean() }).optional(),
});
export type MyStatus = z.infer<typeof MyStatusSchema>;

export const RecentStudySchema = z.object({ progressIdx: z.number().optional(), studySeq: z.number(), lectureCode: z.string(), courseName: ns, contentsIdx: z.number().nullable().optional(), chapterSeq: z.number(), title: ns, lastStudy: ns, progress: num0, studyTime: num0, studiedAt: ns });
export type RecentStudy = z.infer<typeof RecentStudySchema>;
export const NextChapterSchema = z.object({ chapterSeq: z.number(), lectureCode: z.string(), courseName: ns, contentsIdx: z.number().nullable().optional(), title: ns, order: z.number(), progress: num0 });
export type NextChapter = z.infer<typeof NextChapterSchema>;
export const TypeCountSchema = z.object({ enrolled: num0, inProgress: num0, completed: num0, notStarted: num0 });
export const DashboardSchema = z.object({
  status: MyStatusSchema.nullable().optional(),
  countsByType: z.record(TypeCountSchema).default({}),
  courses: z.array(z.object({ lectureCode: z.string(), ctype: ns, name: ns, percent: num0, seconds: num0 })).default([]),
  recent: z.array(RecentStudySchema).default([]),
  nextChapters: z.array(NextChapterSchema).default([]),
  unrated: z.array(z.object({ lectureCode: z.string(), name: ns })).default([]),
});
export type Dashboard = z.infer<typeof DashboardSchema>;

/** GET /enrollments/me */
export const EnrollmentSchema = z.object({
  studySeq: z.number().int(), lectureCode: z.string(), courseName: ns, serviceType: ns, mode: z.enum(['REFUND', 'NON_REFUND']).or(z.string()),
  lectureStart: ns, lectureEnd: ns, progress: num0, passOk: z.boolean().default(false), studyEnd: z.boolean().default(false), active: z.boolean().optional(),
  state: z.enum(['BEFORE', 'ACTIVE', 'ENDED']).or(z.string()), termeIdx: z.number().nullable().optional(), openChapter: z.number().nullable().optional(), companyCode: ns, isPackage: z.boolean().optional(),
});
export type Enrollment = z.infer<typeof EnrollmentSchema>;

export const PreAssessmentStatusLooseSchema = z.object({
  status: z.string(), submitted: z.boolean(), started: z.boolean().optional(), profileComplete: z.boolean().optional(), col1: z.string().default(''),
  commonAnswered: num0, commonRequired: num0, roleAnswered: num0, roleRequired: num0, answered: num0, required: num0,
  nextStep: z.enum(['step01', 'step02', 'step03', 'done']), label: z.string().optional(),
});
export type PreStatus = z.infer<typeof PreAssessmentStatusLooseSchema>;
export const CurrentEnrollmentSchema = z.object({ studySeq: z.number().int().nullable(), preAssessment: PreAssessmentStatusLooseSchema.nullable().optional() });
export type CurrentEnrollment = z.infer<typeof CurrentEnrollmentSchema>;

/** POST /player/session descriptor. */
export const PlayerChapterSchema = z.object({
  chapterSeq: z.number(), number: z.number(), title: z.string(), minutes: num0, contentsIdx: num0, contentsDetailSeq: num0, contentsType: ns,
  url: ns, mobileUrl: ns, progress: num0, studyTime: num0, lastStudy: ns,
});
export type PlayerChapter = z.infer<typeof PlayerChapterSchema>;
export const PlayerDescriptorSchema = z.object({
  playToken: z.string(),
  study: z.object({ seq: z.number(), lectureCode: z.string(), serviceType: ns, mode: z.string(), lectureStart: ns, lectureEnd: ns, passOk: z.boolean().default(false) }),
  contentLectureCode: z.string(),
  chapter: PlayerChapterSchema.extend({ total: z.number(), completeTimeSec: num0 }),
  chapters: z.array(PlayerChapterSchema),
  resume: z.object({ positionSec: num0, studyTimeSec: num0 }),
  totals: z.object({ recognizedSec: num0, todaySec: num0, dailyCapSec: z.number().default(28800), dailyCapClientStopSec: z.number().default(28770) }),
  gates: z.object({ identity: z.enum(['ok', 'required']), dailyCapReached: z.boolean().default(false), alreadyDone: z.boolean().default(false) }),
  tick: z.object({ intervalMs: z.number().default(60000), heartbeatMs: z.number().default(60000), idleTimeoutMs: z.number().default(7200000), sessionMaxHours: z.number().optional() }),
  identityUrl: ns,
});
export type PlayerDescriptor = z.infer<typeof PlayerDescriptorSchema>;

/** Legacy lecture_progress.php shape — always HTTP 200. */
export const TickAckSchema = z.object({
  ChkError: z.enum(['N', 'X', 'F']),
  message: z.string().optional(),
  StudyTime: z.number().optional(),
  PositionSec: z.number().optional(),
  ChapterProgress: z.number().optional(),
  Total_Progress: z.number().optional(),
  PassOk: z.string().optional(),
  Overlap: z.string().optional(),
  DailyCap: z.string().optional(),
  Chapter_Number: z.number().optional(),
  Study_Seq: z.number().optional(),
  ProgressCount: z.string().optional(),
});
export type TickAck = z.infer<typeof TickAckSchema>;
export const HeartbeatAckSchema = z.object({ ok: z.boolean(), error: z.enum(['other_session', 'session_expired']).or(z.string()).optional(), message: z.string().optional() });
export type HeartbeatAck = z.infer<typeof HeartbeatAckSchema>;

/** Assessment */
export const AssessmentQuestionSchema = z.object({ idx: z.number().int(), group: z.string(), order: z.number().optional(), bind: ns, text: z.string().default(''), detail: ns });
export type AssessmentQuestion = z.infer<typeof AssessmentQuestionSchema>;
export const AssessmentQuestionsSchema = z.object({ questions: z.array(AssessmentQuestionSchema), jobTracks: z.array(z.string()).default([]) });
export const AssessmentScoreSchema = z.object({ col1: z.string().optional(), common: num0, leader: num0, job: num0, total: num0, submitted: z.boolean().default(false) });
export type AssessmentScore = z.infer<typeof AssessmentScoreSchema>;
export const AssessmentResultSchema = z.object({ studySeq: z.number().nullable().optional(), pre: AssessmentScoreSchema, post: AssessmentScoreSchema, comparable: z.boolean().default(false) });
export type AssessmentResult = z.infer<typeof AssessmentResultSchema>;

/** My room */
export const HistoryRecordSchema = z.object({ studySeq: z.number(), lectureCode: z.string(), courseName: ns, contentsIdx: z.number().nullable().optional(), title: ns, firstAt: ns, lastAt: ns, studyTime: num0, formatted: z.string().default(''), progress: num0, logs: z.number().optional() });
export type HistoryRecord = z.infer<typeof HistoryRecordSchema>;
export const CompletionRecordSchema = z.object({ studySeq: z.number(), lectureCode: ns, courseName: ns, serviceType: ns, period: MyPeriodSchema.nullable().optional(), progress: num0, seconds: num0, formatted: z.string().default(''), passOk: z.boolean().default(false), studyEnd: z.boolean().default(false), state: z.string().default('') });
export type CompletionRecord = z.infer<typeof CompletionRecordSchema>;
export const RecordChapterSchema = z.object({ chapterSeq: z.number(), lectureCode: z.string(), courseName: ns, order: z.number(), contentsIdx: z.number().nullable().optional(), title: ns, lectureTimeMin: num0, progress: num0, studyTime: num0, lastStudy: ns, lastStudiedAt: ns });
export type RecordChapter = z.infer<typeof RecordChapterSchema>;
export const RecordChaptersSchema = z.object({ studySeq: z.number(), lectureCode: z.string(), codes: z.array(z.string()).default([]), isPackage: z.boolean().default(false), chapters: z.array(RecordChapterSchema), totalSeconds: num0, formatted: z.string().default('') });
export type RecordChapters = z.infer<typeof RecordChaptersSchema>;
export const CertificateListItemSchema = z.object({ studySeq: z.number(), lectureCode: z.string(), courseName: ns, period: MyPeriodSchema.or(z.string()).nullable().optional(), issuedAt: ns });
export type CertificateListItem = z.infer<typeof CertificateListItemSchema>;
export const CertificateSchema = z.object({
  studySeq: z.number(), learner: z.object({ id: z.string(), name: z.string(), birthDay: ns }), course: z.object({ lectureCode: z.string(), name: ns, hrdCode: ns, contentsTime: ns }),
  period: MyPeriodSchema.nullable().optional(), hours: z.object({ seconds: num0, formatted: z.string().default(''), wholeHours: num0 }), company: z.object({ code: ns, name: ns }).nullable().optional(), issuedAt: ns, pdf: z.string().nullable().optional(),
});
export type Certificate = z.infer<typeof CertificateSchema>;
export const SavedItemSchema = z.object({ likeIdx: z.number().optional(), lectureCode: z.string(), savedAt: ns, name: ns, ctype: ns, image: ns, contentsTime: z.union([z.string(), z.number()]).nullable().optional(), category1: ns, category2: ns, professor: ns, visible: z.boolean().optional() });
export type SavedItem = z.infer<typeof SavedItemSchema>;
export const BadgeSchema = z.object({ id: z.string(), name: z.string(), category: z.string(), description: z.string().default(''), icon: z.string().default(''), achieved: z.boolean(), achievedDate: ns, progress: num0, requirement: z.string().optional() });
export type Badge = z.infer<typeof BadgeSchema>;
export const BadgesSchema = z.object({ summary: z.object({ total: num0, achieved: num0, remaining: num0 }), categories: z.array(z.string()).default([]), badgesByCategory: z.record(z.array(BadgeSchema)).default({}), badges: z.array(BadgeSchema).optional(), stats: z.object({ completedCourses: num0, totalMinutes: num0, totalHours: num0, longestStreak: num0, currentStreak: num0, totalStudyDays: num0, aiZoneCount: num0 }).optional() });
export type Badges = z.infer<typeof BadgesSchema>;
export const RankRowSchema = z.object({ id: z.string(), score: num0, studyMinutes: num0, completedCourses: num0, avgProgress: num0, companyCode: ns, rank: z.number().optional() });
export const RankingSchema = z.object({ scope: z.string(), scopeLabel: z.string().default(''), rank: num0, companyRank: num0, companyName: ns, companyTotal: num0, score: num0, totalUsers: num0, my: RankRowSchema.nullable().optional(), top10: z.array(RankRowSchema).default([]), aroundMe: z.array(RankRowSchema).default([]), formula: z.string().optional() });
export type Ranking = z.infer<typeof RankingSchema>;
export const WeeklySchema = z.object({
  thisWeek: z.object({ seconds: num0, minutes: num0, hours: num0, studyDays: num0, coursesStudied: num0, formatted: z.string().default('') }),
  lastWeek: z.object({ seconds: num0, minutes: num0, hours: num0 }),
  comparison: z.object({ wowDelta: num0, wowPercentage: num0, trend: z.string().default('stable') }),
  goal: z.object({ targetMinutes: num0, targetHours: num0, progressRate: num0, remainingMinutes: num0 }),
  streak: num0,
  chartData: z.array(z.object({ date: z.string(), dayOfWeek: z.string(), seconds: num0, minutes: num0, hours: num0 })).default([]),
});
export type Weekly = z.infer<typeof WeeklySchema>;
export const CorrectionNoticesSchema = z.object({
  items: z.array(z.object({ id: z.union([z.string(), z.number()]).optional(), totalDeltaSec: num0, formatted: z.string().default(''), appliedAt: ns, acknowledgedAt: ns, acknowledged: z.boolean().default(false) })).default([]),
  corrections: z.array(z.object({ idx: z.number(), action: ns, oldSeconds: num0, newSeconds: num0, deltaSeconds: num0, note: ns, appliedAt: ns })).default([]),
});
export type CorrectionNotices = z.infer<typeof CorrectionNoticesSchema>;
export const ConsentsSchema = z.object({ mandatory: z.boolean().default(false), mandatoryDate: ns, sending: z.boolean().default(false), sendingDate: ns, marketing: z.string().default('N'), marketingDate: ns });
export const LearnerProfileSchema = z.object({
  idx: z.number().optional(), id: z.string(), name: z.string(), memberType: ns, email: ns, mobile: ns, tel: ns, birthDay: ns, gender: ns, zipcode: ns, address01: ns, address02: ns,
  companyCode: ns, companyName: ns, depart: ns, position: ns, interests: ns, consents: ConsentsSchema.default({}), eduManager: z.boolean().optional(), testId: z.boolean().optional(), mustChangePassword: z.boolean().optional(), regDate: ns, editDate: ns, lastLogin: ns,
});
export type LearnerProfile = z.infer<typeof LearnerProfileSchema>;
export const CompanySchema = z.object({ idx: z.number().optional(), companyCode: ns, companyName: ns, scale: ns, ceo: ns, zipcode: ns, address01: ns, address02: ns, tel: ns, homepage: ns, eduManager: z.object({ name: ns, phone: ns, email: ns }).nullable().optional() }).nullable();
export type Company = z.infer<typeof CompanySchema>;
export const PackageChildrenSchema = z.object({ lectureCode: z.string(), title: ns, items: z.array(CourseCardSchema) });
export type PackageChildren = z.infer<typeof PackageChildrenSchema>;
export const AiRoadmapSchema = z.object({ steps: z.array(z.object({ lectureCode: ns, title: z.string(), reason: ns, minutes: z.number().nullable().optional() })).default([]), summary: ns, source: z.enum(['ai', 'fallback']).or(z.string()).default('fallback') });
export type AiRoadmap = z.infer<typeof AiRoadmapSchema>;
export const CounselSchema = z.object({ idx: z.number(), category: ns, categoryName: ns, title: z.string(), status: ns, statusLabel: ns, answered: z.boolean().default(false), regDate: ns, answeredAt: ns, lectureCode: ns, studySeq: z.number().nullable().optional() });
export type Counsel = z.infer<typeof CounselSchema>;

// ---------------------------------------------------------------------------------------------------------------------
// Manager (교육담당자) — GET /manager/*
// ---------------------------------------------------------------------------------------------------------------------
const optStr = z.string().nullable().optional();
const optNum = z.number().nullable().optional();
export const StudyPeriodSchema = z.object({ start: z.string(), end: z.string(), label: z.string().optional() });
export type StudyPeriod = z.infer<typeof StudyPeriodSchema>;

export const ManagerCompanySchema = z.object({ companyCode: z.string(), companyName: z.string().nullable(), ceo: optStr, hrd: optStr, tel: optStr, eduManager: optStr, trainees: z.number() });
export type ManagerCompany = z.infer<typeof ManagerCompanySchema>;
export const ManagerOverviewSchema = z.object({ scope: z.array(z.string()), today: z.string(), enrollments: z.number(), trainees: z.number(), active: z.number(), over15h: z.number(), passOk: z.number(), closed: z.number(), preDone: z.number(), postDone: z.number(), avgSeconds: z.number(), avgFormatted: z.string(), totalSeconds: z.number() });
export type ManagerOverview = z.infer<typeof ManagerOverviewSchema>;
export const TraineeRowSchema = z.object({
  studySeq: z.number(), id: z.string(), name: optStr, depart: optStr, position: optStr, companyCode: z.string(), companyName: optStr, lectureCode: z.string(), courseName: z.string(), serviceType: optStr, termeIdx: z.number().optional(),
  period: StudyPeriodSchema, seconds: z.number(), formatted: z.string(), percent: z.number(), over15h: z.boolean(), storedProgress: z.number(), passOk: z.boolean(), studyEnd: z.boolean(), active: z.boolean(), preDone: z.boolean(), postDone: z.boolean(), lastLearning: optStr, certCount: z.number(),
});
export type TraineeRow = z.infer<typeof TraineeRowSchema>;
export const TraineePageSchema = pageOf(TraineeRowSchema);
export const ChapterProgressRowSchema = z.object({ chapterSeq: z.number(), lectureCode: z.string().nullable().optional(), courseName: optStr, order: z.number().nullable().optional(), contentsIdx: optNum, title: optStr, lectureTimeMin: optNum, progress: optNum, studyTime: optNum, lastStudy: optStr, lastStudiedAt: optStr });
export type ChapterProgressRow = z.infer<typeof ChapterProgressRowSchema>;
export const DailyRowSchema = z.object({ date: z.string(), seconds: z.number(), creditedSec: z.number(), excessSec: z.number(), status: z.enum(['ok', 'cap', 'over']), statusLabel: z.string() });
export type DailyRow = z.infer<typeof DailyRowSchema>;
export const TraineeProgressSchema = z.object({
  trainee: z.object({ id: z.string(), name: optStr }), studySeq: z.number(), companyCode: z.string(), lectureCode: z.string(), courseName: z.string(), period: StudyPeriodSchema, passOk: z.boolean(), studyEnd: z.boolean(),
  seconds: z.number(), formatted: z.string(), percent: z.number(), codes: z.array(z.string()).default([]), isPackage: z.boolean().optional(), chapters: z.array(ChapterProgressRowSchema).default([]), daily: z.array(DailyRowSchema).default([]),
});
export type TraineeProgress = z.infer<typeof TraineeProgressSchema>;
export const CompletionRowSchema = z.object({ companyCode: z.string(), companyName: optStr, lectureCode: z.string(), courseName: z.string(), period: StudyPeriodSchema, total: z.number(), passed: z.number(), failed: z.number(), closed: z.number(), over15h: z.number(), passRate: z.number() });
export type CompletionRow = z.infer<typeof CompletionRowSchema>;
export const PaymentRowSchema = z.object({ idx: z.number(), companyCode: z.string(), period: StudyPeriodSchema, bankPrice: z.number(), cardPrice: z.number(), payStatus: optStr, payStatusLabel: optStr, payMethod: optStr, orderNo: optStr, payDate: optStr, regDate: optStr, cancelDate: optStr, remark: optStr });
export type PaymentRow = z.infer<typeof PaymentRowSchema>;

// ---------------------------------------------------------------------------------------------------------------------
// Admin (관리자) — /auth/admin/*, /admin/*
// ---------------------------------------------------------------------------------------------------------------------
export const AdminLoginResponseSchema = z.object({ accessToken: z.string(), expiresIn: z.number().int(), admin: AdminSessionSchema });
export type AdminLoginResponse = z.infer<typeof AdminLoginResponseSchema>;
export const OkResultSchema = z.object({ ok: z.boolean(), updated: z.number().optional(), fields: z.array(z.string()).optional(), deleted: z.number().optional(), idx: z.number().optional(), status: z.string().optional(), mustChangePassword: z.boolean().optional() }).passthrough();
export type OkResult = z.infer<typeof OkResultSchema>;

export const AdminDashboardSchema = z.object({
  today: z.string(), monthStart: z.string(), logins: z.object({ today: optNum, uniqueUsers: optNum }), activePlayers: z.object({ count: optNum, freshnessSeconds: z.number() }), learnersOver15hThisMonth: optNum, activeEnrollments: optNum,
  emon: z.object({ pending: optNum, pendingStale: optNum }), support: z.object({ openInquiries: optNum, openCounsel: optNum }), signupsToday: optNum,
});
export type AdminDashboard = z.infer<typeof AdminDashboardSchema>;

export const MemberRowSchema = z.object({ idx: z.number(), id: z.string(), name: optStr, memberType: optStr, companyCode: optStr, companyName: optStr, depart: optStr, position: optStr, useYN: optStr, eduManager: z.boolean(), testId: z.boolean(), protectId: optStr, sleep: z.boolean(), memberOut: z.boolean(), lastLogin: optStr, regDate: optStr, passChange: optStr, enrollments: z.number() });
export type MemberRow = z.infer<typeof MemberRowSchema>;
export const AdminMemberProfileSchema = z.object({
  idx: z.number(), id: z.string(), name: optStr, memberType: optStr, companyCode: optStr, companyName: optStr, depart: optStr, position: optStr, gender: optStr, address: z.object({ zipcode: optStr, address01: optStr, address02: optStr }), email: optStr, mobile: optStr, tel: optStr, birthDay: optStr,
  useYN: optStr, eduManager: optStr, testId: optStr, protectId: optStr, memberRemark: optStr, sleep: optStr, sleepDate: optStr, memberOut: optStr, memberOutDate: optStr, lastLogin: optStr, lastLoginIp: optStr, regDate: optStr, editDate: optStr, passChange: optStr, mandatory: optStr, marketing: optStr, abilityYN: optStr, abilityAfterYN: optStr,
  hrd: z.object({ nwIno: optStr, trneeSe: optStr, irglbrSe: optStr }).optional(),
});
export type AdminMemberProfile = z.infer<typeof AdminMemberProfileSchema>;
export const MemberEnrollmentSchema = z.object({ studySeq: z.number(), lectureCode: z.string(), courseName: z.string(), serviceType: optStr, companyCode: optStr, period: StudyPeriodSchema, termeIdx: z.number().optional(), storedProgress: z.number(), seconds: z.number(), formatted: z.string(), percent: z.number(), over15h: z.boolean(), passOk: z.boolean(), studyEnd: z.boolean(), inputDate: optStr });
export const MemberDetailSchema = z.object({
  profile: AdminMemberProfileSchema, managedCompanies: z.array(z.object({ idx: z.number(), companyCode: z.string(), regDate: optStr })).default([]), enrollments: z.array(MemberEnrollmentSchema).default([]),
  loginHistory: z.array(z.object({ idx: z.number(), device: optStr, ip: optStr, userAgent: optStr, at: optStr })).default([]), identity: z.object({ certCount: z.number(), certSuccess: z.number(), lastCertAt: optStr }),
});
export type MemberDetail = z.infer<typeof MemberDetailSchema>;

export const StudyRowSchema = z.object({
  studySeq: z.number(), id: z.string(), name: optStr, companyCode: optStr, companyName: optStr, lectureCode: z.string(), courseName: z.string(), serviceType: optStr, termeIdx: z.number().optional(), period: StudyPeriodSchema, active: z.boolean(),
  seconds: z.number(), formatted: z.string(), percent: z.number(), over15h: z.boolean(), storedProgress: z.number(), passOk: z.boolean(), studyEnd: z.boolean(), preDone: z.boolean(), postDone: z.boolean(), lastLearning: optStr, salesId: optStr, tutor: optStr, inputDate: optStr, remark: optStr,
});
export type StudyRow = z.infer<typeof StudyRowSchema>;
export const StudyDetailSchema = StudyRowSchema.extend({
  packageSeconds: z.number().optional(), packageFormatted: z.string().optional(), price: z.object({ price: z.number(), refund: z.number(), self: z.number() }).optional(), failReason: optStr, studyIp: optStr, certCount: z.number().optional(),
  codes: z.array(z.string()).default([]), isPackage: z.boolean().optional(), chapters: z.array(ChapterProgressRowSchema).default([]), daily: z.array(DailyRowSchema).default([]),
  overlap: z.object({ sharedMinutes: z.number(), minutes: z.array(z.object({ minute: z.string(), contents: z.array(z.number()) })), rule: z.string() }),
  identity: z.array(z.object({ seq: z.number(), at: optStr, type: optStr, ok: z.boolean(), ip: optStr, evalCd: optStr })).default([]),
  corrections: z.array(z.object({ idx: z.number(), action: optStr, oldSeconds: z.number(), newSeconds: z.number(), deltaSeconds: z.number(), note: optStr, appliedAt: optStr })).default([]),
});
export type StudyDetail = z.infer<typeof StudyDetailSchema>;
export const ProgressLogRowSchema = z.object({ idx: z.number(), lectureCode: optStr, chapterSeq: z.number(), contentsIdx: z.number(), title: optStr, detailSeq: z.number(), lastStudy: optStr, positionSec: optNum, progress: z.number(), studyTime: z.number(), totalProgress: z.number(), ip: optStr, at: optStr, triggerYN: optStr, chapterNumber: optStr });
export type ProgressLogRow = z.infer<typeof ProgressLogRowSchema>;
export const ProgressLogPageSchema = z.object({ items: z.array(ProgressLogRowSchema), nextCursor: z.number().nullable(), hasMore: z.boolean() });
export type ProgressLogPage = z.infer<typeof ProgressLogPageSchema>;
export const DailyMonitorSchema = z.object({
  date: z.string(), companyCode: optStr, stats: z.object({ learners: z.number(), rows: z.number(), totalSeconds: z.number(), over: z.number(), cap: z.number(), capSeconds: z.number() }),
  items: z.array(z.object({ id: z.string(), name: optStr, companyCode: optStr, companyName: optStr, studySeq: z.number(), lectureCode: optStr, seconds: z.number(), formatted: z.string(), creditedSec: z.number(), excessSec: z.number(), status: z.string(), statusLabel: z.string() })),
});
export type DailyMonitor = z.infer<typeof DailyMonitorSchema>;
export const OverlapMonitorSchema = z.object({ from: z.string(), to: z.string(), rule: z.string(), items: z.array(z.object({ id: z.string(), name: optStr, companyCode: optStr, studySeq: z.number(), sharedMinutes: z.number(), firstMinute: optStr, lastMinute: optStr })) });
export type OverlapMonitor = z.infer<typeof OverlapMonitorSchema>;
export const AbnormalRowSchema = z.object({ idx: z.number(), detectDate: optStr, detectedAt: optStr, category: optStr, issueCode: optStr, severity: optStr, id: optStr, name: optStr, studySeq: optNum, lectureCode: optStr, chapterSeq: optNum, contentsIdx: optNum, metric: z.unknown().optional(), sample: optStr, status: optStr, statusNote: optStr, statusBy: optStr, statusAt: optStr, source: optStr });
export type AbnormalRow = z.infer<typeof AbnormalRowSchema>;
export const AbnormalPageSchema = pageOf(AbnormalRowSchema).extend({ byCode: z.array(z.object({ code: z.string().nullable(), count: z.number() })).default([]) });
export type AbnormalPage = z.infer<typeof AbnormalPageSchema>;

export const CourseRowSchema = z.object({ idx: z.number(), ctype: optStr, lectureCode: z.string(), name: optStr, useYN: optStr, hrdCode: optStr, category1: optStr, category2: optStr, keyword1: optStr, keyword2: optStr, contentsTime: optStr, chapter: optStr, chapterRows: z.number(), isPackage: z.boolean(), packageCodes: z.array(z.string()), image: optStr, professor: optStr, price: z.number(), passTime: z.number(), regDate: optStr, views: z.number(), enrollments: z.number() });
export type CourseRow = z.infer<typeof CourseRowSchema>;
export const AdminCourseDetailSchema = CourseRowSchema.extend({
  keyword3: optStr, keyword4: optStr, intro: optStr, eduTarget: optStr, eduGoal: optStr, serviceType: optStr, mobile: optStr, contentsUrl: optStr, mobileUrl: optStr, contentsStart: optStr, contentsEnd: optStr, uploadDate: optStr, hrdSeq: optNum.or(z.string().nullable()).optional(),
  prices: z.object({ normal: z.number(), priority: z.number(), large1: z.number(), large2: z.number() }).optional(), legalEduReq: optStr,
  terms: z.array(z.object({ idx: z.number(), start: optStr, end: optStr, serviceType: optStr, openYear: optStr.or(optNum), openTerme: optStr.or(optNum), openChapter: optStr.or(optNum) })).default([]),
});
export type AdminCourseDetail = z.infer<typeof AdminCourseDetailSchema>;
export const AdminChapterRowSchema = z.object({ chapterSeq: z.number(), chapterType: optStr, order: z.number(), subIdx: optStr.or(optNum), regDate: optStr, contentsIdx: optNum, gubun: optStr, title: optStr, lectureTimeMin: optNum, deleted: z.boolean(), details: z.number() });
export type AdminChapterRow = z.infer<typeof AdminChapterRowSchema>;
export const ContentsRowSchema = z.object({ idx: z.number(), gubun: optStr, title: optStr, lectureTimeMin: optNum, regDate: optStr, size: z.object({ width: optNum.or(optStr), height: optNum.or(optStr) }).optional(), usedIn: z.number() });
export type ContentsRow = z.infer<typeof ContentsRowSchema>;
export const ContentsDetailRowSchema = z.object({ seq: z.number(), type: optStr, pages: optStr.or(optNum), mobilePages: optStr.or(optNum), urlSelect: optStr, url: optStr, url2: optStr, mobileUrl: optStr, mobileUrl2: optStr, question: optStr, answer: optStr, teacher: optStr, useYN: optStr, order: z.number(), caption: optStr });
export const AdminContentsDetailSchema = z.object({ idx: z.number(), gubun: optStr, title: optStr, lectureTimeMin: optNum, goal: optStr, trainingContents: optStr, activities: optStr, regDate: optStr, deleted: z.boolean(), size: z.object({ width: optNum.or(optStr), height: optNum.or(optStr) }).optional(), details: z.array(ContentsDetailRowSchema).default([]), usedIn: z.array(z.object({ lectureCode: z.string(), chapterSeq: z.number(), order: z.number() })).default([]) });
export type AdminContentsDetail = z.infer<typeof AdminContentsDetailSchema>;
export const AdminCategorySchema = z.object({ idx: z.number(), parent: z.number(), deep: z.number(), name: optStr, order: optNum, useYN: optStr });
export const AdminCategoriesSchema = z.object({ categories: z.array(AdminCategorySchema), tree: z.array(AdminCategorySchema.extend({ children: z.array(AdminCategorySchema) })), keywords: z.array(z.object({ idx: z.number(), category: optStr, keyword: optStr, jobCate: optStr, useYN: optStr, order: optNum })) });
export type AdminCategories = z.infer<typeof AdminCategoriesSchema>;
export const CurationListSchema = z.object({ gubun: z.string(), label: z.string(), items: z.array(z.object({ idx: z.number(), lectureCode: z.string(), order: z.number(), useYN: optStr, regDate: optStr, regId: optStr, name: optStr, ctype: optStr, courseVisible: z.boolean() })) });
export type CurationList = z.infer<typeof CurationListSchema>;

export const AdminNoticeRowSchema = z.object({ idx: z.number(), useYN: optStr, pinned: z.boolean(), title: z.string(), views: z.number(), regDate: optStr, hasFile: z.boolean() });
export type AdminNoticeRow = z.infer<typeof AdminNoticeRowSchema>;
export const AdminNoticeDetailSchema = z.object({ idx: z.number(), useYN: optStr, pinned: z.boolean(), title: z.string(), content: optStr, views: z.number(), regDate: optStr, files: z.array(z.object({ file: z.string(), name: optStr })).default([]) });
export type AdminNoticeDetail = z.infer<typeof AdminNoticeDetailSchema>;
export const AdminFaqRowSchema = z.object({ idx: z.number(), order: z.number(), category: optStr, title: z.string(), useYN: optStr, regDate: optStr });
export type AdminFaqRow = z.infer<typeof AdminFaqRowSchema>;
export const AdminFaqDetailSchema = AdminFaqRowSchema.extend({ content: optStr });
export type AdminFaqDetail = z.infer<typeof AdminFaqDetailSchema>;
export const InquiryRowSchema = z.object({ idx: z.number(), serviceType: optStr, companyName: optStr, name: optStr, phone: optStr, email: optStr, personnel: optStr.or(optNum), contents: optStr, agreeYN: optStr, regDate: optStr, status: optStr, statusLabel: optStr, answer: z.object({ name: optStr, contents: optStr, regDate: optStr, mdfDate: optStr }) });
export type InquiryRow = z.infer<typeof InquiryRowSchema>;
export const CounselRowSchema = z.object({ idx: z.number(), id: optStr, name: optStr, category: optStr, title: optStr, contents: optStr, mobile: optStr, email: optStr, regDate: optStr, status: optStr, answered: z.boolean(), answer: z.object({ name: optStr, contents: optStr, regDate: optStr }), lectureCode: optStr, studySeq: optNum, contentsIdx: optNum, file: z.object({ file: z.string(), name: optStr }).nullable().optional(), studentFile: z.object({ file: z.string(), name: optStr }).nullable().optional() });
export type CounselRow = z.infer<typeof CounselRowSchema>;
export const CheatingRowSchema = z.object({ idx: z.number(), name: optStr, category: optStr, mobile: optStr, email: optStr, title: optStr, contents: optStr, regDate: optStr, status: optStr, answeredBy: optStr, answeredAt: optStr });
export type CheatingRow = z.infer<typeof CheatingRowSchema>;

export const SiteInfoSchema = z.object({ idx: z.number(), companyName: optStr, ceo: optStr, companyNumber: optStr, salesReportNumber: optStr, phone: optStr, fax: optStr, email: optStr, personalInformationManager: optStr, address: optStr, copyright: optStr, kakaoUrl: optStr, regDate: optStr }).nullable();
export type SiteInfo = z.infer<typeof SiteInfoSchema>;
export const StaffListSchema = z.object({
  departments: z.array(z.object({ idx: z.number(), dept: optStr, deptLabel: optStr, parent: optStr.or(optNum), deep: z.number(), name: optStr, topMenuGrant: optStr, subMenuGrant: optStr, order: optNum, siteCode: optStr })),
  staff: z.array(z.object({ idx: z.number(), id: z.string(), deptIdx: z.number(), dept: optStr, deptLabel: optStr, deptName: optStr, name: optStr, team: optStr, mobile: optStr, phone: optStr, email: optStr, lastLogin: optStr, lastLoginIp: optStr, useYN: optStr, regDate: optStr, commissionRatio: optNum, siteCode: optStr })),
});
export type StaffList = z.infer<typeof StaffListSchema>;

export const EmonSummarySchema = z.object({ rule: z.string(), staleSeconds: z.number(), tables: z.array(z.object({ table: z.string(), label: z.string(), resultTable: optStr, windowDays: optNum, total: optNum, sent: optNum, pending: optNum, pendingStale: optNum, lastRegDate: optStr, error: optStr })), pendingTotal: z.number() });
export type EmonSummary = z.infer<typeof EmonSummarySchema>;
export const EmonPendingSchema = z.object({ table: z.string(), resultTable: optStr, windowDays: optNum, items: z.array(z.record(z.unknown())), page: z.number(), size: z.number(), total: z.number() });
export type EmonPending = z.infer<typeof EmonPendingSchema>;
export const EmonDiagnosisSchema = z.object({
  learner: z.object({ id: z.string(), name: optStr, companyCode: optStr, active: z.boolean(), useYN: optStr, memberOut: optStr, sleep: optStr }), course: z.string(), classPk: optStr,
  studies: z.array(z.object({ studySeq: z.number(), termeIdx: z.number(), classPk: z.string(), serviceType: optStr, period: StudyPeriodSchema, studyEnd: optStr, passOk: optStr, storedProgress: z.number(), certCount: z.number(), progressRows: z.number(), seconds: z.number(), hours: z.number(), computed: z.object({ progressRate: z.number(), passFlag: z.number() }).passthrough() })),
  chosenStudySeq: optNum,
  attend: z.object({ rows: z.array(z.object({ seq: z.number(), changeState: optStr, progressRate: optNum.or(optStr), passFlag: z.number(), attendValidFlag: z.number(), regDate: optStr, sent: z.boolean() })), computedHours: z.number(), scoreSumSeconds: z.number(), expectedPassFlag: z.number() }),
  score: z.object({ total: z.number(), sent: z.number(), pending: z.number(), contents: z.number(), first: optStr, last: optStr, duplicates: z.number() }).nullable(),
  cse: z.object({ total: z.number(), sent: z.number(), pending: z.number(), badContentPk: z.number() }).nullable(),
  courseHist: z.array(z.object({ seq: z.number(), name: optStr, tracseId: optStr, postCourseFlag: optStr.or(optNum), changeState: optStr, regDate: optStr, sent: z.boolean() })),
  classHist: z.array(z.object({ seq: z.number(), start: optStr, end: optStr, tracseTme: optStr.or(optNum), changeState: optStr, regDate: optStr, sent: z.boolean() })),
  contentsHist: z.object({ total: z.number(), sent: z.number(), pending: z.number(), emptyRmtnTcmtSeq: z.number() }),
  terminal: z.object({ total: z.number(), install: z.number(), success: z.number(), last: optStr, byType: z.array(z.object({ type: optStr, count: z.number() })) }),
  identity: z.object({ userHist: z.object({ total: z.number(), sent: z.number(), last: optStr }), loginHist: z.object({ total: z.number(), sent: z.number(), last: optStr }) }),
  mismatches: z.array(z.object({ code: z.string(), message: z.string(), detail: z.unknown().optional() })), verdict: z.string(),
});
export type EmonDiagnosis = z.infer<typeof EmonDiagnosisSchema>;
export const EmonPreviewSchema = z.object({ job: z.string(), requested: z.number(), count: z.number(), dataList: z.array(z.unknown()), skipped: z.array(z.object({ seq: z.number(), reason: z.string() })), note: z.string() });
export type EmonPreview = z.infer<typeof EmonPreviewSchema>;

// ---------------------------------------------------------------------------------------------------------------------
// Design Studio — /design/*
// ---------------------------------------------------------------------------------------------------------------------
export const DesignIssueSchema = z.object({ level: z.enum(['error', 'warning']), path: z.string(), message: z.string(), ratio: z.number().optional() });
export type DesignIssue = z.infer<typeof DesignIssueSchema>;
export const DesignDraftSchema = z.object({ config: DesignConfigSchema, updatedBy: z.string(), updatedAt: z.string(), baseVersion: z.number().int(), issues: z.array(DesignIssueSchema).default([]) });
export type DesignDraft = z.infer<typeof DesignDraftSchema>;
export const ThemePresetSchema = z.object({ id: z.string(), name: z.string(), description: z.string().default(''), theme: ThemeTokensSchema });
export type ThemePresetDto = z.infer<typeof ThemePresetSchema>;
export const DesignVersionFileSchema = DesignVersionMetaSchema.extend({ config: DesignConfigSchema });
export type DesignVersionFile = z.infer<typeof DesignVersionFileSchema>;
export const DesignPublishResultSchema = z.object({ versionNumber: z.number().int(), publishedAt: z.string(), warnings: z.array(DesignIssueSchema).default([]) });
export type DesignPublishResult = z.infer<typeof DesignPublishResultSchema>;
export const PreviewTokenSchema = z.object({ token: z.string(), urls: z.object({ desktop: z.string(), tablet: z.string(), mobile: z.string() }) });
export type PreviewToken = z.infer<typeof PreviewTokenSchema>;
export const DesignAuditLineSchema = z.object({ at: z.string(), actor: z.string(), action: z.string(), meta: z.record(z.unknown()).optional() });
export type DesignAuditLine = z.infer<typeof DesignAuditLineSchema>;
export const MediaPageSchema = pageOf(MediaAssetSchema);
export type MediaPage = z.infer<typeof MediaPageSchema>;
