/* 目标页面：表单负责收集输入，storage.js 负责保存，render 负责显示。
   用户文字一律通过 textContent 写入，不把它当作 HTML 执行。 */
(function () {
  "use strict";
  const store = window.LevelUpStorage;
  const form = document.getElementById("goal-form");
  const titleInput = document.getElementById("goal-title");
  const descriptionInput = document.getElementById("goal-description");
  const categoryInput = document.getElementById("goal-category");
  const dateInput = document.getElementById("goal-date");
  const list = document.getElementById("goal-list");
  const status = document.getElementById("goals-status");
  const formError = document.getElementById("goal-form-error");
  const cancelButton = document.getElementById("cancel-edit");
  let filter = "all";
  let editingId = null;
  let editingVersion = null;
  let cleanForm = "";

  function formSnapshot() {
    return JSON.stringify([titleInput.value, descriptionInput.value, categoryInput.value, dateInput.value]);
  }
  function announce(message, isError) {
    status.textContent = message;
    status.classList.toggle("error", Boolean(isError));
  }
  function resetForm() {
    form.reset();
    editingId = null;
    editingVersion = null;
    cleanForm = formSnapshot();
    cancelButton.hidden = true;
    formError.textContent = "";
    document.getElementById("editor-title").textContent = "添加一个小目标";
    document.getElementById("save-goal").textContent = "保存目标 ↗";
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }
  function actionButton(text, action, goal, className) {
    const button = element("button", "button button-secondary " + (className || ""), text);
    button.type = "button";
    button.dataset.action = action;
    button.dataset.id = goal.id;
    button.setAttribute("aria-label", text + "：" + goal.title);
    return button;
  }
  function todayString() {
    const date = new Date();
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }
  function render() {
    const result = store.readGoals();
    list.replaceChildren();
    if (!result.ok) {
      announce("无法读取目标数据，已暂停修改以保护原记录。请检查浏览器存储设置或数据。", true);
      form.querySelectorAll("input, textarea, select, button").forEach(function (field) { field.disabled = true; });
      ["total", "active", "completed"].forEach(function (key) { document.getElementById("goals-" + key).textContent = "—"; });
      document.getElementById("goal-list-caption").textContent = "读取失败";
      list.append(element("p", "panel goal-empty", "目标暂时无法显示。原数据未被覆盖。"));
      return;
    }
    form.querySelectorAll("input, textarea, select, button").forEach(function (field) { field.disabled = false; });
    const available = result.goals.filter(function (goal) { return !goal.deletedAt; });
    document.getElementById("goals-total").textContent = available.length;
    document.getElementById("goals-active").textContent = available.filter(function (goal) { return goal.status === "active"; }).length;
    document.getElementById("goals-completed").textContent = available.filter(function (goal) { return goal.status === "completed"; }).length;
    const visible = result.goals.filter(function (goal) {
      if (filter === "trash") return Boolean(goal.deletedAt);
      return !goal.deletedAt && (filter === "all" || goal.status === filter);
    }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
    document.getElementById("goal-list-caption").textContent = filter === "trash" ? "移入回收站的目标可随时恢复，不计入统计。" : "显示 " + visible.length + " 个目标 · 已自动读取本地记录";
    if (visible.length === 0) {
      const messages = { all: "还没有目标。从左侧写下第一个小目标吧。", active: "暂无进行中的目标。", completed: "还没有已完成目标，一小步也值得期待。", trash: "回收站是空的。" };
      list.append(element("p", "panel goal-empty", messages[filter]));
    }
    visible.forEach(function (goal) {
      const card = element("article", "panel goal-card", "");
      const top = element("div", "goal-card-top", "");
      top.append(element("span", "tiny-tag", goal.category));
      top.append(element("span", "goal-state " + goal.status, goal.deletedAt ? "回收站" : goal.status === "completed" ? "已完成" : "进行中"));
      card.append(top, element("h3", "goal-card-title", goal.title));
      if (goal.description) card.append(element("p", "goal-description", goal.description));
      const overdue = goal.dueDate && goal.dueDate < todayString() && goal.status === "active" && !goal.deletedAt;
      card.append(element("p", "goal-deadline" + (overdue ? " overdue" : ""), goal.dueDate ? "截止 " + goal.dueDate + (overdue ? " · 已逾期" : "") : "未设置截止日期"));
      const actions = element("div", "goal-card-actions", "");
      if (goal.deletedAt) {
        actions.append(actionButton("恢复目标", "restore", goal));
      } else {
        actions.append(actionButton(goal.status === "active" ? "标记完成" : "重新开启", "toggle", goal));
        actions.append(actionButton("编辑", "edit", goal));
        actions.append(actionButton("移入回收站", "trash", goal, "button-subtle"));
      }
      card.append(actions);
      list.append(card);
    });
  }
  function persist(goals, message) {
    const result = store.saveGoals(goals);
    if (!result.ok) {
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
      formError.textContent = "请填写目标名称，不能只有空格。";
      titleInput.focus();
      return;
    }
    // 每次修改前读取最新数据，避免直接用过期的页面列表覆盖其他标签页。
    const result = store.readGoals();
    if (!result.ok) { render(); return; }
    const now = new Date().toISOString();
    let goal;
    if (editingId) {
      goal = result.goals.find(function (item) { return item.id === editingId; });
      if (!goal || goal.deletedAt || goal.updatedAt !== editingVersion) {
        formError.textContent = "该目标已在其他操作中更新。请保留输入，取消编辑后重新打开最新目标。";
        return;
      }
    } else {
      goal = { id: window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2), status: "active", createdAt: now, deletedAt: null };
      result.goals.push(goal);
    }
    goal.title = titleInput.value.trim();
    goal.description = descriptionInput.value.trim();
    goal.category = categoryInput.value;
    goal.dueDate = dateInput.value;
    goal.updatedAt = now;
    if (persist(result.goals, editingId ? "目标修改已保存。" : "新目标已保存，迈出第一步了。")) resetForm();
  });
  cancelButton.addEventListener("click", function () { resetForm(); announce("已取消编辑。", false); });
  document.querySelectorAll("[data-filter]").forEach(function (button) {
    button.addEventListener("click", function () {
      filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(function (item) {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      render();
    });
  });
  list.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const result = store.readGoals();
    if (!result.ok) { render(); return; }
    const goal = result.goals.find(function (item) { return item.id === button.dataset.id; });
    if (!goal) { render(); return; }
    const action = button.dataset.action;
    if (action === "edit") {
      if (formSnapshot() !== cleanForm) { announce("请先保存当前表单，或取消编辑，再打开其他目标。", true); return; }
      editingId = goal.id;
      editingVersion = goal.updatedAt;
      titleInput.value = goal.title;
      descriptionInput.value = goal.description;
      categoryInput.value = goal.category;
      dateInput.value = goal.dueDate;
      cleanForm = formSnapshot();
      document.getElementById("editor-title").textContent = "编辑目标";
      document.getElementById("save-goal").textContent = "保存修改 ↗";
      cancelButton.hidden = false;
      titleInput.focus();
      return;
    }
    const now = new Date().toISOString();
    if (action === "toggle") goal.status = goal.status === "active" ? "completed" : "active";
    if (action === "trash") goal.deletedAt = now;
    if (action === "restore") goal.deletedAt = null;
    goal.updatedAt = now;
    const messages = { toggle: goal.status === "completed" ? "目标已完成，记得肯定自己的努力。" : "目标已重新开启。", trash: "已移入回收站，可在回收站中恢复。", restore: "目标已恢复。" };
    if (persist(result.goals, messages[action]) && editingId === goal.id) {
      // 保留正在编辑的草稿，让提交时的版本检查提醒用户处理冲突。
      announce("目标状态已更新。编辑中的内容尚未保存，请取消编辑后重新打开。", true);
    }
  });
  form.addEventListener("input", function () {
    formError.textContent = "";
    // 新建草稿也可以取消，不必先保存不需要的内容。
    cancelButton.hidden = !editingId && formSnapshot() === cleanForm;
  });
  window.addEventListener("beforeunload", function (event) {
    if (formSnapshot() !== cleanForm) { event.preventDefault(); event.returnValue = ""; }
  });
  window.addEventListener("storage", function (event) {
    if (event.key === "levelup:v1:goals" || event.key === null) {
      announce("检测到其他标签页更新，列表已刷新；当前表单输入保留。", false);
      render();
    }
  });
  cleanForm = formSnapshot();
  render();
})();
