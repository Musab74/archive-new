-- e2e fixtures for the catalog area (home, catalog, content detail, AI ZONE). Loaded after seed.sql (stack.mjs up / reseed).
-- Ids 21000–21999, learner IDs xcatalog…; every password is 1111 (SHA-256 hex below). No visible course is added here, so the
-- catalogue counts of seed.sql (7 contents, 5 categories, 3 keywords) stay as the README states.

-- ===== learners (company A) =====
--   xcatalog01  카탈일  active ARC2026 (term 9301), 사전 done; MemberContents profile Keyword1 사원 / Keyword2 9051 (데이터분석)
--               → learning-home 추천 콘텐츠 reason "데이터분석 역량 강화를 위한 추천"
--   xcatalog02  카탈이  TWO active ARC2026 enrollments (terms 9301 + 9305), 사전 not done → 학습하기 is refused with
--               "현재 수강 차수의 사전역량진단을 먼저 완료해주세요." (enrollment_resolver ambiguity rule)
--   xcatalog03  카탈삼  active ARC2026 (term 9301), 사전 done, no MemberContents, no study history (rating refused, 403)
INSERT INTO Member (idx, MemberType, ID, Pwd, Name, BirthDay, Gender, Email, Mobile, CompanyCode, Depart, Position, Mandatory, Sending, Marketing, MemberOut, Sleep, UseYN, RegDate, EduManager, ResNo, TestID, ProtectID, PassChange) VALUES
 (21001, 'A', 'xcatalog01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '카탈일', HEX(AES_ENCRYPT('1990-01-21', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('xcatalog01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7721-2101', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (21002, 'A', 'xcatalog02', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '카탈이', HEX(AES_ENCRYPT('1990-02-21', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('xcatalog02@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7721-2102', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (21003, 'A', 'xcatalog03', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '카탈삼', HEX(AES_ENCRYPT('1990-03-21', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('xcatalog03@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7721-2103', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y');
UPDATE Member SET MandatoryDate = RegDate WHERE idx BETWEEN 21001 AND 21003;

INSERT INTO Study (Seq, LectureTerme_idx, LectureCode, ServiceType, ID, CompanyCode, LectureStart, LectureEnd, Progress, OpenChapter, StudyIP, Survey, PassOK, Price, rPrice, rPrice2, StudyEnd, InputID, InputDate, StudyKey, PackageRef, SalesID) VALUES
 (21101, 9301, 'ARC2026', 'A', 'xcatalog01', '2208800001', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xcatalog01', 1, 'sales01'),
 (21102, 9301, 'ARC2026', 'A', 'xcatalog02', '2208800001', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xcatalog02', 1, 'sales01'),
 (21103, 9305, 'ARC2026', 'W', 'xcatalog02', '2208800001', DATE_SUB(CURDATE(), INTERVAL 15 DAY), DATE_ADD(CURDATE(), INTERVAL 75 DAY), 0, 1, '127.0.0.1', 'N', 'N', 100000, 0, 100000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 18 DAY), '10:00:00'), '9305_xcatalog02', 1, 'sales01'),
 (21104, 9301, 'ARC2026', 'A', 'xcatalog03', '2208800001', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xcatalog03', 1, 'sales01');

-- 사전 done for xcatalog01 / xcatalog03 (same answer set as seed.sql's learners: profile + base questions 1–4)
INSERT INTO ArchiveAbilityResult1 (ID, abilityType, abilityDepth, col1, col2, col3, col4, regDate, Study_Seq) VALUES
 ('xcatalog01', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 21101),
 ('xcatalog03', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 21104);
INSERT INTO ArchiveAbilityResult2 (ID, question_idx, aValue, regDate, col1, Study_Seq) VALUES
 ('xcatalog01', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 21101), ('xcatalog01', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 21101),
 ('xcatalog01', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 21101), ('xcatalog01', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 21101),
 ('xcatalog03', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 21104), ('xcatalog03', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 21104),
 ('xcatalog03', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 21104), ('xcatalog03', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 21104);

-- learning-home profile (archive/include/top_header.html: Keyword1 난이도/직급, Keyword2 직무분야 = ContentsKeyword.idx)
INSERT INTO MemberContents (idx, ID, Keyword1, Keyword2, Keyword3, Keyword4) VALUES (21001, 'xcatalog01', '사원', '9051', '', '');

-- ===== operator lists (ContentsList gubun 1 PICK / 2 TOP10 / 3 NEW), OrderByNum deliberately not in idx order =====
-- PICK (base row D00001 OrderByNum 1): + E2EZ01 (2), E2EX01 (3)  → D00001, E2EZ01, E2EX01
-- TOP10: E2EY01 (1), E2EXDEL (2, deleted course → skipped), E2EX01 (3), E2EZ01 (4), E2EXOFF (5, hidden course → skipped), E2EH01 (6, list row Del Y → skipped)
-- NEW (base row D00002 OrderByNum 1): + E2EX02 (0) → E2EX02, D00002
INSERT INTO ContentsList (idx, gubun, LectureCode, OrderByNum, RegDate, UseYN, Del) VALUES
 (21001, '1', 'E2EX01', 3, NOW(), 'Y', 'N'), (21002, '1', 'E2EZ01', 2, NOW(), 'Y', 'N'),
 (21011, '2', 'E2EZ01', 4, NOW(), 'Y', 'N'), (21012, '2', 'E2EX01', 3, NOW(), 'Y', 'N'), (21013, '2', 'E2EXDEL', 2, NOW(), 'Y', 'N'), (21014, '2', 'E2EY01', 1, NOW(), 'Y', 'N'),
 (21015, '2', 'E2EXOFF', 5, NOW(), 'Y', 'N'), (21016, '2', 'E2EH01', 6, NOW(), 'Y', 'Y'),
 (21021, '3', 'E2EX02', 0, NOW(), 'Y', 'N');

-- ===== teacher profile (Teacher; linked to E2EZ01's ContentsDetail by the detail spec while it runs) =====
INSERT INTO Teacher (idx, Name, Photo, Profile, Del, RegDate) VALUES (21001, '이보고', NULL, '<p>[E2E] 보고서 코칭 12년, 기업 강의 300회</p>', 'N', NOW());

-- ===== study history for rating (AR-05: rating only on studied content): xcatalog01 watched E2EZ01 chapter 1 for 300 s =====
INSERT INTO Progress (ID, LectureCode, Study_Seq, Chapter_Seq, Contents_idx, ContentsDetail_Seq, LastStudy, Progress, StudyTime, UserIP, RegDate, TriggerYN, Chapter_Number, FinishTime) VALUES
 ('xcatalog01', 'E2EZ01', 21101, 9211, 9111, 91111, '30', 50, 300, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '18:00:00'), 'N', '1', 0);
INSERT INTO ProgressLog (ID, LectureCode, Study_Seq, Chapter_Seq, Contents_idx, ContentsDetail_Seq, LastStudy, Progress, StudyTime, UserIP, RegDate, TriggerYN, Chapter_Number, TotalProgress, PositionSec, FinishTime) VALUES
 ('xcatalog01', 'E2EZ01', 21101, 9211, 9111, 91111, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '17:55:00'), 'N', '1', 0, 0, 0),
 ('xcatalog01', 'E2EZ01', 21101, 9211, 9111, 91111, '30', 50, 300, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '18:00:00'), 'N', '1', 0, 30, 0);
