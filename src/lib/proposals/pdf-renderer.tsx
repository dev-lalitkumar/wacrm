import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { Proposal, Company, ProposalItem } from '@/types'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1e293b',
    padding: 48,
    backgroundColor: '#ffffff',
  },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  companyLogo: { width: 64, height: 64, objectFit: 'contain' },
  companyInfo: { textAlign: 'right', maxWidth: 200 },
  companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  companyDetail: { fontSize: 9, color: '#64748b', marginBottom: 2 },
  // Proposal title
  titleBlock: { marginBottom: 24 },
  proposalTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  proposalMeta: { fontSize: 9, color: '#64748b' },
  proposalNumber: { fontSize: 10, color: '#64748b', marginBottom: 4 },
  // Divider
  divider: { borderBottom: '1pt solid #e2e8f0', marginBottom: 20 },
  // Client & dates section
  infoRow: { flexDirection: 'row', gap: 32, marginBottom: 24 },
  infoBlock: { flex: 1 },
  infoLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  infoValue: { fontSize: 10, marginBottom: 3 },
  // Table
  table: { marginBottom: 20 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: '8 10', borderRadius: 4 },
  tableRow: { flexDirection: 'row', padding: '8 10', borderBottom: '0.5pt solid #e2e8f0' },
  colName: { flex: 3 },
  colQty: { flex: 1, textAlign: 'center' },
  colPrice: { flex: 1.5, textAlign: 'right' },
  colDiscount: { flex: 1, textAlign: 'right' },
  colTotal: { flex: 1.5, textAlign: 'right' },
  tableHeaderText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase' },
  itemName: { fontSize: 10, marginBottom: 2 },
  itemDesc: { fontSize: 8, color: '#64748b' },
  // Totals
  totalsBlock: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 24 },
  totalsTable: { width: 220 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalsLabel: { fontSize: 9, color: '#64748b' },
  totalsValue: { fontSize: 9 },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTop: '1.5pt solid #1e293b' },
  grandTotalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  grandTotalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  // Notes
  sectionLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  notesText: { fontSize: 9, color: '#334155', lineHeight: 1.5, marginBottom: 20 },
  // Footer
  footer: { position: 'absolute', bottom: 32, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between', borderTop: '0.5pt solid #e2e8f0', paddingTop: 8 },
  footerText: { fontSize: 8, color: '#94a3b8' },
})

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface ProposalPdfDocProps {
  proposal: Proposal
  company: Company | null
}

function ProposalPdfDoc({ proposal, company }: ProposalPdfDocProps) {
  const items: ProposalItem[] = (proposal.items ?? []).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            {company?.logo_url && (
              <Image src={company.logo_url} style={styles.companyLogo} />
            )}
          </View>
          <View style={styles.companyInfo}>
            {company?.name && <Text style={styles.companyName}>{company.name}</Text>}
            {company?.email && <Text style={styles.companyDetail}>{company.email}</Text>}
            {company?.phone && <Text style={styles.companyDetail}>{company.phone}</Text>}
            {company?.address && <Text style={styles.companyDetail}>{company.address}</Text>}
            {company?.website && <Text style={styles.companyDetail}>{company.website}</Text>}
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Proposal title & meta ── */}
        <View style={styles.titleBlock}>
          <Text style={styles.proposalNumber}>{proposal.proposal_number}</Text>
          <Text style={styles.proposalTitle}>{proposal.title}</Text>
        </View>

        {/* ── Client & dates ── */}
        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Prepared For</Text>
            {proposal.contact?.name && <Text style={styles.infoValue}>{proposal.contact.name}</Text>}
            {(proposal.contact as { company?: string } | null)?.company && (
              <Text style={styles.infoValue}>{(proposal.contact as { company?: string }).company}</Text>
            )}
            {proposal.contact?.email && <Text style={{ ...styles.infoValue, color: '#64748b' }}>{proposal.contact.email}</Text>}
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Proposal Details</Text>
            <Text style={styles.infoValue}>Date: {fmtDate(proposal.created_at)}</Text>
            {proposal.valid_until && <Text style={styles.infoValue}>Valid Until: {fmtDate(proposal.valid_until)}</Text>}
          </View>
        </View>

        {/* ── Line items table ── */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colName}><Text style={styles.tableHeaderText}>Item</Text></View>
            <View style={styles.colQty}><Text style={styles.tableHeaderText}>Qty</Text></View>
            <View style={styles.colPrice}><Text style={styles.tableHeaderText}>Unit Price</Text></View>
            <View style={styles.colDiscount}><Text style={styles.tableHeaderText}>Disc %</Text></View>
            <View style={styles.colTotal}><Text style={styles.tableHeaderText}>Total</Text></View>
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <View style={styles.colName}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.description && <Text style={styles.itemDesc}>{item.description}</Text>}
              </View>
              <View style={styles.colQty}><Text>{item.quantity}</Text></View>
              <View style={styles.colPrice}><Text>{money(item.unit_price, proposal.currency)}</Text></View>
              <View style={styles.colDiscount}><Text>{item.discount_pct > 0 ? `${item.discount_pct}%` : '—'}</Text></View>
              <View style={styles.colTotal}><Text>{money(item.total, proposal.currency)}</Text></View>
            </View>
          ))}
        </View>

        {/* ── Totals ── */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsTable}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{money(proposal.subtotal, proposal.currency)}</Text>
            </View>
            {proposal.discount_amount > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Discount</Text>
                <Text style={styles.totalsValue}>-{money(proposal.discount_amount, proposal.currency)}</Text>
              </View>
            )}
            {proposal.tax_rate > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Tax ({proposal.tax_rate}%)</Text>
                <Text style={styles.totalsValue}>{money(proposal.subtotal * proposal.tax_rate / 100, proposal.currency)}</Text>
              </View>
            )}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>{money(proposal.total_amount, proposal.currency)}</Text>
            </View>
          </View>
        </View>

        {/* ── Notes ── */}
        {proposal.notes && (
          <View>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.notesText}>{proposal.notes}</Text>
          </View>
        )}

        {/* ── Terms ── */}
        {proposal.terms && (
          <View>
            <Text style={styles.sectionLabel}>Terms & Conditions</Text>
            <Text style={styles.notesText}>{proposal.terms}</Text>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{proposal.proposal_number}</Text>
          <Text style={styles.footerText}>{company?.name ?? ''}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function renderProposalPdf(proposal: Proposal, company: Company | null): Promise<Buffer> {
  const element = React.createElement(ProposalPdfDoc, { proposal, company }) as Parameters<typeof renderToBuffer>[0]
  return renderToBuffer(element)
}
