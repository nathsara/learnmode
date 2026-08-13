const BLOCKED_DOMAINS = [
  "chatgpt.com",
  "openai.com",
  "claude.ai",
  "gemini.google.com",
  "perplexity.ai",
  "copilot.microsoft.com"
];

const BLOCKED_URL = chrome.runtime.getURL("blocked.html");

function getBlockingRules() {
  // 1. Domain Redirect Rules -> Redirects blocked AI domains to blocked.html
  return BLOCKED_DOMAINS.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { url: BLOCKED_URL }
    },
    condition: {
      urlFilter: "*://" + domain + "/*",
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
      removeRuleIds: existingRuleIds,
      addRules: getBlockingRules()
    });
    reloadBlockedTabs();
  } else {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds
    });
  }
}

async function reloadBlockedTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.url) continue;

    const isDomainMatch = BLOCKED_DOMAINS.some(domain => tab.url.includes(domain));
    const isGoogleAIMode = tab.url.includes("google.com/search") && tab.url.includes("udm=50");

    if (isDomainMatch || isGoogleAIMode) {
      chrome.tabs.reload(tab.id);
    }
  }
}

// Helper to check if a URL is Google AI Mode
function isAIModeUrl(url) {
  if (!url) return false;
  return url.includes("google.com/search") && url.includes("udm=50");
}

// Guard 1: Web Navigation for Google AI Mode
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;

  if (isAIModeUrl(details.url)) {
    const data = await chrome.storage.local.get(["learnModeActive"]);
    if (data.learnModeActive ?? true) {
      chrome.tabs.update(details.tabId, { url: BLOCKED_URL });
    }
  }
});

// Guard 2: Tab Updates for Google AI Mode SPA transitions
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const targetUrl = changeInfo.url || tab.url;

  if (isAIModeUrl(targetUrl)) {
    const data = await chrome.storage.local.get(["learnModeActive"]);
    if (data.learnModeActive ?? true) {
      chrome.tabs.update(tabId, { url: BLOCKED_URL });
    }
  }
});

// Listen for state changes to learnModeActive
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

// Safe Initialization
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(["learnModeActive", "logs"]);
  
  const newState = {
    learnModeActive: data.learnModeActive ?? true,
    logs: data.logs || []
  };

  await chrome.storage.local.set(newState);
  updateBlockingRules(newState.learnModeActive);
});