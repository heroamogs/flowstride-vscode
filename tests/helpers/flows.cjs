function wrap(command) {
  const tags = /^Tags:/i.test(command) ? command + '\n' : '';
  const inlineImport = /^import\s*\{/i.test(command);
  const helper = /^flow\.(?:call|fixture\.(?:use|worker))\s+([A-Za-z_$][\w$]*)\(/.exec(command);
  const imports = inlineImport ? command + '\n' : helper ? 'import { ' + helper[1] + ' } from "sample.ts";\n' : '';
  const planning = /^flow\.(?:data\.cases|skipIf|fixture\.(?:use|worker)|handoff\.receive)\b/.test(command) ? ' ' + command + '\n' : '';
  const action = tags || planning || inlineImport ? 'flow.open "/";' : command;
  return `Feature: User login's flow
${imports}Scenario: Submit
${tags}Given "Open page"
${planning} flow.open "/";
When "Exercise native command"
 ${action}
Then "Check result"
 flow.expect visible "Ready";
`;
}

function snippetBody(snippet) {
  const body = Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body;
  return body.replace(/\$\{\d+:([^}]+)\}/g, '$1').replace(/\$\d+/g, '');
}

module.exports = { wrap, snippetBody };
