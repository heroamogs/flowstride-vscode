# Testing the VS Code extension

Run the extension’s development checks from the repository root.

```sh
npm ci
npm test
```

Use `npm run test:security` to run the security checks separately. For parser parity, set `FLOWSTRIDE_OS_ROOT` and `FLOWSTRIDE_CLOUD_ROOT` to trusted engine checkouts with a fresh build and run `npm run test:parity`. Set `FLOWSTRIDE_LAB_TESTS_ROOT` to include local Batch 1–8 flows and fragments in the comparison. The parity tests run the built parsers on editor output and compare the shared workflow contract and helper path source files.

Launch an Extension Development Host to test the editor providers. To review a packaged build, run `npm run package`, then choose **Install from VSIX…** in the Extensions view of a test profile. Select the generated package and run **Developer: Reload Window**.

For the real editor regression, launch VS Code with an isolated user-data directory. Use the installed VSIX folder as `--extensionDevelopmentPath` and this repository's `tests/editor-host.cjs` as `--extensionTestsPath`. Open a disposable workspace and set `FLOWSTRIDE_EDITOR_TEST_DIR` to its absolute path. The test writes sample files and changes formatting settings in that profile.

To include the FS 2.0 practice flows, set `FLOWSTRIDE_EDITOR_INSTALL_OPEN` and `FLOWSTRIDE_EDITOR_INSTALL_PRO` to initialized practice projects inside that workspace. Set `FLOWSTRIDE_EDITOR_RUN_TEST=1` to execute the public project's catalog flow through **Run Test**. For this unattended check, install the matching Chromium binary and set `FLOWSTRIDE_NATIVE_CI=1` in the task terminal's environment so the CLI exits with a result. The successful host run writes `host-results.json` in the disposable workspace.
