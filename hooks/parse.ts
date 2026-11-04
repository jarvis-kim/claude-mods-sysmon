import type { DiskStat, MemoryStat } from '../types'

export type NetCounters = { inBytes: number; outBytes: number }

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

/**
 * `netstat -ibn`: the byte counters of the physical `en*` interfaces (Wi-Fi,
 * Ethernet). Tunnels such as a VPN's utun carry the same traffic again, and
 * lo0 never leaves the machine, so both are left out.
 */
export function parseNetstat(out: string): NetCounters | null {
  let inBytes = 0
  let outBytes = 0
  let isSeen = false
  for (const line of out.split('\n')) {
    const cols = line.trim().split(/\s+/)
    if (!/^en\d+\*?$/.test(cols[0] ?? '') || !cols[2]?.startsWith('<Link#')) continue
    // ... Ibytes Opkts Oerrs Obytes Coll: counted from the end, as Address may be empty.
    const ibytes = Number(cols.at(-5))
    const obytes = Number(cols.at(-2))
    if (!Number.isFinite(ibytes) || !Number.isFinite(obytes)) continue
    inBytes += ibytes
    outBytes += obytes
    isSeen = true
  }

  return isSeen ? { inBytes, outBytes } : null
}

/** One report line of `iostat -n 0`: `us sy id 1m 5m 15m`; the idle percent. */
export function parseIostatIdle(line: string): number | null {
  const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s/.exec(line)

  return match ? Number(match[3]) : null
}
