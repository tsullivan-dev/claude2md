/* global TurndownService, Claude2MD_Extractor, browser */

(() => {
  // ---------------------------------------------------------------------------
  // Turndown configuration
  // ---------------------------------------------------------------------------

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
  });

  // Keep certain HTML elements as-is
  turndown.keep(["details", "summary"]);

  // Remove elements that are UI-only
  turndown.remove(["button", "svg", "style", "script"]);

  // Custom rule: fenced code blocks with language detection
  turndown.addRule("fencedCodeBlock", {
    filter(node) {
      return (
        node.nodeName === "PRE" &&
        node.querySelector("code")
      );
    },
    replacement(content, node) {
      const code = node.querySelector("code");
      const text = code.textContent || "";

      // Try to detect language from class
      let lang = "";
      const classes = code.className || "";
      const langMatch = classes.match(/(?:language|lang|hljs)-(\w+)/);
      if (langMatch) {
        lang = langMatch[1];
      } else {
        // Check parent or sibling for language label
        const parent = node.closest("[class*='code']") || node.parentElement;
        if (parent) {
          const label = parent.querySelector("[class*='lang'], [class*='language'], span");
          if (label) {
            const labelText = label.textContent.trim().toLowerCase();
            if (/^[a-z]+$/.test(labelText) && labelText.length < 20) {
              lang = labelText;
            }
          }
        }
      }

      // Ensure no triple backticks in the code
      const fence = text.includes("```") ? "````" : "```";
      return `\n\n${fence}${lang}\n${text.replace(/\n$/, "")}\n${fence}\n\n`;
    },
  });

  // Custom rule: inline code
  turndown.addRule("inlineCode", {
    filter(node) {
      return (
        node.nodeName === "CODE" &&
        node.parentNode.nodeName !== "PRE"
      );
    },
    replacement(content) {
      if (!content.trim()) return "";
      const backtick = content.includes("`") ? "``" : "`";
      const space = content.includes("`") ? " " : "";
      return `${backtick}${space}${content}${space}${backtick}`;
    },
  });

  // Custom rule: strikethrough
  turndown.addRule("strikethrough", {
    filter: ["del", "s", "strike"],
    replacement(content) {
      return `~~${content}~~`;
    },
  });

  // Custom rule: GFM tables
  turndown.addRule("table", {
    filter: "table",
    replacement(content, node) {
      const rows = Array.from(node.querySelectorAll("tr"));
      if (rows.length === 0) return content;

      const matrix = rows.map((row) =>
        Array.from(row.querySelectorAll("th, td")).map((cell) =>
          turndown.turndown(cell.innerHTML).replace(/\n/g, " ").replace(/\|/g, "\\|").trim()
        )
      );

      if (matrix.length === 0 || matrix[0].length === 0) return content;

      const colCount = Math.max(...matrix.map((r) => r.length));

      // Pad rows
      for (const row of matrix) {
        while (row.length < colCount) row.push("");
      }

      const lines = [];
      lines.push("| " + matrix[0].join(" | ") + " |");
      lines.push("| " + matrix[0].map(() => "---").join(" | ") + " |");
      for (let i = 1; i < matrix.length; i++) {
        lines.push("| " + matrix[i].join(" | ") + " |");
      }

      return "\n\n" + lines.join("\n") + "\n\n";
    },
  });

  // ---------------------------------------------------------------------------
  // Markdown assembly
  // ---------------------------------------------------------------------------

  function toMarkdown(html) {
    if (!html || !html.trim()) return "";
    return turndown.turndown(html).trim();
  }

  function assembleMarkdown(data, options) {
    const parts = [];

    parts.push(`# ${data.title}\n`);

    // Conversation metadata header
    if (options.includeMetadata && data.metadata) {
      const meta = data.metadata;
      const metaLines = [];
      if (meta.date) metaLines.push(`- **Date**: ${meta.date}`);
      if (meta.model) metaLines.push(`- **Model**: ${meta.model}`);
      if (meta.url) metaLines.push(`- **URL**: ${meta.url}`);
      if (metaLines.length > 0) {
        parts.push(metaLines.join("\n") + "\n");
        parts.push("---\n");
      }
    }

    for (let i = 0; i < data.messages.length; i++) {
      const msg = data.messages[i];
      const roleLabel = msg.role === "human" ? "Human" : "Assistant";

      parts.push(`## ${roleLabel}\n`);

      // Timestamp
      if (options.includeTimestamps && msg.timestamp) {
        parts.push(`*${msg.timestamp}*\n`);
      }

      // Thinking blocks (before main content)
      if (options.includeThinking && msg.thinking.length > 0) {
        for (const block of msg.thinking) {
          parts.push("<details>");
          parts.push("<summary>Thinking</summary>\n");
          parts.push(block);
          parts.push("\n</details>\n");
        }
      }

      // Main message content
      const md = toMarkdown(msg.html);
      if (md) parts.push(md + "\n");

      // Artifacts (after main content)
      if (options.includeArtifacts && msg.artifacts.length > 0) {
        for (const art of msg.artifacts) {
          const label = art.type ? `${art.title} (${art.type})` : art.title;
          parts.push(`> **Artifact:** ${label}\n`);
        }
      }

      // Horizontal rule between messages (not after the last one)
      if (i < data.messages.length - 1) {
        parts.push("---\n");
      }
    }

    return parts.join("\n");
  }

  // ---------------------------------------------------------------------------
  // Message handler
  // ---------------------------------------------------------------------------

  function triggerDownload(markdown, title) {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (title || "claude-conversation") + ".md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== "EXPORT_CONVERSATION") return;

    try {
      const data = Claude2MD_Extractor.extract();

      if (!data.messages || data.messages.length === 0) {
        sendResponse({ error: "No messages found on this page" });
        return;
      }

      const markdown = assembleMarkdown(data, message.options || {});

      if (message.action === "copy") {
        sendResponse({ success: true, markdown });
        return;
      }

      const filename = sanitizeFilename(data.title);
      triggerDownload(markdown, filename);
      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ error: `Extraction failed: ${err.message}` });
    }
  });

  function sanitizeFilename(name) {
    return (name || "claude-conversation")
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, 100);
  }
})();
