document.addEventListener("DOMContentLoaded", async () => {
  const statusBadge = document.getElementById("status-badge");
  const unlockForm = document.getElementById("unlock-form");
  const relockContainer = document.getElementById("relock-container");
  const reasonInput = document.getElementById("reason");
  const categorySelect = document.getElementById("category");
  const timerSelect = document.getElementById("timer");
  const actionBtn = document.getElementById("action-btn");
  const relockBtn = document.getElementById("relock-btn");

  // Read current status and existing logs from local storage
  const data = await chrome.storage.local.get(["learnModeActive", "logs"]);
  let isActive = data.learnModeActive ?? true;
  let logs = data.logs || [];

  function updateUI() {
    if (isActive) {
      statusBadge.textContent = "LearnMode Active (AI Blocked)";
      statusBadge.className = "status-badge status-active";
      unlockForm.classList.remove("hidden");
      relockContainer.classList.add("hidden");
    } else {
      statusBadge.textContent = "LearnMode Unlocked";
      statusBadge.className = "status-badge status-unlocked";
      unlockForm.classList.add("hidden");
      relockContainer.classList.remove("hidden");
    }
  }

  // Handle Unlocking
  actionBtn.addEventListener("click", async () => {
    const reasonText = reasonInput.value.trim();

    if (!reasonText) {
      alert("Please enter a short reason before unlocking AI tools.");
      return;
    }

    const newLog = {
      timestamp: new Date().toISOString(),
      reason: reasonText,
      category: categorySelect.value,
      autoRelockHours: parseInt(timerSelect.value, 10)
    };

    logs.push(newLog);

    // Save updated state and log entry
    await chrome.storage.local.set({
      learnModeActive: false,
      logs: logs
    });

    isActive = false;
    reasonInput.value = "";
    updateUI();
  });

  // Handle Manual Re-Locking
  relockBtn.addEventListener("click", async () => {
    await chrome.storage.local.set({ learnModeActive: true });
    isActive = true;
    updateUI();
  });

  updateUI();
});