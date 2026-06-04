import { describe, it, expect } from 'vitest'
import { renderTemplate, renderDeep, type TemplateContext } from './template'

const NOW = new Date('2026-06-04T10:30:00.000Z')

function ctx(overrides: Partial<TemplateContext> = {}): TemplateContext {
  return { now: NOW, lastFetch: null, intervalMinutes: 60, ...overrides }
}

describe('renderTemplate', () => {
  it('passes through strings with no tokens', () => {
    expect(renderTemplate('https://api.test/leads', ctx())).toBe('https://api.test/leads')
  })

  it('{{now}} defaults to ISO-8601', () => {
    expect(renderTemplate('{{now}}', ctx())).toBe('2026-06-04T10:30:00.000Z')
  })

  it('applies negative hour offsets', () => {
    expect(renderTemplate('{{now-24h|iso}}', ctx())).toBe('2026-06-03T10:30:00.000Z')
  })

  it('applies positive hour offsets', () => {
    expect(renderTemplate('{{now+2h|iso}}', ctx())).toBe('2026-06-04T12:30:00.000Z')
  })

  it('applies minute and day offsets', () => {
    expect(renderTemplate('{{now-30m}}', ctx())).toBe('2026-06-04T10:00:00.000Z')
    expect(renderTemplate('{{now+1d}}', ctx())).toBe('2026-06-05T10:30:00.000Z')
  })

  it('formats date / datetime / unix', () => {
    expect(renderTemplate('{{now|date}}', ctx())).toBe('2026-06-04')
    expect(renderTemplate('{{now|datetime}}', ctx())).toBe('2026-06-04 10:30:00')
    expect(renderTemplate('{{now|unix}}', ctx())).toBe(String(Math.floor(NOW.getTime() / 1000)))
    expect(renderTemplate('{{now|unix_ms}}', ctx())).toBe(String(NOW.getTime()))
  })

  it('supports custom literal patterns', () => {
    expect(renderTemplate('{{now-1d|YYYY-MM-DD HH:mm:ss}}', ctx())).toBe('2026-06-03 10:30:00')
  })

  it('last_fetch falls back to now - intervalMinutes when no cursor', () => {
    // 60-minute interval ⇒ one hour before now.
    expect(renderTemplate('{{last_fetch|iso}}', ctx())).toBe('2026-06-04T09:30:00.000Z')
  })

  it('last_fetch uses the provided cursor when present', () => {
    const cursor = new Date('2026-06-01T00:00:00.000Z')
    expect(renderTemplate('{{last_fetch|unix}}', ctx({ lastFetch: cursor }))).toBe(
      String(Math.floor(cursor.getTime() / 1000)),
    )
  })

  it('renders multiple tokens with surrounding literal text', () => {
    expect(
      renderTemplate('from={{now-1h|iso}}&to={{now|iso}}', ctx()),
    ).toBe('from=2026-06-04T09:30:00.000Z&to=2026-06-04T10:30:00.000Z')
  })

  it('leaves unrecognised tokens verbatim', () => {
    expect(renderTemplate('{{bogus}}', ctx())).toBe('{{bogus}}')
    expect(renderTemplate('{{now-99x}}', ctx())).toBe('{{now-99x}}')
  })
})

describe('renderDeep', () => {
  it('renders string leaves in nested objects/arrays', () => {
    const out = renderDeep(
      { since: '{{now-1d|iso}}', nested: { list: ['{{now|date}}', 7], flag: true } },
      ctx(),
    )
    expect(out).toEqual({
      since: '2026-06-03T10:30:00.000Z',
      nested: { list: ['2026-06-04', 7], flag: true },
    })
  })
})
