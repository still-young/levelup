/* Dashboard：保存寄语，并读取 Goals、Tasks、Journal 的真实汇总。 */
(function () {
  "use strict";
  const form = document.getElementById("note-form");
  const input = document.getElementById("note-input");
  const count = document.getElementById("note-count");
  const status = document.getElementById("note-status");
  let savedText = "";

  function updateGoalSummary() {
    const result = window.LevelUpStorage.readGoals();
    const number = document.getElementById("dashboard-goal-count");
    const caption = document.getElementById("dashboard-goal-caption");
    if (!result.ok) {
      number.textContent = "—";
      caption.textContent = "目标读取失败，请到 Goals 检查";
      return;
    }
    const goals = result.goals.filter(function (goal) { return !goal.deletedAt; });
    number.textContent = goals.filter(function (goal) { return goal.status === "active"; }).length;
    caption.textContent = goals.length ? "已完成 " + goals.filter(function (goal) { return goal.status === "completed"; }).length + " 个 · 在 Goals 管理" : "从 Goals 添加第一个目标";
  }
  updateGoalSummary();
  window.addEventListener("pageshow", updateGoalSummary);
  window.addEventListener("storage", function (event) {
    if (event.key === "levelup:v1:goals" || event.key === null) updateGoalSummary();
  });

  function updateTaskSummary() {
    const result = window.LevelUpStorage.readTasks();
    const number = document.getElementById("dashboard-task-count");
    const caption = document.getElementById("dashboard-task-caption");
    if (!result.ok) {
      number.textContent = "—";
      caption.textContent = "任务读取失败，请到 Tasks 检查";
      return;
    }
    const summary = window.LevelUpTasks.getSummary(result.tasks);
    number.textContent = summary.completedToday;
    caption.textContent = "今日计划 " + summary.plannedToday + " 项 · 待完成共 " + summary.active + " 项";
  }
  updateTaskSummary();
  window.addEventListener("pageshow", updateTaskSummary);
  window.addEventListener("focus", updateTaskSummary);
  window.addEventListener("storage", function (event) {
    if (event.key === "levelup:v1:tasks" || event.key === null) updateTaskSummary();
  });
  setInterval(updateTaskSummary, 60000);

  function updateJournalSummary() {
    const result = window.LevelUpStorage.readJournal();
    const number = document.getElementById("dashboard-journal-count");
    const caption = document.getElementById("dashboard-journal-caption");
    if (!result.ok) {
      number.textContent = "—";
      caption.textContent = "日志读取失败，请到 Journal 检查";
      return;
    }
    const summary = window.LevelUpJournal.getSummary(result.entries);
    number.textContent = summary.total;
    caption.textContent = "记录 " + summary.days + " 天 · 今天 " + summary.today + " 篇";
  }
  updateJournalSummary();
  window.addEventListener("pageshow", updateJournalSummary);
  window.addEventListener("focus", updateJournalSummary);
  window.addEventListener("storage", function (event) {
    if (event.key === "levelup:v1:journal" || event.key === null) updateJournalSummary();
  });
  setInterval(updateJournalSummary, 60000);

  function updateActivitySummary() {
    const tasks = window.LevelUpStorage.readTasks();
    const journal = window.LevelUpStorage.readJournal();
    const number = document.getElementById("dashboard-active-days");
    const caption = document.getElementById("dashboard-active-caption");
    if (!tasks.ok || !journal.ok) {
      number.textContent = "—";
      caption.textContent = "任务或日志读取失败，请到 Analytics 检查";
      return;
    }
    const report = window.LevelUpAnalytics.getReport({goals: [], tasks: tasks.tasks, entries: journal.entries}, "7");
    number.textContent = report.activeDays;
    caption.textContent = "近7天 · 完成 " + report.completedTasks + " 项 / 日志 " + report.journalEntries + " 篇";
  }
  updateActivitySummary();
  window.addEventListener("pageshow", updateActivitySummary);
  window.addEventListener("focus", updateActivitySummary);
  window.addEventListener("storage", function (event) {
    if ([null, "levelup:v1:tasks", "levelup:v1:journal"].includes(event.key)) updateActivitySummary();
  });
  setInterval(updateActivitySummary, 60000);

  function showStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle("error", Boolean(isError));
  }
  function showSavedTime(note) {
    const time = new Date(note.savedAt).toLocaleString("zh-CN", { hour12: false });
    showStatus("已保存到当前浏览器 · " + time, false);
  }
  function updateCount() { count.textContent = input.value.length + " / 200"; }

  const result = window.LevelUpStorage.readNote();
  if (!result.ok) {
    showStatus("无法读取本地寄语。请检查浏览器存储设置；重新保存会覆盖原寄语。", true);
  } else if (result.note) {
    input.value = result.note.text;
    savedText = result.note.text;
    showSavedTime(result.note);
  }
  updateCount();

  input.addEventListener("input", function () {
    updateCount();
    showStatus("内容已修改，点击“保存寄语”后保留。", false);
  });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const result = window.LevelUpStorage.saveNote(input.value);
    if (result.ok) {
      savedText = input.value;
      showSavedTime(result.note);
    } else {
      showStatus("保存失败：浏览器存储可能被禁用或已满。请先复制寄语留存。", true);
    }
  });
  window.addEventListener("beforeunload", function (event) {
    if (input.value !== savedText) { event.preventDefault(); event.returnValue = ""; }
  });
})();
