export interface PayloadStart { line: number; character: number }

/** Inspect text only. Formatting and diagnostics must never execute workspace code. */
export function inspectFlow(text: string) {
  const protectedLines = new Set<number>(), payloadStarts: PayloadStart[] = [];
  let jsonDepth = 0, jsonString = false, escaped = false;
  let docString = false, blockComment = false, quoted = false;
  const lines = text.split(/\r?\n/);
  for (let line = 0; line < lines.length; line++) {
    const value = lines[line];
    if (jsonDepth || docString || blockComment || quoted) protectedLines.add(line);
    for (let i = 0; i < value.length; i++) {
      const raw = value[i], c = /[“”]/.test(raw) ? '"' : raw;
      if (blockComment) {
        protectedLines.add(line);
        if (value.startsWith('*/', i)) { blockComment = false; i++; }
        continue;
      }
      if (docString) {
        protectedLines.add(line);
        if (value.startsWith('"""', i)) { docString = false; i += 2; }
        continue;
      }
      if (jsonDepth) {
        protectedLines.add(line);
        if (jsonString) {
          if (escaped) escaped = false;
          else if (c === '\\') escaped = true;
          else if (c === '"') jsonString = false;
        } else if (c === '"') jsonString = true;
        else if (c === '{') jsonDepth++;
        else if (c === '}') jsonDepth--;
        continue;
      }
      if (quoted) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') quoted = false;
        continue;
      }
      if (value.startsWith('//', i)) break;
      if (value.startsWith('/*', i)) { blockComment = true; protectedLines.add(line); i++; continue; }
      if (value.startsWith('"""', i)) { docString = true; protectedLines.add(line); i += 2; continue; }
      if (c === '"') { quoted = true; continue; }
      if (c === '{') { jsonDepth = 1; protectedLines.add(line); payloadStarts.push({ line, character: i }); }
    }
  }
  return { lines, protectedLines, payloadStarts };
}

export function formatFlowLines(text: string, options: { tabSize?: number; insertSpaces?: boolean } = {}) {
  const { lines, protectedLines } = inspectFlow(text);
  const size = Math.max(1, Math.min(8, Math.trunc(options.tabSize || 2)));
  const unit = options.insertSpaces === false ? '\t' : ' '.repeat(size);
  let depth = 0;
  return lines.map((raw, index) => {
    if (protectedLines.has(index)) return raw;
    const line = raw.trim();
    if (!line) return '';
    if (/^feature\s*:/i.test(line)) depth = 0;
    else if (/^(?:only\.)?scenario\s*:/i.test(line) || /^(?:stop\.)?(?:given|when|then|and)\b/i.test(line) || /^let\s/i.test(line)) depth = 1;
    else if (!/^\/\//.test(line)) depth = 2;
    // Semicolons are optional in the DSL. Never guess where a command ends:
    // a line may open JSON, an API body, or a continued request-header block.
    return unit.repeat(depth) + line;
  });
}

export function misplacedPayloadSemicolons(text: string) {
  const { lines, payloadStarts } = inspectFlow(text);
  return payloadStarts.flatMap(start => {
    const match = lines[start.line].slice(start.character + 1).match(/^[ \t]*;/);
    return match ? [{ line: start.line, character: start.character + match[0].length }] : [];
  });
}
