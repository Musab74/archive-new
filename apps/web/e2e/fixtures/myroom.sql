-- 나의학습실 e2e additions (ids 24000–24999, learner IDs xmyroom…). Loaded after seed.sql by e2e/stack.mjs. Password 1111.
-- Both learners belong to company C (E2E 타사상사) so e2emgr01's A+B figures stay as documented in e2e/README.md; they are extra
-- C-company rows the manager specs also expect to be invisible.
--   xmyroom01  나보정  company C  two ARC2026 환급 enrollments: 24401 ended (term 9302, StudyEnd Y, PassOK N, 7 contents, 15,835 s)
--                                 + 24402 active (term 9301, 6 contents / 9 chapters, 25,561 s) → 13 학습기록 rows (2 pages of 10),
--                                 carry-over 1차 수강 time on the home, odd seconds everywhere (3599 s must show 59분, 99 % never 100),
--                                 a pending 학습시간 재계산 notice (5,400 s) and an 출석 체크 row (Stage 20, StageCount 4).
--   xmyroom02  두찜    company C  no enrollment (empty states); 아카이빙 24951 Status B with a file (download allowed), 24952 Del Y.
--   CourseLike rows for the bulk 찜 removal are prepared by the spec itself (myroom/saved.spec.ts), not here.
SET NAMES utf8;

INSERT INTO Member (idx, MemberType, ID, Pwd, Name, BirthDay, Gender, Email, Mobile, CompanyCode, Depart, Position, Mandatory, Sending, Marketing, MemberOut, Sleep, UseYN, RegDate, EduManager, ResNo, TestID, ProtectID, PassChange) VALUES
 (24001, 'A', 'xmyroom01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '나보정', HEX(AES_ENCRYPT('1990-05-05', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('xmyroom01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7724-0001', 'test-enc-key')), '2208800003', '총무팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 150 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (24002, 'A', 'xmyroom02', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '두찜', HEX(AES_ENCRYPT('1991-06-06', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('xmyroom02@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7724-0002', 'test-enc-key')), '2208800003', '총무팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 150 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y');
UPDATE Member SET MandatoryDate = RegDate WHERE idx IN (24001, 24002);

INSERT INTO Study (Seq, LectureTerme_idx, LectureCode, ServiceType, ID, CompanyCode, LectureStart, LectureEnd, Progress, OpenChapter, StudyIP, Survey, PassOK, Price, rPrice, rPrice2, StudyEnd, InputID, InputDate, StudyKey, PackageRef, SalesID) VALUES
 (24401, 9302, 'ARC2026', 'A', 'xmyroom01', '2208800003', DATE_SUB(CURDATE(), INTERVAL 120 DAY), DATE_SUB(CURDATE(), INTERVAL 30 DAY), 29, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'Y', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 123 DAY), '10:00:00'), '9302_xmyroom01', 1, 'sales01'),
 (24402, 9301, 'ARC2026', 'A', 'xmyroom01', '2208800003', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 47, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xmyroom01', 1, 'sales01');

-- 24401 (ended): 1799 + 1201 + 7259 + 599 + 179 + 1199 + 3599 = 15,835 s; chapter % floored (99, never 100)
-- 24402 (active): 14400 + 7261 + 1800 + 901 + 59 + 600 + 299 + 180 + 61 = 25,561 s = 7시간 06분 (Study.Progress 47)
INSERT INTO Progress (ID, LectureCode, Study_Seq, Chapter_Seq, Contents_idx, ContentsDetail_Seq, LastStudy, Progress, StudyTime, UserIP, RegDate, TriggerYN, Chapter_Number, FinishTime) VALUES
 ('xmyroom01', 'D00001', 24401, 1001, 11, 111, '30', 99, 1799, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '18:00:00'), 'N', '1', 0),
 ('xmyroom01', 'D00002', 24401, 2001, 21, 211, '30', 66, 1201, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 95 DAY), '18:00:00'), 'N', '1', 0),
 ('xmyroom01', 'E2EX01', 24401, 9201, 9101, 91011, '30', 50, 7259, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 90 DAY), '18:00:00'), 'N', '1', 0),
 ('xmyroom01', 'E2EZ01', 24401, 9211, 9111, 91111, '30', 99, 599, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 85 DAY), '18:00:00'), 'N', '1', 0),
 ('xmyroom01', 'E2EY01', 24401, 9221, 9121, 91211, '30', 99, 179, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 80 DAY), '18:00:00'), 'N', '1', 0),
 ('xmyroom01', 'E2EH01', 24401, 9231, 9131, 91311, '30', 99, 1199, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 75 DAY), '18:00:00'), 'N', '1', 0),
 ('xmyroom01', 'E2ER01', 24401, 9241, 9141, 91411, '30', 99, 3599, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 70 DAY), '18:00:00'), 'N', '1', 0),
 ('xmyroom01', 'E2EX01', 24402, 9201, 9101, 91011, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '18:00:00'), 'Y', '1', 0),
 ('xmyroom01', 'E2EX01', 24402, 9202, 9102, 91021, '30', 50, 7261, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 17 DAY), '18:00:00'), 'N', '2', 0),
 ('xmyroom01', 'D00001', 24402, 1001, 11, 111, '85', 100, 1800, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 15 DAY), '18:00:00'), 'Y', '1', 0),
 ('xmyroom01', 'D00001', 24402, 1002, 12, 121, '30', 50, 901, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 13 DAY), '18:00:00'), 'N', '2', 0),
 ('xmyroom01', 'D00002', 24402, 2001, 21, 211, '30', 3, 59, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 11 DAY), '18:00:00'), 'N', '1', 0),
 ('xmyroom01', 'E2EZ01', 24402, 9211, 9111, 91111, '85', 100, 600, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 9 DAY), '18:00:00'), 'Y', '1', 0),
 ('xmyroom01', 'E2EZ01', 24402, 9212, 9112, 91121, '30', 49, 299, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 7 DAY), '18:00:00'), 'N', '2', 0),
 ('xmyroom01', 'E2EY01', 24402, 9221, 9121, 91211, '85', 100, 180, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '18:00:00'), 'Y', '1', 0),
 ('xmyroom01', 'E2EH01', 24402, 9231, 9131, 91311, '30', 5, 61, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '18:00:00'), 'N', '1', 0);
-- ProgressLog: Start 0 → final on the same (past) day for the active enrollment
INSERT INTO ProgressLog (ID, LectureCode, Study_Seq, Chapter_Seq, Contents_idx, ContentsDetail_Seq, LastStudy, Progress, StudyTime, UserIP, RegDate, TriggerYN, Chapter_Number, TotalProgress, PositionSec, FinishTime) VALUES
 ('xmyroom01', 'E2EX01', 24402, 9201, 9101, 91011, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '09:00:00'), 'N', '1', 0, 0, 0),
 ('xmyroom01', 'E2EX01', 24402, 9201, 9101, 91011, '85', 100, 14400, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '18:00:00'), 'Y', '1', 26, 85, 0),
 ('xmyroom01', 'E2EX01', 24402, 9202, 9102, 91021, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 17 DAY), '09:00:00'), 'N', '2', 26, 0, 0),
 ('xmyroom01', 'E2EX01', 24402, 9202, 9102, 91021, '30', 50, 7261, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 17 DAY), '18:00:00'), 'N', '2', 40, 30, 0),
 ('xmyroom01', 'E2EY01', 24402, 9221, 9121, 91211, 'blank', 0, 0, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '09:00:00'), 'N', '1', 40, 0, 0),
 ('xmyroom01', 'E2EY01', 24402, 9221, 9121, 91211, '85', 100, 180, '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '09:03:00'), 'Y', '1', 47, 85, 0);

-- 사전 done for the active enrollment (profile + answers 1–4, like the base fixtures), 사후 not done
INSERT INTO ArchiveAbilityResult1 (ID, abilityType, abilityDepth, col1, col2, col3, col4, regDate, Study_Seq) VALUES
 ('xmyroom01', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 24402);
INSERT INTO ArchiveAbilityResult2 (ID, question_idx, aValue, regDate, col1, Study_Seq) VALUES
 ('xmyroom01', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 24402),
 ('xmyroom01', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 24402),
 ('xmyroom01', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 24402),
 ('xmyroom01', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 24402);

-- 학습시간 재계산 안내 (sections/correction-notice-popup.php): pending, 1시간 30분 (PHP hrde_mark_correction_notice stores old − new > 0)
INSERT INTO StudyCorrectionNotice (ID, total_delta_sec, applied_at, acknowledged_at, ack_ip) VALUES
 ('xmyroom01', 5400, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '03:00:00'), NULL, NULL);

-- 출석 체크 (lecture_event.html): Stage 20, 4 stamps
INSERT INTO LectureEvent (idx, ID, Stage, StageCount, Status, RegDate, StatusRegDate, StatusName) VALUES
 (24001, 'xmyroom01', 20, 4, 'A', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '09:00:00'), NULL, NULL);

-- 아카이빙: approved row with a file (download allowed) and a deleted row (never listed)
INSERT INTO Archiving (idx, ID, Title, Contents, RegDate, Name2, Contents2, RegDate2, FileName1, RealFileName1, Status, Del) VALUES
 (24951, 'xmyroom02', '[E2E] 승인된 사내 교육자료', '사내 엑셀 교육 영상을 등록합니다.', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 6 DAY), '11:00:00'), '운영자', '<p>승인되었습니다. 업로드 절차를 안내드립니다.</p>', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '10:00:00'), 'e2e_archiving_note.pdf', '승인자료.pdf', 'B', 'N'),
 (24952, 'xmyroom02', '[E2E] 삭제된 아카이빙', '노출되면 안 됩니다.', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 4 DAY), '11:00:00'), NULL, NULL, NULL, NULL, NULL, 'A', 'Y');
