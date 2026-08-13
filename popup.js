document.addEventListener("DOMContentLoaded", async () => {
  const statusBadge = document.getElementById("status-badge");
  const unlockForm = document.getElementById("unlock-form");
  const relockContainer = document.getElementById("relock-container");
  const reasonInput = document.getElementById("reason");
  const categorySelect = document.getElementById("category");
  const timerSelect = document.getElementById("timer");
  const actionBtn = document.getElementById("action-btn");
  const relockBtn = document.getElementById("relock-btn");
  const calendarGrid = document.getElementById("calendar-grid");
  const logDetails = document.getElementById("log-details");
  const exportBtn = document.getElementById("export-btn");

  // Load initial data safely
  const data = await chrome.storage.local.get(["learnModeActive", "logs"]);
  let isActive = data.learnModeActive ?? true;
  let logs = Array.isArray(data.logs) ? data.logs : [];

  function updateUI() {
    if (isActive) {
      statusBadge.textContent = "LearnMode Active (AI Blocked)";
      statusBadge.className = "status-badge status-active";
      if (unlockForm) unlockForm.classList.remove("hidden");
      if (relockContainer) relockContainer.classList.add("hidden");
    } else {
      statusBadge.textContent = "LearnMode Unlocked";
      statusBadge.className = "status-badge status-unlocked";
      if (unlockForm) unlockForm.classList.add("hidden");
      if (relockContainer) relockContainer.classList.remove("hidden");
    }
    renderCalendarGrid();
  }

  function getDominantColor(dayLogs) {
    if (!dayLogs || dayLogs.length === 0) return "none";
    const categories = dayLogs.map(l => l.category);
    if (categories.includes("unproductive")) return "red";
    if (categories.includes("productive")) return "green";
    if (categories.includes("neutral")) return "yellow";
    return "none";
  }

  function renderCalendarGrid() {
    if (!calendarGrid) return;
    calendarGrid.innerHTML = "";
    const today = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];

      const dayLogs = logs.filter(log => log && log.timestamp && log.timestamp.startsWith(dateStr));
      const dominantColor = getDominantColor(dayLogs);

      const cell = document.createElement("div");
      cell.className = `day-cell color-${dominantColor}`;
      cell.textContent = d.getDate();
      cell.title = `${dateStr} (${dayLogs.length} logs)`;

      cell.addEventListener("click", () => showDayLogs(dateStr, dayLogs));
      calendarGrid.appendChild(cell);
    }
  }

  function showDayLogs(dateStr, dayLogs) {
    if (!logDetails) return;
    if (!dayLogs || dayLogs.length === 0) {
      logDetails.innerHTML = `<strong>${dateStr}</strong><br><span style="color:#9ca3af;">No AI logs recorded.</span>`;
      return;
    }

    logDetails.innerHTML = `<strong>${dateStr} Logs:</strong><br>` + 
      dayLogs.map(l => {
        const time = new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
          <div class="log-entry">
            <span class="tag tag-${l.category}">${l.category}</span> <strong>${time}</strong>: ${l.reason}
          </div>
        `;
      }).join('');
  }

  // Handle Unlocking
  if (actionBtn) {
    actionBtn.addEventListener("click", async () => {
      const reasonText = reasonInput ? reasonInput.value.trim() : "";

      if (!reasonText) {
        alert("Please enter a short reason before unlocking AI tools.");
        return;
      }

      const hours = timerSelect ? parseInt(timerSelect.value, 10) : 1;
      const newLog = {
        timestamp: new Date().toISOString(),
        reason: reasonText,
        category: categorySelect ? categorySelect.value : "productive",
        autoRelockHours: hours
      };

      try {
        const currentData = await chrome.storage.local.get(["logs"]);
        const updatedLogs = Array.isArray(currentData.logs) ? currentData.logs : [];
        updatedLogs.push(newLog);

        await chrome.storage.local.set({
          learnModeActive: false,
          logs: updatedLogs
        });

        // Set Alarm safely
        if (chrome.alarms) {
          await chrome.alarms.create("autoRelockAlarm", { delayInMinutes: hours * 60 });
        }

        logs = updatedLogs;
        isActive = false;
        if (reasonInput) reasonInput.value = "";
        updateUI();
      } catch (err) {
        console.error("Error saving log:", err);
      }
    });
  }

  // Handle Re-Locking
  if (relockBtn) {
    relockBtn.addEventListener("click", async () => {
      if (chrome.alarms) {
        await chrome.alarms.clear("autoRelockAlarm");
      }
      await chrome.storage.local.set({ learnModeActive: true });
      isActive = true;
      updateUI();
    });
  }

  // Handle CSV Export
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      if (!logs || logs.length === 0) {
        alert("No logs available to export.");
        return;
      }

      const headers = ["Timestamp", "Category", "AutoRelockHours", "Reason"];
      const rows = logs.map(l => [
        `"${l.timestamp}"`,
        `"${l.category}"`,
        l.autoRelockHours,
        `"${(l.reason || "").replace(/"/g, '""')}"`
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + 
        [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `learnmode_logs_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  updateUI();
});