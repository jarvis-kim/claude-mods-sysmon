import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'sysmon',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 6,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 6 },
    view: {},
  },
} as const

const GiB = 2 ** 30
const STORED = {
  disk: { shape: 'disk-1', value: { usedRatio: 0.75, freeBytes: 64e9, totalBytes: 256e9 } },
  memory: { shape: 'memory-1', value: { usedBytes: 7.2 * GiB, totalBytes: 16 * GiB } },
  cpu: { shape: 'cpu-1', value: { usedRatio: 0.64 } },
}

test('the band shows disk, memory and CPU on terminal and desktop', async ($, on) => {
  on('state.get', (_, e) => ({ value: { value: STORED[e.key], version: 1 } }))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text).join(' | ')

    expect(texts).toMatch(/75% · 64GB 남음/)
    expect(texts).toMatch(/45% · 7\.2\/16GB/)
    expect(texts).toMatch(/64%/)
    expect(texts).not.toMatch(/네트워크/)
    await ui.unmount()
  }
})

test('a figure not sampled yet, or stored by an earlier shape, reads as a dash', async ($, on) => {
  on('state.get', (_, e) =>
    e.key === 'cpu'
      ? { value: { value: { usedRatio: 0.5 }, version: 1 } }
      : { value: { value: undefined, version: 0 } },
  )

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text).join(' | ')

    expect(texts).toMatch(/CPU.*—/)
    expect(texts).not.toMatch(/50%/)
    await ui.unmount()
  }
})

test('the band yields to a survey', async ($, on) => {
  // Nothing draws beneath the mod: this hook stands for the engine.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>survey</Text>
  })

  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'desktop' })

  expect((await ui.find({ type: 'Text', text: /survey/ }))?.text).toBe('survey')
  await ui.unmount()
})
