const STORAGE_KEY = "time-ledger-mobile-demo-v2";

const state = {
  currentView: "home",
  projectSortMode: "recent",
  historySortMode: "desc",
  historyExpandedId: null,
  projectSearch: "",
};

const els = {
  views: document.querySelectorAll(".view"),
  navItems: document.querySelectorAll(".nav-item"),
  projectSearch: document.querySelector("#projectSearch"),
  projectList: document.querySelector("#projectList"),
  projectQuickActions: document.querySelector("#projectQuickActions"),
  currentSelfTask: document.querySelector("#currentSelfTask"),
  runningAgentTasks: document.querySelector("#runningAgentTasks"),
  historySort: document.querySelector("#historySort"),
  historyList: document.querySelector("#historyList"),
  dashboardMetrics: document.querySelector("#dashboardMetrics"),
  dashboardTypeBreakdown: document.querySelector("#dashboardTypeBreakdown"),
  dashboardTrend: document.querySelector("#dashboardTrend"),
  typeForm: document.querySelector("#typeForm"),
  typeNameInput: document.querySelector("#typeNameInput"),
  typeSubmitButton: document.querySelector("#typeSubmitButton"),
  typeList: document.querySelector("#typeList"),
  projectForm: document.querySelector("#projectForm"),
  projectTypeSelect: document.querySelector("#projectTypeSelect"),
  projectNameInput: document.querySelector("#projectNameInput"),
  projectActorSelect: document.querySelector("#projectActorSelect"),
  projectSubmitButton: document.querySelector("#projectSubmitButton"),
  projectAdminList: document.querySelector("#projectAdminList"),
  seedButton: document.querySelector("#seedButton"),
  recentModeButton: document.querySelector("#recentModeButton"),
  frequentModeButton: document.querySelector("#frequentModeButton"),
  metricCardTemplate: document.querySelector("#metricCardTemplate"),
};

let editState = {
  typeId: null,
  projectId: null,
};

let timerHandle = null;

init();

function init() {
  ensureSeedData();
  bindEvents();
  render();
  startTimer();
}

function bindEvents() {
  els.navItems.forEach((button) => {
    button.addEventListener("click", () => {
      state.currentView = button.dataset.nav;
      render();
    });
  });

  els.projectSearch.addEventListener("input", (event) => {
    state.projectSearch = event.target.value.trim();
    renderHome();
  });

  els.historySort.addEventListener("change", (event) => {
    state.historySortMode = event.target.value;
    renderHistory();
  });

  els.recentModeButton.addEventListener("click", () => {
    state.projectSortMode = "recent";
    renderHome();
  });

  els.frequentModeButton.addEventListener("click", () => {
    state.projectSortMode = "frequent";
    renderHome();
  });

  els.typeForm.addEventListener("submit", handleTypeSubmit);
  els.projectForm.addEventListener("submit", handleProjectSubmit);
  els.seedButton.addEventListener("click", resetSeedData);
}

function render() {
  toggleViews();
  renderHome();
  renderHistory();
  renderDashboard();
  renderManage();
}

function toggleViews() {
  els.views.forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === state.currentView);
  });

  els.navItems.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.nav === state.currentView);
  });
}

function renderHome() {
  const data = getData();
  const projects = getVisibleProjects(data);
  const filtered = filterProjects(projects, state.projectSearch);
  const sorted = sortProjects(filtered, state.projectSortMode);
  const runningSelf = getRunningSelfSession(data);
  const runningAgents = getRunningAgentSessions(data);

  els.recentModeButton.classList.toggle("is-active", state.projectSortMode === "recent");
  els.frequentModeButton.classList.toggle("is-active", state.projectSortMode === "frequent");

  renderCurrentSelfTask(runningSelf, data);
  renderRunningAgents(runningAgents, data);
  renderProjectQuickActions(data, state.projectSearch);
  renderProjectList(sorted, data);
}

function renderCurrentSelfTask(session, data) {
  if (!session) {
    els.currentSelfTask.innerHTML = `
      <div class="empty-state">
        当前没有本人任务在跑。点下方具体项目，立刻开始。
      </div>
    `;
    return;
  }

  const project = findProject(data, session.projectId);
  const type = findType(data, project?.typeId);
  els.currentSelfTask.innerHTML = `
    <article class="current-task-card">
      <p class="current-task-title">${escapeHtml(project?.name || "未知项目")}</p>
      <p class="current-task-meta">${escapeHtml(type?.name || "未分类")} · 本人 · ${formatDateTime(session.startAt)} 开始</p>
      <div class="big-timer">${formatDuration(nowMs() - new Date(session.startAt).getTime())}</div>
      <div class="action-row">
        <button class="primary-button danger" type="button" data-stop-session="${session.id}">停止当前任务</button>
      </div>
    </article>
  `;

  els.currentSelfTask.querySelector("[data-stop-session]").addEventListener("click", () => {
    stopSession(session.id);
  });
}

function renderRunningAgents(sessions, data) {
  if (!sessions.length) {
    els.runningAgentTasks.innerHTML = `<div class="empty-state">当前没有 Agent 任务在跑。</div>`;
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
            <p class="muted">${escapeHtml(type?.name || "未分类")} · Agent · 已运行 ${formatDuration(nowMs() - new Date(session.startAt).getTime())}</p>
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

function renderProjectQuickActions(data, search) {
  const query = search.trim();
  const types = getActiveTypes(data);

  if (!query) {
    els.projectQuickActions.innerHTML = `
      <button class="chip" type="button" data-open-create-project="1">新建具体项目</button>
      <button class="chip" type="button" data-open-manage="1">去“我”页管理分类</button>
    `;
  } else {
    els.projectQuickActions.innerHTML = `
      <button class="chip" type="button" data-open-create-project="1">创建“${escapeHtml(query)}”</button>
      <span class="pill gray">${types.length} 个项目类型可选</span>
    `;
  }

  const createButton = els.projectQuickActions.querySelector("[data-open-create-project]");
  if (createButton) {
    createButton.addEventListener("click", () => {
      state.currentView = "me";
      els.projectNameInput.value = query;
      render();
      els.projectTypeSelect.focus();
    });
  }

  const manageButton = els.projectQuickActions.querySelector("[data-open-manage]");
  if (manageButton) {
    manageButton.addEventListener("click", () => {
      state.currentView = "me";
      render();
    });
  }
}

function renderProjectList(projects, data) {
  if (!projects.length) {
    els.projectList.innerHTML = `
      <div class="empty-state">
        没找到匹配的具体项目。可以直接去“我”里创建，或者把搜索词当成新项目名。
      </div>
    `;
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

function renderHistory() {
  const data = getData();
  const sessions = sortSessions(data.sessions, state.historySortMode);

  if (!sessions.length) {
    els.historyList.innerHTML = `<div class="empty-state">还没有历史记录，先去首页跑第一条。</div>`;
    return;
  }

  els.historySort.value = state.historySortMode;
  els.historyList.innerHTML = sessions
    .map((session) => renderHistoryCard(session, data))
    .join("");

  els.historyList.querySelectorAll("[data-history-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      state.historyExpandedId = state.historyExpandedId === button.dataset.historyToggle ? null : button.dataset.historyToggle;
      renderHistory();
    });
  });

  els.historyList.querySelectorAll("[data-save-history]").forEach((button) => {
    button.addEventListener("click", () => saveHistoryEdit(button.dataset.saveHistory));
  });
}

function renderHistoryCard(session, data) {
  const project = findProject(data, session.projectId);
  const type = findType(data, project?.typeId);
  const expanded = state.historyExpandedId === session.id;
  const durationText = session.endAt
    ? formatDuration(new Date(session.endAt).getTime() - new Date(session.startAt).getTime())
    : `进行中 · ${formatDuration(nowMs() - new Date(session.startAt).getTime())}`;

  return `
    <article class="history-card ${expanded ? "expanded" : ""}">
      <button class="history-summary" type="button" data-history-toggle="${session.id}">
        <div class="history-row-top">
          <span class="history-title">${escapeHtml(project?.name || "未知项目")}</span>
          <span class="pill ${project?.actor === "agent" ? "gray" : ""}">${project?.actor === "self" ? "本人" : "Agent"}</span>
        </div>
        <div class="history-meta">
          ${formatDateTime(session.startAt)} - ${session.endAt ? formatDateTime(session.endAt) : "进行中"}<br />
          ${durationText} · ${escapeHtml(type?.name || "未分类")}
        </div>
      </button>
      ${
        expanded
          ? `
            <div class="history-edit-grid">
              <input id="history-start-${session.id}" type="datetime-local" value="${toLocalInputValue(session.startAt)}" />
              <input id="history-end-${session.id}" type="datetime-local" value="${session.endAt ? toLocalInputValue(session.endAt) : ""}" />
              <textarea id="history-note-${session.id}" placeholder="补充备注，记录复盘或思考">${escapeHtml(session.note || "")}</textarea>
              <button class="primary-button" type="button" data-save-history="${session.id}">保存修改</button>
            </div>
          `
          : ""
      }
    </article>
  `;
}

function renderDashboard() {
  const data = getData();
  const metrics = buildDashboardMetrics(data);
  const typeBreakdown = buildTypeBreakdown(data);
  const trend = buildSelfTrend(data);

  els.dashboardMetrics.innerHTML = "";
  metrics.forEach((metric) => {
    const node = els.metricCardTemplate.content.cloneNode(true);
    node.querySelector(".metric-label").textContent = metric.label;
    node.querySelector(".metric-value").textContent = metric.value;
    node.querySelector(".metric-note").textContent = metric.note;
    els.dashboardMetrics.append(node);
  });

  renderTypeBreakdown(typeBreakdown);
  renderTrend(trend);
}

function renderTypeBreakdown(rows) {
  if (!rows.length) {
    els.dashboardTypeBreakdown.innerHTML = `<div class="empty-state">暂无统计数据。</div>`;
    return;
  }

  els.dashboardTypeBreakdown.innerHTML = rows
    .map(
      (row) => `
        <article class="stack-card">
          <div class="admin-row">
            <strong>${escapeHtml(row.name)}</strong>
            <span class="muted">${formatDuration(row.duration)}</span>
          </div>
          <div class="bar-track"><div class="bar" style="width:${row.ratio}%"></div></div>
        </article>
      `,
    )
    .join("");
}

function renderTrend(rows) {
  els.dashboardTrend.innerHTML = rows
    .map(
      (row) => `
        <article class="stack-card">
          <div class="admin-row">
            <strong>${row.label}</strong>
            <span class="muted">${formatDuration(row.duration)}</span>
          </div>
          <div class="bar-track"><div class="bar" style="width:${row.ratio}%"></div></div>
        </article>
      `,
    )
    .join("");
}

function renderManage() {
  const data = getData();
  renderTypeSelectOptions(data);
  renderTypeList(data);
  renderProjectAdminList(data);
  updateManageButtons();
}

function renderTypeSelectOptions(data) {
  const activeTypes = getActiveTypes(data);
  els.projectTypeSelect.innerHTML = activeTypes.length
    ? activeTypes.map((type) => `<option value="${type.id}">${escapeHtml(type.name)}</option>`).join("")
    : `<option value="">请先创建项目类型</option>`;
}

function renderTypeList(data) {
  const types = [...data.projectTypes].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  if (!types.length) {
    els.typeList.innerHTML = `<div class="empty-state">还没有项目类型，先建一层骨架。</div>`;
    return;
  }

  els.typeList.innerHTML = types
    .map((type) => {
      const count = data.projects.filter((project) => project.typeId === type.id).length;
      return `
        <article class="stack-card">
          <div class="admin-row">
            <div>
              <strong>${escapeHtml(type.name)}</strong>
              <p class="muted">${count} 个具体项目</p>
            </div>
            <div class="admin-actions">
              <button class="inline-button" type="button" data-edit-type="${type.id}">编辑</button>
              <button class="inline-button" type="button" data-delete-type="${type.id}">删除</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  els.typeList.querySelectorAll("[data-edit-type]").forEach((button) => {
    button.addEventListener("click", () => startTypeEdit(button.dataset.editType));
  });

  els.typeList.querySelectorAll("[data-delete-type]").forEach((button) => {
    button.addEventListener("click", () => deleteType(button.dataset.deleteType));
  });
}

function renderProjectAdminList(data) {
  const projects = [...data.projects].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  if (!projects.length) {
    els.projectAdminList.innerHTML = `<div class="empty-state">还没有具体项目，建完就能去首页直接开跑。</div>`;
    return;
  }

  els.projectAdminList.innerHTML = projects
    .map((project) => {
      const type = findType(data, project.typeId);
      return `
        <article class="stack-card ${project.archived ? "is-archived" : ""}">
          <div class="admin-row">
            <div>
              <strong>${escapeHtml(project.name)}</strong>
              <p class="muted">${escapeHtml(type?.name || "未分类")} · ${project.actor === "self" ? "本人" : "Agent"} · ${project.archived ? "已归档" : "可用"}</p>
            </div>
            <div class="admin-actions">
              <button class="inline-button" type="button" data-edit-project="${project.id}">编辑</button>
              <button class="inline-button" type="button" data-delete-project="${project.id}">${project.archived ? "已归档" : "归档"}</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  els.projectAdminList.querySelectorAll("[data-edit-project]").forEach((button) => {
    button.addEventListener("click", () => startProjectEdit(button.dataset.editProject));
  });

  els.projectAdminList.querySelectorAll("[data-delete-project]").forEach((button) => {
    button.addEventListener("click", () => archiveProject(button.dataset.deleteProject));
  });
}

function updateManageButtons() {
  els.typeSubmitButton.textContent = editState.typeId ? "保存项目类型" : "新增项目类型";
  els.projectSubmitButton.textContent = editState.projectId ? "保存具体项目" : "新增具体项目";
}

function handleTypeSubmit(event) {
  event.preventDefault();
  const name = els.typeNameInput.value.trim();

  if (!name) {
    return;
  }

  const data = getData();
  const duplicate = data.projectTypes.find((type) => type.name === name && type.id !== editState.typeId);
  if (duplicate) {
    window.alert("这个项目类型已经存在。");
    return;
  }

  if (editState.typeId) {
    data.projectTypes = data.projectTypes.map((type) => (type.id === editState.typeId ? { ...type, name } : type));
    editState.typeId = null;
  } else {
    data.projectTypes.unshift({
      id: crypto.randomUUID(),
      name,
      createdAt: nowMs(),
    });
  }

  saveData(data);
  els.typeForm.reset();
  render();
}

function handleProjectSubmit(event) {
  event.preventDefault();
  const name = els.projectNameInput.value.trim();
  const typeId = els.projectTypeSelect.value;
  const actor = els.projectActorSelect.value;
  const data = getData();

  if (!name || !typeId) {
    return;
  }

  const duplicate = data.projects.find((project) => project.name === name && project.id !== editState.projectId && !project.archived);
  if (duplicate) {
    window.alert("这个具体项目已经存在。");
    return;
  }

  if (editState.projectId) {
    data.projects = data.projects.map((project) =>
      project.id === editState.projectId
        ? {
            ...project,
            name,
            typeId,
            actor,
          }
        : project,
    );
    editState.projectId = null;
  } else {
    data.projects.unshift({
      id: crypto.randomUUID(),
      name,
      typeId,
      actor,
      archived: false,
      usageCount: 0,
      lastUsedAt: null,
      createdAt: nowMs(),
    });
  }

  saveData(data);
  els.projectForm.reset();
  render();
}

function startTypeEdit(typeId) {
  const data = getData();
  const type = findType(data, typeId);
  if (!type) {
    return;
  }

  editState.typeId = typeId;
  els.typeNameInput.value = type.name;
  updateManageButtons();
  state.currentView = "me";
  render();
}

function startProjectEdit(projectId) {
  const data = getData();
  const project = findProject(data, projectId);
  if (!project) {
    return;
  }

  editState.projectId = projectId;
  els.projectNameInput.value = project.name;
  els.projectTypeSelect.value = project.typeId;
  els.projectActorSelect.value = project.actor;
  updateManageButtons();
  state.currentView = "me";
  render();
}

function deleteType(typeId) {
  const data = getData();
  const relatedProjects = data.projects.filter((project) => project.typeId === typeId);
  if (relatedProjects.length) {
    window.alert("这个项目类型下面还有具体项目，先处理具体项目再删。");
    return;
  }

  data.projectTypes = data.projectTypes.filter((type) => type.id !== typeId);
  saveData(data);
  render();
}

function archiveProject(projectId) {
  const data = getData();
  const project = findProject(data, projectId);
  if (!project || project.archived) {
    return;
  }

  const runningSession = data.sessions.find((session) => session.projectId === projectId && !session.endAt);
  if (runningSession) {
    window.alert("这个项目还在运行，先停掉再归档。");
    return;
  }

  data.projects = data.projects.map((item) => (item.id === projectId ? { ...item, archived: true } : item));
  saveData(data);
  render();
}

function startProject(projectId) {
  const data = getData();
  const project = findProject(data, projectId);
  if (!project || project.archived) {
    return;
  }

  const now = new Date().toISOString();
  if (project.actor === "self") {
    data.sessions = data.sessions.map((session) => {
      const sessionProject = findProject(data, session.projectId);
      if (!session.endAt && sessionProject?.actor === "self") {
        return { ...session, endAt: now };
      }
      return session;
    });
  }

  data.sessions.unshift({
    id: crypto.randomUUID(),
    projectId,
    startAt: now,
    endAt: null,
    note: "",
    createdAt: nowMs(),
  });

  data.projects = data.projects.map((item) =>
    item.id === projectId
      ? {
          ...item,
          usageCount: (item.usageCount || 0) + 1,
          lastUsedAt: now,
        }
      : item,
  );

  saveData(data);
  state.currentView = "home";
  render();
}

function stopSession(sessionId) {
  const data = getData();
  const now = new Date().toISOString();
  data.sessions = data.sessions.map((session) => (session.id === sessionId && !session.endAt ? { ...session, endAt: now } : session));
  saveData(data);
  render();
}

function saveHistoryEdit(sessionId) {
  const startAtValue = document.querySelector(`#history-start-${CSS.escape(sessionId)}`).value;
  const endAtValue = document.querySelector(`#history-end-${CSS.escape(sessionId)}`).value;
  const note = document.querySelector(`#history-note-${CSS.escape(sessionId)}`).value.trim();

  if (!startAtValue) {
    window.alert("开始时间不能为空。");
    return;
  }

  const startAt = new Date(startAtValue).toISOString();
  const endAt = endAtValue ? new Date(endAtValue).toISOString() : null;
  if (endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
    window.alert("结束时间不能早于开始时间。");
    return;
  }

  const data = getData();
  data.sessions = data.sessions.map((session) =>
    session.id === sessionId
      ? {
          ...session,
          startAt,
          endAt,
          note,
        }
      : session,
  );

  saveData(data);
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
  if (mode === "duration") {
    return sorted.sort((a, b) => getSessionDurationMs(b) - getSessionDurationMs(a));
  }
  return sorted.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
}

function buildDashboardMetrics(data) {
  const sessions = data.sessions.filter((session) => session.endAt);
  const selfSessions = sessions.filter((session) => findProject(data, session.projectId)?.actor === "self");
  const agentSessions = sessions.filter((session) => findProject(data, session.projectId)?.actor === "agent");
  const today = dateKey(new Date());
  const weekStart = startOfWeek(new Date());
  const monthStart = startOfMonth(new Date());

  const todaySelf = selfSessions.filter((session) => dateKey(new Date(session.startAt)) === today);
  const weekSelf = selfSessions.filter((session) => new Date(session.startAt) >= weekStart);
  const monthSelf = selfSessions.filter((session) => new Date(session.startAt) >= monthStart);

  return [
    { label: "今日本人投入", value: formatDuration(sumDurations(todaySelf)), note: "只统计执行主体为本人。" },
    { label: "本周本人投入", value: formatDuration(sumDurations(weekSelf)), note: "看你这一周到底花去哪了。" },
    { label: "本月本人投入", value: formatDuration(sumDurations(monthSelf)), note: "月度时间账本总量。" },
    { label: "累计 Agent 耗时", value: formatDuration(sumDurations(agentSessions)), note: "并行推进，但不算你本人时间。" },
  ];
}

function buildTypeBreakdown(data) {
  const selfSessions = data.sessions.filter((session) => session.endAt && findProject(data, session.projectId)?.actor === "self");
  const durationByType = new Map();
  selfSessions.forEach((session) => {
    const project = findProject(data, session.projectId);
    const type = findType(data, project?.typeId);
    const key = type?.name || "未分类";
    durationByType.set(key, (durationByType.get(key) || 0) + getSessionDurationMs(session));
  });

  const total = [...durationByType.values()].reduce((sum, value) => sum + value, 0) || 1;
  return [...durationByType.entries()]
    .map(([name, duration]) => ({ name, duration, ratio: Math.round((duration / total) * 100) }))
    .sort((a, b) => b.duration - a.duration);
}

function buildSelfTrend(data) {
  const labels = getPastDays(7);
  const totals = labels.map((date) => {
    const duration = sumDurations(
      data.sessions.filter((session) => {
        const project = findProject(data, session.projectId);
        return session.endAt && project?.actor === "self" && dateKey(new Date(session.startAt)) === date;
      }),
    );
    return { label: formatMonthDay(date), duration };
  });

  const max = Math.max(...totals.map((item) => item.duration), 1);
  return totals.map((item) => ({ ...item, ratio: Math.round((item.duration / max) * 100) }));
}

function resetSeedData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(createSeedData()));
  editState = { typeId: null, projectId: null };
  state.projectSearch = "";
  state.projectSortMode = "recent";
  state.historySortMode = "desc";
  state.currentView = "home";
  render();
}

function getData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : createSeedData();
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function ensureSeedData() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(createSeedData()));
  }
}

function createSeedData() {
  const typeLifeId = crypto.randomUUID();
  const typeWorkId = crypto.randomUUID();
  const typeLearnId = crypto.randomUUID();
  const selfWalkId = crypto.randomUUID();
  const selfReadingId = crypto.randomUUID();
  const selfDesignId = crypto.randomUUID();
  const agentTrainId = crypto.randomUUID();
  const agentExportId = crypto.randomUUID();

  const now = new Date();
  const hour = 60 * 60 * 1000;

  return {
    projectTypes: [
      { id: typeLifeId, name: "生活", createdAt: nowMs() - 10 * hour },
      { id: typeWorkId, name: "工作", createdAt: nowMs() - 9 * hour },
      { id: typeLearnId, name: "学习", createdAt: nowMs() - 8 * hour },
    ],
    projects: [
      { id: selfWalkId, name: "散步", typeId: typeLifeId, actor: "self", archived: false, usageCount: 6, lastUsedAt: isoOffset(-3 * hour), createdAt: nowMs() - 7 * hour },
      { id: selfReadingId, name: "阅读", typeId: typeLearnId, actor: "self", archived: false, usageCount: 11, lastUsedAt: isoOffset(-20 * hour), createdAt: nowMs() - 6 * hour },
      { id: selfDesignId, name: "产品设计", typeId: typeWorkId, actor: "self", archived: false, usageCount: 9, lastUsedAt: isoOffset(-26 * hour), createdAt: nowMs() - 5 * hour },
      { id: agentTrainId, name: "跑训练", typeId: typeWorkId, actor: "agent", archived: false, usageCount: 8, lastUsedAt: isoOffset(-4 * hour), createdAt: nowMs() - 4 * hour },
      { id: agentExportId, name: "批量导出", typeId: typeWorkId, actor: "agent", archived: false, usageCount: 4, lastUsedAt: isoOffset(-52 * hour), createdAt: nowMs() - 3 * hour },
    ],
    sessions: [
      { id: crypto.randomUUID(), projectId: selfWalkId, startAt: isoOffset(-3 * hour), endAt: isoOffset(-2.5 * hour), note: "走了一圈，脑子清了一点。", createdAt: nowMs() - 3 * hour },
      { id: crypto.randomUUID(), projectId: agentTrainId, startAt: isoOffset(-4 * hour), endAt: isoOffset(-2 * hour), note: "模型训练一版，后续看日志。", createdAt: nowMs() - 4 * hour },
      { id: crypto.randomUUID(), projectId: selfReadingId, startAt: isoOffset(-26 * hour), endAt: isoOffset(-25.25 * hour), note: "读了一章，标了几个点。", createdAt: nowMs() - 26 * hour },
      { id: crypto.randomUUID(), projectId: selfDesignId, startAt: isoOffset(-50 * hour), endAt: isoOffset(-48.5 * hour), note: "整理了首页最小闭环。", createdAt: nowMs() - 50 * hour },
      { id: crypto.randomUUID(), projectId: agentExportId, startAt: isoOffset(-52 * hour), endAt: isoOffset(-51.2 * hour), note: "导出样本做比对。", createdAt: nowMs() - 52 * hour },
    ],
  };
}

function getVisibleProjects(data) {
  return data.projects.filter((project) => !project.archived);
}

function filterProjects(projects, query) {
  if (!query) {
    return projects;
  }
  return projects.filter((project) => project.name.toLowerCase().includes(query.toLowerCase()));
}

function getRunningSelfSession(data) {
  return data.sessions.find((session) => !session.endAt && findProject(data, session.projectId)?.actor === "self");
}

function getRunningAgentSessions(data) {
  return data.sessions.filter((session) => !session.endAt && findProject(data, session.projectId)?.actor === "agent");
}

function getActiveTypes(data) {
  return data.projectTypes;
}

function findProject(data, projectId) {
  return data.projects.find((project) => project.id === projectId);
}

function findType(data, typeId) {
  return data.projectTypes.find((type) => type.id === typeId);
}

function compareDateDesc(a, b) {
  return new Date(b || 0).getTime() - new Date(a || 0).getTime();
}

function getSessionDurationMs(session) {
  const end = session.endAt ? new Date(session.endAt).getTime() : nowMs();
  return Math.max(0, end - new Date(session.startAt).getTime());
}

function sumDurations(sessions) {
  return sessions.reduce((sum, session) => sum + getSessionDurationMs(session), 0);
}

function startTimer() {
  clearInterval(timerHandle);
  timerHandle = window.setInterval(() => {
    const data = getData();
    if (getRunningSelfSession(data) || getRunningAgentSessions(data).length) {
      if (state.currentView === "home") {
        renderHome();
      }
      if (state.currentView === "history") {
        renderHistory();
      }
    }
  }, 1000);
}

function nowMs() {
  return Date.now();
}

function isoOffset(offsetMs) {
  return new Date(nowMs() + offsetMs).toISOString();
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
  const diffMinutes = Math.round((nowMs() - new Date(isoString).getTime()) / 60000);
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

function getPastDays(days) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - index - 1));
    return dateKey(date);
  });
}

function formatMonthDay(dateString) {
  const [year, month, day] = dateString.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function toLocalInputValue(isoString) {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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
