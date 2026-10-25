const { test } = require('node:test'), assert = require('node:assert/strict');
const { formatFlowLines, inspectFlow } = require('../out/language/formatter');
const { diagnoseFlow } = require('../out/language/diagnostics');
const { Lexer } = require('../out/language/lexer'), { Parser } = require('../out/language/parser');
const { editor } = require('./helpers/editor.cjs');
const fixtures = require('./fixtures/native-commands.json');
const parse = source => new Parser(new Lexer(source).tokenise()).parse();
const wrap = command => `Feature: User login's flow\nScenario: Submit\nGiven "Open page"\n flow.open "/";\nWhen "Exercise native command"\n ${command}\nThen "Check result"\n flow.expect visible "Ready";\n`;
const format = (source, options) => formatFlowLines(source, options).join(source.includes('\r\n') ? '\r\n' : '\n');

for (const [command, data] of Object.entries(fixtures)) test(`formatter preserves native ${command}, its payload and AST`, () => {
  for (const inline of [false, true]) {
    const source = wrap('flow.' + command + ' ' + JSON.stringify(data, null, inline ? undefined : 2) + ';');
    const formatted = format(source); assert.deepEqual(parse(formatted), parse(source)); assert.equal(format(formatted), formatted);
    for (const line of inspectFlow(source).protectedLines) assert.equal(formatted.split('\n')[line], source.split('\n')[line]);
    assert(!formatted.includes('{;')); assert.deepEqual(diagnoseFlow(formatted), []);
  }
});
test('API docstrings, comments, URLs, quoted braces and incomplete payloads remain unchanged', () => {
  const samples = [
    wrap('flow.post "/api/users" with reqBody;\n """\n {\n  "label": "http://example.test/{value};",\n  "description": "// text is not a comment"\n }\n """'),
    wrap('flow.network.route '+JSON.stringify({name:'request',url:'**/api',json:{text:'a } { "quoted" \\ path // /* */',list:[{value:'{{env.VALUE}}'}]}})+';'),
    wrap('/*\n flow.assert.that {; is only a comment\n */\n flow.open "/";'),
  ];
  for (const source of samples) { assert.deepEqual(parse(format(source)), parse(source)); assert.equal(format(format(source)), format(source)); }
  for (const source of ['flow.assert.that {\n "selector": "h1",\n', 'flow.post "/" with reqBody\n """\n {\n', '/* unfinished\n flow.assert.that {;']) {
    const formatted=format(source).split('\n');for(const line of inspectFlow(source).protectedLines)assert.equal(formatted[line],source.split('\n')[line]);assert(!format(source).startsWith('flow.assert.that {;'));
  }
});
test('format-on-save respects tabs and preserves CRLF and all existing semicolons', () => {
  const source = wrap('flow.click button "Submit";').replaceAll('\n', '\r\n');
  const formatted = format(source, { insertSpaces: false, tabSize: 4 });
  assert(formatted.includes('\r\n\tWhen')); assert(formatted.includes('\r\n\t\tflow.click')); assert(!/(?<!\r)\n/.test(formatted));
  assert.equal(formatted.match(/;/g).length, source.match(/;/g).length); assert.deepEqual(parse(formatted), parse(source));
});
test('the screenshot title is valid; real malformed syntax and unknown native commands remain errors', () => {
  assert.deepEqual(diagnoseFlow(wrap('flow.open "/";')), []);
  for (const source of [wrap('flow.assert.that {"condition":"text",}'), wrap('flow.browser.unknown {}'), wrap('flow.expect unsupported "x";')]) assert(diagnoseFlow(source).length > 0);
  const and = wrap('flow.assert.that {"selector":"h1","condition":"visible"};').replace('When "Exercise native command"','When "Prepare"\n flow.open "/";\nAnd "Native assertion"');
  assert.deepEqual(diagnoseFlow(and), []);
});
test('misplaced opening semicolon has a precise quick fix that leaves strings and comments untouched', () => {
  const source = wrap('flow.assert.that {;\n "selector": "h1",\n "condition": "visible"\n};');
  const { captures, document } = editor(source);
  assert.equal(captures.diagnostics.length, 1); const diagnostic = captures.diagnostics[0]; assert.equal(diagnostic.code, 'flowstride.misplacedSemicolon');
  const [action] = captures.fixes.provideCodeActions(document, diagnostic.range, { diagnostics: [diagnostic] });
  const range = action.edit.deletions[0].range, lines = source.split('\n');
  assert.equal(lines[range.start.line][range.start.character], ';');
  lines[range.start.line] = lines[range.start.line].slice(0, range.start.character) + lines[range.start.line].slice(range.end.character);
  assert.deepEqual(diagnoseFlow(lines.join('\n')), []);
  assert.deepEqual(diagnoseFlow(wrap('flow.post "/" with reqBody\n """\n {"label":"{;"}\n """')), []);
});
test('all 36 native completions, 13 game actions and extracted variables are discoverable', () => {
  const { captures, document } = editor(wrap('flow.open "/";'));
  const completion = prefix => captures.completion.provideCompletionItems({ ...document, lineAt: () => ({ text: prefix }) }, { line: 0, character: prefix.length });
  for (const command of Object.keys(fixtures)) { const [area, action] = command.split('.'); assert(completion('flow.'+area+'.').some(c => c.label === action), command); }
  const game = 'Feature: Game\nlet game = "flowstride:game";\n'+wrap('flow.open "/";').split('\n').slice(1).join('\n');
  const data = editor(game); assert.equal(data.captures.completion.provideCompletionItems({ ...data.document, lineAt: () => ({ text: 'game.' }) }, { line: 0, character: 5 }).length, 13);
  const variables = editor(wrap('flow.extract text "h1" as "petName";\n flow.extract text "h1" as global "sharedName";'));
  const labels = variables.captures.completion.provideCompletionItems({ ...variables.document, lineAt: () => ({ text: '@' }) }, { line: 0, character: 1 }).map(c => c.label);
  assert(labels.includes('@petName')); assert(labels.includes('@global[sharedName]'));
});
test('highlighting recognizes every native family and apostrophes do not create quote pairs', () => {
  const grammar=require('../syntaxes/flow.tmLanguage.json'),config=require('../language-configuration.json');
  const native=grammar.repository.commands.patterns.find(p=>p.name==='support.function.flow');
  for(const command of Object.keys(fixtures))assert(new RegExp(native.match).test('flow.'+command),command);
  const heading=grammar.repository.keywords.patterns[0];assert(new RegExp(heading.match).test("Feature: User login's flow"));
  assert(grammar.repository.json.patterns.some(p=>p.include==='source.json'));
  assert(!config.autoClosingPairs.some(p=>p.open==="'"));
});

test('native assertion And blocks after Then match both new engines and preserve action restrictions',()=>{
 const prefix='Feature: Native assertion blocks\nScenario: Follow-up checks\nGiven "Setup"\nWhen "Act"\nflow.open "/";\nThen "First check"\nflow.expect visible "Ready";\nAnd "More checks"\n';
 for(const method of ['assert.that','network.expect','download.expect','stub.expect','a11y.scan','a11y.match'])assert.deepEqual(diagnoseFlow(prefix+`flow.${method} {};`),[]);
 for(const method of ['browser.create','clock.install','stub.install','a11y.snapshot'])assert(diagnoseFlow(prefix+`flow.${method} {};`).length>0);
});
