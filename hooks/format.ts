import type { CpuStat, DiskStat, MemoryStat, NetworkStat } from '../types'

export type Level = 'ok' | 'warn' | 'high'

/** One item of the band: a gauge (a bar beside it) or a plain figure. */
export type Metric = {
  label: string
  value: string
  isGauge: boolean
  /** The gauge's fill, 0 to 1; null before the first sample. */
  ratio: number | null
}

const GB = 1e9 // disk sizes as Finder counts them
const GiB = 2 ** 30 // memory as Activity Monitor counts it
const NONE = '—'

export const THEME = { ok: 'success', warn: 'warning', high: 'error' } as const
const HEX: Record<Level, string> = { ok: '#2da44e', warn: '#d4a72c', high: '#e5534b' }

export const levelOf = (ratio: number): Level =>
  ratio >= 0.9 ? 'high' : ratio >= 0.75 ? 'warn' : 'ok'

const clamp = (ratio: number): number => Math.min(1, Math.max(0, ratio))
const percent = (ratio: number): string => `${Math.round(ratio * 100)}%`
// One decimal under ten, whole numbers above: 0, 0.4, 7.2, 64.
const amount = (n: number): string => (n < 10 ? String(Math.round(n * 10) / 10) : String(Math.round(n)))

export function rate(bytesPerSec: number): string {
  const kb = bytesPerSec / 1024

  return kb < 1024 ? `${amount(kb)}KB/s` : `${amount(kb / 1024)}MB/s`
}

export function metrics(
  disk: DiskStat | null,
  memory: MemoryStat | null,
  cpu: CpuStat | null,
  network: NetworkStat | null,
): Metric[] {
  const memoryRatio = memory && memory.usedBytes / memory.totalBytes

  return [
    {
      label: '디스크',
      isGauge: true,
      ratio: disk?.usedRatio ?? null,
      value: disk ? `${percent(disk.usedRatio)} · ${amount(disk.freeBytes / GB)}GB 남음` : NONE,
    },
    {
      label: '메모리',
      isGauge: true,
      ratio: memoryRatio,
      value:
        memory && memoryRatio !== null
          ? `${percent(memoryRatio)} · ${(memory.usedBytes / GiB).toFixed(1)}/${Math.round(memory.totalBytes / GiB)}GB`
          : NONE,
    },
    {
      label: 'CPU',
      isGauge: true,
      ratio: cpu?.usedRatio ?? null,
      value: cpu ? percent(cpu.usedRatio) : NONE,
    },
    {
      label: '네트워크',
      isGauge: false,
      ratio: null,
      value: network ? `↓${rate(network.downBytesPerSec)} ↑${rate(network.upBytesPerSec)}` : NONE,
    },
  ]
}

/** The terminal's gauge: eight cells of █ and ░. */
export function textBar(ratio: number | null, cells = 8): string {
  const filled = ratio === null ? 0 : Math.round(clamp(ratio) * cells)

  return '█'.repeat(filled) + '░'.repeat(cells - filled)
}

export const BAR_WIDTH = 60
export const BAR_HEIGHT = 12

/**
 * A graphical surface's gauge: the fill in its level's color over a dotted
 * track. Gray at partial opacity reads on a light and a dark theme alike.
 */
export function svgBar(ratio: number | null): string {
  const w = BAR_WIDTH
  const h = BAR_HEIGHT
  const fill = ratio === null ? 0 : Math.round(clamp(ratio) * w)
  const color = HEX[ratio === null ? 'ok' : levelOf(ratio)]

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    '<defs>',
    '<pattern id="dots" width="3" height="3" patternUnits="userSpaceOnUse">',
    '<rect width="1.5" height="1.5" fill="#888" fill-opacity="0.55"/>',
    '</pattern>',
    `<clipPath id="round"><rect width="${w}" height="${h}" rx="2"/></clipPath>`,
    '</defs>',
    '<g clip-path="url(#round)">',
    `<rect width="${w}" height="${h}" fill="#888" fill-opacity="0.12"/>`,
    `<rect width="${w}" height="${h}" fill="url(#dots)"/>`,
    `<rect width="${fill}" height="${h}" fill="${color}"/>`,
    '</g>',
    '</svg>',
  ].join('')
}
