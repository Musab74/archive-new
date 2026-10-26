/**
 * Fixture accounts (fixtures/seed.sql + the API tree's base seed test/integration/02-seed.sql). Keep in sync with both and with
 * the table in e2e/README.md. Every learner password is 1111; staff admin01 / sales01 use admin1234.
 */
export const LEARNER_PASSWORD = '1111';
export const STAFF_PASSWORD = 'admin1234';

export const COMPANY = {
  base: { code: '1234567890', name: '테스트기업' },
  A: { code: '2208800001', name: 'E2E 이투이물산' }, // e2emgr01's own company
  B: { code: '2208800002', name: 'E2E 이투이테크' }, // also managed by e2emgr01 (MemberCompany)
  C: { code: '2208800003', name: 'E2E 타사상사' }, // NOT managed by e2emgr01 (his MemberCompany row for C is Del='Y')
} as const;

/** Package every e2e enrollment is on (Course idx 1, ctype A, ServiceType A; children listed below). */
export const PACKAGE = { lectureCode: 'ARC2026', children: ['D00001', 'D00002', 'E2EX01', 'E2EZ01', 'E2EY01', 'E2EH01', 'E2ER01'] } as const;

/** Child contents: chapter seq / contents idx / ContentsDetail seq per chapter order (Chapter.OrderByNum). */
export const COURSES = {
  E2EX01: { idx: 9001, ctype: 'X', title: '[E2E] 데이터 리터러시 실무', minutesPerChapter: 240, chapters: [{ order: 1, chapterSeq: 9201, contentsIdx: 9101, detailSeq: 91011 }, { order: 2, chapterSeq: 9202, contentsIdx: 9102, detailSeq: 91021 }, { order: 3, chapterSeq: 9203, contentsIdx: 9103, detailSeq: 91031 }, { order: 4, chapterSeq: 9204, contentsIdx: 9104, detailSeq: 91041 }] },
  E2EZ01: { idx: 9002, ctype: 'Z', title: '[E2E] 5분 보고서 작성법', minutesPerChapter: 10, chapters: [{ order: 1, chapterSeq: 9211, contentsIdx: 9111, detailSeq: 91111 }, { order: 2, chapterSeq: 9212, contentsIdx: 9112, detailSeq: 91121 }] },
  E2EY01: { idx: 9003, ctype: 'Y', title: '[E2E] 1분 엑셀 단축키', minutesPerChapter: 3, chapters: [{ order: 1, chapterSeq: 9221, contentsIdx: 9121, detailSeq: 91211 }] },
  E2EH01: { idx: 9004, ctype: 'X', title: '[E2E] 패키지형 HTML 차시 체험', minutesPerChapter: 20, chapters: [{ order: 1, chapterSeq: 9231, contentsIdx: 9131, detailSeq: 91311 }] }, // ContentsType A (packaged HTML)
  E2ER01: { idx: 9005, ctype: 'R', title: '[E2E] 라이브 특강: 생성형 AI 업무 활용', minutesPerChapter: 60, chapters: [{ order: 1, chapterSeq: 9241, contentsIdx: 9141, detailSeq: 91411 }] },
  E2EX02: { idx: 9006, ctype: 'X', title: '[E2E] AI 프롬프트 기초 (패키지 미포함)', minutesPerChapter: 30, chapters: [{ order: 1, chapterSeq: 9251, contentsIdx: 9151, detailSeq: 91511 }] }, // not in ARC2026 → NO_ACCESS in the player
  E2EXDEL: { idx: 9007, ctype: 'X', title: '[E2E] 삭제된 과정', minutesPerChapter: 30, chapters: [] }, // Del='Y'
  E2EXOFF: { idx: 9008, ctype: 'X', title: '[E2E] 비노출 과정', minutesPerChapter: 30, chapters: [] }, // UseYN='N'
} as const;

export type Company = keyof typeof COMPANY;
export interface LearnerAccount {
  id: string;
  name: string;
  company: Company;
  /** Study.Seq of the account's ARC2026 enrollment (null = none). */
  studySeq: number | null;
  /** Σ Progress.StudyTime of that enrollment in seconds. */
  studySeconds: number;
  /** POST /v1/auth/login `next` (null = login is refused). */
  next: 'terms' | 'password' | 'assessment-grant' | 'pre-assessment' | 'classroom' | 'home' | null;
  /** Exact Korean message when login is refused. */
  loginError?: string;
  state: string;
}

const L = (id: string, name: string, company: Company, studySeq: number | null, studySeconds: number, next: LearnerAccount['next'], state: string, loginError?: string): LearnerAccount => ({ id, name, company, studySeq, studySeconds, next, state, ...(loginError ? { loginError } : {}) });

export const ACCOUNTS = {
  // ---- base seed (API tree test/integration/02-seed.sql), company 1234567890 테스트기업
  test01: L('test01', '테스트원', 'base', 1, 0, 'classroom', 'TestID=Y, 사전 done for Study 1'),
  user01: L('user01', '학습자일', 'base', 2, 0, 'pre-assessment', 'active Study 2, 사전 not done'),
  mgr01: L('mgr01', '담당자', 'base', null, 0, 'home', 'EduManager=Y for 1234567890'),
  sleep01: L('sleep01', '휴면', 'base', null, 0, null, 'Sleep=Y', '현재 휴면계정 상태입니다. [휴면계정 복구] 메뉴를 통해 계정을 복구하세요.'),
  // ---- e2e fixtures, company A unless noted
  e2emgr01: L('e2emgr01', '강담당', 'A', null, 0, 'home', 'EduManager=Y; manages A + B, not C'),
  e2eterms01: L('e2eterms01', '문약관', 'A', null, 0, 'terms', 'Mandatory=N'),
  e2epw01: L('e2epw01', '장비번', 'A', null, 0, 'password', 'PassChange=N'),
  e2eout01: L('e2eout01', '서탈퇴', 'A', null, 0, null, 'MemberOut=Y', '탈퇴한 회원입니다.'),
  e2enouse01: L('e2enouse01', '노사용', 'A', null, 0, null, 'UseYN=N', '아이디 또는 비밀번호를 잘못 입력했습니다.'),
  e2esleep01: L('e2esleep01', '휴면이', 'A', null, 0, null, 'Sleep=Y', '현재 휴면계정 상태입니다. [휴면계정 복구] 메뉴를 통해 계정을 복구하세요.'),
  e2elearn01: L('e2elearn01', '김학습', 'A', 9401, 53_940, 'home', '환급(A) active, 14h59m, 사후 not done, PassOK N'),
  e2elearn15: L('e2elearn15', '오십오', 'A', 9402, 54_000, 'home', '환급(A) active, exactly 15h, 사후 not done (open), PassOK N'),
  e2epass01: L('e2epass01', '이수료', 'A', 9403, 54_000, 'home', 'finished 30 days ago, StudyEnd Y, PassOK Y → 수료증 printable'),
  e2epass02: L('e2epass02', '이대기', 'A', 9404, 54_000, 'home', 'active (ends in 3 days), PassOK Y → 수료증 대기 until LectureEnd+7'),
  e2eexp01: L('e2eexp01', '박만료', 'A', 9405, 18_000, 'home', 'expired 20 days ago (StudyEnd N), 5h'),
  e2esoon01: L('e2esoon01', '최예정', 'A', 9406, 0, 'home', 'enrollment starts in 5 days'),
  e2ewfree01: L('e2ewfree01', '정비환급', 'A', 9407, 11_400, 'home', '비환급(W) active, 3h10m'),
  e2epre01: L('e2epre01', '한사전', 'A', 9408, 0, 'pre-assessment', '환급 active, 사전 not done'),
  e2etest02: L('e2etest02', '테스트이', 'A', 9409, 0, 'classroom', 'TestID=Y (no 본인인증, no 8 h gate)'),
  e2egrant01: L('e2egrant01', '권진단', 'A', 9410, 36_000, 'assessment-grant', '10h, active admin grant POST'),
  e2enocert01: L('e2enocert01', '신입과', 'A', 9411, 0, 'home', 'no UserCertOTP → 과정입과 시 본인인증이 필요합니다.'),
  e2eauth01: L('e2eauth01', '윤인증', 'A', 9412, 1_800, 'home', '입과 cert only → 학습 진행 시 본인인증이 필요합니다.'),
  e2ebco01: L('e2ebco01', '배학습', 'B', 9413, 7_200, 'home', 'company B, active 2h'),
  e2ebco02: L('e2ebco02', '배수료', 'B', 9414, 54_000, 'home', 'company B, finished PassOK Y'),
  e2ecco01: L('e2ecco01', '차타사', 'C', 9415, 3_600, 'home', 'company C (not visible to e2emgr01), active 1h'),
  e2ecco02: L('e2ecco02', '차만료', 'C', 9416, 5_400, 'home', 'company C, expired'),
} satisfies Record<string, LearnerAccount>;

export type AccountId = keyof typeof ACCOUNTS;

export const STAFF = {
  admin01: { id: 'admin01', password: STAFF_PASSWORD, name: '관리자', note: 'Dept A, all grants, 2FA exempt (ADMIN_2FA_EXEMPT_IDS)' },
  sales01: { id: 'sales01', password: STAFF_PASSWORD, name: '영업', note: 'Dept B, grants A,B; 2FA = last 4 digits of 01088880000' },
} as const;
