process.env.NODE_ENV = 'production'

const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { gzipSync } = require('node:zlib')
const webpack = require('webpack')
const { VueLoaderPlugin } = require('vue-loader')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const base = require('../renderer/webpack.config.base')

const root = path.resolve(__dirname, '../..')
const outputRoot = path.join(root, 'build/optional-plugins')
const catalogRoot = path.join(root, 'plugins/official')
const ids = ['sound-effects', 'audio-visualizer']
const sha256 = data => createHash('sha256').update(data).digest('hex')
const externals = Object.fromEntries(Object.entries({
  vue: 'vue',
  '@common/utils/vueTools': 'vue',
  '@renderer/plugins/player': 'player',
  '@renderer/store/setting': 'settings',
  '@renderer/store/player/state': 'playerState',
  '@renderer/utils/ipc': 'ipc',
  '@renderer/plugins/Dialog': 'dialog',
  '@renderer/core/lyric': 'lyric',
  '@lyric/store/state': 'lyricState',
  '@lyric/core/mainWindowChannel': 'lyricChannel',
}).map(([name, value]) => [name, 'window.__lxPluginHost.' + value]))

const compile = config => new Promise((resolve, reject) => {
  const compiler = webpack(config)
  compiler.run((error, stats) => {
    compiler.close(() => {
      if (error) reject(error)
      else if (stats.hasErrors()) reject(new Error(stats.toString({ all: false, errors: true, errorDetails: true })))
      else resolve()
    })
  })
})

const readFiles = async(directory, prefix = '') => {
  const files = []
  for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const name = prefix + entry.name
    if (entry.isDirectory()) files.push(...await readFiles(path.join(directory, entry.name), name + '/'))
    else files.push({ path: name, data: await fs.readFile(path.join(directory, entry.name)) })
  }
  return files
}

async function main() {
  const requested = process.argv.slice(2)
  if (requested.some(id => !ids.includes(id))) throw new Error('Unknown plugin ID')
  const selected = requested.length ? ids.filter(id => requested.includes(id)) : ids
  const catalog = requested.length ? JSON.parse(await fs.readFile(path.join(catalogRoot, 'catalog.json'), 'utf8')) : { schemaVersion: 1, plugins: [] }
  catalog.plugins = catalog.plugins.filter(plugin => !selected.includes(plugin.id))
  for (const id of selected) {
    const source = path.join(root, 'src/optional-plugins', id)
    const manifest = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8'))
    if (manifest.id !== id || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Invalid plugin manifest')
    const output = path.resolve(outputRoot, id)
    if (!output.startsWith(outputRoot + path.sep)) throw new Error('Unsafe plugin build output')
    await fs.rm(output, { recursive: true, force: true })
    const entry = { renderer: path.join(source, 'index.ts') }
    if (manifest.lyricEntry) entry.lyric = path.join(source, 'lyric.ts')
    await compile({
      ...base,
      context: root,
      mode: 'production',
      entry,
      devtool: false,
      output: { path: output, filename: '[name].js', publicPath: '', library: { type: 'commonjs2' } },
      externalsType: 'var',
      externals,
      module: {
        ...base.module,
        rules: [...base.module.rules.map(rule => rule.test?.test('entry.ts') ? {
          ...rule,
          use: { loader: 'ts-loader', options: { appendTsSuffixTo: [/\.vue$/], configFile: path.join(root, 'src/optional-plugins/tsconfig.json'), transpileOnly: true } },
        } : rule), {
          test: /audiomotion-analyzer[\\/]src[\\/]audioMotion-analyzer\.js$/,
          use: path.join(__dirname, 'audiomotion-loader.js'),
        }],
      },
      optimization: { minimize: true, splitChunks: false, runtimeChunk: false },
      plugins: [
        new VueLoaderPlugin(),
        new MiniCssExtractPlugin({ filename: '[name].css' }),
        new webpack.DefinePlugin({ __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' }),
      ],
      node: { __dirname: false, __filename: false },
    })
    if (id === 'sound-effects') {
      await fs.cp(path.join(source, 'filters'), path.join(output, 'filters'), { recursive: true })
      await fs.cp(path.join(source, 'pitch-shifter'), path.join(output, 'pitch-shifter'), { recursive: true })
      const workletPath = path.join(output, 'pitch-shifter/phase-vocoder.js')
      const worklet = (await fs.readFile(workletPath, 'utf8')).replace("from './fft'", "from './fft.js'").replace("from './ola-processor'", "from './ola-processor.js'").replaceAll('phase-vocoder-processor', `lx-sound-effects-${manifest.version}`)
      await fs.writeFile(workletPath, worklet)
    }
    if (id === 'audio-visualizer') {
      const licenses = path.join(output, 'licenses')
      await fs.mkdir(licenses, { recursive: true })
      await fs.copyFile(path.join(root, 'node_modules/audiomotion-analyzer/LICENSE'), path.join(licenses, 'audioMotion-AGPL-3.0.txt'))
      await fs.copyFile(path.join(source, 'NOTICE.md'), path.join(output, 'NOTICE.md'))
    }
    const files = await readFiles(output)
    manifest.files = files.map(file => ({ path: file.path, bytes: file.data.length, sha256: sha256(file.data) }))
    const archive = gzipSync(Buffer.from(JSON.stringify({ manifest, files: Object.fromEntries(files.map(file => [file.path, file.data.toString('base64')])) })), { level: 9 })
    const hash = sha256(archive)
    const relative = `${id}/${manifest.version}/${hash}.lxplugin`
    const filename = path.join(catalogRoot, relative)
    await fs.mkdir(path.dirname(filename), { recursive: true })
    await fs.writeFile(filename, archive)
    catalog.plugins.push({ id, version: manifest.version, apiVersion: manifest.apiVersion, path: relative, bytes: archive.length, sha256: hash })
    console.log(`Built ${id} ${manifest.version}: ${archive.length} bytes`)
  }
  catalog.plugins.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
  await fs.writeFile(path.join(catalogRoot, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n')
  console.log('Official catalog written to plugins/official/catalog.json')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
