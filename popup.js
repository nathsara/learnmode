document.addEventListener("DOMContentLoaded", async () => {
  const modeToggle = document.getElementById("mode-toggle");
  const toggleStatus = document.getElementById("toggle-status");
  const calendarScreen = document.getElementById("calendar-screen");
  const loggingScreen = document.getElementById("logging-screen");
  const infoScreen = document.getElementById("info-screen");
  
  const monthTitle = document.getElementById("month-title");
  const calendarGrid = document.getElementById("calendar-grid");
  const prevMonthBtn = document.getElementById("prev-month");
  const nextMonthBtn = document.getElementById("next-month");
  const logsContainer = document.getElementById("logs-container");
  
  const reasonInput = document.getElementById("reason");
  const categorySelect = document.getElementById("category");
  const timerSelect = document.getElementById("timer");
  const exitLemonadeBtn = document.getElementById("exit-lemonade-btn");
  const cancelOffBtn = document.getElementById("cancel-off-btn");
  const exportBtn = document.getElementById("export-btn");
  const helpBtn = document.getElementById("help-btn");
  const closeInfoBtn = document.getElementById("close-info-btn");

  let viewDate = new Date();
  const data = await chrome.storage.local.get(["learnModeActive", "logs"]);
  let isActive = data.learnModeActive ?? true;
  let logs = Array.isArray(data.logs) ? data.logs : [];

  // Helper to get local YYYY-MM-DD format (avoids UTC timezone shifts)
  function getLocalDateString(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function updateScreenView() {
    modeToggle.checked = isActive;
    toggleStatus.textContent = isActive ? "ON" : "OFF";

    calendarScreen.classList.remove("hidden");
    loggingScreen.classList.add("hidden");
    infoScreen.classList.add("hidden");
  }

  function renderCalendar() {
    if (!calendarGrid) return;
    calendarGrid.innerHTML = "";

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const monthNames = [
      "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
      "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
    ];

    monthTitle.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = getLocalDateString(new Date());

    for (let i = 0; i < firstDay; i++) {
      const emptyBox = document.createElement("div");
      emptyBox.className = "day-box";
      calendarGrid.appendChild(emptyBox);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const dayLogs = logs.filter(l => {
        if (!l || !l.timestamp) return false;
        const logLocalDate = getLocalDateString(new Date(l.timestamp));
        return logLocalDate === cellDateStr;
      });
      
      const dominantColor = getDominantColor(dayLogs);
      
      const box = document.createElement("div");
      box.className = "day-box";

      const circle = document.createElement("div");
      circle.className = `day-circle ${dominantColor ? 'circle-' + dominantColor : ''}`;
      circle.textContent = day;

      if (cellDateStr === todayStr) {
        circle.classList.add("today-circle");
      }

      box.appendChild(circle);
      box.addEventListener("click", () => showDayLogs(cellDateStr, dayLogs));
      calendarGrid.appendChild(box);
    }
  }

  function getDominantColor(dayLogs) {
    if (!dayLogs || dayLogs.length === 0) return null;
    const categories = dayLogs.map(l => l.category);
    if (categories.includes("unproductive")) return "red";
    if (categories.includes("productive")) return "green";
    if (categories.includes("neutral")) return "yellow";
    return null;
  }

  function showDayLogs(dateStr, dayLogs) {
    if (!logsContainer) return;
    if (!dayLogs || dayLogs.length === 0) {
      logsContainer.innerHTML = `<strong>${dateStr}</strong><br><span style="color:#666;">No logs recorded.</span>`;
      return;
    }

    logsContainer.innerHTML = `<strong>${dateStr} Logs:</strong><br>` + 
      dayLogs.map(l => {
        const exitTime = new Date(l.timestamp);
        const startTimeStr = exitTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let timeRange = startTimeStr;

        if (l.reEnteredAt) {
          // If manually re-entered, show actual exit -> re-entry interval
          const reEntryTimeStr = new Date(l.reEnteredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          timeRange = `${startTimeStr} - ${reEntryTimeStr}`;
        } else if (l.autoRelockHours === "never") {
          timeRange = `${startTimeStr} &rarr;`;
        } else if (l.autoRelockHours) {
          // Estimated end time if not re-entered yet
          const endTimeStr = new Date(exitTime.getTime() + (parseInt(l.autoRelockHours, 10) * 3600000))
            .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          timeRange = `${startTimeStr} - ${endTimeStr}`;
        }

        return `
          <div class="log-row">
            <span class="tag tag-${l.category}">${l.category}</span> ${timeRange} ${l.reason}
          </div>
        `;
      }).join('');
  }

  // Toggle Switch Handler
  modeToggle.addEventListener("change", async () => {
    if (!modeToggle.checked) {
      // Switched from ON to OFF -> Show Intent Screen
      calendarScreen.classList.add("hidden");
      loggingScreen.classList.remove("hidden");
      toggleStatus.textContent = "OFF";
    } else {
      // Switched back to ON -> Mark re-entry timestamp on active exit log & lock
      const currentData = await chrome.storage.local.get(["logs"]);
      let updatedLogs = Array.isArray(currentData.logs) ? currentData.logs : [];
      
      // Update latest log that hasn't recorded a re-entry yet
      for (let i = updatedLogs.length - 1; i >= 0; i--) {
        if (!updatedLogs[i].reEnteredAt) {
          updatedLogs[i].reEnteredAt = new Date().toISOString();
          break;
        }
      }

      await chrome.storage.local.set({ 
        learnModeActive: true,
        logs: updatedLogs
      });

      if (chrome.alarms) chrome.alarms.clear("autoRelockAlarm");
      
      logs = updatedLogs;
      isActive = true;
      updateScreenView();
      renderCalendar();
    }
  });

  // Cancel OFF intent
  cancelOffBtn.addEventListener("click", () => {
    isActive = true;
    modeToggle.checked = true;
    updateScreenView();
  });

  // Submit EXIT LEMONADE Intent
  exitLemonadeBtn.addEventListener("click", async () => {
    const reasonText = reasonInput.value.trim();

    if (!reasonText) {
      alert("Please enter a short reason before exiting Lemonade.");
      return;
    }

    const timerVal = timerSelect.value;
    const newLog = {
      timestamp: new Date().toISOString(),
      reEnteredAt: null, // Will be filled when toggled back ON
      reason: reasonText,
      category: categorySelect.value,
      autoRelockHours: timerVal === "never" ? "never" : parseInt(timerVal, 10)
    };

    const currentData = await chrome.storage.local.get(["logs"]);
    const updatedLogs = Array.isArray(currentData.logs) ? currentData.logs : [];
    updatedLogs.push(newLog);

    await chrome.storage.local.set({
      learnModeActive: false,
      logs: updatedLogs
    });

    if (timerVal !== "never" && chrome.alarms) {
      const hours = parseInt(timerVal, 10);
      await chrome.alarms.create("autoRelockAlarm", { delayInMinutes: hours * 60 });
    } else if (timerVal === "never" && chrome.alarms) {
      await chrome.alarms.clear("autoRelockAlarm");
    }

    logs = updatedLogs;
    isActive = false;
    reasonInput.value = "";
    updateScreenView();
    renderCalendar();
  });

  // Month navigation
  prevMonthBtn.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    renderCalendar();
  });

  nextMonthBtn.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    renderCalendar();
  });

  // Info Screen
  helpBtn.addEventListener("click", () => {
    calendarScreen.classList.add("hidden");
    loggingScreen.classList.add("hidden");
    infoScreen.classList.remove("hidden");
  });

  closeInfoBtn.addEventListener("click", () => {
    infoScreen.classList.add("hidden");
    updateScreenView();
  });

  // Export CSV
  exportBtn.addEventListener("click", () => {
    if (!logs || logs.length === 0) {
      alert("No logs available to export.");
      return;
    }

    const headers = ["Timestamp (Exit)", "ReEnteredAt", "Category", "AutoRelockHours", "Reason"];
    const rows = logs.map(l => [
      `"${l.timestamp}"`,
      `"${l.reEnteredAt || ""}"`,
      `"${l.category}"`,
      `"${l.autoRelockHours}"`,
      `"${(l.reason || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + 
      [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `lemonade_logs_${getLocalDateString(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  updateScreenView();
  renderCalendar();
});