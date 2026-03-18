const STORAGE_KEY = "time-ledger-mobile-demo-v4";
const AGENT_API_BASE = "http://127.0.0.1:8787/api";

const uiState = {
  currentView: "home",
  projectSortMode: "recent",
  projectSearch: "",
  historySortMode: "duration",
  historyProjectSearch: "",
  historyDateMode: "all",
  historyDateSearch: "",
  historyStatusFilter: "all",
  dashboardRange: "7d",
  dashboardChartMode: "line",
  dashboardSelectedPointIndex: null,
  dashboardTypeBreakdownExpanded: false,
  historyExpandedId: null,
  manageExpandedSection: null,
  manageNicknameEditing: false,
  dashboardSettingsEditMode: false,
  typeEditId: null,
  projectEditId: null,
  showTypeCreate: false,
  showProjectCreate: false,
  showArchivedProjects: false,
  confirmDialog: null,
};

const els = {
  views: document.querySelectorAll(".view"),
  navItems: document.querySelectorAll(".nav-item"),
  networkBanner: document.querySelector("#networkBanner"),
  updateBanner: document.querySelector("#updateBanner"),
  applyUpdateButton: document.querySelector("#applyUpdateButton"),
  confirmModal: document.querySelector("#confirmModal"),
  confirmBackdrop: document.querySelector("#confirmBackdrop"),
  confirmTitle: document.querySelector("#confirmTitle"),
  confirmMessage: document.querySelector("#confirmMessage"),
  confirmCancelButton: document.querySelector("#confirmCancelButton"),
  confirmAcceptButton: document.querySelector("#confirmAcceptButton"),
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
  dashboardDebtHero: document.querySelector("#dashboardDebtHero"),
  dashboardTodayProgress: document.querySelector("#dashboardTodayProgress"),
  dashboardTypeBreakdown: document.querySelector("#dashboardTypeBreakdown"),
  dashboardTrend: document.querySelector("#dashboardTrend"),
  dashboardRangeButtons: document.querySelectorAll(".dashboard-range-button"),
  dashboardModeButtons: document.querySelectorAll(".dashboard-mode-button"),
  dashboardTypeToggle: document.querySelector("#dashboardTypeToggle"),
  dashboardTypeToggleLabel: document.querySelector("#dashboardTypeToggleLabel"),
  manageNicknameForm: document.querySelector("#manageNicknameForm"),
  manageTitleInput: document.querySelector("#manageTitleInput"),
  manageTitleConfirmButton: document.querySelector("#manageTitleConfirmButton"),
  manageTitleHint: document.querySelector("#manageTitleHint"),
  manageNavLabel: document.querySelector("#manageNavLabel"),
  dashboardSettingsToggle: document.querySelector("#dashboardSettingsToggle"),
  dashboardSettingsSection: document.querySelector("#dashboardSettingsSection"),
  dashboardSettingsForm: document.querySelector("#dashboardSettingsForm"),
  dashboardSettingsActionButton: document.querySelector("#dashboardSettingsActionButton"),
  dashboardSettingsCancelButton: document.querySelector("#dashboardSettingsCancelButton"),
  dashboardTargetHoursInput: document.querySelector("#dashboardTargetHoursInput"),
  dashboardHourlyRateInput: document.querySelector("#dashboardHourlyRateInput"),
  dashboardDebtStartDateInput: document.querySelector("#dashboardDebtStartDateInput"),
  dashboardSettingsHint: document.querySelector("#dashboardSettingsHint"),
  typeSectionToggle: document.querySelector("#typeSectionToggle"),
  typeSection: document.querySelector("#typeSection"),
  toggleTypeCreateButton: document.querySelector("#toggleTypeCreateButton"),
  typeForm: document.querySelector("#typeForm"),
  typeNameInput: document.querySelector("#typeNameInput"),
  typeConstraintHint: document.querySelector("#typeConstraintHint"),
  typeList: document.querySelector("#typeList"),
  projectSectionToggle: document.querySelector("#projectSectionToggle"),
  projectSection: document.querySelector("#projectSection"),
  toggleProjectCreateButton: document.querySelector("#toggleProjectCreateButton"),
  projectForm: document.querySelector("#projectForm"),
  projectTypeSelect: document.querySelector("#projectTypeSelect"),
  projectNameInput: document.querySelector("#projectNameInput"),
  projectActorSelect: document.querySelector("#projectActorSelect"),
  toggleArchivedButton: document.querySelector("#toggleArchivedButton"),
  projectAdminList: document.querySelector("#projectAdminList"),
  archivedProjectList: document.querySelector("#archivedProjectList"),
  recentModeButton: document.querySelector("#recentModeButton"),
  frequentModeButton: document.querySelector("#frequentModeButton"),
};

const appStore = {
  get() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeData(raw ? JSON.parse(raw) : createSeedData());
  },
  save(nextData) {
    nextData.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
    void syncStateToAgentApi(normalizeData(nextData));
  },
  reset() {
    const seed = createSeedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    void syncStateToAgentApi(seed);
  },
};

function normalizeData(data) {
  const nextData = { ...data };
  nextData.profile = nextData.profile || { nickname: "", motto: "" };
  nextData.projectTypes = nextData.projectTypes || [];
  nextData.projects = nextData.projects || [];
  nextData.sessions = nextData.sessions || [];
  nextData.dashboardSettings = normalizeDashboardSettings(nextData.dashboardSettings);
  return nextData;
}

function normalizeDashboardSettings(settings) {
  const today = dateKey(new Date());
  const debtStartDate = settings?.debtStartDate;
  return {
    dailyTargetHours: Number(settings?.dailyTargetHours) > 0 ? Number(settings.dailyTargetHours) : 8,
    hourlyRate: Number(settings?.hourlyRate) >= 0 ? Number(settings.hourlyRate) : 100,
    debtStartDate: typeof debtStartDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(debtStartDate) ? debtStartDate : today,
  };
}

let timerHandle = null;
let pendingServiceWorker = null;
let agentSyncTimerHandle = null;
const DASHBOARD_TYPE_COLORS = ["#2f7dff", "#4dbf92", "#f3a446", "#db6c86", "#6f7de6", "#8bb8ff"];

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `tempo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

void init();

async function init() {
  ensureSeedData();
  await hydrateStateFromAgentApi();
  bindEvents();
  syncNetworkBanner(navigator.onLine);
  registerServiceWorker();
  render();
  startTimer();
  startAgentSyncTimer();
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

  els.dashboardRangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      uiState.dashboardRange = button.dataset.range;
      renderDashboard();
    });
  });
  els.dashboardModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      uiState.dashboardChartMode = button.dataset.chartMode;
      renderDashboard();
    });
  });
  els.dashboardTypeToggle.addEventListener("click", () => {
    uiState.dashboardTypeBreakdownExpanded = !uiState.dashboardTypeBreakdownExpanded;
    renderDashboard();
  });

  els.manageNicknameForm.addEventListener("submit", handleManageNicknameSubmit);
  els.manageTitleInput.addEventListener("focus", handleManageNicknameFocus);
  els.manageTitleInput.addEventListener("blur", handleManageNicknameBlur);
  els.dashboardSettingsToggle.addEventListener("click", () => toggleManageSection("dashboard"));
  els.typeSectionToggle.addEventListener("click", () => toggleManageSection("type"));
  els.projectSectionToggle.addEventListener("click", () => toggleManageSection("project"));
  els.dashboardSettingsForm.addEventListener("submit", handleDashboardSettingsSubmit);
  els.dashboardSettingsCancelButton.addEventListener("click", cancelDashboardSettingsEdit);
  els.dashboardSettingsActionButton.addEventListener("click", handleDashboardSettingsAction);
  els.dashboardTargetHoursInput.addEventListener("input", syncDashboardSettingsActionButton);
  els.dashboardHourlyRateInput.addEventListener("input", syncDashboardSettingsActionButton);
  els.dashboardDebtStartDateInput.addEventListener("input", syncDashboardSettingsActionButton);
  els.typeForm.addEventListener("submit", handleTypeSubmit);
  els.projectForm.addEventListener("submit", handleProjectSubmit);
  els.toggleTypeCreateButton.addEventListener("click", () => {
    uiState.showTypeCreate = !uiState.showTypeCreate;
    if (!uiState.showTypeCreate) {
      els.typeForm.reset();
      els.typeConstraintHint.textContent = "";
    }
    renderManage();
  });
  els.toggleProjectCreateButton.addEventListener("click", () => {
    uiState.showProjectCreate = !uiState.showProjectCreate;
    if (!uiState.showProjectCreate) {
      els.projectForm.reset();
    }
    renderManage();
  });
  els.toggleArchivedButton.addEventListener("click", () => {
    uiState.showArchivedProjects = !uiState.showArchivedProjects;
    renderManage();
  });

  window.addEventListener("online", () => syncNetworkBanner(true));
  window.addEventListener("offline", () => syncNetworkBanner(false));
  els.applyUpdateButton.addEventListener("click", applyPendingUpdate);
  els.confirmBackdrop.addEventListener("click", closeConfirmDialog);
  els.confirmCancelButton.addEventListener("click", closeConfirmDialog);
  els.confirmAcceptButton.addEventListener("click", runConfirmDialog);
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

  if (isLocalDevHost()) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });

    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys
          .filter((key) => key.startsWith("tempo-demo-"))
          .forEach((key) => caches.delete(key));
      });
    }
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((registration) => {
      registration.update();

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

function isLocalDevHost() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
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

function openConfirmDialog({ title, message, confirmText = "确认", confirmVariant = "danger", onConfirm }) {
  uiState.confirmDialog = { onConfirm };
  els.confirmTitle.textContent = title;
  els.confirmMessage.textContent = message;
  els.confirmAcceptButton.textContent = confirmText;
  els.confirmAcceptButton.classList.toggle("danger", confirmVariant === "danger");
  els.confirmModal.classList.remove("hidden");
  els.confirmModal.setAttribute("aria-hidden", "false");
}

function closeConfirmDialog() {
  uiState.confirmDialog = null;
  els.confirmModal.classList.add("hidden");
  els.confirmModal.setAttribute("aria-hidden", "true");
}

function runConfirmDialog() {
  const pending = uiState.confirmDialog;
  closeConfirmDialog();
  pending?.onConfirm?.();
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
    els.searchFeedback.innerHTML = "";
    return;
  }

  const directStartButton = filteredProjects.length === 1
    ? `<button id="startSearchResultButton" class="inline-button" type="button">直接开始</button>`
    : "";

  els.searchFeedback.innerHTML = directStartButton;

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
    els.homeEmptyCreate.innerHTML = "";
    return;
  }

  if (filteredProjects.length) {
    els.homeEmptyCreate.innerHTML = "";
    return;
  }

  if (!types.length) {
    els.homeEmptyCreate.innerHTML = "";
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
  els.historySummary.innerHTML = `
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
  els.historyList.querySelectorAll("[data-history-summary]").forEach((card) => {
    const toggle = () => {
      uiState.historyExpandedId = uiState.historyExpandedId === card.dataset.historySummary ? null : card.dataset.historySummary;
      renderHistory();
    };
    card.addEventListener("click", toggle);

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
    });
  });
  els.historyList.querySelectorAll(".history-edit-grid").forEach((panel) => {
    panel.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });
  els.historyList.querySelectorAll("[data-history-collapse]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      collapseHistoryCard(button.dataset.historyCollapse);
    });
  });
  els.historyList.querySelectorAll("[data-history-edit-input]").forEach((field) => {
    field.addEventListener("input", () => syncHistoryActionButton(field.dataset.historyEditInput));
    field.addEventListener("change", () => syncHistoryActionButton(field.dataset.historyEditInput));
  });
  els.historyList.querySelectorAll("[data-history-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleHistoryAction(button.dataset.historyAction);
    });
  });
  if (uiState.historyExpandedId) {
    syncHistoryActionButton(uiState.historyExpandedId);
  }
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
      <div class="history-summary" role="button" tabindex="0" data-history-summary="${session.id}">
        <div class="history-row-top">
          <span class="history-title">${escapeHtml(project?.name || "未知项目")}</span>
          <span class="pill ${project?.actor === "agent" ? "gray" : ""}">${project?.actor === "self" ? "本人" : "Agent"}</span>
        </div>
        ${
          expanded
            ? ""
            : `
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
            `
        }
      </div>
      ${
        expanded
          ? `
            <div class="history-edit-grid">
              <div class="history-edit-meta-row">
                <button class="history-field history-collapse-trigger" type="button" data-history-collapse="${session.id}">
                  <span class="history-field-label">项目类型</span>
                  <span class="history-field-value">${escapeHtml(type?.name || "未分类")}</span>
                </button>
                <button class="history-field history-collapse-trigger" type="button" data-history-collapse="${session.id}">
                  <span class="history-field-label">执行主体</span>
                  <span class="history-field-value">${project?.actor === "self" ? "本人" : "Agent"}</span>
                </button>
              </div>
              <label class="field-label" for="history-start-${session.id}">开始时间</label>
              <input id="history-start-${session.id}" type="datetime-local" value="${toLocalInputValue(session.startAt)}" data-history-edit-input="${session.id}" />
              <label class="field-label" for="history-end-${session.id}">结束时间</label>
              <input id="history-end-${session.id}" type="datetime-local" value="${session.endAt ? toLocalInputValue(session.endAt) : ""}" data-history-edit-input="${session.id}" />
              <label class="field-label" for="history-note-${session.id}">备注</label>
              <textarea id="history-note-${session.id}" placeholder="补充备注，让以后回看时看得懂" data-history-edit-input="${session.id}">${escapeHtml(session.note || "")}</textarea>
              <button class="pill gray history-action-button" type="button" data-history-action="${session.id}">取消</button>
            </div>
          `
          : ""
      }
    </article>
  `;
}

function renderDashboard() {
  const data = appStore.get();
  const settings = getDashboardSettings(data);
  const dashboardData = buildDashboardViewModel(data, settings, uiState.dashboardRange);
  const selectedIndex = clampDashboardSelectedPointIndex(dashboardData.trendSeries.length);

  els.dashboardRangeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.range === uiState.dashboardRange);
  });
  els.dashboardModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.chartMode === uiState.dashboardChartMode);
  });

  els.dashboardDebtHero.innerHTML = renderDashboardDebtHero(dashboardData, settings);
  els.dashboardTodayProgress.innerHTML = renderDashboardTodayProgress(dashboardData, settings);
  els.dashboardTrend.innerHTML = renderDashboardTrend(dashboardData, settings, uiState.dashboardChartMode, selectedIndex);
  bindDashboardTrendInteractions();

  els.dashboardTypeToggle.setAttribute("aria-expanded", String(uiState.dashboardTypeBreakdownExpanded));
  els.dashboardTypeToggleLabel.textContent = uiState.dashboardTypeBreakdownExpanded ? "收起" : "展开";
  els.dashboardTypeBreakdown.classList.toggle("hidden", !uiState.dashboardTypeBreakdownExpanded);
  els.dashboardTypeBreakdown.innerHTML = uiState.dashboardTypeBreakdownExpanded
    ? renderDashboardTypeBreakdown(dashboardData)
    : "";
}

function clampDashboardSelectedPointIndex(length) {
  if (!length) {
    uiState.dashboardSelectedPointIndex = null;
    return null;
  }

  if (uiState.dashboardSelectedPointIndex == null || uiState.dashboardSelectedPointIndex >= length) {
    uiState.dashboardSelectedPointIndex = length - 1;
  }

  return uiState.dashboardSelectedPointIndex;
}

function renderManage() {
  const data = appStore.get();
  renderManageIdentity(data);
  syncManageSections();
  renderDashboardSettings(data);
  renderTypeSelectOptions(data);
  syncManageCreatePanels();
  renderTypeList(data);
  renderProjectLists(data);
}

function syncManageSections() {
  const sectionEntries = [
    ["dashboard", els.dashboardSettingsToggle, els.dashboardSettingsSection],
    ["type", els.typeSectionToggle, els.typeSection],
    ["project", els.projectSectionToggle, els.projectSection],
  ];

  sectionEntries.forEach(([section, toggle, panel]) => {
    const expanded = uiState.manageExpandedSection === section;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.classList.toggle("is-expanded", expanded);
    panel.classList.toggle("hidden", !expanded);
  });
}

function syncManageCreatePanels() {
  els.typeForm.classList.toggle("hidden", !uiState.showTypeCreate);
  els.projectForm.classList.toggle("hidden", !uiState.showProjectCreate);
  els.toggleTypeCreateButton.textContent = uiState.showTypeCreate ? "收起新增项目类型" : "新增项目类型";
  els.toggleProjectCreateButton.textContent = uiState.showProjectCreate ? "收起新增具体项目" : "新增具体项目";
}

function renderManageIdentity(data) {
  const nickname = data.profile?.nickname || "";
  els.manageNavLabel.textContent = nickname || "我";
  if (document.activeElement !== els.manageTitleInput) {
    els.manageTitleInput.value = nickname || "";
  }
  els.manageNicknameForm.classList.toggle("is-editing", uiState.manageNicknameEditing);
  els.manageTitleConfirmButton.classList.toggle("hidden", !uiState.manageNicknameEditing);
}

function renderDashboardSettings(data) {
  const settings = getDashboardSettings(data);
  els.dashboardTargetHoursInput.value = String(settings.dailyTargetHours);
  els.dashboardHourlyRateInput.value = String(settings.hourlyRate);
  els.dashboardDebtStartDateInput.value = settings.debtStartDate;
  const disabled = !uiState.dashboardSettingsEditMode;
  els.dashboardTargetHoursInput.disabled = disabled;
  els.dashboardHourlyRateInput.disabled = disabled;
  els.dashboardDebtStartDateInput.disabled = disabled;
  els.dashboardSettingsHint.textContent = `起算日 ${settings.debtStartDate} 起，每天按 ${settings.dailyTargetHours} 小时、时薪 ${settings.hourlyRate} 元累计。`;
  syncDashboardSettingsActionButton();
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
      const isEditing = uiState.typeEditId === type.id;
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
          ${
            isEditing
              ? `
                <div class="inline-edit-panel">
                  <label class="field-label" for="inline-type-name-${type.id}">编辑项目类型</label>
                  <input id="inline-type-name-${type.id}" type="text" value="${escapeHtml(type.name)}" />
                  <div class="admin-actions">
                    <button class="primary-button" type="button" data-save-type="${type.id}" disabled>保存</button>
                  </div>
                </div>
              `
              : ""
          }
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
      uiState.typeEditId = uiState.typeEditId === type.id ? null : type.id;
      renderManage();
    });
  });

  els.typeList.querySelectorAll("[data-delete-type]").forEach((button) => {
    button.addEventListener("click", () => deleteType(button.dataset.deleteType));
  });

  els.typeList.querySelectorAll("[data-save-type]").forEach((button) => {
    button.addEventListener("click", () => saveInlineTypeEdit(button.dataset.saveType));
  });

  els.typeList.querySelectorAll("[data-edit-type]").forEach((button) => {
    syncInlineTypeSaveState(button.dataset.editType);
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
      uiState.projectEditId = uiState.projectEditId === project.id ? null : project.id;
      renderManage();
    });
  });

  document.querySelectorAll("[data-archive-project]").forEach((button) => {
    button.addEventListener("click", () => archiveProject(button.dataset.archiveProject));
  });

  document.querySelectorAll("[data-save-project]").forEach((button) => {
    button.addEventListener("click", () => saveInlineProjectEdit(button.dataset.saveProject));
  });

  document.querySelectorAll("[data-edit-project]").forEach((button) => {
    syncInlineProjectSaveState(button.dataset.editProject);
  });
}

function renderProjectAdminCard(project, data, archived) {
  const type = findType(data, project.typeId);
  const isEditing = uiState.projectEditId === project.id;
  return `
    <article class="stack-card">
      <div class="admin-row">
        <div>
          <strong>${escapeHtml(project.name)}</strong>
          <p class="muted admin-meta">${escapeHtml(type?.name || "未分类")} · ${project.actor === "self" ? "本人" : "Agent"} · ${archived ? "已归档" : "活跃"}</p>
        </div>
        <div class="admin-actions">
          ${archived ? "" : `<button class="inline-button" type="button" data-edit-project="${project.id}">编辑</button>`}
          ${archived ? "" : `<button class="inline-button warning" type="button" data-archive-project="${project.id}">归档</button>`}
        </div>
      </div>
      ${
        isEditing
          ? `
            <div class="inline-edit-panel">
              <label class="field-label" for="inline-project-name-${project.id}">编辑具体项目</label>
              <input id="inline-project-name-${project.id}" type="text" value="${escapeHtml(project.name)}" />
              <select id="inline-project-type-${project.id}">
                ${getActiveTypes(data)
                  .map((item) => `<option value="${item.id}" ${item.id === project.typeId ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
                  .join("")}
              </select>
              <select id="inline-project-actor-${project.id}">
                <option value="self" ${project.actor === "self" ? "selected" : ""}>本人</option>
                <option value="agent" ${project.actor === "agent" ? "selected" : ""}>Agent</option>
              </select>
              <div class="admin-actions">
                <button class="primary-button" type="button" data-save-project="${project.id}" disabled>保存</button>
              </div>
            </div>
          `
          : ""
      }
    </article>
  `;
}

function saveManageNickname() {
  const nickname = els.manageTitleInput.value.trim();
  if (!nickname) {
    const data = appStore.get();
    els.manageTitleInput.value = data.profile?.nickname || "";
    els.manageTitleHint.textContent = "昵称不能为空。";
    return false;
  }

  const data = appStore.get();
  const currentNickname = data.profile?.nickname || "";
  if (nickname === currentNickname) {
    return true;
  }

  data.profile = {
    ...(data.profile || {}),
    nickname,
  };
  appStore.save(data);
  els.manageNavLabel.textContent = nickname;
  els.manageTitleHint.textContent = "";
  return true;
}

function handleManageNicknameSubmit(event) {
  event.preventDefault();
  if (!saveManageNickname()) {
    return;
  }

  uiState.manageNicknameEditing = false;
  renderManageIdentity(appStore.get());
  els.manageTitleInput.setSelectionRange(0, 0);
  requestAnimationFrame(() => {
    els.manageTitleConfirmButton.blur();
    els.manageTitleInput.blur();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
}

function handleManageNicknameFocus() {
  uiState.manageNicknameEditing = true;
  renderManageIdentity(appStore.get());
}

function handleManageNicknameBlur(event) {
  if (event.relatedTarget === els.manageTitleConfirmButton) {
    return;
  }

  const data = appStore.get();
  uiState.manageNicknameEditing = false;
  els.manageTitleInput.value = data.profile?.nickname || "";
  els.manageNavLabel.textContent = data.profile?.nickname || "我";
  els.manageTitleHint.textContent = "";
  renderManageIdentity(data);
}

function toggleManageSection(section) {
  if (uiState.manageExpandedSection === section) {
    uiState.manageExpandedSection = null;
    resetManageInlineState();
    renderManage();
    return;
  }

  uiState.manageExpandedSection = section;
  resetManageInlineState();
  renderManage();
}

function resetManageInlineState() {
  uiState.dashboardSettingsEditMode = false;
  uiState.showTypeCreate = false;
  uiState.showProjectCreate = false;
  uiState.typeEditId = null;
  uiState.projectEditId = null;
  els.typeConstraintHint.textContent = "";
  els.typeForm.reset();
  els.projectForm.reset();
}

function handleDashboardSettingsAction() {
  if (!uiState.dashboardSettingsEditMode) {
    uiState.dashboardSettingsEditMode = true;
    renderManage();
    els.dashboardTargetHoursInput.focus();
    return;
  }

  if (els.dashboardSettingsActionButton.disabled) {
    return;
  }

  els.dashboardSettingsForm.requestSubmit();
}

function cancelDashboardSettingsEdit() {
  uiState.dashboardSettingsEditMode = false;
  renderManage();
}

function handleDashboardSettingsSubmit(event) {
  event.preventDefault();
  if (!uiState.dashboardSettingsEditMode) {
    return;
  }

  const dailyTargetHours = Number(els.dashboardTargetHoursInput.value);
  const hourlyRate = Number(els.dashboardHourlyRateInput.value);
  const debtStartDate = els.dashboardDebtStartDateInput.value;
  if (!dailyTargetHours || dailyTargetHours <= 0 || !Number.isFinite(hourlyRate) || hourlyRate < 0 || !debtStartDate) {
    els.dashboardSettingsHint.textContent = "请把每日目标工时、时薪和起算日期填完整。";
    return;
  }

  if (parseDateOnly(debtStartDate) > startOfDay(new Date())) {
    els.dashboardSettingsHint.textContent = "起算日期不能晚于今天，不然这本账还没开始。";
    return;
  }

  const data = appStore.get();
  data.dashboardSettings = {
    dailyTargetHours,
    hourlyRate,
    debtStartDate,
  };
  appStore.save(data);
  uiState.dashboardSettingsEditMode = false;
  render();
}

function syncDashboardSettingsActionButton() {
  const data = appStore.get();
  const settings = getDashboardSettings(data);
  if (!uiState.dashboardSettingsEditMode) {
    els.dashboardSettingsCancelButton.classList.add("hidden");
    els.dashboardSettingsActionButton.textContent = "编辑";
    els.dashboardSettingsActionButton.disabled = false;
    els.dashboardSettingsActionButton.classList.remove("is-primary");
    return;
  }

  els.dashboardSettingsCancelButton.classList.remove("hidden");
  const hasChanges =
    Number(els.dashboardTargetHoursInput.value) !== settings.dailyTargetHours ||
    Number(els.dashboardHourlyRateInput.value) !== settings.hourlyRate ||
    els.dashboardDebtStartDateInput.value !== settings.debtStartDate;
  els.dashboardSettingsActionButton.textContent = "保存设置";
  els.dashboardSettingsActionButton.disabled = !hasChanges;
  els.dashboardSettingsActionButton.classList.toggle("is-primary", hasChanges);
}

function handleTypeSubmit(event) {
  event.preventDefault();
  const name = els.typeNameInput.value.trim();
  if (!name) {
    return;
  }

  const data = appStore.get();
  const duplicate = data.projectTypes.find((type) => type.name === name);
  if (duplicate) {
    els.typeConstraintHint.textContent = "这个项目类型已经存在。";
    return;
  }

  els.typeConstraintHint.textContent = "";
  const now = new Date().toISOString();
  data.projectTypes.push({
    id: createId(),
    name,
    sortOrder: data.projectTypes.length,
    createdAt: now,
    updatedAt: now,
  });

  appStore.save(data);
  els.typeForm.reset();
  uiState.showTypeCreate = false;
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
    (project) => !project.archived && project.typeId === typeId && project.name === name,
  );
  if (duplicate) {
    window.alert("同一项目类型下已经有这个具体项目。");
    return;
  }

  const now = new Date().toISOString();
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

  appStore.save(data);
  els.projectForm.reset();
  uiState.showProjectCreate = false;
  renderManage();
  if (uiState.currentView === "home") {
    renderHome();
  }
}

function saveInlineTypeEdit(typeId) {
  const nameInput = document.querySelector(`#inline-type-name-${CSS.escape(typeId)}`);
  const name = nameInput?.value.trim();
  if (!name) {
    return;
  }

  const data = appStore.get();
  const duplicate = data.projectTypes.find((type) => type.name === name && type.id !== typeId);
  if (duplicate) {
    els.typeConstraintHint.textContent = "这个项目类型已经存在。";
    return;
  }

  els.typeConstraintHint.textContent = "";
  const now = new Date().toISOString();
  data.projectTypes = data.projectTypes.map((type) => (type.id === typeId ? { ...type, name, updatedAt: now } : type));
  uiState.typeEditId = null;
  appStore.save(data);
  render();
}

function syncInlineTypeSaveState(typeId) {
  const data = appStore.get();
  const type = findType(data, typeId);
  if (!type) {
    return;
  }

  const nameInput = document.querySelector(`#inline-type-name-${CSS.escape(typeId)}`);
  const saveButton = document.querySelector(`[data-save-type="${CSS.escape(typeId)}"]`);
  if (!nameInput || !saveButton) {
    return;
  }

  const syncDisabled = () => {
    const hasChanges = nameInput.value.trim() !== type.name;
    saveButton.disabled = !hasChanges;
  };

  nameInput.addEventListener("input", syncDisabled);
  syncDisabled();
}

function saveInlineProjectEdit(projectId) {
  const nameInput = document.querySelector(`#inline-project-name-${CSS.escape(projectId)}`);
  const typeSelect = document.querySelector(`#inline-project-type-${CSS.escape(projectId)}`);
  const actorSelect = document.querySelector(`#inline-project-actor-${CSS.escape(projectId)}`);
  const name = nameInput?.value.trim();
  const typeId = typeSelect?.value;
  const actor = actorSelect?.value;
  if (!name || !typeId || !actor) {
    return;
  }

  const data = appStore.get();
  const duplicate = data.projects.find(
    (project) => !project.archived && project.typeId === typeId && project.name === name && project.id !== projectId,
  );
  if (duplicate) {
    window.alert("同一项目类型下已经有这个具体项目。");
    return;
  }

  const now = new Date().toISOString();
  data.projects = data.projects.map((project) =>
    project.id === projectId ? { ...project, name, typeId, actor, updatedAt: now } : project,
  );
  uiState.projectEditId = null;
  appStore.save(data);
  render();
}

function syncInlineProjectSaveState(projectId) {
  const data = appStore.get();
  const project = findProject(data, projectId);
  if (!project) {
    return;
  }

  const nameInput = document.querySelector(`#inline-project-name-${CSS.escape(projectId)}`);
  const typeSelect = document.querySelector(`#inline-project-type-${CSS.escape(projectId)}`);
  const actorSelect = document.querySelector(`#inline-project-actor-${CSS.escape(projectId)}`);
  const saveButton = document.querySelector(`[data-save-project="${CSS.escape(projectId)}"]`);
  if (!nameInput || !typeSelect || !actorSelect || !saveButton) {
    return;
  }

  const syncDisabled = () => {
    const hasChanges =
      nameInput.value.trim() !== project.name ||
      typeSelect.value !== project.typeId ||
      actorSelect.value !== project.actor;
    saveButton.disabled = !hasChanges;
  };

  nameInput.addEventListener("input", syncDisabled);
  typeSelect.addEventListener("change", syncDisabled);
  actorSelect.addEventListener("change", syncDisabled);
  syncDisabled();
}

function deleteType(typeId) {
  openConfirmDialog({
    title: "确认删除项目类型",
    message: "删除前系统仍会检查它下面是否还有具体项目；如果还有，删除会被阻止。",
    confirmText: "确认删除",
    confirmVariant: "danger",
    onConfirm: () => performDeleteType(typeId),
  });
}

function performDeleteType(typeId) {
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
  openConfirmDialog({
    title: "确认归档具体项目",
    message: "归档后它不会再出现在首页可选项里，但历史记录会保留。",
    confirmText: "确认归档",
    confirmVariant: "danger",
    onConfirm: () => performArchiveProject(projectId),
  });
}

function performArchiveProject(projectId) {
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
        return finishSession(session, now);
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
      ? finishSession(session, now)
      : session,
  );
  appStore.save(data);
  render();
}

function finishSession(session, endAt) {
  return {
    ...session,
    endAt,
    durationMs: new Date(endAt).getTime() - new Date(session.startAt).getTime(),
    updatedAt: endAt,
  };
}

function handleHistoryAction(sessionId) {
  const session = getHistorySessionById(sessionId);
  if (!session) {
    return;
  }

  if (!hasHistoryChanges(session)) {
    collapseHistoryCard(sessionId);
    return;
  }

  saveHistoryEdit(sessionId);
}

function collapseHistoryCard(sessionId) {
  const session = getHistorySessionById(sessionId);
  if (!session || hasHistoryChanges(session)) {
    return;
  }

  uiState.historyExpandedId = null;
  renderHistory();
}

function getHistorySessionById(sessionId) {
  const data = appStore.get();
  return data.sessions.find((item) => item.id === sessionId) || null;
}

function hasHistoryChanges(session) {
  const startInput = document.querySelector(`#history-start-${CSS.escape(session.id)}`);
  const endInput = document.querySelector(`#history-end-${CSS.escape(session.id)}`);
  const noteInput = document.querySelector(`#history-note-${CSS.escape(session.id)}`);
  if (!startInput || !endInput || !noteInput) {
    return false;
  }

  return (
    startInput.value !== toLocalInputValue(session.startAt) ||
    endInput.value !== (session.endAt ? toLocalInputValue(session.endAt) : "") ||
    noteInput.value.trim() !== (session.note || "").trim()
  );
}

function syncHistoryActionButton(sessionId) {
  const data = appStore.get();
  const session = data.sessions.find((item) => item.id === sessionId);
  const button = document.querySelector(`[data-history-action="${CSS.escape(sessionId)}"]`);
  if (!session || !button) {
    return;
  }

  const hasChanges = hasHistoryChanges(session);
  button.textContent = hasChanges ? "保存修改" : "取消";
  button.classList.toggle("gray", !hasChanges);
  button.classList.toggle("history-action-save", hasChanges);
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

function getDashboardSettings(data) {
  return normalizeDashboardSettings(data.dashboardSettings);
}

function buildDashboardViewModel(data, settings, rangeKey) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayEnd = todayStart;
  const debtStart = maxDate(parseDateOnly(settings.debtStartDate), startOfDay(new Date(2000, 0, 1)));
  const dayTargetMs = hoursToMs(settings.dailyTargetHours);
  const hasWorkType = data.projectTypes.some((type) => type.name === "工作");
  const workProjects = getWorkProjects(data);
  const workSessions = getWorkSessions(data);
  const recordedDays = Math.max(0, diffCalendarDays(debtStart, todayStart) + 1);
  const chargeableDays = Math.max(0, diffCalendarDays(debtStart, todayStart));
  const cumulativeTargetMs = chargeableDays * dayTargetMs;
  const cumulativeActualMs = sumIntervalDurations(workSessions, debtStart, yesterdayEnd);
  const cumulativeBalanceMs = cumulativeActualMs - cumulativeTargetMs;
  const todayActualMs = sumIntervalDurations(workSessions, maxDate(debtStart, todayStart), now);
  const todayBalanceMs = todayActualMs - dayTargetMs;
  const range = getDashboardRangeConfig(rangeKey, now);
  const effectiveRange = { ...range, start: maxDate(range.start, debtStart) };
  const trendBuckets = buildDashboardTrendBuckets(effectiveRange, now);
  const trendSeries = trendBuckets.map((bucket) => {
    const effectiveMs = sumIntervalDurations(workSessions, bucket.start, bucket.end);
    const targetMs = bucket.targetDays * dayTargetMs;
    return {
      ...bucket,
      effectiveMs,
      targetMs,
      surplusMs: effectiveMs - targetMs,
    };
  });

  return {
    now,
    settings,
    hasWorkType,
    hasWorkProjects: workProjects.length > 0,
    hasWorkSessions: workSessions.length > 0,
    workProjectCount: workProjects.length,
    workSessionCount: workSessions.length,
    range: effectiveRange,
    recordedDays,
    cumulativeBalanceMs,
    cumulativeMoney: Math.round((cumulativeBalanceMs / 3600000) * settings.hourlyRate),
    todayActualMs,
    todayTargetMs: dayTargetMs,
    todayBalanceMs,
    trendSeries,
    typeBreakdown: buildDashboardTypeBreakdown(data, workProjectIdsFromProjects(workProjects), effectiveRange.start, effectiveRange.end),
  };
}

function renderDashboardDebtHero(viewModel, settings) {
  if (!viewModel.hasWorkType) {
    return `
      <article class="dashboard-debt-hero is-empty">
        <div class="dashboard-debt-main">
          <p class="dashboard-hero-kicker">累计工时账本</p>
          <strong class="dashboard-debt-value">先建一个“工作”类型</strong>
          <p class="dashboard-debt-note">这套仪表盘只统计项目类型为“工作”的记录。先去 Manage 里建好“工作”，这里才会开始算账。</p>
        </div>
      </article>
    `;
  }

  if (!viewModel.hasWorkProjects) {
    return `
      <article class="dashboard-debt-hero is-empty">
        <div class="dashboard-debt-main">
          <p class="dashboard-hero-kicker">累计工时账本</p>
          <strong class="dashboard-debt-value">工作项目还没建起来</strong>
          <p class="dashboard-debt-note">已经有“工作”类型了，但它下面还没有具体项目。先补一个工作项目，仪表盘才有真实输入。</p>
        </div>
      </article>
    `;
  }

  const isDebt = viewModel.cumulativeBalanceMs < 0;
  const balanceAbs = Math.abs(viewModel.cumulativeBalanceMs);
  const moneyAbs = Math.abs(viewModel.cumulativeMoney);
  const debtLevel = Math.min(1, Math.abs(viewModel.todayBalanceMs) / Math.max(viewModel.todayTargetMs, 1));
  const toneClass = isDebt ? `is-debt debt-level-${Math.min(4, Math.ceil(debtLevel * 4))}` : "is-surplus";
  return `
    <article class="dashboard-debt-hero ${toneClass}">
      <div class="dashboard-debt-main">
        <p class="dashboard-hero-kicker">${isDebt ? "累计工时负债" : "累计工时盈余"}</p>
        <strong class="dashboard-debt-value">${formatDuration(balanceAbs)}</strong>
        <p class="dashboard-debt-note">${isDebt ? "从起算日起累计欠下的可用工时。" : "从起算日起累计结余的可用工时。"}</p>
      </div>
      <div class="dashboard-debt-side">
        <div class="dashboard-mini-stat">
          <span class="dashboard-mini-label">${isDebt ? "金额负债" : "金额盈余"}</span>
          <strong>${formatCurrency(moneyAbs)}</strong>
        </div>
        <div class="dashboard-mini-stat">
          <span class="dashboard-mini-label">已记录天数</span>
          <strong>${viewModel.recordedDays} 天</strong>
        </div>
        <div class="dashboard-mini-stat">
          <span class="dashboard-mini-label">每日目标</span>
          <strong>${formatHours(settings.dailyTargetHours)}</strong>
        </div>
      </div>
    </article>
  `;
}

function renderDashboardTodayProgress(viewModel, settings) {
  if (!viewModel.hasWorkType || !viewModel.hasWorkProjects) {
    return `
      <article class="dashboard-progress-card is-empty">
        <div class="dashboard-progress-head">
          <div>
            <p class="eyebrow">今日工作进度</p>
            <h2>等工作项目准备好再开始计</h2>
          </div>
        </div>
        <p class="muted">当前还没有可纳入这套账本的“工作”项目，所以今天进度先不计算。</p>
      </article>
    `;
  }

  const isDone = viewModel.todayBalanceMs >= 0;
  const deltaText = isDone ? `今日超出 ${formatDuration(viewModel.todayBalanceMs)}` : `今日还差 ${formatDuration(Math.abs(viewModel.todayBalanceMs))}`;
  const statusTone = isDone ? "is-done" : "is-warning";
  return `
    <article class="dashboard-progress-card ${statusTone}">
      <div class="dashboard-progress-head">
        <div>
          <p class="eyebrow">今日工作进度</p>
          <h2>${deltaText}</h2>
        </div>
        <span class="dashboard-progress-mark" aria-label="${isDone ? "已达标" : "未达标"}">${isDone ? "✓" : "✕"}</span>
      </div>
      <div class="dashboard-progress-grid">
        <div class="dashboard-mini-stat">
          <span class="dashboard-mini-label">今日有效工时</span>
          <strong>${formatDuration(viewModel.todayActualMs)}</strong>
        </div>
        <div class="dashboard-mini-stat">
          <span class="dashboard-mini-label">今日目标工时</span>
          <strong>${formatHours(settings.dailyTargetHours)}</strong>
        </div>
      </div>
    </article>
  `;
}

function renderDashboardTrend(viewModel, settings, chartMode, selectedIndex) {
  if (!viewModel.hasWorkType) {
    return `<div class="empty-state">还没有“工作”类型，所以趋势区暂时无从统计。先去 Manage 里建一个“工作”类型，再来切图和切时间范围才有意义。</div>`;
  }

  if (!viewModel.hasWorkProjects) {
    return `<div class="empty-state">“工作”类型下还没有具体项目，趋势区先空着。先建一个工作项目，图形切换和时间范围才会长出内容。</div>`;
  }

  if (!viewModel.hasWorkSessions) {
    return `<div class="empty-state">“工作”类型下还没有任何记录。先开始一次工作任务，这里才会长出趋势；现在点切换按钮，内容不会有明显变化。</div>`;
  }

  if (!viewModel.trendSeries.length) {
    return `<div class="empty-state">当前范围内还没有足够的工作趋势数据。</div>`;
  }

  const subtitle = `${viewModel.range.label} · ${viewModel.range.granularityLabel}粒度`;
  const chart =
    chartMode === "bar"
      ? renderBarTrendChart(viewModel.trendSeries, settings, selectedIndex)
      : renderLineTrendChart(viewModel.trendSeries, settings, selectedIndex);
  const selectedItem = viewModel.trendSeries[selectedIndex ?? Math.max(0, viewModel.trendSeries.length - 1)];
  return `
    <article class="dashboard-chart-card">
      <div class="dashboard-chart-header">
        <div>
          <strong>${chartMode === "bar" ? "目标对照柱状图" : "工时盈余折线图"}</strong>
          <p class="muted">${subtitle}</p>
        </div>
      </div>
      ${chart}
      <div class="dashboard-chart-detail">
        <span class="dashboard-chart-detail-label">点一下图里的点或柱</span>
        <strong class="dashboard-chart-detail-value">${escapeHtml(formatTrendBucketDetail(selectedItem))}</strong>
      </div>
      <div class="dashboard-legend">
        ${
          chartMode === "bar"
            ? `
              <span class="dashboard-legend-item"><span class="legend-swatch is-bar"></span>有效工时</span>
              <span class="dashboard-legend-item"><span class="legend-swatch is-target-dots"></span>目标工时</span>
            `
            : `
              <span class="dashboard-legend-item"><span class="legend-swatch is-surplus-line"></span>工时盈余</span>
              <span class="dashboard-legend-item"><span class="legend-swatch is-effective-line"></span>有效工时</span>
              <span class="dashboard-legend-item"><span class="legend-swatch is-target-line"></span>目标工时</span>
            `
        }
      </div>
    </article>
  `;
}

function renderDashboardTypeBreakdown(viewModel) {
  if (!viewModel.hasWorkSessions) {
    return `<div class="empty-state">当前范围内还没有工作记录，所以还看不到类型分布。</div>`;
  }

  if (!viewModel.typeBreakdown.length) {
    return `<div class="empty-state">当前范围内还没有可展示的类型分布。</div>`;
  }

  const gradient = viewModel.typeBreakdown
    .map((item, index) => `${item.color} ${item.start}% ${item.end}%`)
    .join(", ");
  return `
    <div class="dashboard-breakdown-wrap">
      <div class="dashboard-pie" style="background: conic-gradient(${gradient});"></div>
      <div class="dashboard-breakdown-list">
        ${viewModel.typeBreakdown
          .map(
            (item) => `
              <div class="dashboard-breakdown-item">
                <span class="dashboard-breakdown-name"><span class="legend-swatch" style="background:${item.color};"></span>${escapeHtml(item.name)}</span>
                <span class="muted">${formatDuration(item.duration)} · ${item.ratio}%</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderLineTrendChart(series, settings, selectedIndex) {
  const width = 640;
  const height = 260;
  const left = 60;
  const right = 18;
  const top = 18;
  const bottom = 46;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(...series.flatMap((item) => [item.surplusMs, item.effectiveMs, item.targetMs]), hoursToMs(settings.dailyTargetHours), 1);
  const minValue = Math.min(...series.map((item) => item.surplusMs), 0);
  const chartWidth = width - left - right;
  const stepX = series.length > 1 ? chartWidth / (series.length - 1) : 0;
  const axisTicks = buildChartAxisTicks(minValue, maxValue, 4);
  const points = series.map((item, index) => ({
    x: left + stepX * index,
    surplusY: projectChartValue(item.surplusMs, minValue, maxValue, top, chartHeight),
    effectiveY: projectChartValue(item.effectiveMs, minValue, maxValue, top, chartHeight),
    targetY: projectChartValue(item.targetMs, minValue, maxValue, top, chartHeight),
    label: item.label,
  }));
  const hitWidth = series.length > 1 ? Math.max(28, stepX * 0.72) : 56;
  return `
    <svg class="dashboard-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="工作工时趋势折线图">
      ${buildChartGrid(width, height, top, chartHeight, left, right, axisTicks)}
      <text x="${left - 34}" y="${top - 2}" class="chart-unit-label">h</text>
      ${series
        .map((item, index) => {
          const point = points[index];
          const x = Math.max(left, point.x - hitWidth / 2);
          const boundedWidth = Math.min(hitWidth, width - right - x);
          return `<rect x="${x}" y="${top}" width="${boundedWidth}" height="${chartHeight}" rx="12" class="chart-hit-zone" data-chart-index="${index}"></rect>`;
        })
        .join("")}
      <path d="${buildLinePath(points, "surplusY")}" class="chart-line surplus-line" />
      <path d="${buildLinePath(points, "effectiveY")}" class="chart-line effective-line" />
      <path d="${buildLinePath(points, "targetY")}" class="chart-line target-line" />
      ${points
        .map(
          (point, index) => `
            ${selectedIndex === index ? `<circle cx="${point.x}" cy="${point.surplusY}" r="8.5" class="chart-dot-ring surplus-ring"></circle>` : ""}
            ${selectedIndex === index ? `<circle cx="${point.x}" cy="${point.effectiveY}" r="8.5" class="chart-dot-ring effective-ring"></circle>` : ""}
            ${selectedIndex === index ? `<circle cx="${point.x}" cy="${point.targetY}" r="8.5" class="chart-dot-ring target-ring"></circle>` : ""}
            <circle cx="${point.x}" cy="${point.surplusY}" r="${selectedIndex === index ? 5.2 : 3.5}" class="chart-dot surplus-dot ${selectedIndex === index ? "is-active" : ""}" data-chart-index="${index}"></circle>
            <circle cx="${point.x}" cy="${point.effectiveY}" r="${selectedIndex === index ? 5.2 : 3.5}" class="chart-dot effective-dot ${selectedIndex === index ? "is-active" : ""}" data-chart-index="${index}"></circle>
            <circle cx="${point.x}" cy="${point.targetY}" r="${selectedIndex === index ? 5.2 : 3.5}" class="chart-dot target-dot ${selectedIndex === index ? "is-active" : ""}" data-chart-index="${index}"></circle>
            ${shouldShowChartLabel(index, series.length) ? `<text x="${point.x}" y="${height - 18}" text-anchor="middle" class="chart-label">${escapeHtml(point.label)}</text>` : ""}
          `,
        )
        .join("")}
    </svg>
  `;
}

function renderBarTrendChart(series, settings, selectedIndex) {
  const width = 640;
  const height = 260;
  const left = 60;
  const right = 18;
  const top = 18;
  const bottom = 46;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(...series.map((item) => Math.max(item.effectiveMs, item.targetMs)), hoursToMs(settings.dailyTargetHours), 1);
  const minValue = 0;
  const chartWidth = width - left - right;
  const stepX = series.length > 0 ? chartWidth / series.length : 0;
  const barWidth = Math.max(10, stepX * 0.48);
  const axisTicks = buildChartAxisTicks(minValue, maxValue, 4);
  return `
    <svg class="dashboard-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="工作工时趋势柱状图">
      ${buildChartGrid(width, height, top, chartHeight, left, right, axisTicks)}
      <text x="${left - 34}" y="${top - 2}" class="chart-unit-label">h</text>
      ${series
        .map((item, index) => {
          const x = left + stepX * index + (stepX - barWidth) / 2;
          const barHeight = (item.effectiveMs / maxValue) * chartHeight;
          const y = top + chartHeight - barHeight;
          const targetY = top + chartHeight - (item.targetMs / maxValue) * chartHeight;
          return `
            <rect x="${left + stepX * index}" y="${top}" width="${stepX}" height="${chartHeight}" rx="12" class="chart-hit-zone" data-chart-index="${index}"></rect>
            <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="10" class="chart-bar ${selectedIndex === index ? "is-active" : ""}" data-chart-index="${index}"></rect>
            <line x1="${x - 4}" y1="${targetY}" x2="${x + barWidth + 4}" y2="${targetY}" class="chart-target-line ${selectedIndex === index ? "is-active" : ""}" data-chart-index="${index}"></line>
            ${buildTargetDots(x, barWidth, targetY, selectedIndex === index, index)}
            ${shouldShowChartLabel(index, series.length) ? `<text x="${x + barWidth / 2}" y="${height - 18}" text-anchor="middle" class="chart-label">${escapeHtml(item.label)}</text>` : ""}
          `;
        })
        .join("")}
    </svg>
  `;
}

function buildDashboardTypeBreakdown(data, workProjectIds, rangeStart, rangeEnd) {
  const totals = new Map();
  data.sessions.forEach((session) => {
    if (!workProjectIds.has(session.projectId)) {
      return;
    }
    const duration = getOverlapDurationMs(session, rangeStart, rangeEnd);
    if (!duration) {
      return;
    }
    const project = findProject(data, session.projectId);
    const type = findType(data, project?.typeId);
    const key = type?.name || "未分类";
    totals.set(key, (totals.get(key) || 0) + duration);
  });
  const totalDuration = [...totals.values()].reduce((sum, value) => sum + value, 0);
  if (!totalDuration) {
    return [];
  }
  let cursor = 0;
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, duration], index) => {
      const ratio = Math.round((duration / totalDuration) * 100);
      const start = cursor;
      const end = cursor + (duration / totalDuration) * 100;
      cursor = end;
      return {
        name,
        duration,
        ratio,
        color: DASHBOARD_TYPE_COLORS[index % DASHBOARD_TYPE_COLORS.length],
        start,
        end,
      };
    });
}

function getDashboardRangeConfig(rangeKey, now) {
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  if (rangeKey === "30d") {
    return { key: rangeKey, label: "最近30天", granularity: "day", granularityLabel: "按天", start: addDays(todayStart, -29), end: tomorrowStart };
  }
  if (rangeKey === "180d") {
    return { key: rangeKey, label: "最近180天", granularity: "week", granularityLabel: "按周", start: addDays(todayStart, -179), end: tomorrowStart };
  }
  if (rangeKey === "1y") {
    const start = new Date(todayStart.getFullYear(), todayStart.getMonth() - 11, 1);
    return { key: rangeKey, label: "最近1年", granularity: "month", granularityLabel: "按月", start, end: tomorrowStart };
  }
  if (rangeKey === "3y") {
    const start = new Date(todayStart.getFullYear(), todayStart.getMonth() - 35, 1);
    return { key: rangeKey, label: "最近3年", granularity: "month", granularityLabel: "按月", start, end: tomorrowStart };
  }
  return { key: "7d", label: "最近7天", granularity: "day", granularityLabel: "按天", start: addDays(todayStart, -6), end: tomorrowStart };
}

function buildDashboardTrendBuckets(range, now) {
  const buckets = [];
  if (range.granularity === "day") {
    let cursor = new Date(range.start);
    while (cursor < range.end) {
      const next = addDays(cursor, 1);
      buckets.push({ label: `${cursor.getMonth() + 1}/${cursor.getDate()}`, start: new Date(cursor), end: next, targetDays: 1 });
      cursor = next;
    }
    return buckets;
  }

  if (range.granularity === "week") {
    let cursor = startOfWeek(range.start);
    while (cursor < range.end) {
      const next = addDays(cursor, 7);
      const start = cursor < range.start ? new Date(range.start) : new Date(cursor);
      const end = next > range.end ? new Date(range.end) : new Date(next);
      buckets.push({ label: `${start.getMonth() + 1}/${start.getDate()}`, start, end, targetDays: Math.max(1, diffCalendarDays(start, end)) });
      cursor = next;
    }
    return buckets.slice(-26);
  }

  let cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  while (cursor < range.end) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const start = cursor < range.start ? new Date(range.start) : new Date(cursor);
    const end = next > range.end ? new Date(range.end) : new Date(next);
    buckets.push({ label: `${start.getFullYear()}/${pad(start.getMonth() + 1)}`, start, end, targetDays: Math.max(1, diffCalendarDays(start, end)) });
    cursor = next;
  }
  return buckets;
}

function workProjectIdsFromProjects(projects) {
  return new Set(projects.map((project) => project.id));
}

function getWorkProjects(data) {
  return data.projects.filter((project) => {
    const type = findType(data, project.typeId);
    return type?.name === "工作";
  });
}

function getWorkSessions(data) {
  const workProjectIds = workProjectIdsFromProjects(getWorkProjects(data));
  return data.sessions.filter((session) => workProjectIds.has(session.projectId));
}

function sumIntervalDurations(sessions, start, end) {
  return sessions.reduce((sum, session) => sum + getOverlapDurationMs(session, start, end), 0);
}

function getOverlapDurationMs(session, rangeStart, rangeEnd) {
  const sessionStart = new Date(session.startAt);
  const sessionEnd = session.endAt ? new Date(session.endAt) : new Date();
  const start = Math.max(sessionStart.getTime(), rangeStart.getTime());
  const end = Math.min(sessionEnd.getTime(), rangeEnd.getTime());
  return Math.max(0, end - start);
}

function hoursToMs(hours) {
  return Math.round(hours * 60 * 60 * 1000);
}

function formatHours(hours) {
  return Number.isInteger(hours) ? `${hours} 小时` : `${hours} 小时`;
}

function formatCurrency(amount) {
  return `¥${Math.round(amount).toLocaleString("zh-CN")}`;
}

function parseDateOnly(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function maxDate(a, b) {
  return a > b ? new Date(a) : new Date(b);
}

function diffCalendarDays(start, end) {
  return Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / (24 * 60 * 60 * 1000));
}

function buildChartGrid(width, height, top, chartHeight, left, right, axisTicks) {
  return axisTicks
    .map((tick) => {
      const y = projectChartValue(tick.value, axisTicks[axisTicks.length - 1].value, axisTicks[0].value, top, chartHeight);
      return `
        <line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" class="chart-grid-line"></line>
        <text x="${left - 10}" y="${y + 4}" text-anchor="end" class="chart-axis-label">${tick.label}</text>
      `;
    })
    .join("");
}

function buildLinePath(points, key) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point[key]}`).join(" ");
}

function bindDashboardTrendInteractions() {
  els.dashboardTrend.querySelectorAll("[data-chart-index]").forEach((node) => {
    const updateSelection = () => {
      const index = Number(node.dataset.chartIndex);
      if (!Number.isFinite(index)) {
        return;
      }
      uiState.dashboardSelectedPointIndex = index;
      renderDashboard();
    };

    node.addEventListener("click", updateSelection);
    node.addEventListener("touchstart", updateSelection, { passive: true });
  });
}

function projectChartValue(value, minValue, maxValue, top, chartHeight) {
  const span = Math.max(1, maxValue - minValue);
  return top + chartHeight - ((value - minValue) / span) * chartHeight;
}

function buildChartAxisTicks(minValue, maxValue, tickCount) {
  const safeMin = Math.min(minValue, 0);
  const safeMax = Math.max(maxValue, 0);
  const span = Math.max(1, safeMax - safeMin);
  return Array.from({ length: tickCount }, (_, index) => {
    const ratio = index / (tickCount - 1);
    const value = safeMax - span * ratio;
    return {
      value,
      label: formatAxisHours(value),
    };
  });
}

function formatAxisHours(ms) {
  const hours = ms / 3600000;
  const rounded = Math.abs(hours) >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10;
  return `${rounded}`;
}

function formatTrendBucketDetail(item) {
  return `${item.label} · 盈余 ${formatSignedHours(item.surplusMs)} · 有效 ${formatDetailedHours(item.effectiveMs)} · 目标 ${formatDetailedHours(item.targetMs)}`;
}

function formatDetailedHours(ms) {
  const hours = Math.round((ms / 3600000) * 10) / 10;
  return `${hours}h`;
}

function formatSignedHours(ms) {
  const sign = ms > 0 ? "+" : ms < 0 ? "-" : "";
  return `${sign}${formatDetailedHours(Math.abs(ms))}`;
}

function buildTargetDots(x, barWidth, y, isActive = false, selectedIndex = -1) {
  return Array.from({ length: 4 }, (_, dotIndex) => {
    const pointX = x + (barWidth / 3) * dotIndex;
    return `<circle cx="${pointX}" cy="${y}" r="${isActive ? 3.2 : 2.4}" class="chart-target-dot ${isActive ? "is-active" : ""}" data-chart-index="${selectedIndex}"></circle>`;
  }).join("");
}

function shouldShowChartLabel(index, total) {
  if (total <= 8) {
    return true;
  }
  if (total <= 14) {
    return index % 2 === 0;
  }
  if (total <= 30) {
    return index % 4 === 0 || index === total - 1;
  }
  return index % 6 === 0 || index === total - 1;
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
      if (uiState.currentView === "history" && uiState.historyExpandedId) {
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

async function hydrateStateFromAgentApi() {
  if (!isLocalDevHost() || typeof fetch !== "function") {
    return false;
  }

  try {
    const response = await fetch(`${AGENT_API_BASE}/state`);
    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    if (!payload?.ok || !payload.data) {
      return false;
    }

    const remoteState = normalizeData(payload.data);
    const localRaw = localStorage.getItem(STORAGE_KEY);
    const localState = localRaw ? normalizeData(JSON.parse(localRaw)) : null;
    if (!localState || new Date(remoteState.updatedAt || 0).getTime() > new Date(localState.updatedAt || 0).getTime()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteState));
      return true;
    }
  } catch {
    // Keep localhost usable even when the agent API is not running.
  }

  return false;
}

async function syncStateToAgentApi(state) {
  if (!isLocalDevHost() || typeof fetch !== "function") {
    return;
  }

  try {
    await fetch(`${AGENT_API_BASE}/state/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state }),
    });
  } catch {
    // Keep the frontend usable even if the local agent API is offline.
  }
}

function startAgentSyncTimer() {
  clearInterval(agentSyncTimerHandle);
  if (!isLocalDevHost()) {
    return;
  }

  agentSyncTimerHandle = window.setInterval(() => {
    if (document.hidden) {
      return;
    }

    void hydrateStateFromAgentApi().then((didHydrate) => {
      if (didHydrate) {
        render();
      }
    });
  }, 4000);
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
      motto: "时间不可控，注意力可安放。",
    },
    dashboardSettings: {
      dailyTargetHours: 8,
      hourlyRate: 120,
      debtStartDate: dateKey(new Date(now - 21 * 24 * 60 * 60 * 1000)),
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
