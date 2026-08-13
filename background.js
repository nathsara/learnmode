const BLOCKED_DOMAINS = [
  "chatgpt.com",
  "openai.com",
  "claude.ai",
  "gemini.google.com",
  "perplexity.ai",
  "copilot.microsoft.com"
];

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

// Safely update declarativeNetRequest rules based on stored state
async function updateBlockingRules(enable) {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingRuleIds = existingRules.map(rule => rule.id);

  if (enable) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds
    });
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: getBlockingRules()
    });
    reloadOpenAITabs();
  } else {
    // Completely clear rules when unlocked
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds
    });
  }
}

async function reloadOpenAITabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.url && BLOCKED_DOMAINS.some(domain => tab.url.includes(domain))) {
      chrome.tabs.reload(tab.id);
    }
  }
}

// Listen ONLY for changes to learnModeActive
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.learnModeActive !== undefined) {
    updateBlockingRules(changes.learnModeActive.newValue);
  }
});

// Alarm Listener for Auto-Relock
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "autoRelockAlarm") {
    await chrome.storage.local.set({ learnModeActive: true });
  }
});

// SAFE INITIALIZATION: Preserve existing logs and state
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(["learnModeActive", "logs"]);
  
  const newState = {
    learnModeActive: data.learnModeActive ?? true,
    logs: data.logs || []
  };

  await chrome.storage.local.set(newState);
  updateBlockingRules(newState.learnModeActive);
});