/* 日志的日期、统计和筛选规则。一天可以写多篇，篇数与记录天数分开统计。 */
(function () {
  "use strict";
  function dateKey(value) {
    const date = value ? new Date(value) : new Date();
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }
  function getSummary(entries, now) {
    const available = entries.filter(function (entry) { return !entry.deletedAt; });
    return {
      total: available.length,
      days: new Set(available.map(function (entry) { return entry.entryDate; })).size,
      today: available.filter(function (entry) { return entry.entryDate === dateKey(now); }).length
    };
  }
  function filterEntries(entries, options, now) {
    const query = options.query.trim().toLocaleLowerCase();
    return entries.filter(function (entry) {
      if (options.filter === "trash" ? !entry.deletedAt : entry.deletedAt) return false;
      if (options.filter === "today" && entry.entryDate !== dateKey(now)) return false;
      if (options.date && entry.entryDate !== options.date) return false;
      return !query || (entry.title + "\n" + entry.content).toLocaleLowerCase().includes(query);
    }).sort(function (a, b) {
      return b.entryDate.localeCompare(a.entryDate) || b.updatedAt.localeCompare(a.updatedAt);
    });
  }
  window.LevelUpJournal = { dateKey: dateKey, getSummary: getSummary, filterEntries: filterEntries };
})();
