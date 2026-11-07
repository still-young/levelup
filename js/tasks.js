/* Tasks 页面：收集表单输入 → 保存成功 → 更新列表。
   复用 Goals 的卡片样式，但使用独立的任务数据，避免修改旧记录。 */
(function () {
  "use strict";
  const store = window.LevelUpStorage;
  const model = window.LevelUpTasks;
  const form = document.getElementById("task-form");
  const titleInput = document.getElementById("task-title");
  const descriptionInput = document.getElementById("task-description");
  const goalInput = document.getElementById("task-goal");
  const dateInput = document.getElementById("task-date");
  const cancel = document.getElementById("cancel-task-edit");
  const list = document.getElementById("task-list");
  const status = document.getElementById("tasks-status");
  const error = document.getElementById("task-form-error");
  let filter = "all";
  let editingId = null;
  let editingVersion = null;
  let cleanForm = "";

  function snapshot() {
    return JSON.stringify([titleInput.value, descriptionInput.value, goalInput.value, dateInput.value]);
  }
  function announce(message, isError) {
    status.textContent = message;
    status.classList.toggle("error", Boolean(isError));
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }
  function button(label, action, task) {
    const node = element("button", "button button-secondary", label);
    node.type = "button";
    node.dataset.action = action;
    node.dataset.id = task.id;
    node.setAttribute("aria-label", label + "：" + task.title);
    return node;
  }
  function resetForm() {
    form.reset();
    editingId = null;
    editingVersion = null;
    updateGoalOptions("");
    cleanForm = snapshot();
    cancel.hidden = true;
    error.textContent = "";
    document.getElementById("task-editor-title").textContent = "添加一项小任务";
    document.getElementById("save-task").textContent = "保存任务 ↗";
  }
  function goalLabel(id, result) {
    if (!id) return "独立任务 · 未关联目标";
    if (!result.ok) return "关联目标暂时无法读取";
    const goal = result.goals.find(function (item) { return item.id === id; });
    if (!goal) return "关联目标已不存在";
    return goal.title + (goal.deletedAt ? "（目标在回收站）" : goal.status === "completed" ? "（目标已完成）" : "");
  }
  function updateGoalOptions(selectedId) {
    const result = store.readGoals();
    goalInput.replaceChildren();
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "不关联目标";
    goalInput.append(empty);
    if (result.ok) {
      result.goals.filter(function (goal) { return !goal.deletedAt; }).forEach(function (goal) {
        const option = document.createElement("option");
        option.value = goal.id;
        option.textContent = goalLabel(goal.id, result);
        goalInput.append(option);
      });
    }
    // 目标被移入回收站时，不默默清掉已有任务的关联。
    if (selectedId && !Array.from(goalInput.options).some(function (option) { return option.value === selectedId; })) {
      const option = document.createElement("option");
      option.value = selectedId;
      option.textContent = goalLabel(selectedId, result) + " · 保留原关联";
      goalInput.append(option);
    }
    goalInput.value = selectedId;
    document.getElementById("task-goal-hint").textContent = result.ok ? "完成任务不会自动将目标标记为完成。" : "目标读取失败；可创建独立任务，或保留任务原有的关联。";
  }
  function render() {
    const result = store.readTasks();
    list.replaceChildren();
    form.querySelectorAll("input, textarea, select, button").forEach(function (field) { field.disabled = !result.ok; });
    if (!result.ok) {
      announce("无法读取任务，已暂停修改以保护原记录。请检查浏览器存储设置或数据。", true);
      ["active", "planned", "done"].forEach(function (key) { document.getElementById("tasks-" + key).textContent = "—"; });
      document.getElementById("task-list-caption").textContent = "读取失败";
      list.append(element("p", "panel goal-empty", "任务暂时无法显示，原数据未被覆盖。"));
      return;
    }
    const summary = model.getSummary(result.tasks);
    document.getElementById("tasks-active").textContent = summary.active;
    document.getElementById("tasks-planned").textContent = summary.plannedToday;
    document.getElementById("tasks-done").textContent = summary.completedToday;
    const visible = model.filterTasks(result.tasks, filter).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
    document.getElementById("task-list-caption").textContent = filter === "trash" ? "回收站中的任务可恢复，不计入统计。" : "显示 " + visible.length + " 项任务 · 日期按当前设备计算";
    const emptyMessages = { all: "还没有任务。先为目标安排一件小事吧。", today: "今天还没有安排任务，也可以在全部列表中查看未安排日期的任务。", active: "暂无待完成任务。", completed: "暂无已完成任务，先从一小步开始。", trash: "回收站是空的。" };
    if (!visible.length) list.append(element("p", "panel goal-empty", emptyMessages[filter]));
    const goals = store.readGoals();
    visible.forEach(function (task) {
      const card = element("article", "panel goal-card", "");
      const top = element("div", "goal-card-top", "");
      top.append(element("span", "tiny-tag", task.plannedDate === model.dateKey() ? "今日计划" : "日常行动"));
      top.append(element("span", "goal-state " + task.status, task.deletedAt ? "回收站" : task.status === "completed" ? "已完成" : "待完成"));
      card.append(top, element("h3", "goal-card-title", task.title));
      if (task.description) card.append(element("p", "goal-description", task.description));
      card.append(element("p", "task-goal-label", "关联：" + goalLabel(task.goalId, goals)));
      const overdue = task.plannedDate && task.plannedDate < model.dateKey() && task.status === "active" && !task.deletedAt;
      card.append(element("p", "goal-deadline" + (overdue ? " overdue" : ""), task.plannedDate ? "计划 " + task.plannedDate + (overdue ? " · 已逾期" : "") : "暂未安排日期"));
      if (task.completedAt) card.append(element("p", "goal-deadline", "完成于 " + new Date(task.completedAt).toLocaleString("zh-CN", { hour12: false })));
      const actions = element("div", "goal-card-actions", "");
      if (task.deletedAt) actions.append(button("恢复任务", "restore", task));
      else actions.append(button(task.status === "active" ? "标记完成" : "重新开启", "toggle", task), button("编辑", "edit", task), button("移入回收站", "trash", task));
      card.append(actions);
      list.append(card);
    });
  }
  function persist(tasks, message) {
    if (!store.saveTasks(tasks).ok) {
      announce("保存失败，修改未写入。请检查存储空间和浏览器设置；表单内容已保留。", true);
      return false;
    }
    announce(message, false);
    render();
    return true;
  }
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!titleInput.value.trim()) {
      error.textContent = "请填写任务名称，不能只有空格。";
      titleInput.focus();
      return;
    }
    const result = store.readTasks();
    if (!result.ok) { render(); return; }
    let task = editingId ? result.tasks.find(function (item) { return item.id === editingId; }) : null;
    if (editingId && (!task || task.deletedAt || task.updatedAt !== editingVersion)) {
      error.textContent = "该任务已更新。请保留输入，取消编辑后重新打开最新任务。";
      return;
    }
    const selectedId = goalInput.value || null;
    const goals = store.readGoals();
    const originalId = task ? task.goalId : null;
    if (selectedId && selectedId !== originalId && (!goals.ok || !goals.goals.some(function (goal) { return goal.id === selectedId && !goal.deletedAt; }))) {
      error.textContent = "所选目标已不可用，请重新选择目标或选择不关联目标。";
      updateGoalOptions(goalInput.value);
      return;
    }
    const now = new Date().toISOString();
    if (!task) {
      task = { id: window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2), status: "active", completedAt: null, createdAt: now, deletedAt: null };
      result.tasks.push(task);
    }
    task.title = titleInput.value.trim();
    task.description = descriptionInput.value.trim();
    task.goalId = selectedId;
    task.plannedDate = dateInput.value;
    task.updatedAt = now;
    const message = editingId ? "任务修改已保存。" : "任务已保存。可以继续添加下一项小行动。";
    if (persist(result.tasks, message)) resetForm();
  });
  cancel.addEventListener("click", function () { resetForm(); announce("已取消编辑。", false); });
  form.addEventListener("input", function () { error.textContent = ""; cancel.hidden = !editingId && snapshot() === cleanForm; });
  document.querySelectorAll("[data-task-filter]").forEach(function (button) {
    button.addEventListener("click", function () {
      filter = button.dataset.taskFilter;
      document.querySelectorAll("[data-task-filter]").forEach(function (item) {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-pressed", String(item === button));
      });
      render();
    });
  });
  list.addEventListener("click", function (event) {
    const target = event.target.closest("button[data-action]");
    if (!target) return;
    const result = store.readTasks();
    if (!result.ok) { render(); return; }
    const task = result.tasks.find(function (item) { return item.id === target.dataset.id; });
    if (!task) { render(); return; }
    const action = target.dataset.action;
    if (action === "edit") {
      if (snapshot() !== cleanForm) { announce("请先保存或取消当前表单，再编辑其他任务。", true); return; }
      editingId = task.id;
      editingVersion = task.updatedAt;
      titleInput.value = task.title;
      descriptionInput.value = task.description;
      dateInput.value = task.plannedDate;
      updateGoalOptions(task.goalId || "");
      cleanForm = snapshot();
      cancel.hidden = false;
      document.getElementById("task-editor-title").textContent = "编辑任务";
      document.getElementById("save-task").textContent = "保存修改 ↗";
      titleInput.focus();
      return;
    }
    const now = new Date().toISOString();
    if (action === "toggle") {
      task.status = task.status === "active" ? "completed" : "active";
      task.completedAt = task.status === "completed" ? now : null;
    }
    if (action === "trash") task.deletedAt = now;
    if (action === "restore") task.deletedAt = null;
    task.updatedAt = now;
    const messages = { toggle: task.status === "completed" ? "任务已完成，今天又前进了一步。" : "任务已重新开启。", trash: "任务已移入回收站，可以恢复。", restore: "任务已恢复，原完成时间保留。" };
    if (persist(result.tasks, messages[action]) && editingId === task.id) announce("任务状态已更新。请保留草稿，取消编辑后重新打开最新任务。", true);
  });
  window.addEventListener("storage", function (event) {
    if ([null, "levelup:v1:goals", "levelup:v1:tasks"].includes(event.key)) {
      updateGoalOptions(goalInput.value);
      announce("检测到其他标签页更新，列表已刷新；表单输入保留。", false);
      render();
    }
  });
  window.addEventListener("beforeunload", function (event) {
    if (snapshot() !== cleanForm) { event.preventDefault(); event.returnValue = ""; }
  });
  // 跨过午夜或回到标签页时更新“今天”，不重置表单。
  let lastDate = model.dateKey();
  setInterval(function () {
    const today = model.dateKey();
    if (today !== lastDate) { lastDate = today; render(); }
  }, 60000);
  window.addEventListener("pageshow", function () { updateGoalOptions(goalInput.value); render(); });
  window.addEventListener("focus", function () { updateGoalOptions(goalInput.value); render(); });
  updateGoalOptions("");
  cleanForm = snapshot();
  render();
})();
