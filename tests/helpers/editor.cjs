const Module = require('node:module'), path = require('node:path');
function editor(source, filename = '/virtual/flows/example.flow') {
  const captures = {}, disposable = { dispose() {} }, messages = [];
  const uri = { scheme: 'file', fsPath: filename, toString: () => filename };
  const lines = source.split(/\r?\n/);
  const document = { uri, languageId: 'flow', lineCount: lines.length, getText: () => source, lineAt: i => ({ text: lines[i], range: { start: { line: i, character: 0 }, end: { line: i, character: lines[i].length } } }) };
  const vscode = {
    languages: {
      createDiagnosticCollection: () => ({ set: (_uri, items) => captures.diagnostics = items, clear() {} }),
      registerCompletionItemProvider: (_language, provider) => { captures.completion = provider; return disposable; },
      registerDocumentFormattingEditProvider: (_language, provider) => { captures.formatter = provider; return disposable; },
      registerCodeActionsProvider: (_language, provider) => { captures.fixes = provider; return disposable; },
    },
    commands: { registerCommand: (_name, callback) => { captures.run = callback; return disposable; } },
    workspace: { isTrusted: false, textDocuments: [document], onDidChangeTextDocument: () => disposable, onDidOpenTextDocument: () => disposable },
    window: { activeTextEditor: { document }, showWarningMessage: message => messages.push(message), showErrorMessage: message => messages.push(message) },
    Diagnostic: class { constructor(range, message, severity) { Object.assign(this, { range, message, severity }); } }, DiagnosticSeverity: { Error: 0 },
    Range: class { constructor(line, character, endLine, endCharacter) { this.start = { line, character }; this.end = { line: endLine, character: endCharacter }; } },
    CompletionItem: class { constructor(label) { this.label = label; } }, CompletionItemKind: { Method: 1, Variable: 2, Reference: 3 }, MarkdownString: class { constructor(value) { this.value = value; } },
    TextEdit: { replace: (range, newText) => ({ range, newText }) },
    CodeActionKind: { QuickFix: 'quickfix' }, CodeAction: class { constructor(title, kind) { Object.assign(this, { title, kind }); } },
    WorkspaceEdit: class { constructor() { this.deletions = []; } delete(uri, range) { this.deletions.push({ uri, range }); } },
  };
  const load = Module._load;
  Module._load = function(name) { return name === 'vscode' ? vscode : load.apply(this, arguments); };
  try {
    const filename = path.resolve(__dirname, '../../out/extension.js'); delete require.cache[filename]; require(filename).activate({ subscriptions: [] });
  } finally { Module._load = load; }
  return { captures, document, vscode, messages };
}
module.exports = { editor };
