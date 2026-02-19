# claude2md

Firefox extension that exports [Claude.ai](https://claude.ai) conversations to Markdown.

## Features

- Export full conversations as `.md` files or copy to clipboard
- Preserves formatting: headings, code blocks (with language detection), tables, lists, bold/italic/strikethrough
- Thinking blocks rendered as collapsible `<details>` sections
- Artifact references with title and type
- Optional timestamps and metadata (date, model, URL)

## Install

1. Download or clone this repo
2. Open `about:debugging#/runtime/this-firefox` in Firefox
3. Click **Load Temporary Add-on** and select `manifest.json`

## Usage

1. Open a conversation on [claude.ai](https://claude.ai)
2. Click the extension icon
3. Toggle options as desired
4. Click **Export .md** to download or **Copy** to clipboard

## Options

| Toggle | Default | Description |
|--------|---------|-------------|
| Include thinking blocks | On | Collapsible thinking summaries |
| Include artifacts | On | Artifact references as blockquotes |
| Include timestamps | Off | Message timestamps |
| Include metadata | Off | Date, model, and URL header |

## Development

No build system — edit files and reload the extension.

After changes: click **Reload** on the extension card in `about:debugging`, then refresh the Claude.ai tab.

Requires Firefox 109+.

## Building

```sh
bash scripts/build.sh
```

Produces `web-ext-artifacts/claude2md-{version}.zip` ready for AMO submission.

## Releasing

1. Bump `version` in `manifest.json`
2. `git commit -am "Bump version to X.Y.Z"`
3. `git tag vX.Y.Z`
4. `git push && git push --tags`

GitHub Actions will build the zip and create a release automatically.
