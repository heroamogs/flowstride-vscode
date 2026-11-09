import { Lexer } from './lexer';
import { Parser, type StepNode } from './parser';
import { misplacedPayloadSemicolons } from './formatter';
import { nativeMethods } from './catalog';

export interface FlowDiagnostic { line: number; character?: number; message: string; code?: string }

function nativeMethod(step: StepNode): string | undefined {
  if (step.action !== 'native') return;
  const method: string = step.payload.pluginMethod;
  const lower = method.toLowerCase();
  // The workflow planner compares these commands case-insensitively.
  if (lower === 'skipif') return 'skipIf';
  if (lower === 'call' || lower === 'cleanup.register') return lower;
  return method;
}

function stepMessage(step: StepNode): string | undefined {
  const method = nativeMethod(step);
  if (method === undefined && step.action !== 'scroll') return;
  if (method !== undefined && !nativeMethods.has(method)) return 'Unknown native command: flow.' + method;
  const data = step.payload.data;
  if (method === 'call') {
    if (typeof data !== 'string' || data.length > 1000 || data.startsWith('/') ||
        !data.endsWith('.flowpart') || /[\\\x00-\x1f@${}:]/.test(data) || data.split('/').includes('..')) {
      return 'flow.call requires a quoted, fixed project-relative .flowpart path.';
    }
    return;
  }
  if (method === 'data.seed') {
    if (typeof data !== 'string' || !data.trim() || data.length > 1024 || /[\x00-\x1f\x7f]/.test(data)) {
      return 'flow.data.seed requires a nonempty quoted seed of at most 1024 characters without control codes.';
    }
    return;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return `flow.${method ?? 'scroll'} requires a JSON object.`;
}

function diagnoseSteps(steps: StepNode[], fragment: boolean): FlowDiagnostic[] {
  const result: FlowDiagnostic[] = [];
  const methods = steps.map(nativeMethod);
  const skipIndex = methods[0] === 'data.cases' ? 1 : 0;
  steps.forEach((step, index) => {
    const method = methods[index];
    let message = stepMessage(step);
    if (!message && (method === 'data.cases' || method === 'skipIf')) {
      const inGiven = /^Given(?:\s|$)/.test(step.blockDescription);
      if (fragment) {
        message = 'Scenario declarations belong in Given outside a fragment.';
      } else if (method === 'data.cases' && (index !== 0 || !inGiven)) {
        message = 'Place one flow.data.cases as the first command in Given.';
      } else if (method === 'skipIf' && (index !== skipIndex || !inGiven)) {
        message = 'Place one flow.skipIf at the start of Given, immediately after flow.data.cases if present.';
      }
    }
    if (message) result.push({ line: step.line - 1, message });
  });
  return result;
}

export function diagnoseFlow(text: string, fragment = false): FlowDiagnostic[] {
  const malformed = misplacedPayloadSemicolons(text);
  if (malformed.length) return malformed.map(position => ({ ...position, code: 'flowstride.misplacedSemicolon', message: "Remove the semicolon after the opening '{'. A JSON command ends after its closing '}', not on the opening line." }));
  try {
    const parser = new Parser(new Lexer(text).tokenise());
    if (fragment) return diagnoseSteps(parser.parseFragment(), true);
    return parser.parse().flatMap(feature => feature.scenarios.flatMap(scenario => diagnoseSteps(scenario.steps, false)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(/(?:on line|Line|line)\s+(\d+)/);
    const line = Math.min(Math.max(0, Number(match?.[1] || 1) - 1), text.split(/\r?\n/).length - 1);
    return [{ line, message }];
  }
}
