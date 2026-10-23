type Level = 'debug' | 'info' | 'warn' | 'error';

/** Structured JSON logs. Never pass tokens or request bodies in `fields`. */
export function log(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === 'test' && level !== 'error') return;
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...fields });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}
