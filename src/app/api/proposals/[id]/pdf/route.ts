import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isErrorResponse, requireRole } from '@/lib/auth/require-role'
import { renderProposalPdf } from '@/lib/proposals/pdf-renderer'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse | Response> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager', 'executive'])
  if (isErrorResponse(callerOrError)) return callerOrError

  const { id } = await params
  const supabase = await createClient()

  const { data: proposal, error } = await supabase
    .from('proposals')
    .select(`*, contact:contacts(id, name, email, phone, company), items:proposal_items(*)`)
    .eq('id', id)
    .single()

  if (error || !proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', 1)
    .single()

  // Log download in history
  const caller = callerOrError
  await supabase.from('proposal_history').insert({
    proposal_id: id,
    action: 'downloaded',
    actor_id: caller.profileId,
  })

  try {
    const pdfBuffer = await renderProposalPdf(proposal, company)
    const pdfBytes = new Uint8Array(pdfBuffer)
    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${proposal.proposal_number}.pdf"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
