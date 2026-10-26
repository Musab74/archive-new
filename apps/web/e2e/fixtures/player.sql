-- 학습창 (player) area fixtures — loaded after seed.sql (e2e/stack.mjs). Ids 22000–22999, learner IDs xplayer…; password 1111.
-- Every account below is on the ARC2026 package, term 9301 (active −20 … +70 d), own company 2208822000 (not A/B), 사전 done for its own Study_Seq
-- (ArchiveAbilityResult1 col1 W + answers 1–4), so the player opens. The specs reset their learner's Progress / ProgressLog /
-- PlayLock / Study.Progress·PassOK at the start of each test, so they are re-runnable on a used DB.
--   xplayer01  정타이머  video ticks (E2EX01): Start/Middle/End, credit, resume, 4 h cap, Chapter_Number = OrderByNum
--   xplayer02  정패키지  packaged lesson (E2EH01): LastStudy page, reopen, ArchivePlayerSeek → Seek, 학습요점 / 질문하기
--   xplayer03  정잠금    PlayLock: second tab, takeover, tab close, chapter switch
--   xplayer04  정여덟    8-hour daily gate (today's ProgressLog rows are inserted by the spec)
--   xplayer05  정테스트  TestID=Y twin of xplayer04 (exempt from the 8-hour gate and 본인인증; no UserCertOTP rows)
--   xplayer06  정수료    PassOK dual gate: 사후 done (answers 11–14 + 9031–9033); the spec builds 53,990 s
--   xplayer07  정미응    PassOK dual gate: no 사후; the spec builds 53,990 s → Study.Progress 100 but PassOK stays N
-- Own company for this area's learners, so the manager specs (companies A/B, e2emgr01) see only their own fixtures
INSERT INTO Company (idx, CompanyScale, CompanyCode, CompanyName, Ceo, Tel, EduManager, EduManagerPhone, SalesManager, RegDate, Del, SendSMS) VALUES
 (22900, 'C', '2208822000', 'E2E 학습창전용', '대표', '02-700-2900', NULL, NULL, 'sales01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 300 DAY), '09:00:00'), 'N', 'Y');

SET NAMES utf8;

INSERT INTO Member (idx, MemberType, ID, Pwd, Name, BirthDay, Gender, Email, Mobile, CompanyCode, Depart, Position, Mandatory, Sending, Marketing, MemberOut, Sleep, UseYN, RegDate, EduManager, ResNo, TestID, ProtectID, PassChange) VALUES
 (22001, 'A', 'xplayer01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '정타이머', HEX(AES_ENCRYPT('1990-01-01', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('xplayer01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7722-2001', 'test-enc-key')), '2208822000', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (22002, 'A', 'xplayer02', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '정패키지', HEX(AES_ENCRYPT('1990-01-02', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('xplayer02@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7722-2002', 'test-enc-key')), '2208822000', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (22003, 'A', 'xplayer03', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '정잠금', HEX(AES_ENCRYPT('1990-01-03', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('xplayer03@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7722-2003', 'test-enc-key')), '2208822000', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (22004, 'A', 'xplayer04', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '정여덟', HEX(AES_ENCRYPT('1990-01-04', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('xplayer04@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7722-2004', 'test-enc-key')), '2208822000', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (22005, 'A', 'xplayer05', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '정테스트', HEX(AES_ENCRYPT('1990-01-05', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('xplayer05@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7722-2005', 'test-enc-key')), '2208822000', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'Y', 'Y', 'Y'),
 (22006, 'A', 'xplayer06', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '정수료', HEX(AES_ENCRYPT('1990-01-06', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('xplayer06@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7722-2006', 'test-enc-key')), '2208822000', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (22007, 'A', 'xplayer07', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '정미응', HEX(AES_ENCRYPT('1990-01-07', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('xplayer07@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7722-2007', 'test-enc-key')), '2208822000', '데이터혁신팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y');
UPDATE Member SET MandatoryDate = RegDate WHERE idx BETWEEN 22001 AND 22999 AND Mandatory = 'Y';

INSERT INTO Study (Seq, LectureTerme_idx, LectureCode, ServiceType, ID, CompanyCode, LectureStart, LectureEnd, Progress, OpenChapter, StudyIP, Survey, PassOK, Price, rPrice, rPrice2, StudyEnd, InputID, InputDate, StudyKey, PackageRef, SalesID) VALUES
 (22101, 9301, 'ARC2026', 'A', 'xplayer01', '2208822000', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xplayer01', 1, 'sales01'),
 (22102, 9301, 'ARC2026', 'A', 'xplayer02', '2208822000', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xplayer02', 1, 'sales01'),
 (22103, 9301, 'ARC2026', 'A', 'xplayer03', '2208822000', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xplayer03', 1, 'sales01'),
 (22104, 9301, 'ARC2026', 'A', 'xplayer04', '2208822000', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xplayer04', 1, 'sales01'),
 (22105, 9301, 'ARC2026', 'A', 'xplayer05', '2208822000', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xplayer05', 1, 'sales01'),
 (22106, 9301, 'ARC2026', 'A', 'xplayer06', '2208822000', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xplayer06', 1, 'sales01'),
 (22107, 9301, 'ARC2026', 'A', 'xplayer07', '2208822000', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 70 DAY), 0, 1, '127.0.0.1', 'N', 'N', 300000, 270000, 30000, 'N', 'admin01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 23 DAY), '10:00:00'), '9301_xplayer07', 1, 'sales01');

-- 사전 done (exact Study_Seq): profile col1 W + every B·step02 C/L and B·step03 W answer of the base seed (questions 1–4)
INSERT INTO ArchiveAbilityResult1 (ID, abilityType, abilityDepth, col1, col2, col3, col4, regDate, Study_Seq) VALUES
 ('xplayer01', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 22101),
 ('xplayer02', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 22102),
 ('xplayer03', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 22103),
 ('xplayer04', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 22104),
 ('xplayer05', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 22105),
 ('xplayer06', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 22106),
 ('xplayer07', 'B', 'step03', 'W', '9001', '9004,9006', '9007', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:30:00'), 22107);
INSERT INTO ArchiveAbilityResult2 (ID, question_idx, aValue, regDate, col1, Study_Seq)
SELECT m.ID, q.idx, IF(q.idx IN (1, 3), '4', '3'), TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 19 DAY), '08:40:00'), NULL, s.Seq
  FROM Member m INNER JOIN Study s ON s.ID = m.ID AND s.Seq BETWEEN 22101 AND 22199
  INNER JOIN ArchiveQuestion q ON q.idx IN (1, 2, 3, 4)
 WHERE m.ID LIKE 'xplayer%';
-- xplayer06: 사후 done (A·step02 C/L 11–13, A·step03 W 14 → 총합 사후 ≥ 1) + 아카이브 향상도 9031–9033
INSERT INTO ArchiveAbilityResult2 (ID, question_idx, aValue, regDate, col1, Study_Seq) VALUES
 ('xplayer06', 11, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:00:00'), NULL, 22106),
 ('xplayer06', 12, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:00:00'), NULL, 22106),
 ('xplayer06', 13, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:00:00'), NULL, 22106),
 ('xplayer06', 14, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:00:00'), NULL, 22106),
 ('xplayer06', 9031, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:00:00'), NULL, 22106),
 ('xplayer06', 9032, '4', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:00:00'), NULL, 22106),
 ('xplayer06', 9033, '5', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:00:00'), NULL, 22106);

-- 본인인증: 입과 (00, term start) + today's 진도 (01, seed time) for everyone except the TestID twin xplayer05
INSERT INTO UserCertOTP (Seq, ID, LectureCode, Study_Seq, CertDate, CertType, COURSE_AGENT_PK, CLASS_AGENT_PK, m_Ret, m_retCD, RegDate, UserIP, EvalCD, EvalType, ClassTime)
SELECT 22500 + (s.Seq - 22100) * 2 - 1, s.ID, 'ARC2026', s.Seq, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 20 DAY), '08:55:00'), '127.0.0.1', '00', '00', '00'
  FROM Study s WHERE s.Seq BETWEEN 22101 AND 22199 AND s.ID <> 'xplayer05';
INSERT INTO UserCertOTP (Seq, ID, LectureCode, Study_Seq, CertDate, CertType, COURSE_AGENT_PK, CLASS_AGENT_PK, m_Ret, m_retCD, RegDate, UserIP, EvalCD, EvalType, ClassTime)
SELECT 22500 + (s.Seq - 22100) * 2, s.ID, 'ARC2026', s.Seq, CURDATE(), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', NOW(), '127.0.0.1', '01', '01', '01'
  FROM Study s WHERE s.Seq BETWEEN 22101 AND 22199 AND s.ID <> 'xplayer05';
