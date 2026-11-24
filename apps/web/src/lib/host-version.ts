/**
 * The version a host action reports, if it is newer than the one the presenter's screen holds.
 * Activities with clock-driven phases (Embolsau's tick) move the session without the main button;
 * without this, the next press would carry an old version and be refused.
 */
export function newerVersion(current: number, result: unknown): number {
  const reported = (result as { version?: unknown } | null)?.version;
  return typeof reported === 'number' && reported > current ? reported : current;
}
