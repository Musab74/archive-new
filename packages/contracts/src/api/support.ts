import { z } from 'zod';

/** include/include_function.php $Counsel_array — the only Counsel.Category codes the admin console (qna.php) labels. */
export const COUNSEL_CATEGORY_CODES = ['A', 'B', 'C', 'D', 'E'] as const;
/** include/include_function.php $Cheating_array (제보회신 방법). */
export const CHEATING_REPLY_CODES = ['A', 'B', 'C', 'D'] as const;
/** AR-19 기업교육상담 희망 운영유형 (written as a line of Inquiry.Contents; the table has no column for it). */
export const INQUIRY_OPERATING_TYPES = ['undecided', 'refund', 'general', 'both'] as const;

/** archive/main/inquiry_pop.php → include/function.js InsertInquiry(). */
export const PHP_EMAIL_RE = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
const YMD_OR_EMPTY = z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, '날짜 형식(YYYY-MM-DD)을 확인해 주세요.').default('');
/** TEXT columns hold 65,535 bytes; a Korean character takes 3 bytes in utf8. */
const TEXT_MAX = 20_000;

/** One-time 보안코드 (include/make_image.php): the token from GET /support/captcha and the digits the person typed. */
export const CaptchaAnswerSchema = z.object({
  captchaToken: z.string().min(10, '보안코드를 새로고침해 주세요.').max(2000),
  captchaCode: z.string().trim().min(1, '보안코드를 입력하세요.').max(10),
});

/** 기업교육상담 / 수강신청 문의 (archive/main/inquiry_ok.php → Inquiry). Every field the PHP handler requires is required here. */
export const InquiryCreateSchema = CaptchaAnswerSchema.extend({
  companyName: z.string().trim().min(1, '회사명을 입력하세요.').max(100),
  name: z.string().trim().min(1, '이름을 입력하세요.').max(50),
  phone: z.string().trim().min(1, '연락처를 입력하세요.').max(30).regex(/^[0-9][0-9\- ]{6,}[0-9]$/, '연락처는 숫자만 입력하세요.'),
  email: z.string().trim().min(1, '이메일을 입력하세요.').max(100).regex(PHP_EMAIL_RE, '올바른 이메일 주소가 아닙니다.'),
  personnel: z.string().trim().min(1, '예상인원을 입력하세요.').max(50).regex(/^\d+$/, '예상인원은 숫자만 입력하세요.'),
  contents: z.string().trim().min(1, '문의내용을 입력하세요.').max(TEXT_MAX),
  operatingType: z.enum(INQUIRY_OPERATING_TYPES).default('undecided'),
  startDate: YMD_OR_EMPTY,
  endDate: YMD_OR_EMPTY,
  target: z.string().trim().max(200).default(''),
  agree: z.literal(true, { errorMap: () => ({ message: '동의여부를 체크해주세요.' }) }),
  /** Honeypot: hidden in the form, must stay empty. */
  website: z.string().max(0).optional(),
});

/** 1:1 문의 (public/support/ask_ok.php → Counsel). Sent as multipart when a file is attached, so numbers may arrive as strings. */
export const CounselCreateSchema = CaptchaAnswerSchema.extend({
  category: z.enum(COUNSEL_CATEGORY_CODES, { errorMap: () => ({ message: '문의종류를 선택해 주세요.' }) }),
  title: z.string().trim().min(1, '제목을 입력하세요.').max(250),
  contents: z.string().trim().min(1, '내용을 입력하세요.').max(TEXT_MAX),
  /** Optional enrolment the question is about (the caller's Study.Seq); the API fills Counsel.LectureCode from it. */
  studySeq: z.coerce.number().int().positive().optional(),
});

/** 학습상담 「학습내용 질문하기」 from the player (player/study_counsel_ok.php → Counsel with LectureCode + Contents_idx, no 보안코드). */
export const StudyCounselCreateSchema = z.object({
  category: z.enum(COUNSEL_CATEGORY_CODES, { errorMap: () => ({ message: '문의종류를 선택해 주세요.' }) }),
  title: z.string().trim().min(1, '제목을 입력하세요.').max(250),
  contents: z.string().trim().max(TEXT_MAX).default(''),
  lectureCode: z.string().trim().min(1).max(50),
  contentsIdx: z.coerce.number().int().positive(),
});

/** 부정행위 제보 (archive/etc/cheating_ok.php → Cheating). The PHP handler requires every field, the reporter's name/email/phone included. */
export const CheatingReportCreateSchema = CaptchaAnswerSchema.extend({
  title: z.string().trim().min(1, '제목을 입력해주세요.').max(250),
  contents: z.string().trim().min(1, '내용을 입력해주세요.').max(TEXT_MAX),
  reply: z.enum(CHEATING_REPLY_CODES, { errorMap: () => ({ message: '제보회신 방법을 선택해주세요.' }) }),
  name: z.string().trim().min(1, '필수 입력 항목이 누락되었습니다.').max(50),
  email: z.string().trim().min(1, '필수 입력 항목이 누락되었습니다.').max(100),
  phone: z.string().trim().min(1, '필수 입력 항목이 누락되었습니다.').max(30),
  agree: z.literal(true, { errorMap: () => ({ message: '개인정보 수집 및 이용 동의는 필수입니다.' }) }),
  website: z.string().max(0).optional(),
});

/** 아카이빙 · 기업자체콘텐츠 등록 요청 (archive/archiving/archiving_ok.php → Archiving). Multipart with the file. */
export const ArchivingCreateSchema = z.object({
  title: z.string().trim().min(1, '제목과 내용을 입력해주세요.').max(250),
  contents: z.string().trim().min(1, '제목과 내용을 입력해주세요.').max(TEXT_MAX),
});
