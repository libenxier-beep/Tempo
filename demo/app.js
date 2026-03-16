const STORAGE_KEY = "time-ledger-mobile-demo-v4";

const uiState = {
  currentView: "home",
  projectSortMode: "recent",
  projectSearch: "",
  historySortMode: "duration",
  historyProjectSearch: "",
  historyDateMode: "all",
  historyDateSearch: "",
  historyStatusFilter: "all",
  dashboardPeriod: "day",
  historyExpandedId: null,
  typeEditId: null,
  projectEditId: null,
  showArchivedProjects: false,
};

const els = {
  views: document.querySelectorAll(".view"),
  navItems: document.querySelectorAll(".nav-item"),
  networkBanner: document.querySelector("#networkBanner"),
  updateBanner: document.querySelector("#updateBanner"),
  applyUpdateButton: document.querySelector("#applyUpdateButton"),
  projectSearch: document.querySelector("#projectSearch"),
  searchFeedback: document.querySelector("#searchFeedback"),
  projectList: document.querySelector("#projectList"),
  homeEmptyCreate: document.querySelector("#homeEmptyCreate"),
  currentSelfTask: document.querySelector("#currentSelfTask"),
  runningAgentTasks: document.querySelector("#runningAgentTasks"),
  historySort: document.querySelector("#historySort"),
  historyProjectSearch: document.querySelector("#historyProjectSearch"),
  historyDateMode: document.querySelector("#historyDateMode"),
  historyDateSearchWrap: document.querySelector("#historyDateSearchWrap"),
  historyDateSearch: document.querySelector("#historyDateSearch"),
  historySummary: document.querySelector("#historySummary"),
  historyList: document.querySelector("#historyList"),
  dashboardMetrics: document.querySelector("#dashboardMetrics"),
  dashboardTypeBreakdown: document.querySelector("#dashboardTypeBreakdown"),
  dashboardTrend: document.querySelector("#dashboardTrend"),
  periodButtons: document.querySelectorAll(".period-segment"),
  nicknameForm: document.querySelector("#nicknameForm"),
  nicknameInput: document.querySelector("#nicknameInput"),
  nicknameHint: document.querySelector("#nicknameHint"),
  typeForm: document.querySelector("#typeForm"),
  typeNameInput: document.querySelector("#typeNameInput"),
  typeSubmitButton: document.querySelector("#typeSubmitButton"),
  typeConstraintHint: document.querySelector("#typeConstraintHint"),
  typeList: document.querySelector("#typeList"),
  projectForm: document.querySelector("#projectForm"),
  projectTypeSelect: document.querySelector("#projectTypeSelect"),
  projectNameInput: document.querySelector("#projectNameInput"),
  projectActorSelect: document.querySelector("#projectActorSelect"),
  projectSubmitButton: document.querySelector("#projectSubmitButton"),
  toggleArchivedButton: document.querySelector("#toggleArchivedButton"),
  projectAdminList: document.querySelector("#projectAdminList"),
  archivedProjectList: document.querySelector("#archivedProjectList"),
  recentModeButton: document.querySelector("#recentModeButton"),
  frequentModeButton: document.querySelector("#frequentModeButton"),
  metricCardTemplate: document.querySelector("#metricCardTemplate"),
};

const appStore = {
  get() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : createSeedData();
  },
  save(nextData) {
    nextData.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
  },
  reset() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(createSeedData()));
  },
};

let timerHandle = null;
let pendingServiceWorker = null;

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `tempo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

init();

function init() {
  ensureSeedData();
  bindEvents();
  syncNetworkBanner(navigator.onLine);
  registerServiceWorker();
  render();
  startTimer();
}

function bindEvents() {
  els.navItems.forEach((button) => {
    button.addEventListener("click", () => {
      uiState.currentView = button.dataset.nav;
      render();
    });
  });

  els.projectSearch.addEventListener("input", (event) => {
    uiState.projectSearch = event.target.value.trim();
    renderHome();
  });

  els.recentModeButton.addEventListener("click", () => {
    uiState.projectSortMode = "recent";
    renderHome();
  });

  els.frequentModeButton.addEventListener("click", () => {
    uiState.projectSortMode = "frequent";
    renderHome();
  });

  els.historySort.addEventListener("change", (event) => {
    uiState.historySortMode = event.target.value;
    renderHistory();
  });
  els.historyProjectSearch.addEventListener("input", (event) => {
    uiState.historyProjectSearch = event.target.value.trim();
    renderHistory();
  });
  els.historyDateMode.addEventListener("change", (event) => {
    uiState.historyDateMode = event.target.value;
    uiState.historyDateSearch = "";
    renderHistory();
  });
  els.historyDateSearch.addEventListener("input", (event) => {
    uiState.historyDateSearch = event.target.value;
    renderHistory();
  });

  els.periodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      uiState.dashboardPeriod = button.dataset.period;
      renderDashboard();
    });
  });

  els.nicknameForm.addEventListener("submit", handleNicknameSubmit);
  els.typeForm.addEventListener("submit", handleTypeSubmit);
  els.projectForm.addEventListener("submit", handleProjectSubmit);
  els.toggleArchivedButton.addEventListener("click", () => {
    uiState.showArchivedProjects = !uiState.showArchivedProjects;
    renderManage();
  });

  window.addEventListener("online", () => syncNetworkBanner(true));
  window.addEventListener("offline", () => syncNetworkBanner(false));
  els.applyUpdateButton.addEventListener("click", applyPendingUpdate);
}

function render() {
  toggleViews();
  renderHome();
  renderHistory();
  renderDashboard();
  renderManage();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((registration) => {
      if (registration.waiting) {
        showUpdateBanner(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const nextWorker = registration.installing;
        if (!nextWorker) {
          return;
        }

        nextWorker.addEventListener("statechange", () => {
          if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner(nextWorker);
          }
        });
      });
    }).catch(() => {
      // Keep the demo usable even if service worker registration fails.
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (registerServiceWorker.hasReloaded) {
      return;
    }

    registerServiceWorker.hasReloaded = true;
    window.location.reload();
  });
}

function syncNetworkBanner(isOnline) {
  els.networkBanner.textContent = isOnline ? "已恢复在线" : "当前离线，可继续使用已缓存内容";
  els.networkBanner.classList.remove("hidden", "is-online", "is-offline");
  els.networkBanner.classList.add(isOnline ? "is-online" : "is-offline");

  clearTimeout(syncNetworkBanner.timeoutId);
  if (isOnline) {
    syncNetworkBanner.timeoutId = window.setTimeout(() => {
      els.networkBanner.classList.add("hidden");
    }, 1600);
  }
}

function showUpdateBanner(worker) {
  pendingServiceWorker = worker;
  els.updateBanner.classList.remove("hidden");
}

function applyPendingUpdate() {
  if (!pendingServiceWorker) {
    return;
  }

  pendingServiceWorker.postMessage({ type: "SKIP_WAITING" });
  els.updateBanner.classList.add("hidden");
}

function toggleViews() {
  els.views.forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === uiState.currentView);
  });

  els.navItems.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.nav === uiState.currentView);
  });
}

function renderHome() {
  const data = appStore.get();
  const projects = getVisibleProjects(data);
  const filtered = filterProjects(projects, uiState.projectSearch, data);
  const sorted = sortProjects(filtered, uiState.projectSortMode);

  els.recentModeButton.classList.toggle("is-active", uiState.projectSortMode === "recent");
  els.frequentModeButton.classList.toggle("is-active", uiState.projectSortMode === "frequent");

  renderSearchFeedback(filtered, uiState.projectSearch);
  renderCurrentSelfTask(getRunningSelfSession(data), data);
  renderRunningAgents(getRunningAgentSessions(data), data);
  renderProjectList(sorted, data);
  renderHomeEmptyCreate(data, filtered, uiState.projectSearch);
}

function renderSearchFeedback(filteredProjects, query) {
  if (!query) {
    els.searchFeedback.innerHTML = `<span class="pill gray">当前展示全部可用项目</span>`;
    return;
  }

  const directStartButton =
    filteredProjects.length === 1
      ? `<button id="startSearchResultButton" class="inline-button" type="button">直接开始</button>`
      : "";

  els.searchFeedback.innerHTML = filteredProjects.length
    ? `
      ${directStartButton}
      <button id="clearSearchButton" class="inline-button" type="button">清空</button>
    `
    : `
      <span class="pill gray">没有搜到“${escapeHtml(query)}”</span>
      <button id="clearSearchButton" class="inline-button" type="button">清空</button>
    `;

  els.searchFeedback.querySelector("#clearSearchButton").addEventListener("click", () => {
    uiState.projectSearch = "";
    els.projectSearch.value = "";
    renderHome();
  });

  const startButton = els.searchFeedback.querySelector("#startSearchResultButton");
  if (startButton) {
    startButton.addEventListener("click", () => {
      startProject(filteredProjects[0].id);
    });
  }
}

function renderCurrentSelfTask(session, data) {
  if (!session) {
    els.currentSelfTask.innerHTML = `<div class="empty-state">当前无本人任务进行中。</div>`;
    return;
  }

  const project = findProject(data, session.projectId);
  const type = findType(data, project?.typeId);
  els.currentSelfTask.innerHTML = `
    <article class="current-task-card">
      <p class="current-task-title">${escapeHtml(project?.name || "未知项目")}</p>
      <p class="current-task-meta">${escapeHtml(type?.name || "未分类")} · 本人 · ${formatDateTime(session.startAt)} 开始</p>
      <div class="big-timer">${formatDuration(getSessionDurationMs(session))}</div>
      <div class="action-row">
        <button class="primary-button danger" type="button" data-stop-session="${session.id}">停止当前任务</button>
      </div>
    </article>
  `;

  els.currentSelfTask.querySelector("[data-stop-session]").addEventListener("click", () => stopSession(session.id));
}

function renderRunningAgents(sessions, data) {
  if (!sessions.length) {
    els.runningAgentTasks.innerHTML = `<div class="empty-state">当前没有进行中的 Agent 任务。</div>`;
    return;
  }

  els.runningAgentTasks.innerHTML = sessions
    .map((session) => {
      const project = findProject(data, session.projectId);
      const type = findType(data, project?.typeId);
      return `
        <article class="agent-card">
          <div>
            <strong>${escapeHtml(project?.name || "未知项目")}</strong>
            <p class="muted">${escapeHtml(type?.name || "未分类")} · Agent · 已运行 ${formatDuration(getSessionDurationMs(session))}</p>
          </div>
          <button class="inline-button" type="button" data-stop-session="${session.id}">停止</button>
        </article>
      `;
    })
    .join("");

  els.runningAgentTasks.querySelectorAll("[data-stop-session]").forEach((button) => {
    button.addEventListener("click", () => stopSession(button.dataset.stopSession));
  });
}

function renderProjectList(projects, data) {
  if (!projects.length) {
    els.projectList.innerHTML = `<div class="empty-state">当前没有匹配项目，可以直接在上方搜索区里新建。</div>`;
    return;
  }

  els.projectList.innerHTML = projects
    .map((project) => {
      const type = findType(data, project.typeId);
      return `
        <article class="project-card">
          <div class="project-card-header">
            <div>
              <div class="project-name">${escapeHtml(project.name)}</div>
              <p class="project-meta">${escapeHtml(type?.name || "未分类")} · ${project.actor === "self" ? "本人" : "Agent"}</p>
            </div>
            <span class="pill ${project.actor === "agent" ? "gray" : ""}">${project.actor === "self" ? "本人" : "Agent"}</span>
          </div>
          <div class="badge-row">
            <span class="pill gray">最近：${project.lastUsedAt ? formatRelativeTime(project.lastUsedAt) : "未使用"}</span>
            <span class="pill gray">累计：${project.usageCount || 0} 次</span>
          </div>
          <button class="primary-button" type="button" data-start-project="${project.id}">${project.actor === "self" ? "开始本人任务" : "开始 Agent 任务"}</button>
        </article>
      `;
    })
    .join("");

  els.projectList.querySelectorAll("[data-start-project]").forEach((button) => {
    button.addEventListener("click", () => startProject(button.dataset.startProject));
  });
}

function renderHomeEmptyCreate(data, filteredProjects, query) {
  const types = getActiveTypes(data);
  if (!query) {
    els.homeEmptyCreate.innerHTML = `<div class="empty-state">输入项目名后，这里会在搜索无结果时显示首页轻量快速创建入口。</div>`;
    return;
  }

  if (filteredProjects.length) {
    els.homeEmptyCreate.innerHTML = `<div class="empty-state">已找到匹配项目。完整项目管理仍归“我”页。</div>`;
    return;
  }

  if (!types.length) {
    els.homeEmptyCreate.innerHTML = `<div class="empty-state">当前还没有项目类型，无法在首页快速创建。请先到“我”页维护项目类型。</div>`;
    return;
  }

  els.homeEmptyCreate.innerHTML = `
    <article class="quick-create-card">
      <div>
        <p class="project-name">创建“${escapeHtml(query)}”</p>
        <p class="quick-create-copy">这里只收集最小必要信息：项目名、项目类型、执行主体。</p>
      </div>
      <form id="quickCreateForm" class="quick-create-form">
        <div class="quick-create-grid">
          <input id="quickCreateName" type="text" value="${escapeHtml(query)}" required />
          <select id="quickCreateType">${types.map((type) => `<option value="${type.id}">${escapeHtml(type.name)}</option>`).join("")}</select>
          <select id="quickCreateActor">
            <option value="self">本人</option>
            <option value="agent">Agent</option>
          </select>
        </div>
        <div class="quick-create-actions">
          <button class="inline-button" type="button" id="quickCreateOnlyButton">新建</button>
          <button class="primary-button success" type="submit">新建并开始</button>
        </div>
      </form>
    </article>
  `;

  els.homeEmptyCreate.querySelector("#quickCreateOnlyButton").addEventListener("click", () => {
    handleQuickCreateSubmit(false);
  });
  els.homeEmptyCreate.querySelector("#quickCreateForm").addEventListener("submit", (event) => {
    event.preventDefault();
    handleQuickCreateSubmit(true);
  });
}

function renderHistory() {
  const data = appStore.get();
  const baseFilteredSessions = filterHistorySessions(
    data.sessions,
    data,
    uiState.historyProjectSearch,
    uiState.historyDateMode,
    uiState.historyDateSearch,
  );
  const filteredSessions = filterHistoryByStatus(baseFilteredSessions, uiState.historyStatusFilter);
  const sessions = sortSessions(filteredSessions, uiState.historySortMode);
  els.historySort.value = uiState.historySortMode;
  els.historyProjectSearch.value = uiState.historyProjectSearch;
  els.historyDateMode.value = uiState.historyDateMode;
  syncHistoryDateInput();
  els.historyDateSearch.value = uiState.historyDateSearch;
  const runningCount = baseFilteredSessions.filter((session) => !session.endAt).length;
  const completedCount = baseFilteredSessions.length - runningCount;
  const historyStatusLabelMap = {
    all: "全部结果",
    running: "进行中",
    completed: "已结束",
  };
  els.historySummary.innerHTML = `
    <span class="history-current-filter">当前分类：<strong>${historyStatusLabelMap[uiState.historyStatusFilter]}</strong></span>
    <button class="pill gray summary-filter-button ${uiState.historyStatusFilter === "all" ? "is-active" : ""}" type="button" data-history-status="all">全部结果 ${baseFilteredSessions.length}</button>
    <button class="pill gray summary-filter-button ${uiState.historyStatusFilter === "running" ? "is-active" : ""}" type="button" data-history-status="running">进行中 ${runningCount}</button>
    <button class="pill gray summary-filter-button ${uiState.historyStatusFilter === "completed" ? "is-active" : ""}" type="button" data-history-status="completed">已结束 ${completedCount}</button>
  `;
  els.historySummary.querySelectorAll("[data-history-status]").forEach((button) => {
    button.addEventListener("click", () => {
      uiState.historyStatusFilter = button.dataset.historyStatus;
      renderHistory();
    });
  });

  if (!sessions.length) {
    els.historyList.innerHTML = `<div class="empty-state">当前筛选条件下没有历史记录。</div>`;
    return;
  }

  els.historyList.innerHTML = sessions.map((session) => renderHistoryCard(session, data)).join("");
  els.historyList.querySelectorAll("[data-history-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      uiState.historyExpandedId = uiState.historyExpandedId === button.dataset.historyToggle ? null : button.dataset.historyToggle;
      renderHistory();
    });
  });
  els.historyList.querySelectorAll("[data-save-history]").forEach((button) => {
    button.addEventListener("click", () => saveHistoryEdit(button.dataset.saveHistory));
  });
}

function syncHistoryDateInput() {
  const mode = uiState.historyDateMode;
  if (mode === "all") {
    els.historyDateSearchWrap.classList.add("hidden");
    els.historyDateSearch.value = "";
    els.historyDateSearch.type = "date";
    els.historyDateSearch.placeholder = "";
    return;
  }

  els.historyDateSearchWrap.classList.remove("hidden");
  if (mode === "day") {
    els.historyDateSearch.type = "date";
    els.historyDateSearch.placeholder = "选择某一天";
    els.historyDateSearch.removeAttribute("min");
    els.historyDateSearch.removeAttribute("max");
    return;
  }
  if (mode === "week") {
    els.historyDateSearch.type = "week";
    els.historyDateSearch.placeholder = "选择某一周";
    els.historyDateSearch.removeAttribute("min");
    els.historyDateSearch.removeAttribute("max");
    return;
  }
  if (mode === "month") {
    els.historyDateSearch.type = "month";
    els.historyDateSearch.placeholder = "选择某个月";
    els.historyDateSearch.removeAttribute("min");
    els.historyDateSearch.removeAttribute("max");
    return;
  }

  els.historyDateSearch.type = "number";
  els.historyDateSearch.placeholder = "输入年份，例如 2026";
  els.historyDateSearch.min = "2000";
  els.historyDateSearch.max = "2099";
}

function renderHistoryCard(session, data) {
  const project = findProject(data, session.projectId);
  const type = findType(data, project?.typeId);
  const expanded = uiState.historyExpandedId === session.id;
  const durationText = session.endAt ? formatDuration(getSessionDurationMs(session)) : `进行中 · ${formatDuration(getSessionDurationMs(session))}`;
  return `
    <article class="history-card ${expanded ? "expanded" : ""}">
      <button class="history-summary" type="button" data-history-toggle="${session.id}">
        <div class="history-row-top">
          <span class="history-title">${escapeHtml(project?.name || "未知项目")}</span>
          <span class="pill ${project?.actor === "agent" ? "gray" : ""}">${project?.actor === "self" ? "本人" : "Agent"}</span>
        </div>
        <div class="history-field-list">
          <div class="history-field">
            <span class="history-field-label">开始时间</span>
            <span class="history-field-value">${formatDateTime(session.startAt)}</span>
          </div>
          <div class="history-field">
            <span class="history-field-label">结束时间</span>
            <span class="history-field-value">${session.endAt ? formatDateTime(session.endAt) : "进行中"}</span>
          </div>
          <div class="history-field">
            <span class="history-field-label">耗时</span>
            <span class="history-field-value">${durationText}</span>
          </div>
          <div class="history-field">
            <span class="history-field-label">项目类型</span>
            <span class="history-field-value">${escapeHtml(type?.name || "未分类")}</span>
          </div>
        </div>
      </button>
      ${
        expanded
          ? `
            <div class="history-edit-grid">
              <label class="field-label" for="history-start-${session.id}">开始时间</label>
              <input id="history-start-${session.id}" type="datetime-local" value="${toLocalInputValue(session.startAt)}" />
              <label class="field-label" for="history-end-${session.id}">结束时间</label>
              <input id="history-end-${session.id}" type="datetime-local" value="${session.endAt ? toLocalInputValue(session.endAt) : ""}" />
              <label class="field-label" for="history-note-${session.id}">备注</label>
              <textarea id="history-note-${session.id}" placeholder="补充备注，让以后回看时看得懂">${escapeHtml(session.note || "")}</textarea>
              <button class="primary-button" type="button" data-save-history="${session.id}">保存修改</button>
            </div>
          `
          : ""
      }
    </article>
  `;
}

function renderDashboard() {
  const data = appStore.get();
  const period = uiState.dashboardPeriod;
  els.periodButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.period === period);
  });

  const metrics = buildDashboardMetrics(data, period);
  const breakdown = buildTypeBreakdown(data, period);
  const trend = buildTrend(data, period);

  els.dashboardMetrics.innerHTML = "";
  metrics.forEach((metric) => {
    const node = els.metricCardTemplate.content.cloneNode(true);
    node.querySelector(".metric-label").textContent = metric.label;
    node.querySelector(".metric-value").textContent = metric.value;
    node.querySelector(".metric-note").textContent = metric.note;
    els.dashboardMetrics.append(node);
  });

  els.dashboardTypeBreakdown.innerHTML = breakdown.length
    ? breakdown
        .map(
          (item) => `
            <article class="stack-card">
              <div class="admin-row">
                <strong>${escapeHtml(item.name)}</strong>
                <span class="muted">${formatDuration(item.duration)}</span>
              </div>
              <div class="bar-track"><div class="bar" style="width:${item.ratio}%"></div></div>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state">当前周期没有可展示的数据。</div>`;

  els.dashboardTrend.innerHTML = trend.length
    ? trend
        .map(
          (item) => `
            <article class="stack-card">
              <div class="admin-row">
                <strong>${item.label}</strong>
                <span class="muted">${formatDuration(item.duration)}</span>
              </div>
              <div class="bar-track"><div class="bar" style="width:${item.ratio}%"></div></div>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state">当前周期没有趋势数据。</div>`;
}

function renderManage() {
  const data = appStore.get();
  renderNickname(data);
  renderTypeSelectOptions(data);
  renderTypeList(data);
  renderProjectLists(data);
  updateManageForms();
}

function renderNickname(data) {
  const nickname = data.profile?.nickname || "";
  els.nicknameInput.value = nickname;
  els.nicknameHint.textContent = nickname ? `当前昵称：${nickname}` : "还没有设置昵称。";
}

function renderTypeSelectOptions(data) {
  const types = getActiveTypes(data);
  els.projectTypeSelect.innerHTML = types.length
    ? types.map((type) => `<option value="${type.id}">${escapeHtml(type.name)}</option>`).join("")
    : `<option value="">请先创建项目类型</option>`;
}

function renderTypeList(data) {
  if (!data.projectTypes.length) {
    els.typeList.innerHTML = `<div class="empty-state">还没有项目类型，先建一层骨架。</div>`;
    return;
  }

  els.typeList.innerHTML = data.projectTypes
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((type) => {
      const related = data.projects.filter((project) => project.typeId === type.id).length;
      return `
        <article class="stack-card">
          <div class="admin-row">
            <div>
              <strong>${escapeHtml(type.name)}</strong>
              <p class="muted">${related} 个具体项目</p>
            </div>
            <div class="admin-actions">
              <button class="inline-button" type="button" data-edit-type="${type.id}">编辑</button>
              <button class="inline-button warning" type="button" data-delete-type="${type.id}">删除</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  els.typeList.querySelectorAll("[data-edit-type]").forEach((button) => {
    button.addEventListener("click", () => {
      const dataNow = appStore.get();
      const type = findType(dataNow, button.dataset.editType);
      if (!type) {
        return;
      }
      uiState.typeEditId = type.id;
      els.typeNameInput.value = type.name;
      updateManageForms();
    });
  });

  els.typeList.querySelectorAll("[data-delete-type]").forEach((button) => {
    button.addEventListener("click", () => deleteType(button.dataset.deleteType));
  });
}

function renderProjectLists(data) {
  const activeProjects = data.projects.filter((project) => !project.archived);
  const archivedProjects = data.projects.filter((project) => project.archived);

  els.projectAdminList.innerHTML = activeProjects.length
    ? activeProjects
        .map((project) => renderProjectAdminCard(project, data, false))
        .join("")
    : `<div class="empty-state">还没有活跃具体项目。</div>`;

  els.archivedProjectList.classList.toggle("hidden", !uiState.showArchivedProjects);
  els.toggleArchivedButton.textContent = uiState.showArchivedProjects ? "收起已归档项目" : "查看已归档项目";
  els.archivedProjectList.innerHTML = archivedProjects.length
    ? archivedProjects
        .map((project) => renderProjectAdminCard(project, data, true))
        .join("")
    : `<div class="empty-state">还没有归档项目。</div>`;

  document.querySelectorAll("[data-edit-project]").forEach((button) => {
    button.addEventListener("click", () => {
      const dataNow = appStore.get();
      const project = findProject(dataNow, button.dataset.editProject);
      if (!project) {
        return;
      }
      uiState.projectEditId = project.id;
      els.projectNameInput.value = project.name;
      els.projectActorSelect.value = project.actor;
      els.projectTypeSelect.value = project.typeId;
      updateManageForms();
    });
  });

  document.querySelectorAll("[data-archive-project]").forEach((button) => {
    button.addEventListener("click", () => archiveProject(button.dataset.archiveProject));
  });
}

function renderProjectAdminCard(project, data, archived) {
  const type = findType(data, project.typeId);
  return `
    <article class="stack-card">
      <div class="admin-row">
        <div>
          <strong>${escapeHtml(project.name)}</strong>
          <p class="muted">${escapeHtml(type?.name || "未分类")} · ${project.actor === "self" ? "本人" : "Agent"} · ${archived ? "已归档" : "活跃"}</p>
        </div>
        <div class="admin-actions">
          ${archived ? "" : `<button class="inline-button" type="button" data-edit-project="${project.id}">编辑</button>`}
          ${archived ? "" : `<button class="inline-button warning" type="button" data-archive-project="${project.id}">归档</button>`}
        </div>
      </div>
    </article>
  `;
}

function updateManageForms() {
  els.typeSubmitButton.textContent = uiState.typeEditId ? "保存项目类型" : "新增项目类型";
  els.projectSubmitButton.textContent = uiState.projectEditId ? "保存具体项目" : "新增具体项目";
}

function handleNicknameSubmit(event) {
  event.preventDefault();
  const nickname = els.nicknameInput.value.trim();
  if (!nickname) {
    els.nicknameHint.textContent = "昵称不能为空。";
    return;
  }

  const data = appStore.get();
  data.profile = {
    ...(data.profile || {}),
    nickname,
  };
  appStore.save(data);
  renderManage();
}

function handleTypeSubmit(event) {
  event.preventDefault();
  const name = els.typeNameInput.value.trim();
  if (!name) {
    return;
  }

  const data = appStore.get();
  const duplicate = data.projectTypes.find((type) => type.name === name && type.id !== uiState.typeEditId);
  if (duplicate) {
    els.typeConstraintHint.textContent = "这个项目类型已经存在。";
    return;
  }

  els.typeConstraintHint.textContent = "";
  const now = new Date().toISOString();
  if (uiState.typeEditId) {
    data.projectTypes = data.projectTypes.map((type) => (type.id === uiState.typeEditId ? { ...type, name, updatedAt: now } : type));
    uiState.typeEditId = null;
  } else {
    data.projectTypes.push({
      id: createId(),
      name,
      sortOrder: data.projectTypes.length,
      createdAt: now,
      updatedAt: now,
    });
  }

  appStore.save(data);
  els.typeForm.reset();
  renderManage();
}

function handleProjectSubmit(event) {
  event.preventDefault();
  const name = els.projectNameInput.value.trim();
  const typeId = els.projectTypeSelect.value;
  const actor = els.projectActorSelect.value;
  if (!name || !typeId || !actor) {
    return;
  }

  const data = appStore.get();
  const duplicate = data.projects.find(
    (project) => !project.archived && project.typeId === typeId && project.name === name && project.id !== uiState.projectEditId,
  );
  if (duplicate) {
    window.alert("同一项目类型下已经有这个具体项目。");
    return;
  }

  const now = new Date().toISOString();
  if (uiState.projectEditId) {
    data.projects = data.projects.map((project) =>
      project.id === uiState.projectEditId ? { ...project, name, typeId, actor, updatedAt: now } : project,
    );
    uiState.projectEditId = null;
  } else {
    data.projects.unshift({
      id: createId(),
      typeId,
      name,
      actor,
      archived: false,
      archivedAt: null,
      usageCount: 0,
      lastUsedAt: null,
      sortOrder: data.projects.length,
      createdAt: now,
      updatedAt: now,
    });
  }

  appStore.save(data);
  els.projectForm.reset();
  renderManage();
  if (uiState.currentView === "home") {
    renderHome();
  }
}

function deleteType(typeId) {
  const data = appStore.get();
  const relatedProjects = data.projects.filter((project) => project.typeId === typeId);
  if (relatedProjects.length) {
    els.typeConstraintHint.textContent = "删除受限：这个项目类型下面还有具体项目，先处理具体项目再删。";
    return;
  }

  data.projectTypes = data.projectTypes.filter((type) => type.id !== typeId);
  appStore.save(data);
  renderManage();
}

function archiveProject(projectId) {
  const data = appStore.get();
  const running = data.sessions.find((session) => session.projectId === projectId && !session.endAt);
  if (running) {
    window.alert("这个项目还有进行中的任务，先停止再归档。");
    return;
  }

  const now = new Date().toISOString();
  data.projects = data.projects.map((project) =>
    project.id === projectId ? { ...project, archived: true, archivedAt: now, updatedAt: now } : project,
  );
  appStore.save(data);
  render();
}

function handleQuickCreateSubmit(shouldStart) {
  const name = document.querySelector("#quickCreateName").value.trim();
  const typeId = document.querySelector("#quickCreateType").value;
  const actor = document.querySelector("#quickCreateActor").value;
  if (!name || !typeId || !actor) {
    return;
  }

  const data = appStore.get();
  const duplicate = data.projects.find(
    (project) => !project.archived && project.typeId === typeId && project.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) {
    window.alert("同一项目类型下已经有这个具体项目。");
    return;
  }

  const now = new Date().toISOString();
  const newProject = {
    id: createId(),
    typeId,
    name,
    actor,
    archived: false,
    archivedAt: null,
    usageCount: 0,
    lastUsedAt: null,
    sortOrder: data.projects.length,
    createdAt: now,
    updatedAt: now,
  };
  data.projects.unshift(newProject);
  appStore.save(data);

  if (shouldStart) {
    uiState.projectSearch = "";
    els.projectSearch.value = "";
    startProject(newProject.id);
    return;
  }

  uiState.projectSearch = "";
  els.projectSearch.value = "";
  render();
}

function startProject(projectId) {
  const data = appStore.get();
  const project = findProject(data, projectId);
  if (!project || project.archived) {
    return;
  }

  const now = new Date().toISOString();
  if (project.actor === "self") {
    data.sessions = data.sessions.map((session) => {
      const sessionProject = findProject(data, session.projectId);
      if (!session.endAt && sessionProject?.actor === "self") {
        return { ...session, endAt: now, durationMs: new Date(now).getTime() - new Date(session.startAt).getTime(), updatedAt: now };
      }
      return session;
    });
  }

  data.sessions.unshift({
    id: createId(),
    projectId,
    startAt: now,
    endAt: null,
    note: "",
    durationMs: null,
    createdAt: now,
    updatedAt: now,
  });

  data.projects = data.projects.map((item) =>
    item.id === projectId ? { ...item, usageCount: (item.usageCount || 0) + 1, lastUsedAt: now, updatedAt: now } : item,
  );

  appStore.save(data);
  uiState.currentView = "home";
  render();
}

function stopSession(sessionId) {
  const data = appStore.get();
  const now = new Date().toISOString();
  data.sessions = data.sessions.map((session) =>
    session.id === sessionId && !session.endAt
      ? { ...session, endAt: now, durationMs: new Date(now).getTime() - new Date(session.startAt).getTime(), updatedAt: now }
      : session,
  );
  appStore.save(data);
  render();
}

function saveHistoryEdit(sessionId) {
  const startInput = document.querySelector(`#history-start-${CSS.escape(sessionId)}`);
  const endInput = document.querySelector(`#history-end-${CSS.escape(sessionId)}`);
  const noteInput = document.querySelector(`#history-note-${CSS.escape(sessionId)}`);
  if (!startInput || !endInput || !noteInput) {
    return;
  }

  const startAt = new Date(startInput.value).toISOString();
  const endAt = endInput.value ? new Date(endInput.value).toISOString() : null;
  if (endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
    window.alert("结束时间不能早于开始时间。");
    return;
  }
  if (endAt && new Date(endAt).getTime() > Date.now()) {
    window.alert("第一版不允许保存未来结束时间。");
    return;
  }

  const data = appStore.get();
  const target = data.sessions.find((session) => session.id === sessionId);
  if (!target) {
    return;
  }
  const targetProject = findProject(data, target.projectId);
  if (targetProject?.actor === "self" && !endAt) {
    const otherRunningSelf = data.sessions.find((session) => session.id !== sessionId && !session.endAt && findProject(data, session.projectId)?.actor === "self");
    if (otherRunningSelf) {
      window.alert("不能制造多个进行中的本人任务。");
      return;
    }
  }

  const now = new Date().toISOString();
  data.sessions = data.sessions.map((session) =>
    session.id === sessionId
      ? {
          ...session,
          startAt,
          endAt,
          note: noteInput.value.trim(),
          durationMs: endAt ? new Date(endAt).getTime() - new Date(startAt).getTime() : null,
          updatedAt: now,
        }
      : session,
  );
  appStore.save(data);
  render();
}

function sortProjects(projects, mode) {
  const sorted = [...projects];
  if (mode === "frequent") {
    return sorted.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0) || compareDateDesc(a.lastUsedAt, b.lastUsedAt));
  }
  return sorted.sort((a, b) => compareDateDesc(a.lastUsedAt, b.lastUsedAt) || (b.usageCount || 0) - (a.usageCount || 0));
}

function sortSessions(sessions, mode) {
  const sorted = [...sessions];
  if (mode === "asc") {
    return sorted.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }
  if (mode === "desc") {
    return sorted.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }
  return sorted.sort((a, b) => getSessionDurationMs(b) - getSessionDurationMs(a));
}

function filterHistorySessions(sessions, data, projectQuery, dateMode, dateQuery) {
  const normalizedProjectQuery = projectQuery.toLowerCase();
  return sessions.filter((session) => {
    const project = findProject(data, session.projectId);
    const matchesProject = !normalizedProjectQuery || (project?.name || "").toLowerCase().includes(normalizedProjectQuery);
    const matchesDate = matchesHistoryDate(session, dateMode, dateQuery);
    return matchesProject && matchesDate;
  });
}

function filterHistoryByStatus(sessions, statusFilter) {
  if (statusFilter === "running") {
    return sessions.filter((session) => !session.endAt);
  }

  if (statusFilter === "completed") {
    return sessions.filter((session) => Boolean(session.endAt));
  }

  return sessions;
}

function matchesHistoryDate(session, dateMode, dateQuery) {
  if (dateMode === "all" || !dateQuery) {
    return true;
  }

  const start = new Date(session.startAt);
  const end = session.endAt ? new Date(session.endAt) : null;

  if (dateMode === "day") {
    return dateKey(start) === dateQuery || (end ? dateKey(end) === dateQuery : false);
  }

  if (dateMode === "week") {
    const [yearPart, weekPart] = dateQuery.split("-W");
    const weekYear = Number(yearPart);
    const weekNumber = Number(weekPart);
    return isInIsoWeek(start, weekYear, weekNumber) || (end ? isInIsoWeek(end, weekYear, weekNumber) : false);
  }

  if (dateMode === "month") {
    const [yearPart, monthPart] = dateQuery.split("-");
    return isInYearMonth(start, Number(yearPart), Number(monthPart)) || (end ? isInYearMonth(end, Number(yearPart), Number(monthPart)) : false);
  }

  if (dateMode === "year") {
    const year = Number(dateQuery);
    return start.getFullYear() === year || (end ? end.getFullYear() === year : false);
  }

  return true;
}

function isInYearMonth(date, year, month) {
  return date.getFullYear() === year && date.getMonth() + 1 === month;
}

function isInIsoWeek(date, targetYear, targetWeek) {
  const { year, week } = getIsoWeekInfo(date);
  return year === targetYear && week === targetWeek;
}

function getIsoWeekInfo(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return {
    year: target.getUTCFullYear(),
    week,
  };
}

function buildDashboardMetrics(data, period) {
  const scoped = getSessionsForPeriod(data, period);
  const selfSessions = scoped.filter((session) => findProject(data, session.projectId)?.actor === "self");
  const agentSessions = scoped.filter((session) => findProject(data, session.projectId)?.actor === "agent");
  return [
    { label: "当前周期本人投入", value: formatDuration(sumDurations(selfSessions)), note: "只统计已结束或当前进行中的本人任务。" },
    { label: "当前周期 Agent 耗时", value: formatDuration(sumDurations(agentSessions)), note: "独立于本人时间展示。" },
    { label: "当前周期记录数", value: `${scoped.length}`, note: "当前周期内的全部任务记录数。" },
    { label: "当前周期进行中", value: `${scoped.filter((session) => !session.endAt).length}`, note: "尚未结束的记录。" },
  ];
}

function buildTypeBreakdown(data, period) {
  const scoped = getSessionsForPeriod(data, period);
  const totals = new Map();
  scoped.forEach((session) => {
    const project = findProject(data, session.projectId);
    const type = findType(data, project?.typeId);
    const key = type?.name || "未分类";
    totals.set(key, (totals.get(key) || 0) + getSessionDurationMs(session));
  });
  const totalDuration = [...totals.values()].reduce((sum, value) => sum + value, 0) || 1;
  return [...totals.entries()]
    .map(([name, duration]) => ({ name, duration, ratio: Math.round((duration / totalDuration) * 100) }))
    .sort((a, b) => b.duration - a.duration);
}

function buildTrend(data, period) {
  const buckets = getTrendBuckets(period);
  const results = buckets.map((bucket) => {
    const duration = data.sessions.reduce((sum, session) => {
      return isSessionInBucket(session, bucket) ? sum + getSessionDurationMs(session) : sum;
    }, 0);
    return { label: bucket.label, duration };
  });
  const max = Math.max(...results.map((item) => item.duration), 1);
  return results.map((item) => ({ ...item, ratio: Math.round((item.duration / max) * 100) }));
}

function getSessionsForPeriod(data, period) {
  const now = new Date();
  return data.sessions.filter((session) => {
    const start = new Date(session.startAt);
    if (period === "day") {
      return dateKey(start) === dateKey(now);
    }
    if (period === "week") {
      return start >= startOfWeek(now);
    }
    return start >= startOfMonth(now);
  });
}

function getTrendBuckets(period) {
  const now = new Date();
  if (period === "day") {
    return [
      { label: "00-06", start: setTodayHour(0), end: setTodayHour(6) },
      { label: "06-12", start: setTodayHour(6), end: setTodayHour(12) },
      { label: "12-18", start: setTodayHour(12), end: setTodayHour(18) },
      { label: "18-24", start: setTodayHour(18), end: setTodayHour(24) },
    ];
  }
  if (period === "week") {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      return { label: `${date.getMonth() + 1}/${date.getDate()}`, start: dayStart, end: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) };
    });
  }
  return Array.from({ length: 4 }, (_, index) => {
    const end = new Date(now);
    end.setDate(now.getDate() - index * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 7);
    return { label: `近第 ${4 - index} 周`, start, end };
  }).reverse();
}

function isSessionInBucket(session, bucket) {
  const start = new Date(session.startAt);
  return start >= bucket.start && start < bucket.end;
}

function getVisibleProjects(data) {
  return data.projects.filter((project) => !project.archived);
}

function getActiveTypes(data) {
  return data.projectTypes;
}

function filterProjects(projects, query, data) {
  if (!query) {
    return projects;
  }
  const normalized = query.toLowerCase();
  return projects.filter((project) => {
    const typeName = findType(data, project.typeId)?.name || "";
    const actorText = project.actor === "self" ? "本人" : "agent";
    return [project.name, typeName, actorText].some((value) => String(value).toLowerCase().includes(normalized));
  });
}

function getRunningSelfSession(data) {
  return data.sessions.find((session) => !session.endAt && findProject(data, session.projectId)?.actor === "self");
}

function getRunningAgentSessions(data) {
  return data.sessions.filter((session) => !session.endAt && findProject(data, session.projectId)?.actor === "agent");
}

function findProject(data, projectId) {
  return data.projects.find((project) => project.id === projectId);
}

function findType(data, typeId) {
  return data.projectTypes.find((type) => type.id === typeId);
}

function getSessionDurationMs(session) {
  if (session.durationMs != null && session.endAt) {
    return session.durationMs;
  }
  const end = session.endAt ? new Date(session.endAt).getTime() : Date.now();
  return Math.max(0, end - new Date(session.startAt).getTime());
}

function sumDurations(sessions) {
  return sessions.reduce((sum, session) => sum + getSessionDurationMs(session), 0);
}

function compareDateDesc(a, b) {
  return new Date(b || 0).getTime() - new Date(a || 0).getTime();
}

function startTimer() {
  clearInterval(timerHandle);
  timerHandle = window.setInterval(() => {
    const data = appStore.get();
    if (getRunningSelfSession(data) || getRunningAgentSessions(data).length) {
      const activeElement = document.activeElement;
      const activeTag = activeElement?.tagName;
      const activeId = activeElement?.id || "";
      const isEditingHomeSearch =
        uiState.currentView === "home" &&
        (activeTag === "INPUT" || activeTag === "SELECT" || activeTag === "TEXTAREA") &&
        (activeId.startsWith("quickCreate") || activeId === "projectSearch");
      if (isEditingHomeSearch) {
        return;
      }
      const isEditingHistory =
        uiState.currentView === "history" &&
        uiState.historyExpandedId &&
        (activeTag === "TEXTAREA" || activeTag === "INPUT");
      if (isEditingHistory) {
        return;
      }
      if (uiState.currentView === "home") {
        renderHome();
      } else if (uiState.currentView === "history") {
        renderHistory();
      } else if (uiState.currentView === "dashboard") {
        renderDashboard();
      }
    }
  }, 1000);
}

function ensureSeedData() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    appStore.reset();
  }
}

function createSeedData() {
  const now = Date.now();
  const typeLifeId = createId();
  const typeWorkId = createId();
  const typeLearnId = createId();
  const selfWalkId = createId();
  const selfReadingId = createId();
  const selfDesignId = createId();
  const agentTrainId = createId();
  const agentExportId = createId();
  const currentIso = new Date(now).toISOString();

  return {
    version: 1,
    updatedAt: currentIso,
    profile: {
      nickname: "曦哥",
    },
    projectTypes: [
      { id: typeLifeId, name: "生活", sortOrder: 0, createdAt: isoOffset(now, -10), updatedAt: isoOffset(now, -10) },
      { id: typeWorkId, name: "工作", sortOrder: 1, createdAt: isoOffset(now, -9), updatedAt: isoOffset(now, -9) },
      { id: typeLearnId, name: "学习", sortOrder: 2, createdAt: isoOffset(now, -8), updatedAt: isoOffset(now, -8) },
    ],
    projects: [
      { id: selfWalkId, name: "散步", typeId: typeLifeId, actor: "self", archived: false, archivedAt: null, usageCount: 6, lastUsedAt: isoOffset(now, -3), sortOrder: 0, createdAt: isoOffset(now, -7), updatedAt: isoOffset(now, -3) },
      { id: selfReadingId, name: "阅读", typeId: typeLearnId, actor: "self", archived: false, archivedAt: null, usageCount: 11, lastUsedAt: isoOffset(now, -20), sortOrder: 1, createdAt: isoOffset(now, -6), updatedAt: isoOffset(now, -20) },
      { id: selfDesignId, name: "产品设计", typeId: typeWorkId, actor: "self", archived: false, archivedAt: null, usageCount: 9, lastUsedAt: isoOffset(now, -26), sortOrder: 2, createdAt: isoOffset(now, -5), updatedAt: isoOffset(now, -26) },
      { id: agentTrainId, name: "跑训练", typeId: typeWorkId, actor: "agent", archived: false, archivedAt: null, usageCount: 8, lastUsedAt: isoOffset(now, -4), sortOrder: 3, createdAt: isoOffset(now, -4), updatedAt: isoOffset(now, -4) },
      { id: agentExportId, name: "批量导出", typeId: typeWorkId, actor: "agent", archived: true, archivedAt: isoOffset(now, -12), usageCount: 4, lastUsedAt: isoOffset(now, -52), sortOrder: 4, createdAt: isoOffset(now, -3), updatedAt: isoOffset(now, -12) },
    ],
    sessions: [
      { id: createId(), projectId: selfWalkId, startAt: isoOffset(now, -3), endAt: isoOffset(now, -2.5), note: "走了一圈，脑子清了一点。", durationMs: 30 * 60 * 1000, createdAt: isoOffset(now, -3), updatedAt: isoOffset(now, -2.5) },
      { id: createId(), projectId: agentTrainId, startAt: isoOffset(now, -1.5), endAt: null, note: "", durationMs: null, createdAt: isoOffset(now, -1.5), updatedAt: isoOffset(now, -1.5) },
      { id: createId(), projectId: selfReadingId, startAt: isoOffset(now, -26), endAt: isoOffset(now, -25.25), note: "读了一章，标了几个点。", durationMs: 45 * 60 * 1000, createdAt: isoOffset(now, -26), updatedAt: isoOffset(now, -25.25) },
      { id: createId(), projectId: selfDesignId, startAt: isoOffset(now, -0.66), endAt: null, note: "", durationMs: null, createdAt: isoOffset(now, -0.66), updatedAt: isoOffset(now, -0.66) },
      { id: createId(), projectId: agentExportId, startAt: isoOffset(now, -52), endAt: isoOffset(now, -51.2), note: "导出样本做比对。", durationMs: 48 * 60 * 1000, createdAt: isoOffset(now, -52), updatedAt: isoOffset(now, -51.2) },
    ],
  };
}

function isoOffset(nowMs, offsetHours) {
  return new Date(nowMs + offsetHours * 60 * 60 * 1000).toISOString();
}

function formatDateTime(isoString) {
  const date = new Date(isoString);
  return `${dateKey(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${pad(minutes)}m` : `${minutes}m`;
}

function formatRelativeTime(isoString) {
  const diffMinutes = Math.max(0, Math.round((Date.now() - new Date(isoString).getTime()) / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }
  return `${Math.floor(diffHours / 24)} 天前`;
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day + 1);
  return copy;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function setTodayHour(hour) {
  const date = new Date();
  if (hour === 24) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour);
}

function toLocalInputValue(isoString) {
  const date = new Date(isoString);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
