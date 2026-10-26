-- 역량진단 (assessment) area fixtures — loaded after seed.sql (e2e/stack.mjs). Ids 23000–23999, learner IDs xassess…; password 1111.
-- The specs reset what they write (ArchiveAbilityResult1/2 rows, Member.Ability*, Study.PassOK, grant status) at the start of each test.
--   xassess01  사전진   active (term 9301), 사전 not done → the 3-step 사전 form, then the player opens
--   xassess02  사후진   active, exactly 54,000 s, 사전 done (answers 1→4, 2→3, 3→4, 4→3), 사후 not done → 사후 form, PassOK refresh, result
--   xassess03  회고진   closed 비환급 W enrollment 23103 (term 9302, StudyEnd Y, 54,000 s, PassOK N, 사전 done) with an admin POST grant,
--                       plus an active enrollment 23104 (사전 done) → retro 사후 for the closed W row (refreshClosedWPassOk)
-- Extra question 23001: a second 사후 공통 question with the same text as question 11 ('의사소통') — the 사후 score groups rows by
-- question text and takes the MAX (include_ability_data.php SQLC, study_completion_lib.php:107-131).
SET NAMES utf8;

INSERT INTO ArchiveQuestion (idx, aType, aDepth, aGroup, aOrder, aBind, aValue, aValueDetail, regDate) VALUES
 (23001, 'A', 'step02', 'C', 3, 'B', '의사소통', '사후 (같은 문항 텍스트, E2E)', NOW());

INSERT INTO Member (idx, MemberType, ID, Pwd, Name, BirthDay, Gender, Email, Mobile, CompanyCode, Depart, Position, Mandatory, Sending, Marketing, MemberOut, Sleep, UseYN, RegDate, EduManager, ResNo, TestID, ProtectID, PassChange, AbilityYN, AbilityAfterYN) VALUES
 (23001, 'A', 'xassess01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '사전진', HEX(AES_ENCRYPT('1991-02-01', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('xassess01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7723-3001', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y', 'N', 'N'),
 (23002, 'A', 'xassess02', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '사후진', HEX(AES_ENCRYPT('1991-02-02', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('xassess02@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7723-3002', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y', 'Y', 'N'),
 (23003, 'A', 'xassess03', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '회고진', HEX(AES_ENCRYPT('1991-02-03', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('xassess03@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7723-3003', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 200 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y', 'Y', 'N');
UPDATE Member SET MandatoryDate = RegDate WHERE idx BETWEEN 23001 AND 23999 AND Mandatory = 'Y';

INSERT INTO Study (Seq, LectureTerme_idx, LectureCode, ServiceType, ID, CompanyCode, LectureStart, LectureEnd, Progress, OpenChapter, StudyIP, Survey, PassOK, Price, rPrice, rPrice2, StudyEnd, InputID, InputDate, StudyKey, PackageRef, SalesID) VALUES
 (23101, 9301, 'ARC2026', 'A', 'xassess01', '2208800001', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xassess01', 1, 'sales01'),
 (23102, 9301, 'ARC2026', 'A', 'xassess02', '2208800001', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 100, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xassess02', 1, 'sales01'),
 (23103, 9302, 'ARC2026', 'W', 'xassess03', '2208800001', DATE_SUB(CURDATE(), INTERVAL 120 DAY), DATE_SUB(CURDATE(), INTERVAL 30 DAY), 100, 1, '127.0.0.1', 'N', 'N', 100000, 0, 100000, 'Y', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 123 DAY), '10:00:00'), '9302_xassess03', 1, 'sales01'),
 (23104, 9301, 'ARC2026', 'A', 'xassess03', '2208800001', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xassess03', 1, 'sales01');

-- 54,000 s (15 h) on 23102 and 23103: chapters 1–3 full (14,400) + chapter 4 at 10,800 (75 %), past days
INSERT INTO Progress (ID, LectureCode, Study_Seq, Chapter_Seq, Contents_idx, ContentsDetail_Seq, LastStudy, Progress, StudyTime, UserIP, RegDate, TriggerYN, Chapter_Number)
SELECT s.ID, 'E2EX01', s.Seq, ch.Seq, c.idx, cd.Seq, '85', IF(ch.OrderByNum = 4, 75, 100), IF(ch.OrderByNum = 4, 10800, 14400), '127.0.0.1',
       TIMESTAMP(DATE_SUB(s.LectureStart, INTERVAL -ch.OrderByNum DAY), '18:00:00'), 'N', ch.OrderByNum
  FROM Study s INNER JOIN Chapter ch ON ch.LectureCode = 'E2EX01' INNER JOIN Contents c ON c.idx = ch.Sub_idx INNER JOIN ContentsDetail cd ON cd.Contents_idx = c.idx
 WHERE s.Seq IN (23102, 23103);

-- 사전 done (profile col1 W + answers to 1–4) on 23102, 23103, 23104
INSERT INTO ArchiveAbilityResult1 (ID, abilityType, abilityDepth, col1, col2, col3, col4, regDate, Study_Seq) VALUES
 ('xassess02', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 23102),
 ('xassess03', 'B', 'step03', 'W', '9002', '9005', '9008', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 119 DAY), '08:30:00'), 23103),
 ('xassess03', 'B', 'step03', 'W', '9002', '9005', '9008', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 23104);
INSERT INTO ArchiveAbilityResult2 (ID, question_idx, aValue, regDate, col1, Study_Seq)
SELECT s.ID, q.idx, IF(q.idx IN (1, 3), '4', '3'), TIMESTAMP(DATE_ADD(s.LectureStart, INTERVAL 1 DAY), '08:40:00'), NULL, s.Seq
  FROM Study s INNER JOIN ArchiveQuestion q ON q.idx IN (1, 2, 3, 4)
 WHERE s.Seq IN (23102, 23103, 23104);

-- admin POST grant for the closed W enrollment of xassess03
INSERT INTO AssessmentAccessGrant (AdminID, OperatorName, OperatorPhoneEnc, OperatorPhoneMask, LearnerID, Study_Seq, AssessmentType, SessionLabel, Reason, RequestIP, GrantedAt, ExpiresAt, ConsumedAt, Status) VALUES
 ('admin01', '관리자', NULL, '010-****-0000', 'xassess03', 23103, 'POST', '', '[E2E] 1차 수강 사후진단 개방', '127.0.0.1', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), NULL, 'ACTIVE');

-- 본인인증 00 + today's 01 (the player opens right after the 사전 form)
INSERT INTO UserCertOTP (Seq, ID, LectureCode, Study_Seq, CertDate, CertType, COURSE_AGENT_PK, CLASS_AGENT_PK, m_Ret, m_retCD, RegDate, UserIP, EvalCD, EvalType, ClassTime) VALUES
 (23501, 'xassess01', 'ARC2026', 23101, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 20 DAY), '08:55:00'), '127.0.0.1', '00', '00', '00'),
 (23502, 'xassess01', 'ARC2026', 23101, CURDATE(), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', NOW(), '127.0.0.1', '01', '01', '01');

-- 수강후기 of xassess02 (my reviews list / edit / delete; the spec restores it before each run)
INSERT INTO Review (idx, LectureCode, ID, StarPoint, Title, Contents, IP, RegDate, UseYN, Del, ViewCount) VALUES
 (23601, 'E2EX01', 'xassess02', 3, '[E2E] 수정 전 후기', '수정 전 본문입니다.', '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '12:00:00'), 'Y', 'N', 2);
