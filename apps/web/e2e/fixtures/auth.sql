-- 회원/인증 (auth) e2e additions — loaded after seed.sql (e2e/stack.mjs). Local throwaway DB only, synthetic people only.
-- Ids 20000–20999, learner IDs xauth*. They belong to their own company 2208820001 (no manager manages it, no enrollments), so
-- nothing here shows up in another area's lists or counts. Specs: e2e/auth/*.spec.ts (they reset what they change).
SET NAMES utf8;

INSERT INTO Company (idx, CompanyScale, CompanyCode, CompanyName, Ceo, Tel, EduManager, EduManagerPhone, SalesManager, RegDate, Del, SendSMS) VALUES
 (20000, 'C', '2208820001', 'E2E 인증상사', '정대표', '02-700-2000', NULL, NULL, 'sales01', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 300 DAY), '09:00:00'), 'N', 'Y');

-- Passwords (Member.Pwd = KISA SHA-256 of include_function.php Replace_Check_XSS2(password), the form login_ok.php / join_ok.php
-- hash; values computed with the PHP functions themselves):
--   1111                 → 0ffe1abd…150c (no change under Replace_Check_XSS2)
--   Ab'cd"ef\gh--ij1!    → posted  Ab\'cd\"ef\\ghij1!  → 39cc7b7f…5451
--   Hex-type-2026!       → posted  Hex2026!            → 64a55631…e58b
--   xauthq01  특수일   password Ab'cd"ef\gh--ij1!  (quote, double quote, backslash, --)
--   xauthq02  특수이   password Hex-type-2026!     ("type" and "--" dropped by Replace_Check_XSS2; "Hex" kept: str_replace is case-sensitive)
--   xauthpw01 변경일   PassChange=N (임시 비밀번호), no enrollment → 나중에 변경하기 goes home
--   xauthpw03 변경삼   normal password change from 회원정보 (EditDate) — reset by the spec
--   xauthprof01 정보일 회원정보 e-mail edit
--   xauthsess01 세션일 single session (two browsers)
--   xauthout01 퇴장일  logout
--   xauthlimit01 제한일 wrong-password limit
--   xauthfind01 찾기일  아이디/비밀번호 찾기 (mobile 010-7790-2001)
INSERT INTO Member (idx, MemberType, ID, Pwd, Name, BirthDay, Gender, Email, Mobile, CompanyCode, Depart, Position, Mandatory, Sending, Marketing, MemberOut, Sleep, UseYN, RegDate, EduManager, ResNo, TestID, ProtectID, PassChange) VALUES
 (20001, 'A', 'xauthq01', '39cc7b7fbe8b8866f61fa13a46b5d79f3a70c8a19dafc31f01ba11cbbec45451', '특수일', HEX(AES_ENCRYPT('1990-01-01', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('xauthq01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7790-1001', 'test-enc-key')), '2208820001', '인증팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (20002, 'A', 'xauthq02', '64a55631b057b920f8c42b0a9f38f0d7286135349343dd37de29d61b49a5e58b', '특수이', HEX(AES_ENCRYPT('1990-01-02', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('xauthq02@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7790-1002', 'test-enc-key')), '2208820001', '인증팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (20003, 'A', 'xauthpw01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '변경일', HEX(AES_ENCRYPT('1990-01-03', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('xauthpw01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7790-1003', 'test-enc-key')), '2208820001', '인증팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'N'),
 (20005, 'A', 'xauthpw03', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '변경삼', HEX(AES_ENCRYPT('1990-01-05', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('xauthpw03@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7790-1005', 'test-enc-key')), '2208820001', '인증팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (20006, 'A', 'xauthprof01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '정보일', HEX(AES_ENCRYPT('1990-01-06', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('xauthprof01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7790-1006', 'test-enc-key')), '2208820001', '인증팀', '대리', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (20007, 'A', 'xauthsess01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '세션일', HEX(AES_ENCRYPT('1990-01-07', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('xauthsess01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7790-1007', 'test-enc-key')), '2208820001', '인증팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (20008, 'A', 'xauthout01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '퇴장일', HEX(AES_ENCRYPT('1990-01-08', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('xauthout01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7790-1008', 'test-enc-key')), '2208820001', '인증팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (20009, 'A', 'xauthlimit01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '제한일', HEX(AES_ENCRYPT('1990-01-09', 'test-enc-key')), 'M', HEX(AES_ENCRYPT('xauthlimit01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7790-1009', 'test-enc-key')), '2208820001', '인증팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y'),
 (20010, 'A', 'xauthfind01', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', '찾기일', HEX(AES_ENCRYPT('1990-01-10', 'test-enc-key')), 'F', HEX(AES_ENCRYPT('xauthfind01@e2e.example', 'test-enc-key')), HEX(AES_ENCRYPT('010-7790-2001', 'test-enc-key')), '2208820001', '인증팀', '사원', 'Y', 'Y', 'N', 'N', 'N', 'Y', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 100 DAY), '10:00:00'), 'N', '', 'N', 'Y', 'Y');

-- 아이디 찾기 / 비밀번호 찾기 templates (SendMessage, MessageMode as search_id_result.php / search_pw_otp_send.php read them)
INSERT INTO SendMessage (idx, MessageMode, TemplateMessage, TemplateCode, RegDate) VALUES
 (20001, 'find_id', '[E2E] #{고객명}님의 아이디는 #{아이디} 입니다.', 'E2EFINDID', NOW()),
 (20002, 'pw_reset_otp', '[E2E] #{이름}님 비밀번호 찾기 인증번호 [#{인증번호}] (5분)', 'E2EPWOTP', NOW());
