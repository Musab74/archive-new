import { AButton, AdminPage, Callout, Card, DescList } from '../../../../shared/ui/admin';
import { Icon } from '../../../../shared/ui/Icon';
import { tr } from '../../../../shared/i18n/adminLang';
import { legacyUrl } from '../../../../shared/auth/adminMenu';
import { GrantGate } from '../../GrantGate';

const LIVE_INSTRUCTOR_URL = 'https://live.hrdeedu.co.kr/instructor';

/**
 * live_class.php (+ live_class_search_result.php) — 실시간 강의 관리 (dept C, grant L1).
 * Every list on the PHP page comes from MongoDB `HrdeLive` (meetings / members) which the API does not connect to;
 * there is no MariaDB table behind it. This screen keeps the menu usable: it explains the state and opens the live platform
 * and the legacy page in a new tab.
 */
export default function LiveClassPage() {
  return <GrantGate grant="L1"><LiveClass /></GrantGate>;
}

function LiveClass() {
  const legacy = legacyUrl('live_class.php');
  return (
    <AdminPage title={tr('실시간 강의 관리', 'Live class management')} lead={tr('실시간/예정 강의를 관리하고 참여할 수 있습니다.', 'Manage and join live / scheduled classes.')}
      actions={<><AButton variant="primary" onClick={() => window.open(LIVE_INSTRUCTOR_URL, '_blank', 'noopener')}><Icon name="video" size={16} />{tr('실시간 강의 생성', 'Create live class')}</AButton><AButton onClick={() => window.open(legacy, '_blank', 'noopener')}><Icon name="external" size={16} />{tr('기존 관리자 페이지에서 열기', 'Open in the legacy admin')}</AButton></>}>
      <Callout tone="warn">
        {tr('강의 목록(진행중/예정/종료), 접속 회원, Excel 내보내기는 라이브 플랫폼의 MongoDB(HrdeLive: meetings, participants, members)에서 읽습니다. 새 API는 hrdeArchive(MariaDB)만 연결되어 있어 이 화면의 목록은 아직 옮겨지지 않았습니다. 아래 링크의 기존 화면에서 그대로 사용하세요.', 'The class list (live / scheduled / ended), connected members and the Excel export are read from the live platform\'s MongoDB (HrdeLive: meetings, participants, members). The new API only connects to hrdeArchive (MariaDB), so these lists are not ported yet. Use the legacy screen below.')}
      </Callout>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginTop: 12 }}>
        <Card title={tr('기존 화면의 기능', 'What the legacy screen does')}>
          <DescList items={[
            [tr('강의 목록', 'Class list'), tr('상태(진행중 LIVE/STARTED · 예정 SCHEDULED · 종료 ENDED) 필터, 강의실명/초대코드 검색, 최근 생성순 100건', 'Status filter (LIVE/STARTED · SCHEDULED · ENDED), title / invite-code search, latest 100')],
            [tr('열', 'Columns'), '번호 · 상태 · 강의실명 · 초대코드 · 강사 · 예정 시간 · 시작 시간 · 참여/기간'],
            [tr('첨삭강사(C) 로그인', 'Tutor (dept C)'), tr('본인이 호스트인 강의만 표시, 접속 회원 탭 숨김', 'Only meetings hosted by the tutor; the members tab is hidden')],
            [tr('입장하기', 'Join'), <a key="j" href="https://live.hrdeedu.co.kr/room/" target="_blank" rel="noopener noreferrer">live.hrdeedu.co.kr/room/&lt;초대코드&gt;</a>],
            [tr('연결 주소', 'Target'), <a key="l" href={legacy} target="_blank" rel="noopener noreferrer" className="mono">{legacy}</a>],
          ]} />
        </Card>
        <Card title={tr('새 콘솔에서 할 수 있는 것', 'Available in this console')}>
          <DescList items={[
            [tr('실시간 강의실 컨텐츠', 'Live-classroom courses'), <a key="c" href="/admin/live-courses">{tr('아카이브 › 실시간 강의실 관리 (Course ctype=R)', 'Archive › Live classrooms (Course ctype=R)')}</a>],
            [tr('강의 생성', 'Create a class'), <a key="i" href={LIVE_INSTRUCTOR_URL} target="_blank" rel="noopener noreferrer">{LIVE_INSTRUCTOR_URL}</a>],
          ]} />
        </Card>
      </div>
    </AdminPage>
  );
}
