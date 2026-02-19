const exportBtn = document.getElementById("exportBtn");
const copyBtn = document.getElementById("copyBtn");
const statusEl = document.getElementById("status");
const includeThinking = document.getElementById("includeThinking");
const includeArtifacts = document.getElementById("includeArtifacts");
const includeTimestamps = document.getElementById("includeTimestamps");
const includeMetadata = document.getElementById("includeMetadata");

function setStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = type || "";
}

function getOptions() {
  return {
    includeThinking: includeThinking.checked,
    includeArtifacts: includeArtifacts.checked,
    includeTimestamps: includeTimestamps.checked,
    includeMetadata: includeMetadata.checked,
  };
}

async function doExport(action) {
  exportBtn.disabled = true;
  copyBtn.disabled = true;
  setStatus(action === "copy" ? "Copying..." : "Extracting...", "");

  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.url?.startsWith("https://claude.ai/")) {
      setStatus("Not a claude.ai page", "error");
      return;
    }

    const response = await browser.tabs.sendMessage(tab.id, {
      type: "EXPORT_CONVERSATION",
      action,
      options: getOptions(),
    });

    if (!response || response.error) {
      setStatus(response?.error || "No response from page", "error");
      return;
    }

    if (action === "copy" && response.markdown) {
      await navigator.clipboard.writeText(response.markdown);
    }

    setStatus(action === "copy" ? "Copied!" : "Exported!", "success");
  } catch (err) {
    setStatus(err.message || "Export failed", "error");
  } finally {
    exportBtn.disabled = false;
    copyBtn.disabled = false;
  }
}

exportBtn.addEventListener("click", () => doExport("download"));
copyBtn.addEventListener("click", () => doExport("copy"));
