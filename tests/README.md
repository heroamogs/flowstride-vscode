# Testing the VS Code extension

Run the extension’s development checks from the repository root.

```sh
npm ci
npm test
```

Use `npm run test:security` to run the security checks separately. For parser parity, set `FLOWSTRIDE_OS_ROOT` and `FLOWSTRIDE_CLOUD_ROOT` to trusted engine source checkouts and run `npm run test:parity`. Set `FLOWSTRIDE_LAB_TESTS_ROOT` to include local Batch 1–8 flows and fragments in the comparison. The parity tests read parser source and fixture text.

Launch an Extension Development Host to test the editor providers. To review a packaged build, run `npm run package`, then choose **Install from VSIX…** in the Extensions view of a test profile. Select the generated package and run **Developer: Reload Window**.
