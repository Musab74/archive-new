import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { adminSiteCmsApi } from '../../../../shared/api/endpoints/admin-site-cms';
import { isAppError } from '../../../../shared/api/client';
import { tr } from '../../../../shared/i18n/adminLang';
import { cx } from '../../../../shared/utils/format';
import { htmlToPlainText, plainTextToHtml } from './siteCms.helpers';
import styles from './SiteCmsHtmlEditor.module.css';

type Mode = 'editor' | 'html' | 'text';

export interface SiteCmsHtmlEditorProps {
  id: string;
  /** Accessible name of the editing surface (the field label). */
  label: string;
  /** HTML stored in the column (Archiving.Contents2, StudyPDS.Content, ...). */
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  height?: number;
  /**
   * SmartEditor2 사진 첨부 (photo_uploader → file_uploader.php): stores the image under /upload/webedit/<Ym>/ and returns the
   * <img> tag to insert. Defaults to POST /admin/site-cms/editor-photo; pass null to hide the button.
   */
  uploadPhoto?: ((file: File) => Promise<{ html: string }>) | null;
}

interface Tool { cmd: string; arg?: string; label: string; title: string }
const INLINE: Tool[] = [
  { cmd: 'bold', label: 'B', title: tr('굵게', 'Bold') },
  { cmd: 'italic', label: 'I', title: tr('기울임꼴', 'Italic') },
  { cmd: 'underline', label: 'U', title: tr('밑줄', 'Underline') },
  { cmd: 'strikeThrough', label: 'S', title: tr('취소선', 'Strikethrough') },
];
const BLOCK: Tool[] = [
  { cmd: 'justifyLeft', label: '≡⇤', title: tr('왼쪽 정렬', 'Align left') },
  { cmd: 'justifyCenter', label: '≡', title: tr('가운데 정렬', 'Center') },
  { cmd: 'justifyRight', label: '⇥≡', title: tr('오른쪽 정렬', 'Align right') },
  { cmd: 'justifyFull', label: '☰', title: tr('양쪽 정렬', 'Justify') },
  { cmd: 'insertOrderedList', label: '1.', title: tr('번호 매기기', 'Numbered list') },
  { cmd: 'insertUnorderedList', label: '•', title: tr('글머리 기호', 'Bulleted list') },
  { cmd: 'outdent', label: '⇤', title: tr('내어쓰기', 'Outdent') },
  { cmd: 'indent', label: '⇥', title: tr('들여쓰기', 'Indent') },
  { cmd: 'formatBlock', arg: 'blockquote', label: '❝', title: tr('인용구', 'Quote') },
  { cmd: 'insertHorizontalRule', label: '―', title: tr('구분선', 'Horizontal line') },
];
/** SmartEditor2Skin.html 글꼴 목록 (same order and font-family stacks). */
export const FONT_FACES = [
  { label: '돋움', value: "'돋움',Dotum,Sans-serif" }, { label: '돋움체', value: "'돋움체',DotumChe,Sans-serif" },
  { label: '굴림', value: "'굴림',Gulim,Sans-serif" }, { label: '굴림체', value: "'굴림체',GulimChe,Sans-serif" },
  { label: '바탕', value: "'바탕',Batang,serif" }, { label: '바탕체', value: "'바탕체',BatangChe,serif" },
  { label: '궁서', value: "'궁서',Gungsuh,serif" }, { label: 'Arial', value: 'arial,Sans-serif' }, { label: 'Tahoma', value: 'tahoma,Sans-serif' },
  { label: 'Times New Roman', value: "'Times New Roman',Times,serif" }, { label: 'Verdana', value: 'verdana,Sans-serif' }, { label: 'Courier New', value: 'Courier New,Sans-serif' },
  { label: '나눔고딕', value: "'나눔고딕',NanumGothic,Sans-serif" }, { label: '나눔명조', value: "'나눔명조',NanumMyeongjo,serif" }, { label: '나눔고딕코딩', value: "'나눔고딕코딩',NanumGothicCoding,Sans-serif" },
];
/** file_uploader.php $allow_file. */
const PHOTO_EXT = ['jpg', 'png', 'bmp', 'gif'];
const defaultUploadPhoto = (file: File) => adminSiteCmsApi.uploadEditorPhoto(file);

const FONT_SIZES = [
  { value: '', label: tr('글자 크기', 'Size') }, { value: '1', label: '8pt' }, { value: '2', label: '10pt' }, { value: '3', label: '12pt' },
  { value: '4', label: '14pt' }, { value: '5', label: '18pt' }, { value: '6', label: '24pt' }, { value: '7', label: '36pt' },
];

/**
 * WYSIWYG HTML editor replacing SmartEditor2 on the 커뮤니티관리 forms (아카이빙 답변, 학습자료실 내용):
 * a formatting toolbar over a contentEditable surface plus the same Editor | HTML | TEXT mode tabs. The value is always
 * the HTML string the PHP pages stored (TEXT mode edits plain text and stores it as <p> lines, as SmartEditor does).
 */
export function SiteCmsHtmlEditor({ id, label, value, onChange, disabled, invalid, height = 280, uploadPhoto = defaultUploadPhoto }: SiteCmsHtmlEditorProps) {
  const [mode, setMode] = useState<Mode>('editor');
  const surface = useRef<HTMLDivElement | null>(null);
  const photoInput = useRef<HTMLInputElement | null>(null);
  const savedRange = useRef<Range | null>(null);
  const [text, setText] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');

  // Push external value changes (record loaded, form reset, HTML/TEXT edits) into the editable surface.
  useEffect(() => {
    const el = surface.current;
    if (mode === 'editor' && el && el.innerHTML !== value) el.innerHTML = value;
  }, [value, mode]);

  const emit = () => { const el = surface.current; if (el) onChange(el.innerHTML); };
  const exec = (cmd: string, arg?: string) => {
    if (disabled) return;
    surface.current?.focus();
    if (typeof document.execCommand === 'function') {
      try { document.execCommand('styleWithCSS', false, 'false'); } catch { /* not supported */ }
      document.execCommand(cmd, false, arg);
    }
    emit();
  };
  const link = () => {
    const url = window.prompt(tr('링크 주소(URL)를 입력하세요.', 'Enter the link URL.'), 'https://');
    if (url && url !== 'https://') exec('createLink', url);
  };
  const image = () => {
    const url = window.prompt(tr('이미지 주소(URL)를 입력하세요.', 'Enter the image URL.'), 'https://');
    if (url && url !== 'https://') exec('insertImage', url);
  };
  /** Remember the caret inside the surface so the photo lands where the admin was typing (the file dialog steals focus). */
  const saveRange = () => {
    const sel = typeof window.getSelection === 'function' ? window.getSelection() : null;
    const el = surface.current;
    savedRange.current = sel && sel.rangeCount && el && el.contains(sel.getRangeAt(0).commonAncestorContainer) ? sel.getRangeAt(0).cloneRange() : null;
  };
  const insertHtml = (html: string) => {
    const el = surface.current;
    if (!el) return;
    el.focus();
    const sel = typeof window.getSelection === 'function' ? window.getSelection() : null;
    if (sel && savedRange.current) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
    let done = false;
    if (sel && sel.rangeCount && el.contains(sel.getRangeAt(0).commonAncestorContainer) && typeof document.execCommand === 'function') {
      try { done = document.execCommand('insertHTML', false, html); } catch { done = false; }
    }
    if (!done) el.innerHTML += html; // SmartEditor PASTE_HTML fallback: append at the end
    savedRange.current = null;
    emit();
  };
  const pickPhoto = () => { if (off || !uploadPhoto) return; saveRange(); setPhotoError(''); photoInput.current?.click(); };
  const onPhotos = async (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (photoInput.current) photoInput.current.value = '';
    if (!picked.length || !uploadPhoto) return;
    const bad = picked.find((f) => !PHOTO_EXT.includes((f.name.split('.').pop() ?? '').toLowerCase()));
    if (bad) { setPhotoError(tr(`이미지 파일(${PHOTO_EXT.join(', ')})만 올릴 수 있습니다: ${bad.name}`, `Images only (${PHOTO_EXT.join(', ')}): ${bad.name}`)); return; }
    setPhotoBusy(true);
    let html = '';
    try {
      for (const f of picked) html += (await uploadPhoto(f)).html;
    } catch (e) {
      setPhotoError(isAppError(e) ? e.message : tr('사진을 올리지 못했습니다.', 'The photo could not be uploaded.'));
    } finally {
      if (html) insertHtml(html);
      setPhotoBusy(false);
    }
  };
  const switchMode = (next: Mode) => {
    if (next === mode) return;
    if (mode === 'editor') emit();
    if (next === 'text') setText(htmlToPlainText(value));
    setMode(next);
  };

  const tool = (t: Tool) => (
    <button key={t.cmd + (t.arg ?? '')} type="button" className={styles.tool} title={t.title} aria-label={t.title} disabled={disabled || mode !== 'editor'}
      onMouseDown={(e) => e.preventDefault()} onClick={() => exec(t.cmd, t.arg)}
      style={t.cmd === 'bold' ? { fontWeight: 700 } : t.cmd === 'italic' ? { fontStyle: 'italic' } : t.cmd === 'underline' ? { textDecoration: 'underline' } : t.cmd === 'strikeThrough' ? { textDecoration: 'line-through' } : undefined}>{t.label}</button>
  );
  const off = disabled || mode !== 'editor';
  return (
    <div className={styles.wrap} aria-invalid={invalid || undefined} style={{ '--editor-h': `${height}px` } as CSSProperties}>
      <div className={styles.toolbar} role="toolbar" aria-label={tr('편집 도구', 'Formatting')}>
        <select className={styles.select} aria-label={tr('글꼴', 'Font')} disabled={off} value="" onChange={(e) => { if (e.target.value) exec('fontName', e.target.value); }}>
          <option value="">{tr('글꼴', 'Font')}</option>
          {FONT_FACES.map((f) => <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>)}
        </select>
        <select className={styles.select} aria-label={tr('글자 크기', 'Font size')} disabled={off} value="" onChange={(e) => { if (e.target.value) exec('fontSize', e.target.value); }}>
          {FONT_SIZES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <span className={styles.sep} />
        {INLINE.map(tool)}
        <label title={tr('글자색', 'Text color')}><input type="color" className={styles.color} aria-label={tr('글자색', 'Text color')} disabled={off} defaultValue="#000000" onChange={(e) => exec('foreColor', e.target.value)} /></label>
        <label title={tr('배경색', 'Highlight')}><input type="color" className={styles.color} aria-label={tr('배경색', 'Highlight')} disabled={off} defaultValue="#ffff00" onChange={(e) => exec('hiliteColor', e.target.value)} /></label>
        <span className={styles.sep} />
        {BLOCK.map(tool)}
        <span className={styles.sep} />
        <button type="button" className={styles.tool} title={tr('링크', 'Link')} aria-label={tr('링크', 'Link')} disabled={off} onMouseDown={(e) => e.preventDefault()} onClick={link}>🔗</button>
        <button type="button" className={styles.tool} title={tr('링크 해제', 'Unlink')} aria-label={tr('링크 해제', 'Unlink')} disabled={off} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('unlink')}>⛓</button>
        {uploadPhoto ? (
          <button type="button" className={styles.tool} title={tr('사진 (jpg, png, bmp, gif 올리기)', 'Photo (upload jpg, png, bmp, gif)')} aria-label={tr('사진', 'Photo')} disabled={off || photoBusy} aria-busy={photoBusy || undefined}
            onMouseDown={(e) => { e.preventDefault(); saveRange(); }} onClick={pickPhoto}>{photoBusy ? '…' : '📷'}</button>
        ) : null}
        <button type="button" className={styles.tool} title={tr('사진(URL)', 'Image (URL)')} aria-label={tr('사진(URL)', 'Image (URL)')} disabled={off} onMouseDown={(e) => e.preventDefault()} onClick={image}>🖼</button>
        <button type="button" className={styles.tool} title={tr('서식 지우기', 'Clear formatting')} aria-label={tr('서식 지우기', 'Clear formatting')} disabled={off} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('removeFormat')}>Tx</button>
        <span className={styles.sep} />
        <button type="button" className={styles.tool} title={tr('실행 취소', 'Undo')} aria-label={tr('실행 취소', 'Undo')} disabled={off} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('undo')}>↶</button>
        <button type="button" className={styles.tool} title={tr('다시 실행', 'Redo')} aria-label={tr('다시 실행', 'Redo')} disabled={off} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('redo')}>↷</button>
      </div>

      {uploadPhoto ? <input ref={photoInput} type="file" hidden multiple accept=".jpg,.png,.bmp,.gif,image/jpeg,image/png,image/bmp,image/gif" data-testid={`${id}-photo-input`} onChange={(e) => void onPhotos(e.target.files)} /> : null}
      {photoError ? <div className={styles.error} role="alert">{photoError}</div> : null}

      {mode === 'editor' ? (
        <div id={id} ref={surface} className={styles.surface} role="textbox" aria-multiline="true" aria-label={label} aria-invalid={invalid || undefined}
          contentEditable={!disabled} suppressContentEditableWarning onInput={emit} onBlur={emit} />
      ) : mode === 'html' ? (
        <textarea id={id} className={styles.source} aria-label={`${label} (HTML)`} value={value} disabled={disabled} spellCheck={false} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <textarea id={id} className={cx(styles.source, styles.plain)} aria-label={`${label} (TEXT)`} value={text} disabled={disabled} onChange={(e) => { setText(e.target.value); onChange(plainTextToHtml(e.target.value)); }} />
      )}

      <div className={styles.modes} role="group" aria-label={tr('편집 모드', 'Editor mode')}>
        {(['editor', 'html', 'text'] as const).map((m) => (
          <button key={m} type="button" className={styles.mode} aria-pressed={mode === m} onClick={() => switchMode(m)}>{m === 'editor' ? 'Editor' : m === 'html' ? 'HTML' : 'TEXT'}</button>
        ))}
      </div>
    </div>
  );
}
