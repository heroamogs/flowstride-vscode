import { locateRunner } from "./runner";
import { Lexer } from "./language/lexer";
import { Parser } from "./language/parser";
import * as vscode from "vscode";

const diagnosticCollection =
  vscode.languages.createDiagnosticCollection("flowstride");

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "flowstride.runTest",
      async (uri?: vscode.Uri) => {
        if (!vscode.workspace.isTrusted) { vscode.window.showWarningMessage('Trust this workspace before running Flowstride.'); return; }
        const fileUri = uri || vscode.window.activeTextEditor?.document.uri;
        if (!fileUri || fileUri.scheme !== 'file') { vscode.window.showErrorMessage('Choose a local Flowstride file.'); return; }
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

  const completionCommands = ["acceptDialog", "autoheal", "check", "click", "close", "delete", "drag", "expect", "extract", "forceClick", "forceType", "get", "graphql", "hover", "injectAudio", "mail.getotp", "open", "passcode", "patch", "post", "put", "rejectDialog", "save", "select", "set", "switchTo", "try", "type", "uncheck", "upload", "use", "waitForPipeline"];

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

          const gameAliases = [...document.getText().matchAll(/\blet\s+(\w+)\s*=\s*["']flowstride:game["']/g)].map(match=>match[1]);
          const alias = linePrefix.match(/([A-Za-z_]\w*)\.$/)?.[1];
          if (alias && gameAliases.includes(alias)) {
            return ['tap','drag','swipe','key','checkpoint','snapshot','expectVisual','state','expectState','snapshotState','expectPreserved','fixture','select'].map(action=>{
              const item=new vscode.CompletionItem(action,vscode.CompletionItemKind.Method);
              item.detail='Native Flowstride game action';return item;
            });
          }

          // 1. Actions (flow.)
          if (linePrefix.endsWith("flow.")) {
            completionCommands.forEach((cmd) => {
              const item = new vscode.CompletionItem(
                cmd,
                vscode.CompletionItemKind.Method,
              );
              item.detail = "Flowstride command";
              items.push(item);
            });
            return items;
          }

          // 2. Data Generators & Memory Scanner
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
              const usedVariables = documentText.match(/@[A-Za-z0-9_]+/g) || [];
              const allUsed = [
                ...new Set([...usedGenerators, ...usedVariables]),
              ];

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
      "@", // Master triggers
    ),
  );

  // --- NATIVE AUTO-FORMATTER & SEMICOLON INJECTOR ---
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider("flow", {
      provideDocumentFormattingEdits(
        document: vscode.TextDocument,
      ): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        const protectedLines = new Set<number>();
        try {
          const tokens = new Lexer(document.getText()).tokenise();
          for (const token of tokens) if (token.type === 'JSON_PAYLOAD' || (token.type === 'STRING' && token.value.includes('\n'))) {
            const count=(token.value.match(/\n/g)||[]).length;
            for(let line=token.line-1;line<=token.line+count;line++)protectedLines.add(line);
          }
        } catch { return []; }

        const lines = document.getText().split("\n");

        let inDocString = false;
        let currentIndent = "";

        for (let i = 0; i < lines.length; i++) {
          const rawLine = lines[i];
          if (protectedLines.has(i)) continue;
          let line = rawLine.trim();

          // 1. Skip formatting inside multiline strings """
          if (line.includes('"""')) {
            const count = (line.match(/"""/g) || []).length;
            if (count % 2 !== 0) {
              inDocString = !inDocString;
            }
            if (inDocString || count > 0) continue;
          }
          if (inDocString) continue;

          // 2. Clean up blank lines
          if (!line) {
            if (rawLine.length > 0) {
              edits.push(vscode.TextEdit.replace(document.lineAt(i).range, ""));
            }
            continue;
          }

          // 3. Determine semantic indentation level
          const lowerLine = line.toLowerCase();

          if (lowerLine.startsWith("feature:")) {
            currentIndent = "";
          } else if (
            lowerLine.startsWith("scenario:") ||
            lowerLine.startsWith("only.scenario:")
          ) {
            currentIndent = "  "; // 2 Spaces
          } else if (
            /^(given|when|then|and|stop\.given|stop\.when|stop\.then|stop\.and)\b/i.test(
              line,
            ) ||
            lowerLine.startsWith("let ")
          ) {
            currentIndent = "  "; // 2 Spaces
          } else if (
            lowerLine.startsWith("flow.") ||
            line.match(/^[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+/)
          ) {
            currentIndent = "    "; // 4 Spaces

            // 4. Inject semicolon at the end of execution scripts if missing
            if (!line.endsWith(";")) {
              line += ";";
            }
          } else if (line.startsWith("//") || line.startsWith("/*")) {
            // Keep comments aligned with whatever the current scope is
          } else {
            currentIndent = "    "; // Fallback for unmatched action payloads (like 'with')
          }

          const formattedLine = currentIndent + line;

          // Only push an edit if the line actually needs changing
          if (rawLine !== formattedLine) {
            edits.push(
              vscode.TextEdit.replace(document.lineAt(i).range, formattedLine),
            );
          }
        }
        return edits;
      },
    }),
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
  const diagnostics:vscode.Diagnostic[]=[];
  try { new Parser(new Lexer(document.getText()).tokenise()).parse(); }
  catch (error) {
    const message=error instanceof Error?error.message:String(error);
    const match=message.match(/(?:on line|Line|line)\s+(\d+)/);
    const line=Math.min(Math.max(0,Number(match?.[1]||1)-1),document.lineCount-1);
    diagnostics.push(new vscode.Diagnostic(document.lineAt(line).range,message,vscode.DiagnosticSeverity.Error));
  }
  diagnosticCollection.set(document.uri,diagnostics);
}

export function deactivate() {
  diagnosticCollection.clear();
}
