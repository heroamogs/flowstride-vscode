const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { diagnoseFlow } = require('../out/language/diagnostics');
const { formatFlowLines } = require('../out/language/formatter');
const { featureHelpers, helperAt } = require('../out/language/workflow');
const { findNamedExport, resolveDefinitionFile } = require('../out/language/helper_definition');
const { editor } = require('./helpers/editor.cjs');

const flow = [
  'Feature: Sign in after approving a user',
  'import {',
  '  createAccount,',
  '  generateEmail',
  '} from "auth.ts";',
  'Scenario: Wait for the approved member',
  'Given "Receive the account and create local data"',
  '  flow.handoff.receive {"name":"approved","as":"member","credentialsAs":"login"};',
  '  flow.fixture.use createAccount() as "account";',
  'When "Generate an address"',
  '  flow.call generateEmail("@member.email") as global "signupEmail";',
  'Then "Check the address"',
  '  flow.assert.value {"actual":"@global[signupEmail]","operator":"contains","expected":"@example.test"};',
].join('\n');

test('Helpers, worker fixtures and handoffs validate in their proper FS scopes', () => {
  assert.deepEqual(diagnoseFlow(flow), []);
  assert.deepEqual(diagnoseFlow(flow.replace('fixture.use', 'fixture.worker')), []);
  assert.deepEqual(diagnoseFlow(formatFlowLines(flow).join('\n')), []);
  assert.match(formatFlowLines(flow, { insertSpaces: false })[1], /^\timport/);
  assert.match(diagnoseFlow(flow.replace('generateEmail("@member.email")', 'generateEmail(compute())'))[0].message, /Nested calls/);
  assert.match(diagnoseFlow(flow.replace('flow.fixture.use ', 'When "Too late"\n  flow.fixture.use '))[0].message, /fixtures in the Given/);
  assert.match(diagnoseFlow(flow.replace('as "account"', 'as global "account"'))[0].message, /current scenario attempt/);
  assert.match(diagnoseFlow(flow.replace('"credentialsAs":"login"', '"credentialsAs":"member"'))[0].message, /distinct credentialsAs/);
  assert.match(diagnoseFlow(flow.replace('generateEmail("@member.email")', 'notImported()'))[0].message, /Import "notImported"/);
  assert.deepEqual(diagnoseFlow('flow.call generateEmail() as "email";', true), []);
  assert.match(diagnoseFlow('flow.fixture.use createAccount();', true)[0].message, /Given block/);
});

test('Go to Definition recognizes an imported name and its calls but ignores value references', () => {
  assert.equal(helperAt(flow, 2, 5).alias, 'createAccount');
  assert.equal(helperAt(flow, 3, 5).alias, 'generateEmail');
  assert.equal(helperAt(flow, 8, flow.split('\n')[8].indexOf('createAccount')).path, 'auth.ts');
  assert.equal(helperAt(flow, 10, flow.split('\n')[10].indexOf('generateEmail')).path, 'auth.ts');
  assert.equal(helperAt(flow, 10, flow.split('\n')[10].indexOf('member')), undefined);
  const incomplete = flow.replace('generateEmail("@member.email") as global "signupEmail";', 'gen');
  assert.deepEqual(featureHelpers(incomplete).map(binding => binding.alias), ['createAccount', 'generateEmail']);
  const { captures, document } = editor(incomplete);
  const completion = (line, text) => captures.completion.provideCompletionItems({
    ...document, lineAt: () => ({ text }),
  }, { line, character: text.length }).map(item => item.label);
  assert.deepEqual(completion(10, '  flow.call gen'), ['generateEmail']);
  assert.deepEqual(completion(10, '  flow.fixture.'), ['use', 'worker']);
  assert.deepEqual(completion(10, '  flow.handoff.'), ['publish', 'receive']);
});

test('Definition follows the same safe helper paths and locates named JS and TS exports without executing them', async t => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'flowstride-editor-helpers-')));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const project = path.join(workspace, 'app');
  fs.mkdirSync(path.join(project, 'flows'), { recursive: true });
  fs.mkdirSync(path.join(project, 'support'));
  const runFile = path.join(project, 'flows', 'signup.flow');
  fs.writeFileSync(runFile, flow);
  fs.writeFileSync(path.join(project, 'flowstride.config.json'), '{"helpersDir":"support"}\n');
  const js = 'throw new Error("Module body must not run");\nfunction generateEmail() {}\nmodule.exports = { generateEmail };\n';
  const ts = 'const address = () => "test@example.test";\nexport { address as generateEmail };\n';
  const jsPath = path.join(project, 'support', 'email.js');
  const tsPath = path.join(project, 'flows', 'email.ts');
  fs.writeFileSync(jsPath, js);
  fs.writeFileSync(tsPath, ts);

  const binding = value => ({ alias: 'generateEmail', kind: 'helper', path: value, line: 2 });
  assert.equal(resolveDefinitionFile(runFile, workspace, binding('email.js')), jsPath);
  assert.equal(resolveDefinitionFile(runFile, workspace, binding('./email.ts')), tsPath);
  assert.equal(resolveDefinitionFile(runFile, workspace, binding('../support/email.js')), jsPath);
  const wrong = path.join(workspace, 'outside.js');
  fs.writeFileSync(wrong, js);
  fs.symlinkSync(wrong, path.join(project, 'support', 'outside.js'));
  assert.throws(() => resolveDefinitionFile(runFile, workspace, binding('outside.js')), /escapes the project/);
  assert.throws(() => resolveDefinitionFile(runFile, workspace, binding(wrong)), /project/);
  assert.throws(() => resolveDefinitionFile(runFile, workspace, binding('../../outside.js')), /inside the project/);

  for (const [file, text, name, actual] of [
    [jsPath, js, 'generateEmail', 'generateEmail'],
    [tsPath, ts, 'generateEmail', 'address'],
    [tsPath, 'export async function checkPrices() {}', 'checkPrices', 'checkPrices'],
    [jsPath, 'exports.checkPrices = () => 23', 'checkPrices', 'checkPrices'],
  ]) {
    const target = await findNamedExport(file, text, name);
    assert(target);
    assert.equal(text.slice(target.start, target.end), actual);
  }
  assert.equal(await findNamedExport(jsPath, 'export default function generateEmail() {}', 'generateEmail'), undefined);
});
