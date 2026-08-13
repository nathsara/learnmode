document.addEventListener("DOMContentLoaded", () => {
  const backBtn = document.getElementById("backBtn");

  if (backBtn) {
    backBtn.addEventListener("click", async () => {
      // 1. Check current Learn Mode status
      const data = await chrome.storage.local.get(["learnModeActive"]);
      const isModeActive = data.learnModeActive ?? true;

      // 2. Get original requested target URL from query parameter
      const urlParams = new URLSearchParams(window.location.search);
      const originalTarget = urlParams.get("target");

      if (!isModeActive && originalTarget) {
        // If EXITED: Navigate directly to the page you were trying to access!
        window.location.href = originalTarget;
      } else {
        // If ACTIVE: Safely attempt history back, or fallback to clean Google search
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = "https://www.google.com";
        }
      }
    });
  }
});