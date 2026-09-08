const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./helpers/load-typescript.cjs')()
const { buildTimeline } = load('src/optional-plugins/folia-lyrics/timeline.ts')

test('LX word timestamps retain their offset and duration in Folia seconds', () => {
  const [line] = buildTimeline([{ time: 4200, text: '<0,300>晚<350,700>风', extendedLyrics: ['Evening breeze', 'wan feng'] }], 30)
  assert.deepEqual(line.words, [
    { text: '晚', startTime: 4.2, endTime: 4.5 },
    { text: '风', startTime: 4.55, endTime: 5.25 },
  ])
  assert.equal(line.fullText, '晚风')
  assert.equal(line.endTime, 5.25)
  assert.equal(line.translation, 'Evening breeze\nwan feng')
})
test('plain LRC uses line boundaries and the track duration without fabricating word timing', () => {
  const lines = buildTimeline([{ time: 1000, text: 'first line', extendedLyrics: [] }, { time: 6000, text: 'last line', extendedLyrics: [] }], 12)
  assert.deepEqual(lines.map(line => [line.startTime, line.endTime, line.words.length]), [[1, 6, 1], [6, 12, 1]])
})
test('timelines clear on an empty track and ignore malformed timestamps', () => {
  assert.deepEqual(buildTimeline([], 0), [])
  assert.deepEqual(buildTimeline([{ time: NaN, text: 'bad' }, { time: -10, text: 'bad' }], 0), [])
  const [line] = buildTimeline([{ time: 5000, text: 'short track', extendedLyrics: [] }], 0)
  assert.ok(line.endTime > line.startTime)
})
