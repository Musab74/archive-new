import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminRubyOpsApi, type RubyEmbeddingStatus, type RubyRegenerateResult } from '../../../../shared/api/endpoints/admin-ruby-ops';
import { AButton, AdminPage, ASelect, Callout, Card, DataTable, DescList, Kpi, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { legacyUrl } from '../../../../shared/auth/adminMenu';
import { statusTone } from './RubyFaqPage';

type Recent = RubyEmbeddingStatus['recentKb'][number];
const cols: Column<Recent>[] = [
  { key: 'id', header: 'ID', align: 'right', width: 60 },
  { key: 'type', header: tr('유형', 'Type'), nowrap: true },
  { key: 'title', header: tr('제목', 'Title'), render: (r) => <b>{r.title}</b> },
  { key: 'status', header: tr('상태', 'Status'), align: 'center', render: (r) => <StatusBadge tone={statusTone(r.status)}>{r.status}</StatusBadge> },
  { key: 'embeddingModel', header: tr('임베딩 모델', 'Embedding model'), nowrap: true, render: (r) => r.embeddingModel ?? <span className="muted">{tr('없음', 'none')}</span> },
  { key: 'embeddingUpdatedAt', header: tr('임베딩 갱신', 'Embedded at'), nowrap: true, render: (r) => r.embeddingUpdatedAt ?? '' },
  { key: 'updatedAt', header: tr('수정일', 'Updated'), nowrap: true, render: (r) => r.updatedAt ?? '' },
];
const fmt = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(' · ') || '0';

/** ruby_embeddings.php — stored embedding state + the 재생성 action (currently answered by the API with EMBEDDING_NOT_CONFIGURED). */
export default function RubyEmbeddingsPage() {
  const { canWrite, readOnlyTitle } = useWriteGate();
  const q = useQuery({ queryKey: ['admin', 'ruby', 'embeddings'], queryFn: ({ signal }) => adminRubyOpsApi.embeddingStatus(signal) });
  const [target, setTarget] = useState<'all' | 'faq' | 'kb'>('all');
  const [result, setResult] = useState<RubyRegenerateResult | null>(null);
  const regen = useAdminMutation({ fn: (t: 'all' | 'faq' | 'kb') => adminRubyOpsApi.regenerateEmbeddings(t), invalidate: [['admin', 'ruby', 'embeddings']], onSuccess: (r) => setResult(r) });
  const d = q.data;
  return (
    <AdminPage title={tr('Ruby 임베딩 재생성', 'Ruby embeddings')} lead={tr('FAQ·지식베이스의 RAG 임베딩 현황입니다. 기존 화면의 "재생성 실행"은 OpenAI 임베딩을 만들어 embedding_json에 저장했습니다.', 'RAG embedding state of the FAQ and knowledge base. The legacy "regenerate" built OpenAI embeddings into embedding_json.')}>
      <Callout tone="warn" className="u-mb-8">{tr('임베딩 재생성은 아직 새 API에 연결되지 않았습니다(임베딩 생성기 미구현). 실행이 필요하면 기존 관리자 화면에서 하세요: ', 'Regeneration is not wired to the new API yet (no embedding generator). Run it from the legacy admin page: ')}<a href={legacyUrl('ruby_embeddings.php')} target="_blank" rel="noreferrer">ruby_embeddings.php</a></Callout>
      {d ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
            <Kpi label={tr('FAQ 대상(draft+published)', 'FAQ candidates')} value={d.faq.candidates} hint={fmt(d.faq.byStatus)} />
            <Kpi label={tr('KB 대상(draft+published)', 'KB candidates')} value={d.kb.candidates} hint={fmt(d.kb.byStatus)} />
            <Kpi label={tr('KB 임베딩 보유', 'KB embedded')} value={d.kb.embedded} tone={d.kb.candidates && d.kb.embedded < d.kb.candidates ? 'warn' : 'ok'} hint={d.kb.lastUpdatedAt ? `${tr('최근', 'last')} ${d.kb.lastUpdatedAt}` : undefined} />
            <Kpi label={tr('벡터 청크', 'Vector chunks')} value={d.vectorTables.chunks} hint={d.vectorTables.chunksUpdatedAt ?? undefined} />
            <Kpi label={tr('벡터 임베딩', 'Vector embeddings')} value={d.vectorTables.embeddings} hint={d.vectorTables.embeddingsUpdatedAt ?? undefined} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, alignItems: 'start', marginBottom: 14 }}>
            <Card title={tr('재생성 실행', 'Regenerate')}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <ASelect aria-label={tr('대상', 'Target')} value={target} onChange={(e) => setTarget(e.target.value as 'all' | 'faq' | 'kb')} options={[{ value: 'all', label: tr('FAQ + KB 전체', 'FAQ + KB') }, { value: 'faq', label: tr('FAQ만', 'FAQ only') }, { value: 'kb', label: tr('KB만', 'KB only') }]} />
                <AButton variant="primary" loading={regen.isPending} disabled={!canWrite} title={readOnlyTitle} onClick={() => regen.mutate(target)}>{tr('재생성 실행', 'Regenerate')}</AButton>
              </div>
              {result ? <Callout tone={result.ok ? 'ok' : 'warn'} className="u-mt-8">{result.ok ? tr(`임베딩 재생성 완료: FAQ ${result.candidates.faq}건, KB ${result.candidates.kb}건`, `Done: FAQ ${result.candidates.faq}, KB ${result.candidates.kb}`) : `${result.message ?? result.code} (${tr('대상', 'candidates')}: FAQ ${result.candidates.faq}, KB ${result.candidates.kb})`}</Callout> : null}
            </Card>
            <Card title={tr('임베딩 모델별 KB 건수', 'KB rows per embedding model')}>
              <DescList items={d.kb.models.length ? d.kb.models.map((m) => [m.model ?? tr('(모델 없음)', '(no model)'), m.count] as [string, number]) : [[tr('임베딩 없음', 'No embeddings'), '—']]} />
              <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>{tr('RubyFaq 표에는 임베딩 컬럼이 없어(스키마 계약) 상태 건수만 표시합니다.', 'RubyFaq has no embedding columns in the schema contract, so only status counts are shown for FAQ.')}</p>
            </Card>
          </div>
          <Card title={tr('최근 수정된 지식베이스 20건', 'Recently updated KB rows')}>
            <DataTable columns={cols} rows={d.recentKb} rowKey={(r) => r.id} dense />
          </Card>
        </>
      ) : <DataTable columns={cols} rows={undefined} rowKey={(r) => r.id} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} />}
    </AdminPage>
  );
}
