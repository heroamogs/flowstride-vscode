# Flowstride for VS Code

Write, format and run `.flow` tests using the same language in OS and Cloud.

## Get started

Install **Flowstride Automation** from the VS Code Marketplace. In your test project, install and initialize Flowstride:

```sh
npm i flowstride
npx flowstride init
npx flowstride install chromium
```

Open the project folder in VS Code and create a `.flow` file. Configure your application's `BASE_URL` in the project's `.env` and use your application's actual targets and expected results. OS works locally without an account. Cloud offers free accounts and connects through `npx flowstride login`; feature availability depends on workspace access and usage allowances.

## Formatting and diagnostics

- Format on save is enabled for Flowstride files. Formatting adjusts DSL indentation and preserves JSON payloads, API docstrings, comments, strings, line endings and existing semicolons.
- The formatter does not insert semicolons. The engines accept commands with or without them; a multiline JSON command may end with `};` after its closing brace.
- If an older formatter produced `{;`, use the lightbulb quick fix **Remove semicolon after JSON opening brace**. No file is repaired without applying that edit.
- Diagnostics use a bundled Flowstride parser. Apostrophes in titles, such as `Feature: User login's flow`, are valid.
- Real syntax errors still appear in Problems. The editor checks syntax; only an execution can verify your application's result.

If you disabled format on save while using an older extension, enable it again in your Flowstride language settings after updating. This extension does not overwrite your existing editor preferences.

## Native command support

Autocomplete, snippets, diagnostics and highlighting cover:

| Group | Commands |
| --- | --- |
| Browser profiles/settings | `flow.browser.create`, `use`, `close`, `list`, `offline`, `permissions`, `clearPermissions`, `geolocation` |
| Browser assertions | `flow.assert.that` |
| Network | `flow.network.route`, `unroute`, `arm`, `wait`, `expect` |
| Downloads | `flow.download.arm`, `save`, `expect` |
| Browser clocks | `flow.clock.install`, `pauseAt`, `resume`, `runFor`, `fastForward`, `setFixedTime`, `setSystemTime` |
| Function doubles | `flow.stub.install`, `expect`, `restore` |
| Evidence | `flow.trace.start`, `stop`; `flow.har.replay` |
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
        "role": "button",
        "name": "Submit",
        "condition": "enabled",
        "timeout": 10000
      };
```

Native checks `flow.assert.that`, `flow.network.expect`, `flow.download.expect`, `flow.stub.expect`, `flow.a11y.scan` and `flow.a11y.match` are accepted under `And`, including after `Then`. State-changing native commands still require an action block. Use matching engines for these execution rules.

Native commands still require an engine that implements them. Browser installation, FlowMail access, application credentials, component dependencies and fixtures are execution prerequisites. Audio-file microphone injection requires Chromium. Read the [Flowstride documentation](https://docs.flowstride.io/) for complete setup and command behavior.

## Run from the editor

Use **Run Test** in the editor title bar. The extension saves the document, then starts your project's installed CLI with the selected file and its project working directory. Filenames are passed as literal process arguments.

The project must be a trusted workspace, and Flowstride must already be installed locally. Editing and diagnostics never load project plugins or run your application. The extension does not download a runner automatically. If Node.js is not on VS Code's PATH, set `flowstride.nodePath` to your Node executable in Settings.

## Install a local extension package

In VS Code, open Extensions, choose **Install from VSIX…**, select the supplied `.vsix`, and run **Developer: Reload Window**. Confirm the installed version under **Flowstride Automation**. Updating the npm engine does not update the VS Code extension.

## Development and checks

```sh
npm ci
npm test
npm run test:security
```

For parser comparisons, set `FLOWSTRIDE_OS_ROOT` and/or `FLOWSTRIDE_CLOUD_ROOT` to trusted engine source checkouts before running `npm run test:parity`. These test-only comparisons do not load application plugins. Press F5 to run an Extension Development Host.
