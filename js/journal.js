/* Journal：表单输入、读取历史、编辑、回收站。
   正文用 textContent 显示，保留换行，不执行 HTML。 */
(function () {
  "use strict";
  const store = window.LevelUpStorage;
  const model = window.LevelUpJournal;
  const form = document.getElementById("journal-form");
  const dateInput = document.getElementById("entry-date");
  const moodInput = document.getElementById("entry-mood");
  const titleInput = document.getElementById("entry-title");
  const contentInput = document.getElementById("entry-content");
  const cancel = document.getElementById("cancel-entry-edit");
  const status = document.getElementById("journal-status");
  const error = document.getElementById("journal-form-error");
  const list = document.getElementById("journal-list");
  const search = document.getElementById("journal-search");
  const dateFilter = document.getElementById("journal-date-filter");
  let filter = "all";
  let editingId = null;
  let editingVersion = null;
  let cleanForm = "";

  function snapshot() { return JSON.stringify([dateInput.value, moodInput.value, titleInput.value, contentInput.value]); }
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
  function updateCount() { document.getElementById("entry-count").textContent = contentInput.value.length + " / 5000 · 手动保存后保留"; }
  function resetForm() {
    form.reset();
    dateInput.value = model.dateKey();
    editingId = null;
    editingVersion = null;
    cleanForm = snapshot();
    error.textContent = "";
    cancel.hidden = true;
    document.getElementById("journal-editor-title").textContent = "写下一点今天";
    document.getElementById("save-entry").textContent = "保存日志 ↗";
    updateCount();
  }
  function actionButton(label, action, entry) {
    const button = element("button", "button button-secondary", label);
    button.type = "button";
    button.dataset.action = action;
    button.dataset.id = entry.id;
    button.setAttribute("aria-label", label + "：" + entry.title);
    return button;
  }
  function render() {
    const result = store.readJournal();
    list.replaceChildren();
    form.querySelectorAll("input, textarea, select, button").forEach(function (field) { field.disabled = !result.ok; });
    if (!result.ok) {
      announce("无法读取日志，已暂停修改以保护原记录。请检查浏览器存储设置或数据。", true);
      ["total", "days", "today"].forEach(function (key) { document.getElementById("journal-" + key).textContent = "—"; });
      document.getElementById("journal-list-caption").textContent = "读取失败";
      list.append(element("p", "panel goal-empty", "日志暂时无法显示，原数据未被覆盖。"));
      return;
    }
    const summary = model.getSummary(result.entries);
    ["total", "days", "today"].forEach(function (key) { document.getElementById("journal-" + key).textContent = summary[key]; });
    const entries = model.filterEntries(result.entries, { filter: filter, query: search.value, date: dateFilter.value });
    document.getElementById("journal-list-caption").textContent = "显示 " + entries.length + " 篇 · 按记录日期从新到旧" + (filter === "trash" ? " · 可恢复，不计入统计" : "");
    if (!entries.length) {
      const message = search.value.trim() || dateFilter.value ? "没有符合这些条件的日志，试试清除条件。" : filter === "trash" ? "回收站是空的。" : filter === "today" ? "今天还没有记录，写下一件值得记住的小事吧。" : "还没有日志，从第一段文字开始吧。";
      list.append(element("p", "panel goal-empty", message));
    }
    entries.forEach(function (entry) {
      const card = element("article", "panel goal-card", "");
      const top = element("div", "goal-card-top", "");
      top.append(element("span", "tiny-tag", entry.entryDate));
      top.append(element("span", "goal-state", entry.deletedAt ? "回收站" : entry.mood === "未选择" ? "成长记录" : entry.mood));
      card.append(top, element("h3", "goal-card-title", entry.title));
      // 默认显示完整的短日志。长日志可展开阅读全文，避免历史列表过长。
      if (entry.content.length > 180) {
        card.append(element("p", "journal-content", entry.content.slice(0, 180) + "…"));
        const details = element("details", "journal-details", "");
        const summary = element("summary", "", "阅读全文：" + entry.title);
        details.append(summary, element("p", "journal-content", entry.content));
        card.append(details);
      } else card.append(element("p", "journal-content", entry.content));
      card.append(element("p", "goal-deadline", "更新于 " + new Date(entry.updatedAt).toLocaleString("zh-CN", { hour12: false })));
      const actions = element("div", "goal-card-actions", "");
      if (entry.deletedAt) actions.append(actionButton("恢复日志", "restore", entry));
      else actions.append(actionButton("编辑", "edit", entry), actionButton("移入回收站", "trash", entry));
      card.append(actions);
      list.append(card);
    });
  }
  function persist(entries, message) {
    if (!store.saveJournal(entries).ok) {
      announce("保存失败，修改未写入。请检查浏览器存储空间和设置；表单内容已保留。", true);
      return false;
    }
    announce(message, false);
    render();
    return true;
  }
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!titleInput.value.trim() || !contentInput.value.trim()) {
      error.textContent = "请填写日志标题和正文，不能只有空格。";
      (!titleInput.value.trim() ? titleInput : contentInput).focus();
      return;
    }
    const result = store.readJournal();
    if (!result.ok) { render(); return; }
    let entry = editingId ? result.entries.find(function (item) { return item.id === editingId; }) : null;
    if (editingId && (!entry || entry.deletedAt || entry.updatedAt !== editingVersion)) {
      error.textContent = "该日志已更新。请保留当前文字，取消编辑后重新打开最新日志。";
      return;
    }
    const now = new Date().toISOString();
    if (!entry) {
      entry = { id: window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2), createdAt: now, deletedAt: null };
      result.entries.push(entry);
    }
    entry.title = titleInput.value.trim();
    entry.content = contentInput.value.trim();
    entry.entryDate = dateInput.value;
    entry.mood = moodInput.value;
    entry.updatedAt = now;
    if (persist(result.entries, editingId ? "日志修改已保存。" : "日志已保存，这一刻被好好留下了。")) resetForm();
  });
  cancel.addEventListener("click", function () { resetForm(); announce("已取消编辑。", false); });
  form.addEventListener("input", function () {
    error.textContent = "";
    updateCount();
    cancel.hidden = !editingId && snapshot() === cleanForm;
  });
  document.querySelectorAll("[data-journal-filter]").forEach(function (button) {
    button.addEventListener("click", function () {
      filter = button.dataset.journalFilter;
      document.querySelectorAll("[data-journal-filter]").forEach(function (item) {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-pressed", String(item === button));
      });
      render();
    });
  });
  search.addEventListener("input", render);
  dateFilter.addEventListener("change", render);
  document.getElementById("clear-journal-search").addEventListener("click", function () {
    search.value = "";
    dateFilter.value = "";
    render();
  });
  list.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const result = store.readJournal();
    if (!result.ok) { render(); return; }
    const entry = result.entries.find(function (item) { return item.id === button.dataset.id; });
    if (!entry) { render(); return; }
    const action = button.dataset.action;
    if (action === "edit") {
      if (snapshot() !== cleanForm) { announce("请先保存或取消当前表单，再编辑其他日志。", true); return; }
      editingId = entry.id;
      editingVersion = entry.updatedAt;
      titleInput.value = entry.title;
      contentInput.value = entry.content;
      dateInput.value = entry.entryDate;
      moodInput.value = entry.mood;
      cleanForm = snapshot();
      cancel.hidden = false;
      error.textContent = "";
      document.getElementById("journal-editor-title").textContent = "编辑成长日志";
      document.getElementById("save-entry").textContent = "保存修改 ↗";
      updateCount();
      titleInput.focus();
      return;
    }
    const now = new Date().toISOString();
    entry.deletedAt = action === "trash" ? now : null;
    entry.updatedAt = now;
    if (persist(result.entries, action === "trash" ? "日志已移入回收站，可以恢复。" : "日志已恢复，原记录日期保留。") && editingId === entry.id) {
      announce("日志状态已更新。请保留草稿，取消编辑后重新打开。", true);
    }
  });
  window.addEventListener("storage", function (event) {
    if (event.key === "levelup:v1:journal" || event.key === null) {
      announce("检测到其他标签页更新，列表已刷新；当前输入保留。", false);
      render();
    }
  });
  window.addEventListener("beforeunload", function (event) {
    if (snapshot() !== cleanForm) { event.preventDefault(); event.returnValue = ""; }
  });
  let lastDate = model.dateKey();
  setInterval(function () {
    const today = model.dateKey();
    if (today !== lastDate) { lastDate = today; render(); }
  }, 60000);
  window.addEventListener("pageshow", render);
  resetForm();
  render();
})();
