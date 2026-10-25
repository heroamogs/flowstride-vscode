import { Lexer } from './lexer';
import { Parser } from './parser';
import { misplacedPayloadSemicolons } from './formatter';
import { nativeCommands } from './catalog';

export interface FlowDiagnostic { line: number; character?: number; message: string; code?: string }

export function diagnoseFlow(text: string): FlowDiagnostic[] {
  const malformed = misplacedPayloadSemicolons(text);
  if (malformed.length) return malformed.map(position => ({ ...position, code: 'flowstride.misplacedSemicolon', message: "Remove the semicolon after the opening '{'. A JSON command ends after its closing '}', not on the opening line." }));
  try {
    const features = new Parser(new Lexer(text).tokenise()).parse();
    const result: FlowDiagnostic[] = [];
    for (const feature of features) for (const scenario of feature.scenarios) for (const step of scenario.steps) {
      if (step.action !== 'native') continue;
      const parts = step.payload.pluginMethod.split('.');
      if (parts.length !== 2 || !nativeCommands[parts[0]]?.includes(parts[1])) result.push({ line: step.line - 1, message: 'Unknown native command: flow.' + step.payload.pluginMethod });
    }
    return result;
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error);
    const match = message.match(/(?:on line|Line|line)\s+(\d+)/);
    const line = Math.min(Math.max(0, Number(match?.[1] || 1) - 1), text.split(/\r?\n/).length - 1);
    return [{ line, message }];
  }
}
