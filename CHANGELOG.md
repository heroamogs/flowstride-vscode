# Changelog

## 2.0.0

- Import JavaScript and TypeScript helpers in a Flowstride feature. Complete helper names and use Go to Definition from an import, a helper call or a fixture call.
- Write attempt and worker fixtures and pass data between dependent flows with handoffs. The editor checks their syntax and placement and includes snippets for each command.
- Format and validate the 2.0 practice flows, including the catalog price checks and the admin-to-user handoff.

## 1.0.6

- Support the new browser, API, data and evidence commands in formatting, diagnostics, completions, snippets and highlighting.
- Enforce one Feature per file and a terminal Then per scenario. Keep intermediate assertion-only And blocks valid.
- Format and validate reusable command fragments and recognize scenario tags.

## 1.0.5

- Align assertion diagnostics with both engines. In this release, native assertion commands worked under `And`, including after `Then`.
- Preserve restrictions on state-changing commands under `And`.

## 1.0.4

- Preserve JSON payloads and API docstrings during formatting; remove automatic semicolon insertion.
- Add a precise quick fix for a semicolon misplaced immediately after a JSON opening brace.
- Use parser-based diagnostics, including valid apostrophes in feature/scenario titles.
- Cover all 36 native browser commands and 13 game actions in language support; add native snippets and fix `a11y` autocomplete.
- Suggest extracted local/global variables and preserve existing API, UI, session and plugin syntax.
- Run the installed local CLI as a process in a trusted workspace, with literal file arguments.
- Add formatting, parser parity, security and editor integration regression checks.
