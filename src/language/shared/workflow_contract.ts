import { z } from 'zod';

export const variableName = z.string().regex(/^[A-Za-z_]\w{0,127}$/).refine(value => !['__proto__','prototype','constructor','global'].includes(value), 'Choose a safe local variable name.');

const name = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/);
const reference = z.string().regex(/^@[A-Za-z_]\w*(?:\.\w+|\[\d+\])*$/);
const publish = z.object({
  name,
  value: z.unknown().refine(value => value !== undefined),
  credentials: z.record(variableName, reference).optional(),
}).strict();
const receive = z.object({
  name,
  as: variableName,
  credentialsAs: variableName.optional(),
}).strict().refine(input => input.as !== input.credentialsAs);

export const handoffPattern = /\bflow\.handoff\.(?:publish|receive)\b/i;
export type HandoffCommand =
  | ({ kind: 'publish' } & z.infer<typeof publish>)
  | ({ kind: 'receive' } & z.infer<typeof receive>);

export function parseHandoff(command: string, input: unknown, line: number): HandoffCommand {
  if (command.toLowerCase() === 'flow.handoff.publish') {
    const parsed = publish.safeParse(input);
    if (parsed.success) return { kind: 'publish', ...parsed.data };
    throw new Error('Line ' + line + ': flow.handoff.publish requires a fixed name, a JSON value and optional named credential references.');
  }
  const parsed = receive.safeParse(input);
  if (parsed.success) return { kind: 'receive', ...parsed.data };
  throw new Error('Line ' + line + ': flow.handoff.receive requires a fixed name, an as binding and an optional distinct credentialsAs binding.');
}
