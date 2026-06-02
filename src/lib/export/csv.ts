/**
 * CSV utilities shared between export API routes and import modals.
 *
 * All functions are isomorphic (work in Node and the browser):
 *   - `rowsToCSV` / `generateSampleCSV` produce RFC 4180-compliant strings
 *   - `downloadCSV` is browser-only (uses Blob + <a> trick)
 */

/**
 * Escape a single cell value for RFC 4180 CSV:
 * - Wrap in double-quotes if the value contains a comma, double-quote, or newline.
 * - Escape embedded double-quotes by doubling them.
 */
function escapeCell(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Convert an array of row-objects to a CSV string.
 * `columns` controls both the header order and which keys are included.
 */
export function rowsToCSV(
  rows: Record<string, unknown>[],
  columns: string[],
): string {
  const header = columns.map(escapeCell).join(',')
  const body = rows.map((row) =>
    columns.map((col) => escapeCell(row[col])).join(','),
  )
  return [header, ...body].join('\r\n')
}

/**
 * Build a 2-row sample CSV (header + one example row).
 * Used by import modals to let the user download a correctly-formatted template.
 */
export function generateSampleCSV(
  columns: { name: string; example: string }[],
): string {
  const header = columns.map((c) => escapeCell(c.name)).join(',')
  const row = columns.map((c) => escapeCell(c.example)).join(',')
  return [header, row].join('\r\n')
}

/**
 * Trigger a browser download of a CSV string.
 * Must only be called in a browser context.
 */
export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
