function wrap(command) {
  const tags = /^Tags:/i.test(command) ? command + '\n' : '';
  const planning = /^flow\.(?:data\.cases|skipIf)\b/.test(command) ? ' ' + command + '\n' : '';
  const action = tags || planning ? 'flow.open "/";' : command;
  return `Feature: User login's flow
Scenario: Submit
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
