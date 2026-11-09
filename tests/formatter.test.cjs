const { test } = require('node:test'), assert = require('node:assert/strict');
const { formatFlowLines, inspectFlow } = require('../out/language/formatter');
const { diagnoseFlow } = require('../out/language/diagnostics');
const { Lexer } = require('../out/language/lexer'), { Parser } = require('../out/language/parser');
const { nativeAssertionCommands } = require('../out/language/assertion_contract');
const { keywordCommands } = require('../out/language/catalog');
const { editor } = require('./helpers/editor.cjs');
const { wrap, snippetBody } = require('./helpers/flows.cjs');
const fixtures = require('./fixtures/native-commands.json');
const snippets = require('../snippets/flow.json');
const parse = source => new Parser(new Lexer(source).tokenise()).parse();
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
test('all native completions, 13 game actions and extracted variables are discoverable', () => {
  const { captures, document } = editor(wrap('flow.open "/";'));
  const completion = prefix => captures.completion.provideCompletionItems({ ...document, lineAt: () => ({ text: prefix }) }, { line: 0, character: prefix.length });
  for (const command of Object.keys(fixtures)) {
    const [area, action] = command.split('.');
    assert(completion(action ? 'flow.' + area + '.' : 'flow.').some(item => item.label === (action || area)), command);
  }
  for (const command of keywordCommands) assert(completion('flow.').some(item => item.label === command), command);
  assert(completion('flow.a1').some(item => item.label === 'a11y'));
  const [request] = completion('flow.api.req');
  assert.equal(request.label, 'request');
  assert.deepEqual(request.range.start, { line: 0, character: 'flow.api.'.length });
  assert(!completion('flow.soft.api.')?.length);
  assert.deepEqual(completion('flow.soft api.').map(item => item.label), ['expectSchema']);
  assert(completion('flow.soft ').some(item => item.label === 'expect'));
  assert.deepEqual(completion('flow.extract pro').map(item => item.label), ['property']);
  assert.deepEqual(completion('flow.extract net').map(item => item.label), ['network']);
  assert.doesNotThrow(() => completion('flow.constructor.'));
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
  const soft=grammar.repository.commands.patterns.find(pattern=>pattern.captures?.[1]?.name==='keyword.operator.logical.flow');
  for(const assertion of ['expect', ...nativeAssertionCommands]) assert(new RegExp(soft.match).test('flow.soft '+assertion), assertion);
  const tags=grammar.repository.keywords.patterns.find(pattern=>pattern.captures?.[1]?.name==='keyword.declaration.flow');
  assert(new RegExp(tags.match.replace(/^\(\?i\)/, ''), 'i').test('  Tags: smoke, regression'));
  const heading=grammar.repository.keywords.patterns[0];assert(new RegExp(heading.match).test("Feature: User login's flow"));
  assert(grammar.repository.json.patterns.some(p=>p.include==='source.json'));
  assert(!config.autoClosingPairs.some(p=>p.open==="'"));
});

test('Then is terminal and And accepts only assertions or assertion fragments before Then', () => {
  const base = wrap('flow.open "/";');
  for (const method of nativeAssertionCommands) {
    const command = `flow.${method} ${JSON.stringify(fixtures[method])};`;
    const intermediate = base.replace('Then "Check result"', 'And "Check intermediate result"\n' + command + '\nThen "Check result"');
    assert.deepEqual(diagnoseFlow(intermediate), [], method);
    const late = base + 'And "More checks"\n' + command;
    assert.match(diagnoseFlow(late)[0].message, /Terminal Lock/);
    assert.deepEqual(diagnoseFlow(base + command), [], 'More commands inside the same Then');
  }
  for (const tail of ['Given "Again"', 'When "Again"', 'And "Again"', 'Then "Again"', 'stop.And "Again"', 'let a = "plugin"', 'Feature: Another']) {
    assert.match(diagnoseFlow(base + tail)[0].message, /Terminal Lock/, tail);
    assert.match(diagnoseFlow(format(base + tail))[0].message, /Terminal Lock/, tail);
  }
  for (const command of ['flow.api.poll {}', 'flow.a11y.snapshot {}', 'flow.log "Progress"', 'flow.tab.close {}', 'flow.try click "Skip"']) {
    const source = base.replace('Then "Check result"', 'And "Action"\n' + command + '\nThen "Check result"');
    assert.match(diagnoseFlow(source)[0].message, /strictly for assertions/, command);
  }
  const next = wrap('flow.open "/other";').split('\n').slice(1).join('\n');
  assert.deepEqual(diagnoseFlow(base + next), []);
  const fragment = base.replace('Then "Check result"', 'And "Reusable assertions"\nflow.call "steps/check.flowpart";\nThen "Check result"');
  assert.deepEqual(diagnoseFlow(fragment), []);
  assert.match(diagnoseFlow('Feature: One\nFeature: Two\n' + next)[0].message, /only one Feature/);
  assert.match(diagnoseFlow(next)[0].message, /Feature must be the first/);
});

test('formats new keyword commands and tags without changing their meaning or adding semicolons', () => {
  const prefixes = ['soft','wait','log','pause','pace','press','clear','focus','blur','doubleClick','rightClick','goBack','goForward','reload','extract property','extract network'].map(command => 'flow.' + command);
  for (const prefix of [...prefixes, 'Tags:']) {
    const snippet = Object.values(snippets).find(candidate => candidate.prefix === prefix);
    assert(snippet, prefix);
    const source = wrap(snippetBody(snippet));
    const formatted = format(source, { insertSpaces: false });
    assert.deepEqual(parse(formatted), parse(source), prefix);
    assert.deepEqual(diagnoseFlow(formatted), [], prefix);
    assert.equal(format(formatted, { insertSpaces: false }), formatted, prefix);
  }
  const source = wrap('Tags: SMOKE, orders').replace("Feature: User login's flow", 'Feature: Title with {; and "quotes').replace('Scenario: Submit', 'Scenario: Name with { or "unpaired quote');
  assert.deepEqual(diagnoseFlow(source), []);
  assert(format(source).includes('  Tags: SMOKE, orders\n'));
  assert.deepEqual(parse(format(source)), parse(source));
  assert.deepEqual(parse(format(source))[0].scenarios[0].tags, ['orders', 'smoke']);
  assert.match(diagnoseFlow(source.replace('Tags: SMOKE, orders', 'Tags: invalid tag'))[0].message, /Provide 1–32 tags/);
  assert.match(diagnoseFlow(source.replace('Scenario: Name with { or "unpaired quote\nTags: SMOKE, orders', 'Tags: smoke\nScenario: Submit'))[0].message, /Tags must immediately follow/);
});

test('diagnoses invalid soft assertions, durations, key names and workflow syntax', () => {
  const invalid = [
    ['flow.soft click "Submit";', /supported built-in assertion/],
    ['flow.soft flow.expect visible "Ready";', /without repeating/],
    ['flow.soft api.poll {}', /supported built-in assertion/],
    ['flow.wait 1.5;', /finite integer duration/],
    ['flow.pace 60001;', /finite integer duration/],
    ['flow.wait "100";', /unquoted integer or a quoted variable template/],
    ['flow.press "Shift+Shift+A" on input "Search";', /must not repeat a modifier/],
    ['flow.call "../outside.flowpart";', /fixed project-relative/],
    ['flow.data.seed {};', /quoted seed/],
    ['flow.api.request "not JSON";', /requires a JSON object/],
  ];
  for (const [command, expected] of invalid) assert.match(diagnoseFlow(wrap(command))[0].message, expected, command);
  for (const command of ['flow.wait "{{env.WAIT_MS}}";', 'flow.pace "@delay";', 'flow.try click button "Optional banner";']) {
    assert.deepEqual(diagnoseFlow(wrap(command)), [], command);
  }
  for (const method of ['skipIf', 'data.cases']) {
    const source = wrap('flow.open "/";').replace('When "Exercise native command"', `When "Exercise native command"\n flow.${method} ${JSON.stringify(fixtures[method])};`);
    assert.match(diagnoseFlow(source)[0].message, /first command in Given|start of Given/);
  }
  const planned = wrap('flow.data.cases {"file":"fixtures/orders.json"};').replace(' flow.open "/";', ' flow.skipIf {"browser":"webkit","reason":"Browser-specific test"};\n flow.open "/";');
  assert.deepEqual(diagnoseFlow(planned), []);
});

test('fragment files format and validate command lists without resolving the called files', () => {
  const source = '   flow.call "steps/customer.flowpart";\nflow.assert.that {\n "target": "Order summary",\n "condition": "visible"\n};\n';
  const { captures, document, vscode, messages } = editor(source, '/virtual/steps/check.flowpart');
  assert.deepEqual(captures.diagnostics, []);
  const [edit] = captures.formatter.provideDocumentFormattingEdits(document, { tabSize: 2, insertSpaces: true });
  assert.equal(edit.newText, 'flow.call "steps/customer.flowpart";');
  assert.match(diagnoseFlow('Scenario: Invalid\n' + source, true)[0].message, /commands only/);
  assert.match(diagnoseFlow('flow.data.cases {"file":"cases.json"};', true)[0].message, /outside a fragment/);
  assert.match(diagnoseFlow('flow.skipIf {"browser":"webkit","reason":"Test"};', true)[0].message, /outside a fragment/);
  vscode.workspace.isTrusted = true;
  return captures.run(document.uri).then(() => assert(messages.some(message => /flow.call/.test(message))));
});
