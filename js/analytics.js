/* Analytics 只读取已有数据。图表用 HTML/CSS 绘制，无图表库或网络请求。 */
(function () {
  "use strict";
  const model = window.LevelUpAnalytics;
  let range = "7";
  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }
  function renderChart(report, readable) {
    const chart = document.getElementById("activity-chart");
    const table = document.getElementById("analytics-table-body");
    const message = document.getElementById("analytics-chart-message");
    chart.replaceChildren();
    table.replaceChildren();
    document.getElementById("analytics-figure").hidden = !readable;
    document.getElementById("analytics-detail").hidden = !readable;
    message.hidden = readable && (report.completedTasks + report.journalEntries > 0);
    message.textContent = readable ? "这段时间还没有完成任务或日志记录。每一小步，都可以从今天开始。" : "任务或日志读取失败，暂不绘制趋势图，避免把缺失数据当作零。";
    if (!readable) return;
    // 全部记录很长时，只绘制最近 24 个有记录月份；表格与顶部汇总保留全部。
    const rows = range === "all" ? report.rows.slice(-24) : report.rows;
    const max = Math.max(1, ...rows.map(function (row) { return Math.max(row.tasks, row.journal); }));
    chart.style.setProperty("--chart-columns", Math.max(1, rows.length));
    document.getElementById("analytics-chart-note").textContent = range === "all" ? "按有记录月份汇总；图表最多显示最近 24 个月份，详细表保留全部。" : "每日任务数与日志篇数使用相同比例；可横向滚动或展开详细数据。";
    rows.forEach(function (row) {
      const column = element("div", "chart-column", "");
      const description = row.date + "：完成任务 " + row.tasks + " 项，日志 " + row.journal + " 篇";
      column.setAttribute("aria-label", description);
      column.title = description;
      const bars = element("div", "chart-bars", "");
      bars.setAttribute("aria-hidden", "true");
      ["tasks", "journal"].forEach(function (key) {
        const bar = element("div", "chart-bar " + key, "");
        bar.style.height = (row[key] / max * 100) + "%";
        if (row[key]) bar.append(element("span", "bar-value", row[key]));
        bars.append(bar);
      });
      const label = element("span", "chart-date", range === "all" ? row.date : row.date.slice(5).replace("-", "/"));
      label.setAttribute("aria-hidden", "true");
      column.append(bars, label);
      chart.append(column);
    });
    report.rows.forEach(function (row) {
      const tr = document.createElement("tr");
      const heading = element("th", "", row.date);
      heading.scope = "row";
      tr.append(heading, element("td", "", row.tasks), element("td", "", row.journal));
      table.append(tr);
    });
  }
  function renderGoals(report, readable) {
    const container = document.getElementById("goal-category-progress");
    container.replaceChildren();
    document.getElementById("analytics-goal-rate").textContent = !readable || report.goalRate === null ? "—" : report.goalRate + "%";
    document.getElementById("analytics-goal-caption").textContent = !readable ? "目标数据读取失败" : report.goalTotal ? "已完成 " + report.goalCompleted + " / " + report.goalTotal + " 个 · 当前全部目标" : "还没有目标，完成率暂不计算";
    document.getElementById("goal-progress-completed").textContent = readable ? report.goalCompleted : "—";
    document.getElementById("goal-progress-total").textContent = readable ? "/ " + report.goalTotal + " 个目标已完成" : "目标读取失败";
    if (!readable) { container.append(element("p", "muted", "请到 Goals 检查目标数据。")); return; }
    report.categories.forEach(function (category) {
      const row = element("div", "category-row", "");
      const label = element("div", "category-label", "");
      label.append(element("span", "", category.name), element("span", "muted", category.completed + " / " + category.total));
      const progress = document.createElement("progress");
      progress.max = category.total || 1;
      progress.value = category.completed;
      progress.setAttribute("aria-label", category.name + "：已完成 " + category.completed + " 个，共 " + category.total + " 个目标");
      row.append(label, progress);
      container.append(row);
    });
  }
  function render() {
    const goals = window.LevelUpStorage.readGoals();
    const tasks = window.LevelUpStorage.readTasks();
    const journal = window.LevelUpStorage.readJournal();
    const report = model.getReport({ goals: goals.goals, tasks: tasks.tasks, entries: journal.entries }, range);
    document.getElementById("analytics-range-label").textContent = (report.start || "最早活动") + " — " + report.end + " · 包含今天";
    document.getElementById("analytics-tasks").textContent = tasks.ok ? report.completedTasks : "—";
    document.getElementById("analytics-journal").textContent = journal.ok ? report.journalEntries : "—";
    document.getElementById("analytics-active").textContent = tasks.ok && journal.ok ? report.activeDays : "—";
    const failures = [];
    if (!goals.ok) failures.push("目标");
    if (!tasks.ok) failures.push("任务");
    if (!journal.ok) failures.push("日志");
    const status = document.getElementById("analytics-status");
    status.classList.toggle("error", failures.length > 0);
    status.textContent = failures.length ? failures.join("、") + "读取失败，相关统计显示 —；原数据未被修改。" : "仅统计已保存记录，回收站不参与统计。时间筛选影响活动数据，目标状态显示当前全部目标。";
    renderChart(report, tasks.ok && journal.ok);
    renderGoals(report, goals.ok);
  }
  document.querySelectorAll("[data-range]").forEach(function (button) {
    button.addEventListener("click", function () {
      range = button.dataset.range;
      document.querySelectorAll("[data-range]").forEach(function (item) {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-pressed", String(item === button));
      });
      render();
    });
  });
  window.addEventListener("storage", function (event) {
    if ([null, "levelup:v1:goals", "levelup:v1:tasks", "levelup:v1:journal"].includes(event.key)) render();
  });
  window.addEventListener("pageshow", render);
  window.addEventListener("focus", render);
  let lastDate = model.dateKey();
  setInterval(function () {
    const today = model.dateKey();
    if (today !== lastDate) { lastDate = today; render(); }
  }, 60000);
  render();
})();
