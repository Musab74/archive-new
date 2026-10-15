import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type ReactNode } from 'react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Camera, Image, Indent, Italic, Link, List, ListOrdered, Minus, Outdent, Quote,
  Redo2, RemoveFormatting, Strikethrough, Subscript, Superscript, Table, Underline, Undo2, Unlink,
} from 'lucide-react';
import styles from './SupportRichEditor.module.css';
import { tr } from '../../../../shared/i18n/adminLang';
import { htmlToText, sanitizePastedHtml, textToHtml } from './support-parity.helpers';
import { adminSupportParityApi } from '../../../../shared/api/endpoints/admin-support-parity';
import { isAppError } from '../../../../shared/api/client';

export type RichEditorMode = 'editor' | 'html' | 'text';

export interface SupportRichEditorProps {
  /** Put on the editable element of the current mode (FieldRow htmlFor). */
  id?: string;
  /** HTML (what the PHP pages store in Notice.Content / Faq.Content / Counsel.Contents2 / Inquiry.Contents2). */
  value: string;
  onChange: (html: string) => void;
  /** Accessible name of the editing area (the field label). */
  ariaLabel: string;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  /** Initial height in px (the area can be resized vertically like SmartEditor2's resizer). */
  height?: number;
  /**
   * SmartEditor2 "사진" (photo_uploader): uploads one jpg/png/bmp/gif and returns the HTML to insert. Defaults to
   * POST /admin/support/editor-photo; pass null to hide the button.
   */
  onUploadPhoto?: ((file: File) => Promise<{ html: string }>) | null;
}

/** photo_uploader sFiletype "*.jpg;*.png;*.bmp;*.gif". */
export const EDITOR_PHOTO_EXT = ['jpg', 'png', 'bmp', 'gif'];
/** jindo.FileUploader sMsgNotAllowedExt. */
export const EDITOR_PHOTO_EXT_MSG = 'JPG, GIF, PNG, BMP 확장자만 가능합니다';
export function editorPhotoExtOk(name: string): boolean {
  const i = name.lastIndexOf('.');
  return i >= 0 && EDITOR_PHOTO_EXT.includes(name.slice(i + 1).toLowerCase());
}
const defaultPhotoUpload = (file: File) => adminSupportParityApi.uploadEditorPhoto(file);

/** SmartEditor2 글꼴 list. */
const FONTS = ['나눔고딕', '나눔명조', '굴림', '돋움', '바탕', '궁서', 'Arial', 'Tahoma', 'Times New Roman', 'Verdana', 'Courier New'];
/** execCommand fontSize 1..7 with the SmartEditor2 point sizes they render as. */
const SIZES: [string, string][] = [['1', '8pt'], ['2', '10pt'], ['3', '12pt'], ['4', '14pt'], ['5', '18pt'], ['6', '24pt'], ['7', '36pt']];
const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

function run(cmd: string, arg?: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  try { return document.execCommand(cmd, false, arg); } catch { return false; }
}

/**
 * WYSIWYG editor in place of the PHP pages' SmartEditor2 (notice_write.php, faq_write.php, qna_read.php, inquiry_read.php):
 * toolbar (글꼴, 글자 크기, 굵게/밑줄/기울임/취소선, 위·아래 첨자, 글자색/배경색, 정렬, 목록, 들여쓰기, 인용구, 링크, 이미지 URL, 표,
 * 가로줄, 서식 지우기, 실행 취소/다시 실행), a vertical resizer and the Editor | HTML | TEXT mode tabs. The value is HTML.
 */
export function SupportRichEditor({ id, value, onChange, ariaLabel, disabled, invalid, placeholder, height = 420, onUploadPhoto = defaultPhotoUpload }: SupportRichEditorProps) {
  const [mode, setMode] = useState<RichEditorMode>('editor');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const photoInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const area = useRef<HTMLDivElement>(null);
  const saved = useRef<Range | null>(null);

  // Keep the editable DOM in step with the value without resetting the caret while typing (the value then equals innerHTML).
  useEffect(() => {
    const el = area.current;
    if (mode === 'editor' && el && el.innerHTML !== value) el.innerHTML = value;
  }, [value, mode]);

  const emit = () => { const el = area.current; if (el) onChange(el.innerHTML); };
  const saveSelection = () => {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (sel && sel.rangeCount && area.current?.contains(sel.anchorNode)) saved.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    const el = area.current; if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (saved.current && sel) { sel.removeAllRanges(); sel.addRange(saved.current); }
  };
  const exec = (cmd: string, arg?: string, css = false) => {
    if (disabled) return;
    restoreSelection();
    if (css) run('styleWithCSS', 'true');
    run(cmd, arg);
    if (css) run('styleWithCSS', 'false');
    saveSelection();
    emit();
  };
  const insertHtml = (html: string) => { if (!run('insertHTML', html) && area.current) area.current.innerHTML += html; emit(); };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData?.getData('text/html');
    if (!html) return; // plain text pastes as text
    e.preventDefault();
    restoreSelection();
    insertHtml(sanitizePastedHtml(html));
  };
  const askLink = () => {
    const url = window.prompt(tr('링크 URL을 입력하세요.', 'Enter the link URL.'), 'http://')?.trim();
    if (url && SAFE_URL.test(url)) exec('createLink', url);
  };
  const askImage = () => {
    const url = window.prompt(tr('이미지 주소(URL)를 입력하세요.', 'Enter the image URL.'), 'https://')?.trim();
    if (url && SAFE_URL.test(url)) exec('insertImage', url);
  };
  const pickPhoto = () => {
    if (disabled || photoBusy) return;
    saveSelection();
    setPhotoError('');
    photoInput.current?.click();
  };
  const onPhotoChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // bAutoReset: the same file can be chosen again
    if (!file || !onUploadPhoto) return;
    if (!editorPhotoExtOk(file.name)) { setPhotoError(EDITOR_PHOTO_EXT_MSG); return; }
    setPhotoBusy(true);
    try {
      const { html } = await onUploadPhoto(file);
      restoreSelection();
      insertHtml(html);
    } catch (err) {
      setPhotoError(isAppError(err) ? err.message : tr('사진을 올리지 못했습니다.', 'The photo could not be uploaded.'));
    } finally { setPhotoBusy(false); }
  };
  const insertTable = () => {
    if (disabled) return;
    const cell = '<td>&nbsp;</td>';
    restoreSelection();
    insertHtml(`<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;width:100%"><tbody>${`<tr>${cell.repeat(3)}</tr>`.repeat(3)}</tbody></table><p><br></p>`);
  };

  const switchMode = (next: RichEditorMode) => {
    if (next === mode) return;
    if (next === 'text') setText(htmlToText(value));
    setMode(next);
  };

  const tool = (label: string, icon: ReactNode, onClick: () => void) => (
    <button type="button" className={styles.tool} title={label} aria-label={label} disabled={disabled || mode !== 'editor'} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{icon}</button>
  );
  const sz = 16;
  const sep = (k: string) => <span key={k} className={styles.sep} aria-hidden="true" />;

  return (
    <div className={styles.wrap} aria-invalid={invalid || undefined}>
      <div className={styles.toolbar} role="toolbar" aria-label={tr('편집 도구', 'Formatting')} hidden={mode !== 'editor'}>
        <select className={styles.select} aria-label={tr('글꼴', 'Font')} disabled={disabled} defaultValue="" onChange={(e) => { if (e.target.value) exec('fontName', e.target.value); e.target.value = ''; }}>
          <option value="">{tr('글꼴', 'Font')}</option>
          {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>
        <select className={styles.select} aria-label={tr('글자 크기', 'Size')} disabled={disabled} defaultValue="" onChange={(e) => { if (e.target.value) exec('fontSize', e.target.value); e.target.value = ''; }}>
          <option value="">{tr('크기', 'Size')}</option>
          {SIZES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {sep('s1')}
        {tool(tr('굵게', 'Bold'), <Bold size={sz} />, () => exec('bold'))}
        {tool(tr('밑줄', 'Underline'), <Underline size={sz} />, () => exec('underline'))}
        {tool(tr('기울임꼴', 'Italic'), <Italic size={sz} />, () => exec('italic'))}
        {tool(tr('취소선', 'Strikethrough'), <Strikethrough size={sz} />, () => exec('strikeThrough'))}
        {tool(tr('위 첨자', 'Superscript'), <Superscript size={sz} />, () => exec('superscript'))}
        {tool(tr('아래 첨자', 'Subscript'), <Subscript size={sz} />, () => exec('subscript'))}
        <label className={styles.color} title={tr('글자색', 'Text colour')} onMouseDown={saveSelection}>
          {tr('글자', 'A')}<input type="color" aria-label={tr('글자색', 'Text colour')} disabled={disabled} defaultValue="#000000" onChange={(e) => exec('foreColor', e.target.value, true)} />
        </label>
        <label className={styles.color} title={tr('배경색', 'Highlight')} onMouseDown={saveSelection}>
          {tr('배경', 'Bg')}<input type="color" aria-label={tr('배경색', 'Highlight')} disabled={disabled} defaultValue="#ffff00" onChange={(e) => exec('hiliteColor', e.target.value, true)} />
        </label>
        {sep('s2')}
        {tool(tr('왼쪽 정렬', 'Align left'), <AlignLeft size={sz} />, () => exec('justifyLeft'))}
        {tool(tr('가운데 정렬', 'Align centre'), <AlignCenter size={sz} />, () => exec('justifyCenter'))}
        {tool(tr('오른쪽 정렬', 'Align right'), <AlignRight size={sz} />, () => exec('justifyRight'))}
        {tool(tr('양쪽 정렬', 'Justify'), <AlignJustify size={sz} />, () => exec('justifyFull'))}
        {sep('s3')}
        {tool(tr('번호 매기기', 'Numbered list'), <ListOrdered size={sz} />, () => exec('insertOrderedList'))}
        {tool(tr('글머리 기호', 'Bulleted list'), <List size={sz} />, () => exec('insertUnorderedList'))}
        {tool(tr('내어쓰기', 'Outdent'), <Outdent size={sz} />, () => exec('outdent'))}
        {tool(tr('들여쓰기', 'Indent'), <Indent size={sz} />, () => exec('indent'))}
        {tool(tr('인용구', 'Quote'), <Quote size={sz} />, () => exec('formatBlock', 'blockquote'))}
        {sep('s4')}
        {tool(tr('링크', 'Link'), <Link size={sz} />, askLink)}
        {tool(tr('링크 해제', 'Remove link'), <Unlink size={sz} />, () => exec('unlink'))}
        {onUploadPhoto ? (
          <button type="button" className={styles.tool} title={tr('사진 (내 PC에서 올리기: jpg, png, bmp, gif)', 'Photo (upload jpg, png, bmp, gif)')} aria-label={tr('사진', 'Photo')} aria-busy={photoBusy || undefined}
            disabled={disabled || mode !== 'editor' || photoBusy} onMouseDown={(e) => e.preventDefault()} onClick={pickPhoto}><Camera size={sz} /></button>
        ) : null}
        {tool(tr('이미지(URL)', 'Image (URL)'), <Image size={sz} />, askImage)}
        {tool(tr('표', 'Table'), <Table size={sz} />, insertTable)}
        {tool(tr('가로줄', 'Horizontal line'), <Minus size={sz} />, () => exec('insertHorizontalRule'))}
        {sep('s5')}
        {tool(tr('서식 지우기', 'Clear formatting'), <RemoveFormatting size={sz} />, () => exec('removeFormat'))}
        {tool(tr('실행 취소', 'Undo'), <Undo2 size={sz} />, () => exec('undo'))}
        {tool(tr('다시 실행', 'Redo'), <Redo2 size={sz} />, () => exec('redo'))}
      </div>

      {onUploadPhoto ? (
        <input ref={photoInput} type="file" hidden accept=".jpg,.png,.bmp,.gif,image/jpeg,image/png,image/bmp,image/gif" aria-label={tr('사진 파일 선택', 'Choose a photo')} data-testid="editor-photo-input" onChange={(e) => void onPhotoChosen(e)} />
      ) : null}
      {photoBusy ? <p className={styles.photoNote} role="status">{tr('사진을 올리는 중입니다…', 'Uploading the photo…')}</p> : null}
      {photoError ? <p className={styles.photoNote} role="alert">{photoError}</p> : null}

      {mode === 'editor' ? (
        <div
          id={id} ref={area} className={styles.area} style={{ height }} role="textbox" aria-multiline="true" aria-label={ariaLabel} aria-invalid={invalid || undefined}
          contentEditable={!disabled} suppressContentEditableWarning data-placeholder={placeholder ?? ''}
          onInput={emit} onBlur={() => { saveSelection(); emit(); }} onKeyUp={saveSelection} onMouseUp={saveSelection} onPaste={onPaste}
        />
      ) : mode === 'html' ? (
        <textarea id={id} className={styles.source} style={{ height }} aria-label={`${ariaLabel} (HTML)`} spellCheck={false} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <textarea id={id} className={`${styles.source} ${styles.text}`} style={{ height }} aria-label={`${ariaLabel} (TEXT)`} value={text} disabled={disabled}
          title={tr('TEXT 모드에서 고치면 글자 서식은 사라지고 줄바꿈만 남습니다.', 'Editing in TEXT mode drops formatting and keeps line breaks.')}
          onChange={(e) => { setText(e.target.value); onChange(textToHtml(e.target.value)); }} />
      )}

      <div className={styles.modes} role="tablist" aria-label={tr('편집 모드', 'Editing mode')}>
        <span className={styles.count}>{tr(`HTML ${value.length}자`, `HTML ${value.length} chars`)}</span>
        {([['editor', 'Editor'], ['html', 'HTML'], ['text', 'TEXT']] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" className={styles.mode} aria-selected={mode === k} onClick={() => switchMode(k)}>{l}</button>
        ))}
      </div>
    </div>
  );
}
