import { expect, test } from 'claude-code/testing'

import { metrics, rate, textBar } from '../hooks/format'
import { parseDf, parseIostatIdle, parseNetstat, parseVmStat } from '../hooks/parse'

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

const NETSTAT = `Name       Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll
lo0        16384 <Link#1>                           100     0       5000      100     0       5000     0
en0        1500  <Link#14>   aa:bb:cc:dd:ee:01     2000     0    3000000     1000     0     600000     0
en0        1500  192.168.0/24  192.168.0.10        2000     -    3000000     1000     -     600000     -
en1        1500  <Link#10>   aa:bb:cc:dd:ee:02       10     0       1000       20     0       2000     0
en4*       1500  <Link#7>    aa:bb:cc:dd:ee:03        0     0          0        0     0          0     0
utun4      1380  <Link#20>                          500     0     900000      400     0     500000     0`

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

test('network: only the en* link rows count, so neither lo0 nor a VPN tunnel is added twice', () => {
  expect(parseNetstat(NETSTAT)).toEqual({ inBytes: 3001000, outBytes: 602000 })
  expect(parseNetstat('Name Mtu Network Address')).toBeNull()
})

test('cpu: the idle column of an iostat report line', () => {
  expect(parseIostatIdle('      cpu    load average')).toBeNull()
  expect(parseIostatIdle(' us sy id   1m   5m   15m')).toBeNull()
  expect(parseIostatIdle(' 21 13 67  5.78 5.56 6.74')).toBe(67)
})

test('figures read as the band shows them', () => {
  expect(rate(0)).toBe('0KB/s')
  expect(rate(1536)).toBe('1.5KB/s')
  expect(rate(5 * 1024 * 1024)).toBe('5MB/s')
  expect(textBar(0.5)).toBe('████░░░░')
  expect(textBar(null)).toBe('░░░░░░░░')
  expect(metrics(null, null, null, null).map(m => m.value)).toEqual(['—', '—', '—', '—'])
})
