/* 所有页面共用的外壳：导航、顶栏、图标和页脚。
   data-root 指向项目根目录，确保子页面的链接也正确。 */
(function () {
  "use strict";
  const root = document.body.dataset.root;
  const currentPage = document.body.dataset.page;
  const modules = [
    { id: "dashboard", name: "Dashboard", label: "概览", file: "index.html", icon: "grid" },
    { id: "goals", name: "Goals", label: "目标", file: "pages/goals.html", icon: "target" },
    { id: "tasks", name: "Tasks", label: "任务", file: "pages/tasks.html", icon: "check" },
    { id: "journal", name: "Journal", label: "日志", file: "pages/journal.html", icon: "book" },
    { id: "analytics", name: "Analytics", label: "分析", file: "pages/analytics.html", icon: "chart" },
    { id: "backup", name: "Backup", label: "备份", file: "pages/backup.html", icon: "shield" }
  ];
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    check: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7 12 3 3 7-7"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4V4Zm16 0h-4a3 3 0 0 0-3 3m0 14a4 4 0 0 1 4-2h3V4Z"/>',
    chart: '<path d="M4 3v17h17M8 15l4-5 4 2 5-7"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    user: '<circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>'
  };
  function icon(name) {
    return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || paths.grid) + '</svg>';
  }
  const activeModule = modules.find(function (item) { return item.id === currentPage; }) || modules[0];

  // 这里只插入代码中定义的固定内容。用户输入使用 textContent/value。
  document.getElementById("sidebar-root").innerHTML = `
    <aside class="sidebar" id="main-sidebar" aria-label="主导航">
      <a class="brand" href="${root}/index.html" aria-label="LevelUp 首页"><img src="${root}/assets/logo.svg" alt=""><span class="brand-name">Level<span>Up</span></span></a>
      <p class="brand-subtitle">成为更好的自己</p>
      <p class="nav-label">WORKSPACE / 工作空间</p>
      <nav class="nav-list" aria-label="成长模块">${modules.map(function (item) {
        const active = item.id === currentPage;
        return `<a class="nav-link${active ? " active" : ""}" href="${root}/${item.file}" ${active ? 'aria-current="page"' : ""}>${icon(item.icon)}<span class="nav-title">${item.name}</span>${active ? "" : `<span class="nav-subtitle">${item.label}</span>`}</a>`;
      }).join("")}</nav>
      <div class="sidebar-bottom"><div class="privacy-card"><div class="privacy-title">${icon("shield")}你的空间，只属于你</div><p>无需登录 · 不上传数据<br>内容仅保存在当前浏览器</p></div><div class="local-profile"><span class="avatar">${icon("user")}</span><div><p class="profile-name">匿名探索者</p><p class="profile-subtitle">LOCAL WORKSPACE</p></div></div></div>
    </aside>
    <button class="menu-backdrop" id="menu-backdrop" aria-label="关闭导航" tabindex="-1"></button>`;

  document.getElementById("header-root").innerHTML = `
    <header class="topbar"><button class="menu-toggle" id="menu-toggle" aria-label="展开导航" aria-controls="main-sidebar" aria-expanded="false">${icon("menu")}</button><div class="breadcrumb"><span>工作空间</span><span aria-hidden="true">/</span><strong>${activeModule.name}</strong></div><div class="topbar-right"><time id="today-date"></time><span class="local-badge"><span class="status-dot"></span> LOCAL ONLY</span></div></header>`;
  document.getElementById("footer-root").innerHTML = '<footer class="page-footer"><span>本地存储不等于备份；清除浏览器数据会删除全部本地记录。</span><span>LEVELUP · SMALL STEPS, REAL GROWTH.</span></footer>';

  document.querySelectorAll("[data-icon]").forEach(function (element) {
    element.innerHTML = icon(element.dataset.icon);
  });
  function updateDate() {
    const now = new Date();
    const date = document.getElementById("today-date");
    date.dateTime = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
    date.textContent = now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
  }
  updateDate();
  setInterval(updateDate, 60000);

  // 整份导入或导入后的编辑写入一个工作区键。
  // 通知其他页面重新读取全部模块；不会重置它们尚未保存的表单。
  window.addEventListener("storage", function (event) {
    if (event.key === "levelup:v1:workspace") {
      window.dispatchEvent(new StorageEvent("storage", {key:null}));
    }
  });

  const menu = document.getElementById("main-sidebar");
  const toggle = document.getElementById("menu-toggle");
  const backdrop = document.getElementById("menu-backdrop");
  const mobileScreen = window.matchMedia("(max-width: 760px)");
  function setMenu(open) {
    menu.classList.toggle("is-open", open);
    backdrop.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "关闭导航" : "展开导航");
    // 收起时让手机屏幕外的链接退出键盘焦点顺序。
    menu.inert = mobileScreen.matches && !open;
  }
  toggle.addEventListener("click", function () { setMenu(toggle.getAttribute("aria-expanded") !== "true"); });
  backdrop.addEventListener("click", function () { setMenu(false); toggle.focus(); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { setMenu(false); toggle.focus(); }
  });
  mobileScreen.addEventListener("change", function () { setMenu(false); });
  setMenu(false);
})();
