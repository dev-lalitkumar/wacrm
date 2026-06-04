/**
 * Dynamic placeholder engine for lead-fetch sources.
 *
 * Providers that you poll often want a moving time window in their query
 * params or request body (e.g. `created_after=<24h ago>`, `to=<now>`), or a
 * cursor (`since=<last successful fetch>`). `renderTemplate` substitutes
 * `{{ ... }}` tokens in any string with freshly-computed values at fetch time.
 *
 * Grammar:  {{ base [±N unit] [| format] }}
 *
 *   base    now | last_fetch
 *           - `now`        → the moment the poll started
 *           - `last_fetch` → the previous successful poll's start time;
 *             falls back to `now - intervalMinutes` when there is no cursor yet
 *   offset  ±N unit, where unit ∈ { m (minutes), h (hours), d (days) }
 *           e.g. -24h, +30m, +1d
 *   format  iso (default) | datetime | date | unix | unix_ms | <custom>
 *           - iso       → full ISO-8601, e.g. 2026-06-04T10:30:00.000Z
 *           - datetime  → "YYYY-MM-DD HH:mm:ss" (UTC)
 *           - date      → "YYYY-MM-DD" (UTC)
 *           - unix      → epoch seconds
 *           - unix_ms   → epoch milliseconds
 *           - <custom>  → any literal pattern of YYYY MM DD HH mm ss (UTC)
 *
 * All non-`iso`/`unix` formatting is UTC so polls are deterministic
 * regardless of server timezone. Unrecognised tokens are left verbatim so
 * mistakes surface in the "Test" preview rather than silently corrupting a URL.
 *
 * Examples:
 *   {{now}}            → 2026-06-04T10:30:00.000Z
 *   {{now-24h|iso}}    → 2026-06-03T10:30:00.000Z
 *   {{now|date}}       → 2026-06-04
 *   {{last_fetch|unix}}→ 1749032400
 *   {{now-1d|YYYY-MM-DD HH:mm:ss}} → 2026-06-03 10:30:00
 */

export interface TemplateContext {
  /** The moment the current poll started. */
  now: Date
  /** Previous successful poll start, or null when never polled. */
  lastFetch: Date | null
  /** Poll cadence; used as the `last_fetch` fallback window. */
  intervalMinutes: number
}

const TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g
const UNIT_MS: Record<string, number> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
}

/** Replace every `{{ ... }}` token in `input`. Non-strings pass through. */
export function renderTemplate(input: string, ctx: TemplateContext): string {
  if (!input || !input.includes('{{')) return input
  return input.replace(TOKEN_RE, (match, expr: string) => {
    const rendered = renderToken(expr.trim(), ctx)
    return rendered ?? match // keep the literal token on parse failure
  })
}

/** Recursively render every string leaf of a JSON-ish value (for body templates). */
export function renderDeep<T>(value: T, ctx: TemplateContext): T {
  if (typeof value === 'string') return renderTemplate(value, ctx) as unknown as T
  if (Array.isArray(value)) return value.map((v) => renderDeep(v, ctx)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = renderDeep(v, ctx)
    }
    return out as T
  }
  return value
}

/** Render a single token body (without the surrounding braces). */
function renderToken(expr: string, ctx: TemplateContext): string | null {
  // Split off the optional "| format" tail. The format may itself be a
  // literal pattern, so only split on the FIRST pipe.
  const pipe = expr.indexOf('|')
  const datePart = (pipe === -1 ? expr : expr.slice(0, pipe)).trim()
  const format = (pipe === -1 ? 'iso' : expr.slice(pipe + 1)).trim() || 'iso'

  const m = /^(now|last_fetch)\s*([+-]\s*\d+\s*[mhd])?$/.exec(datePart)
  if (!m) return null

  const base = m[1] === 'now'
    ? ctx.now
    : ctx.lastFetch ?? new Date(ctx.now.getTime() - ctx.intervalMinutes * UNIT_MS.m)

  let ms = base.getTime()
  if (m[2]) {
    const off = /^([+-])\s*(\d+)\s*([mhd])$/.exec(m[2].replace(/\s+/g, ''))
    if (off) {
      const delta = Number(off[2]) * UNIT_MS[off[3]]
      ms += off[1] === '-' ? -delta : delta
    }
  }

  return formatDate(new Date(ms), format)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatDate(d: Date, format: string): string {
  switch (format) {
    case 'iso':
      return d.toISOString()
    case 'unix':
      return String(Math.floor(d.getTime() / 1000))
    case 'unix_ms':
      return String(d.getTime())
    case 'date':
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    case 'datetime':
      return (
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
      )
    default:
      // Treat as a literal pattern of date components (UTC).
      return format
        .replace(/YYYY/g, String(d.getUTCFullYear()))
        .replace(/MM/g, pad(d.getUTCMonth() + 1))
        .replace(/DD/g, pad(d.getUTCDate()))
        .replace(/HH/g, pad(d.getUTCHours()))
        .replace(/mm/g, pad(d.getUTCMinutes()))
        .replace(/ss/g, pad(d.getUTCSeconds()))
  }
}
