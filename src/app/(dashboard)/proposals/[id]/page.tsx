import { ProposalBuilder } from '@/components/proposals/proposal-builder';

export const metadata = { title: 'Proposal' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProposalBuilder proposalId={id} />;
}
