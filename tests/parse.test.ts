import { expect, test } from 'claude-code/testing'

import { metrics, textBar } from '../hooks/format'
import { parseDf, parseIostatIdle, parseVmStat } from '../hooks/parse'

// Synthetic outputs in the shape macOS prints them.

const DF = `Filesystem     1024-blocks      Used Available Capacity  Mounted on
/dev/disk3s1s1   500000000  11000000 125000000     9%    /`

const VM_STAT = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                 500.
Pages active:                               100.
Pages inactive:                              50.
Pages speculative:                           10.
Pages throttled:                              0.
Pages wired down:                            40.
Pages purgeable:                             20.
"Translation faults":                    999999.
File-backed pages:                           60.
Anonymous pages:                            150.
Pages stored in compressor:                  90.
Pages occupied by compressor:                30.`

test('disk: used is the container size less what is available', () => {
  expect(parseDf(DF)).toEqual({ usedRatio: 0.75, freeBytes: 125000000 * 1024, totalBytes: 500000000 * 1024 })
  expect(parseDf('')).toBeNull()
})

test('memory: active + inactive + speculative + wired + compressed, less purgeable and file-backed', () => {
  // 100 + 50 + 10 + 40 + 30 - 20 - 60 = 150 pages
  expect(parseVmStat(VM_STAT, 16 * 2 ** 30)).toEqual({ usedBytes: 150 * 16384, totalBytes: 16 * 2 ** 30 })
  expect(parseVmStat(VM_STAT, Number.NaN)).toBeNull()
  expect(parseVmStat('', 16 * 2 ** 30)).toBeNull()
})

test('cpu: the idle column of an iostat report line', () => {
  expect(parseIostatIdle('      cpu    load average')).toBeNull()
  expect(parseIostatIdle(' us sy id   1m   5m   15m')).toBeNull()
  expect(parseIostatIdle(' 21 13 67  5.78 5.56 6.74')).toBe(67)
})

test('figures read as the band shows them', () => {
  expect(textBar(0.5)).toBe('████░░░░')
  expect(textBar(null)).toBe('░░░░░░░░')
  expect(metrics(null, null, null).map(m => m.value)).toEqual(['—', '—', '—'])
})
