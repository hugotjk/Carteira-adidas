/**
 * Lê as datas que vêm da planilha.
 *
 * O Google exporta o CSV no formato americano (mês/dia/ano):
 *   "6/1/2026" = 1º de junho de 2026, "10/19/26 5:06" = 19/10/2026 às 05:06.
 * Também aceita "2026-06-01 00:00:00" e, se o primeiro número passar de 12,
 * entende como dia/mês/ano ("19/10/2026").
 */
export function parseSheetDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  if (!v) return null;

  // 2026-06-01 ou 2026-06-01 05:06:33
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return build(+m[1], +m[2], +m[3], m[4], m[5]);

  // 6/1/2026, 10/19/26 5:06
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)(?:[ ,]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    let a = +m[1];
    let b = +m[2];
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    // Padrão do Google: mês/dia. Se o primeiro número não puder ser mês, é dia/mês.
    const [month, day] = a > 12 ? [b, a] : [a, b];
    return build(year, month, day, m[4], m[5]);
  }
  return null;
}

function build(y: number, mo: number, d: number, h?: string, mi?: string): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d, h ? +h : 0, mi ? +mi : 0);
  return isNaN(date.getTime()) ? null : date;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 19/10/2026 */
export const formatDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

/** 19/10 */
export const formatDayMonth = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

/** 19/10/2026 às 05:06 */
export const formatDateTime = (d: Date) => `${formatDate(d)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
