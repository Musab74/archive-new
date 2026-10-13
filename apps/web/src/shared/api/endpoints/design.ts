import { PublicDesignSchema, type PublicDesign } from '@ainex/contracts';
import { requestRaw } from '../client';

export interface DesignFetchResult { status: 'modified' | 'not-modified'; design?: PublicDesign; etag: string | null }

/** GET /public/design with If-None-Match. 304 → not-modified. */
export async function fetchPublicDesign(etag: string | null, signal?: AbortSignal): Promise<DesignFetchResult> {
  const { data, response } = await requestRaw<PublicDesign>('/public/design', {
    auth: false, noRefresh: true, signal, schema: PublicDesignSchema,
    headers: etag ? { 'If-None-Match': etag } : {},
  });
  if (response.status === 304 || data === undefined) return { status: 'not-modified', etag };
  return { status: 'modified', design: data, etag: response.headers.get('ETag') ?? data.etag ?? null };
}

/** GET /public/design/preview?token= — admin preview of an unpublished version. */
export async function fetchDesignPreview(token: string, signal?: AbortSignal): Promise<PublicDesign> {
  const { data } = await requestRaw<PublicDesign>('/public/design/preview', { auth: false, noRefresh: true, signal, query: { token }, schema: PublicDesignSchema });
  return data;
}

// ---------------------------------------------------------------------------------------------------------------------
// Admin Design Studio — /design/* (staff token, grant G1). Everything edits the draft; nothing is public until publish.
// ---------------------------------------------------------------------------------------------------------------------
import { z } from 'zod';
import { DesignVersionMetaSchema, MediaAssetSchema, type DesignConfig, type DesignVersionMeta, type MediaAsset } from '@ainex/contracts';
import { api } from '../client';
import {
  DesignAuditLineSchema, DesignDraftSchema, DesignPublishResultSchema, DesignVersionFileSchema, MediaPageSchema, OkSchema, PreviewTokenSchema, ThemePresetSchema,
  type DesignAuditLine, type DesignDraft, type DesignPublishResult, type DesignVersionFile, type MediaPage, type PreviewToken, type ThemePresetDto,
} from '../schemas';

export const designApi = {
  presets: (signal?: AbortSignal) => api.get<ThemePresetDto[]>('/design/presets', { schema: z.array(ThemePresetSchema), signal }),
  draft: (signal?: AbortSignal) => api.get<DesignDraft>('/design/draft', { schema: DesignDraftSchema, signal }),
  /** 409 CONFLICT when baseVersion is stale (another administrator saved first). */
  saveDraft: (config: DesignConfig, baseVersion: number) => api.put<DesignDraft>('/design/draft', { config, baseVersion }, { schema: DesignDraftSchema }),
  applyPreset: (presetId: string) => api.post<DesignDraft>(`/design/draft/apply-preset/${encodeURIComponent(presetId)}`, undefined, { schema: DesignDraftSchema }),
  previewToken: () => api.post<PreviewToken>('/design/preview-token', undefined, { schema: PreviewTokenSchema }),
  /** 400 VALIDATION with details.issues when contrast errors remain. */
  publish: (description?: string) => api.post<DesignPublishResult>('/design/publish', { description }, { schema: DesignPublishResultSchema }),
  versions: (signal?: AbortSignal) => api.get<DesignVersionMeta[]>('/design/versions', { schema: z.array(DesignVersionMetaSchema), signal }),
  version: (n: number, signal?: AbortSignal) => api.get<DesignVersionFile>(`/design/versions/${n}`, { schema: DesignVersionFileSchema, signal }),
  restore: (n: number) => api.post<DesignPublishResult>(`/design/versions/${n}/restore`, undefined, { schema: DesignPublishResultSchema }),
  audit: (limit = 100, signal?: AbortSignal) => api.get<DesignAuditLine[]>('/design/audit', { query: { limit }, schema: z.array(DesignAuditLineSchema), signal }),
  media: (page = 1, size = 48, signal?: AbortSignal) => api.get<MediaPage>('/design/media', { query: { page, size }, schema: MediaPageSchema, signal }),
  uploadMedia: (file: File, alt: string) => { const fd = new FormData(); fd.append('file', file); fd.append('alt', alt); return api.post<MediaAsset>('/design/media', fd, { schema: MediaAssetSchema }); },
  updateMediaAlt: (id: string, alt: string) => api.patch<MediaAsset>(`/design/media/${id}`, { alt }, { schema: MediaAssetSchema }),
  /** 409 CONFLICT when the image is still used by the draft or the live design. */
  deleteMedia: (id: string) => api.delete<{ ok: boolean }>(`/design/media/${id}`, { schema: OkSchema }),
};
