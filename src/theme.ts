/**
 * v1.7.2 (2026-10-15)
 * 改动：运行时主色，由基色生成 pine 系列 CSS 变量。
 */

export const DEFAULT_PINE = '#145C38'
export const PINE_KEY = 'softdo-pine-color'
export const PINE_SWATCHES = [
  '#0B3D26',
  '#145C38',
  '#1F7A4D',
  '#0F766E',
  '#3F6B4A',
  '#5C6B2F',
] as const

export function normalizeHex(input: string): string {
  const raw = input.trim().replace('#', '')
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw.split('').map((c) => c + c).join('').toUpperCase()}`
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toUpperCase()}`
  }
  return DEFAULT_PINE
}

function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex).slice(1)
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  const ch = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${ch(r)}${ch(g)}${ch(b)}`.toUpperCase()
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}

function toChannels(hex: string): string {
  return hexToRgb(hex).join(' ')
}

export function applyPineTheme(hex: string) {
  const base = normalizeHex(hex)
  const root = document.documentElement
  root.style.setProperty('--pine', toChannels(base))
  root.style.setProperty('--pine-deep', toChannels(mix(base, '#000000', 0.32)))
  root.style.setProperty('--pine-soft', toChannels(mix(base, '#FFFFFF', 0.88)))
  root.style.setProperty('--pine-line', toChannels(mix(base, '#FFFFFF', 0.72)))
  root.style.setProperty('--pine-mist', toChannels(mix(base, '#FFFFFF', 0.42)))
}

export function readSavedPine(): string {
  try {
    const saved = localStorage.getItem(PINE_KEY)
    return saved ? normalizeHex(saved) : DEFAULT_PINE
  } catch {
    return DEFAULT_PINE
  }
}
