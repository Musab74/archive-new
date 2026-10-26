import { SitePopups } from './SitePopups';
import { RubyWidget } from './chatbot/RubyWidget';
import { KobeWidget } from './chatbot/KobeWidget';
import { useChatbotGate } from './chatbot/useChatbotGate';

/** Site-wide layers of the old archive header (archive/include/header.html): popups, 러비 and 코비 when their rollout is on. */
export function SiteChrome() {
  const gate = useChatbotGate();
  return (
    <>
      <SitePopups />
      {gate.kobe ? <KobeWidget /> : null}
      {gate.ruby ? <RubyWidget /> : null}
    </>
  );
}
