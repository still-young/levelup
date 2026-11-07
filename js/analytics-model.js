/* Analytics 只计算，不写入任何数据。
   任务按实际完成日期、日志按记录日期统计；回收站不计入。
   目标没有历史状态快照，因此目标完成率只表示当前全部目标的状态。 */
(function () {
  "use strict";
  function dateKey(value) {
    const date = value ? new Date(value) : new Date();
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }
  function startDate(days, now) {
    const date = now ? new Date(now) : new Date();
    // 按日历日移动，避免夏令时切换时一天不等于 24 小时的问题。
    date.setDate(date.getDate() - days + 1);
    return dateKey(date);
  }
  function getReport(data, range, now) {
    const today = dateKey(now);
    const start = range === "all" ? null : startDate(Number(range), now);
    const goals = data.goals.filter(function (goal) { return !goal.deletedAt; });
    const categories = ["学习", "健康", "生活", "其他"].map(function (category) {
      const group = goals.filter(function (goal) { return goal.category === category; });
      return { name: category, total: group.length, completed: group.filter(function (goal) { return goal.status === "completed"; }).length };
    });
    const rows = new Map();
    const activeDates = new Set();
    let completedTasks = 0;
    let journalEntries = 0;
    // 有限区间补全零值日期；“全部”按有记录的月份汇总，不遍历多年空白。
    if (range !== "all") {
      const date = new Date(start + "T12:00:00");
      for (let i = 0; i < Number(range); i++) {
        const key = dateKey(date);
        rows.set(key, { date: key, tasks: 0, journal: 0 });
        date.setDate(date.getDate() + 1);
      }
    }
    function count(date, type) {
      // 未来计划和未来日期日志不作为已经发生的成长记录。
      if (date > today || (start && date < start)) return;
      activeDates.add(date);
      const key = range === "all" ? date.slice(0, 7) : date;
      if (!rows.has(key)) rows.set(key, { date: key, tasks: 0, journal: 0 });
      rows.get(key)[type]++;
      if (type === "tasks") completedTasks++;
      else journalEntries++;
    }
    data.tasks.forEach(function (task) {
      if (!task.deletedAt && task.status === "completed") count(dateKey(task.completedAt), "tasks");
    });
    data.entries.forEach(function (entry) {
      if (!entry.deletedAt) count(entry.entryDate, "journal");
    });
    const goalCompleted = goals.filter(function (goal) { return goal.status === "completed"; }).length;
    return {
      start: start, end: today, completedTasks: completedTasks, journalEntries: journalEntries,
      activeDays: activeDates.size, goalTotal: goals.length, goalCompleted: goalCompleted,
      goalRate: goals.length ? Math.round(goalCompleted / goals.length * 100) : null,
      categories: categories,
      rows: Array.from(rows.values()).sort(function (a, b) { return a.date.localeCompare(b.date); })
    };
  }
  window.LevelUpAnalytics = { dateKey: dateKey, getReport: getReport };
})();
