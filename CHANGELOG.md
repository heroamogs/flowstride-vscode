# Changelog

## 1.0.4

- Preserve JSON payloads and API docstrings during formatting; remove automatic semicolon insertion.
- Add a precise quick fix for a semicolon misplaced immediately after a JSON opening brace.
- Use parser-based diagnostics, including valid apostrophes in feature/scenario titles.
- Cover all 36 native browser commands and 13 game actions in language support; add native snippets and fix `a11y` autocomplete.
- Suggest extracted local/global variables and preserve existing API, UI, session and plugin syntax.
- Run the installed local CLI as a process in a trusted workspace, with literal file arguments.
- Add formatting, parser parity, security and editor integration regression checks.
