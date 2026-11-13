# Flowstride for VS Code

Write, format and run `.flow` tests with the open-source engine or a Flowstride Cloud account.

## Get started

Open **Extensions** in VS Code, search for **Flowstride Automation**, and select **Install**. [Flowstride Automation on the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=flowstride.flowstride-vscode)

Install and initialize Flowstride in your test project.

```sh
npm i flowstride
npx flowstride init
npx flowstride install chromium
```

Open the project folder in VS Code and create a `.flow` file. Configure your application's `BASE_URL` in the project's `.env` and use your application's actual targets and expected results. Flowstride works locally without an account. Cloud offers free accounts and connects through `npx flowstride login`; feature availability depends on workspace access and usage allowances.

## Formatting and diagnostics

- Format on save is enabled for Flowstride files. Formatting adjusts DSL indentation and preserves JSON payloads, API docstrings, comments, strings, line endings and existing semicolons.
- The formatter does not insert semicolons. The engines accept commands with or without them; a multiline JSON command may end with `};` after its closing brace.
- If an older formatter produced `{;`, use the lightbulb quick fix **Remove semicolon after JSON opening brace**. No file is repaired without applying that edit.
- Diagnostics use a bundled Flowstride parser. Apostrophes in titles, such as `Feature: User login's flow`, are valid.
- Start with one `Feature:` per test file. Each `Scenario:` has `Given`, `When` and a final `Then`. Put intermediate assertion-only `And` blocks before `Then`. Use several commands inside the final `Then` when needed. A following `Scenario:` starts a new sequence.
- Place `Tags:` directly below its `Scenario:` heading. Put `flow.data.cases` first in `Given` and `flow.skipIf` at the start of `Given` or directly after the case declaration.
- Open `.flowpart` files for formatting and command diagnostics. Include them with `flow.call` from a `.flow` test. The runner validates what a fragment expands to when called from an assertion-only `And`.
- Real syntax errors still appear in Problems. The editor checks syntax; only an execution can verify your application's result.

If you disabled format on save while using an older extension, enable it again in your Flowstride language settings after updating. This extension does not overwrite your existing editor preferences.

## Native command support

Autocomplete, snippets, diagnostics and highlighting cover:

| Group | Commands |
| --- | --- |
| Browser profiles/settings | `flow.browser.create`, `use`, `close`, `list`, `offline`, `permissions`, `clearPermissions`, `geolocation` |
| Assertions and run controls | `flow.assert.that`, `flow.assert.value`, `flow.soft`, `flow.wait`, `flow.log`, `flow.pause`, `flow.pace` |
| Browser interactions | Keyboard, focus, clear, pointer, scroll and history commands, plus `flow.input.type` |
| Tabs, frames and dialogs | `flow.tab.*`, `flow.frame.*`, `flow.dialog.*` |
| Network | `flow.network.route`, `unroute`, `arm`, `wait`, `expect` |
| Downloads | `flow.download.arm`, `save`, `expect` |
| Files and data | `flow.files.select`, `flow.data.load`, `cases`, `seed`, `flow.file.read`, property and network extraction |
| Workflow control | `flow.call`, `flow.cleanup.register`, `flow.skipIf` and scenario tags |
| Structured API | `flow.api.request`, `create`, `use`, `close`, `expectSchema`, `poll` |
| Browser clocks | `flow.clock.install`, `pauseAt`, `resume`, `runFor`, `fastForward`, `setFixedTime`, `setSystemTime` |
| Function doubles | `flow.stub.install`, `expect`, `restore` |
| Evidence | `flow.trace.start`, `stop`; `flow.har.replay` |
| Application events and visuals | `flow.console.*`, `flow.channel.*` for WebSocket and SSE, and `flow.visual.*` |
| Accessibility | `flow.a11y.scan`, `snapshot`, `match` |
| Components | `flow.component.mount`, `update`, `unmount` |
| Games | Native game aliases and all 13 game actions |

Existing API/UI commands, `flow.expect`, email OTP, iFrames, tables/cells, audio input, saved sessions, spatial targets and variables remain supported. Extracted variable names and explicitly global extractions appear in completion suggestions.

Type `flow.` to choose a command group, then type its next dot to choose an action. The native snippets contain editable example values. Game action suggestions use an alias declared with `let game = "flowstride:game";`.

For example, in an application that has a Submit button:

```flow
Feature: Submit a form

  Scenario: The form is ready for submission
    Given "Open the form"
      flow.open "/form";

    When "Enter the required email"
      flow.type input "Email" "reader@example.test";

    Then "The Submit button becomes enabled"
      flow.assert.that {
        "target": {
          "text": "Submit",
          "element": "button"
        },
        "condition": "enabled",
        "timeout": 10000
      };
```

Use the [structured command index](https://docs.flowstride.io/reference/structured-commands) and [assertions reference](https://docs.flowstride.io/reference/assertions) for command examples and the supported checks.

Native commands still require an engine that implements them. Browser installation, FlowMail access, application credentials, component dependencies and fixtures are execution prerequisites. Audio-file microphone injection requires Chromium. Read the [Flowstride documentation](https://docs.flowstride.io/) for complete setup and command behavior.

## Run from the editor

Use **Run Test** in the editor title bar. The extension saves the document, then starts your project's installed CLI with the selected file and its project working directory. Filenames are passed as literal process arguments.

The project must be a trusted workspace, and Flowstride must already be installed locally. Editing and diagnostics never load project plugins or run your application. The extension does not download a runner automatically. If Node.js is not on VS Code's PATH, set `flowstride.nodePath` to your Node executable in Settings.
