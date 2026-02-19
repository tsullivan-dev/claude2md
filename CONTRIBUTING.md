# Contributing to claude2md

Thanks for your interest in contributing!

## Getting Started

1. Fork and clone the repo
2. Open `about:debugging#/runtime/this-firefox` in Firefox
3. Click **Load Temporary Add-on** and select `manifest.json`
4. Make your changes, then click **Reload** on the extension card and refresh the claude.ai tab

No build tools, bundlers, or dependencies to install — just edit and reload.

## Architecture

```
popup/popup.js  →  sends message via browser.tabs.sendMessage()
                       ↓
content/content.js  →  receives message, assembles markdown
                       ↓
content/extractor.js  →  queries claude.ai DOM, returns structured data
```

All DOM selectors are centralized in the `SELECTORS` object at the top of `content/extractor.js`. If claude.ai changes its markup, that's the file to update.

## Submitting Changes

1. Create a branch from `main`
2. Keep changes focused — one fix or feature per PR
3. Test with a real conversation on claude.ai
4. Open a pull request with a clear description of what changed and why

## Reporting Bugs

Use the [bug report template](https://github.com/tsullivan-dev/claude2md/issues/new?template=bug_report.yml). Include your Firefox version, extension version, and steps to reproduce.
