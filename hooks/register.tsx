import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { BAR_HEIGHT, BAR_WIDTH, THEME, levelOf, metrics, svgBar, textBar } from './format'
import { parseDf, parseIostatIdle, parseVmStat } from './parse'

// The samplers write these and the band reads them. Change a tag when its
// value's fields change: a stored value under another tag reads as null.
const disk = atom({ plugin: 'sysmon', key: 'disk' } as const, null, { shape: 'disk-1' })
const memory = atom({ plugin: 'sysmon', key: 'memory' } as const, null, { shape: 'memory-1' })
const cpu = atom({ plugin: 'sysmon', key: 'cpu' } as const, null, { shape: 'cpu-1' })

const SAMPLE_MS = 2000
// Free disk space moves slowly: every 15th sample, so every 30 seconds.
const DISK_EVERY = 15

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    startSampling($)

    return started
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const list = metrics(await read($, disk), await read($, memory), await read($, cpu))

    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)

      return (
        <Box flexWrap="wrap" columnGap={3}>
          {list.map(m => (
            <Text>
              <Text dimColor>{m.label} </Text>
              <Text color={m.ratio === null ? 'inactive' : THEME[levelOf(m.ratio)]}>{textBar(m.ratio)} </Text>
              {m.value}
            </Text>
          ))}
        </Box>
      )
    }

    const { Box, Svg, Text } = $.ui.resolve(e)

    return (
      <Box flexWrap="wrap" alignItems="center" columnGap={3}>
        {list.map(m => (
          <Box alignItems="center" columnGap={1}>
            <Text dimColor>{m.label}</Text>
            <Svg source={svgBar(m.ratio)} alt={`${m.label} ${m.value}`} width={BAR_WIDTH} height={BAR_HEIGHT} />
            <Text>{m.value}</Text>
          </Box>
        ))}
      </Box>
    )
  })
}

/**
 * Starts the samplers for the session's life. A reload of the module cancels
 * the timer and kills iostat; the new module's session.start starts them again.
 *
 * A command that cannot run (not macOS) blanks its figure to "—" rather than
 * leaving a stale one.
 */
function startSampling($: EngineInterface): void {
  void followCpu($)

  let totalMemory: number | null = null
  let tick = 0
  let isBusy = false

  const sampleMemory = async (): Promise<void> => {
    totalMemory ??= Number((await $.process.run(['sysctl', '-n', 'hw.memsize'])).stdout)
    const value = parseVmStat((await $.process.run(['vm_stat'])).stdout, totalMemory)
    await update($, memory, () => value)
  }

  const sampleDisk = async (): Promise<void> => {
    const value = parseDf((await $.process.run(['df', '-Pk', '/'])).stdout)
    await update($, disk, () => value)
  }

  const sample = async (): Promise<void> => {
    if (isBusy) return
    isBusy = true
    try {
      await Promise.all([
        sampleMemory().catch(() => update($, memory, () => null)),
        tick % DISK_EVERY === 0 ? sampleDisk().catch(() => update($, disk, () => null)) : undefined,
      ])
      tick += 1
    } finally {
      isBusy = false
    }
  }

  void sample()
  $.clock.every(SAMPLE_MS, () => void sample())
}

/**
 * CPU from one long-lived `iostat`, which reports busy time per interval
 * without a process started for every sample.
 */
async function followCpu($: EngineInterface): Promise<void> {
  try {
    const reports = $.process.spawn({ argv: ['iostat', '-n', '0', '-w', String(SAMPLE_MS / 1000)] })
    let pending = ''
    let isFirst = true
    for await (const { stream, text } of reports) {
      if (stream !== 'stdout') continue
      const lines = (pending + text).split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) {
        const idle = parseIostatIdle(line)
        if (idle === null) continue
        // The first report averages since boot; each one after covers its interval.
        if (isFirst) {
          isFirst = false
          continue
        }
        await update($, cpu, () => ({ usedRatio: 1 - idle / 100 }))
      }
    }
  } catch {
    // iostat could not start (not macOS) or the module unloaded: blanked below.
  }
  // No figure rather than a stale one; after an unload the write may fail, which is fine.
  await update($, cpu, () => null).catch(() => undefined)
}
