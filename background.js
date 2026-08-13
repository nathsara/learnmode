// Target AI domains to block when LearnMode is active
const BLOCKED_DOMAINS = [
  "chatgpt.com",
  "openai.com",
  "claude.ai",
  "gemini.google.com",
  "perplexity.ai",
  "copilot.microsoft.com"
];

// Generate dynamic blocking rules for Chrome's engine
function getBlockingRules() {
  return BLOCKED_DOMAINS.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: `*://${domain}/*`,
      resourceTypes: ["main_frame"]
    }
  }));
}

// Enable or disable blocking rules dynamically
async function updateBlockingRules(enable) {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingRuleIds = existingRules.map(rule => rule.id);

  if (enable) {
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds,
      addRules: getBlockingRules()
    });
  } else {
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds
    });
  }
}

// Listen for state changes (LearnMode ON vs OFF) in storage
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.learnModeActive) {
    updateBlockingRules(changes.learnModeActive.newValue);
  }
});

// Listen for Auto-Relock Alarm trigger
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "autoRelockAlarm") {
    await chrome.storage.local.set({ learnModeActive: true });
  }
});

// Set default state to ON upon initial installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ learnModeActive: true, logs: [] });
  updateBlockingRules(true);
});