import { locateRunner } from "./runner";
import { diagnoseFlow } from "./language/diagnostics";
import { formatFlowLines } from "./language/formatter";
import { nativeAssertionCommands } from "./language/assertion_contract";
import { nativeCommands, gameCommands, keywordCommands } from "./language/catalog";
import * as vscode from "vscode";

const diagnosticCollection =
  vscode.languages.createDiagnosticCollection("flowstride");

function commandCompletions(names: readonly string[], position: vscode.Position, prefix: string, detail: string) {
  return names.filter(name => name.toLowerCase().startsWith(prefix.toLowerCase())).map(name => {
    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Method);
    item.detail = detail;
    item.range = new vscode.Range(position.line, position.character - prefix.length, position.line, position.character);
    return item;
  });
}

function isFragment(document: vscode.TextDocument) {
  return document.uri.fsPath.endsWith('.flowpart');
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "flowstride.runTest",
      async (uri?: vscode.Uri) => {
        if (!vscode.workspace.isTrusted) { vscode.window.showWarningMessage('Trust this workspace before running Flowstride.'); return; }
        const fileUri = uri || vscode.window.activeTextEditor?.document.uri;
        if (!fileUri || fileUri.scheme !== 'file') { vscode.window.showErrorMessage('Choose a local Flowstride file.'); return; }
        if (fileUri.fsPath.endsWith('.flowpart')) {
          vscode.window.showErrorMessage('Run a .flow file that includes this fragment with flow.call.');
          return;
        }
        const folder = vscode.workspace.getWorkspaceFolder(fileUri);
        if (!folder) { vscode.window.showErrorMessage('Open the project as a workspace first.'); return; }
        const document = vscode.workspace.textDocuments.find(doc=>doc.uri.toString()===fileUri.toString());
        if (document?.isDirty && !(await document.save())) return;
        try {
          const command = locateRunner(fileUri.fsPath, folder.uri.fsPath);
          const nodePath = vscode.workspace.getConfiguration('flowstride', fileUri).get<string>('nodePath', 'node');
          const task = new vscode.Task({ type:'flowstride', file:fileUri.fsPath }, folder, 'Run Flowstride test', 'Flowstride', new vscode.ProcessExecution(nodePath, command.args, {cwd:command.cwd}), []);
          await vscode.tasks.executeTask(task);
        } catch (error) { vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error)); }
      },
    ),
  );

  const dataGenerators = [
    {
      label: "$uuid",
      description: "e.g., 123e4567-e89b-12d3-a456-426614174000",
    },
    { label: "$timestamp", description: "e.g., 1678886400" },
    { label: "$isoTimestamp", description: "e.g., 2026-06-02T11:30:00.000Z" },
    { label: "$randomInt", description: "e.g., 48291" },
    { label: "$randomNumber", description: "e.g., 847291" },
    { label: "$randomString", description: "e.g., a1b2c3d4" },
    { label: "$randomAlpha", description: "e.g., abcdef" },
    { label: "$randomAlphaNumeric", description: "e.g., a1b2c3d4" },
    { label: "$randomFirstName", description: "e.g., Jane" },
    { label: "$randomLastName", description: "e.g., Doe" },
    { label: "$randomFullName", description: "e.g., Jane Doe" },
    { label: "$randomUsername", description: "e.g., jane_flow_12345" },
    { label: "$randomDisplayName", description: "e.g., Jane D." },
    { label: "$randomJobTitle", description: "e.g., Software Engineer" },
    { label: "$randomEmail", description: "e.g., flow_12345@domain.com" },
    { label: "$randomPhone", description: "e.g., +14155552671" },
    { label: "$randomPhoneNG", description: "e.g., 08012345678" },
    { label: "$randomDomain", description: "e.g., flowstridemail.com" },
    { label: "$randomPassword", description: "e.g., P@ssWord123!" },
    { label: "$randomOtp", description: "e.g., 123456" },
    { label: "$randomPin", description: "e.g., 1234" },
    { label: "$randomToken", description: "e.g., aB3dE5fG..." },
    { label: "$randomCountry", description: "e.g., Nigeria" },
    { label: "$randomState", description: "e.g., Lagos" },
    { label: "$randomCity", description: "e.g., Ikeja" },
    { label: "$randomStreet", description: "e.g., 42 Admiralty Way" },
    { label: "$randomAddress", description: "e.g., 42 Admiralty Way, Ikeja" },
    { label: "$randomZipCode", description: "e.g., 10021" },
    { label: "$today", description: "e.g., 2026-06-02" },
    { label: "$tomorrow", description: "e.g., 2026-06-03" },
    { label: "$yesterday", description: "e.g., 2026-06-01" },
    { label: "$currentYear", description: "e.g., 2026" },
    { label: "$currentMonth", description: "e.g., 06" },
    { label: "$randomCompany", description: "e.g., Acme Corp" },
    { label: "$randomAmount", description: "e.g., 1500.50" },
    { label: "$randomCurrency", description: "e.g., USD" },
    { label: "$randomTransactionId", description: "e.g., TXN-A1B2C3D4" },
    {
      label: "$maliciousString",
      description: "e.g., <script>alert(1)</script>",
    },
    { label: "$invalidEmail", description: "e.g., plainaddress" },
    { label: "$overflowString", description: "e.g., aaaaaaaaaaa..." },
    { label: "$specialChars", description: "e.g., !@#$%^&*()" },
    { label: "$runId", description: "e.g., RUN-a1b2c3" },
    { label: "$workerId", description: "e.g., worker-1" },
    {
      label: "$randomPair[Country]",
      description: "Generates a correlated Country",
    },
    {
      label: "$randomPair[State]",
      description: "Generates a correlated State",
    },
    { label: "$randomPair[City]", description: "Generates a correlated City" },
  ];

  // --- UNIFIED PROVIDER: Handles flow., $, {, and @ cleanly ---
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "flow",
      {
        provideCompletionItems(
          document: vscode.TextDocument,
          position: vscode.Position,
        ) {
          const linePrefix = document
            .lineAt(position)
            .text.substr(0, position.character);
          const items: vscode.CompletionItem[] = [];

          const soft = linePrefix.match(/\bflow\.soft\s+(?:([a-z][a-z0-9]*)\.)?([a-zA-Z0-9]*)$/);
          if (soft) {
            const [, area, prefix] = soft;
            const assertions = [...nativeAssertionCommands];
            const names = area
              ? assertions.filter(name => name.startsWith(area + '.')).map(name => name.slice(area.length + 1))
              : ['expect', ...new Set(assertions.map(name => name.split('.')[0]))];
            return commandCompletions(names, position, prefix, 'Built-in Flowstride assertion');
          }

          const extract = linePrefix.match(/\bflow\.extract\s+([a-zA-Z]*)$/);
          if (extract) {
            return commandCompletions(
              ['resBody', 'resHeader', 'cookie', 'text', 'value', 'attribute', 'property', 'network'],
              position, extract[1], 'Flowstride extraction source',
            );
          }

          const flow = linePrefix.match(/\bflow\.(?:([a-z][a-z0-9]*)\.)?([a-zA-Z0-9]*)$/);
          if (flow) {
            const [, area, prefix] = flow;
            if (!area) {
              const commands = keywordCommands.filter(name => !isFragment(document) || name !== 'skipIf');
              return commandCompletions([...Object.keys(nativeCommands), ...commands], position, prefix, 'Flowstride command');
            }
            if (Object.hasOwn(nativeCommands, area)) {
              const commands = nativeCommands[area].filter(name => !isFragment(document) || area !== 'data' || name !== 'cases');
              return commandCompletions(commands, position, prefix, 'Native Flowstride command');
            }
            if (area === 'mail') return commandCompletions(['getotp'], position, prefix, 'Flowstride command');
          }

          const plugin = linePrefix.match(/\b([A-Za-z_]\w*)\.([a-zA-Z]*)$/);
          if (plugin) {
            const [, alias, prefix] = plugin;
            const gameAliases = [...document.getText().matchAll(/\blet\s+(\w+)\s*=\s*["']flowstride:game["']/g)].map(match => match[1]);
            if (gameAliases.includes(alias)) return commandCompletions(gameCommands, position, prefix, 'Native Flowstride game action');
          }

          // Data generators and remembered values.
          const genMatch = linePrefix.match(/([$@{])([A-Za-z0-9_\[\]]*)$/);
          if (genMatch) {
            const prefixChar = genMatch[1];

            if (prefixChar === "$" || prefixChar === "{") {
              dataGenerators.forEach((gen) => {
                const item = new vscode.CompletionItem(
                  gen.label,
                  vscode.CompletionItemKind.Variable,
                );
                item.detail = "Flowstride Data Generator";
                item.documentation = new vscode.MarkdownString(
                  `*${gen.description}*`,
                );
                item.sortText = "0000" + gen.label;

                if (prefixChar === "{") {
                  item.insertText = `{${gen.label}}`;
                }

                items.push(item);
              });
            }

            if (prefixChar === "@") {
              const documentText = document.getText();
              const usedGenerators =
                documentText.match(/\$[A-Za-z0-9_\[\]]+/g) || [];
              const references = documentText.match(/(?<![a-zA-Z0-9_])@(?:global\[[a-zA-Z_]\w*\]|[a-zA-Z_]\w*)/g) || [];
              const declarations = [...documentText.matchAll(/\b(?:as|into)\s+(?:(global)\s+)?["“]([a-zA-Z_]\w*)["”]/g)].map(match => match[1] ? `@global[${match[2]}]` : `@${match[2]}`);
              const allUsed = [...new Set([...usedGenerators, ...references, ...declarations])];

              allUsed.forEach((val) => {
                const cleanName = val.replace(/^[$@]/, "");
                const labelText = `@${cleanName}`;
                const item = new vscode.CompletionItem(
                  labelText,
                  vscode.CompletionItemKind.Reference,
                );
                item.detail = "Previously used in this file";
                item.sortText = "0001" + labelText;
                items.push(item);
              });
            }
            return items;
          }

          return undefined;
        },
      },
      ".",
      "$",
      "{",
      "@",
      " ",
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider("flow", {
      provideDocumentFormattingEdits(document, options) {
        const lines = formatFlowLines(document.getText(), { ...options, fragment: isFragment(document) });
        return lines.flatMap((line, index) => {
          const original = document.lineAt(index);
          return original.text === line ? [] : [vscode.TextEdit.replace(original.range, line)];
        });
      },
    }),
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider("flow", {
      provideCodeActions(document, _range, context) {
        return context.diagnostics.flatMap(diagnostic => {
          if (diagnostic.code !== 'flowstride.misplacedSemicolon') return [];
          const action = new vscode.CodeAction("Remove semicolon after JSON opening brace", vscode.CodeActionKind.QuickFix);
          action.diagnostics = [diagnostic];
          action.isPreferred = true;
          action.edit = new vscode.WorkspaceEdit();
          action.edit.delete(document.uri, diagnostic.range);
          return [action];
        });
      },
    }, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }),
  );

  if (vscode.window.activeTextEditor) {
    updateDiagnostics(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) =>
      updateDiagnostics(e.document),
    ),
  );

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => updateDiagnostics(doc)),
  );
}

function updateDiagnostics(document: vscode.TextDocument) {
  if (document.languageId !== 'flow') return;
  const diagnostics = diagnoseFlow(document.getText(), isFragment(document)).map(item => {
    const line = Math.min(item.line, document.lineCount - 1);
    const range = item.character === undefined ? document.lineAt(line).range : new vscode.Range(line, item.character, line, item.character + 1);
    const diagnostic = new vscode.Diagnostic(range, item.message, vscode.DiagnosticSeverity.Error);
    diagnostic.source = 'Flowstride';
    diagnostic.code = item.code;
    return diagnostic;
  });
  diagnosticCollection.set(document.uri, diagnostics);
}

export function deactivate() {
  diagnosticCollection.clear();
}
