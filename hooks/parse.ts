import type { DiskStat, MemoryStat } from '../types'

/**
 * `df -Pk /`. APFS volumes share one container, so used is the container's
 * size less what is still available, not the volume's own "Used" column.
 */
export function parseDf(out: string): DiskStat | null {
  const cols = out.trim().split('\n')[1]?.trim().split(/\s+/) ?? []
  const totalBytes = Number(cols[1]) * 1024
  const freeBytes = Number(cols[3]) * 1024
  if (!(totalBytes > 0) || !Number.isFinite(freeBytes)) return null

  return { usedRatio: (totalBytes - freeBytes) / totalBytes, freeBytes, totalBytes }
}

/**
 * `vm_stat`, counted the way Activity Monitor's "Memory Used" and the Stats
 * app count it: active + inactive + speculative + wired + compressed, less
 * purgeable and file-backed pages.
 */
export function parseVmStat(out: string, totalBytes: number): MemoryStat | null {
  const pageSize = Number(/page size of (\d+) bytes/.exec(out)?.[1])
  const pages = (label: string): number =>
    Number(new RegExp(`^${label}:\\s+(\\d+)`, 'm').exec(out)?.[1])
  const usedPages =
    pages('Pages active') +
    pages('Pages inactive') +
    pages('Pages speculative') +
    pages('Pages wired down') +
    pages('Pages occupied by compressor') -
    pages('Pages purgeable') -
    pages('File-backed pages')
  if (!(pageSize > 0) || !(totalBytes > 0) || !Number.isFinite(usedPages)) return null

  return { usedBytes: usedPages * pageSize, totalBytes }
}

/** One report line of `iostat -n 0`: `us sy id 1m 5m 15m`; the idle percent. */
export function parseIostatIdle(line: string): number | null {
  const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s/.exec(line)

  return match ? Number(match[3]) : null
}
