/** Fails fast (with the fix in the message) when the e2e stack of E2E_RUN_DIR is not up and healthy. */
import { loadStack } from './stack';

export default async function globalSetup(): Promise<void> {
  const s = loadStack();
  const health = await fetch(`http://127.0.0.1:${s.apiPort}/health/ready`).then((r) => r.json() as Promise<{ status?: string; checks?: Record<string, unknown> }>).catch(() => null);
  if (health?.status !== 'ready') throw new Error(`e2e API on 127.0.0.1:${s.apiPort} is not ready (${JSON.stringify(health)}). Run: E2E_RUN_DIR=${s.runDir} node e2e/stack.mjs status / up`);
  if (health.checks?.writeMode !== 'full' || health.checks?.readOnlyDb !== false) throw new Error(`e2e API is not in full write mode: ${JSON.stringify(health.checks)}`);
  const web = await fetch(s.baseURL).then((r) => r.status).catch(() => 0);
  if (web !== 200) throw new Error(`e2e web ${s.baseURL} answered ${web}. Run: E2E_RUN_DIR=${s.runDir} node e2e/stack.mjs status / up`);
}
