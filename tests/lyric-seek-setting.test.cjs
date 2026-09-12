const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./helpers/load-typescript.cjs')({
  'electron-log/node': {},
  'node:url': require('node:url'),
  'node:path': require('node:path'),
  'node:os': require('node:os'),
})
const migrate = load('src/common/utils/migrateSetting.ts').default
const defaults = load('src/common/defaultSetting.ts').default

test('new and existing profiles enable the lyric seek guide once, preserving later opt-out', () => {
  const key = 'playDetail.isShowLyricProgressSetting'
  assert.equal(defaults[key], true)
  for (const version of ['1.0.0', '2.0.0', '2.1.0']) {
    const old = { version, [key]: false, 'player.volume': 0.37 }
    const updated = migrate(old)
    assert.equal(updated[key], true)
    assert.equal(updated.version, defaults.version)
    assert.equal(old[key], false, 'migration must not mutate the supplied settings')
    if (version !== '1.0.0') assert.equal(updated['player.volume'], 0.37)
    const optedOut = migrate({ ...updated, [key]: false })
    assert.equal(optedOut[key], false, 'a later restart must preserve explicit opt-out')
    assert.deepEqual(migrate(optedOut), optedOut)
  }
})
