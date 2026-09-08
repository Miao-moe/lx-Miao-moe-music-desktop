const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const ts = require('typescript')

// Copy the rendering dependency graph, retaining upstream files byte for byte.
const upstream = path.resolve(process.argv[2] || '../folia-major-main/folia-major-main')
const destination = path.resolve(__dirname, '../../src/optional-plugins/folia-lyrics/engine/vendor')
const visualizers = path.join(upstream, 'src/components/visualizer')
const adapted = ['src/components/visualizer/VisualizerShell.tsx', 'src/hooks/usePlayerBottomBarBottomPx.ts', 'src/services/temperaLayerImages.ts']
const aliases = new Set(adapted.map(name => path.join(upstream, name)))
const files = new Set()
const resolve = base => [base, ...['.ts', '.tsx', '.js', '.json', '.css', '/index.ts', '/index.tsx'].map(extension => base + extension)].find(filename => fs.existsSync(filename) && fs.statSync(filename).isFile())
function visit(base) {
  const filename = resolve(base)
  if (!filename) throw new Error(`Unresolved Folia source: ${base}`)
  if (files.has(filename)) return
  if (!filename.startsWith(upstream + path.sep)) throw new Error('Folia import escaped its source directory')
  files.add(filename)
  if (aliases.has(filename) || !/\.[tj]sx?$/.test(filename)) return
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const ast = ts.createSourceFile(filename, output, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const scan = node => {
    let specifier
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier?.text
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) specifier = node.arguments[0]?.text
    if (specifier?.startsWith('.')) visit(path.resolve(path.dirname(filename), specifier))
    else if (specifier?.startsWith('@/')) visit(path.join(upstream, 'src', specifier.slice(2)))
    ts.forEachChild(node, scan)
  }
  scan(ast)
}
const modes = []
for (const entry of fs.readdirSync(visualizers, { withFileTypes: true })) {
  const filename = path.join(visualizers, entry.name, 'entry.tsx')
  if (!entry.isDirectory() || !fs.existsSync(filename)) continue
  const source = fs.readFileSync(filename, 'utf8')
  const renderer = /import\('(.+?)'\)/.exec(source)?.[1]
  if (!renderer) throw new Error(`Missing renderer for ${entry.name}`)
  modes.push({ id: entry.name, renderer: `./vendor/src/components/visualizer/${entry.name}/${renderer.replace(/^\.\//, '')}`, label: /labelFallback: '([^']+)'/.exec(source)?.[1] })
  visit(path.join(visualizers, entry.name, renderer))
}
for (const folder of ['emo', 'avatar']) {
  const directory = path.join(visualizers, 'cappella', folder)
  for (const name of fs.readdirSync(directory)) if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) files.add(path.join(directory, name))
}
files.add(path.join(upstream, 'LICENSE'))
files.add(path.join(upstream, 'src/utils/frameRateLimiter.ts'))
const manifest = []
for (const filename of [...files].sort()) {
  const relative = path.relative(upstream, filename).replaceAll(path.sep, '/')
  const data = fs.readFileSync(filename)
  const target = path.join(destination, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, data)
  manifest.push({ path: relative, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') })
}
fs.writeFileSync(path.join(destination, 'upstream.json'), JSON.stringify({ project: 'Folia', version: JSON.parse(fs.readFileSync(path.join(upstream, 'package.json'))).version, repository: 'https://github.com/chthollyphile/folia-major', adapted, files: manifest }, null, 2) + '\n')
fs.writeFileSync(path.join(destination, '../modes.json'), JSON.stringify(modes, null, 2) + '\n')
console.log(`Imported ${modes.length} Folia renderers and ${files.size} source/asset files`)
