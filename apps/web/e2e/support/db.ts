/**
 * Assertions against the local e2e test DB (127.0.0.1:<E2E_DB_PORT>, hrdeArchive, utf8 + KST like the API). Never production:
 * the connection comes only from <E2E_RUN_DIR>/stack.json, which loadStack() refuses unless it is loopback on a non-live port.
 *
 *   const rows = await db.query<{ StudyTime: number }>('SELECT StudyTime FROM Progress WHERE ID = ?', ['e2elearn01']);
 *   const n = await db.scalar<number>('SELECT COUNT(*) FROM ProgressLog WHERE ID = ?', ['e2elearn01']);
 *   const mobile = await db.scalar<string>(`SELECT ${db.aesDec('Mobile')} FROM Member WHERE ID = ?`, ['e2elearn01']);
 *
 * Tests may also prepare state (age a ProgressLog row, clear a PlayLock) — never schema changes.
 */
import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import { loadStack } from './stack';

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const s = loadStack();
  pool = mysql.createPool({
    host: '127.0.0.1', port: s.db.port, user: s.db.user, password: s.db.password, database: s.db.database,
    charset: 'UTF8_GENERAL_CI', timezone: '+09:00', dateStrings: true, decimalNumbers: true, connectionLimit: 3, multipleStatements: false,
  });
  return pool;
}

export const DB_ENC_KEY = 'test-enc-key';

export const db = {
  /** Rows of a SELECT (placeholders `?`). */
  async query<T extends object = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await getPool().query<RowDataPacket[]>(sql, params);
    return rows as unknown as T[];
  },
  /** First row or null. */
  async one<T extends object = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
    return (await db.query<T>(sql, params))[0] ?? null;
  },
  /** First column of the first row (COUNT/SUM/DECIMAL come back as numbers; DATETIME as 'YYYY-MM-DD HH:MM:SS' strings). */
  async scalar<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const row = await db.one<Record<string, unknown>>(sql, params);
    return row ? (Object.values(row)[0] as T) : null;
  },
  /** INSERT/UPDATE/DELETE for test preparation; returns affected rows. */
  async exec(sql: string, params: unknown[] = []): Promise<number> {
    const [res] = await getPool().execute(sql, params as never[]);
    return (res as { affectedRows?: number }).affectedRows ?? 0;
  },
  /** SQL fragment that decrypts an AES column like the API (`CAST(AES_DECRYPT(UNHEX(col), key) AS CHAR)`). */
  aesDec(column: string): string {
    return `CAST(AES_DECRYPT(UNHEX(${column}), '${DB_ENC_KEY}') AS CHAR)`;
  },
  async close(): Promise<void> {
    if (pool) { await pool.end(); pool = null; }
  },
};

// ------------------------------------------------------------------ common preparations / reads

/** Frees the learner's PlayLock (a previous test's window may still hold it for 90 s). */
export function clearPlayLock(id: string): Promise<number> {
  return db.exec('DELETE FROM PlayLock WHERE ID = ?', [id]);
}

/** Moves the newest ProgressLog row of the learner `seconds` into the past, so the next tick sees wallΔ = seconds (as the API integration tests do). */
export function ageLastProgressLog(id: string, seconds: number): Promise<number> {
  return db.exec('UPDATE ProgressLog SET RegDate = DATE_SUB(RegDate, INTERVAL ? SECOND) WHERE ID = ? ORDER BY idx DESC LIMIT 1', [seconds, id]);
}

/** Σ Progress.StudyTime of one enrollment — the 15-hour clock (54,000 s). */
export async function studySeconds(studySeq: number): Promise<number> {
  return Number((await db.scalar<number>('SELECT COALESCE(SUM(StudyTime), 0) AS t FROM Progress WHERE Study_Seq = ?', [studySeq])) ?? 0);
}

export interface ProgressRow { idx: number; ID: string; LectureCode: string; Study_Seq: number; Chapter_Seq: number; Contents_idx: number; Progress: number; StudyTime: number; LastStudy: string | null; RegDate: string; TriggerYN: string; Chapter_Number: string }

export function progressRows(id: string, studySeq: number, lectureCode?: string): Promise<ProgressRow[]> {
  return lectureCode
    ? db.query<ProgressRow>('SELECT * FROM Progress WHERE ID = ? AND Study_Seq = ? AND LectureCode = ? ORDER BY idx', [id, studySeq, lectureCode])
    : db.query<ProgressRow>('SELECT * FROM Progress WHERE ID = ? AND Study_Seq = ? ORDER BY idx', [id, studySeq]);
}

export async function progressLogCount(id: string, studySeq: number, chapterSeq?: number): Promise<number> {
  const sql = chapterSeq ? 'SELECT COUNT(*) AS c FROM ProgressLog WHERE ID = ? AND Study_Seq = ? AND Chapter_Seq = ?' : 'SELECT COUNT(*) AS c FROM ProgressLog WHERE ID = ? AND Study_Seq = ?';
  return Number((await db.scalar<number>(sql, chapterSeq ? [id, studySeq, chapterSeq] : [id, studySeq])) ?? 0);
}
