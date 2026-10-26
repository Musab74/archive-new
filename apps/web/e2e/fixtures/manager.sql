-- 교육담당자 e2e additions (ids 25000–25999, learner IDs xmanager…). Loaded after seed.sql by e2e/stack.mjs. Password 1111.
--   xmanager01  구분초  company B (managed by e2emgr01 through MemberCompany)  환급 active on term 9301, Study 25401,
--               odd stored seconds so every manager figure must be floored, never rounded up:
--               E2EX01 ch1 3,599 s (24 %), ch2 7,259 s (50 %), E2EY01 ch1 179 s (99 %) → 11,037 s = 03시간 03분, 20 %;
--               one ProgressLog pair per day (3,599 s / 7,259 s / 179 s on −4 / −3 / −2 days) for the daily table.
--   e2emgr01 therefore manages 15 enrollments (12 A + 3 B) instead of the 14 in e2e/README.md; the manager specs read the expected
--   counts from the DB.
--   The 1,000-learner report cap rows are created and removed by manager/reports.spec.ts itself (Study.Seq 25000–25399, 25500–25999).
SET NAMES utf8;

INSERT INTO Member (idx, MemberType, ID, Pwd, Name, BirthDay, Gender, Email, Mobile, CompanyCode, Depart, Position, Mandatory, Sending, Marketing, MemberOut, Sleep, UseYN, RegDate, EduManager, ResNo, TestID, ProtectID, PassChange) VALUES
 (25001, 'A', 'xmanager01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '구분초', HEX(AES_ENCRYPT('1992-12-12', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('xmanager01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7725-0001', 'test-enc-key')), '2208800002', '기술지원팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 150 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y');
UPDATE Member SET MandatoryDate = RegDate WHERE idx = 25001;

INSERT INTO Study (Seq, LectureTerme_idx, LectureCode, ServiceType, ID, CompanyCode, LectureStart, LectureEnd, Progress, OpenChapter, StudyIP, Survey, PassOK, Price, rPrice, rPrice2, StudyEnd, InputID, InputDate, StudyKey, PackageRef, SalesID) VALUES
 (25401, 9301, 'ARC2026', 'A', 'xmanager01', '2208800002', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 20, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xmanager01', 1, 'sales01');

INSERT INTO Progress (ID, LectureCode, Study_Seq, Chapter_Seq, Contents_idx, ContentsDetail_Seq, LastStudy, Progress, StudyTime, UserIP, RegDate, TriggerYN, Chapter_Number, FinishTime) VALUES
 ('xmanager01', 'E2EX01', 25401, 9201, 9101, 91011, '30', 24, 3599, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 4 DAY), '10:00:00'), 'N', '1', 0),
 ('xmanager01', 'E2EX01', 25401, 9202, 9102, 91021, '30', 50, 7259, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '11:01:00'), 'N', '2', 0),
 ('xmanager01', 'E2EY01', 25401, 9221, 9121, 91211, '30', 99, 179, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '09:03:00'), 'N', '1', 0);
INSERT INTO ProgressLog (ID, LectureCode, Study_Seq, Chapter_Seq, Contents_idx, ContentsDetail_Seq, LastStudy, Progress, StudyTime, UserIP, RegDate, TriggerYN, Chapter_Number, TotalProgress, PositionSec, FinishTime) VALUES
 ('xmanager01', 'E2EX01', 25401, 9201, 9101, 91011, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 4 DAY), '09:00:00'), 'N', '1', 0, 0, 0),
 ('xmanager01', 'E2EX01', 25401, 9201, 9101, 91011, '30', 24, 3599, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 4 DAY), '10:00:00'), 'N', '1', 6, 30, 0),
 ('xmanager01', 'E2EX01', 25401, 9202, 9102, 91021, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '09:00:00'), 'N', '2', 6, 0, 0),
 ('xmanager01', 'E2EX01', 25401, 9202, 9102, 91021, '30', 50, 7259, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '11:01:00'), 'N', '2', 20, 30, 0),
 ('xmanager01', 'E2EY01', 25401, 9221, 9121, 91211, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '09:00:00'), 'N', '1', 20, 0, 0),
 ('xmanager01', 'E2EY01', 25401, 9221, 9121, 91211, '30', 99, 179, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '09:03:00'), 'N', '1', 20, 30, 0);

-- 사전 done for 25401 (profile + answers 1–4), 사후 not done → 역량진단 보기 shows the 사전 area scores only
INSERT INTO ArchiveAbilityResult1 (ID, abilityType, abilityDepth, col1, col2, col3, col4, regDate, Study_Seq) VALUES
 ('xmanager01', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 25401);
INSERT INTO ArchiveAbilityResult2 (ID, question_idx, aValue, regDate, col1, Study_Seq) VALUES
 ('xmanager01', 1, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 25401),
 ('xmanager01', 2, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 25401),
 ('xmanager01', 3, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 25401),
 ('xmanager01', 4, '2', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 25401);
