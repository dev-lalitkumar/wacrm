export interface TemplateVars {
  contact_name?: string
  proposal_title?: string
  proposal_link?: string
  total_amount?: string
  valid_until?: string
}

export function interpolate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{contact_name\}\}/g, vars.contact_name ?? '')
    .replace(/\{\{proposal_title\}\}/g, vars.proposal_title ?? '')
    .replace(/\{\{proposal_link\}\}/g, vars.proposal_link ?? '')
    .replace(/\{\{total_amount\}\}/g, vars.total_amount ?? '')
    .replace(/\{\{valid_until\}\}/g, vars.valid_until ?? '')
}
