// AUTO-GENERATED from old-schema.md by scripts/gen-db-types.cjs — do not edit by hand.
// Column names are the live hrdeArchive names (PascalCase). datetime/date columns are strings (mysql2 dateStrings).

export interface AbnormalDataLogRow {
  idx: number;
  detect_date: string;
  detected_at: string;
  category: string;
  issue_code: string;
  severity: string;
  clarification_key: string | null;
  ID: string;
  Study_Seq: number;
  LectureCode: string | null;
  Chapter_Seq: number;
  Contents_idx: number;
  metric_json: string | null;
  sample_detail: string | null;
  status: string;
  status_note: string | null;
  status_by: string | null;
  status_at: string | null;
  source: string;
}

export interface ArchiveAbilityResult1Row {
  idx: number; /** 자동증가값 */
  ID: string; /** 아이디 */
  abilityType: string | null; /** 진단 타입 (사전 : B / 사후 : A) */
  abilityDepth: string | null;
  col1: string | null;
  col2: string | null;
  col3: string | null;
  col4: string | null;
  regDate: string; /** 생성날짜 */
  modDate: string | null;
}

export interface ArchiveAbilityResult2Row {
  idx: number; /** 자동증가값 */
  ID: string; /** 아이디 */
  question_idx: number | null; /** 진단 데이터 */
  aValue: string | null;
  regDate: string; /** 생성날짜 */
  modDate: string | null;
  col1: string | null; /** 실무/관리자 (컬럼명 임시) */
}

export interface ArchiveQuestionRow {
  idx: number; /** 자동증가값 */
  aType: string | null; /** 진단 타입 (사전 : B / 사후 : A) */
  aDepth: string | null; /** 단계 (1단계 : step01 ... 3단계 : step03) */
  aGroup: string | null; /** A:일반, W:실무자, M:관리자 */
  aOrder: number | null; /** 정렬순서 */
  aBind: string | null; /** 사전진단 중 공통질문 항목을 묶음으로 처리 */
  aValue: string | null; /** 문항 */
  aValueDetail: string | null; /** 문항 상세내용 */
  regDate: string; /** 생성날짜 */
  modDate: string | null;
  Del: string | null;
}

export interface ArchivingRow {
  idx: number; /** 자동증가값 */
  ID: string | null; /** 아이디 */
  Title: string | null; /** 제목 */
  Contents: string | null; /** 내용 */
  RegDate: string | null; /** 등록일 */
  Name2: string | null; /** 답변자 이름 */
  Contents2: string | null; /** 답변 내용 */
  RegDate2: string | null; /** 답변 등록일 */
  FileName1: string | null; /** 첨부파일1 */
  RealFileName1: string | null; /** 첨부파일1 실제파일명 */
  Status: string | null; /** 처리상태 */
  Del: string | null; /** 삭제여부 */
}

export interface AssessmentAccessGrantRow {
  idx: number;
  AdminID: string; /** Shared admin login (e.g. admin05) */
  OperatorName: string;
  OperatorPhoneEnc: string | null; /** Legacy AES-encrypted mobile; unused after phone verification removal */
  OperatorPhoneMask: string; /** Legacy masked mobile; unused after phone verification removal */
  LearnerID: string;
  Study_Seq: number;
  AssessmentType: string;
  SessionLabel: string;
  Reason: string;
  RequestIP: string;
  GrantedAt: string;
  ExpiresAt: string;
  ConsumedAt: string | null;
  Status: string; /** ACTIVE/CONSUMED/EXPIRED/SUPERSEDED */
}

export interface AssessmentAccessGrantOtpRow {
  idx: number;
  ChallengeID: string;
  AdminID: string;
  OperatorName: string;
  OperatorPhoneMask: string;
  OperatorPhoneHash: string;
  OtpHash: string;
  LearnerID: string;
  Study_Seq: number;
  AssessmentType: string;
  Reason: string;
  FailureCount: number;
  VerifiedAt: string | null;
  ExpiresAt: string;
  RequestIP: string;
  CreatedAt: string;
}

export interface ChapterRow {
  Seq: number; /** 고유 증가값 */
  LectureCode: string; /** 과정 코드 */
  ChapterType: string; /** 차시 구분 */
  Sub_idx: string | null; /** 강의 또는 문제 idx값 */
  OrderByNum: number; /** 정렬순서 */
  RegDate: string | null; /** 등록일 */
}

export interface ChapterExcelTempRow {
  idx: number; /** 고유 증가값 */
  LectureCode: string; /** 과정 코드 */
  ChapterType: string; /** 차시 구분 */
  Sub_idx: string | null; /** 강의 또는 문제 idx값 */
  OrderByNum: number; /** 정렬순서 */
  ID: string | null; /** 등록자 아이디 */
}

export interface CheatingRow {
  idx: number; /** 자동증가값 */
  Name: string | null; /** 이름 */
  Category: string | null; /** 제보회신 (전화 / 이메일 /방문 /기타) */
  Mobile: string | null; /** 연락처 */
  Email: string | null; /** 이메일 */
  Title: string | null; /** 제목 */
  Contents: string | null; /** 내용 */
  RegDate: string | null; /** 등록일 */
  Status: string | null; /** 상태 */
  Del: string | null; /** 삭제여부 */
  Name2: string | null; /** 답변자 */
  RegDate2: string | null; /** 답변 등록일 */
}

export interface CompanyRow {
  idx: number; /** 고유증가값 */
  CompanyScale: string | null; /** 회사규모 */
  CompanyCode: string; /** 사업자번호 */
  CompanyName: string; /** 회사명 */
  CompanyID: string | null; /** 회사아이디 */
  HRD: string | null; /** HRD번호 */
  Ceo: string | null; /** 대표자명 */
  Uptae: string | null; /** 업태 */
  Upjong: string | null; /** 업종 */
  Zipcode: string | null; /** 우편번호 */
  Address01: string | null; /** 주소 */
  Address02: string | null; /** 상세주소 */
  Tel: string | null; /** 대표 연락처 */
  Tel2: string | null; /** 고객센터 연락처 */
  Fax: string | null; /** 대표 FAX */
  Fax2: string | null; /** 고객센터 FAX */
  Email: string | null; /** 이메일 */
  BankName: string | null; /** 은행명 */
  BankNumber: string | null; /** 계좌번호 */
  CSEnabled: string | null; /** 고객센터 번호 사용여부 */
  CyberEnabled: string | null; /** 사이버교육센터 사용여부 */
  HomePage: string | null; /** 홈페이지 */
  CyberURL: string | null; /** 사이버교육센터 주소 */
  EduManager: string | null; /** 교육담당자 이름 */
  EduManagerPhone: string | null; /** 교육담당자 연락처 */
  EduManagerEmail: string | null; /** 교육담당자 이메일 */
  SalesManager: string; /** 영업담당자 아이디 */
  RegDate: string | null; /** 등록일 */
  Remark: string | null; /** 메모 */
  Del: string | null; /** 삭제여부 */
  SendSMS: string; /** 문자,메일 수신여부 */
}

export interface CompanyDeleteLogRow {
  idx: number; /** 고유증가값 */
  CompanyScale: string | null; /** 회사규모 */
  CompanyCode: string; /** 사업자번호 */
  CompanyName: string; /** 회사명 */
  CompanyID: string | null; /** 회사아이디 */
  HRD: string | null; /** HRD번호 */
  Ceo: string | null; /** 대표자명 */
  Uptae: string | null; /** 업태 */
  Upjong: string | null; /** 업종 */
  Zipcode: string | null; /** 우편번호 */
  Address01: string | null; /** 주소 */
  Address02: string | null; /** 상세주소 */
  Tel: string | null; /** 대표 연락처 */
  Tel2: string | null; /** 고객센터 연락처 */
  Fax: string | null; /** 대표 FAX */
  Fax2: string | null; /** 고객센터 FAX */
  Email: string | null; /** 이메일 */
  BankName: string | null; /** 은행명 */
  BankNumber: string | null; /** 계좌번호 */
  CSEnabled: string | null; /** 고객센터 번호 사용여부 */
  CyberEnabled: string | null; /** 사이버교육센터 사용여부 */
  HomePage: string | null; /** 홈페이지 */
  CyberURL: string | null; /** 사이버교육센터 주소 */
  EduManager: string | null; /** 교육담당자 이름 */
  EduManagerPhone: string | null; /** 교육담당자 연락처 */
  EduManagerEmail: string | null; /** 교육담당자 이메일 */
  SalesManager: string; /** 영업담당자 아이디 */
  RegDate: string | null; /** 등록일 */
  Remark: string | null; /** 메모 */
  Del: string | null; /** 삭제여부 */
  SendSMS: string; /** 문자,메일 수신여부 */
  DelDate: string | null; /** 삭제날짜 */
  DelAdminID: string | null; /** 삭제 관리자아이디 */
}

export interface CompanyExcelTempRow {
  idx: number; /** 고유 증가값 */
  ID: string | null; /** 등록자 아이디 */
  CompanyName: string | null; /** 회사명 */
  CompanyID: string | null; /** 회사 아이디 */
  CompanyScale: string | null; /** 회사 규모 */
  CompanyCode: string | null; /** 사업자번호 */
  HRD: string | null; /** HRD코드 */
  Ceo: string | null; /** 대표자 */
  Zipcode: string | null; /** 우편번호 */
  Address01: string | null; /** 주소 */
  Address02: string | null; /** 상세 주소 */
  Uptae: string | null; /** 업태 */
  Upjong: string | null; /** 업종 */
  Tel: string | null; /** 회사 전화번호 */
  Email: string | null; /** 이메일 */
  EduManager: string | null; /** 교육담당자 */
  EduManagerPhone: string | null; /** 교육담당자 연락처 */
  EduManagerEmail: string | null; /** 교육담당자 이메일 */
  SalesManager: string | null; /** 영업담당자 ID */
  Remark: string | null; /** 메모 */
  CyberEnabled: string | null; /** 사이버 교육센터 사용여부 */
  Tel2: string | null; /** 고객센터 번호 */
  Fax2: string | null; /** 고객센터 팩스번호 */
  CSEnabled: string | null; /** 고객센터 번호 사용 여부 */
  HomePage: string | null; /** 홈페이지/기업관리코드 */
  RegDate: string | null; /** 등록일 */
}

export interface ContentsRow {
  idx: number; /** 고유 증가값 */
  Gubun: string; /** 차시 구분 */
  ContentsTitle: string; /** 차시명 */
  LectureTime: number | null; /** 강의 시간 */
  Expl01: string | null; /** 차시목표 */
  Expl02: string | null; /** 훈련내용 */
  Expl03: string | null; /** 학습활동 */
  RegDate: string | null; /** 등록일 */
  Del: string; /** 삭제여부 */
  WidthPx: number | null; /** 콘텐츠 가로 사이즈 */
  HeightPx: number | null; /** 콘텐츠 세로 사이즈 */
}

export interface ContentsDetailRow {
  Seq: number; /** 고유증가값 */
  Contents_idx: number | null; /** 컨텐츠 idx */
  ContentsType: string; /** 컨텐츠 유형 */
  ContentsPage: string | null; /** 차시 페이지수 */
  ContentsMobilePage: string | null; /** 모바일 페이지수 */
  ContentsURLSelect: string | null; /** 컨텐츠 URL 주경로, 예비경로 선택 여부 A:주, B:예비 */
  ContentsURL: string | null; /** 컨텐츠 URL(주경로) */
  ContentsURL2: string | null; /** 컨텐츠 URL(예비경로) */
  MobileURL: string | null; /** 모바일 URL */
  MobileURL2: string | null; /** 모바일 URL (예비경로) */
  Question: string | null; /** 문제풀이 질문 */
  Example01: string | null; /** 예문1 */
  Example02: string | null; /** 예문2 */
  Example03: string | null; /** 예문3 */
  Example04: string | null; /** 예문4 */
  Example05: string | null; /** 예문5 */
  Answer: string | null; /** 정답 */
  Comment: string | null; /** 해답 설명 */
  Teacher: number | null; /** 강사 선택 */
  UseYN: string | null; /** 사용 유무 */
  OrderByNum: number; /** 정렬번호 */
  Caption: string | null; /** 자막파일 */
}

export interface ContentsExcelTempRow {
  idx: number; /** 고유 증가값 */
  Gubun: string; /** 차시 구분 */
  ContentsTitle: string; /** 차시명 */
  LectureTime: number; /** 수강시간 */
  Expl01: string | null; /** 차시목표 */
  Expl02: string | null; /** 훈련내용 */
  Expl03: string | null; /** 학습활동 */
  ContentsType: string; /** 컨텐츠 유형 */
  ContentsPage: string | null; /** 차시 페이지수 */
  ContentsMobilePage: string | null; /** 모바일 페이지수 */
  ContentsURL: string | null; /** 컨텐츠 URL */
  MobileURL: string | null; /** 모바일 URL */
  RegDate: string | null; /** 등록일 */
  ID: string; /** 등록 아이디 */
  WidthPx: number | null; /** 콘텐츠 가로 사이즈 */
  HeightPx: number | null; /** 콘텐츠 세로 사이즈 */
}

export interface ContentsKeywordRow {
  idx: number; /** 고유증가값 */
  Category: string; /** 과정분류 */
  Keyword: string; /** 키워드 */
  Del: string; /** 삭제여부 */
  RegDate: string | null; /** 등록일자 */
  RegID: string | null; /** 등록자ID */
  MdfDate: string | null; /** 수정일 */
  MdfID: string | null; /** 수정자ID */
  UseYN: string | null; /** 사용여부 */
  OrderByNum: number | null; /** 정렬순서 */
  jobCate: string | null; /** 공통/직무/리더십 카테 별도로 둠 */
}

export interface ContentsListRow {
  idx: number; /** 자동증가값 */
  gubun: string | null; /** 1:PICK/2:TOP10/3:NEW/4:HRDe */
  LectureCode: string; /** 과정 코드 */
  OrderByNum: number; /** 정렬순서 */
  RegDate: string | null; /** 등록일 */
  RegID: string | null; /** 등록자ID */
  UseYN: string; /** 사용여부 */
  Del: string; /** 삭제여부 */
}

export interface CounselRow {
  idx: number; /** 자동증가값 */
  ID: string | null; /** 아이디 */
  Name: string | null; /** 이름 */
  Category: string | null; /** 문의종류 */
  Mobile: string | null; /** 연락처 */
  Email: string | null; /** 이메일 */
  Title: string | null; /** 제목 */
  Contents: string | null; /** 내용 */
  RegDate: string | null; /** 등록일 */
  Name2: string | null; /** 답변 이름 */
  Contents2: string | null; /** 답변 내용 */
  RegDate2: string | null; /** 답변 등록일 */
  FileName1: string | null; /** 첨부파일1 */
  RealFileName1: string | null; /** 첨부파일1 실제파일명 */
  FileName2: string | null; /** 첨부파일2 */
  RealFileName2: string | null; /** 첨부파일2 실제파일명 */
  FileName3: string | null; /** 첨부파일3 */
  RealFileName3: string | null; /** 첨부파일3 실제파일명 */
  FileName4: string | null; /** 첨부파일4 */
  RealFileName4: string | null; /** 첨부파일4 실제파일명 */
  FileName5: string | null; /** 첨부파일5 */
  RealFileName5: string | null; /** 첨부파일5 실제파일명 */
  Status: string | null; /** 상태 */
  Del: string | null; /** 삭제여부 */
  ViewCount: number | null; /** 조회수 */
  LectureCode: string | null; /** 강의코 */
  Study_Seq: number | null; /** 수강seq */
  Contents_idx: number | null; /** 컨텐츠idx */
  FileName4Student: string | null; /** 문의한 수강생이 첨부한 파일 */
  RealFileName4Student: string | null; /** 문의한 수강생이 첨부한 실제파일명 */
}

export interface CounselPhoneRow {
  idx: number; /** 자동증가값 */
  ID: string | null; /** 아이디 */
  Name: string | null; /** 이름 */
  Category: string | null; /** 문의종류 */
  Contents: string | null; /** 내용 */
  RegDate: string | null; /** 등록일 */
  Status: string | null; /** 상태 */
  Del: string | null; /** 삭제여부 */
}

export interface CourseRow {
  idx: number; /** 고유 증가값 */
  ctype: string; /** 구분 X:이러닝/Y:마이크로닝/Z:숏폼/W:비환급/A:패키지 */
  LectureCode: string; /** 강의 코드 */
  ClassGrade: string; /** 등급 */
  UseYN: string; /** 사이트 노출 */
  HrdCode: string | null; /** HRD-NET 과정코드 */
  Category1: string | null; /** 과정분류 대분류 */
  Category2: string | null; /** 과정분류 중분류 */
  Keyword1: string | null; /** 난이도(직급) */
  Keyword2: string | null; /** 직무분야 */
  Keyword3: string | null; /** 관심분야 */
  Keyword4: string | null; /** 역량 */
  ServiceType: string | null; /** 서비스구분(X:이러닝/Y:숏폼/Z:마이크로닝/W;비환급/A:패키지) */
  ContentsName: string | null; /** 과정명 */
  ContentsTime: string | null; /** 교육시간 */
  Mobile: string; /** 모바일 지원 */
  BookPrice: number; /** 교재비 */
  attachFile: string | null; /** 학습자료 */
  PreviewImage: string | null; /** 과정 이미지 */
  BookImage: string | null; /** 교재 이미지 */
  Intro: string | null; /** 과정소개 */
  EduTarget: string | null; /** 교육대상 */
  EduGoal: string | null; /** 교육목표 */
  Del: string | null; /** 삭제여부 */
  RegDate: string | null; /** 등록일 */
  ContentsURLSelect: string | null; /** A:컨텐츠 URL 주경로/B:예비경로 */
  ContentsURL: string; /** 컨텐츠 URL */
  MobileURL: string; /** 모바일 URL */
  Chapter: string; /** 차시수 */
  ContentsStart: string; /** 컨텐츠 제작연도기간 (컨텐츠 시작일) */
  ContentsEnd: string; /** 컨텐츠 제작연도기간 (컨텐츠 만료일) */
  UploadDate: string; /** 컨텐츠 업로드일 */
  PackageYN: string | null; /** 패키지 강의 여부 */
  PackageRef: number | null; /** 패키지 고유번호 */
  PackageLectureCode: string | null; /** 패키지 포함 강의코드 */
  cnt: number | null; /** 조회수 */
  HrdSeq: string | null; /** 원격훈련일련번호 */
  Professor: string | null; /** 교강사 */
  Price: number; /** 교육비용 일반 */
  Price01View: number; /** 교육비용 우선지원 */
  Price02View: number; /** 교육비용 대규모 1000인 미만 */
  Price03View: number; /** 교육비용 대규모 1000인 이상 */
  PassTime: number; /** 수료기준 시간 */
  LegalEduReq: string | null; /** 법정교육여부 */
}

export interface CourseCategoryRow {
  idx: number; /** 고유 증가값 */
  ParentCategory: number; /** 상위 고유값 */
  Deep: number; /** 단계 */
  CategoryName: string; /** 카테고리명 */
  OrderByNum: number | null; /** 정렬번호 */
  UseYN: string; /** 사용여부 */
  Del: string; /** 삭제여부 */
}

export interface CourseExcelTempRow {
  idx: number; /** 고유 증가값 */
  Ctype: string; /** 구분 X:이러닝/Y:마이크로닝/Z:숏폼 */
  LectureCode: string; /** 강의 코드 */
  ClassGrade: string; /** 등급 */
  UseYN: string; /** 사이트 노출 */
  PackageLectureCode: string | null; /** 패키지 포함 강의코드 */
  HrdCode: string | null; /** HRD-NET 과정코드 */
  Category1: string | null; /** 과정분류 대분류 */
  Category2: string | null; /** 과정분류 중분류 */
  Keyword1: string | null; /** 난이도(직급) */
  Keyword2: string | null; /** 직무분야 */
  Keyword3: string | null; /** 관심분야 */
  Keyword4: string | null; /** 역량 */
  ServiceType: string | null; /** 서비스구분(X:이러닝/Y:마이크로닝/Z:숏폼) */
  ContentsName: string | null; /** 과정명 */
  ContentsTime: string | null; /** 교육시간 */
  Mobile: string; /** 모바일 지원 */
  BookPrice: number; /** 교재비 */
  PreviewImage: string | null; /** 과정 이미지 */
  Intro: string | null; /** 과정소개 */
  EduTarget: string | null; /** 교육대상 */
  EduGoal: string | null; /** 교육목표 */
  ContentsURLSelect: string | null; /** A:컨텐츠 URL 주경로/B:예비경로 */
  Chapter: string; /** 차시수 */
  ContentsStart: string; /** 컨텐츠 유효기간 (컨텐츠 시작일) */
  ContentsEnd: string; /** 컨텐츠 유효기간 (컨텐츠 만료일) */
  UploadDate: string; /** 컨텐츠 업로드일 */
  ID: string | null; /** 등록자 아이디 */
  Professor: string | null; /** 교강사 */
  Price: number; /** 교육비용 일반 */
  Price01View: number; /** 교육비용 우선지원 */
  Price02View: number; /** 교육비용 대규모 1000인 미만 */
  Price03View: number; /** 교육비용 대규모 1000인 이상 */
  PassTime: number; /** 수료기준 시간 */
  HrdSeq: string | null; /** 원격훈련일련번호 */
}

export interface CourseLikeRow {
  idx: number; /** 고유 증가값 */
  LectureCode: string; /** 강의코드 */
  ID: string; /** ID */
  RegDate: string | null; /** 등록일자 */
}

export interface DeptStructureRow {
  idx: number; /** 고유증가값 */
  Dept: string; /** 부서구분 A:관리자,B:영업,C:첨삭강사 */
  ParentCategory: number | null; /** 상위 고유값 */
  Deep: number; /** 그룹 */
  DeptName: string | null; /** 부서명 */
  DeptString: string | null; /** 상위idx값 배열 */
  TopMenuGrant: string | null; /** 상위 메뉴 권한 */
  SubMenuGrant: string | null; /** 서브 메뉴 권한 */
  OrderByNum: number | null; /** 정렬순서 */
  SiteCode: string | null; /** 사이트 구분 */
}

export interface EmailSendLogRow {
  idx: number; /** 고유증가값 */
  ID: string | null; /** 아이디 */
  Study_Seq: number | null; /** 강의 Seq */
  MassageTitle: string | null; /** 발송한 메세지 제목 */
  Massage: string | null; /** 발송한 메세지 */
  Code: string | null; /** 발송 상태 코드 */
  Email: string | null; /** 이메일 주소 */
  InputID: string | null; /** 발송자 아이디 */
  RegDate: string | null; /** 발송일 */
  ReciveDate: string | null; /** 수신일 */
}

export interface EmailSendLogForEduManagerRow {
  idx: number; /** 고유증가값 */
  CompanyCode: string | null; /** 기업_사업자등록번호 */
  MassageTitle: string | null; /** 발송한 메세지 제목 */
  Massage: string | null; /** 발송한 메세지 */
  Code: string | null; /** 발송 상태 코드 */
  Email: string | null; /** 이메일 주소 */
  InputID: string | null; /** 발송자 아이디 */
  RegDate: string | null; /** 발송일 */
  ReciveDate: string | null; /** 수신일 */
}

export interface FaqRow {
  idx: number; /** 고유증가값 */
  OrderByNum: number; /** 게시물 게시 순서 */
  Category: string; /** 분류 */
  Title: string; /** 제목 */
  Content: string | null; /** 내용 */
  Del: string | null; /** 삭제여부 */
  RegDate: string | null; /** 등록일 */
  UseYN: string | null; /** 사용유무 */
}

export interface InformationProtectionLogRow {
  idx: number; /** 자동증가값 */
  TB: string | null; /** 테이블명 */
  Field: string | null; /** 조회 항목 */
  ID: string | null; /** 아이디 */
  url: string | null; /** 조회 주소 */
  AdminID: string | null; /** 관리자 아이디 */
  Gubun: string | null; /** 구분 */
  Content: string | null; /** 사유 */
  RegDate: string | null; /** 등록일 */
}

export interface InquiryRow {
  idx: number; /** 고유 증가값 */
  ServiceType: string; /** 문의종류(1:HRDe아카이브) */
  CompanyName: string; /** 회사명 */
  Name: string; /** 문의자 이름 */
  Phone: string; /** 문의자 폰번호 */
  Email: string; /** 문의자 이메일 */
  Personnel: string; /** 인원 */
  Contents: string | null; /** 문의 내용 */
  AgreeYN: string; /** 동의여부 */
  RegDate: string | null; /** 문의일 */
  Del: string | null; /** 데이터 삭제 여부 */
  Status: string; /** 상태(A:대기/B:완료) */
  Name2: string | null; /** 답변 이름 */
  Contents2: string | null; /** 답변 내용 */
  RegDate2: string | null; /** 답변 등록일 */
  MdfDate2: string | null; /** 답변수정일시 */
}

export interface KobeTriggerLogRow {
  id: number;
  session_id: string | null;
  user_id: string | null;
  user_role: string | null;
  module_id: number;
  trigger_reason: string;
  page: string | null;
  event_name: string | null;
  fallback_reason: string | null;
  latency_ms: number;
  created_at: string | null;
}

export interface LectureEventRow {
  idx: number; /** 자동증가값 */
  ID: string; /** 아이디 */
  Stage: number | null; /** 스테이지(10,20,30,40) */
  StageCount: number | null; /** 스테이지 카운트 */
  Status: string | null; /** 상태(A:대기/B:완료) */
  RegDate: string | null; /** 등록일자 */
  StatusRegDate: string | null; /** 상태 등록일자 */
  StatusName: string | null; /** 상태 작성자 */
}

export interface LectureRequestRow {
  idx: number; /** 고유값 */
  ID: string; /** 아이디 */
  LectureCode: string; /** 강의 코드 */
  LectureStart: string | null; /** 강의 시작 요청일 */
  LectureEnd: string | null; /** 강의 종료일 */
  Price: number; /** 수강료 */
  Status: string; /** 상태 A:승인대기,B:결제승인,C:결제취소 */
  Payment: string | null; /** 결제방법 A:카드, B:무통장,C:가상계좌 */
  Del: string; /** 삭제여부 */
  RegDate: string | null; /** 등록일 */
}

export interface LectureTermeRow {
  idx: number; /** 고유 증가값 */
  LectureCode: string; /** 강의 코드 */
  LectureStart: string | null; /** 과정 시작일 */
  LectureEnd: string | null; /** 과정 종료일 */
  ServiceType: string | null; /** 서비스 구분 */
  OpenYear: number | null; /** 회차, 개설년도 */
  OpenTerme: number | null; /** 회차, 차수 */
  OpenChapter: number | null; /** 실시회차 */
}

export interface LoginHistoryRow {
  idx: number; /** 자동증가값 */
  ID: string | null; /** 아이디 */
  Device: string | null; /** 로그인 유형 */
  IP: string | null; /** IP */
  UserAgent: string | null; /** 웹사이트 정보 */
  RegDate: string | null; /** 등록일 */
}

export interface LoginIngRow {
  idx: number; /** 고유증가값 */
  ID: string; /** 아이디 */
  SessionID: string; /** 세션값 */
  IP: string; /** 접속 아이피 */
  RegDate: string; /** 로그인 시간 */
}

export interface MemberRow {
  idx: number; /** 자동증가값 */
  MemberType: string; /** A:사업주훈련회원, B:근로자 내일배움카드회원 */
  ID: string; /** 아이디 */
  Pwd: string; /** 비밀번호 */
  Name: string; /** 이름 */
  BirthDay: string | null; /** 생년월일 */
  Gender: string | null; /** 성별 */
  Email: string | null; /** 이메일 */
  Tel: string | null; /** 전화번호 */
  Mobile: string | null; /** 휴대폰 */
  Zipcode: string | null; /** 우편번호 */
  Address01: string | null; /** 주소 */
  Address02: string | null; /** 상세주소 */
  NameEng: string | null; /** 영문 이름 */
  CompanyCode: string; /** 소속기관 사업자번호 */
  Depart: string | null; /** 부서 */
  Position: string | null; /** 직위 */
  Etc01: string | null; /** 관심분야 */
  Etc02: string | null; /** 가입경로 */
  Mailling: string | null; /** 수신동의 여부 */
  ACS: string | null; /** ACS */
  Mandatory: string; /** 필수동의 여부 */
  MandatoryDate: string | null; /** 필수항목 동의 상태 변화일 */
  Sending: string; /** 수신 동의 항목 동의 여부 */
  SendingDate: string | null; /** 수신 동의 상태 변화일 */
  Marketing: string | null; /** 마케팅 동의 항목 동의 여부 비동의 - N 이메일 동의 - E / SMS동의 - S 둘 다 동의- Y */
  MarketingDate: string | null; /** 마케팅 동의 상태 변화일 */
  LastLogin: string | null; /** 마지막 로그인 날짜 */
  LastLoginIP: string | null; /** 마지막 로그인 IP */
  MemberOut: string | null; /** 회원탈퇴여부 */
  MemberOutDate: string | null; /** 탈퇴일 */
  Sleep: string | null; /** 휴면계정여부 */
  SleepDate: string | null; /** 휴면계정처리일 */
  UseYN: string | null; /** 계정 사용유무 */
  RegDate: string; /** 가입일 */
  EditDate: string | null; /** 최종 수정일 */
  EduManager: string | null; /** 교육담당자 여부 */
  ResNo: string; /** 주민번호 */
  nwIno: string | null; /** 비용수급사업장 */
  trneeSe: string | null; /** 훈련생구분 */
  IrglbrSe: string | null; /** 비정규직구분 */
  TestLectureCode: string | null; /** 테스트용 강의 코드 */
  TestID: string; /** 테스트용 아이디 여부 */
  ProtectID: string; /** 대리수강 방지 */
  MacVar: string | null; /** 어플에서 전달된 고유값 */
  MemberRemark: string | null; /** 사용자 메모 */
  PassChange: string; /** 비번 변경여부 */
  CardName: string | null; /** 내일배움카드명 */
  CardNumber: string | null; /** 내일배움카드 번호 */
  MailingDate: string | null; /** 수신동의날짜 */
  RecomID: string | null; /** 추천인아이디 */
  AbilityYN: string | null; /** 사전역량진단 완료:Y, 미완료:N */
  AbilityDate: string | null; /** 사전진단step03 완료 시간 */
  SatisfactionYN: string | null; /** 만족도조사 step02 완료:Y, 미완료:N */
  SatisfactionDate: string | null; /** 만족도조사 step02 완료 시간 */
  AbilityAfterYN: string | null; /** 사후진단 완료:Y, 미완료:N */
  AbilityAfterDate: string | null; /** 사후진단 step03 완료 시간 */
  MemberInDate: string | null; /** 탈퇴복구일 */
  MemberInAdminID: string | null; /** 탈퇴복구 관리자아이디 */
}

export interface MemberCompanyRow {
  idx: number;
  ID: string | null;
  CompanyCode: string | null;
  Del: string | null;
  RegDate: string | null;
}

export interface MemberContentsRow {
  idx: number; /** 자동증가값 */
  ID: string; /** 아이디 */
  Keyword1: string | null; /** 난이도(직급) */
  Keyword2: string | null; /** 직무분야 */
  Keyword3: string | null; /** 관심분야 */
  Keyword4: string | null; /** 역량 */
}

export interface MemberDeletionLogRow {
  idx: number;
  MemberType: string; /** A:사업주훈련회원, B:근로자 내일배움카드회원 */
  ID: string; /** 아이디 */
  Pwd: string; /** 비밀번호 */
  Name: string; /** 이름 */
  BirthDay: string | null; /** 생년월일 */
  Gender: string | null; /** 성별 */
  Email: string | null; /** 이메일 */
  Tel: string | null; /** 전화번호 */
  Mobile: string | null; /** 휴대폰 */
  Zipcode: string | null; /** 우편번호 */
  Address01: string | null; /** 주소 */
  Address02: string | null; /** 상세주소 */
  NameEng: string | null; /** 영문 이름 */
  CompanyCode: string; /** 소속기관 사업자번호 */
  Depart: string | null; /** 부서 */
  Position: string | null; /** 직위 */
  Etc01: string | null; /** 관심분야 */
  Etc02: string | null; /** 가입경로 */
  Mailling: string | null; /** 수신동의 여부 */
  ACS: string | null; /** ACS */
  Mandatory: string; /** 필수동의 여부 */
  MandatoryDate: string | null; /** 필수항목 동의 상태 변화일 */
  Sending: string; /** 수신 동의 항목 동의 여부 */
  SendingDate: string | null; /** 수신 동의 상태 변화일 */
  Marketing: string | null; /** 마케팅 동의 항목 동의 여부 비동의 - N 이메일 동의 - E / SMS동의 - S 둘 다 동의- Y */
  MarketingDate: string | null; /** 마케팅 동의 상태 변화일 */
  LastLogin: string | null; /** 마지막 로그인 날짜 */
  LastLoginIP: string | null; /** 마지막 로그인 IP */
  MemberOut: string | null; /** 회원탈퇴여부 */
  MemberOutDate: string | null; /** 탈퇴일 */
  Sleep: string | null; /** 휴면계정여부 */
  SleepDate: string | null; /** 휴면계정처리일 */
  UseYN: string | null; /** 계정 사용유무 */
  RegDate: string; /** 가입일 */
  EditDate: string | null; /** 최종 수정일 */
  EduManager: string | null; /** 교육담당자 여부 */
  ResNo: string; /** 주민번호 */
  nwIno: string | null; /** 비용수급사업장 */
  trneeSe: string | null; /** 훈련생구분 */
  IrglbrSe: string | null; /** 비정규직구분 */
  TestLectureCode: string | null; /** 테스트용 강의 코드 */
  TestID: string; /** 테스트용 아이디 여부 */
  ProtectID: string; /** 대리수강 방지 */
  MacVar: string | null; /** 어플에서 전달된 고유값 */
  MemberRemark: string | null; /** 사용자 메모 */
  PassChange: string; /** 비번 변경여부 */
  CardName: string | null; /** 내일배움카드명 */
  CardNumber: string | null; /** 내일배움카드 번호 */
  MailingDate: string | null; /** 수신동의날짜 */
  RecomID: string | null; /** 추천인아이디 */
  AbilityYN: string | null; /** 사전역량진단 완료:Y, 미완료:N */
  AbilityDate: string | null; /** 사전진단step03 완료 시간 */
  SatisfactionYN: string | null; /** 만족도조사 step02 완료:Y, 미완료:N */
  SatisfactionDate: string | null; /** 만족도조사 step02 완료 시간 */
  AbilityAfterYN: string | null; /** 사후진단 완료:Y, 미완료:N */
  AbilityAfterDate: string | null; /** 사후진단 step03 완료 시간 */
  MemberInDate: string | null; /** 탈퇴복구일 */
  MemberInAdminID: string | null; /** 탈퇴복구 관리자아이디 */
  deletedBy: string; /** 삭제한 관리자 아이디 */
  deletedDate: string | null; /** 삭제된 날짜 */
  reason4Deletion: string; /** 삭제 사유 */
}

export interface NegativeTrainingRow {
  idx: number; /** 고유증가값 */
  CompanyCode: string; /** 사업주번호 */
  Content: string | null; /** 내용 */
  RegDate: string | null; /** 등록일 */
  Del: string; /** 삭제여부 */
}

export interface NoticeRow {
  idx: number; /** 고유증가값 */
  UseYN: string; /** 사용유무 */
  Notice: string; /** 공지 여부 */
  Title: string; /** 제목 */
  Content: string | null; /** 내용 */
  FileName1: string | null; /** 첨부파일1 */
  RealFileName1: string | null; /** 첨부파일1 실제파일명 */
  FileName2: string | null; /** 첨부파일2 */
  RealFileName2: string | null; /** 첨부파일2 실제파일명 */
  FileName3: string | null; /** 첨부파일3 */
  RealFileName3: string | null; /** 첨부파일3 실제파일명 */
  FileName4: string | null; /** 첨부파일4 */
  RealFileName4: string | null; /** 첨부파일4 실제파일명 */
  FileName5: string | null; /** 첨부파일5 */
  RealFileName5: string | null; /** 첨부파일5 실제파일명 */
  ViewCount: number | null; /** 조회수 */
  Del: string; /** 삭제여부 */
  RegDate: string | null; /** 등록일 */
}

export interface PaymentSheetRow {
  idx: number; /** 고유 증가값 */
  CompanyCode: string; /** 사업자번호 */
  LectureStart: string; /** 시작일 */
  LectureEnd: string; /** 종료일 */
  BankPrice: number; /** 통장 입금액 */
  CardPrice: number; /** 카드 결제금액 */
  PayStatus: string; /** 상태:N 대기, R 결제요청, S 결제대기, Y 결제완료 */
  PaymentRemark: string | null; /** 결제관련 메모 */
  PayMethod: string | null; /** 결제수단 */
  MOID: string | null; /** 주문번호 */
  tid: string | null; /** 거래번호 */
  PayDate: string | null; /** 결제 시간 */
  RegDate: string | null; /** 등록일 */
  CancelDate: string | null; /** 결제 취소(환불)일 */
  BankInfo: string | null; /** 가상계좌 결제정보 */
}

export interface PopupRow {
  idx: number; /** 고유값 */
  Title: string | null; /** 제목 */
  ImgName: string | null; /** 팝업이미지명 */
  ImgWidth: string | null; /** 이미지 가로사이즈 */
  ImgHeight: string | null; /** 이미지 세로사이즈 */
  PopupLeft: string | null; /** 팝업좌측위치 */
  PopupTop: string | null; /** 팝업상단위치 */
  EndDate: string | null; /** 팝업종료일 */
  UseYN: string | null; /** 팝업사용유무 */
  RegDate: string | null; /** 등록일 */
}

export interface Popup_LinkRow {
  num: number; /** 고유값 */
  idx: number | null; /** 팝업고유값 */
  ImgArea: string | null; /** 이미지맵영역값 */
  LinkURL: string | null; /** 링크URL */
}

export interface ProgressRow {
  idx: number; /** 자동 증가값 */
  ID: string; /** 아이디 */
  LectureCode: string; /** 강의 코드 */
  Study_Seq: number; /** 수강신청 Seq */
  Chapter_Seq: number; /** 하부 강의 Seq */
  Contents_idx: number; /** 기초 차시 idx */
  ContentsDetail_Seq: number; /** 기초 차시 하부 Seq */
  LastStudy: string | null; /** 최종 강의 페이지, 동영상은 시간 */
  Progress: number; /** 차시 진도율 */
  StudyTime: number; /** 수강시간 초단위 */
  UserIP: string | null; /** 최종 수강 IP */
  RegDate: string | null; /** 최종 수강일 */
  TriggerYN: string; /** 트리거 적용 여부 */
  Chapter_Number: string | null; /** 수강중인 회차정보 */
  FinishTime: number; /** 종료시간(이어보기기능) */
}

export interface ProgressLogRow {
  idx: number; /** 자동 증가값 */
  ID: string; /** 아이디 */
  LectureCode: string; /** 강의 코드 */
  Study_Seq: number; /** 수강신청 Seq */
  Chapter_Seq: number; /** 하부 강의 Seq */
  Contents_idx: number; /** 기초 차시 idx */
  ContentsDetail_Seq: number; /** 기초 차시 하부 Seq */
  LastStudy: string | null; /** 최종 강의 페이지, 동영상은 시간 */
  Progress: number; /** 차시 진도율 */
  StudyTime: number; /** 수강시간 초단위 */
  UserIP: string | null; /** 최종 수강 IP */
  RegDate: string | null; /** 최종 수강일 */
  TriggerYN: string; /** 트리거 적용 여부 */
  Chapter_Number: string | null; /** 수강중인 회차정보 */
  TotalProgress: number; /** 전체 진도율 */
  FinishTime: number; /** 종료시간(이어보기기능) */
  PositionSec: number | null; /** Playback position seconds (per ContentsDetail page) — sql/add_progresslog_positionsec.sql */
}

export interface ReviewRow {
  idx: number; /** 고유 증가값 */
  LectureCode: string; /** 강의 코드 */
  ID: string; /** 아이디 */
  StarPoint: number | null; /** 별점 */
  Title: string; /** 후기 제목 */
  Contents: string | null; /** 후기 내용 */
  IP: string | null; /** 등록 IP */
  RegDate: string | null; /** 등록일 */
  UseYN: string | null; /** 홈페에지 노출여부 */
  Del: string | null; /** 삭제여부 */
  ViewCount: number | null; /** 조회수 */
}

export interface RubyConversationLogRow {
  idx: number;
  session_id: string | null;
  user_id: string | null;
  user_name: string | null;
  is_logged_in: number;
  user_message: string;
  bot_reply: string;
  intent_category: string;
  admin_transfer: number;
  fallback_reason: string | null;
  model_used: string | null;
  latency_ms: number;
  context_ids: string | null;
  created_at: string;
}

export interface RubyEmbeddingRow {
  idx: number;
  chunk_id: number;
  embedding_model: string;
  embedding_json: string;
  created_at: string;
  updated_at: string;
}

export interface RubyFaqRow {
  idx: number;
  question: string;
  answer: string;
  intent: string;
  keywords: string | null;
  locale: string;
  priority: number;
  status: string;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RubyKnowledgeBaseRow {
  id: number;
  type: string;
  title: string;
  content: string;
  locale: string;
  priority: number;
  status: string;
  source_url: string | null;
  embedding_model: string | null;
  embedding_json: string | null;
  embedding_updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RubyKnowledgeChunkRow {
  idx: number;
  source_type: string;
  source_ref: string;
  title: string | null;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RubyPromptConfigRow {
  id: number;
  prompt_key: string;
  title: string;
  content: string;
  version: number;
  is_active: number;
  note: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RubyRuntimeConfigRow {
  id: number;
  config_key: string;
  config_value: string;
  value_type: string;
  is_active: number;
  note: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RubySupportTicketRow {
  id: number;
  session_id: string | null;
  user_id: string | null;
  user_name: string | null;
  contact_name: string;
  contact_phone: string;
  user_message: string;
  bot_context: string | null;
  similarity_score: number | null;
  model_confidence: number | null;
  status: string;
  assigned_to: string | null;
  resolved_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface SendMessageRow {
  idx: number; /** 고유증가값 */
  MessageMode: string; /** 메세지 유형 */
  TemplateCode: string; /** 알림톡 템플릿 코드 */
  Massage: string | null; /** 메세지 내용 */
  TemplateMessage: string | null; /** 카톡_알림톡메시지 */
  Del: string | null;
  RegDate: string; /** 등록일 */
  EmTitle: string | null;
}

export interface SiteInfomationRow {
  idx: number; /** 자동 증가값 */
  CompanyName: string | null; /** 상호명 */
  Ceo: string | null; /** 대표자명 */
  CompanyNumber: string | null; /** 사업자번호 */
  SalesReportNumber: string | null; /** 통신판매업신고번호 */
  Phone: string | null; /** 고객상담센터 */
  Fax: string | null; /** FAX */
  Email: string | null; /** 이메일 */
  PersonalInformationManager: string | null; /** 개인정보책임자 */
  Address: string | null; /** 주소 */
  Copyright: string | null; /** Copyright */
  RegDate: string | null; /** 등록일 */
  KakaoURL: string | null; /** 카카오 채널 url */
}

export interface SmsResRow {
  idx: number; /** 고유증가값 */
  ID: string | null; /** 아이디 */
  Study_Seq: number | null; /** 강의 Seq */
  Massage: string | null; /** 발송한 메세지 */
  Mobile: string | null; /** 휴대폰번호 */
  InputID: string | null; /** 발송자 아이디 */
  RegDate: string | null; /** 등록일 */
  ResDate: string; /** 예약발송일자 */
  SendYN: string; /** 전송여부 */
}

export interface SmsSendLogRow {
  idx: number; /** 고유증가값 */
  ID: string | null; /** 아이디 */
  Study_Seq: number | null; /** 강의 Seq */
  Massage: string | null; /** 발송한 메세지 */
  Code: string | null; /** 발송 상태 코드 */
  Mobile: string | null; /** 휴대폰번호 */
  InputID: string | null; /** 발송자 아이디 */
  RegDate: string | null; /** 발송일 */
}

export interface StaRow {
  idx: number; /** 고유값 */
  s_year: number | null; /** 년도 */
  s_mon: number | null; /** 월 */
  s_day: number | null; /** 일 */
  hour_0: number | null; /** 0시 접속자 */
  hour_1: number | null; /** 1시 접속자 */
  hour_2: number | null; /** 2시 접속자 */
  hour_3: number | null; /** 3시 접속자 */
  hour_4: number | null; /** 4시 접속자 */
  hour_5: number | null; /** 5시 접속자 */
  hour_6: number | null; /** 6시 접속자 */
  hour_7: number | null; /** 7시 접속자 */
  hour_8: number | null; /** 8시 접속자 */
  hour_9: number | null; /** 9시 접속자 */
  hour_10: number | null; /** 10시 접속자 */
  hour_11: number | null; /** 11시 접속자 */
  hour_12: number | null; /** 12시 접속자 */
  hour_13: number | null; /** 13시 접속자 */
  hour_14: number | null; /** 14시 접속자 */
  hour_15: number | null; /** 15시 접속자 */
  hour_16: number | null; /** 16시 접속자 */
  hour_17: number | null; /** 17시 접속자 */
  hour_18: number | null; /** 18시 접속자 */
  hour_19: number | null; /** 19시 접속자 */
  hour_20: number | null; /** 20시 접속자 */
  hour_21: number | null; /** 21시 접속자 */
  hour_22: number | null; /** 22시 접속자 */
  hour_23: number | null; /** 23시 접속자 */
}

export interface StaffInfoRow {
  idx: number; /** 고유증가값 */
  ID: string; /** 아이디 */
  Dept_idx: number; /** 부서(DeptStructure) idx값 */
  Dept: string | null; /** 부서구분 A:관리자,B:영업,C:첨삭강사 */
  Name: string; /** 이름 */
  Pwd: string; /** 비밀번호 */
  Team: string | null; /** 소속 */
  Mobile: string | null; /** 휴대폰 */
  Phone: string | null; /** 연락처 */
  Email: string | null; /** 이메일 */
  BankName: string | null; /** 은행명 */
  BankNumber: string | null; /** 계좌번호 */
  LastLoginDate: string | null; /** 마지막로그인날짜 */
  LastLoginIP: string | null; /** 마지막로그인IP */
  UseYN: string | null; /** 사용유무 */
  Del: string | null; /** 삭제여부 */
  RegDate: string | null; /** 등록일 */
  CommissionRatio: number | null; /** 영업자 수수료율 */
  SiteCode: string | null; /** 사이트 구분 */
}

export interface StaffLoginHistoryRow {
  idx: number; /** 자동증가값 */
  ID: string | null; /** 아이디 */
  Device: string | null; /** 로그인 유형 */
  IP: string | null; /** IP */
  SiteCode: string | null; /** 사이트 구분 */
  RegDate: string | null; /** 등록일 */
}

export interface StudyRow {
  Seq: number; /** 고유 증가값 */
  LectureTerme_idx: number; /** 수강회차 idx */
  LectureCode: string; /** 강의코드 */
  ServiceType: string; /** 서비스 구분(A:패키지/X:이러닝/Y:마이크로닝/Z:숏폼) */
  Tutor: string | null; /** 첨삭강사 아이디 */
  ID: string; /** 수강생 아이디 */
  CompanyCode: string | null; /** 소속기관 사업자번호 */
  LectureStart: string; /** 시작일 */
  LectureEnd: string; /** 종료일 */
  LectureReStudy: string | null; /** 복습일 기간 */
  Progress: number; /** 수강 진도율 */
  OpenChapter: number | null; /** 실시회차 */
  StudyIP: string | null; /** 최종 수강 IP */
  Survey: string; /** 설문조사 여부 */
  PassOK: string; /** 수료여부(Y=수료,N=미수료) */
  FailReason: string | null; /** 미수료 사유 */
  Price: number; /** 교육비 */
  rPrice: number; /** 환급비 */
  rPrice2: number; /** 자부담금 */
  StudyEnd: string; /** 수강종료여부(채점완료) */
  InputID: string | null; /** 입력자 ID */
  InputDate: string | null; /** 입력 시간 */
  StudyKey: string | null; /** 수강중복체크값(lectureOpenSeq_userID) */
  PackageRef: number | null; /** 패키지 고유번호(패키지 강의의 경우) */
  PackageLevel: number | null; /** 패키지 강의 순서 */
  Remark: string | null; /** 관리자 메모 */
  SalesID: string | null; /** 영업자 아이디 */
  certCount: number | null; /** 실명인증횟수 */
  PackageGroupNo: number | null; /** 패키지 그룹번호 */
  MidCaptchaTime: string | null;
  MidScore: number | null;
  MidStatus: string | null;
  TestStartTime: string | null;
  TestEndTime: string | null;
  TestTempSaveTime: string | null;
  TestCaptchaTime: string | null;
  TestScore: number | null;
  TestStatus: string | null;
  ReportCaptchaTime: string | null;
  ReportScore: number | null;
  ReportStatus: string | null;
  TotalScore: number | null;
  MidSaveTime: string | null;
  MidCheckTime: string | null;
  TestSaveTime: string | null;
  TestCheckTime: string | null;
  ReportSaveTime: string | null;
  ReportCheckTime: string | null;
  MidIP: string | null;
  TestIP: string | null;
  ReportIP: string | null;
  MidCheckIP: string | null;
  TestCheckIP: string | null;
  ReportCheckIP: string | null;
  MidTutorTempSave: string | null;
  TestTutorTempSave: string | null;
  ReportTutorTempSave: string | null;
  ReMid: string | null;
  ReTest: string | null;
  ReReport: string | null;
  reDate: string | null;
  Mosa: string | null;
  TestCopy: string | null;
  ReportCopy: string | null;
  ResultView: string | null;
  rPrice3: number | null;
  rPrice4: number | null;
  rPrice5: number | null;
  rPrice6: number | null;
}

export interface StudyCorrectionNoticeRow {
  ID: string;
  total_delta_sec: number;
  applied_at: string;
  acknowledged_at: string | null;
  ack_ip: string | null;
}

export interface StudyCounselRow {
  idx: number; /** 자동증가값 */
  ID: string | null; /** 아이디 */
  LectureCode: string | null; /** 강의 코드 */
  Study_Seq: number | null; /** 수강 Seq */
  Contents_idx: number | null; /** 컨텐츠 idx */
  Category: string | null; /** 문의종류 */
  Title: string | null; /** 제목 */
  Contents: string | null; /** 내용 */
  RegDate: string | null; /** 등록일 */
  Name2: string | null; /** 답변 이름 */
  Contents2: string | null; /** 답변 내용 */
  RegDate2: string | null; /** 답변 등록일 */
  FileName1: string | null; /** 첨부파일1 */
  RealFileName1: string | null; /** 첨부파일1 실제파일명 */
  FileName2: string | null; /** 첨부파일2 */
  RealFileName2: string | null; /** 첨부파일2 실제파일명 */
  FileName3: string | null; /** 첨부파일3 */
  RealFileName3: string | null; /** 첨부파일3 실제파일명 */
  FileName4: string | null; /** 첨부파일4 */
  RealFileName4: string | null; /** 첨부파일4 실제파일명 */
  FileName5: string | null; /** 첨부파일5 */
  RealFileName5: string | null; /** 첨부파일5 실제파일명 */
  Status: string | null; /** 상태 */
  Del: string | null; /** 삭제여부 */
  ViewCount: number | null; /** 조회수 */
}

export interface StudyDeleteLogRow {
  Seq: number; /** 고유 증가값 */
  LectureTerme_idx: number; /** 수강회차 idx */
  LectureCode: string; /** 강의코드 */
  ServiceType: number; /** 서비스 구분 */
  Tutor: string | null; /** 첨삭강사 아이디 */
  ID: string; /** 수강생 아이디 */
  CompanyCode: string | null; /** 소속기관 사업자번호 */
  LectureStart: string; /** 시작일 */
  LectureEnd: string; /** 종료일 */
  LectureReStudy: string | null; /** 복습일 기간 */
  Progress: number; /** 수강 진도율 */
  OpenChapter: number | null; /** 실시회차 */
  StudyIP: string | null; /** 최종 수강 IP */
  Survey: string; /** 설문조사 여부 */
  PassOK: string; /** 수료여부(Y=수료,N=미수료) */
  FailReason: string | null; /** 미수료 사유 */
  Price: number; /** 교육비 */
  rPrice: number; /** 환급비 */
  rPrice2: number; /** 자부담금 */
  StudyEnd: string; /** 수강종료여부(채점완료) */
  InputID: string | null; /** 입력자 ID */
  InputDate: string | null; /** 입력 시간 */
  StudyKey: string | null; /** 수강중복체크값(lectureOpenSeq_userID) */
  PackageRef: number | null; /** 패키지 고유번호(패키지 강의의 경우) */
  PackageLevel: number | null; /** 패키지 강의 순서 */
  Remark: string | null; /** 관리자 메모 */
  SalesID: string | null; /** 영업자 아이디 */
  certCount: number | null; /** 실명인증횟수 */
  PackageGroupNo: number | null; /** 패키지 그룹번호 */
}

export interface StudyEndRow {
  idx: number; /** 자동증가값 */
  CompanyCode: string; /** 사업자번호 */
  ID: string; /** 수강생 아이디 */
  LectureCode: string | null; /** 강의코드 */
  ServiceType: string | null; /** 서비스 구분 */
  LectureStart: string; /** 시작일 */
  LectureEnd: string; /** 종료일 */
  ResultViewInputID: string; /** 점수확인 입력자 */
  ResultViewInputDate: string; /** 점수확인 입력일 */
  StudyEndInputID: string; /** 수강마감 입력자 */
  StudyEndInputDate: string; /** 수강마감 입력일 */
}

export interface StudyExcelTempRow {
  idx: number; /** 고유 증가값 */
  ID: string; /** 등록자 아이디 */
  LectureCode: string | null; /** 강의코드 */
  Tutor: string | null; /** 첨삭 강사 */
  Name: string | null; /** 수강생 성명 */
  ResNo: string | null; /** 주민번호 */
  Mobile: string | null; /** 휴대폰 */
  Email: string | null; /** 이메일 */
  CompanyCode: string | null; /** 사업자번호 */
  Depart: string | null; /** 부서명 */
  LectureStart: string | null; /** 강의 시작일 */
  LectureEnd: string | null; /** 강의 종료일 */
  LectureReStudy: string | null; /** 복습종료일 */
  ServiceType: string | null; /** 서비스 구분 */
  UserID: string | null; /** 수강생 아이디 */
  Pwd: string | null; /** 비밀번호 */
  nwIno: string | null; /** 비용수급사업장 */
  trneeSe: string | null; /** 훈련생구분 */
  IrglbrSe: string | null; /** 비정규직구분 */
  OpenChapter: string | null; /** 실시회차 */
  SalesID: string | null; /** 영업자 아이디 */
  EduManager: string | null; /** 교육담당자 여부 */
  RegDate: string | null; /** 등록일 */
}

export interface StudyPDSRow {
  idx: number; /** 고유증가값 */
  UseYN: string; /** 사용유무 */
  Notice: string; /** 공지 여부 */
  Category: string; /** 분류 */
  Title: string; /** 제목 */
  Content: string | null; /** 내용 */
  FileName1: string | null; /** 첨부파일1 */
  RealFileName1: string | null; /** 첨부파일1 실제파일명 */
  FileName2: string | null; /** 첨부파일2 */
  RealFileName2: string | null; /** 첨부파일2 실제파일명 */
  FileName3: string | null; /** 첨부파일3 */
  RealFileName3: string | null; /** 첨부파일3 실제파일명 */
  FileName4: string | null; /** 첨부파일4 */
  RealFileName4: string | null; /** 첨부파일4 실제파일명 */
  FileName5: string | null; /** 첨부파일5 */
  RealFileName5: string | null; /** 첨부파일5 실제파일명 */
  ViewCount: number | null; /** 조회수 */
  Del: string; /** 삭제여부 */
  RegDate: string | null; /** 등록일 */
}

export interface StudyPDS_ScrapRow {
  Num: number; /** 고유 증가값 */
  idx: number; /** 학습자료 idx값 */
  ID: string; /** ID */
  RegDate: string; /** 스크랩 시간 */
}

export interface StudyTimeCorrectionRow {
  idx: number;
  ID: string;
  action: string; /** adjustment action label */
  progress_idx: number | null;
  old_seconds: number;
  new_seconds: number;
  delta_seconds: number; /** old - new */
  note: string | null;
  applied_at: string;
}

export interface TB_ATTEND_HIST_V2Row {
  SEQ: number;
  USER_AGENT_PK: string; /** 훈련기관회원PK */
  COURSE_AGENT_PK: string; /** 훈련기관과정PK */
  CLASS_AGENT_PK: string | null; /** 훈련기관수업PK */
  PASS_FLAG: number; /** 수료여부 (PROGRESS_RATE 15이상 : 1, 15미만 : 0) */
  ATTEND_VALID_FLAG: number; /** 수강확정여부 (1 : 확정, 0 : 미확정) */
  CHANGE_STATE: string; /** 변경상태 */
  REG_DATE: string; /** 등록일시 */
  EMP_INS_FLAG: number; /** 고용환급과정여부 */
  PROGRESS_RATE: number | null; /** 최종진도율 (해당 과정 학습시간, 시간 단위, 소수점 이하 버림) */
  TOTAL_SCORE: number; /** 총점 */
}

export interface TB_ATTEND_HIST_V2_RESULTRow {
  SEQ: number;
  USER_AGENT_PK: string; /** 훈련기관회원PK */
  COURSE_AGENT_PK: string; /** 훈련기관과정PK */
  CLASS_AGENT_PK: string; /** 훈련기관수업PK */
  PASS_FLAG: number; /** 수료여부 */
  ATTEND_VALID_FLAG: number; /** 수강확정여부 */
  CHANGE_STATE: string; /** 변경상태 */
  REG_DATE: string; /** 등록일시 */
  EMP_INS_FLAG: number; /** 고용환급과정여부 */
  PROGRESS_RATE: number | null; /** 최종진도율 */
  TOTAL_SCORE: number; /** 총점 */
}

export interface TB_ATTEND_RESULT_HIST_V2Row {
  SEQ: number;
  USER_AGENT_PK: string; /** 훈련기관회원PK */
  COURSE_AGENT_PK: string; /** 훈련기관과정PK */
  CLASS_AGENT_PK: string; /** 훈련기관수업PK */
  PASS_FLAG: string; /** 수료여부 */
  ATTEND_VALID_FLAG: number; /** 수강확정여부 */
  CHANGE_STATE: string; /** 변경상태 */
  REG_DATE: string; /** 등록일시 */
  EMP_INS_FLAG: number; /** 고용환급과정여부 */
  PROGRESS_RATE: number | null; /** 최종진도율 */
  TOTAL_SCORE: number; /** 총점 */
  t044930202: string | null;
  ARC2025: string | null;
  '1': number | null;
  '1_1': number | null;
  U: string | null;
  Column7: string | null;
  '1_2': number | null;
  '16': number | null;
  '100': number | null;
}

export interface TB_CLASS_HIST_V2Row {
  SEQ: number;
  COURSE_AGENT_PK: string; /** 훈련기관과정PK */
  CLASS_AGENT_PK: string; /** 훈련기관수업PK */
  FULL_SCORE: number; /** 만점 */
  START_DT: string; /** 수업시작일 */
  END_DT: string; /** 수업종료일 */
  CHANGE_STATE: string; /** 변경상태 */
  REG_DATE: string; /** 등록일시 */
  TRACSE_TME: number; /** 회차 */
}

export interface TB_CLASS_HIST_V2_RESULTRow {
  SEQ: number;
  COURSE_AGENT_PK: string; /** 훈련기관과정PK */
  CLASS_AGENT_PK: string; /** 훈련기관수업PK */
  FULL_SCORE: number; /** 만점 */
  START_DT: string; /** 수업시작일 */
  END_DT: string; /** 수업종료일 */
  CHANGE_STATE: string; /** 변경상태 */
  REG_DATE: string; /** 등록일시 */
  TRACSE_TME: number; /** 회차 */
}

export interface TB_CONTENTS_HIST_V2Row {
  SEQ: number;
  COURSE_AGENT_PK: string | null; /** 훈련기관과정PK */
  CONTENTS_AGENT_PK: string; /** 과정명 */
  RMTN_TCMT_SEQ: string; /** 과정연번 */
  RMTN_TCMT_SECD: string; /** 과정 심사시 발급된 코드 */
  TRNG_CRSN: string; /** 과정 유효 여부(1:유효 0:비유효) */
  CHANGE_STATE: string; /** 변경상태(C:insert U:update D: delete) */
  REG_DATE: string; /** 등록일시 */
}

export interface TB_CONTENTS_HIST_V2_RESULTRow {
  SEQ: number;
  COURSE_AGENT_PK: string; /** 훈련기관과정PK */
  CONTENTS_AGENT_PK: string; /** 과정명 */
  RMTN_TCMT_SEQ: string; /** 총교육시간 또는 기간 */
  RMTN_TCMT_SECD: string; /** 과정 심사시 발급된 코드 */
  TRNG_CRSN: string; /** 과정 유효 여부(1:유효 0:비유효) */
  CHANGE_STATE: string; /** 변경상태(C:insert U:update D: delete) */
  REG_DATE: string; /** 등록일시 */
}

export interface TB_COURSE_HIST_V2Row {
  SEQ: number;
  COURSE_AGENT_PK: string | null; /** 훈련기관과정PK */
  NAME: string; /** 과정명 */
  SIMSA_CODE: string | null; /** 과정 심사시 발급된 코드 (빈값 NULL) */
  POST_COURSE_FLAG: number; /** 8 (고정) */
  CHANGE_STATE: string; /** 변경상태(C:insert U:update D: delete) */
  REG_DATE: string; /** 등록일시 */
  TRACSE_ID: string; /** HRD-Net과정코드 */
}

export interface TB_COURSE_HIST_V2_RESULTRow {
  SEQ: number;
  COURSE_AGENT_PK: string; /** 훈련기관과정PK */
  NAME: string; /** 과정명 */
  SIMSA_CODE: string | null; /** 과정 심사시 발급된 코드 */
  POST_COURSE_FLAG: number; /** 8 (고정) */
  CHANGE_STATE: string; /** 변경상태(C:insert U:update D: delete) */
  REG_DATE: string; /** 등록일시 */
  TRACSE_ID: string; /** HRD-Net과정코드 */
}

export interface TB_CSE_HIST_V2Row {
  SEQ: number;
  USER_AGENT_PK: string; /** 훈련기관회원PK */
  COURSE_AGENT_PK: string; /** 훈련기관과정PK */
  CLASS_AGENT_PK: string | null; /** 훈련기관수업PK */
  CONTENTS_AGENT_PK: string; /** 훈련기관 콘텐츠PK */
  TOTAL_SCORE: number; /** 총점 */
  PROGRESS_RATE: number | null; /** 최종진도율 */
  PASS_FLAG: string; /** 수료여부 */
  CHANGE_STATE: string; /** 변경상태 */
  REG_DATE: string; /** 등록일시 */
}

export interface TB_CSE_HIST_V2_RESULTRow {
  SEQ: number;
  USER_AGENT_PK: string; /** 훈련기관회원PK */
  COURSE_AGENT_PK: string; /** 훈련기관과정PK */
  CLASS_AGENT_PK: string | null; /** 훈련기관수업PK */
  CONTENTS_AGENT_PK: string; /** 훈련기관 콘텐츠PK */
  TOTAL_SCORE: number; /** 총점 */
  PROGRESS_RATE: number | null; /** 최종진도율 */
  PASS_FLAG: string; /** 수료여부 */
  CHANGE_STATE: string; /** 변경상태 */
  REG_DATE: string; /** 등록일시 */
}

export interface TB_CSE_RESULT_HIST_V2Row {
  SEQ: number;
  USER_AGENT_PK: string; /** 훈련기관회원PK */
  COURSE_AGENT_PK: string; /** 훈련기관과정PK */
  CLASS_AGENT_PK: string; /** 훈련기관수업PK */
  CONTENTS_AGENT_PK: string; /** 훈련기관 콘텐츠PK */
  TOTAL_SCORE: number; /** 총점 */
  PROGRESS_RATE: number | null; /** 최종진도율 */
  PASS_FLAG: string; /** 수료여부 */
  CHANGE_STATE: string; /** 변경상태 */
  REG_DATE: string; /** 등록일시 */
}

export interface TB_SCORE_HIST_V2Row {
  SEQ: number;
  USER_AGENT_PK: string; /** 훈련기관회원PK */
  COURSE_AGENT_PK: string; /** 훈련기관과정PK */
  CLASS_AGENT_PK: string | null; /** 훈련기관수업PK */
  CONTENTS_AGENT_PK: string; /** 훈련기관 콘텐츠PK */
  EVAL_TYPE: string; /** 평가방법 */
  SUBMIT_DATE: string; /** 제출일시 */
  SCORE: number; /** 수강자의 점수 */
  ACCESS_IP: string; /** 접속IP */
  SUBMIT_DUE_DT: string | null; /** 제출마감일 */
  CHANGE_STATE: string; /** 변경상태 */
  IS_COPIED_ANSWER: string; /** 모사답안 여부 */
  EVAL_CD: string; /** 평가코드 */
  CHASI: string; /** 진도 차시 */
  SUBMIT_DATE_END: string | null; /** 학습 종료일시 */
  REG_DATE: string; /** 등록일시 */
}

export interface TB_SCORE_HIST_V2_RESULTRow {
  SEQ: number;
  USER_AGENT_PK: string; /** 훈련기관회원PK */
  COURSE_AGENT_PK: string; /** 훈련기관과정PK */
  CLASS_AGENT_PK: string; /** 훈련기관수업PK */
  CONTENTS_AGENT_PK: string; /** 훈련기관 콘텐츠PK */
  EVAL_TYPE: string; /** 평가방법 */
  SUBMIT_DATE: string; /** 제출일시 */
  SCORE: number; /** 수강자의 점수 */
  ACCESS_IP: string; /** 접속IP */
  SUBMIT_DUE_DT: string; /** 제출마감일 */
  CHANGE_STATE: string; /** 변경상태 */
  IS_COPIED_ANSWER: string; /** 모사답안 여부 */
  EVAL_CD: string; /** 평가코드 */
  CHASI: string; /** 진도 차시 */
  SUBMIT_DATE_END: string; /** 학습 종료일시 */
  REG_DATE: string; /** 등록일시 */
}

export interface TB_USER_HIST_V2_ENCRow {
  SEQ: number; /** 순번 */
  USER_AGENT_PK: string; /** 훈련기관 회원PK */
  USER_NAME: string; /** 회원이름 */
  RES_NO: string; /** 주민등록번호 */
  ENC_RES_NO: string; /** 수강자 소속 (사업장명) */
  EMAIL: string | null; /** 이메일 */
  MOBILE: string; /** 휴대폰 */
  CHANGE_STATE: string; /** 변경상태 (C : 생성, U : 변경, D : 삭제) */
  REG_DATE: string; /** 등록일시 */
  NW_INO: string | null; /** 비용수급사업장 (11자리) */
  TRNEE_SE: string | null; /** 훈련생구분(빈값) */
  IRGLBR_SE: string | null; /** 비정규직구분(빈값) */
}

export interface TB_USER_HIST_V2_ENC_RESULTRow {
  SEQ: number; /** 순번 */
  USER_AGENT_PK: string; /** 훈련기관 회원PK */
  USER_NAME: string; /** 회원이름 */
  RES_NO: string; /** 주민등록번호 */
  ENC_RES_NO: string; /** 수강자 소속 (사업장명) */
  EMAIL: string | null; /** 이메일 */
  MOBILE: string; /** 휴대폰 */
  CHANGE_STATE: string; /** 변경상태 (C : 생성, U : 변경, D : 삭제) */
  REG_DATE: string; /** 등록일시 */
  NW_INO: string | null; /** 비용수급사업장 (11자리) */
  TRNEE_SE: string | null; /** 훈련생구분(빈값) */
  IRGLBR_SE: string | null; /** 비정규직구분(빈값) */
}

export interface TB_USER_LOGIN_HIST_V2Row {
  SEQ: number; /** 순번 */
  USER_AGENT_PK: string; /** 훈련기관회원PK */
  LOGIN_DATE: string; /** 로그인시간 */
  LOGIN_IP: string; /** 로그인IP */
}

export interface TB_USER_LOGIN_HIST_V2_RESULTRow {
  SEQ: number; /** 순번 */
  USER_AGENT_PK: string; /** 훈련기관회원PK */
  LOGIN_DATE: string; /** 로그인시간 */
  LOGIN_IP: string; /** 로그인IP */
}

export interface TeacherRow {
  idx: number; /** 자동증가값 */
  Name: string | null; /** 강사명 */
  Photo: string | null; /** 강사 사진 */
  Profile: string | null; /** 약력 */
  Del: string | null; /** 삭제여부 */
  RegDate: string | null; /** 등록일 */
}

export interface UserCertOTPRow {
  Seq: number; /** 고유증가값 */
  ID: string; /** 수강생 아이디 */
  LectureCode: string; /** 강의 코드 (콘텐츠 PK) */
  Study_Seq: number | null; /** Study Seq 값 */
  CertDate: string; /** 인증일 */
  CertType: string; /** 인증방법 */
  AGTID: string | null; /** 훈련기관 아이디 (EMON ID) */
  COURSE_AGENT_PK: string | null; /** 과정 PK */
  CLASS_AGENT_PK: string | null; /** 수업 PK */
  m_Ret: string | null; /** T/F (인증결과 : T – 인증성공, F – 인증실패 ) */
  m_retCD: string | null; /** 성공/실패 결과 값 000000 */
  m_trnID: string | null; /** 일련번호 RES_SEQ */
  m_trnDT: string | null; /** 인증처리 일시 (YYYY-MM-DD HH24:MI:SS) */
  RegDate: string; /** 등록일 */
  UserIP: string | null; /** 인증IP */
  EvalCD: string | null; /** 진행코드 */
  EvalType: string | null;
  ClassTime: string | null;
}

export interface backup_data_listRow {
  idx: number; /** 자동 증가 */
  web_file_nm: string | null; /** web 백업 파일명 */
  weblog_file_nm: string | null; /** weblog 백업 파일명 */
  db_file_nm: string | null; /** db 백업 파일명 */
  vod_file_nm: string | null; /** vod 백업 파일명 */
  backup_type: string; /** 백업 수단 */
  backup_interval: string; /** 백업 주기 */
  expiry_date: string | null; /** 만료일 */
  reg_date: string | null; /** 생성날짜 */
}

export interface DB {
  AbnormalDataLog: AbnormalDataLogRow;
  ArchiveAbilityResult1: ArchiveAbilityResult1Row;
  ArchiveAbilityResult2: ArchiveAbilityResult2Row;
  ArchiveQuestion: ArchiveQuestionRow;
  Archiving: ArchivingRow;
  AssessmentAccessGrant: AssessmentAccessGrantRow;
  AssessmentAccessGrantOtp: AssessmentAccessGrantOtpRow;
  Chapter: ChapterRow;
  ChapterExcelTemp: ChapterExcelTempRow;
  Cheating: CheatingRow;
  Company: CompanyRow;
  CompanyDeleteLog: CompanyDeleteLogRow;
  CompanyExcelTemp: CompanyExcelTempRow;
  Contents: ContentsRow;
  ContentsDetail: ContentsDetailRow;
  ContentsExcelTemp: ContentsExcelTempRow;
  ContentsKeyword: ContentsKeywordRow;
  ContentsList: ContentsListRow;
  Counsel: CounselRow;
  CounselPhone: CounselPhoneRow;
  Course: CourseRow;
  CourseCategory: CourseCategoryRow;
  CourseExcelTemp: CourseExcelTempRow;
  CourseLike: CourseLikeRow;
  DeptStructure: DeptStructureRow;
  EmailSendLog: EmailSendLogRow;
  EmailSendLogForEduManager: EmailSendLogForEduManagerRow;
  Faq: FaqRow;
  InformationProtectionLog: InformationProtectionLogRow;
  Inquiry: InquiryRow;
  KobeTriggerLog: KobeTriggerLogRow;
  LectureEvent: LectureEventRow;
  LectureRequest: LectureRequestRow;
  LectureTerme: LectureTermeRow;
  LoginHistory: LoginHistoryRow;
  LoginIng: LoginIngRow;
  Member: MemberRow;
  MemberCompany: MemberCompanyRow;
  MemberContents: MemberContentsRow;
  MemberDeletionLog: MemberDeletionLogRow;
  NegativeTraining: NegativeTrainingRow;
  Notice: NoticeRow;
  PaymentSheet: PaymentSheetRow;
  Popup: PopupRow;
  Popup_Link: Popup_LinkRow;
  Progress: ProgressRow;
  ProgressLog: ProgressLogRow;
  Review: ReviewRow;
  RubyConversationLog: RubyConversationLogRow;
  RubyEmbedding: RubyEmbeddingRow;
  RubyFaq: RubyFaqRow;
  RubyKnowledgeBase: RubyKnowledgeBaseRow;
  RubyKnowledgeChunk: RubyKnowledgeChunkRow;
  RubyPromptConfig: RubyPromptConfigRow;
  RubyRuntimeConfig: RubyRuntimeConfigRow;
  RubySupportTicket: RubySupportTicketRow;
  SendMessage: SendMessageRow;
  SiteInfomation: SiteInfomationRow;
  SmsRes: SmsResRow;
  SmsSendLog: SmsSendLogRow;
  Sta: StaRow;
  StaffInfo: StaffInfoRow;
  StaffLoginHistory: StaffLoginHistoryRow;
  Study: StudyRow;
  StudyCorrectionNotice: StudyCorrectionNoticeRow;
  StudyCounsel: StudyCounselRow;
  StudyDeleteLog: StudyDeleteLogRow;
  StudyEnd: StudyEndRow;
  StudyExcelTemp: StudyExcelTempRow;
  StudyPDS: StudyPDSRow;
  StudyPDS_Scrap: StudyPDS_ScrapRow;
  StudyTimeCorrection: StudyTimeCorrectionRow;
  TB_ATTEND_HIST_V2: TB_ATTEND_HIST_V2Row;
  TB_ATTEND_HIST_V2_RESULT: TB_ATTEND_HIST_V2_RESULTRow;
  TB_ATTEND_RESULT_HIST_V2: TB_ATTEND_RESULT_HIST_V2Row;
  TB_CLASS_HIST_V2: TB_CLASS_HIST_V2Row;
  TB_CLASS_HIST_V2_RESULT: TB_CLASS_HIST_V2_RESULTRow;
  TB_CONTENTS_HIST_V2: TB_CONTENTS_HIST_V2Row;
  TB_CONTENTS_HIST_V2_RESULT: TB_CONTENTS_HIST_V2_RESULTRow;
  TB_COURSE_HIST_V2: TB_COURSE_HIST_V2Row;
  TB_COURSE_HIST_V2_RESULT: TB_COURSE_HIST_V2_RESULTRow;
  TB_CSE_HIST_V2: TB_CSE_HIST_V2Row;
  TB_CSE_HIST_V2_RESULT: TB_CSE_HIST_V2_RESULTRow;
  TB_CSE_RESULT_HIST_V2: TB_CSE_RESULT_HIST_V2Row;
  TB_SCORE_HIST_V2: TB_SCORE_HIST_V2Row;
  TB_SCORE_HIST_V2_RESULT: TB_SCORE_HIST_V2_RESULTRow;
  TB_USER_HIST_V2_ENC: TB_USER_HIST_V2_ENCRow;
  TB_USER_HIST_V2_ENC_RESULT: TB_USER_HIST_V2_ENC_RESULTRow;
  TB_USER_LOGIN_HIST_V2: TB_USER_LOGIN_HIST_V2Row;
  TB_USER_LOGIN_HIST_V2_RESULT: TB_USER_LOGIN_HIST_V2_RESULTRow;
  Teacher: TeacherRow;
  UserCertOTP: UserCertOTPRow;
  backup_data_list: backup_data_listRow;
}

export const DB_TABLE_NAMES = ['AbnormalDataLog', 'ArchiveAbilityResult1', 'ArchiveAbilityResult2', 'ArchiveQuestion', 'Archiving', 'AssessmentAccessGrant', 'AssessmentAccessGrantOtp', 'Chapter', 'ChapterExcelTemp', 'Cheating', 'Company', 'CompanyDeleteLog', 'CompanyExcelTemp', 'Contents', 'ContentsDetail', 'ContentsExcelTemp', 'ContentsKeyword', 'ContentsList', 'Counsel', 'CounselPhone', 'Course', 'CourseCategory', 'CourseExcelTemp', 'CourseLike', 'DeptStructure', 'EmailSendLog', 'EmailSendLogForEduManager', 'Faq', 'InformationProtectionLog', 'Inquiry', 'KobeTriggerLog', 'LectureEvent', 'LectureRequest', 'LectureTerme', 'LoginHistory', 'LoginIng', 'Member', 'MemberCompany', 'MemberContents', 'MemberDeletionLog', 'NegativeTraining', 'Notice', 'PaymentSheet', 'Popup', 'Popup_Link', 'Progress', 'ProgressLog', 'Review', 'RubyConversationLog', 'RubyEmbedding', 'RubyFaq', 'RubyKnowledgeBase', 'RubyKnowledgeChunk', 'RubyPromptConfig', 'RubyRuntimeConfig', 'RubySupportTicket', 'SendMessage', 'SiteInfomation', 'SmsRes', 'SmsSendLog', 'Sta', 'StaffInfo', 'StaffLoginHistory', 'Study', 'StudyCorrectionNotice', 'StudyCounsel', 'StudyDeleteLog', 'StudyEnd', 'StudyExcelTemp', 'StudyPDS', 'StudyPDS_Scrap', 'StudyTimeCorrection', 'TB_ATTEND_HIST_V2', 'TB_ATTEND_HIST_V2_RESULT', 'TB_ATTEND_RESULT_HIST_V2', 'TB_CLASS_HIST_V2', 'TB_CLASS_HIST_V2_RESULT', 'TB_CONTENTS_HIST_V2', 'TB_CONTENTS_HIST_V2_RESULT', 'TB_COURSE_HIST_V2', 'TB_COURSE_HIST_V2_RESULT', 'TB_CSE_HIST_V2', 'TB_CSE_HIST_V2_RESULT', 'TB_CSE_RESULT_HIST_V2', 'TB_SCORE_HIST_V2', 'TB_SCORE_HIST_V2_RESULT', 'TB_USER_HIST_V2_ENC', 'TB_USER_HIST_V2_ENC_RESULT', 'TB_USER_LOGIN_HIST_V2', 'TB_USER_LOGIN_HIST_V2_RESULT', 'Teacher', 'UserCertOTP', 'backup_data_list'] as const;
