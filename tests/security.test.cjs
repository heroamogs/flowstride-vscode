const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { diagnoseFlow } = require('../out/language/diagnostics'), { formatFlowLines } = require('../out/language/formatter');
const { editor } = require('./helpers/editor.cjs'), { locateRunner } = require('../out/runner');
test('formatting and diagnostics never import a project plugin or run its contents', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'flowstride-editor-security-'));
  try {
    const plugin = path.join(directory,'plugin.ts'), marker = path.join(directory,'executed');
    fs.writeFileSync(plugin, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'should not execute');\n`);
    const source = `Feature: Safe editing\nlet project = "${plugin.replaceAll('\\','/')}";\nScenario: Parse only\nGiven "Open"\n flow.open "/";\nWhen "Call plugin"\n project.action {"message":"$(touch unsafe); {;}"};\nThen "Check"\n flow.expect visible "Ready";`;
    assert.deepEqual(diagnoseFlow(source),[]); formatFlowLines(source); assert(!fs.existsSync(marker));
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});
test('untrusted workspace cannot start a process from the run command', async () => {
  const {captures,messages} = editor('Feature: Untrusted'); await captures.run(); assert(messages.some(m=>/Trust/.test(m))); assert(!captures.task);
});
test('malicious-looking JSON stays data and cannot pollute prototypes', () => {
  const source='Feature: Data\nScenario: Payload\nGiven "Open"\n flow.open "/";\nWhen "Data"\n flow.network.route {"name":"route","url":"**/data","json":{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"value":"$(touch unsafe)"}};\nThen "Check"\n flow.expect visible "Ready";';
  assert.deepEqual(diagnoseFlow(source),[]); assert(formatFlowLines(source).join('\n').includes('"__proto__"')); assert.equal({}.polluted,undefined);
});
test('the run command refuses a CLI path that escapes its installed package', () => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'flowstride-editor-bin-'));
  try {
    const dependency=path.join(directory,'node_modules/flowstride'); fs.mkdirSync(dependency,{recursive:true}); fs.writeFileSync(path.join(directory,'package.json'),'{}'); fs.writeFileSync(path.join(directory,'test.flow'),''); fs.writeFileSync(path.join(directory,'outside.cjs'),'');
    fs.writeFileSync(path.join(dependency,'package.json'),JSON.stringify({name:'flowstride',bin:{flowstride:'../../outside.cjs'}}));
    // The traversal points outside the package, whether or not its target exists.
    assert.throws(()=>locateRunner(path.join(directory,'test.flow'),directory));
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});
