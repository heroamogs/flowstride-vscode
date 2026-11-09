const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const { Lexer } = require('../out/language/lexer'), { Parser } = require('../out/language/parser');
const { formatFlowLines } = require('../out/language/formatter'), { diagnoseFlow } = require('../out/language/diagnostics');
const { nativeMethods, gameCommands } = require('../out/language/catalog');
const { wrap, snippetBody } = require('./helpers/flows.cjs');
const fixtures = require('./fixtures/native-commands.json'), snippets = require('../snippets/flow.json');
const parse = source => new Parser(new Lexer(source).tokenise()).parse();
const commandSnippets = Object.values(snippets).filter(snippet => !['Fea', 'Sce'].includes(snippet.prefix));
test('snippets cover every supported native command and produce complete, parseable payloads', () => {
  const commands = [...nativeMethods, 'scroll'];
  assert.equal(Object.values(fixtures).filter(data => typeof data === 'object').length, 65);
  assert.deepEqual(commands.sort(), Object.keys(fixtures).sort());
  assert.equal(gameCommands.length, 13);
  for (const command of commands) assert(commandSnippets.some(snippet => snippet.prefix === 'flow.' + command), command);
  for (const snippet of commandSnippets) {
    const source = wrap(snippetBody(snippet));
    assert.deepEqual(diagnoseFlow(source), [], snippet.prefix);
    assert(parse(source).length, snippet.prefix);
  }
});
function engineParser(root) {
  const cache = new Map();
  const allowed = new Set(['parser/lexer', 'parser/parser', 'parser/assertion_contract', 'native/workflow_tags', 'native/interactions']);
  function load(name) {
    assert(allowed.has(name), 'Only explicit parser dependencies may load: ' + name);
    if (cache.has(name)) return cache.get(name).exports;
    const filename = path.join(root, 'src', name + '.ts');
    let source = fs.readFileSync(filename, 'utf8');
    if (name === 'native/interactions') {
      // Load the engine's pure key validator without browser or runtime dependencies.
      const start = source.indexOf('const modifiers =');
      const end = source.indexOf('export interface InteractionControl');
      assert(start >= 0 && end > start, 'Could not find the engine keyboard contract');
      source = source.slice(start, end);
    }
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = new Module(filename); cache.set(name, module);
    module.require = request => load(path.posix.join(path.posix.dirname(name), request));
    module._compile(output, filename); return module.exports;
  }
  return (source, fragment = false) => {
    const parser = new (load('parser/parser').Parser)(new (load('parser/lexer').Lexer)(source).tokenise());
    return fragment ? parser.parseFragment() : parser.parse();
  };
}
function walk(folder) { return fs.existsSync(folder) ? fs.readdirSync(folder, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(folder, e.name)) : [path.join(folder,e.name)]) : []; }
for (const [engine, root] of [['OS', process.env.FLOWSTRIDE_OS_ROOT], ['Cloud', process.env.FLOWSTRIDE_CLOUD_ROOT]]) {
  test(`${engine}: formatter and diagnostics agree with the actual engine parser and shipped examples`, { skip: !root && 'Set the engine source path for integration parity' }, () => {
    const engineParse = engineParser(root);
    const check = (source, label, fragment = false) => {
      const formatted = formatFlowLines(source, { fragment }).join(source.includes('\r\n') ? '\r\n' : '\n');
      const parser = new Parser(new Lexer(formatted).tokenise());
      assert.deepEqual(fragment ? parser.parseFragment() : parser.parse(), engineParse(source, fragment), label);
      assert.deepEqual(diagnoseFlow(formatted, fragment), [], label);
    };
    for (const [command, data] of Object.entries(fixtures)) for (const eol of ['\n','\r\n']) {
      const source = wrap('flow.'+command+' '+JSON.stringify(data,null,2)+';').replaceAll('\n',eol);
      check(source, command);
    }
    for (const snippet of commandSnippets) check(wrap(snippetBody(snippet)), snippet.prefix);
    const files = [...walk(path.join(root,'examples/native-workflows')), ...walk(path.join(root,'examples/native-game'))].filter(f => f.endsWith('.flow'));
    assert(files.length > 0, 'Engine examples must be present');
    for (const file of files) check(fs.readFileSync(file, 'utf8'), file);
    const lab = process.env.FLOWSTRIDE_LAB_TESTS_ROOT;
    if (lab) {
      const labFlows = ['batches', 'batch-negatives', 'batch-qualification'].flatMap(directory => walk(path.join(lab, 'flows', directory))).filter(file => file.endsWith('.flow'));
      const fragments = walk(path.join(lab, 'steps')).filter(file => file.endsWith('.flowpart'));
      assert(labFlows.length > 0 && fragments.length > 0, 'Expected Lab batch flows and fragments');
      for (const file of labFlows) check(fs.readFileSync(file, 'utf8'), file);
      for (const file of fragments) check(fs.readFileSync(file, 'utf8'), file, true);
      console.log(`${engine}: ${labFlows.length} Lab batch flows and ${fragments.length} fragments matched.`);
    }
    const and = wrap('flow.assert.that {"target":"Ready","condition":"visible"};').replace('When "Exercise native command"','When "Prepare"\n flow.open "/";\nAnd "Check"');
    check(and, 'intermediate And');
    if (engine === 'Cloud') check(wrap('flow.switchTo previous;'), 'Cloud unquoted previous shortcut');
    const terminal = wrap('flow.open "/";') + 'And "Too late"\nflow.expect visible "Ready";';
    assert.throws(() => engineParse(terminal), /Terminal Lock/);
    assert.match(diagnoseFlow(terminal)[0].message, /Terminal Lock/);
    console.log(`${engine}: ${files.length} shipped flows, ${commandSnippets.length} snippets and all 65 structured commands matched.`);
  });
}
