/* global window */

/**
 * DOM extraction logic for claude.ai conversations.
 * All fragile selectors are isolated here for easy maintenance.
 */

window.Claude2MD_Extractor = (() => {
  // ---------------------------------------------------------------------------
  // Selectors — update these when claude.ai changes its DOM
  // ---------------------------------------------------------------------------
  const SELECTORS = {
    // Conversation title
    title: [
      "button[data-testid='chat-title']",
      "h1",
      "title",
    ],

    // Individual message containers
    message: [
      "[data-testid='user-message']",
    ],

    // Assistant turn indicators (turns that have retry but no user-message)
    assistantTurnIndicator: [
      "[data-testid='action-bar-retry']",
    ],

    // Broader message wrapper (parent groups)
    messageGroup: [
      "[data-test-render-count]",
      ".min-h-0 > div > div",
    ],

    // Role detection patterns
    humanIndicators: [
      "[data-testid='user-message']",
      ".font-user-message",
      "[data-is-human-turn]",
    ],

    assistantIndicators: [
      "[data-testid='action-bar-retry']",
      "[data-testid='assistant-message']",
      ".font-claude-message",
    ],

    // Thinking block toggle button (used to find the thinking container)
    thinkingButton: [
      "button[class*='group/status']",
    ],

    // Artifact block references in messages
    artifact: [
      "div.artifact-block-cell",
    ],

    // Artifact title (inside artifact block)
    artifactTitle: [
      "div.leading-tight.line-clamp-1",
    ],

    // Artifact type label (inside artifact block)
    artifactType: [
      "div.text-text-400.line-clamp-1",
    ],

    // UI chrome to strip
    uiChrome: [
      "button[class*='copy']",
      "button[class*='Copy']",
      "[data-testid='copy-button']",
      "button:has(svg)",
      ".sr-only",
      // Timestamps in human messages
      "span.text-text-500.text-xs",
      "div.text-text-300",
    ],
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function querySelector(el, selectorArray) {
    for (const sel of selectorArray) {
      const found = el.querySelector(sel);
      if (found) return found;
    }
    return null;
  }

  function querySelectorAll(el, selectorArray) {
    for (const sel of selectorArray) {
      const found = el.querySelectorAll(sel);
      if (found.length > 0) return Array.from(found);
    }
    return [];
  }

  // ---------------------------------------------------------------------------
  // Title
  // ---------------------------------------------------------------------------

  function getTitle() {
    for (const sel of SELECTORS.title) {
      if (sel === "title") {
        const t = document.title.replace(/ [-–|] Claude$/, "").trim();
        if (t && t !== "Claude") return t;
        continue;
      }
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
    return "Claude Conversation";
  }

  // ---------------------------------------------------------------------------
  // Message extraction
  // ---------------------------------------------------------------------------

  function detectRole(el) {
    // Check explicit testid / class
    for (const sel of SELECTORS.humanIndicators) {
      if (el.querySelector(sel) || el.matches?.(sel)) return "human";
    }
    for (const sel of SELECTORS.assistantIndicators) {
      if (el.querySelector(sel) || el.matches?.(sel)) return "assistant";
    }

    // Fallback: look at data attributes and class names on ancestors
    const text = (el.className || "") + " " + (el.getAttribute("data-testid") || "");
    if (/human|user/i.test(text)) return "human";
    if (/assistant|claude|bot/i.test(text)) return "assistant";

    return null;
  }

  function findConversationContainer() {
    // Walk up from the first user-message until we find a container that
    // holds both user-message and action-bar-retry descendants (i.e. the
    // element whose direct children are individual turn wrappers).
    const firstUserMsg = document.querySelector("[data-testid='user-message']");
    if (!firstUserMsg) return null;

    let el = firstUserMsg.parentElement;
    while (el && el !== document.body) {
      // Check if this element's direct children include separate turns
      const hasUser = el.querySelector("[data-testid='user-message']");
      const hasAssistant = el.querySelector("[data-testid='action-bar-retry']");
      if (hasUser && hasAssistant) {
        // Verify that user-message and action-bar-retry live in DIFFERENT
        // direct children — that means this is the conversation container.
        const childWithUser = Array.from(el.children).find(
          (c) => c.querySelector("[data-testid='user-message']")
        );
        const childWithRetry = Array.from(el.children).find(
          (c) => c.querySelector("[data-testid='action-bar-retry']") && !c.querySelector("[data-testid='user-message']")
        );
        if (childWithUser && childWithRetry && childWithUser !== childWithRetry) {
          return el;
        }
      }
      el = el.parentElement;
    }
    return null;
  }

  function findMessageGroups() {
    // Strategy 1: find the conversation container and classify its children
    const container = findConversationContainer();

    if (container) {
      const turns = [];
      for (const child of container.children) {
        // Skip spacer divs and empty non-turn elements
        if (!child.textContent?.trim()) continue;

        const isHuman = child.querySelector("[data-testid='user-message']");
        const isAssistant = child.querySelector("[data-testid='action-bar-retry']");

        if (isHuman) {
          turns.push({ element: child, role: "human" });
        } else if (isAssistant) {
          turns.push({ element: child, role: "assistant" });
        }
      }

      if (turns.length > 0) return turns;
    }

    // Strategy 2: use broader group selectors
    for (const sel of SELECTORS.messageGroup) {
      const groups = document.querySelectorAll(sel);
      if (groups.length >= 2) {
        return Array.from(groups)
          .map((el) => {
            const role = detectRole(el);
            return role ? { element: el, role } : null;
          })
          .filter(Boolean);
      }
    }

    return [];
  }

  /**
   * Find the thinking block container(s) inside a message element.
   * The thinking block lives in a grid row (row-start-1) alongside the
   * response (row-start-2). We locate it by finding the thinking toggle
   * button and walking up to the grid-row container.
   */
  function findThinkingContainers(msgEl) {
    const containers = [];
    const buttons = querySelectorAll(msgEl, SELECTORS.thinkingButton);
    for (const btn of buttons) {
      // Walk up from the button to find the row-start-1 container
      let el = btn;
      while (el && el !== msgEl) {
        if (el.className && /\brow-start-1\b/.test(el.className)) {
          containers.push(el);
          break;
        }
        el = el.parentElement;
      }
    }
    return containers;
  }

  function extractThinking(msgEl) {
    const blocks = [];
    const containers = findThinkingContainers(msgEl);
    for (const container of containers) {
      // The summary text is in a span.truncate inside the button
      const summary = container.querySelector("span.truncate");
      const text = summary?.textContent?.trim();
      if (text) blocks.push(text);
    }
    return blocks;
  }

  function extractArtifacts(msgEl) {
    const artifacts = [];
    const artEls = querySelectorAll(msgEl, SELECTORS.artifact);
    for (const el of artEls) {
      const titleEl = querySelector(el, SELECTORS.artifactTitle);
      const title = titleEl?.textContent?.trim() || "Artifact";

      const typeEl = querySelector(el, SELECTORS.artifactType);
      const type = typeEl?.textContent?.trim() || "";

      artifacts.push({ title, type, element: el });
    }
    return artifacts;
  }

  function cleanMessageHtml(msgEl, thinkingEls, artifactEls) {
    const clone = msgEl.cloneNode(true);

    // Remove thinking block containers (row-start-1 that contain the toggle button)
    const thinkingContainers = findThinkingContainers(clone);
    for (const container of thinkingContainers) {
      container.remove();
    }

    // Remove artifacts from clone to avoid duplication
    for (const sel of SELECTORS.artifact) {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    }

    // Remove UI chrome
    for (const sel of SELECTORS.uiChrome) {
      try {
        clone.querySelectorAll(sel).forEach((el) => el.remove());
      } catch {
        // :has() may not be supported in querySelectorAll in some contexts
      }
    }

    // Remove SVG elements (icons)
    clone.querySelectorAll("svg").forEach((el) => el.remove());

    return clone.innerHTML;
  }

  // ---------------------------------------------------------------------------
  // Timestamp extraction
  // ---------------------------------------------------------------------------

  function extractTimestamp(msgEl) {
    const span = msgEl.querySelector("span.text-text-500.text-xs");
    return span?.textContent?.trim() || null;
  }

  // ---------------------------------------------------------------------------
  // Metadata extraction
  // ---------------------------------------------------------------------------

  function getMetadata() {
    const url = window.location.href;
    const date = new Date().toISOString().slice(0, 10);

    // Try to detect the model from the model selector
    const modelEl = document.querySelector("[data-testid='model-selector-dropdown']");
    const model = modelEl?.textContent?.trim() || null;

    return { url, date, model };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  function extract() {
    const title = getTitle();
    const metadata = getMetadata();
    const groups = findMessageGroups();

    const messages = groups.map((g) => {
      const thinking = extractThinking(g.element);
      const artifacts = extractArtifacts(g.element);
      const html = cleanMessageHtml(g.element, thinking, artifacts);
      const timestamp = extractTimestamp(g.element);

      return {
        role: g.role,
        html,
        thinking,
        artifacts: artifacts.map((a) => ({ title: a.title, type: a.type })),
        timestamp,
      };
    });

    return { title, metadata, messages };
  }

  return { extract };
})();
