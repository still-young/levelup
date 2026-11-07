/* File.text 只在本机读取；Blob 下载不发送数据。
   选择文件 → 验证 → 预览 → 用户确认 → 原子替换。 */
(function () {
  "use strict";
  const store = window.LevelUpStorage;
  const fileInput = document.getElementById("backup-file");
  const preview = document.getElementById("backup-preview");
  const confirm = document.getElementById("confirm-replace");
  const importButton = document.getElementById("import-backup");
  const undoButton = document.getElementById("undo-import");
  const status = document.getElementById("backup-status");
  const fileStatus = document.getElementById("backup-file-status");
  let pending = null;
  let expectedState = null;
  let undoState = null;
  let selection = 0;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }
  function announce(message, isError) { status.textContent = message; status.classList.toggle("error", Boolean(isError)); }
  function getCounts() {
    const note = store.readNote(), goals = store.readGoals(), tasks = store.readTasks(), journal = store.readJournal();
    return [note.ok ? (note.note ? 1 : 0) : "—",goals.ok ? goals.goals.length : "—",tasks.ok ? tasks.tasks.length : "—",journal.ok ? journal.entries.length : "—"];
  }
  function refresh() {
    const counts = getCounts();
    const current = document.getElementById("backup-current");
    current.replaceChildren();
    ["寄语", "目标（含回收站）", "任务（含回收站）", "日志（含回收站）"].forEach(function (name, index) {
      const row = element("div", "", "");
      row.append(element("dt", "muted", name), element("dd", "", counts[index]));
      current.append(row);
    });
    document.getElementById("export-backup").disabled = counts.includes("—");
    if (counts.includes("—")) announce("部分本地数据无法读取，已暂停导出，相关数量显示 —。请检查本地存储；原数据未被修改。", true);
    const state = store.backupState();
    undoState = state.ok ? state.state : null;
    undoButton.disabled = !state.canUndo;
    document.getElementById("backup-undo-note").textContent = state.canUndo ? "可以撤销最近一次导入，恢复导入前的数据。" : "当前没有可撤销的导入。导入后继续编辑任一记录，也会关闭撤销入口。";
  }
  function clearPreview() {
    selection++;
    pending = null;
    expectedState = null;
    preview.hidden = true;
    confirm.checked = false;
    importButton.disabled = true;
  }
  document.getElementById("export-backup").addEventListener("click", function () {
    const result = store.exportBackup();
    if (!result.ok) { announce(result.message, true); refresh(); return; }
    let url;
    try {
      const blob = new Blob([JSON.stringify(result.backup, null, 2)], {type:"application/json;charset=utf-8"});
      url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "LevelUp-backup-" + result.backup.exportedAt.replace(/[:.]/g, "-") + ".json";
      document.body.append(link);
      link.click();
      link.remove();
      // 留给浏览器完成下载，不声称能确认用户磁盘上的保存结果。
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      announce("已生成备份并请求下载，请在浏览器下载列表中确认。", false);
    } catch (error) {
      if (url) URL.revokeObjectURL(url);
      announce("未能生成下载，请检查浏览器下载设置后重试。现有数据未改变。", true);
    }
  });
  fileInput.addEventListener("change", async function () {
    clearPreview();
    const request = selection;
    const file = fileInput.files[0];
    if (!file) { fileStatus.textContent = "尚未选择文件"; return; }
    if (file.size > 10 * 1024 * 1024) { fileStatus.textContent = "文件超过 10 MB，请选择 LevelUp 导出的备份。"; return; }
    fileStatus.textContent = "正在检查文件……";
    try {
      const text = await file.text();
      if (request !== selection) return;
      // 接受 UTF-8 BOM，便于用户用 Windows 编辑器另存过文件。
      const result = store.validateBackup(JSON.parse(text.replace(/^\uFEFF/, "")));
      if (!result.ok) { fileStatus.textContent = result.message; return; }
      const state = store.backupState();
      if (!state.ok) { fileStatus.textContent = "当前浏览器存储无法访问，暂不能导入。"; return; }
      pending = result.backup;
      expectedState = state.state;
      const data = pending.data;
      const current = getCounts();
      const incoming = [data.note ? 1 : 0,data.goals.length,data.tasks.length,data.journal.length];
      const table = document.getElementById("backup-compare");
      table.replaceChildren();
      ["寄语", "目标", "任务", "日志"].forEach(function (name, index) {
        const row = document.createElement("tr");
        const heading = element("th", "", name);
        heading.scope = "row";
        row.append(heading, element("td", "", current[index]), element("td", "", incoming[index]));
        table.append(row);
      });
      const goalIds = new Set(data.goals.map(function (goal) { return goal.id; }));
      const orphaned = data.tasks.filter(function (task) { return task.goalId && !goalIds.has(task.goalId); }).length;
      document.getElementById("backup-reference-hint").textContent = orphaned ? orphaned + " 项任务的原关联目标不存在；导入后保留该关联并显示提示。" : "任务与目标的关联、完成状态和回收站记录会一并保留。";
      document.getElementById("backup-file-time").textContent = "备份生成于 " + new Date(pending.exportedAt).toLocaleString("zh-CN", {hour12:false});
      fileStatus.textContent = "文件检查通过：" + file.name;
      preview.hidden = false;
    } catch (error) {
      if (request === selection) fileStatus.textContent = "无法读取备份，或文件不是有效 JSON。现有数据未改变。";
    }
  });
  confirm.addEventListener("change", function () { importButton.disabled = !pending || !confirm.checked; });
  document.getElementById("cancel-import").addEventListener("click", function () {
    clearPreview(); fileInput.value = ""; fileStatus.textContent = "已取消，现有数据未改变。";
  });
  importButton.addEventListener("click", function () {
    if (!pending || !confirm.checked) return;
    const result = store.importBackup(pending, expectedState);
    announce(result.ok ? "导入成功。四类数据已恢复，其他页面刷新后可查看。尚未继续编辑时可以撤销本次导入。" : result.message, !result.ok);
    clearPreview(); fileInput.value = "";
    fileStatus.textContent = result.ok ? "导入完成" : "请重新选择文件预览。";
    refresh();
  });
  undoButton.addEventListener("click", function () {
    const result = store.undoImport(undoState);
    announce(result.ok ? "已撤销导入，恢复到导入前的数据。" : result.message, !result.ok);
    clearPreview(); fileInput.value = ""; fileStatus.textContent = "尚未选择文件";
    refresh();
  });
  window.addEventListener("storage", function (event) {
    if ([null,"levelup:v1:daily-note","levelup:v1:goals","levelup:v1:tasks","levelup:v1:journal"].includes(event.key)) {
      if (pending) {
        clearPreview(); fileInput.value = "";
        fileStatus.textContent = "其他标签页修改了数据，请重新选择文件预览。";
      }
      refresh();
    }
  });
  window.addEventListener("pageshow", refresh);
  refresh();
})();
