const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const { Lexer } = require('../out/language/lexer'), { Parser } = require('../out/language/parser');
const { formatFlowLines } = require('../out/language/formatter'), { diagnoseFlow } = require('../out/language/diagnostics');
const { nativeCommands, gameCommands } = require('../out/language/catalog');
const fixtures = require('./fixtures/native-commands.json'), snippets = require('../snippets/flow.json');
const parse = source => new Parser(new Lexer(source).tokenise()).parse();
const wrap = command => `Feature: Customer's account\nScenario: Native workflow\nGiven "Open"\n flow.open "/";\nWhen "Act"\n ${command}\nThen "Check"\n flow.expect visible "Ready";\n`;
const defaults = value => value.replace(/\$\{\d+:([^}]+)\}/g, '$1').replace(/\$\d+/g, '');
test('snippets cover every supported native command and produce complete, parseable payloads', () => {
  const commands = Object.entries(nativeCommands).flatMap(([area, actions]) => actions.map(action => area+'.'+action));
  assert.equal(commands.length, 36); assert.deepEqual(commands.slice().sort(), Object.keys(fixtures).sort()); assert.equal(gameCommands.length, 13);
  for (const command of commands) {
    const snippet = Object.values(snippets).find(s => s.prefix === 'flow.'+command); assert(snippet, command);
    const body = defaults(Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body);
    assert.deepEqual(diagnoseFlow(wrap(body)), [], command); assert(parse(wrap(body)).length);
  }
  for (const snippet of Object.values(snippets).filter(s => !['Fea','Sce'].includes(s.prefix))) {
    const body = defaults(Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body);
    assert(parse(wrap(body)).length, snippet.prefix);
  }
});
function engineParser(root) {
  const cache = new Map();
  function load(name) {
    assert(['lexer','parser','assertion_contract'].includes(name)); if (cache.has(name)) return cache.get(name).exports;
    const filename = path.join(root, 'src/parser', name+'.ts'), source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = new Module(filename); cache.set(name, module);
    module.require = request => { assert(request.startsWith('./'), 'Only explicit parser dependencies may load'); return load(request.slice(2)); };
    module._compile(output, filename); return module.exports;
  }
  return source => new (load('parser').Parser)(new (load('lexer').Lexer)(source).tokenise()).parse();
}
function walk(folder) { return fs.existsSync(folder) ? fs.readdirSync(folder, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(folder, e.name)) : [path.join(folder,e.name)]) : []; }
for (const [engine, root] of [['OS', process.env.FLOWSTRIDE_OS_ROOT], ['Cloud', process.env.FLOWSTRIDE_CLOUD_ROOT]]) {
  test(`${engine}: formatter and diagnostics agree with the actual engine parser and shipped examples`, { skip: !root && 'Set the engine source path for integration parity' }, () => {
    const engineParse = engineParser(root);
    for (const [command, data] of Object.entries(fixtures)) for (const eol of ['\n','\r\n']) {
      const source = wrap('flow.'+command+' '+JSON.stringify(data,null,2)+';').replaceAll('\n',eol);
      const formatted = formatFlowLines(source).join(eol); assert.deepEqual(parse(formatted), engineParse(source), command); assert.deepEqual(diagnoseFlow(formatted), []);
    }
    const files = [...walk(path.join(root,'examples/native-workflows')), ...walk(path.join(root,'examples/native-game'))].filter(f => f.endsWith('.flow'));
    assert(files.length > 0, 'Engine examples must be present');
    for (const file of files) {
      const source = fs.readFileSync(file,'utf8'), formatted = formatFlowLines(source).join(source.includes('\r\n')?'\r\n':'\n');
      assert.deepEqual(parse(formatted),engineParse(source),file); assert.deepEqual(diagnoseFlow(formatted),[],file);
    }
    const and = wrap('flow.assert.that {"selector":"h1","condition":"visible"};').replace('When "Act"','When "Prepare"\n flow.open "/";\nAnd "Check"');
    assert.deepEqual(parse(and),engineParse(and)); assert.deepEqual(diagnoseFlow(and),[]);
    console.log(`${engine}: ${files.length} shipped flows and all 36 native commands matched.`);
  });
}
