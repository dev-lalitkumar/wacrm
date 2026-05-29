import { createClient } from '@/lib/supabase/server'
import { PublicProposalView } from '@/components/proposals/public-proposal-view'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const supabase = await createClient()
  const { data: proposal } = await supabase
    .from('proposals')
    .select(`
      *,
      contact:contacts(id, name, email, phone, company),
      items:proposal_items(*)
    `)
    .eq('public_token', token)
    .single()

  if (!proposal) notFound()

  // Mark as viewed
  if (proposal.status === 'sent') {
    await supabase.from('proposals').update({ status: 'viewed', viewed_at: new Date().toISOString() }).eq('id', proposal.id).eq('status', 'sent')
    await supabase.from('proposal_history').insert({ proposal_id: proposal.id, action: 'viewed', channel: 'web' })
  }

  const { data: company } = await supabase.from('companies').select('*').eq('id', 1).maybeSingle()

  return <PublicProposalView proposal={proposal} company={company} token={token} />
}
