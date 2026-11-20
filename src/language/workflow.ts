import { inspectFlow } from './formatter';
import { Lexer } from './lexer';
import { Parser, type DeclarationNode, type FeatureNode } from './parser';

const callHeader = /^([ \t]*flow\.(?:call|fixture\.(?:use|worker))[ \t]+)([A-Za-z_$][\w$]*)(?=[ \t]*\()/i;

function featureOf(text: string): FeatureNode | undefined {
  try {
    return new Parser(new Lexer(text).tokenise()).parse()[0];
  } catch {
    // The regular diagnostics provider handles syntax errors while editing.
  }
}

export function featureHelpers(text: string): DeclarationNode[] {
  const { lines, protectedLines } = inspectFlow(text);
  const firstScenario = lines.findIndex((line, index) =>
    !protectedLines.has(index) && /^\s*(?:only\.)?scenario:/i.test(line));
  const header = firstScenario < 0 ? text : lines.slice(0, firstScenario).join('\n');
  const feature = featureOf(header + '\nScenario: Read imports\nGiven "Context"\n flow.open "/";\n' +
    'When "Check"\n flow.expect visible "Ready";\nThen "Result"\n flow.expect visible "Ready";\n');
  return feature?.declarations.filter(declaration => declaration.kind === 'helper') ?? [];
}

export function helperAt(text: string, line: number, character: number): DeclarationNode | undefined {
  const feature = featureOf(text);
  if (!feature) return;
  const lines = text.split(/\r?\n/);
  const current = lines[line];
  if (current === undefined) return;
  const declarations = feature.declarations.filter(declaration => declaration.kind === 'helper');
  const call = callHeader.exec(current);
  if (call) {
    const [, prefix, name] = call;
    if (character >= prefix.length && character <= prefix.length + name.length &&
        feature.scenarios.some(scenario => scenario.steps.some(step =>
          step.line === line + 1 && (step.action === 'helper' || step.action === 'fixture') && step.payload.name === name))) {
      return declarations.find(declaration => declaration.alias === name);
    }
  }
  const word = [...current.matchAll(/[A-Za-z_$][\w$]*/g)].find(match =>
    character >= match.index! && character <= match.index! + match[0].length);
  if (!word) return;
  return declarations.find(declaration => {
    if (declaration.alias !== word[0] || declaration.line > line + 1) return false;
    const prefix = [...lines.slice(declaration.line - 1, line), current.slice(0, word.index)].join('\n');
    return /^\s*import\s*\{[^}]*$/i.test(prefix);
  });
}
