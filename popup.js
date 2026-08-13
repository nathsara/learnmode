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
    renderCalendarGrid();
  }

  // Calculate strict hierarchy: Red > Green > Yellow
  function getDominantColor(dayLogs) {
    if (!dayLogs || dayLogs.length === 0) return "none";
    const categories = dayLogs.map(l => l.category);
    if (categories.includes("unproductive")) return "red";
    if (categories.includes("productive")) return "green";
    if (categories.includes("neutral")) return "yellow";
    return "none";
  }

  // Render a 14-day trailing activity calendar
  function renderCalendarGrid() {
    calendarGrid.innerHTML = "";
    const today = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split("T")[0]; // YYYY-MM-DD

      // Filter logs for this specific date
      const dayLogs = logs.filter(log => log.timestamp.startsWith(dateStr));
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
    if (dayLogs.length === 0) {
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

  // Handle Unlocking + Alarm Schedule
  actionBtn.addEventListener("click", async () => {
    const reasonText = reasonInput.value.trim();

    if (!reasonText) {
      alert("Please enter a short reason before unlocking AI tools.");
      return;
    }

    const hours = parseInt(timerSelect.value, 10);
    const newLog = {
      timestamp: new Date().toISOString(),
      reason: reasonText,
      category: categorySelect.value,
      autoRelockHours: hours
    };

    logs.push(newLog);

    await chrome.storage.local.set({
      learnModeActive: false,
      logs: logs
    });

    // Schedule background alarm for auto-relock
    await chrome.alarms.create("autoRelockAlarm", { delayInMinutes: hours * 60 });

    isActive = false;
    reasonInput.value = "";
    updateUI();
  });

  // Handle Manual Re-Locking + Clear Alarms
  relockBtn.addEventListener("click", async () => {
    await chrome.alarms.clear("autoRelockAlarm");
    await chrome.storage.local.set({ learnModeActive: true });
    isActive = true;
    updateUI();
  });

  updateUI();
});