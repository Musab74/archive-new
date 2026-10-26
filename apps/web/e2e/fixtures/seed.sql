-- AINEX e2e fixtures (local throwaway DB only — loaded by e2e/stack.mjs after the API tree's reset-local-db.sh base seed).
-- Synthetic people only. Learner password for every account below: 1111 (Member.Pwd = SHA-256 hex). Staff: base seed admin01 / admin1234.
-- Dates are relative to CURDATE() so the data is "current" whenever the stack is (re)seeded; reseed after midnight for the
-- 본인인증 rows dated today. High ids (9xxx) keep clear of the base seed. Accounts and states are listed in e2e/README.md.
SET NAMES utf8;

-- ===== companies (A = e2emgr01's own, B = also managed by him via MemberCompany, C = not his) =====
INSERT INTO Company (idx, CompanyScale, CompanyCode, CompanyName, Ceo, Tel, EduManager, EduManagerPhone, SalesManager, RegDate, Del, SendSMS) VALUES
 (9001, 'C', '2208800001', 'E2E 이투이물산', '김대표', '02-700-0001', '강담당', '010-7701-0000', 'sales01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 300 DAY), '09:00:00'), 'N', 'Y'),
 (9002, 'B', '2208800002', 'E2E 이투이테크', '박대표', '02-700-0002', NULL, NULL, 'sales01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 300 DAY), '09:00:00'), 'N', 'Y'),
 (9003, 'C', '2208800003', 'E2E 타사상사', '최대표', '02-700-0003', NULL, NULL, 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 300 DAY), '09:00:00'), 'N', 'Y');

-- ===== members (idx 9001+) =====
--   e2emgr01     강담당  company A  EduManager=Y; manages A (own) + B (MemberCompany)
--   e2eterms01   문약관  company A  Mandatory=N → /auth/first-terms
--   e2epw01      장비번  company A  PassChange=N → /auth/password-change
--   e2eout01     서탈퇴  company A  MemberOut=Y → 탈퇴한 회원입니다.
--   e2enouse01   노사용  company A  UseYN=N → 아이디 또는 비밀번호를 잘못 입력했습니다.
--   e2esleep01   휴면이  company A  Sleep=Y → 휴면 안내 (DORMANT)
--   e2elearn01   김학습  company A  14h59m (53,940 s), 사후 미응시
--   e2elearn15   오십오  company A  exactly 15h (54,000 s), 사후 미응시 → 사후 open, PassOK N
--   e2epass01    이수료  company A  finished 30 days ago, PassOK Y → 수료증 출력
--   e2epass02    이대기  company A  PassOK Y, ends in 3 days → 수료증 대기 (LectureEnd+7)
--   e2eexp01     박만료  company A  expired 20 days ago (StudyEnd N), 5h
--   e2esoon01    최예정  company A  starts in 5 days
--   e2ewfree01   정비환급  company A  비환급(W) active, 3h10m
--   e2epre01     한사전  company A  active, 사전 미완료 → login routes to /assessment/pre
--   e2etest02    테스트이  company A  TestID=Y → /my, exempt from 본인인증 and the 8 h gate
--   e2egrant01   권진단  company A  10h, admin grant POST → login routes to /my/assessment
--   e2enocert01  신입과  company A  no UserCertOTP → 과정입과 시 본인인증이 필요합니다.
--   e2eauth01    윤인증  company A  입과 cert only, none today → 학습 진행 시 본인인증이 필요합니다.
--   e2ebco01     배학습  company B  company B (managed by e2emgr01), 2h
--   e2ebco02     배수료  company B  company B, finished PassOK Y
--   e2ecco01     차타사  company C  company C (NOT managed by e2emgr01), 1h
--   e2ecco02     차만료  company C  company C, expired
INSERT INTO Member (idx, MemberType, ID, Pwd, Name, BirthDay, Gender, Email, Mobile, CompanyCode, Depart, Position, Mandatory, Sending, Marketing, MemberOut, Sleep, UseYN, RegDate, EduManager, ResNo, TestID, ProtectID, PassChange) VALUES
 (9001, 'A', 'e2emgr01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '강담당', HEX(AES_ENCRYPT('1980-01-10', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('e2emgr01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7701-1000', 'test-enc-key')), '2208800001', '데이터혁신팀', '팀장', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 200 DAY), '10:00:00'), 'Y', '', 'N', 'Y', 'Y'),
 (9002, 'A', 'e2eterms01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '문약관', HEX(AES_ENCRYPT('1981-02-11', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('e2eterms01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7702-1001', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'N', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 199 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9003, 'A', 'e2epw01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '장비번', HEX(AES_ENCRYPT('1982-03-12', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('e2epw01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7703-1002', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 198 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'N'),
 (9004, 'A', 'e2eout01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '서탈퇴', HEX(AES_ENCRYPT('1983-04-13', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('e2eout01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7704-1003', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'Y', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 197 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9005, 'A', 'e2enouse01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '노사용', HEX(AES_ENCRYPT('1984-05-14', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('e2enouse01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7705-1004', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 196 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9006, 'A', 'e2esleep01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '휴면이', HEX(AES_ENCRYPT('1985-06-15', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('e2esleep01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7706-1005', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'Y', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 195 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9007, 'A', 'e2elearn01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '김학습', HEX(AES_ENCRYPT('1986-07-16', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('e2elearn01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7707-1006', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 194 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9008, 'A', 'e2elearn15', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '오십오', HEX(AES_ENCRYPT('1987-08-17', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('e2elearn15@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7708-1007', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 193 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9009, 'A', 'e2epass01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '이수료', HEX(AES_ENCRYPT('1988-09-18', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('e2epass01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7709-1008', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 192 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9010, 'A', 'e2epass02', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '이대기', HEX(AES_ENCRYPT('1989-01-10', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('e2epass02@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7710-1009', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 191 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9011, 'A', 'e2eexp01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '박만료', HEX(AES_ENCRYPT('1990-02-11', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('e2eexp01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7711-1010', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 190 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9012, 'A', 'e2esoon01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '최예정', HEX(AES_ENCRYPT('1991-03-12', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('e2esoon01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7712-1011', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 189 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9013, 'A', 'e2ewfree01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '정비환급', HEX(AES_ENCRYPT('1992-04-13', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('e2ewfree01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7713-1012', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 188 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9014, 'A', 'e2epre01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '한사전', HEX(AES_ENCRYPT('1993-05-14', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('e2epre01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7714-1013', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 187 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9015, 'A', 'e2etest02', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '테스트이', HEX(AES_ENCRYPT('1994-06-15', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('e2etest02@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7715-1014', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 186 DAY), '10:00:00'), 'N', '', 'Y', 'Y', 'Y'),
 (9016, 'A', 'e2egrant01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '권진단', HEX(AES_ENCRYPT('1980-07-16', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('e2egrant01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7716-1015', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 185 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9017, 'A', 'e2enocert01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '신입과', HEX(AES_ENCRYPT('1981-08-17', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('e2enocert01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7717-1016', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 184 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9018, 'A', 'e2eauth01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '윤인증', HEX(AES_ENCRYPT('1982-09-18', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('e2eauth01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7718-1017', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 183 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9019, 'A', 'e2ebco01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '배학습', HEX(AES_ENCRYPT('1983-01-10', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('e2ebco01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7719-1018', 'test-enc-key')), '2208800002', '기술지원팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 182 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9020, 'A', 'e2ebco02', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '배수료', HEX(AES_ENCRYPT('1984-02-11', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('e2ebco02@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7720-1019', 'test-enc-key')), '2208800002', '기술지원팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 181 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9021, 'A', 'e2ecco01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '차타사', HEX(AES_ENCRYPT('1985-03-12', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('e2ecco01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7721-1020', 'test-enc-key')), '2208800003', '총무팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 180 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (9022, 'A', 'e2ecco02', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '차만료', HEX(AES_ENCRYPT('1986-04-13', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('e2ecco02@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7722-1021', 'test-enc-key')), '2208800003', '총무팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 179 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y');
UPDATE Member SET MandatoryDate = RegDate WHERE idx >= 9001 AND Mandatory = 'Y';
UPDATE Member SET MemberOutDate = NOW() WHERE ID = 'e2eout01';
UPDATE Member SET SleepDate = NOW() WHERE ID = 'e2esleep01';
INSERT INTO MemberCompany (idx, ID, CompanyCode, Del, RegDate) VALUES (9001, 'e2emgr01', '2208800001', 'N', NOW()), (9002, 'e2emgr01', '2208800002', 'N', NOW()), (9003, 'e2emgr01', '2208800003', 'Y', NOW());
-- (the Del=Y MemberCompany row for company C must NOT widen his scope)

-- ===== catalog: categories, keywords =====
INSERT INTO CourseCategory (idx, ParentCategory, Deep, CategoryName, OrderByNum, UseYN, Del) VALUES
 (9010, 0, 1, '공통역량', 1, 'Y', 'N'), (9020, 0, 1, '직무역량', 2, 'Y', 'N'), (9030, 0, 1, '리더십', 3, 'Y', 'N'),
 (9011, 9010, 2, '커뮤니케이션', 1, 'Y', 'N'), (9012, 9010, 2, '자기계발', 2, 'Y', 'N'),
 (9021, 9020, 2, '데이터·디지털', 1, 'Y', 'N'), (9022, 9020, 2, '사무자동화', 2, 'Y', 'N'),
 (9031, 9030, 2, '조직관리', 1, 'Y', 'N'), (9039, 9030, 2, '[E2E] 숨김 분류', 9, 'N', 'N');
INSERT INTO ContentsKeyword (idx, Category, Keyword, Del, UseYN, OrderByNum, jobCate) VALUES (9051, '직무', '데이터분석', 'N', 'Y', 1, 'A'), (9052, '직무', '보고서작성', 'N', 'Y', 2, 'A'), (9053, '공통', '생성형AI', 'N', 'Y', 3, 'B');

-- 사전진단 step01 profile options (B·step01·A, aBind col2 직무 / col3 관심분야 / col4 역량) — also the catalog Keyword3/Keyword4 labels;
-- 관리자(M) step03 questions (B pre / A post) and the 아카이브 향상도 (A·step01·A) questions. The base seed's B·step02 C/L set is NOT extended,
-- so test01's seeded 사전 stays complete.
INSERT INTO ArchiveQuestion (idx, aType, aDepth, aGroup, aOrder, aBind, aValue, aValueDetail, regDate) VALUES
 (9001, 'B', 'step01', 'A', 1, 'col2', 'IT·개발', NULL, NOW()), (9002, 'B', 'step01', 'A', 2, 'col2', '경영지원', NULL, NOW()), (9003, 'B', 'step01', 'A', 3, 'col2', '영업·마케팅', NULL, NOW()),
 (9004, 'B', 'step01', 'A', 1, 'col3', 'AI·데이터', NULL, NOW()), (9005, 'B', 'step01', 'A', 2, 'col3', '리더십', NULL, NOW()), (9006, 'B', 'step01', 'A', 3, 'col3', '커뮤니케이션', NULL, NOW()),
 (9007, 'B', 'step01', 'A', 1, 'col4', '문제해결', NULL, NOW()), (9008, 'B', 'step01', 'A', 2, 'col4', '협업', NULL, NOW()),
 (9011, 'B', 'step03', 'M', 1, 'K', '관리직무1', '나는 팀의 목표를 설정한다', NOW()), (9012, 'B', 'step03', 'M', 2, 'L', '관리직무2', '나는 구성원을 코칭한다', NOW()),
 (9021, 'A', 'step03', 'M', 1, 'K', '관리직무1', '사후', NOW()), (9022, 'A', 'step03', 'M', 2, 'L', '관리직무2', '사후', NOW()),
 (9031, 'A', 'step01', 'A', 1, 'A', '콘텐츠 만족도', 'HRDe아카이브 콘텐츠에 만족한다', NOW()), (9032, 'A', 'step01', 'A', 2, 'B', '업무 도움', '학습 내용이 업무에 도움이 되었다', NOW()), (9033, 'A', 'step01', 'A', 3, 'C', '추천 의향', '동료에게 추천하겠다', NOW());

-- ===== courses (idx 9001+): ctype X 이러닝 / Z 마이크로러닝 / Y 숏폼 / R 라이브 + Type A packaged HTML lesson; ARC2026 (base, ctype A package) lists the e2e children =====
INSERT INTO Course (idx, ctype, LectureCode, ClassGrade, UseYN, Category1, Category2, Keyword1, Keyword2, Keyword3, Keyword4, ServiceType, ContentsName, ContentsTime, Mobile, BookPrice, PreviewImage, Intro, EduTarget, EduGoal, Del, RegDate, ContentsURLSelect, ContentsURL, MobileURL, Chapter, ContentsStart, ContentsEnd, UploadDate, PackageYN, PackageRef, PackageLectureCode, cnt, Professor, Price, PassTime) VALUES
 (9001, 'X', 'E2EX01', 'A', 'Y', 9020, 9021, '사원', '9051', '9004', '9007', 'X', '[E2E] 데이터 리터러시 실무', '960', 'Y', 0, 'e2e_x01.jpg', '<p>[E2E] 데이터 리터러시 실무 과정 소개 (E2E 데이터)</p>', '전 직원', '데이터 리터러시와 AI 데이터 활용의 기본을 익힌다', 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 90 DAY), '09:00:00'), 'A', '', '', '4', '2026-01-01', '2026-12-31', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 90 DAY), '09:00:00'), 'N', 0, '', 120, '김데이터', 0, 0),
 (9002, 'Z', 'E2EZ01', 'A', 'Y', 9010, 9011, '사원', '9052', '9006', '9008', 'Z', '[E2E] 5분 보고서 작성법', '20', 'Y', 0, 'e2e_z01.jpg', '<p>[E2E] 5분 보고서 작성법 과정 소개 (E2E 데이터)</p>', '전 직원', '업무에 바로 쓰는 실무 역량을 기른다', 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 40 DAY), '09:00:00'), 'A', '', '', '2', '2026-01-01', '2026-12-31', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 40 DAY), '09:00:00'), 'N', 0, '', 80, '이보고', 0, 0),
 (9003, 'Y', 'E2EY01', 'A', 'Y', 9020, 9022, '사원', '9051', '9004', '9007', 'Y', '[E2E] 1분 엑셀 단축키', '3', 'Y', 0, 'e2e_y01.jpg', '<p>[E2E] 1분 엑셀 단축키 과정 소개 (E2E 데이터)</p>', '전 직원', '업무에 바로 쓰는 실무 역량을 기른다', 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 10 DAY), '09:00:00'), 'A', '', '', '1', '2026-01-01', '2026-12-31', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 10 DAY), '09:00:00'), 'N', 0, '', 300, '박엑셀', 0, 0),
 (9004, 'X', 'E2EH01', 'A', 'Y', 9010, 9012, '사원', '9051', '9005', '9008', 'X', '[E2E] 패키지형 HTML 차시 체험', '20', 'Y', 0, 'e2e_h01.jpg', '<p>[E2E] 패키지형 HTML 차시 체험 과정 소개 (E2E 데이터)</p>', '전 직원', '업무에 바로 쓰는 실무 역량을 기른다', 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 20 DAY), '09:00:00'), 'A', '', '', '1', '2026-01-01', '2026-12-31', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 20 DAY), '09:00:00'), 'N', 0, '', 15, '최패키지', 0, 0),
 (9005, 'R', 'E2ER01', 'A', 'Y', 9020, 9021, '사원', '9053', '9004', '9007', 'R', '[E2E] 라이브 특강: 생성형 AI 업무 활용', '60', 'Y', 0, 'e2e_r01.jpg', '<p>[E2E] 라이브 특강: 생성형 AI 업무 활용 과정 소개 (E2E 데이터)</p>', '전 직원', '생성형 AI를 업무에 적용한다', 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '09:00:00'), 'A', '', '', '1', '2026-01-01', '2026-12-31', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '09:00:00'), 'N', 0, '', 42, '정라이브', 0, 0),
 (9006, 'X', 'E2EX02', 'A', 'Y', 9020, 9021, '사원', '9051', '9004', '9007', 'X', '[E2E] AI 프롬프트 기초 (패키지 미포함)', '30', 'Y', 0, 'e2e_x02.jpg', '<p>[E2E] AI 프롬프트 기초 (패키지 미포함) 과정 소개 (E2E 데이터)</p>', '전 직원', 'ChatGPT 프롬프트 작성의 기본을 익힌다', 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '09:00:00'), 'A', '', '', '1', '2026-01-01', '2026-12-31', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '09:00:00'), 'N', 0, '', 9, '한프롬', 0, 0),
 (9007, 'X', 'E2EXDEL', 'A', 'Y', 9020, 9021, '사원', '9051', '9004', '9007', 'X', '[E2E] 삭제된 과정', '30', 'Y', 0, NULL, '<p>[E2E] 삭제된 과정 과정 소개 (E2E 데이터)</p>', '전 직원', '업무에 바로 쓰는 실무 역량을 기른다', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 60 DAY), '09:00:00'), 'A', '', '', '0', '2026-01-01', '2026-12-31', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 60 DAY), '09:00:00'), 'N', 0, '', 0, '삭제', 0, 0),
 (9008, 'X', 'E2EXOFF', 'A', 'N', 9020, 9021, '사원', '9051', '9004', '9007', 'X', '[E2E] 비노출 과정', '30', 'Y', 0, NULL, '<p>[E2E] 비노출 과정 과정 소개 (E2E 데이터)</p>', '전 직원', '업무에 바로 쓰는 실무 역량을 기른다', 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 60 DAY), '09:00:00'), 'A', '', '', '0', '2026-01-01', '2026-12-31', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 60 DAY), '09:00:00'), 'N', 0, '', 0, '비노출', 0, 0);
UPDATE Course SET PackageLectureCode = 'D00001|D00002|E2EX01|E2EZ01|E2EY01|E2EH01|E2ER01' WHERE LectureCode = 'ARC2026';
INSERT INTO Contents (idx, Gubun, ContentsTitle, LectureTime, Expl01, Expl02, Expl03, RegDate, Del) VALUES
 (9101, 'A', '1. 데이터로 말하는 습관', 240, '1. 데이터로 말하는 습관 — 차시 목표', '훈련 내용 (E2E)', '학습 활동 (E2E)', NOW(), 'N'),
 (9102, 'A', '2. 숫자를 그림으로: 시각화 기본', 240, '2. 숫자를 그림으로: 시각화 기본 — 차시 목표', '훈련 내용 (E2E)', '학습 활동 (E2E)', NOW(), 'N'),
 (9103, 'A', '3. 엑셀 피벗으로 보는 현업 데이터', 240, '3. 엑셀 피벗으로 보는 현업 데이터 — 차시 목표', '훈련 내용 (E2E)', '학습 활동 (E2E)', NOW(), 'N'),
 (9104, 'A', '4. 데이터 리터러시 실전 보고', 240, '4. 데이터 리터러시 실전 보고 — 차시 목표', '훈련 내용 (E2E)', '학습 활동 (E2E)', NOW(), 'N'),
 (9111, 'A', '1. 두괄식 보고서의 구조', 10, '1. 두괄식 보고서의 구조 — 차시 목표', '훈련 내용 (E2E)', '학습 활동 (E2E)', NOW(), 'N'),
 (9112, 'A', '2. 한 장 보고서 다듬기', 10, '2. 한 장 보고서 다듬기 — 차시 목표', '훈련 내용 (E2E)', '학습 활동 (E2E)', NOW(), 'N'),
 (9121, 'A', '엑셀 단축키 TOP 5', 3, '엑셀 단축키 TOP 5 — 차시 목표', '훈련 내용 (E2E)', '학습 활동 (E2E)', NOW(), 'N'),
 (9131, 'A', '패키지형 차시: 들어가며 · 핵심 정리', 20, '패키지형 차시: 들어가며 · 핵심 정리 — 차시 목표', '훈련 내용 (E2E)', '학습 활동 (E2E)', NOW(), 'N'),
 (9141, 'A', '라이브 다시보기: 생성형 AI 업무 활용', 60, '라이브 다시보기: 생성형 AI 업무 활용 — 차시 목표', '훈련 내용 (E2E)', '학습 활동 (E2E)', NOW(), 'N'),
 (9151, 'A', '프롬프트 작성의 기본', 30, '프롬프트 작성의 기본 — 차시 목표', '훈련 내용 (E2E)', '학습 활동 (E2E)', NOW(), 'N');
INSERT INTO ContentsDetail (Seq, Contents_idx, ContentsType, ContentsURLSelect, ContentsURL, ContentsURL2, MobileURL, UseYN, OrderByNum) VALUES
 (91011, 9101, 'B', 'A', 'https://www.hrdeedu.co.kr/contents/E2E/X01/01.mp4', NULL, 'https://www.hrdeedu.co.kr/contents/E2E/X01/01.mp4', 'Y', 1),
 (91021, 9102, 'B', 'A', 'https://www.hrdeedu.co.kr/contents/E2E/X01/02.mp4', NULL, 'https://www.hrdeedu.co.kr/contents/E2E/X01/02.mp4', 'Y', 1),
 (91031, 9103, 'B', 'A', 'https://www.hrdeedu.co.kr/contents/E2E/X01/03.mp4', NULL, 'https://www.hrdeedu.co.kr/contents/E2E/X01/03.mp4', 'Y', 1),
 (91041, 9104, 'B', 'A', 'https://www.hrdeedu.co.kr/contents/E2E/X01/04.mp4', NULL, 'https://www.hrdeedu.co.kr/contents/E2E/X01/04.mp4', 'Y', 1),
 (91111, 9111, 'B', 'A', 'E2E/Z01/01.mp4', NULL, 'E2E/Z01/01.mp4', 'Y', 1),
 (91121, 9112, 'B', 'A', 'E2E/Z01/02.mp4', NULL, 'E2E/Z01/02.mp4', 'Y', 1),
 (91211, 9121, 'B', 'A', '/contents/E2E/Y01/01.mp4', NULL, '/contents/E2E/Y01/01.mp4', 'Y', 1),
 (91311, 9131, 'A', 'A', '/contents/E2E/H01/001/01/index.html', NULL, NULL, 'Y', 1),
 (91411, 9141, 'B', 'A', 'E2E/R01/01.mp4', NULL, 'E2E/R01/01.mp4', 'Y', 1),
 (91511, 9151, 'B', 'A', 'E2E/X02/01.mp4', NULL, 'E2E/X02/01.mp4', 'Y', 1);
INSERT INTO Chapter (Seq, LectureCode, ChapterType, Sub_idx, OrderByNum, RegDate) VALUES
 (9201, 'E2EX01', 'A', '9101', 1, NOW()),
 (9202, 'E2EX01', 'A', '9102', 2, NOW()),
 (9203, 'E2EX01', 'A', '9103', 3, NOW()),
 (9204, 'E2EX01', 'A', '9104', 4, NOW()),
 (9211, 'E2EZ01', 'A', '9111', 1, NOW()),
 (9212, 'E2EZ01', 'A', '9112', 2, NOW()),
 (9221, 'E2EY01', 'A', '9121', 1, NOW()),
 (9231, 'E2EH01', 'A', '9131', 1, NOW()),
 (9241, 'E2ER01', 'A', '9141', 1, NOW()),
 (9251, 'E2EX02', 'A', '9151', 1, NOW());

-- ===== terms (ARC2026 package) =====
INSERT INTO LectureTerme (idx, LectureCode, LectureStart, LectureEnd, ServiceType, OpenYear, OpenTerme, OpenChapter) VALUES
 (9301, 'ARC2026', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 'A', 2026, 90, 1),
 (9302, 'ARC2026', DATE_SUB(CURDATE(), INTERVAL 120 DAY), DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'A', 2026, 91, 1),
 (9303, 'ARC2026', DATE_SUB(CURDATE(), INTERVAL 110 DAY), DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'A', 2026, 92, 1),
 (9304, 'ARC2026', DATE_ADD(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 95 DAY), 'A', 2026, 93, 1),
 (9305, 'ARC2026', DATE_SUB(CURDATE(), INTERVAL 15 DAY), DATE_ADD(CURDATE(), INTERVAL 75 DAY), 'W', 2026, 94, 1),
 (9306, 'ARC2026', DATE_SUB(CURDATE(), INTERVAL 87 DAY), DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'A', 2026, 95, 1);
--   9301 active (−20 … +70) · 9302 finished (−120 … −30) · 9303 expired (−110 … −20) · 9304 not started (+5 … +95) · 9305 비환급 W active (−15 … +75) · 9306 ending (−87 … +3)

-- ===== enrollments (Study.Seq 9401+, all on the ARC2026 package; ServiceType A = 환급, W = 비환급) =====
INSERT INTO Study (Seq, LectureTerme_idx, LectureCode, ServiceType, ID, CompanyCode, LectureStart, LectureEnd, Progress, OpenChapter, StudyIP, Survey, PassOK, Price, rPrice, rPrice2, StudyEnd, InputID, InputDate, StudyKey, PackageRef, SalesID) VALUES
 (9401, 9301, 'ARC2026', 'A', 'e2elearn01', '2208800001', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 99, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_e2elearn01', 1, 'sales01'),
 (9402, 9301, 'ARC2026', 'A', 'e2elearn15', '2208800001', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 100, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_e2elearn15', 1, 'sales01'),
 (9403, 9302, 'ARC2026', 'A', 'e2epass01', '2208800001', DATE_SUB(CURDATE(), INTERVAL 120 DAY), DATE_SUB(CURDATE(), INTERVAL 30 DAY), 100, 1, '127.0.0.1', 'N', 'Y', 300000, 270000, 30000, 'Y', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 123 DAY), '10:00:00'), '9302_e2epass01', 1, 'sales01'),
 (9404, 9306, 'ARC2026', 'A', 'e2epass02', '2208800001', DATE_SUB(CURDATE(), INTERVAL 87 DAY), DATE_ADD(CURDATE(), INTERVAL 3 DAY), 100, 1, '127.0.0.1', 'N', 'Y', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 90 DAY), '10:00:00'), '9306_e2epass02', 1, 'sales01'),
 (9405, 9303, 'ARC2026', 'A', 'e2eexp01', '2208800001', DATE_SUB(CURDATE(), INTERVAL 110 DAY), DATE_SUB(CURDATE(), INTERVAL 20 DAY), 33, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 113 DAY), '10:00:00'), '9303_e2eexp01', 1, 'sales01'),
 (9406, 9304, 'ARC2026', 'A', 'e2esoon01', '2208800001', DATE_ADD(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 95 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 2 DAY), '10:00:00'), '9304_e2esoon01', 1, 'sales01'),
 (9407, 9305, 'ARC2026', 'W', 'e2ewfree01', '2208800001', DATE_SUB(CURDATE(), INTERVAL 15 DAY), DATE_ADD(CURDATE(), INTERVAL 75 DAY), 21, 1, '127.0.0.1', 'N', 'N', 100000, 0, 100000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 18 DAY), '10:00:00'), '9305_e2ewfree01', 1, 'sales01'),
 (9408, 9301, 'ARC2026', 'A', 'e2epre01', '2208800001', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_e2epre01', 1, 'sales01'),
 (9409, 9301, 'ARC2026', 'A', 'e2etest02', '2208800001', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_e2etest02', 1, 'sales01'),
 (9410, 9301, 'ARC2026', 'A', 'e2egrant01', '2208800001', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 66, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_e2egrant01', 1, 'sales01'),
 (9411, 9301, 'ARC2026', 'A', 'e2enocert01', '2208800001', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_e2enocert01', 1, 'sales01'),
 (9412, 9301, 'ARC2026', 'A', 'e2eauth01', '2208800001', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 3, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_e2eauth01', 1, 'sales01'),
 (9413, 9301, 'ARC2026', 'A', 'e2ebco01', '2208800002', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 13, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_e2ebco01', 1, 'sales01'),
 (9414, 9302, 'ARC2026', 'A', 'e2ebco02', '2208800002', DATE_SUB(CURDATE(), INTERVAL 120 DAY), DATE_SUB(CURDATE(), INTERVAL 30 DAY), 100, 1, '127.0.0.1', 'N', 'Y', 300000, 270000, 30000, 'Y', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 123 DAY), '10:00:00'), '9302_e2ebco02', 1, 'sales01'),
 (9415, 9301, 'ARC2026', 'A', 'e2ecco01', '2208800003', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 6, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_e2ecco01', 1, 'sales01'),
 (9416, 9303, 'ARC2026', 'A', 'e2ecco02', '2208800003', DATE_SUB(CURDATE(), INTERVAL 110 DAY), DATE_SUB(CURDATE(), INTERVAL 20 DAY), 10, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 113 DAY), '10:00:00'), '9303_e2ecco02', 1, 'sales01');

-- ===== study time: Progress (one row per chapter, StudyTime ≤ min(LectureTime×60, 14400)) + ProgressLog (Start 0 → final), all on past days
--       so today's 8-hour count starts at 0. Totals per enrollment = Σ Progress.StudyTime (the 15-hour clock):
--   e2elearn01   Study 9401: 53940 s = 14h 59m → Study.Progress 99
--   e2elearn15   Study 9402: 54000 s = 15h 00m → Study.Progress 100
--   e2epass01    Study 9403: 54000 s = 15h 00m → Study.Progress 100
--   e2epass02    Study 9404: 54000 s = 15h 00m → Study.Progress 100
--   e2eexp01     Study 9405: 18000 s = 5h 00m → Study.Progress 33
--   e2ewfree01   Study 9407: 11400 s = 3h 10m → Study.Progress 21
--   e2egrant01   Study 9410: 36000 s = 10h 00m → Study.Progress 66
--   e2eauth01    Study 9412: 1800 s = 0h 30m → Study.Progress 3
--   e2ebco01     Study 9413: 7200 s = 2h 00m → Study.Progress 13
--   e2ebco02     Study 9414: 54000 s = 15h 00m → Study.Progress 100
--   e2ecco01     Study 9415: 3600 s = 1h 00m → Study.Progress 6
--   e2ecco02     Study 9416: 5400 s = 1h 30m → Study.Progress 10
--   (inserting Progress fires the local EMON trigger TR_AG_SCORE_HIST_V2 → TB_SCORE_HIST_V2 rows, as on the live DB)
INSERT INTO Progress (ID, LectureCode, Study_Seq, Chapter_Seq, Contents_idx, ContentsDetail_Seq, LastStudy, Progress, StudyTime, UserIP, RegDate, TriggerYN, Chapter_Number, FinishTime) VALUES
 ('e2elearn01', 'E2EX01', 9401, 9201, 9101, 91011, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 18 DAY), '18:00:00'), 'Y', '1', 0),
 ('e2elearn01', 'E2EX01', 9401, 9202, 9102, 91021, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 16 DAY), '18:00:00'), 'Y', '2', 0),
 ('e2elearn01', 'E2EX01', 9401, 9203, 9103, 91031, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 14 DAY), '18:00:00'), 'Y', '3', 0),
 ('e2elearn01', 'E2EX01', 9401, 9204, 9104, 91041, '30', 74, 10740, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 12 DAY), '18:00:00'), 'N', '4', 0),
 ('e2elearn15', 'E2EX01', 9402, 9201, 9101, 91011, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 18 DAY), '18:00:00'), 'Y', '1', 0),
 ('e2elearn15', 'E2EX01', 9402, 9202, 9102, 91021, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 16 DAY), '18:00:00'), 'Y', '2', 0),
 ('e2elearn15', 'E2EX01', 9402, 9203, 9103, 91031, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 14 DAY), '18:00:00'), 'Y', '3', 0),
 ('e2elearn15', 'E2EX01', 9402, 9204, 9104, 91041, '30', 75, 10800, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 12 DAY), '18:00:00'), 'N', '4', 0),
 ('e2epass01', 'E2EX01', 9403, 9201, 9101, 91011, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 118 DAY), '18:00:00'), 'Y', '1', 0),
 ('e2epass01', 'E2EX01', 9403, 9202, 9102, 91021, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 116 DAY), '18:00:00'), 'Y', '2', 0),
 ('e2epass01', 'E2EX01', 9403, 9203, 9103, 91031, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 114 DAY), '18:00:00'), 'Y', '3', 0),
 ('e2epass01', 'E2EX01', 9403, 9204, 9104, 91041, '30', 75, 10800, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 112 DAY), '18:00:00'), 'N', '4', 0),
 ('e2epass02', 'E2EX01', 9404, 9201, 9101, 91011, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 85 DAY), '18:00:00'), 'Y', '1', 0),
 ('e2epass02', 'E2EX01', 9404, 9202, 9102, 91021, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 83 DAY), '18:00:00'), 'Y', '2', 0),
 ('e2epass02', 'E2EX01', 9404, 9203, 9103, 91031, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 81 DAY), '18:00:00'), 'Y', '3', 0),
 ('e2epass02', 'E2EX01', 9404, 9204, 9104, 91041, '30', 75, 10800, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 79 DAY), '18:00:00'), 'N', '4', 0),
 ('e2eexp01', 'E2EX01', 9405, 9201, 9101, 91011, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 108 DAY), '18:00:00'), 'Y', '1', 0),
 ('e2eexp01', 'E2EX01', 9405, 9202, 9102, 91021, '30', 25, 3600, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 106 DAY), '18:00:00'), 'N', '2', 0),
 ('e2ewfree01', 'E2EX01', 9407, 9201, 9101, 91011, '30', 75, 10800, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 13 DAY), '18:00:00'), 'N', '1', 0),
 ('e2ewfree01', 'E2EZ01', 9407, 9211, 9111, 91111, '85', 100, 600, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 11 DAY), '18:00:00'), 'Y', '1', 0),
 ('e2egrant01', 'E2EX01', 9410, 9201, 9101, 91011, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 18 DAY), '18:00:00'), 'Y', '1', 0),
 ('e2egrant01', 'E2EX01', 9410, 9202, 9102, 91021, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 16 DAY), '18:00:00'), 'Y', '2', 0),
 ('e2egrant01', 'E2EX01', 9410, 9203, 9103, 91031, '30', 50, 7200, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 14 DAY), '18:00:00'), 'N', '3', 0),
 ('e2eauth01', 'E2EX01', 9412, 9201, 9101, 91011, '30', 12, 1800, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 18 DAY), '18:00:00'), 'N', '1', 0),
 ('e2ebco01', 'E2EX01', 9413, 9201, 9101, 91011, '30', 50, 7200, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 18 DAY), '18:00:00'), 'N', '1', 0),
 ('e2ebco02', 'E2EX01', 9414, 9201, 9101, 91011, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 118 DAY), '18:00:00'), 'Y', '1', 0),
 ('e2ebco02', 'E2EX01', 9414, 9202, 9102, 91021, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 116 DAY), '18:00:00'), 'Y', '2', 0),
 ('e2ebco02', 'E2EX01', 9414, 9203, 9103, 91031, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 114 DAY), '18:00:00'), 'Y', '3', 0),
 ('e2ebco02', 'E2EX01', 9414, 9204, 9104, 91041, '30', 75, 10800, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 112 DAY), '18:00:00'), 'N', '4', 0),
 ('e2ecco01', 'E2EX01', 9415, 9201, 9101, 91011, '30', 25, 3600, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 18 DAY), '18:00:00'), 'N', '1', 0),
 ('e2ecco02', 'E2EX01', 9416, 9201, 9101, 91011, '30', 37, 5400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 108 DAY), '18:00:00'), 'N', '1', 0);
INSERT INTO ProgressLog (ID, LectureCode, Study_Seq, Chapter_Seq, Contents_idx, ContentsDetail_Seq, LastStudy, Progress, StudyTime, UserIP, RegDate, TriggerYN, Chapter_Number, TotalProgress, PositionSec, FinishTime) VALUES
 ('e2elearn01', 'E2EX01', 9401, 9201, 9101, 91011, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '09:00:00'), 'N', '1', 0, 0, 0),
 ('e2elearn01', 'E2EX01', 9401, 9201, 9101, 91011, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 18 DAY), '18:00:00'), 'Y', '1', 26, 85, 0),
 ('e2elearn01', 'E2EX01', 9401, 9202, 9102, 91021, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 17 DAY), '09:00:00'), 'N', '2', 26, 0, 0),
 ('e2elearn01', 'E2EX01', 9401, 9202, 9102, 91021, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 16 DAY), '18:00:00'), 'Y', '2', 53, 85, 0),
 ('e2elearn01', 'E2EX01', 9401, 9203, 9103, 91031, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 15 DAY), '09:00:00'), 'N', '3', 53, 0, 0),
 ('e2elearn01', 'E2EX01', 9401, 9203, 9103, 91031, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 14 DAY), '18:00:00'), 'Y', '3', 80, 85, 0),
 ('e2elearn01', 'E2EX01', 9401, 9204, 9104, 91041, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 13 DAY), '09:00:00'), 'N', '4', 80, 0, 0),
 ('e2elearn01', 'E2EX01', 9401, 9204, 9104, 91041, '30', 74, 10740, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 12 DAY), '18:00:00'), 'N', '4', 99, 30, 0),
 ('e2elearn15', 'E2EX01', 9402, 9201, 9101, 91011, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '09:00:00'), 'N', '1', 0, 0, 0),
 ('e2elearn15', 'E2EX01', 9402, 9201, 9101, 91011, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 18 DAY), '18:00:00'), 'Y', '1', 26, 85, 0),
 ('e2elearn15', 'E2EX01', 9402, 9202, 9102, 91021, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 17 DAY), '09:00:00'), 'N', '2', 26, 0, 0),
 ('e2elearn15', 'E2EX01', 9402, 9202, 9102, 91021, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 16 DAY), '18:00:00'), 'Y', '2', 53, 85, 0),
 ('e2elearn15', 'E2EX01', 9402, 9203, 9103, 91031, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 15 DAY), '09:00:00'), 'N', '3', 53, 0, 0),
 ('e2elearn15', 'E2EX01', 9402, 9203, 9103, 91031, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 14 DAY), '18:00:00'), 'Y', '3', 80, 85, 0),
 ('e2elearn15', 'E2EX01', 9402, 9204, 9104, 91041, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 13 DAY), '09:00:00'), 'N', '4', 80, 0, 0),
 ('e2elearn15', 'E2EX01', 9402, 9204, 9104, 91041, '30', 75, 10800, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 12 DAY), '18:00:00'), 'N', '4', 100, 30, 0),
 ('e2epass01', 'E2EX01', 9403, 9201, 9101, 91011, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 119 DAY), '09:00:00'), 'N', '1', 0, 0, 0),
 ('e2epass01', 'E2EX01', 9403, 9201, 9101, 91011, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 118 DAY), '18:00:00'), 'Y', '1', 26, 85, 0),
 ('e2epass01', 'E2EX01', 9403, 9202, 9102, 91021, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 117 DAY), '09:00:00'), 'N', '2', 26, 0, 0),
 ('e2epass01', 'E2EX01', 9403, 9202, 9102, 91021, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 116 DAY), '18:00:00'), 'Y', '2', 53, 85, 0),
 ('e2epass01', 'E2EX01', 9403, 9203, 9103, 91031, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 115 DAY), '09:00:00'), 'N', '3', 53, 0, 0),
 ('e2epass01', 'E2EX01', 9403, 9203, 9103, 91031, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 114 DAY), '18:00:00'), 'Y', '3', 80, 85, 0),
 ('e2epass01', 'E2EX01', 9403, 9204, 9104, 91041, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 113 DAY), '09:00:00'), 'N', '4', 80, 0, 0),
 ('e2epass01', 'E2EX01', 9403, 9204, 9104, 91041, '30', 75, 10800, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 112 DAY), '18:00:00'), 'N', '4', 100, 30, 0),
 ('e2epass02', 'E2EX01', 9404, 9201, 9101, 91011, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 86 DAY), '09:00:00'), 'N', '1', 0, 0, 0),
 ('e2epass02', 'E2EX01', 9404, 9201, 9101, 91011, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 85 DAY), '18:00:00'), 'Y', '1', 26, 85, 0),
 ('e2epass02', 'E2EX01', 9404, 9202, 9102, 91021, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 84 DAY), '09:00:00'), 'N', '2', 26, 0, 0),
 ('e2epass02', 'E2EX01', 9404, 9202, 9102, 91021, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 83 DAY), '18:00:00'), 'Y', '2', 53, 85, 0),
 ('e2epass02', 'E2EX01', 9404, 9203, 9103, 91031, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 82 DAY), '09:00:00'), 'N', '3', 53, 0, 0),
 ('e2epass02', 'E2EX01', 9404, 9203, 9103, 91031, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 81 DAY), '18:00:00'), 'Y', '3', 80, 85, 0),
 ('e2epass02', 'E2EX01', 9404, 9204, 9104, 91041, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 80 DAY), '09:00:00'), 'N', '4', 80, 0, 0),
 ('e2epass02', 'E2EX01', 9404, 9204, 9104, 91041, '30', 75, 10800, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 79 DAY), '18:00:00'), 'N', '4', 100, 30, 0),
 ('e2eexp01', 'E2EX01', 9405, 9201, 9101, 91011, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 109 DAY), '09:00:00'), 'N', '1', 0, 0, 0),
 ('e2eexp01', 'E2EX01', 9405, 9201, 9101, 91011, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 108 DAY), '18:00:00'), 'Y', '1', 26, 85, 0),
 ('e2eexp01', 'E2EX01', 9405, 9202, 9102, 91021, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 107 DAY), '09:00:00'), 'N', '2', 26, 0, 0),
 ('e2eexp01', 'E2EX01', 9405, 9202, 9102, 91021, '30', 25, 3600, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 106 DAY), '18:00:00'), 'N', '2', 33, 30, 0),
 ('e2ewfree01', 'E2EX01', 9407, 9201, 9101, 91011, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 14 DAY), '09:00:00'), 'N', '1', 0, 0, 0),
 ('e2ewfree01', 'E2EX01', 9407, 9201, 9101, 91011, '30', 75, 10800, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 13 DAY), '18:00:00'), 'N', '1', 20, 30, 0),
 ('e2ewfree01', 'E2EZ01', 9407, 9211, 9111, 91111, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 12 DAY), '09:00:00'), 'N', '1', 20, 0, 0),
 ('e2ewfree01', 'E2EZ01', 9407, 9211, 9111, 91111, '85', 100, 600, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 11 DAY), '18:00:00'), 'Y', '1', 21, 85, 0),
 ('e2egrant01', 'E2EX01', 9410, 9201, 9101, 91011, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '09:00:00'), 'N', '1', 0, 0, 0),
 ('e2egrant01', 'E2EX01', 9410, 9201, 9101, 91011, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 18 DAY), '18:00:00'), 'Y', '1', 26, 85, 0),
 ('e2egrant01', 'E2EX01', 9410, 9202, 9102, 91021, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 17 DAY), '09:00:00'), 'N', '2', 26, 0, 0),
 ('e2egrant01', 'E2EX01', 9410, 9202, 9102, 91021, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 16 DAY), '18:00:00'), 'Y', '2', 53, 85, 0),
 ('e2egrant01', 'E2EX01', 9410, 9203, 9103, 91031, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 15 DAY), '09:00:00'), 'N', '3', 53, 0, 0),
 ('e2egrant01', 'E2EX01', 9410, 9203, 9103, 91031, '30', 50, 7200, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 14 DAY), '18:00:00'), 'N', '3', 66, 30, 0),
 ('e2eauth01', 'E2EX01', 9412, 9201, 9101, 91011, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '09:00:00'), 'N', '1', 0, 0, 0),
 ('e2eauth01', 'E2EX01', 9412, 9201, 9101, 91011, '30', 12, 1800, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 18 DAY), '18:00:00'), 'N', '1', 3, 30, 0),
 ('e2ebco01', 'E2EX01', 9413, 9201, 9101, 91011, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '09:00:00'), 'N', '1', 0, 0, 0),
 ('e2ebco01', 'E2EX01', 9413, 9201, 9101, 91011, '30', 50, 7200, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 18 DAY), '18:00:00'), 'N', '1', 13, 30, 0),
 ('e2ebco02', 'E2EX01', 9414, 9201, 9101, 91011, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 119 DAY), '09:00:00'), 'N', '1', 0, 0, 0),
 ('e2ebco02', 'E2EX01', 9414, 9201, 9101, 91011, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 118 DAY), '18:00:00'), 'Y', '1', 26, 85, 0),
 ('e2ebco02', 'E2EX01', 9414, 9202, 9102, 91021, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 117 DAY), '09:00:00'), 'N', '2', 26, 0, 0),
 ('e2ebco02', 'E2EX01', 9414, 9202, 9102, 91021, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 116 DAY), '18:00:00'), 'Y', '2', 53, 85, 0),
 ('e2ebco02', 'E2EX01', 9414, 9203, 9103, 91031, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 115 DAY), '09:00:00'), 'N', '3', 53, 0, 0),
 ('e2ebco02', 'E2EX01', 9414, 9203, 9103, 91031, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 114 DAY), '18:00:00'), 'Y', '3', 80, 85, 0),
 ('e2ebco02', 'E2EX01', 9414, 9204, 9104, 91041, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 113 DAY), '09:00:00'), 'N', '4', 80, 0, 0),
 ('e2ebco02', 'E2EX01', 9414, 9204, 9104, 91041, '30', 75, 10800, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 112 DAY), '18:00:00'), 'N', '4', 100, 30, 0),
 ('e2ecco01', 'E2EX01', 9415, 9201, 9101, 91011, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '09:00:00'), 'N', '1', 0, 0, 0),
 ('e2ecco01', 'E2EX01', 9415, 9201, 9101, 91011, '30', 25, 3600, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 18 DAY), '18:00:00'), 'N', '1', 6, 30, 0),
 ('e2ecco02', 'E2EX01', 9416, 9201, 9101, 91011, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 109 DAY), '09:00:00'), 'N', '1', 0, 0, 0),
 ('e2ecco02', 'E2EX01', 9416, 9201, 9101, 91011, '30', 37, 5400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 108 DAY), '18:00:00'), 'N', '1', 10, 30, 0);

-- ===== 사전/사후 역량진단 (exact Study_Seq scope). 사전 = profile (col1 W 실무자) + every B·step02 C/L and B·step03 W answer;
--       사후 = every A·step02 C/L + A·step03 W answer (총합 사후 ≥ 1) + 아카이브 향상도 (A·step01·A).
INSERT INTO ArchiveAbilityResult1 (ID, abilityType, abilityDepth, col1, col2, col3, col4, regDate, Study_Seq) VALUES
 ('e2elearn01', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 9401),
 ('e2elearn15', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 9402),
 ('e2epass01', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 119 DAY), '08:30:00'), 9403),
 ('e2epass02', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 86 DAY), '08:30:00'), 9404),
 ('e2eexp01', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 109 DAY), '08:30:00'), 9405),
 ('e2ewfree01', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 14 DAY), '08:30:00'), 9407),
 ('e2etest02', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 9409),
 ('e2egrant01', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 9410),
 ('e2enocert01', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 9411),
 ('e2eauth01', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 9412),
 ('e2ebco01', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 9413),
 ('e2ebco02', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 119 DAY), '08:30:00'), 9414),
 ('e2ecco01', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 9415),
 ('e2ecco02', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 109 DAY), '08:30:00'), 9416);
INSERT INTO ArchiveAbilityResult2 (ID, question_idx, aValue, regDate, col1, Study_Seq) VALUES
 ('e2elearn01', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9401),
 ('e2elearn01', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9401),
 ('e2elearn01', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9401),
 ('e2elearn01', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9401),
 ('e2elearn15', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9402),
 ('e2elearn15', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9402),
 ('e2elearn15', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9402),
 ('e2elearn15', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9402),
 ('e2epass01', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 119 DAY), '08:40:00'), NULL, 9403),
 ('e2epass01', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 119 DAY), '08:40:00'), NULL, 9403),
 ('e2epass01', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 119 DAY), '08:40:00'), NULL, 9403),
 ('e2epass01', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 119 DAY), '08:40:00'), NULL, 9403),
 ('e2epass01', 11, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 31 DAY), '17:00:00'), NULL, 9403),
 ('e2epass01', 12, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 31 DAY), '17:00:00'), NULL, 9403),
 ('e2epass01', 13, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 31 DAY), '17:00:00'), NULL, 9403),
 ('e2epass01', 14, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 31 DAY), '17:00:00'), NULL, 9403),
 ('e2epass01', 9031, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 31 DAY), '17:00:00'), NULL, 9403),
 ('e2epass01', 9032, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 31 DAY), '17:00:00'), NULL, 9403),
 ('e2epass01', 9033, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 31 DAY), '17:00:00'), NULL, 9403),
 ('e2epass02', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 86 DAY), '08:40:00'), NULL, 9404),
 ('e2epass02', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 86 DAY), '08:40:00'), NULL, 9404),
 ('e2epass02', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 86 DAY), '08:40:00'), NULL, 9404),
 ('e2epass02', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 86 DAY), '08:40:00'), NULL, 9404),
 ('e2epass02', 11, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:00:00'), NULL, 9404),
 ('e2epass02', 12, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:00:00'), NULL, 9404),
 ('e2epass02', 13, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:00:00'), NULL, 9404),
 ('e2epass02', 14, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:00:00'), NULL, 9404),
 ('e2epass02', 9031, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:00:00'), NULL, 9404),
 ('e2epass02', 9032, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:00:00'), NULL, 9404),
 ('e2epass02', 9033, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:00:00'), NULL, 9404),
 ('e2eexp01', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 109 DAY), '08:40:00'), NULL, 9405),
 ('e2eexp01', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 109 DAY), '08:40:00'), NULL, 9405),
 ('e2eexp01', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 109 DAY), '08:40:00'), NULL, 9405),
 ('e2eexp01', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 109 DAY), '08:40:00'), NULL, 9405),
 ('e2ewfree01', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 14 DAY), '08:40:00'), NULL, 9407),
 ('e2ewfree01', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 14 DAY), '08:40:00'), NULL, 9407),
 ('e2ewfree01', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 14 DAY), '08:40:00'), NULL, 9407),
 ('e2ewfree01', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 14 DAY), '08:40:00'), NULL, 9407),
 ('e2etest02', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9409),
 ('e2etest02', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9409),
 ('e2etest02', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9409),
 ('e2etest02', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9409),
 ('e2egrant01', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9410),
 ('e2egrant01', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9410),
 ('e2egrant01', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9410),
 ('e2egrant01', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9410),
 ('e2enocert01', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9411),
 ('e2enocert01', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9411),
 ('e2enocert01', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9411),
 ('e2enocert01', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9411),
 ('e2eauth01', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9412),
 ('e2eauth01', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9412),
 ('e2eauth01', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9412),
 ('e2eauth01', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9412),
 ('e2ebco01', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9413),
 ('e2ebco01', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9413),
 ('e2ebco01', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9413),
 ('e2ebco01', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9413),
 ('e2ebco02', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 119 DAY), '08:40:00'), NULL, 9414),
 ('e2ebco02', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 119 DAY), '08:40:00'), NULL, 9414),
 ('e2ebco02', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 119 DAY), '08:40:00'), NULL, 9414),
 ('e2ebco02', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 119 DAY), '08:40:00'), NULL, 9414),
 ('e2ebco02', 11, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 31 DAY), '17:00:00'), NULL, 9414),
 ('e2ebco02', 12, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 31 DAY), '17:00:00'), NULL, 9414),
 ('e2ebco02', 13, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 31 DAY), '17:00:00'), NULL, 9414),
 ('e2ebco02', 14, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 31 DAY), '17:00:00'), NULL, 9414),
 ('e2ebco02', 9031, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 31 DAY), '17:00:00'), NULL, 9414),
 ('e2ebco02', 9032, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 31 DAY), '17:00:00'), NULL, 9414),
 ('e2ebco02', 9033, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 31 DAY), '17:00:00'), NULL, 9414),
 ('e2ecco01', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9415),
 ('e2ecco01', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9415),
 ('e2ecco01', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9415),
 ('e2ecco01', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 9415),
 ('e2ecco02', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 109 DAY), '08:40:00'), NULL, 9416),
 ('e2ecco02', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 109 DAY), '08:40:00'), NULL, 9416),
 ('e2ecco02', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 109 DAY), '08:40:00'), NULL, 9416),
 ('e2ecco02', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 109 DAY), '08:40:00'), NULL, 9416);
INSERT INTO AssessmentAccessGrant (AdminID, OperatorName, OperatorPhoneEnc, OperatorPhoneMask, LearnerID, Study_Seq, AssessmentType, SessionLabel, Reason, RequestIP, GrantedAt, ExpiresAt, ConsumedAt, Status) VALUES
 ('admin01', '관리자', NULL, '010-****-0000', 'e2egrant01', 9410, 'POST', '', '[E2E] 사후진단 조기 응시 허용', '127.0.0.1', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), NULL, 'ACTIVE');

-- ===== 본인인증 (UserCertOTP, Seq 9501+): EvalCD 00 = 과정입과 cert, 01 = today's 학습 진행 cert (RegDate = seed time)
INSERT INTO UserCertOTP (Seq, ID, LectureCode, Study_Seq, CertDate, CertType, COURSE_AGENT_PK, CLASS_AGENT_PK, m_Ret, m_retCD, RegDate, UserIP, EvalCD, EvalType, ClassTime) VALUES
 (9501, 'e2elearn01', 'ARC2026', 9401, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 20 DAY), '08:55:00'), '127.0.0.1', '00', '00', '00'),
 (9502, 'e2elearn01', 'ARC2026', 9401, CURDATE(), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', NOW(), '127.0.0.1', '01', '01', '01'),
 (9503, 'e2elearn15', 'ARC2026', 9402, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 20 DAY), '08:55:00'), '127.0.0.1', '00', '00', '00'),
 (9504, 'e2elearn15', 'ARC2026', 9402, CURDATE(), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', NOW(), '127.0.0.1', '01', '01', '01'),
 (9505, 'e2epass01', 'ARC2026', 9403, DATE_SUB(CURDATE(), INTERVAL 120 DAY), 'm', 'ARC2026', 'ARC2026,9302', 'Y', '0000', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 120 DAY), '08:55:00'), '127.0.0.1', '00', '00', '00'),
 (9506, 'e2epass02', 'ARC2026', 9404, DATE_SUB(CURDATE(), INTERVAL 87 DAY), 'm', 'ARC2026', 'ARC2026,9306', 'Y', '0000', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 87 DAY), '08:55:00'), '127.0.0.1', '00', '00', '00'),
 (9507, 'e2epass02', 'ARC2026', 9404, CURDATE(), 'm', 'ARC2026', 'ARC2026,9306', 'Y', '0000', NOW(), '127.0.0.1', '01', '01', '01'),
 (9508, 'e2eexp01', 'ARC2026', 9405, DATE_SUB(CURDATE(), INTERVAL 110 DAY), 'm', 'ARC2026', 'ARC2026,9303', 'Y', '0000', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 110 DAY), '08:55:00'), '127.0.0.1', '00', '00', '00'),
 (9509, 'e2ewfree01', 'ARC2026', 9407, DATE_SUB(CURDATE(), INTERVAL 15 DAY), 'm', 'ARC2026', 'ARC2026,9305', 'Y', '0000', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 15 DAY), '08:55:00'), '127.0.0.1', '00', '00', '00'),
 (9510, 'e2ewfree01', 'ARC2026', 9407, CURDATE(), 'm', 'ARC2026', 'ARC2026,9305', 'Y', '0000', NOW(), '127.0.0.1', '01', '01', '01'),
 (9511, 'e2epre01', 'ARC2026', 9408, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 20 DAY), '08:55:00'), '127.0.0.1', '00', '00', '00'),
 (9512, 'e2epre01', 'ARC2026', 9408, CURDATE(), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', NOW(), '127.0.0.1', '01', '01', '01'),
 (9513, 'e2egrant01', 'ARC2026', 9410, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 20 DAY), '08:55:00'), '127.0.0.1', '00', '00', '00'),
 (9514, 'e2egrant01', 'ARC2026', 9410, CURDATE(), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', NOW(), '127.0.0.1', '01', '01', '01'),
 (9515, 'e2eauth01', 'ARC2026', 9412, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 20 DAY), '08:55:00'), '127.0.0.1', '00', '00', '00'),
 (9516, 'e2ebco01', 'ARC2026', 9413, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 20 DAY), '08:55:00'), '127.0.0.1', '00', '00', '00'),
 (9517, 'e2ebco01', 'ARC2026', 9413, CURDATE(), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', NOW(), '127.0.0.1', '01', '01', '01'),
 (9518, 'e2ebco02', 'ARC2026', 9414, DATE_SUB(CURDATE(), INTERVAL 120 DAY), 'm', 'ARC2026', 'ARC2026,9302', 'Y', '0000', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 120 DAY), '08:55:00'), '127.0.0.1', '00', '00', '00'),
 (9519, 'e2ecco01', 'ARC2026', 9415, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 20 DAY), '08:55:00'), '127.0.0.1', '00', '00', '00'),
 (9520, 'e2ecco01', 'ARC2026', 9415, CURDATE(), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', NOW(), '127.0.0.1', '01', '01', '01'),
 (9521, 'e2ecco02', 'ARC2026', 9416, DATE_SUB(CURDATE(), INTERVAL 110 DAY), 'm', 'ARC2026', 'ARC2026,9303', 'Y', '0000', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 110 DAY), '08:55:00'), '127.0.0.1', '00', '00', '00');

-- ===== reviews (Review.idx 9601+): visible, hidden (UseYN N), deleted (Del Y) =====
INSERT INTO Review (idx, LectureCode, ID, StarPoint, Title, Contents, IP, RegDate, UseYN, Del, ViewCount) VALUES
 (9601, 'E2EX01', 'e2epass01', 5, '[E2E] 실무에 바로 적용했어요', '피벗 차시가 특히 좋았습니다. 주간 보고를 데이터로 바꿨습니다.', '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 35 DAY), '12:00:00'), 'Y', 'N', 7),
 (9602, 'E2EX01', 'e2ebco02', 2, '[E2E] 숨김 처리된 후기', '관리자가 숨긴 후기입니다.', '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 34 DAY), '12:00:00'), 'N', 'N', 0),
 (9603, 'E2EZ01', 'e2elearn01', 4, '[E2E] 짧고 알찬 보고서 강의', '두괄식 구조를 바로 써먹었습니다.', '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 6 DAY), '12:00:00'), 'Y', 'N', 3),
 (9604, 'E2EY01', 'e2epass01', 1, '[E2E] 삭제된 후기', '삭제된 후기입니다.', '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '12:00:00'), 'Y', 'Y', 0);
INSERT INTO CourseLike (LectureCode, ID, RegDate) VALUES ('E2EX01', 'e2elearn01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 8 DAY), '10:00:00')), ('E2EH01', 'e2elearn01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '10:00:00'));

-- ===== 공지 / FAQ / 학습자료실 (attachments live in fixtures/media/upload/<Notice|StudyPDS>/) =====
INSERT INTO Notice (idx, UseYN, Notice, Title, Content, FileName1, RealFileName1, ViewCount, Del, RegDate) VALUES
 (9701, 'Y', 'Y', '[E2E] 학습 이용 안내', '<p>E2E 공지 본문입니다. 첨부된 학습안내서를 확인하세요.</p>', 'e2e_notice_guide.pdf', 'E2E_학습안내서.pdf', 12, 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '09:00:00')),
 (9702, 'Y', 'N', '[E2E] 10월 정기 점검 안내', '<p>정기 점검 시간에는 학습이 저장되지 않습니다.</p>', NULL, NULL, 3, 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '09:00:00')),
 (9703, 'N', 'N', '[E2E] 숨김 공지', '<p>노출되면 안 됩니다.</p>', NULL, NULL, 0, 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '10:00:00')),
 (9704, 'Y', 'N', '[E2E] 삭제된 공지', '<p>노출되면 안 됩니다.</p>', NULL, NULL, 0, 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '11:00:00'));
INSERT INTO Faq (idx, OrderByNum, Category, Title, Content, Del, RegDate, UseYN) VALUES
 (9721, 2, 'A', '[E2E] 수료 기준은 무엇인가요?', '<p>학습시간 15시간 이상과 사후역량진단 응시가 모두 필요합니다.</p>', 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 30 DAY), '09:00:00'), 'Y'),
 (9722, 3, 'B', '[E2E] 동영상이 재생되지 않아요', '<p>브라우저를 새로고침한 뒤 다시 시도하세요.</p>', 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 30 DAY), '09:00:00'), 'Y'),
 (9723, 4, 'C', '[E2E] 학습진도가 반영되지 않아요', '<p>학습창을 닫을 때 진도가 저장됩니다.</p>', 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 30 DAY), '09:00:00'), 'Y'),
 (9724, 5, 'D', '[E2E] 비밀번호를 잊어버렸어요', '<p>비밀번호 찾기를 이용하세요.</p>', 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 30 DAY), '09:00:00'), 'Y'),
 (9725, 6, 'E', '[E2E] 숨김 FAQ', '<p>노출되면 안 됩니다.</p>', 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 30 DAY), '09:00:00'), 'N');
INSERT INTO StudyPDS (idx, UseYN, Notice, Category, Title, Content, FileName1, RealFileName1, ViewCount, Del, RegDate) VALUES
 (9741, 'Y', 'N', 'A', '[E2E] 업무 보고서 워크북', '<p>보고서 작성 실습 워크북입니다.</p>', 'e2e_pds_workbook.pdf', 'E2E_보고서_워크북.pdf', 5, 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 12 DAY), '09:00:00')),
 (9742, 'Y', 'N', 'B', '[E2E] 데이터 분석 체크리스트', '<p>데이터 분석 전 확인할 항목입니다.</p>', 'e2e_pds_checklist.txt', 'E2E_체크리스트.txt', 2, 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 11 DAY), '09:00:00')),
 (9743, 'Y', 'Y', 'C', '[E2E] 리더십 자료 안내 (첨부 없음)', '<p>첨부 없는 자료 안내입니다.</p>', NULL, NULL, 1, 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 10 DAY), '09:00:00')),
 (9744, 'N', 'N', 'A', '[E2E] 숨김 자료', '<p>노출되면 안 됩니다.</p>', NULL, NULL, 0, 'N', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 9 DAY), '09:00:00'));

-- ===== popups (image in fixtures/media/upload/upload_popup/): one active (until +30 d), one expired yesterday =====
INSERT INTO Popup (idx, Title, ImgName, ImgWidth, ImgHeight, PopupLeft, PopupTop, EndDate, UseYN, RegDate) VALUES
 (9801, '[E2E] 신규 과정 오픈 안내', 'e2e_popup.png', '392', '403', '200', '50', DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 30 DAY), '%Y%m%d'), 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '09:00:00')),
 (9802, '[E2E] 지난 팝업', 'e2e_popup.png', '392', '403', '260', '80', DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '%Y%m%d'), 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 20 DAY), '09:00:00'));
INSERT INTO Popup_Link (num, idx, ImgArea, LinkURL) VALUES (9801, 9801, '0,0,392,403', '/catalog');

-- ===== 1:1 문의 (Counsel) and 아카이빙 (Archiving) =====
INSERT INTO Counsel (idx, ID, Name, Category, Mobile, Email, Title, Contents, RegDate, Name2, Contents2, RegDate2, FileName1, RealFileName1, Status, Del, ViewCount, LectureCode, Study_Seq, Contents_idx) VALUES
 (9901, 'e2elearn01', '김학습', 'A', HEX(AES_ENCRYPT('010-7712-1007', 'test-enc-key')), HEX(AES_ENCRYPT('e2elearn01@e2e.example', 'test-enc-key')), '[E2E] 3차시 실습 파일 문의', '실습 파일은 어디에서 받을 수 있나요?', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 4 DAY), '10:00:00'), '운영자', '<p>실습 파일은 학습자료실에 올려두었습니다.</p>', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '15:00:00'), 'e2e_counsel_capture.pdf', '화면캡처.pdf', 'B', 'N', 1, 'E2EX01', 9401, 9103),
 (9902, 'e2elearn01', '김학습', 'B', HEX(AES_ENCRYPT('010-7712-1007', 'test-enc-key')), HEX(AES_ENCRYPT('e2elearn01@e2e.example', 'test-enc-key')), '[E2E] 동영상 끊김 문의 (답변 대기)', '2차시 영상이 가끔 멈춥니다.', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '10:00:00'), NULL, NULL, NULL, NULL, NULL, 'A', 'N', 0, NULL, NULL, NULL),
 (9903, 'e2ecco01', '차타사', 'D', HEX(AES_ENCRYPT('010-7724-1021', 'test-enc-key')), HEX(AES_ENCRYPT('e2ecco01@e2e.example', 'test-enc-key')), '[E2E] 다른 학습자의 문의', '다른 학습자에게 보이면 안 됩니다.', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '10:00:00'), NULL, NULL, NULL, NULL, NULL, 'A', 'N', 0, NULL, NULL, NULL);
INSERT INTO Archiving (idx, ID, Title, Contents, RegDate, Name2, Contents2, RegDate2, FileName1, RealFileName1, Status, Del) VALUES
 (9951, 'e2elearn01', '[E2E] 현업 적용 사례: 주간 보고 자동화', '피벗과 차트로 주간 보고 시간을 절반으로 줄였습니다.', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '16:00:00'), NULL, NULL, NULL, 'e2e_archiving_note.pdf', '적용사례.pdf', 'A', 'N'),
 (9952, 'e2epass01', '[E2E] 수료 후 적용 사례 (답변 완료)', '데이터 리터러시 과정을 팀에 전파했습니다.', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 25 DAY), '16:00:00'), '운영자', '<p>좋은 사례 감사합니다.</p>', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 24 DAY), '10:00:00'), NULL, NULL, 'B', 'N');

