import logoUrl from '../assets/logo.png'

interface BrandedExportOptions {
  projectName: string
  nodeCount: number
  edgeCount: number
  estimatedMonthlyCost?: number
}

const HEADER_HEIGHT = 96
const FOOTER_HEIGHT = 44
const PADDING_X = 40

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Composes the raw canvas screenshot (from html-to-image) with a branded header/footer band
 * onto an offscreen <canvas>, then downloads the result — for sharing on a portfolio or with
 * an interviewer, distinct from the plain unbranded PNG export.
 */
export async function exportBrandedImage(canvasScreenshotDataUrl: string, opts: BrandedExportOptions): Promise<void> {
  const [shot, logo] = await Promise.all([loadImage(canvasScreenshotDataUrl), loadImage(logoUrl)])

  const scale = 2
  const width = shot.width
  const height = shot.height + (HEADER_HEIGHT + FOOTER_HEIGHT) * scale

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // Header
  const headerH = HEADER_HEIGHT * scale
  const padX = PADDING_X * scale
  const logoSize = 40 * scale
  ctx.drawImage(logo, padX, (headerH - logoSize) / 2, logoSize, logoSize)

  ctx.fillStyle = '#18181b'
  ctx.font = `${22 * scale}px -apple-system, "Segoe UI", sans-serif`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(opts.projectName, padX + logoSize + 16 * scale, headerH / 2 - 2 * scale)

  ctx.fillStyle = '#71717a'
  ctx.font = `${13 * scale}px -apple-system, "Segoe UI", sans-serif`
  const subtitleParts = [`${opts.nodeCount} components`, `${opts.edgeCount} connections`]
  if (opts.estimatedMonthlyCost !== undefined) subtitleParts.push(`~$${opts.estimatedMonthlyCost.toLocaleString()}/mo`)
  ctx.fillText(subtitleParts.join('  ·  '), padX + logoSize + 16 * scale, headerH / 2 + 18 * scale)

  ctx.strokeStyle = '#e4e4e7'
  ctx.lineWidth = 1 * scale
  ctx.beginPath()
  ctx.moveTo(0, headerH)
  ctx.lineTo(width, headerH)
  ctx.stroke()

  // Canvas screenshot
  ctx.drawImage(shot, 0, headerH)

  // Footer
  const footerY = headerH + shot.height
  ctx.strokeStyle = '#e4e4e7'
  ctx.beginPath()
  ctx.moveTo(0, footerY)
  ctx.lineTo(width, footerY)
  ctx.stroke()

  ctx.fillStyle = '#a1a1aa'
  ctx.font = `${11 * scale}px -apple-system, "Segoe UI", sans-serif`
  ctx.fillText('Designed with SysFlow', padX, footerY + FOOTER_HEIGHT * scale / 2 + 4 * scale)

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = `${opts.projectName.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'sysflow-architecture'}.png`
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}
