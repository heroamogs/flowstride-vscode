# Flowstride for VS Code

The official Visual Studio Code extension for **Flowstride**, the Flow-First test automation framework.

This extension provides a first-class developer experience for writing, reading, and managing your `.flow` automation journeys directly inside your editor.

## Features

- **Syntax Highlighting:** Rich, native colorization for all `.flow` files, making your Given/When/Then scenarios and `flow.*` commands beautiful and easy to read.

- **Custom File Icons:** Instantly recognize your Flowstride journeys in the VS Code file explorer with official `.flow` file icons.

- **Smart Snippets:** Type less, automate faster. Includes built-in code snippets for standard Flowstride actions (e.g., `flow.click`, `flow.type`, `flow.expect`).

- **Seamless Integration:** Designed to work perfectly alongside the `flowstride-os` CLI and Enterprise Cloud engine.

## Getting Started

1. Install the extension from the VS Code Marketplace.
2. Open or create a workspace with a `./flows` directory.
3. Create a new file with the `.flow` extension (e.g., `login.flow`).
4. Start typing your automation scenarios!

## Requirements

To actually execute your .flow files, you need the Flowstride CLI installed on your machine or in your project:

```Bash
npm install flowstride --save-dev
```

## Contributing

Flowstride is an open-source framework, and this extension is too! We welcome pull requests for new snippets, improved syntax highlighting rules, and bug fixes.

1. Fork this repository.
2. Clone it locally and run npm install.
3. Press F5 in VS Code to open a new window with your local extension loaded for testing.
4. Submit a Pull Request!
