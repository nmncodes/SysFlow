import { jsPDF } from 'jspdf'
import type { Finding, PricingEstimate, SimulationSummary } from './api'

interface ReportInput {
  projectName: string
  nodes: { id: string; label: string; type: string }[]
  edges: { source: string; target: string }[]
  findings: Finding[]
  aiEnabled: boolean
  simSummary: SimulationSummary | null
  estimatedMonthlyCost: number
  realPricing: PricingEstimate | null
}

const SEVERITY_LABEL: Record<Finding['severity'], string> = { critical: 'CRITICAL', warning: 'WARNING', info: 'INFO' }
const SEVERITY_COLOR: Record<Finding['severity'], [number, number, number]> = {
  critical: [220, 38, 38],
  warning: [217, 119, 6],
  info: [82, 82, 91],
}

function addPageIfNeeded(doc: jsPDF, y: number, margin: number, needed = 20): number {
  if (y + needed <= doc.internal.pageSize.getHeight() - margin) return y
  doc.addPage()
  return margin
}

export function generateReport(input: ReportInput): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 48
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - margin * 2
  let y = margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(24, 24, 27)
  doc.text('SysFlow', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(140, 140, 150)
  doc.text('System design report', pageWidth - margin, y, { align: 'right' })
  y += 28

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(24, 24, 27)
  doc.text(input.projectName, margin, y)
  y += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(140, 140, 150)
  doc.text(`Generated ${new Date().toLocaleString()} · ${input.nodes.length} components, ${input.edges.length} connections`, margin, y)
  y += 24
  doc.setDrawColor(228, 228, 231)
  doc.line(margin, y, pageWidth - margin, y)
  y += 24

  // --- Simulation summary ---
  if (input.simSummary) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(24, 24, 27)
    doc.text('Simulation results', margin, y)
    y += 18

    const rows: [string, string][] = [
      ['Avg throughput', `${Math.round(input.simSummary.avgRps).toLocaleString()} rps`],
      ['p95 latency', `${Math.round(input.simSummary.avgP95)} ms`],
      ['Error rate', `${input.simSummary.avgErrorRatePct.toFixed(1)}%`],
      ['Bottleneck load', `${Math.round(input.simSummary.bottleneckLoadPct)}%${input.simSummary.bottleneckNodeId ? ` (${input.simSummary.bottleneckNodeId})` : ''}`],
      ['Single points of failure', input.simSummary.singlePointsOfFailure.length ? input.simSummary.singlePointsOfFailure.join(', ') : 'None'],
    ]
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    for (const [label, value] of rows) {
      y = addPageIfNeeded(doc, y, margin)
      doc.setTextColor(120, 120, 130)
      doc.text(label, margin, y)
      doc.setTextColor(40, 40, 45)
      doc.text(value, margin + 170, y)
      y += 16
    }
    y += 12
  }

  // --- Cost ---
  y = addPageIfNeeded(doc, y, margin, 40)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(24, 24, 27)
  doc.text('Estimated cost', margin, y)
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(120, 120, 130)
  doc.text('Illustrative estimate', margin, y)
  doc.setTextColor(40, 40, 45)
  doc.text(`$${input.estimatedMonthlyCost.toLocaleString()}/mo`, margin + 170, y)
  y += 16

  if (input.realPricing) {
    doc.setTextColor(120, 120, 130)
    doc.text(`Real pricing (${input.realPricing.region})`, margin, y)
    doc.setTextColor(40, 40, 45)
    doc.text(`$${input.realPricing.totalMonthlyCostUsd.toFixed(2)}/mo`, margin + 170, y)
    y += 20

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(140, 140, 150)
    doc.text('Component', margin, y)
    doc.text('Source', margin + 260, y)
    doc.text('Monthly cost', pageWidth - margin, y, { align: 'right' })
    y += 12
    doc.setFont('helvetica', 'normal')
    for (const node of input.realPricing.nodes) {
      y = addPageIfNeeded(doc, y, margin)
      doc.setFontSize(9.5)
      doc.setTextColor(60, 60, 68)
      doc.text(node.id, margin, y)
      doc.setTextColor(node.source === 'real' ? 16 : 140, node.source === 'real' ? 122 : 140, node.source === 'real' ? 87 : 150)
      doc.text(node.source === 'real' ? 'Live Azure price' : 'Illustrative', margin + 260, y)
      doc.setTextColor(60, 60, 68)
      doc.text(`$${node.monthlyCostUsd.toFixed(2)}`, pageWidth - margin, y, { align: 'right' })
      y += 12
      doc.setFontSize(8)
      doc.setTextColor(160, 160, 168)
      const noteLines = doc.splitTextToSize(node.note, contentWidth)
      for (const line of noteLines) {
        y = addPageIfNeeded(doc, y, margin)
        doc.text(line, margin, y)
        y += 11
      }
      y += 4
    }
  }
  y += 12

  // --- Findings ---
  y = addPageIfNeeded(doc, y, margin, 40)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(24, 24, 27)
  doc.text(`AI advisory findings${input.aiEnabled ? '' : ' (rule-based)'}`, margin, y)
  y += 18

  if (input.findings.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(120, 120, 130)
    doc.text('No findings — no analysis was run, or the design has no flagged issues.', margin, y)
    y += 16
  }

  for (const finding of input.findings) {
    y = addPageIfNeeded(doc, y, margin, 60)
    const [r, g, b] = SEVERITY_COLOR[finding.severity]
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(r, g, b)
    doc.text(SEVERITY_LABEL[finding.severity], margin, y)
    doc.setTextColor(24, 24, 27)
    doc.text(finding.title, margin + 62, y)
    y += 14

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(90, 90, 98)
    const explanationLines = doc.splitTextToSize(finding.explanation, contentWidth)
    for (const line of explanationLines) {
      y = addPageIfNeeded(doc, y, margin)
      doc.text(line, margin, y)
      y += 13
    }

    doc.setTextColor(124, 58, 237)
    const recLines = doc.splitTextToSize(`Recommendation: ${finding.recommendation}`, contentWidth)
    for (const line of recLines) {
      y = addPageIfNeeded(doc, y, margin)
      doc.text(line, margin, y)
      y += 13
    }
    y += 10
  }

  doc.save(`${input.projectName.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'sysflow-report'}.pdf`)
}
