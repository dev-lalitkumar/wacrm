import type { SupabaseClient } from '@supabase/supabase-js'

export async function generateProposalNumber(supabase: SupabaseClient): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PRO-${year}-`

  const { data } = await supabase
    .from('proposals')
    .select('proposal_number')
    .like('proposal_number', `${prefix}%`)
    .order('proposal_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  let next = 1
  if (data?.proposal_number) {
    const tail = data.proposal_number.replace(prefix, '')
    const parsed = parseInt(tail, 10)
    if (!isNaN(parsed)) next = parsed + 1
  }

  return `${prefix}${String(next).padStart(3, '0')}`
}
