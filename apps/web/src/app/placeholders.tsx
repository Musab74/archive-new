import { useParams } from 'react-router-dom';
import { StateBlock } from '../shared/ui/StateBlock';
import { placeholderNote, placeholders } from '../shared/strings/ko';

/** Simple placeholder other developers will replace: renders an EMPTY state with the screen name. */
export function makePlaceholder(key: keyof typeof placeholders, suffix?: string) {
  const name = `${placeholders[key]}${suffix ? ` · ${suffix}` : ''}`;
  return function PlaceholderPage() {
    const params = useParams();
    const detail = Object.values(params).filter(Boolean).join(' / ');
    return <StateBlock code="EMPTY" page kicker={name} title={placeholderNote(name)} body={detail ? `요청 경로: ${detail}` : undefined} />;
  };
}

export const LearnerHomePlaceholder = makePlaceholder('home');
export const PlayerPlaceholder = makePlaceholder('learn');
export const AssessmentPlaceholder = makePlaceholder('assessment');
export const RoadmapPlaceholder = makePlaceholder('roadmap');
export const MyRoomPlaceholder = makePlaceholder('my');
export const LivePlaceholder = makePlaceholder('live');
export const SurveysPlaceholder = makePlaceholder('surveys');
export const ManagerPlaceholder = makePlaceholder('manager');
export const AdminPlaceholder = makePlaceholder('admin');

export function NotFoundPage() { return <StateBlock code="NOT_FOUND" page />; }
