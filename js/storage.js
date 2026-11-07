/* LocalStorage 的统一入口。后续模块可以在这里扩展各自的数据键。
   不需要服务器：数据仅写入当前浏览器的当前网站存储空间。 */
(function () {
  "use strict";
  const NOTE_KEY = "levelup:v1:daily-note";
  const GOALS_KEY = "levelup:v1:goals";
  const TASKS_KEY = "levelup:v1:tasks";
  const JOURNAL_KEY = "levelup:v1:journal";
  const WORKSPACE_KEY = "levelup:v1:workspace";
  const DATA_KEYS = [NOTE_KEY, GOALS_KEY, TASKS_KEY, JOURNAL_KEY];

  // 导入涉及四类数据，逐个写入可能只成功一半。
  // 导入后用一个工作区键保存四类数据，一次 setItem 即完成整份替换。
  // 原来的四个键继续兼容；尚未导入的用户仍按原方式读写。
  function validRawMap(values) {
    return values && typeof values === "object" && !Array.isArray(values) &&
      Object.keys(values).length === DATA_KEYS.length && DATA_KEYS.every(function (key) {
        return Object.prototype.hasOwnProperty.call(values, key) && (values[key] === null || typeof values[key] === "string");
      });
  }
  function readWorkspace() {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (raw === null) return null;
    const workspace = JSON.parse(raw);
    if (!workspace || workspace.version !== 1 || !validRawMap(workspace.values) ||
        !(workspace.previous === null || validRawMap(workspace.previous))) throw new Error("工作区格式无效");
    return workspace;
  }
  function readValue(key) {
    const workspace = readWorkspace();
    return workspace ? workspace.values[key] : localStorage.getItem(key);
  }
  function writeValue(key, value) {
    const workspace = readWorkspace();
    if (!workspace) { localStorage.setItem(key, value); return; }
    workspace.values[key] = value;
    // 正常编辑后不再提供撤销导入，避免撤销时丢失导入后的新内容。
    workspace.previous = null;
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  }
  function captureState() {
    const workspace = readWorkspace();
    if (workspace) return JSON.stringify(workspace.values);
    const values = {};
    DATA_KEYS.forEach(function (key) { values[key] = localStorage.getItem(key); });
    return JSON.stringify(values);
  }

  function readNote() {
    try {
      const raw = readValue(NOTE_KEY);
      if (raw === null) return { ok: true, note: null };
      const note = JSON.parse(raw);
      if (!note || typeof note.text !== "string" || note.text.length > 200 ||
          typeof note.savedAt !== "string" || Number.isNaN(Date.parse(note.savedAt))) {
        throw new Error("寄语数据格式无效");
      }
      return { ok: true, note: note };
    } catch (error) {
      // 数据损坏、隐私设置或浏览器限制，都不应该导致页面崩溃。
      return { ok: false, note: null };
    }
  }

  function saveNote(text) {
    try {
      const note = { text: text, savedAt: new Date().toISOString() };
      writeValue(NOTE_KEY, JSON.stringify(note));
      return { ok: true, note: note };
    } catch (error) {
      return { ok: false, note: null };
    }
  }

  // 暂时使用普通脚本，双击 HTML 也能运行；无需配置模块打包工具。
  // 一个目标是一条普通对象；状态只有进行中、已完成，删除后仍可恢复。
  function validDate(value) {
    if (value === "") return true;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + "T00:00:00Z");
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function validGoals(goals) {
    if (!Array.isArray(goals)) return false;
    const ids = new Set();
    return goals.every(function (goal) {
      if (!goal || typeof goal.id !== "string" || !goal.id || ids.has(goal.id)) return false;
      ids.add(goal.id);
      return typeof goal.title === "string" && goal.title.trim().length > 0 && goal.title.length <= 80 &&
        typeof goal.description === "string" && goal.description.length <= 500 &&
        ["学习", "健康", "生活", "其他"].includes(goal.category) && validDate(goal.dueDate) &&
        ["active", "completed"].includes(goal.status) &&
        typeof goal.createdAt === "string" && !Number.isNaN(Date.parse(goal.createdAt)) &&
        typeof goal.updatedAt === "string" && !Number.isNaN(Date.parse(goal.updatedAt)) &&
        (goal.deletedAt === null || (typeof goal.deletedAt === "string" && !Number.isNaN(Date.parse(goal.deletedAt))));
    });
  }
  function readGoals() {
    try {
      const raw = readValue(GOALS_KEY);
      const goals = raw === null ? [] : JSON.parse(raw);
      if (!validGoals(goals)) throw new Error("目标数据格式无效");
      return { ok: true, goals: goals };
    } catch (error) {
      // 不把损坏的数据当作空列表覆盖，以免丢失原记录。
      return { ok: false, goals: [] };
    }
  }
  function saveGoals(goals) {
    try {
      if (!validGoals(goals)) throw new Error("目标数据格式无效");
      writeValue(GOALS_KEY, JSON.stringify(goals));
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }
  function validTasks(tasks) {
    if (!Array.isArray(tasks)) return false;
    const ids = new Set();
    function timestamp(value) { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }
    return tasks.every(function (task) {
      if (!task || typeof task.id !== "string" || !task.id || ids.has(task.id)) return false;
      ids.add(task.id);
      return typeof task.title === "string" && task.title.trim().length > 0 && task.title.length <= 80 &&
        typeof task.description === "string" && task.description.length <= 500 &&
        (task.goalId === null || (typeof task.goalId === "string" && task.goalId.length > 0)) &&
        validDate(task.plannedDate) && ["active", "completed"].includes(task.status) &&
        timestamp(task.createdAt) && timestamp(task.updatedAt) &&
        (task.status === "active" ? task.completedAt === null : timestamp(task.completedAt)) &&
        (task.deletedAt === null || timestamp(task.deletedAt));
    });
  }
  function readTasks() {
    try {
      const raw = readValue(TASKS_KEY);
      const tasks = raw === null ? [] : JSON.parse(raw);
      if (!validTasks(tasks)) throw new Error("任务数据格式无效");
      return { ok: true, tasks: tasks };
    } catch (error) {
      return { ok: false, tasks: [] };
    }
  }
  function saveTasks(tasks) {
    try {
      if (!validTasks(tasks)) throw new Error("任务数据格式无效");
      writeValue(TASKS_KEY, JSON.stringify(tasks));
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }
  function validJournal(entries) {
    if (!Array.isArray(entries)) return false;
    const ids = new Set();
    function timestamp(value) { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }
    return entries.every(function (entry) {
      if (!entry || typeof entry.id !== "string" || !entry.id || ids.has(entry.id)) return false;
      ids.add(entry.id);
      return typeof entry.title === "string" && entry.title.trim().length > 0 && entry.title.length <= 80 &&
        typeof entry.content === "string" && entry.content.trim().length > 0 && entry.content.length <= 5000 &&
        entry.entryDate !== "" && validDate(entry.entryDate) &&
        ["未选择", "开心", "充实", "平静", "疲惫", "低落"].includes(entry.mood) &&
        timestamp(entry.createdAt) && timestamp(entry.updatedAt) &&
        (entry.deletedAt === null || timestamp(entry.deletedAt));
    });
  }
  function readJournal() {
    try {
      const raw = readValue(JOURNAL_KEY);
      const entries = raw === null ? [] : JSON.parse(raw);
      if (!validJournal(entries)) throw new Error("日志数据格式无效");
      return { ok: true, entries: entries };
    } catch (error) {
      return { ok: false, entries: [] };
    }
  }
  function saveJournal(entries) {
    try {
      if (!validJournal(entries)) throw new Error("日志数据格式无效");
      writeValue(JOURNAL_KEY, JSON.stringify(entries));
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }
  function validateBackup(backup) {
    if (!backup || backup.format !== "levelup-backup" || backup.version !== 1 ||
        typeof backup.exportedAt !== "string" || Number.isNaN(Date.parse(backup.exportedAt))) {
      return { ok: false, message: "不是支持的 LevelUp 备份，或备份版本不兼容。" };
    }
    const data = backup.data;
    if (!data || !Object.prototype.hasOwnProperty.call(data, "note") ||
        !(data.note === null || (data.note && typeof data.note.text === "string" && data.note.text.length <= 200 &&
          typeof data.note.savedAt === "string" && !Number.isNaN(Date.parse(data.note.savedAt)))) ||
        !validGoals(data.goals) || !validTasks(data.tasks) || !validJournal(data.journal)) {
      return { ok: false, message: "备份内容不完整或记录格式有误，未修改现有数据。" };
    }
    // 白名单复制：只保留网站认识的字段，不执行备份中的任何内容。
    const clean = {
      note: data.note === null ? null : { text: data.note.text, savedAt: data.note.savedAt },
      goals: data.goals.map(function (g) { return {id:g.id,title:g.title,description:g.description,category:g.category,dueDate:g.dueDate,status:g.status,createdAt:g.createdAt,updatedAt:g.updatedAt,deletedAt:g.deletedAt}; }),
      tasks: data.tasks.map(function (t) { return {id:t.id,title:t.title,description:t.description,goalId:t.goalId,plannedDate:t.plannedDate,status:t.status,completedAt:t.completedAt,createdAt:t.createdAt,updatedAt:t.updatedAt,deletedAt:t.deletedAt}; }),
      journal: data.journal.map(function (j) { return {id:j.id,title:j.title,content:j.content,entryDate:j.entryDate,mood:j.mood,createdAt:j.createdAt,updatedAt:j.updatedAt,deletedAt:j.deletedAt}; })
    };
    return { ok: true, backup: {format:"levelup-backup",version:1,exportedAt:backup.exportedAt,data:clean} };
  }
  function exportBackup() {
    try {
      const values = JSON.parse(captureState());
      const data = {
        note: values[NOTE_KEY] === null ? null : JSON.parse(values[NOTE_KEY]),
        goals: JSON.parse(values[GOALS_KEY] === null ? "[]" : values[GOALS_KEY]),
        tasks: JSON.parse(values[TASKS_KEY] === null ? "[]" : values[TASKS_KEY]),
        journal: JSON.parse(values[JOURNAL_KEY] === null ? "[]" : values[JOURNAL_KEY])
      };
      const result = validateBackup({format:"levelup-backup",version:1,exportedAt:new Date().toISOString(),data:data});
      if (!result.ok) throw new Error("现有数据格式无效");
      return result;
    } catch (error) {
      return {ok:false,message:"有数据无法读取，已停止导出，避免生成缺少内容的备份。"};
    }
  }
  function importBackup(backup, expectedState) {
    const result = validateBackup(backup);
    if (!result.ok) return result;
    try {
      const state = captureState();
      if (state !== expectedState) return {ok:false,message:"预览后本地数据已变化。请重新选择文件并预览，再决定是否导入。"};
      const data = result.backup.data;
      const values = {};
      values[NOTE_KEY] = data.note === null ? null : JSON.stringify(data.note);
      values[GOALS_KEY] = JSON.stringify(data.goals);
      values[TASKS_KEY] = JSON.stringify(data.tasks);
      values[JOURNAL_KEY] = JSON.stringify(data.journal);
      const workspace = {version:1,values:values,previous:JSON.parse(state)};
      // 单键写入：失败时，当前四类数据仍保持原状。
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
      return {ok:true};
    } catch (error) {
      return {ok:false,message:"导入失败，现有数据未被替换。可能是存储空间不足或浏览器限制，请先保留备份文件。"};
    }
  }
  function backupState() {
    try {
      const workspace = readWorkspace();
      return {ok:true,state:captureState(),canUndo:Boolean(workspace && workspace.previous)};
    } catch (error) { return {ok:false,canUndo:false}; }
  }
  function undoImport(expectedState) {
    try {
      const workspace = readWorkspace();
      if (!workspace || !workspace.previous || captureState() !== expectedState) {
        return {ok:false,message:"数据已变化或已继续编辑，不能撤销导入。请刷新页面查看当前状态。"};
      }
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify({version:1,values:workspace.previous,previous:null}));
      return {ok:true};
    } catch (error) { return {ok:false,message:"撤销失败，当前数据保持不变。请保留已有备份文件。"}; }
  }
  window.LevelUpStorage = {
    readNote: readNote, saveNote: saveNote,
    readGoals: readGoals, saveGoals: saveGoals,
    readTasks: readTasks, saveTasks: saveTasks,
    readJournal: readJournal, saveJournal: saveJournal,
    validateBackup: validateBackup, exportBackup: exportBackup, importBackup: importBackup,
    backupState: backupState, undoImport: undoImport
  };
})();
