-- e2e fixtures for the 고객지원 area (support-center specs). Loaded after seed.sql (stack.mjs up / reseed).
-- Ids 26000–26999, learner IDs xsupport…; every password is 1111 (SHA-256 hex below).

-- ===== learners (company A) =====
--   xsupport01  서포일  active ARC2026 (term 9301), 사전 done; 실시간 강의실 (E2ER01, ctype R) enrolments: open / before / ended;
--               아카이빙 26001 (완료, file + answer) and 26002 (대기, file); writes 1:1 문의 / 아카이빙 / 학습자료 찜 in the specs
--   xsupport02  서포이  active ARC2026 (term 9301), no live enrolment; review ★4 on E2EH01
--   xsupport03  서포삼  active ARC2026 (term 9301); review ★1 on E2EH01 hidden by staff (UseYN N)
INSERT INTO Member (idx, MemberType, ID, Pwd, Name, BirthDay, Gender, Email, Mobile, CompanyCode, Depart, Position, Mandatory, Sending, Marketing, MemberOut, Sleep, UseYN, RegDate, EduManager, ResNo, TestID, ProtectID, PassChange) VALUES
 (26001, 'A', 'xsupport01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '서포일', HEX(AES_ENCRYPT('1991-01-26', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('xsupport01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7726-2601', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (26002, 'A', 'xsupport02', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '서포이', HEX(AES_ENCRYPT('1991-02-26', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('xsupport02@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7726-2602', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (26003, 'A', 'xsupport03', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '서포삼', HEX(AES_ENCRYPT('1991-03-26', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('xsupport03@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7726-2603', 'test-enc-key')), '2208800001', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y');
UPDATE Member SET MandatoryDate = RegDate WHERE idx BETWEEN 26001 AND 26003;

-- 실시간 강의실 terms on the live content E2ER01 (Course.ctype R): open (−5 … +25), not started (+10 … +40), ended (−60 … −30)
INSERT INTO LectureTerme (idx, LectureCode, LectureStart, LectureEnd, ServiceType, OpenYear, OpenTerme, OpenChapter) VALUES
 (26001, 'E2ER01', DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 25 DAY), 'R', 2026, 1, 1),
 (26002, 'E2ER01', DATE_ADD(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 40 DAY), 'R', 2026, 2, 1),
 (26003, 'E2ER01', DATE_SUB(CURDATE(), INTERVAL 60 DAY), DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'R', 2026, 3, 1);

INSERT INTO Study (Seq, LectureTerme_idx, LectureCode, ServiceType, ID, CompanyCode, LectureStart, LectureEnd, Progress, OpenChapter, StudyIP, Survey, PassOK, Price, rPrice, rPrice2, StudyEnd, InputID, InputDate, StudyKey, PackageRef, SalesID) VALUES
 (26101, 9301, 'ARC2026', 'A', 'xsupport01', '2208800001', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xsupport01', 1, 'sales01'),
 (26102, 26001, 'E2ER01', 'R', 'xsupport01', '2208800001', DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 25 DAY), 0, 1, '127.0.0.1', 'N', 'N', 0, 0, 0, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 6 DAY), '10:00:00'), '26001_xsupport01', 0, 'sales01'),
 (26103, 26002, 'E2ER01', 'R', 'xsupport01', '2208800001', DATE_ADD(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 40 DAY), 0, 1, '127.0.0.1', 'N', 'N', 0, 0, 0, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 6 DAY), '10:00:00'), '26002_xsupport01', 0, 'sales01'),
 (26104, 26003, 'E2ER01', 'R', 'xsupport01', '2208800001', DATE_SUB(CURDATE(), INTERVAL 60 DAY), DATE_SUB(CURDATE(), INTERVAL 30 DAY), 0, 1, '127.0.0.1', 'N', 'N', 0, 0, 0, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 61 DAY), '10:00:00'), '26003_xsupport01', 0, 'sales01'),
 (26105, 9301, 'ARC2026', 'A', 'xsupport02', '2208800001', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xsupport02', 1, 'sales01'),
 (26106, 9301, 'ARC2026', 'A', 'xsupport03', '2208800001', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xsupport03', 1, 'sales01');

INSERT INTO ArchiveAbilityResult1 (ID, abilityType, abilityDepth, col1, col2, col3, col4, regDate, Study_Seq) VALUES
 ('xsupport01', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 26101);
INSERT INTO ArchiveAbilityResult2 (ID, question_idx, aValue, regDate, col1, Study_Seq) VALUES
 ('xsupport01', 1, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 26101), ('xsupport01', 2, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 26101),
 ('xsupport01', 3, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 26101), ('xsupport01', 4, '3', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, 26101);

-- ===== 수강후기 on E2EH01 (no seed review): ★5 + ★4 visible → board average 4.5; ★1 hidden by staff must not count =====
INSERT INTO Review (idx, LectureCode, ID, StarPoint, Title, Contents, IP, RegDate, UseYN, Del, ViewCount) VALUES
 (26001, 'E2EH01', 'xsupport01', 5, '[E2E] 패키지 차시가 편해요', '차시 이동이 자연스럽습니다.', '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 4 DAY), '12:00:00'), 'Y', 'N', 2),
 (26002, 'E2EH01', 'xsupport02', 4, '[E2E] 짧아서 좋아요', '20분이면 끝납니다.', '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '12:00:00'), 'Y', 'N', 0),
 (26003, 'E2EH01', 'xsupport03', 1, '[E2E] 숨김 처리된 패키지 후기', '관리자가 숨긴 후기입니다.', '127.0.0.1', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '12:00:00'), 'N', 'N', 0);

-- ===== 아카이빙 (Archiving): 완료 with file + answer (downloadable) and 대기 with file (not downloadable yet) =====
INSERT INTO Archiving (idx, ID, Title, Contents, RegDate, Name2, Contents2, RegDate2, FileName1, RealFileName1, Status, Del) VALUES
 (26001, 'xsupport01', '[E2E] 완료된 아카이빙: 신입 온보딩 자료', '신입사원 온보딩 자료를 등록합니다.', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 9 DAY), '10:00:00'), '운영자', '<p>등록이 완료되었습니다.</p>', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 8 DAY), '10:00:00'), 'e2e_archiving_note.pdf', '온보딩자료.pdf', 'B', 'N'),
 (26002, 'xsupport01', '[E2E] 대기 중인 아카이빙: 안전교육 영상', '안전교육 영상을 등록 요청합니다.', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '10:00:00'), NULL, NULL, NULL, 'e2e_archiving_note.pdf', '안전교육.pdf', 'A', 'N');
