const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

module.exports = function loader(overrides = {}) {
  const cache = new Map()
  const load = filename => {
    filename = path.resolve(filename)
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText
    const execute = vm.runInThisContext('(function(require,module,exports){' + code + '\n})', { filename })
    execute(name => {
      if (Object.hasOwn(overrides, name)) return overrides[name]
      if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name + '.ts'))
      throw Error('Unexpected dependency: ' + name)
    }, module, module.exports)
    return module.exports
  }
  return load
}
