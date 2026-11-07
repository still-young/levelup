/* Tasks 和 Dashboard 共用的日期与统计规则。
   计划日期与完成时间是两件事：“今日完成”按实际完成时间计算。
   使用设备本地日期，不用 UTC 日期，避免晚上/凌晨统计错一天。 */
(function () {
  "use strict";
  function dateKey(value) {
    const date = value ? new Date(value) : new Date();
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }
  function getSummary(tasks, now) {
    const today = dateKey(now);
    const available = tasks.filter(function (task) { return !task.deletedAt; });
    return {
      active: available.filter(function (task) { return task.status === "active"; }).length,
      plannedToday: available.filter(function (task) { return task.plannedDate === today; }).length,
      completedToday: available.filter(function (task) {
        return task.status === "completed" && dateKey(task.completedAt) === today;
      }).length
    };
  }
  function filterTasks(tasks, filter, now) {
    return tasks.filter(function (task) {
      if (filter === "trash") return Boolean(task.deletedAt);
      if (task.deletedAt) return false;
      if (filter === "today") return task.plannedDate === dateKey(now);
      if (filter === "all") return true;
      return task.status === filter;
    });
  }
  window.LevelUpTasks = { dateKey: dateKey, getSummary: getSummary, filterTasks: filterTasks };
})();
