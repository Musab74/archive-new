import { useSearchParams } from 'react-router-dom';
import { StateBlock } from '../../shared/ui/StateBlock';
import { safeNext } from '../../shared/auth/roles';
import { Button } from '../../shared/ui/Button';

/** 환급형 1일 1회 본인인증 entry (AR-20 08). The identity module (휴대폰/mOTP) is wired by the player slice; this screen keeps the return target. */
export default function DailyAuthPage() {
  const [sp] = useSearchParams();
  const next = safeNext(sp.get('next')) ?? '/home';
  return <StateBlock code="AUTH" page returnTo={next} actions={<><Button square size="sm" to={next}>선택한 콘텐츠로 돌아가기</Button><Button variant="secondary" square size="sm" to="/support/guide">고객지원</Button></>} />;
}
