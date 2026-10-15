import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminRubyOpsApi, type RubyEmbeddingStatus, type RubyRegenerateResult } from '../../../../shared/api/endpoints/admin-ruby-ops';
import { AButton, AdminPage, ASelect, Callout, Card, DataTable, DescList, Kpi, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { statusTone } from './RubyFaqPage';
import { RubyGate } from './rubyAccess';

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

/** ruby_embeddings.php — stored embedding state + 재생성 실행 (POST target all|faq|kb → "임베딩 재생성 완료: FAQ n건, KB m건"). */
function RubyEmbeddingsPageInner() {
  const { canWrite, readOnlyTitle } = useWriteGate();
  const q = useQuery({ queryKey: ['admin', 'ruby', 'embeddings'], queryFn: ({ signal }) => adminRubyOpsApi.embeddingStatus(signal) });
  const [target, setTarget] = useState<'all' | 'faq' | 'kb'>('all');
  const [result, setResult] = useState<RubyRegenerateResult | null>(null);
  const regen = useAdminMutation({ fn: (t: 'all' | 'faq' | 'kb') => adminRubyOpsApi.regenerateEmbeddings(t), invalidate: [['admin', 'ruby', 'embeddings']], onSuccess: (r) => setResult(r) });
  const d = q.data;
  return (
    <AdminPage title={tr('Ruby 임베딩 재생성', 'Ruby embeddings')} lead={tr('FAQ·지식베이스(draft·published)의 RAG 임베딩을 다시 만듭니다. OpenAI text-embedding-3-small 을 쓰고, 키가 없거나 실패하면 ruby-hash-128 벡터를 저장합니다(기존 화면과 동일).', 'Rebuilds the RAG embeddings of draft/published FAQ and knowledge-base rows with OpenAI text-embedding-3-small, or the ruby-hash-128 vector without a key / on failure (same as the legacy page).')}>
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
              {result ? <Callout tone={result.ok ? 'ok' : 'warn'} className="u-mt-8">{result.updated ? tr(`임베딩 재생성 완료: FAQ ${result.updated.faq}건, KB ${result.updated.kb}건`, `Embeddings rebuilt: FAQ ${result.updated.faq}, KB ${result.updated.kb}`) : (result.message ?? result.code)} <span className="muted">({tr('대상', 'candidates')}: FAQ {result.candidates.faq}, KB {result.candidates.kb})</span></Callout> : null}
              {d.openAiConfigured === false ? <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>{tr('OPENAI_API_KEY 가 없어 ruby-hash-128 벡터로 저장됩니다.', 'No OPENAI_API_KEY: the ruby-hash-128 vector is stored.')}</p> : null}
            </Card>
            <Card title={tr('임베딩 모델별 KB 건수', 'KB rows per embedding model')}>
              <DescList items={d.kb.models.length ? d.kb.models.map((m) => [m.model ?? tr('(모델 없음)', '(no model)'), m.count] as [string, number]) : [[tr('임베딩 없음', 'No embeddings'), '—']]} />
              {d.faq.embeddingColumns
                ? <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>{tr(`FAQ 임베딩 보유 ${d.faq.embedded}건`, `FAQ rows with an embedding: ${d.faq.embedded}`)}{d.faq.models.length ? ` · ${d.faq.models.map((m) => `${m.model ?? '-'} ${m.count}`).join(', ')}` : ''}{d.faq.lastUpdatedAt ? ` · ${tr('최근', 'last')} ${d.faq.lastUpdatedAt}` : ''}</p>
                : <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>{tr('RubyFaq 표에 임베딩 컬럼(embedding_json 등)이 없어 FAQ 임베딩은 저장되지 않습니다(기존 화면도 0건으로 처리).', 'RubyFaq has no embedding columns, so FAQ embeddings are not stored (the legacy page counted 0 too).')}</p>}
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

export default function RubyEmbeddingsPage() {
  return <RubyGate><RubyEmbeddingsPageInner /></RubyGate>;
}
