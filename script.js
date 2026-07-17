const SUPABASE_URL = "https://otpzsnsrxcfuysjfnguk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_l352tRKAwJS8Dw0m4JRgPA_X9gndbC7";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const pipelineColumns = [
  { id: "responded_email", title: "Responded to Email", color: "#2563eb" },
  { id: "meeting_booked", title: "Meeting Booked", color: "#0f766e" },
  { id: "meeting_done", title: "Meeting Done", color: "#0891b2" },
  { id: "proposal_sent", title: "Proposal Sent", color: "#b45309" },
  { id: "follow_up", title: "Follow Up", color: "#7c3aed" },
  { id: "contract_signed", title: "Contract Signed", color: "#15803d" },
  { id: "kickoff", title: "Kickoff", color: "#0e7490" },
  { id: "in_progress", title: "In Progress", color: "#4f46e5" },
  { id: "review", title: "Review", color: "#be123c" },
  { id: "project_done", title: "Project Done", color: "#166534" }
];

const projectColumns = [
  { id: "project_brief", title: "Project Brief", color: "#64748b" },
  { id: "project_planning", title: "Planning", color: "#2563eb" },
  { id: "project_kickoff", title: "Kickoff", color: "#0f766e" },
  { id: "project_build", title: "Build", color: "#4f46e5" },
  { id: "project_qa", title: "QA / Review", color: "#b45309" },
  { id: "client_approval", title: "Client Approval", color: "#7c3aed" },
  { id: "project_delivered", title: "Delivered", color: "#0891b2" },
  { id: "project_closed", title: "Closed", color: "#15803d" }
];

const seedItems = [
  { id: "a1", type: "deal", title: "Enterprise onboarding", company: "Lumen Forge", owner: "Ava", priority: "high", value: 42000, due: "2026-07-08", status: "meeting_booked", notes: "Security review is scheduled. Send revised implementation timeline before the call." },
  { id: "a2", type: "project", title: "Client portal rollout", company: "Mira Health", owner: "Noah", priority: "medium", value: 18000, due: "2026-07-12", status: "in_progress", notes: "Design QA passed. Waiting on single sign-on configuration from client IT." },
  { id: "a3", type: "task", title: "Renewal proposal", company: "Orbit Labs", owner: "Mina", priority: "high", value: 9600, due: "2026-07-05", status: "proposal_sent", notes: "Add usage expansion line item and include the support SLA option." },
  { id: "a4", type: "deal", title: "Analytics migration", company: "Harbor & Co.", owner: "Ava", priority: "medium", value: 26500, due: "2026-07-19", status: "responded_email", notes: "Discovery notes mention fragmented reporting and a November renewal deadline." },
  { id: "a5", type: "project", title: "Workflow automation", company: "Clearbit Studio", owner: "Jules", priority: "low", value: 12400, due: "2026-07-22", status: "kickoff", notes: "Automate intake, approval, and client notification steps." },
  { id: "a6", type: "deal", title: "Retainer expansion", company: "Northline Bank", owner: "Mina", priority: "medium", value: 33000, due: "2026-07-30", status: "contract_signed", notes: "Pilot team is happy. Procurement needs a month-to-month rider." },
  { id: "a7", type: "task", title: "Resolve data import blocker", company: "Mira Health", owner: "Noah", priority: "high", value: 0, due: "2026-07-06", status: "blocked", notes: "CSV includes mixed encodings. Validate normalized export before next import." }
];

const ROLES = ["admin", "manager", "owner", "viewer"];
const ADMIN_BOOTSTRAP_EMAILS = ["iseo6lu@gmail.com", "iseolu6@gmail.com"];
const NAV_VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "pipeline", label: "Pipeline" },
  { id: "projects", label: "Projects" },
  { id: "activity", label: "Activity" },
  { id: "documents", label: "Documents" },
  { id: "messages", label: "Messages" },
  { id: "approvals", label: "Approvals" },
  { id: "focus", label: "Focus" },
  { id: "team", label: "Team" },
  { id: "pricing", label: "Pricing" },
  { id: "profile", label: "My Profile" }
];

const state = {
  view: "overview",
  type: "all",
  search: "",
  owner: "all",
  priority: "all",
  selectedId: null,
  session: null,
  profile: null,
  loading: true,
  realtimeChannel: null,
  activities: [],
  changeRequests: [],
  items: [],
  documents: [],
  teamProfiles: [],
  teamViewsOpenId: null,
  inviteFormOpen: false,
  services: [],
  editingServiceId: null,
  calcQty: {},
  calcDiscount: 0,
  calcTax: 0,
  theme: localStorage.getItem("crm-theme") || "light",
  previewDoc: null,
  docFilterItem: "all",
  messages: [],
  messageThreadWith: null,
  messageThreadEmail: null,
  messageComposeOpen: false
};

document.documentElement.dataset.theme = state.theme;

const loginScreen = document.getElementById("loginScreen");
const appRoot = document.getElementById("appRoot");
const board = document.getElementById("board");
const searchInput = document.getElementById("search");
const ownerFilter = document.getElementById("ownerFilter");
const priorityFilter = document.getElementById("priorityFilter");
const detail = document.getElementById("detail");
const sidePanel = document.getElementById("sidePanel");
const sideTitle = document.getElementById("sideTitle");
const toast = document.getElementById("toast");
const signOutBtn = document.getElementById("signOutBtn");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const loginSubmit = document.getElementById("loginSubmit");
const profileMenu = document.getElementById("profileMenu");
const profileDropdown = document.getElementById("profileDropdown");
const previewOverlay = document.getElementById("previewOverlay");
const previewTitle = document.getElementById("previewTitle");
const previewBody = document.getElementById("previewBody");
const confirmOverlay = document.getElementById("confirmOverlay");

function columns() {
  return state.view === "projects" ? projectColumns : pipelineColumns;
}

function visibleItems() {
  return state.items;
}

function visibleActivities() {
  return state.activities;
}

function visibleDocuments() {
  return state.documents;
}

function pendingRequests() {
  return state.changeRequests.filter(request => request.status === "pending");
}

function pendingRequestsForItem(id) {
  return pendingRequests().filter(request => request.board_item_id === id);
}

function currentRole() {
  return state.profile?.role || "owner";
}

function isAdmin() {
  return currentRole() === "admin";
}

function isManager() {
  return currentRole() === "manager" || currentRole() === "admin";
}

function isViewer() {
  return currentRole() === "viewer";
}

function canEdit() {
  return Boolean(state.session) && !isViewer();
}

function roleAllowsView(view) {
  if (view === "pricing") return isAdmin();
  if (view === "pipeline") return isAdmin();
  if (view === "team") return isManager();
  return true;
}

function canSeeFinancials() {
  return isAdmin();
}

function canSeeView(view) {
  if (!roleAllowsView(view)) return false;
  const allowed = state.profile?.allowed_views;
  if (!allowed || !allowed.length) return true;
  return allowed.includes(view);
}

function firstAllowedView() {
  const match = NAV_VIEWS.find(entry => canSeeView(entry.id));
  return match ? match.id : "overview";
}

function normalizeStatus(item) {
  const available = columns().map(column => column.id);
  if (available.includes(item.status)) return item.status;
  if (state.view === "projects") return item.type === "project" ? "project_build" : "project_brief";
  return item.type === "deal" ? "meeting_booked" : "responded_email";
}

function filteredItems() {
  const query = state.search.trim().toLowerCase();
  return visibleItems().filter(item => {
    const typeOk = state.type === "all" || item.type === state.type;
    const ownerOk = state.owner === "all" || item.owner === state.owner;
    const priorityOk = state.priority === "all" || item.priority === state.priority;
    const viewOk = state.view !== "focus" || item.priority === "high" || daysUntil(item.due) <= 7;
    const text = [item.title, item.company, item.owner, item.notes, item.type].join(" ").toLowerCase();
    return typeOk && ownerOk && priorityOk && viewOk && (!query || text.includes(query));
  });
}

function render() {
  if (!state.session) {
    showLoginScreen();
    return;
  }
  if (!state.loading && !canSeeView(state.view)) {
    state.view = firstAllowedView();
  }
  showAppScreen();
  renderChrome();
  renderTopbar();
  renderFilters();
  renderBoard();
  renderMetrics();
  renderDetail();
}

function showLoginScreen() {
  loginScreen.hidden = false;
  appRoot.hidden = true;
}

function showAppScreen() {
  loginScreen.hidden = true;
  appRoot.hidden = false;
}

function renderChrome() {
  const copy = {
    overview: ["CRM Overview", "See the journey, open value, project health, and today's daily work."],
    pipeline: ["Client Journey", "Move every account from responded email to project done."],
    projects: ["Project Delivery", "Move client work from backlog through shipped outcomes."],
    activity: ["Daily Activities", "Track calls, emails, proposals, delivery work, and admin follow-ups."],
    documents: ["Documents", "Upload, organize, and preview files linked to accounts and projects."],
    messages: ["Messages", "Direct messages between you and your manager or teammates."],
    approvals: ["Approval Queue", "Review team changes before they become approved CRM records."],
    focus: ["Focus Queue", "High-priority and near-due work across the whole book."],
    team: ["Team", "Manage teammate roles and access."],
    pricing: ["Pricing Calculator", "Manage the service catalog and quote a client."],
    profile: ["My Profile", "Your account, contact, and HR details."]
  };
  document.getElementById("viewTitle").textContent = copy[state.view][0];
  document.getElementById("viewSubtitle").textContent = copy[state.view][1];
  document.querySelectorAll(".nav button").forEach(button => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
  document.querySelectorAll(".segmented button").forEach(button => {
    button.classList.toggle("active", button.dataset.type === state.type);
  });
  const approvalCount = document.getElementById("approvalCount");
  if (approvalCount) {
    approvalCount.textContent = pendingRequests().length;
    approvalCount.classList.toggle("show", Boolean(state.session && pendingRequests().length));
  }
  const messageCount = document.getElementById("messageCount");
  if (messageCount) {
    const unread = unreadMessageCount();
    messageCount.textContent = unread;
    messageCount.classList.toggle("show", Boolean(state.session && unread));
  }
  NAV_VIEWS.forEach(entry => {
    const button = document.querySelector(`.nav button[data-view="${entry.id}"]`);
    if (button) button.hidden = !canSeeView(entry.id);
  });
  document.querySelector(".toolbar").hidden = ["overview", "activity", "documents", "messages", "approvals", "team", "pricing", "profile"].includes(state.view);
}

function renderTopbar() {
  const signedIn = Boolean(state.session);
  document.getElementById("addBtn").hidden = !["pipeline", "projects", "focus"].includes(state.view);
  document.getElementById("addBtn").disabled = !canEdit();
  profileMenu.hidden = !signedIn;

  if (signedIn) {
    const email = state.session.user.email || "";
    document.getElementById("profileAvatarBtn").textContent = email.slice(0, 1).toUpperCase() || "?";
    document.getElementById("profileEmail").textContent = email;
    document.getElementById("profileRoleLine").innerHTML = `<span class="role-badge">${label(currentRole())}</span>`;
  }
}

function renderFilters() {
  const owners = Array.from(new Set(visibleItems().map(item => item.owner))).sort();
  ownerFilter.innerHTML = `<option value="all">All owners</option>` + owners.map(owner => (
    `<option value="${escapeHtml(owner)}">${escapeHtml(owner)}</option>`
  )).join("");
  ownerFilter.value = state.owner;
  priorityFilter.value = state.priority;
}

function renderBoard() {
  if (state.loading) {
    board.innerHTML = `<div class="empty">Loading the CRM database...</div>`;
    return;
  }

  if (state.view === "overview") {
    renderOverview();
    return;
  }

  if (state.view === "activity") {
    renderActivityView();
    return;
  }

  if (state.view === "approvals") {
    renderApprovalsView();
    return;
  }

  if (state.view === "documents") {
    renderDocumentsView();
    return;
  }

  if (state.view === "messages") {
    renderMessagesView();
    return;
  }

  if (state.view === "team") {
    renderTeamView();
    return;
  }

  if (state.view === "pricing") {
    renderPricingView();
    return;
  }

  if (state.view === "profile") {
    renderProfileView();
    return;
  }

  const items = filteredItems();
  const activeColumns = state.view === "focus" ? [
    { id: "overdue", title: "Overdue", color: "#be123c" },
    { id: "soon", title: "Next 7 days", color: "#b45309" },
    { id: "later", title: "Later", color: "#0f766e" }
  ] : columns();

  board.innerHTML = activeColumns.map(column => {
    const columnItems = items.filter(item => itemColumn(item) === column.id);
    return `
      <article class="column">
        <div class="column-head">
          <h2><span class="dot" style="background:${column.color}"></span>${column.title}</h2>
          <span class="count">${columnItems.length}</span>
        </div>
        <div class="lane" data-status="${column.id}">
          ${columnItems.map(renderCard).join("")}
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => selectItem(card.dataset.id));
    card.addEventListener("dragstart", event => {
      event.dataTransfer.setData("text/plain", card.dataset.id);
    });
  });

  document.querySelectorAll(".lane").forEach(lane => {
    lane.addEventListener("dragover", event => {
      if (state.view === "focus") return;
      event.preventDefault();
      lane.classList.add("drag-over");
    });
    lane.addEventListener("dragleave", () => lane.classList.remove("drag-over"));
    lane.addEventListener("drop", event => {
      event.preventDefault();
      lane.classList.remove("drag-over");
      moveItem(event.dataTransfer.getData("text/plain"), lane.dataset.status);
    });
  });
}

function renderOverview() {
  const items = visibleItems();
  const doneStatuses = ["project_done", "project_delivered", "project_closed"];
  const doneCount = items.filter(item => doneStatuses.includes(item.status)).length;
  const activeCount = items.filter(item => !doneStatuses.includes(item.status)).length;
  const openValue = items
    .filter(item => !doneStatuses.includes(item.status))
    .reduce((sum, item) => sum + Number(item.value || 0), 0);
  const expectedValue = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const actualValue = items
    .filter(item => doneStatuses.includes(item.status))
    .reduce((sum, item) => sum + Number(item.value || 0), 0);
  const expectedProjects = items.filter(item => item.type === "project").length;
  const actualProjects = items.filter(item => item.type === "project" && doneStatuses.includes(item.status)).length;
  const expectedActivities = visibleActivities().length;
  const todayActivities = activitiesForToday();
  const completedToday = todayActivities.filter(activity => activity.completed).length;
  const actualActivities = visibleActivities().filter(activity => activity.completed).length;
  const roleBanner = `<div class="empty">${isManager() ? "Manager dashboard: you can see team CRM records allowed by Supabase policies and approve pending team edits." : "Personal dashboard: you see approved records. Your edits are sent for manager approval before they change the board."}</div>`;

  board.innerHTML = `
    <section class="overview" aria-label="CRM overview dashboard">
      ${roleBanner}
      <div class="kpi-grid">
        ${renderKpi("Open accounts", activeCount)}
        ${canSeeFinancials() ? renderKpi("Open value", money(openValue)) : renderKpi("Open projects", expectedProjects)}
        ${renderKpi("Done projects", doneCount)}
        ${renderKpi("Today done", `${completedToday}/${todayActivities.length}`)}
        ${renderKpi("Pending edits", pendingRequests().length)}
        ${renderKpi("Access", label(currentRole()))}
      </div>
      <div class="dashboard-grid">
        <div class="activity-panel">
          <h2>Expected vs Actual</h2>
          <div class="metric-table">
            <div class="metric-row header"><span>Area</span><span>Expected</span><span>Actual</span><span>Gap</span></div>
            ${canSeeFinancials() ? renderMetricRow("Revenue", money(expectedValue), money(actualValue), money(expectedValue - actualValue)) : ""}
            ${renderMetricRow("Projects", expectedProjects, actualProjects, expectedProjects - actualProjects)}
            ${renderMetricRow("Activities", expectedActivities, actualActivities, expectedActivities - actualActivities)}
          </div>
        </div>
        <div class="activity-panel">
          <h2>Performance Graph</h2>
          <div class="split-bars">
            ${canSeeFinancials() ? renderDualBar("Revenue", expectedValue, actualValue, "#0f766e") : ""}
            ${renderDualBar("Projects", expectedProjects, actualProjects, "#2563eb")}
            ${renderDualBar("Activities", expectedActivities, actualActivities, "#b45309")}
          </div>
        </div>
      </div>
      <div class="journey">
        <h2>Client Journey</h2>
        <div class="journey-steps">
          ${pipelineColumns.map(step => {
            const count = items.filter(item => item.status === step.id).length;
            return `<div class="journey-step"><strong>${count}</strong><span>${step.title}</span></div>`;
          }).join("")}
        </div>
      </div>
      <div class="dashboard-grid">
        <div class="activity-panel">
          <h2>Journey Graph</h2>
          <div class="chart">${renderStageChart(pipelineColumns, items)}</div>
        </div>
        <div class="activity-panel">
          <h2>Project Stage Graph</h2>
          <div class="chart">${renderStageChart(projectColumns, items.filter(item => item.type === "project"))}</div>
        </div>
      </div>
      <div class="overview-grid">
        <div class="activity-panel">
          <h2>Recently Active</h2>
          <div class="activity-list">
            ${items.slice(0, 6).map(item => `
              <div class="activity-item">
                <span class="dot" style="background:${statusColor(item.status)}"></span>
                <div><strong>${escapeHtml(item.company)}</strong><span>${escapeHtml(item.title)} - ${statusTitle(item.status)}</span></div>
                <span class="value">${canSeeFinancials() && item.value ? money(item.value) : dueLabel(item.due)}</span>
              </div>
            `).join("") || `<div class="empty">No accounts yet. Create a card to start the journey.</div>`}
          </div>
        </div>
        <div class="activity-panel">
          <h2>Today</h2>
          ${renderActivityComposer()}
          <div class="activity-list">${renderActivityItems(todayActivities, true)}</div>
        </div>
      </div>
    </section>
  `;
  bindActivityControls();
}

function renderApprovalsView() {
  const requests = pendingRequests();
  board.innerHTML = `
    <section class="overview" aria-label="Approval queue">
      <div class="activity-panel">
        <h2>${isManager() ? "Pending Team Edits" : "My Pending Edits"}</h2>
        <div class="approval-list">
          ${requests.map(renderApprovalCard).join("") || `<div class="empty">${isManager() ? "No team edits are waiting for approval." : "You do not have pending edits right now."}</div>`}
        </div>
      </div>
    </section>
  `;

  document.querySelectorAll("[data-cancel-id]").forEach(button => {
    button.addEventListener("click", () => {
      confirmAction("Withdraw this pending request? It will not be applied.", () => cancelChangeRequest(button.dataset.cancelId), { confirmLabel: "Withdraw" });
    });
  });

  if (!isManager()) return;
  document.querySelectorAll("[data-approve-id]").forEach(button => {
    button.addEventListener("click", () => reviewChangeRequest(button.dataset.approveId, "approved"));
  });
  document.querySelectorAll("[data-reject-id]").forEach(button => {
    button.addEventListener("click", () => reviewChangeRequest(button.dataset.rejectId, "rejected"));
  });
}

function renderApprovalCard(request) {
  const item = state.items.find(candidate => candidate.id === request.board_item_id);
  const title = request.payload?.title || item?.title || "New CRM item";
  const company = request.payload?.company || item?.company || "Pending account";
  const action = label(request.action);
  const isOwnRequest = request.requested_by === state.session?.user?.id;
  const requestedBy = isOwnRequest ? "You" : shortId(request.requested_by);
  return `
    <article class="approval-card">
      <header>
        <div>
          <h3>${escapeHtml(company)} - ${escapeHtml(title)}</h3>
          <p>${action} requested by ${escapeHtml(requestedBy)} on ${dateLabel((request.requested_at || "").slice(0, 10))}</p>
        </div>
        <span class="pill">${label(request.status)}</span>
      </header>
      <div class="approval-fields">
        ${renderChangeFields(request)}
      </div>
      ${isManager() ? `
        <div class="approval-actions">
          ${isOwnRequest ? `<button type="button" data-cancel-id="${request.id}">Withdraw</button>` : ""}
          <button class="danger" type="button" data-reject-id="${request.id}">Reject</button>
          <button class="primary" type="button" data-approve-id="${request.id}">Approve</button>
        </div>
      ` : `
        <div class="approval-actions">
          ${isOwnRequest ? `<button type="button" data-cancel-id="${request.id}">Withdraw</button>` : ""}
        </div>
        <div class="status-note">Waiting for manager approval. The approved board will not change until this is reviewed.</div>
      `}
    </article>
  `;
}

function renderChangeFields(request) {
  const before = request.before_payload || {};
  const after = request.payload || {};
  if (request.action === "delete") {
    return `<div class="approval-field"><strong>Delete</strong><span>${escapeHtml(before.company || "Account")} - ${escapeHtml(before.title || "CRM item")}</span></div>`;
  }
  return ["title", "company", "owner", "type", "priority", "status", "value", "due", "notes", "document_url"].map(key => {
    if (key === "value" && !canSeeFinancials()) return "";
    const previous = before[key];
    const next = after[key];
    if (request.action === "update" && String(previous ?? "") === String(next ?? "")) return "";
    return `<div class="approval-field"><strong>${label(key)}</strong><span>${formatChangeValue(previous)} -> ${formatChangeValue(next)}</span></div>`;
  }).join("") || `<div class="approval-field"><strong>Change</strong><span>No visible field changes.</span></div>`;
}

function renderActivityView() {
  const grouped = visibleActivities().reduce((groups, activity) => {
    const key = activity.activity_date || todayIso();
    groups[key] ||= [];
    groups[key].push(activity);
    return groups;
  }, {});

  board.innerHTML = `
    <section class="overview" aria-label="Daily activity tracking">
      <div class="activity-panel">
        <h2>New Activity</h2>
        ${renderActivityComposer()}
      </div>
      ${Object.keys(grouped).sort().reverse().map(date => `
        <div class="activity-panel">
          <h2>${dateLabel(date)}</h2>
          <div class="activity-list">${renderActivityItems(grouped[date], true)}</div>
        </div>
      `).join("") || `<div class="empty">No daily activities yet. Add your first email, call, meeting, or delivery task.</div>`}
    </section>
  `;
  bindActivityControls();
}

function renderDocumentsView() {
  const docs = visibleDocuments()
    .filter(doc => state.docFilterItem === "all" || doc.board_item_id === state.docFilterItem)
    .slice()
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  const linkableItems = visibleItems();
  const canUpload = !isViewer();

  board.innerHTML = `
    <section class="overview" aria-label="Document library">
      ${canUpload ? `
        <div class="activity-panel">
          <h2>Upload a document</h2>
          <div class="dropzone" id="dropzone" tabindex="0">
            <strong>Drag & drop files here, or click to browse</strong>
            <span>PDF, images, and office documents up to 20 MB each &mdash; select as many as you need</span>
          </div>
          <input type="file" id="fileInput" multiple hidden>
          <label>Link to account or project
            <select id="uploadLinkSelect">
              <option value="">No linked account</option>
              ${linkableItems.map(item => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.company)} - ${escapeHtml(item.title)}</option>`).join("")}
            </select>
          </label>
        </div>
      ` : ""}
      <div class="activity-panel">
        <div class="doc-filters">
          <h2 style="margin:0;flex:1;">Files (${docs.length})</h2>
          <select id="docFilterSelect" aria-label="Filter by linked account">
            <option value="all">All accounts</option>
            ${linkableItems.map(item => `<option value="${escapeAttr(item.id)}" ${state.docFilterItem === item.id ? "selected" : ""}>${escapeHtml(item.company)} - ${escapeHtml(item.title)}</option>`).join("")}
          </select>
        </div>
        <div class="doc-grid">
          ${docs.map(renderDocCard).join("") || `<div class="empty">No documents yet. ${canUpload ? "Upload the first file above." : "Sign in to upload files."}</div>`}
        </div>
      </div>
    </section>
  `;
  bindDocumentControls();
}

function renderDocCard(doc) {
  const item = visibleItems().find(candidate => candidate.id === doc.board_item_id);
  const canDelete = state.session && (isManager() || doc.uploaded_by === state.session?.user?.id);
  return `
    <article class="doc-card" data-doc-id="${doc.id}">
      <div class="doc-icon">${docIcon(doc.file_type)}</div>
      <h3>${escapeHtml(doc.file_name)}</h3>
      <span>${item ? escapeHtml(item.company) : "No linked account"}</span>
      <span>${formatBytes(doc.file_size)} &middot; ${dateLabel((doc.created_at || "").slice(0, 10))}</span>
      <div class="doc-actions">
        <button type="button" class="doc-preview-btn" data-doc-id="${doc.id}">Preview</button>
        ${canDelete ? `<button type="button" class="mini-delete doc-delete-btn" data-doc-id="${doc.id}" title="Delete">&times;</button>` : ""}
      </div>
    </article>
  `;
}

function docIcon(fileType = "") {
  if (fileType.startsWith("image/")) return "🖼";
  if (fileType.includes("pdf")) return "📄";
  if (fileType.includes("word") || fileType.includes("document")) return "📝";
  if (fileType.includes("sheet") || fileType.includes("excel")) return "📊";
  return "📁";
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function bindDocumentControls() {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const linkSelect = document.getElementById("uploadLinkSelect");
  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") fileInput.click();
    });
    fileInput.addEventListener("change", () => {
      uploadDocuments(fileInput.files, linkSelect?.value || "");
      fileInput.value = "";
    });
    dropzone.addEventListener("dragover", event => {
      event.preventDefault();
      dropzone.classList.add("drag-over");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
    dropzone.addEventListener("drop", event => {
      event.preventDefault();
      dropzone.classList.remove("drag-over");
      uploadDocuments(event.dataTransfer.files, linkSelect?.value || "");
    });
  }

  const docFilterSelect = document.getElementById("docFilterSelect");
  if (docFilterSelect) {
    docFilterSelect.addEventListener("change", event => {
      state.docFilterItem = event.target.value;
      renderBoard();
    });
  }

  document.querySelectorAll(".doc-preview-btn").forEach(button => {
    button.addEventListener("click", () => openPreview(button.dataset.docId));
  });
  document.querySelectorAll(".doc-delete-btn").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      confirmAction("Delete this document? This can't be undone.", () => deleteDocument(button.dataset.docId));
    });
  });
}

function friendlyUploadError(message) {
  if (/bucket/i.test(message) && /not\s*found/i.test(message)) {
    return `Storage bucket not found. Ask your admin to run supabase-schema.sql (or create a private "crm-documents" bucket in Supabase → Storage) before uploading.`;
  }
  return message;
}

async function uploadOneDocument(file, boardItemId) {
  if (file.size > 20 * 1024 * 1024) {
    return { ok: false, error: `${file.name}: files must be smaller than 20 MB` };
  }

  const path = `${state.session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${file.name}`;
  const { error: uploadError } = await supabaseClient.storage
    .from("crm-documents")
    .upload(path, file);

  if (uploadError) {
    return { ok: false, error: `${file.name}: ${friendlyUploadError(uploadError.message)}` };
  }

  const { data, error } = await supabaseClient
    .from("crm_documents")
    .insert({
      board_item_id: boardItemId || null,
      file_name: file.name,
      file_path: path,
      file_type: file.type || "application/octet-stream",
      file_size: file.size,
      uploaded_by: state.session.user.id
    })
    .select("id,board_item_id,file_name,file_path,file_type,file_size,description,uploaded_by,created_at")
    .single();

  if (error) {
    return { ok: false, error: `${file.name}: ${error.message}` };
  }

  return { ok: true, data };
}

async function uploadDocuments(fileList, boardItemId) {
  if (!canEdit()) {
    flash(isViewer() ? "Viewers have read-only access" : "Sign in to upload documents");
    return;
  }
  const files = Array.from(fileList || []);
  if (!files.length) return;

  flash(files.length > 1 ? `Uploading ${files.length} files...` : "Uploading...");
  let succeeded = 0;
  const errors = [];
  for (const file of files) {
    const result = await uploadOneDocument(file, boardItemId);
    if (result.ok) {
      state.documents.unshift(result.data);
      succeeded++;
    } else {
      errors.push(result.error);
    }
  }

  render();
  if (errors.length) {
    const suffix = errors.length > 1 ? ` (+${errors.length - 1} more failed)` : "";
    flash(`${succeeded ? `${succeeded} uploaded. ` : ""}${errors[0]}${suffix}`);
  } else {
    flash(succeeded === 1 ? "Document uploaded" : `${succeeded} documents uploaded`);
  }
}

async function deleteDocument(id) {
  const doc = state.documents.find(candidate => candidate.id === id);
  if (!doc) return;

  const { error: storageError } = await supabaseClient.storage.from("crm-documents").remove([doc.file_path]);
  if (storageError) {
    flash(storageError.message);
    return;
  }

  const { error } = await supabaseClient.from("crm_documents").delete().eq("id", id);
  if (error) {
    flash(error.message);
    return;
  }

  state.documents = state.documents.filter(candidate => candidate.id !== id);
  if (state.previewDoc?.id === id) closePreview();
  render();
  flash("Document deleted");
}

async function openPreview(id) {
  const doc = visibleDocuments().find(candidate => candidate.id === id);
  if (!doc) return;
  state.previewDoc = doc;
  previewTitle.textContent = doc.file_name;
  previewOverlay.hidden = false;

  previewBody.innerHTML = `<div class="empty">Loading preview...</div>`;
  const { data, error } = await supabaseClient.storage
    .from("crm-documents")
    .createSignedUrl(doc.file_path, 300);

  if (error) {
    previewBody.innerHTML = `<div class="empty">Could not load preview: ${escapeHtml(error.message)}</div>`;
    return;
  }

  await renderPreviewBody(data.signedUrl, doc);
}

const OFFICE_PREVIEW_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
];
const TEXT_PREVIEW_EXTENSIONS = ["txt", "csv", "json", "md", "log"];

function downloadFallback(url, doc, message) {
  return `<div class="empty">${message}</div><a href="${escapeAttr(url)}" target="_blank" rel="noopener"><button class="primary" type="button">Download ${escapeHtml(doc.file_name)}</button></a>`;
}

async function renderPreviewBody(url, doc) {
  const fileType = doc.file_type || "";
  const extension = (doc.file_name.split(".").pop() || "").toLowerCase();

  if (fileType.startsWith("image/")) {
    previewBody.innerHTML = `<img src="${escapeAttr(url)}" alt="${escapeAttr(doc.file_name)}">`;
    return;
  }
  if (fileType.includes("pdf")) {
    previewBody.innerHTML = `<iframe src="${escapeAttr(url)}" title="${escapeAttr(doc.file_name)}"></iframe>`;
    return;
  }
  if (fileType.startsWith("video/")) {
    previewBody.innerHTML = `<video controls src="${escapeAttr(url)}" style="max-width:100%;max-height:100%;"></video>`;
    return;
  }
  if (fileType.startsWith("audio/")) {
    previewBody.innerHTML = `<div class="empty">${escapeHtml(doc.file_name)}</div><audio controls src="${escapeAttr(url)}" style="width:100%;"></audio>`;
    return;
  }
  if (fileType.startsWith("text/") || TEXT_PREVIEW_EXTENSIONS.includes(extension)) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      previewBody.innerHTML = `<pre class="text-preview">${escapeHtml(text.slice(0, 200000))}</pre>`;
    } catch (error) {
      previewBody.innerHTML = downloadFallback(url, doc, "Could not load this text file for inline preview.");
    }
    return;
  }
  if (OFFICE_PREVIEW_TYPES.includes(fileType) || ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(extension)) {
    const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    previewBody.innerHTML = `<iframe src="${escapeAttr(viewerUrl)}" title="${escapeAttr(doc.file_name)}"></iframe>`;
    return;
  }
  previewBody.innerHTML = downloadFallback(url, doc, "Preview is not available for this file type.");
}

function closePreview() {
  state.previewDoc = null;
  previewOverlay.hidden = true;
  previewBody.innerHTML = "";
}

let confirmCallback = null;

function confirmAction(message, onConfirm, options = {}) {
  confirmCallback = onConfirm;
  document.getElementById("confirmTitle").textContent = options.title || "Are you sure?";
  document.getElementById("confirmMessage").textContent = message;
  document.getElementById("confirmOkBtn").textContent = options.confirmLabel || "Delete";
  confirmOverlay.hidden = false;
}

function closeConfirm() {
  confirmOverlay.hidden = true;
  confirmCallback = null;
}

async function loadDocuments() {
  if (!state.session) {
    state.documents = [];
    return;
  }
  const { data, error } = await supabaseClient
    .from("crm_documents")
    .select("id,board_item_id,file_name,file_path,file_type,file_size,description,uploaded_by,created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.documents = data || [];
}

async function loadMessages() {
  if (!state.session) {
    state.messages = [];
    return;
  }
  const { data, error } = await supabaseClient
    .from("crm_messages")
    .select("id,sender_id,sender_email,recipient_id,recipient_email,body,created_at,read_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  state.messages = data || [];
}

function messageThreads() {
  const myId = state.session?.user?.id;
  const map = new Map();
  state.messages.forEach(msg => {
    const counterpartId = msg.sender_id === myId ? msg.recipient_id : msg.sender_id;
    const counterpartEmail = msg.sender_id === myId ? msg.recipient_email : msg.sender_email;
    if (!map.has(counterpartId)) map.set(counterpartId, { id: counterpartId, email: counterpartEmail, messages: [] });
    map.get(counterpartId).messages.push(msg);
  });
  return Array.from(map.values()).sort((a, b) => {
    const aLast = a.messages[a.messages.length - 1]?.created_at || "";
    const bLast = b.messages[b.messages.length - 1]?.created_at || "";
    return bLast.localeCompare(aLast);
  });
}

function unreadMessageCount() {
  const myId = state.session?.user?.id;
  return state.messages.filter(msg => msg.recipient_id === myId && !msg.read_at).length;
}

function renderMessagesView() {
  const threads = messageThreads();
  let activeThread = threads.find(thread => thread.id === state.messageThreadWith) || null;
  if (!activeThread && state.messageThreadWith) {
    activeThread = { id: state.messageThreadWith, email: state.messageThreadEmail || "Teammate", messages: [] };
  }
  const canStartNew = isManager();

  board.innerHTML = `
    <section class="overview" aria-label="Messages">
      <div class="overview-grid">
        <div class="activity-panel">
          <div class="doc-filters">
            <h2 style="margin:0;flex:1;">Conversations (${threads.length})</h2>
            ${canStartNew ? `<button type="button" id="newMessageBtn" class="primary">New message</button>` : ""}
          </div>
          ${state.messageComposeOpen ? renderNewMessageComposer() : ""}
          <div class="message-thread-list">
            ${threads.map(thread => renderThreadListItem(thread)).join("") || `<div class="empty">No conversations yet. ${canStartNew ? "Start one with New message above." : "A manager or admin can start one with you."}</div>`}
          </div>
        </div>
        ${activeThread ? renderMessageThread(activeThread) : `<div class="activity-panel"><div class="empty">Select a conversation to view it.</div></div>`}
      </div>
    </section>
  `;
  bindMessageControls();
  if (activeThread && activeThread.messages.length) markThreadRead(activeThread.id);
}

function renderThreadListItem(thread) {
  const myId = state.session?.user?.id;
  const last = thread.messages[thread.messages.length - 1];
  const unread = thread.messages.filter(msg => msg.recipient_id === myId && !msg.read_at).length;
  const active = state.messageThreadWith === thread.id;
  return `
    <button type="button" class="message-thread-item ${active ? "active" : ""}" data-thread-id="${escapeAttr(thread.id)}" data-thread-email="${escapeAttr(thread.email || "")}">
      <strong>${escapeHtml(thread.email || "Teammate")}</strong>
      <span>${escapeHtml((last?.body || "").slice(0, 60))}</span>
      ${unread ? `<span class="thread-unread">${unread}</span>` : ""}
    </button>
  `;
}

function renderMessageThread(thread) {
  const myId = state.session?.user?.id;
  return `
    <div class="activity-panel message-thread">
      <h2 style="margin:0;">${escapeHtml(thread.email || "Teammate")}</h2>
      <div class="message-list" id="messageList">
        ${thread.messages.map(msg => `
          <div class="message-bubble ${msg.sender_id === myId ? "mine" : ""}">
            <p>${escapeHtml(msg.body)}</p>
            <span>${dateLabel((msg.created_at || "").slice(0, 10))} ${msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
          </div>
        `).join("") || `<div class="empty">No messages yet. Say hello.</div>`}
      </div>
      <form id="replyForm" class="message-composer">
        <textarea id="replyBody" rows="2" placeholder="Write a reply..." required></textarea>
        <div class="form-actions"><button class="primary" type="submit">Send</button></div>
      </form>
    </div>
  `;
}

function renderNewMessageComposer() {
  const myId = state.session?.user?.id;
  const recipients = state.teamProfiles.filter(profile => profile.user_id !== myId);
  return `
    <form id="newMessageForm" class="message-composer message-composer-new">
      <select id="newMessageRecipient" required>
        <option value="">Choose a teammate...</option>
        ${recipients.map(profile => `<option value="${escapeAttr(profile.user_id)}" data-email="${escapeAttr(profile.email || "")}">${escapeHtml(profile.display_name || profile.email || "Teammate")}</option>`).join("")}
      </select>
      <textarea id="newMessageBody" rows="2" placeholder="Write a message..." required></textarea>
      <div class="form-actions">
        <button type="button" id="cancelNewMessage">Cancel</button>
        <button class="primary" type="submit">Send</button>
      </div>
    </form>
  `;
}

function bindMessageControls() {
  document.querySelectorAll(".message-thread-item").forEach(button => {
    button.addEventListener("click", () => {
      state.messageThreadWith = button.dataset.threadId;
      state.messageThreadEmail = button.dataset.threadEmail;
      state.messageComposeOpen = false;
      renderBoard();
    });
  });

  const newMessageBtn = document.getElementById("newMessageBtn");
  if (newMessageBtn) {
    newMessageBtn.addEventListener("click", () => {
      state.messageComposeOpen = true;
      renderBoard();
    });
  }
  const cancelNewMessage = document.getElementById("cancelNewMessage");
  if (cancelNewMessage) {
    cancelNewMessage.addEventListener("click", () => {
      state.messageComposeOpen = false;
      renderBoard();
    });
  }
  const newMessageForm = document.getElementById("newMessageForm");
  if (newMessageForm) {
    newMessageForm.addEventListener("submit", async event => {
      event.preventDefault();
      const select = document.getElementById("newMessageRecipient");
      const recipientId = select.value;
      const recipientEmail = select.selectedOptions[0]?.dataset.email || "";
      const body = document.getElementById("newMessageBody").value.trim();
      if (!recipientId || !body) return;
      state.messageComposeOpen = false;
      state.messageThreadWith = recipientId;
      state.messageThreadEmail = recipientEmail;
      await sendMessage(recipientId, recipientEmail, body);
    });
  }

  const replyForm = document.getElementById("replyForm");
  if (replyForm) {
    replyForm.addEventListener("submit", async event => {
      event.preventDefault();
      const textarea = document.getElementById("replyBody");
      const body = textarea.value.trim();
      if (!body || !state.messageThreadWith) return;
      await sendMessage(state.messageThreadWith, state.messageThreadEmail, body);
    });
  }

  const messageList = document.getElementById("messageList");
  if (messageList) messageList.scrollTop = messageList.scrollHeight;
}

async function sendMessage(recipientId, recipientEmail, body) {
  const { data, error } = await supabaseClient
    .from("crm_messages")
    .insert({
      sender_id: state.session.user.id,
      sender_email: state.session.user.email || "",
      recipient_id: recipientId,
      recipient_email: recipientEmail || "",
      body
    })
    .select("id,sender_id,sender_email,recipient_id,recipient_email,body,created_at,read_at")
    .single();

  if (error) {
    flash(error.message);
    return;
  }

  state.messages.push(data);
  render();
}

async function markThreadRead(counterpartId) {
  const myId = state.session?.user?.id;
  const unread = state.messages.filter(msg => msg.sender_id === counterpartId && msg.recipient_id === myId && !msg.read_at);
  if (!unread.length) return;
  const now = new Date().toISOString();
  await Promise.all(unread.map(msg => supabaseClient.from("crm_messages").update({ read_at: now }).eq("id", msg.id)));
  state.messages = state.messages.map(msg => unread.some(candidate => candidate.id === msg.id) ? { ...msg, read_at: now } : msg);
  renderChrome();
}

function renderTeamView() {
  if (!isManager()) {
    board.innerHTML = `<section class="overview"><div class="empty">Only managers and admins can manage the team.</div></section>`;
    return;
  }

  board.innerHTML = `
    <section class="overview" aria-label="Team management">
      <div class="activity-panel">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <h2 style="margin:0;">Teammates (${state.teamProfiles.length})</h2>
          <button type="button" class="btn" id="inviteToggleBtn">${state.inviteFormOpen ? "Cancel" : "Invite user"}</button>
        </div>
        ${state.inviteFormOpen ? `
          <form class="form" id="inviteForm" style="margin-top:16px;padding:16px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;">
            <div class="form-grid" style="grid-template-columns:1fr auto;">
              <label>Email address<input type="email" name="email" placeholder="teammate@example.com" required></label>
              <label>Role<select name="role">${ROLES.map(r => `<option value="${r}" ${r === "owner" ? "selected" : ""}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join("")}</select></label>
            </div>
            <div class="form-actions" style="margin-top:12px;">
              <button type="submit" class="btn btn-primary" id="inviteSubmitBtn">Send invite</button>
            </div>
          </form>
        ` : ""}
        <div class="team-table" style="display:grid;gap:8px;">
          <div class="team-row header"><span>Email</span><span>Role</span><span>Status</span><span></span></div>
          ${state.teamProfiles.map(renderTeamRow).join("") || `<div class="empty">No teammates found yet.</div>`}
        </div>
      </div>
    </section>
  `;
  bindTeamControls();
}

function renderTeamRow(profile) {
  const isSelf = profile.user_id === state.session?.user?.id;
  const viewsOpen = state.teamViewsOpenId === profile.user_id;
  const restricted = Array.isArray(profile.allowed_views) && profile.allowed_views.length > 0;
  return `
    <div class="team-row" data-user-id="${profile.user_id}">
      <div>
        <strong>${escapeHtml(profile.display_name || profile.email || "Teammate")}</strong>
        <span>${escapeHtml(profile.email || "")}</span>
        ${profile.job_title || profile.department ? `<span>${[profile.job_title, profile.department].filter(Boolean).map(escapeHtml).join(" &middot; ")}</span>` : ""}
      </div>
      <select class="team-role-select" data-user-id="${profile.user_id}" ${isSelf ? "disabled" : ""}>
        ${ROLES.map(role => option(role, profile.role, label(role))).join("")}
      </select>
      <span>${label(profile.status || "active")}</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
        ${isSelf ? "" : `<button type="button" class="team-message-btn" data-user-id="${profile.user_id}" data-email="${escapeAttr(profile.email || "")}">Message</button>`}
        <button type="button" class="team-views-toggle" data-user-id="${profile.user_id}">${restricted ? "Views*" : "Views"}</button>
        <button type="button" class="team-status-btn" data-user-id="${profile.user_id}" ${isSelf ? "disabled" : ""}>
          ${profile.status === "suspended" ? "Reinstate" : "Suspend"}
        </button>
      </div>
    </div>
    ${viewsOpen ? renderTeamViewsPanel(profile, isSelf) : ""}
  `;
}

function renderTeamViewsPanel(profile, isSelf) {
  const allowed = profile.allowed_views;
  const restricted = Array.isArray(allowed) && allowed.length > 0;
  return `
    <div class="team-views-panel" data-user-id="${profile.user_id}">
      <div class="team-views-head">
        <strong>Visible pages for ${escapeHtml(profile.display_name || profile.email || "this teammate")}</strong>
        <span>${isSelf ? "You can't restrict your own access." : restricted ? "Restricted to the checked pages below." : "Unrestricted — sees every page their role allows."}</span>
      </div>
      <div class="team-views-grid">
        ${NAV_VIEWS.map(entry => `
          <label class="team-view-check">
            <input type="checkbox" class="team-view-checkbox" data-user-id="${profile.user_id}" data-view-id="${entry.id}" ${(!restricted || allowed.includes(entry.id)) ? "checked" : ""} ${isSelf ? "disabled" : ""}>
            ${escapeHtml(entry.label)}
          </label>
        `).join("")}
      </div>
      <div class="form-actions">
        <button type="button" class="team-views-reset" data-user-id="${profile.user_id}" ${isSelf ? "disabled" : ""}>Reset to unrestricted</button>
      </div>
    </div>
  `;
}

function bindTeamControls() {
  const inviteToggle = document.getElementById("inviteToggleBtn");
  if (inviteToggle) {
    inviteToggle.addEventListener("click", () => {
      state.inviteFormOpen = !state.inviteFormOpen;
      render();
    });
  }
  const inviteForm = document.getElementById("inviteForm");
  if (inviteForm) {
    inviteForm.addEventListener("submit", inviteUser);
  }
  document.querySelectorAll(".team-message-btn").forEach(button => {
    button.addEventListener("click", () => {
      state.view = "messages";
      state.messageThreadWith = button.dataset.userId;
      state.messageThreadEmail = button.dataset.email;
      state.messageComposeOpen = false;
      render();
    });
  });
  document.querySelectorAll(".team-role-select").forEach(select => {
    select.addEventListener("change", event => updateTeamRole(event.target.dataset.userId, event.target.value));
  });
  document.querySelectorAll(".team-status-btn").forEach(button => {
    button.addEventListener("click", () => {
      const profile = state.teamProfiles.find(candidate => candidate.user_id === button.dataset.userId);
      const nextStatus = profile?.status === "suspended" ? "active" : "suspended";
      updateTeamStatus(button.dataset.userId, nextStatus);
    });
  });
  document.querySelectorAll(".team-views-toggle").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.userId;
      state.teamViewsOpenId = state.teamViewsOpenId === id ? null : id;
      renderBoard();
    });
  });
  document.querySelectorAll(".team-view-checkbox").forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      const userId = checkbox.dataset.userId;
      const checked = Array.from(document.querySelectorAll(`.team-view-checkbox[data-user-id="${userId}"]`))
        .filter(input => input.checked)
        .map(input => input.dataset.viewId);
      updateTeammateViews(userId, checked);
    });
  });
  document.querySelectorAll(".team-views-reset").forEach(button => {
    button.addEventListener("click", () => updateTeammateViews(button.dataset.userId, []));
  });
}

async function updateTeammateViews(userId, views) {
  const value = views.length ? views : null;
  const { error } = await supabaseClient.from("profiles").update({ allowed_views: value }).eq("user_id", userId);
  if (error) {
    flash(error.message);
    return;
  }
  state.teamProfiles = state.teamProfiles.map(profile => profile.user_id === userId ? { ...profile, allowed_views: value } : profile);
  if (userId === state.session?.user?.id) state.profile = { ...state.profile, allowed_views: value };
  render();
  flash("Access updated");
}

function renderProfileView() {
  const profile = state.profile || {};
  board.innerHTML = `
    <section class="overview" aria-label="My profile">
      <div class="activity-panel">
        <h2>Account</h2>
        <div class="approval-fields">
          <div class="approval-field"><strong>Email</strong><span>${escapeHtml(profile.email || "")}</span></div>
          <div class="approval-field"><strong>Role</strong><span class="role-badge">${label(currentRole())}</span></div>
          <div class="approval-field"><strong>Status</strong><span>${label(profile.status || "active")}</span></div>
        </div>
      </div>
      <div class="activity-panel">
        <h2>HR details</h2>
        <form class="form" id="profileForm">
          <label>Display name<input name="display_name" value="${escapeAttr(profile.display_name || "")}"></label>
          <div class="form-grid">
            <label>Phone<input name="phone" value="${escapeAttr(profile.phone || "")}"></label>
            <label>Job title<input name="job_title" value="${escapeAttr(profile.job_title || "")}"></label>
          </div>
          <div class="form-grid">
            <label>Department<input name="department" value="${escapeAttr(profile.department || "")}"></label>
            <label>Employee ID<input name="employee_id" value="${escapeAttr(profile.employee_id || "")}"></label>
          </div>
          <div class="form-grid">
            <label>Start date<input name="start_date" type="date" value="${escapeAttr(profile.start_date || "")}"></label>
            <label>Address<input name="address" value="${escapeAttr(profile.address || "")}"></label>
          </div>
          <div class="form-grid">
            <label>Emergency contact name<input name="emergency_contact_name" value="${escapeAttr(profile.emergency_contact_name || "")}"></label>
            <label>Emergency contact phone<input name="emergency_contact_phone" value="${escapeAttr(profile.emergency_contact_phone || "")}"></label>
          </div>
          <div class="form-actions">
            <button type="submit" class="primary">Save profile</button>
          </div>
        </form>
      </div>
    </section>
  `;
  document.getElementById("profileForm").addEventListener("submit", saveMyProfile);
}

async function saveMyProfile(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const patch = {
    display_name: form.get("display_name").trim(),
    phone: form.get("phone").trim(),
    job_title: form.get("job_title").trim(),
    department: form.get("department").trim(),
    employee_id: form.get("employee_id").trim(),
    start_date: form.get("start_date") || null,
    address: form.get("address").trim(),
    emergency_contact_name: form.get("emergency_contact_name").trim(),
    emergency_contact_phone: form.get("emergency_contact_phone").trim()
  };

  const { data, error } = await supabaseClient
    .from("profiles")
    .update(patch)
    .eq("user_id", state.session.user.id)
    .select("user_id,email,role,display_name,status,allowed_views,phone,department,job_title,start_date,employee_id,emergency_contact_name,emergency_contact_phone,address")
    .single();

  if (error) {
    flash(error.message);
    return;
  }
  state.profile = data;
  render();
  flash("Profile updated");
}

async function loadTeamProfiles() {
  if (!isManager()) {
    state.teamProfiles = [];
    return;
  }
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("user_id,email,role,display_name,status,allowed_views")
    .order("email", { ascending: true });

  if (error) throw error;
  state.teamProfiles = data || [];
}

async function updateTeamRole(userId, role) {
  const { error } = await supabaseClient.from("profiles").update({ role }).eq("user_id", userId);
  if (error) {
    flash(error.message);
    return;
  }
  state.teamProfiles = state.teamProfiles.map(profile => profile.user_id === userId ? { ...profile, role } : profile);
  render();
  flash("Role updated");
}

async function updateTeamStatus(userId, status) {
  const { error } = await supabaseClient.from("profiles").update({ status }).eq("user_id", userId);
  if (error) {
    flash(error.message);
    return;
  }
  state.teamProfiles = state.teamProfiles.map(profile => profile.user_id === userId ? { ...profile, status } : profile);
  render();
  flash(status === "suspended" ? "Teammate suspended" : "Teammate reinstated");
}

async function inviteUser(event) {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  const email = data.get("email").trim();
  const role = data.get("role");

  if (!email) return;

  const submitBtn = document.getElementById("inviteSubmitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending...";

  const { data: result, error } = await supabaseClient.functions.invoke("invite-user", {
    body: { email, role },
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "Send invite";

  if (error) {
    flash(error.message);
    return;
  }

  if (result?.error) {
    flash(result.error);
    return;
  }

  state.inviteFormOpen = false;
  await loadTeamProfiles();
  render();
  flash("Invite sent to " + email);
}

const SERVICE_UNITS = ["flat", "hourly", "per seat", "monthly"];

function renderPricingView() {
  if (!isAdmin()) {
    board.innerHTML = `<section class="overview"><div class="empty">Only admins can access the pricing calculator.</div></section>`;
    return;
  }

  const editing = state.services.find(service => service.id === state.editingServiceId);

  board.innerHTML = `
    <section class="overview" aria-label="Service pricing calculator">
      <div class="activity-panel">
        <h2>${editing ? "Edit service" : "Add a service"}</h2>
        <form class="form" id="serviceForm">
          <label>Service name<input name="name" value="${editing ? escapeAttr(editing.name) : ""}" placeholder="e.g. Website build" required></label>
          <div class="form-grid">
            <label>Unit price (USD)<input name="unit_price" type="number" min="0" step="1" value="${editing ? Number(editing.unit_price) : ""}" required></label>
            <label>Billed
              <select name="unit_label">
                ${SERVICE_UNITS.map(unit => option(unit, editing?.unit_label || "flat", label(unit))).join("")}
              </select>
            </label>
          </div>
          <div class="form-actions">
            ${editing ? `<button type="button" id="cancelEditService">Cancel</button>` : ""}
            <button type="submit" class="primary">${editing ? "Save changes" : "Add service"}</button>
          </div>
        </form>
      </div>

      <div class="activity-panel">
        <h2>Service catalog (${state.services.length})</h2>
        <div style="display:grid;gap:8px;">
          <div class="team-row header"><span>Service</span><span>Billed</span><span>Price</span><span></span></div>
          ${state.services.map(renderServiceRow).join("") || `<div class="empty">No services yet. Add your first service above.</div>`}
        </div>
      </div>

      <div class="activity-panel">
        <h2>Quote calculator</h2>
        <div class="calc-grid" id="calcGrid">
          ${state.services.map(renderCalcRow).join("") || `<div class="empty">Add services to the catalog to start calculating a quote.</div>`}
        </div>
        <div class="calc-summary">
          <div class="form-grid">
            <label>Discount %<input type="number" min="0" max="100" step="1" id="calcDiscount" value="${state.calcDiscount}"></label>
            <label>Tax %<input type="number" min="0" max="100" step="1" id="calcTax" value="${state.calcTax}"></label>
          </div>
          <div class="calc-summary-row"><span>Subtotal</span><strong id="calcSubtotal">$0</strong></div>
          <div class="calc-summary-row"><span>Discount</span><strong id="calcDiscountAmount">-$0</strong></div>
          <div class="calc-summary-row"><span>Tax</span><strong id="calcTaxAmount">+$0</strong></div>
          <div class="calc-summary-row total"><span>Total</span><strong id="calcTotal">$0</strong></div>
          <div class="form-actions"><button type="button" id="calcResetBtn">Reset calculator</button></div>
        </div>
      </div>
    </section>
  `;
  bindPricingControls();
  updateCalculatorSummary();
}

function renderServiceRow(service) {
  return `
    <div class="team-row" data-service-id="${service.id}">
      <strong>${escapeHtml(service.name)}</strong>
      <span>${label(service.unit_label)}</span>
      <span>${money(service.unit_price)}</span>
      <div style="display:flex;gap:6px;justify-content:flex-end;">
        <button type="button" class="service-edit-btn" data-service-id="${service.id}">Edit</button>
        <button type="button" class="mini-delete service-delete-btn" data-service-id="${service.id}" title="Delete">&times;</button>
      </div>
    </div>
  `;
}

function renderCalcRow(service) {
  const qty = state.calcQty[service.id] || 0;
  return `
    <div class="calc-row" data-service-id="${service.id}">
      <strong>${escapeHtml(service.name)}</strong>
      <span>${money(service.unit_price)} / ${label(service.unit_label)}</span>
      <input type="number" min="0" step="1" class="calc-qty-input" data-service-id="${service.id}" value="${qty}" aria-label="Quantity for ${escapeAttr(service.name)}">
      <span class="calc-line-total" data-service-id="${service.id}">${money(qty * Number(service.unit_price))}</span>
    </div>
  `;
}

function computeCalculatorTotals() {
  const subtotal = state.services.reduce((sum, service) => {
    const qty = Number(state.calcQty[service.id]) || 0;
    return sum + qty * Number(service.unit_price || 0);
  }, 0);
  const discountAmount = subtotal * (Number(state.calcDiscount) || 0) / 100;
  const taxable = subtotal - discountAmount;
  const taxAmount = taxable * (Number(state.calcTax) || 0) / 100;
  return { subtotal, discountAmount, taxAmount, total: taxable + taxAmount };
}

function updateCalculatorSummary() {
  const subtotalEl = document.getElementById("calcSubtotal");
  if (!subtotalEl) return;
  const { subtotal, discountAmount, taxAmount, total } = computeCalculatorTotals();
  subtotalEl.textContent = money(subtotal);
  document.getElementById("calcDiscountAmount").textContent = `-${money(discountAmount)}`;
  document.getElementById("calcTaxAmount").textContent = `+${money(taxAmount)}`;
  document.getElementById("calcTotal").textContent = money(total);
}

function bindPricingControls() {
  document.getElementById("serviceForm").addEventListener("submit", saveServiceFromForm);
  const cancelBtn = document.getElementById("cancelEditService");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      state.editingServiceId = null;
      renderBoard();
    });
  }

  document.querySelectorAll(".service-edit-btn").forEach(button => {
    button.addEventListener("click", () => {
      state.editingServiceId = button.dataset.serviceId;
      renderBoard();
    });
  });
  document.querySelectorAll(".service-delete-btn").forEach(button => {
    button.addEventListener("click", () => {
      confirmAction("Delete this service from the catalog? This can't be undone.", () => deleteService(button.dataset.serviceId));
    });
  });

  document.querySelectorAll(".calc-qty-input").forEach(input => {
    input.addEventListener("input", event => {
      const id = event.target.dataset.serviceId;
      const qty = Math.max(0, Number(event.target.value) || 0);
      state.calcQty[id] = qty;
      const service = state.services.find(candidate => candidate.id === id);
      const lineTotalEl = document.querySelector(`.calc-line-total[data-service-id="${id}"]`);
      if (lineTotalEl && service) lineTotalEl.textContent = money(qty * Number(service.unit_price));
      updateCalculatorSummary();
    });
  });

  document.getElementById("calcDiscount").addEventListener("input", event => {
    state.calcDiscount = Math.min(100, Math.max(0, Number(event.target.value) || 0));
    updateCalculatorSummary();
  });
  document.getElementById("calcTax").addEventListener("input", event => {
    state.calcTax = Math.min(100, Math.max(0, Number(event.target.value) || 0));
    updateCalculatorSummary();
  });
  document.getElementById("calcResetBtn").addEventListener("click", () => {
    state.calcQty = {};
    state.calcDiscount = 0;
    state.calcTax = 0;
    renderBoard();
  });
}

async function saveServiceFromForm(event) {
  event.preventDefault();
  if (!isAdmin()) return;
  const form = new FormData(event.currentTarget);
  const payload = {
    name: form.get("name").trim(),
    unit_label: form.get("unit_label"),
    unit_price: Number(form.get("unit_price") || 0)
  };
  if (!payload.name) {
    flash("Enter a service name");
    return;
  }

  if (state.editingServiceId) {
    const { data, error } = await supabaseClient
      .from("crm_services")
      .update(payload)
      .eq("id", state.editingServiceId)
      .select("id,name,unit_price,unit_label,created_at")
      .single();
    if (error) {
      flash(error.message);
      return;
    }
    state.services = state.services.map(service => service.id === data.id ? data : service);
    state.editingServiceId = null;
    render();
    flash("Service updated");
    return;
  }

  const { data, error } = await supabaseClient
    .from("crm_services")
    .insert(payload)
    .select("id,name,unit_price,unit_label,created_at")
    .single();
  if (error) {
    flash(error.message);
    return;
  }
  state.services.push(data);
  render();
  flash("Service added");
}

async function deleteService(id) {
  if (!isAdmin()) return;
  const { error } = await supabaseClient.from("crm_services").delete().eq("id", id);
  if (error) {
    flash(error.message);
    return;
  }
  state.services = state.services.filter(service => service.id !== id);
  delete state.calcQty[id];
  render();
  flash("Service deleted");
}

async function loadServices() {
  if (!isAdmin()) {
    state.services = [];
    return;
  }
  const { data, error } = await supabaseClient
    .from("crm_services")
    .select("id,name,unit_price,unit_label,created_at")
    .order("name", { ascending: true });
  if (error) throw error;
  state.services = data || [];
}

function renderKpi(labelText, value) {
  return `<div class="kpi"><span>${labelText}</span><strong>${value}</strong></div>`;
}

function renderMetricRow(area, expected, actual, gap) {
  return `<div class="metric-row"><strong>${area}</strong><span>${expected}</span><span>${actual}</span><span>${gap}</span></div>`;
}

function renderDualBar(labelText, expected, actual, color) {
  const max = Math.max(Number(expected) || 0, Number(actual) || 0, 1);
  const expectedWidth = Math.max(4, Math.round(((Number(expected) || 0) / max) * 100));
  const actualWidth = Math.max(4, Math.round(((Number(actual) || 0) / max) * 100));
  return `
    <div class="split-bar">
      <div class="split-bar-top"><strong>${labelText}</strong><span>Expected ${formatCompact(expected)} / Actual ${formatCompact(actual)}</span></div>
      <div class="dual-track">
        <div class="chart-track"><div class="chart-fill" style="--w:${expectedWidth}%;--c:#94a3b8"></div></div>
        <div class="chart-track"><div class="chart-fill" style="--w:${actualWidth}%;--c:${color}"></div></div>
      </div>
    </div>
  `;
}

function renderStageChart(stages, items) {
  const counts = stages.map(stage => ({ ...stage, count: items.filter(item => itemColumnForStage(item, stage.id)).length }));
  const max = Math.max(...counts.map(stage => stage.count), 1);
  return counts.map(stage => {
    const width = Math.max(stage.count ? 8 : 2, Math.round((stage.count / max) * 100));
    return `
      <div class="chart-row">
        <span class="chart-label">${stage.title}</span>
        <span class="chart-track"><span class="chart-fill" style="--w:${width}%;--c:${stage.color}"></span></span>
        <strong>${stage.count}</strong>
      </div>
    `;
  }).join("");
}

function itemColumnForStage(item, stageId) {
  return item.status === stageId;
}

function renderActivityComposer() {
  return `
    <form class="activity-form" id="activityForm">
      <input name="title" placeholder="${canEdit() ? "Daily activity" : "Sign in to save daily activity"}" ${canEdit() ? "" : "disabled"}>
      <select name="channel" ${canEdit() ? "" : "disabled"}>
        ${["email", "call", "meeting", "proposal", "delivery", "admin", "general"].map(value => option(value, "general")).join("")}
      </select>
      <button class="primary" type="submit" ${canEdit() ? "" : "disabled"}>Add</button>
    </form>
  `;
}

function renderActivityItems(activities, editable) {
  return activities.map(activity => `
    <div class="activity-item ${activity.completed ? "done" : ""}" data-activity-id="${activity.id}">
      <input type="checkbox" ${activity.completed ? "checked" : ""} ${editable ? "" : "disabled"} aria-label="Mark complete">
      <div><strong>${escapeHtml(activity.title)}</strong><span>${label(activity.channel)} - ${dateLabel(activity.activity_date)}</span></div>
      ${editable ? `<button class="mini-delete" type="button" title="Delete activity">&times;</button>` : ""}
    </div>
  `).join("") || `<div class="empty">No activities for this day yet.</div>`;
}

function bindActivityControls() {
  const form = document.getElementById("activityForm");
  if (form) form.addEventListener("submit", addActivity);
  document.querySelectorAll(".activity-item[data-activity-id] input[type='checkbox']").forEach(input => {
    input.addEventListener("change", event => toggleActivity(event.currentTarget.closest(".activity-item").dataset.activityId, event.currentTarget.checked));
  });
  document.querySelectorAll(".activity-item[data-activity-id] .mini-delete").forEach(button => {
    button.addEventListener("click", event => {
      const id = event.currentTarget.closest(".activity-item").dataset.activityId;
      confirmAction("Delete this activity?", () => deleteActivity(id));
    });
  });
}

function itemColumn(item) {
  if (state.view === "focus") {
    const days = daysUntil(item.due);
    if (days < 0) return "overdue";
    if (days <= 7) return "soon";
    return "later";
  }
  return normalizeStatus(item);
}

function renderCard(item) {
  const selected = item.id === state.selectedId ? " selected" : "";
  const pendingCount = pendingRequestsForItem(item.id).length;
  return `
    <article class="card${selected}" draggable="true" data-id="${item.id}">
      <h3>${escapeHtml(item.title)}${item.document_url ? ` <span title="Has a sales document link">🔗</span>` : ""}</h3>
      <div class="company">${escapeHtml(item.company)} &middot; ${escapeHtml(item.owner)}</div>
      <div class="card-row">
        <span class="pill priority-${item.priority}">${label(item.priority)}</span>
        <span class="value">${canSeeFinancials() && item.value ? money(item.value) : dueLabel(item.due)}</span>
      </div>
      <div class="card-row">
        <span class="pill">${label(item.type)}</span>
        <span class="pill">${dueLabel(item.due)}</span>
      </div>
      ${pendingCount ? `<div class="card-row"><span class="pill priority-medium">${pendingCount} pending approval</span></div>` : ""}
    </article>
  `;
}

function renderMetrics() {
  const items = visibleItems();
  document.getElementById("openValueMetric").hidden = !canSeeFinancials();
  if (canSeeFinancials()) {
    const openValue = items
      .filter(item => !["won", "done", "project_done"].includes(item.status))
      .reduce((sum, item) => sum + Number(item.value || 0), 0);
    document.getElementById("totalValue").textContent = money(openValue);
  }
  document.getElementById("dueWeek").textContent = items.filter(item => daysUntil(item.due) <= 7).length;
}

function renderDetail() {
  const item = visibleItems().find(candidate => candidate.id === state.selectedId);
  if (!item) {
    sideTitle.textContent = "Details";
    detail.innerHTML = `
      <div class="insights">
        ${renderInsight("Pipeline health", completionPercent("project_done", pipelineColumns), "Completed project value")}
        ${renderInsight("Delivery health", completionPercent("project_done", projectColumns), "Completed project value")}
        ${renderInsight("Urgent load", urgentPercent(), "High priority or due soon")}
      </div>
      <div class="empty">
        Select a card to edit account details, ownership, priority, due date, value, and notes.
        ${visibleItems().length ? "" : `<button class="primary" id="seedBtn">Load sample cards</button>`}
      </div>
    `;
    const seedBtn = document.getElementById("seedBtn");
    if (seedBtn) seedBtn.addEventListener("click", seedDatabase);
    return;
  }

  sidePanel.classList.add("open");
  sideTitle.textContent = item.company;
  const pending = pendingRequestsForItem(item.id);
  const readOnly = isViewer();
  const linkedDocs = visibleDocuments().filter(doc => doc.board_item_id === item.id);
  detail.innerHTML = `
    ${pending.length ? `<div class="status-note">${pending.length} pending edit${pending.length === 1 ? "" : "s"} waiting for approval. Approved board data stays unchanged until review.</div>` : ""}
    ${readOnly ? `<div class="status-note">You have read-only access to this record.</div>` : ""}
    <form class="form" id="itemForm">
      <label>Title<input name="title" value="${escapeAttr(item.title)}" ${readOnly ? "disabled" : ""}></label>
      <label>Company<input name="company" value="${escapeAttr(item.company)}" ${readOnly ? "disabled" : ""}></label>
      <div class="form-grid">
        <label>Owner<input name="owner" value="${escapeAttr(item.owner)}" ${readOnly ? "disabled" : ""}></label>
        <label>Type
          <select name="type" ${readOnly ? "disabled" : ""}>
            ${["deal", "project", "task"].map(value => option(value, item.type)).join("")}
          </select>
        </label>
      </div>
      <div class="form-grid">
        <label>Priority
          <select name="priority" ${readOnly ? "disabled" : ""}>
            ${["high", "medium", "low"].map(value => option(value, item.priority)).join("")}
          </select>
        </label>
        <label>Status
          <select name="status" ${readOnly ? "disabled" : ""}>
            ${columns().map(column => option(column.id, normalizeStatus(item), column.title)).join("")}
          </select>
        </label>
      </div>
      <div class="form-grid">
        ${canSeeFinancials()
          ? `<label>Value<input name="value" type="number" min="0" step="100" value="${Number(item.value || 0)}" ${readOnly ? "disabled" : ""}></label>`
          : `<input type="hidden" name="value" value="${Number(item.value || 0)}">`}
        <label>Due date<input name="due" type="date" value="${escapeAttr(item.due)}" ${readOnly ? "disabled" : ""}></label>
      </div>
      <label>Notes<textarea name="notes" ${readOnly ? "disabled" : ""}>${escapeHtml(item.notes)}</textarea></label>
      <label>Sales document link<input name="document_url" type="url" placeholder="https://..." value="${escapeAttr(item.document_url || "")}" ${readOnly ? "disabled" : ""}></label>
      ${item.document_url ? (isSafeUrl(item.document_url)
        ? `<a href="${escapeAttr(item.document_url)}" target="_blank" rel="noopener noreferrer"><button type="button" class="link-btn">Open sales document &#8599;</button></a>`
        : `<div class="empty">Document link must start with http:// or https://</div>`) : ""}
      ${readOnly ? "" : `
        <div class="form-actions">
          <button type="button" class="danger" id="deleteBtn">Delete</button>
          <button type="submit" class="primary">${isManager() ? "Save" : "Send for approval"}</button>
        </div>
      `}
    </form>
    <div class="activity-panel" style="padding:0;border:0;">
      <h2>Documents (${linkedDocs.length})</h2>
      <div class="doc-grid">
        ${linkedDocs.map(renderDocCard).join("") || `<div class="empty">No documents linked to this record yet. Upload one from the Documents tab.</div>`}
      </div>
    </div>
  `;

  document.getElementById("itemForm").addEventListener("submit", saveSelectedFromForm);
  const deleteBtn = document.getElementById("deleteBtn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      confirmAction(`Delete "${item.title}" at ${item.company}? This can't be undone.`, deleteSelected);
    });
  }
  document.querySelectorAll("#detail .doc-preview-btn").forEach(button => {
    button.addEventListener("click", () => openPreview(button.dataset.docId));
  });
  document.querySelectorAll("#detail .doc-delete-btn").forEach(button => {
    button.addEventListener("click", () => {
      confirmAction("Delete this document? This can't be undone.", () => deleteDocument(button.dataset.docId));
    });
  });
}

function renderInsight(title, percent, caption) {
  return `
    <div class="insight">
      <div class="insight-top"><strong>${title}</strong><span>${percent}%</span></div>
      <div class="bar"><span style="--w:${percent}%"></span></div>
      <div class="insight-top"><span>${caption}</span></div>
    </div>
  `;
}

function completionPercent(doneStatus) {
  const items = visibleItems();
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
  const done = items.filter(item => item.status === doneStatus).reduce((sum, item) => sum + Number(item.value || 0), 0);
  return Math.round((done / total) * 100);
}

function urgentPercent() {
  const items = visibleItems();
  if (!items.length) return 0;
  const urgent = items.filter(item => item.priority === "high" || daysUntil(item.due) <= 7).length;
  return Math.round((urgent / items.length) * 100);
}

async function loadRemoteItems() {
  if (!state.session) {
    state.items = [];
    return;
  }

  const { data, error } = await supabaseClient
    .from("crm_board_items")
    .select("id,user_id,assigned_to,visibility,type,title,company,owner,priority,value,due,status,notes,document_url,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.items = data || [];
}

async function loadChangeRequests() {
  if (!state.session) {
    state.changeRequests = [];
    return;
  }

  const { data, error } = await supabaseClient
    .from("crm_change_requests")
    .select("id,board_item_id,action,requested_by,requested_at,status,payload,before_payload,reviewed_by,reviewed_at,review_note")
    .order("requested_at", { ascending: false });

  if (error) throw error;
  state.changeRequests = data || [];
}

async function loadProfile() {
  if (!state.session) {
    state.profile = null;
    return;
  }

  const fallback = {
    user_id: state.session.user.id,
    email: state.session.user.email,
    role: ADMIN_BOOTSTRAP_EMAILS.includes(state.session.user.email?.toLowerCase()) ? "admin" : "owner",
    display_name: state.session.user.email?.split("@")[0] || "User",
    status: "active",
    allowed_views: null,
    phone: "",
    department: "",
    job_title: "",
    start_date: null,
    employee_id: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    address: ""
  };

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("user_id,email,role,display_name,status,allowed_views,phone,department,job_title,start_date,employee_id,emergency_contact_name,emergency_contact_phone,address")
    .eq("user_id", state.session.user.id)
    .single();

  state.profile = error ? fallback : (data || fallback);

  if (state.profile.status === "suspended") {
    flash("Your account has been suspended. Contact your admin.");
    await supabaseClient.auth.signOut();
  }
}

async function loadRemoteActivities() {
  if (!state.session) {
    state.activities = [];
    return;
  }

  const { data, error } = await supabaseClient
    .from("crm_daily_activities")
    .select("id,board_item_id,activity_date,title,channel,notes,completed,created_at,updated_at")
    .order("activity_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  state.activities = data || [];
}

async function seedDatabase() {
  if (!state.session) return;
  const rows = seedItems.map(({ id, ...item }) => item);
  const { data, error } = await supabaseClient
    .from("crm_board_items")
    .insert(rows)
    .select("id,type,title,company,owner,priority,value,due,status,notes,created_at,updated_at");

  if (error) {
    flash(error.message);
    return;
  }
  state.items = data || [];
  render();
  flash("Sample cards loaded");
}

async function addActivity(event) {
  event.preventDefault();
  if (!canEdit()) {
    flash(isViewer() ? "Viewers have read-only access" : "Sign in to save activity");
    return;
  }
  const form = new FormData(event.currentTarget);
  const title = form.get("title").trim();
  if (!title) {
    flash("Add an activity title");
    return;
  }

  const { data, error } = await supabaseClient
    .from("crm_daily_activities")
    .insert({
      title,
      channel: form.get("channel"),
      activity_date: todayIso(),
      completed: false
    })
    .select("id,board_item_id,activity_date,title,channel,notes,completed,created_at,updated_at")
    .single();

  if (error) {
    flash(error.message);
    return;
  }

  state.activities.unshift(data);
  render();
  flash("Activity added");
}

async function toggleActivity(id, completed) {
  if (!state.session) {
    flash("Sign in to update activity");
    return;
  }
  const { data, error } = await supabaseClient
    .from("crm_daily_activities")
    .update({ completed })
    .eq("id", id)
    .select("id,board_item_id,activity_date,title,channel,notes,completed,created_at,updated_at")
    .single();

  if (error) {
    flash(error.message);
    return;
  }

  state.activities = state.activities.map(activity => activity.id === id ? data : activity);
  render();
}

async function deleteActivity(id) {
  if (!state.session) {
    flash("Sign in to delete activity");
    return;
  }
  const { error } = await supabaseClient
    .from("crm_daily_activities")
    .delete()
    .eq("id", id);

  if (error) {
    flash(error.message);
    return;
  }

  state.activities = state.activities.filter(activity => activity.id !== id);
  render();
  flash("Activity deleted");
}

async function saveSelectedFromForm(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const documentUrl = form.get("document_url").trim();
  if (documentUrl && !isSafeUrl(documentUrl)) {
    flash("Document link must start with http:// or https://");
    return;
  }
  const patch = {
    title: form.get("title").trim(),
    company: form.get("company").trim(),
    owner: form.get("owner").trim(),
    type: form.get("type"),
    priority: form.get("priority"),
    status: form.get("status"),
    value: Number(form.get("value") || 0),
    due: form.get("due") || null,
    notes: form.get("notes").trim(),
    document_url: documentUrl
  };

  const item = state.items.find(candidate => candidate.id === state.selectedId);
  if (!isManager()) {
    await submitChangeRequest("update", item, patch);
    return;
  }

  const { data, error } = await supabaseClient
    .from("crm_board_items")
    .update(patch)
    .eq("id", state.selectedId)
    .select("id,user_id,assigned_to,visibility,type,title,company,owner,priority,value,due,status,notes,document_url,created_at,updated_at")
    .single();

  if (error) {
    flash(error.message);
    return;
  }

  state.items = state.items.map(item => item.id === state.selectedId ? data : item);
  render();
  flash("Saved");
}

async function deleteSelected() {
  const id = state.selectedId;
  const item = state.items.find(candidate => candidate.id === id);
  if (!isManager()) {
    await submitChangeRequest("delete", item, {});
    return;
  }

  const { error } = await supabaseClient
    .from("crm_board_items")
    .delete()
    .eq("id", id);

  if (error) {
    flash(error.message);
    return;
  }

  state.items = state.items.filter(item => item.id !== id);
  state.selectedId = null;
  render();
  flash("Deleted");
}

async function moveItem(id, status) {
  const item = state.items.find(candidate => candidate.id === id);
  if (!isManager()) {
    await submitChangeRequest("update", item, { ...pickBoardPayload(item), status });
    state.selectedId = id;
    render();
    return;
  }

  const { data, error } = await supabaseClient
    .from("crm_board_items")
    .update({ status })
    .eq("id", id)
    .select("id,user_id,assigned_to,visibility,type,title,company,owner,priority,value,due,status,notes,document_url,created_at,updated_at")
    .single();

  if (error) {
    flash(error.message);
    return;
  }

  state.items = state.items.map(item => item.id === id ? data : item);
  state.selectedId = id;
  render();
  flash("Moved");
}

function selectItem(id) {
  state.selectedId = id;
  render();
}

async function addItem() {
  if (!state.session) {
    flash("Sign in first");
    return;
  }
  if (isViewer()) {
    flash("Viewers have read-only access");
    return;
  }
  const status = state.view === "projects" ? "project_brief" : "responded_email";
  const item = {
    user_id: state.session.user.id,
    assigned_to: state.session.user.id,
    visibility: "personal",
    type: state.type === "all" ? "deal" : state.type,
    title: "New opportunity",
    company: "New account",
    owner: "Ava",
    priority: "medium",
    value: 0,
    due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    status,
    notes: "",
    document_url: ""
  };

  if (!isManager()) {
    await submitChangeRequest("create", null, item);
    return;
  }

  const { data, error } = await supabaseClient
    .from("crm_board_items")
    .insert(item)
    .select("id,user_id,assigned_to,visibility,type,title,company,owner,priority,value,due,status,notes,document_url,created_at,updated_at")
    .single();

  if (error) {
    flash(error.message);
    return;
  }

  state.items.unshift(data);
  state.selectedId = data.id;
  render();
  flash("Created");
}

async function submitChangeRequest(action, item, payload) {
  if (!state.session) {
    flash("Sign in first");
    return;
  }

  const request = {
    board_item_id: item?.id || null,
    action,
    requested_by: state.session.user.id,
    status: "pending",
    payload,
    before_payload: item ? pickBoardPayload(item) : null
  };

  const { data, error } = await supabaseClient
    .from("crm_change_requests")
    .insert(request)
    .select("id,board_item_id,action,requested_by,requested_at,status,payload,before_payload,reviewed_by,reviewed_at,review_note")
    .single();

  if (error) {
    flash(error.message);
    return;
  }

  state.changeRequests.unshift(data);
  render();
  flash("Sent for approval");
}

async function reviewChangeRequest(id, decision) {
  const request = state.changeRequests.find(candidate => candidate.id === id);
  if (!request || !isManager()) return;

  try {
    if (decision === "approved") {
      await applyApprovedRequest(request);
    }

    const { data, error } = await supabaseClient
      .from("crm_change_requests")
      .update({
        status: decision,
        reviewed_by: state.session.user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", id)
      .select("id,board_item_id,action,requested_by,requested_at,status,payload,before_payload,reviewed_by,reviewed_at,review_note")
      .single();

    if (error) throw error;
    state.changeRequests = state.changeRequests.map(request => request.id === id ? data : request);
    await loadRemoteItems();
    render();
    flash(decision === "approved" ? "Approved" : "Rejected");
  } catch (error) {
    flash(error.message);
  }
}

async function cancelChangeRequest(id) {
  const request = state.changeRequests.find(candidate => candidate.id === id);
  if (!request || request.requested_by !== state.session?.user?.id) return;

  const { data, error } = await supabaseClient
    .from("crm_change_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select("id,board_item_id,action,requested_by,requested_at,status,payload,before_payload,reviewed_by,reviewed_at,review_note")
    .single();

  if (error) {
    flash(error.message);
    return;
  }

  state.changeRequests = state.changeRequests.map(candidate => candidate.id === id ? data : candidate);
  render();
  flash("Request withdrawn");
}

async function applyApprovedRequest(request) {
  if (request.action === "create") {
    const { error } = await supabaseClient
      .from("crm_board_items")
      .insert(request.payload);
    if (error) throw error;
    return;
  }

  if (request.action === "update") {
    const { error } = await supabaseClient
      .from("crm_board_items")
      .update(request.payload)
      .eq("id", request.board_item_id);
    if (error) throw error;
    return;
  }

  if (request.action === "delete") {
    const { error } = await supabaseClient
      .from("crm_board_items")
      .delete()
      .eq("id", request.board_item_id);
    if (error) throw error;
  }
}

function pickBoardPayload(item) {
  return {
    user_id: item.user_id,
    assigned_to: item.assigned_to,
    visibility: item.visibility,
    type: item.type,
    title: item.title,
    company: item.company,
    owner: item.owner,
    priority: item.priority,
    value: Number(item.value || 0),
    due: item.due || null,
    status: item.status,
    notes: item.notes || "",
    document_url: item.document_url || ""
  };
}

function daysUntil(date) {
  const today = new Date();
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((new Date(date) - midnight) / 86400000);
}

function dueLabel(date) {
  const days = daysUntil(date);
  if (days < 0) return `${Math.abs(days)}d late`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days}d`;
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatCompact(value) {
  return Number(value) > 999
    ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
    : String(value);
}

function formatChangeValue(value) {
  if (value === null || value === undefined || value === "") return "Empty";
  if (typeof value === "number") return String(value);
  return escapeHtml(String(value));
}

function shortId(value) {
  return value ? `${String(value).slice(0, 8)}...` : "Unknown";
}

function label(value) {
  return String(value).replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function option(value, selected, text = label(value)) {
  return `<option value="${escapeAttr(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(text)}</option>`;
}

function statusTitle(status) {
  return [...pipelineColumns, ...projectColumns].find(column => column.id === status)?.title || label(status);
}

function statusColor(status) {
  return [...pipelineColumns, ...projectColumns].find(column => column.id === status)?.color || "#64748b";
}

function todayIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);
}

function activitiesForToday() {
  return visibleActivities().filter(activity => activity.activity_date === todayIso());
}

function dateLabel(date) {
  if (date === todayIso()) return "Today";
  return date || "No date";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function isSafeUrl(url) {
  return /^https?:\/\//i.test(url || "");
}

function flash(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => toast.classList.remove("show"), 1300);
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) {
    loginError.textContent = "Enter email and password";
    loginError.hidden = false;
    return;
  }

  loginSubmit.disabled = true;
  loginError.hidden = true;
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
  } finally {
    loginSubmit.disabled = false;
  }
}

async function forgotPassword() {
  const email = loginEmail.value.trim();
  if (!email) {
    loginError.textContent = "Enter your email above first";
    loginError.hidden = false;
    return;
  }
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
  if (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
    return;
  }
  flash("Password reset email sent");
}

async function signOut() {
  await supabaseClient.auth.signOut();
}

async function refreshFromDatabase() {
  try {
    state.loading = true;
    render();
    await loadProfile();
    await loadRemoteItems();
    await loadRemoteActivities();
    await loadChangeRequests();
    await loadDocuments();
    await loadTeamProfiles();
    await loadServices();
    await loadMessages();
  } catch (error) {
    flash(error.message);
  } finally {
    state.loading = false;
    render();
  }
}

function subscribeToChanges() {
  if (state.realtimeChannel) {
    supabaseClient.removeChannel(state.realtimeChannel);
    state.realtimeChannel = null;
  }
  if (!state.session) return;

  state.realtimeChannel = supabaseClient
    .channel("crm_board_items_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "crm_board_items" }, () => {
      loadRemoteItems().then(render).catch(error => flash(error.message));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "crm_daily_activities" }, () => {
      loadRemoteActivities().then(render).catch(error => flash(error.message));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "crm_change_requests" }, () => {
      loadChangeRequests().then(render).catch(error => flash(error.message));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "crm_documents" }, () => {
      loadDocuments().then(render).catch(error => flash(error.message));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "crm_services" }, () => {
      loadServices().then(render).catch(error => flash(error.message));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "crm_messages" }, () => {
      loadMessages().then(render).catch(error => flash(error.message));
    })
    .subscribe();
}

async function initializeSupabase() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    state.session = data.session;
    await loadProfile();
    await loadRemoteItems();
    await loadRemoteActivities();
    await loadChangeRequests();
    await loadDocuments();
    await loadTeamProfiles();
    await loadServices();
    await loadMessages();
    subscribeToChanges();
  } catch (error) {
    flash(error.message);
  } finally {
    state.loading = false;
    render();
  }

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    state.selectedId = null;
    if (!session) {
      state.profile = null;
      state.items = [];
      state.activities = [];
      state.changeRequests = [];
      state.documents = [];
      state.teamProfiles = [];
      state.services = [];
      state.editingServiceId = null;
      state.messages = [];
      state.messageThreadWith = null;
      state.messageThreadEmail = null;
      state.messageComposeOpen = false;
    }
    subscribeToChanges();
    await refreshFromDatabase();
  });
}

document.querySelectorAll(".nav button").forEach(button => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    state.selectedId = null;
    render();
  });
});

document.getElementById("brandHomeBtn").addEventListener("click", () => {
  state.view = "overview";
  state.selectedId = null;
  render();
});

document.querySelectorAll(".segmented button").forEach(button => {
  button.addEventListener("click", () => {
    state.type = button.dataset.type;
    render();
  });
});

searchInput.addEventListener("input", event => {
  state.search = event.target.value;
  renderBoard();
});
ownerFilter.addEventListener("change", event => {
  state.owner = event.target.value;
  renderBoard();
});
priorityFilter.addEventListener("change", event => {
  state.priority = event.target.value;
  renderBoard();
});
document.getElementById("addBtn").addEventListener("click", addItem);
signOutBtn.addEventListener("click", () => {
  signOut();
  profileDropdown.classList.remove("open");
});
document.getElementById("closeSide").addEventListener("click", () => {
  state.selectedId = null;
  sidePanel.classList.remove("open");
  render();
});

loginForm.addEventListener("submit", handleAuthSubmit);
document.getElementById("forgotPasswordBtn").addEventListener("click", forgotPassword);

document.getElementById("themeToggle").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = state.theme;
  document.getElementById("themeToggle").textContent = state.theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("crm-theme", state.theme);
});
document.getElementById("themeToggle").textContent = state.theme === "dark" ? "☀️" : "🌙";

document.getElementById("profileAvatarBtn").addEventListener("click", () => {
  profileDropdown.classList.toggle("open");
});
document.addEventListener("click", event => {
  if (!profileMenu.contains(event.target)) profileDropdown.classList.remove("open");
});

document.getElementById("footerYear").textContent = new Date().getFullYear();

document.getElementById("closePreview").addEventListener("click", closePreview);
previewOverlay.addEventListener("click", event => {
  if (event.target === previewOverlay) closePreview();
});

document.getElementById("closeConfirm").addEventListener("click", closeConfirm);
document.getElementById("confirmCancelBtn").addEventListener("click", closeConfirm);
document.getElementById("confirmOkBtn").addEventListener("click", () => {
  const callback = confirmCallback;
  closeConfirm();
  if (callback) callback();
});
confirmOverlay.addEventListener("click", event => {
  if (event.target === confirmOverlay) closeConfirm();
});

document.addEventListener("keydown", event => {
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
  if (event.key === "Escape") {
    if (!confirmOverlay.hidden) closeConfirm();
    else if (!previewOverlay.hidden) closePreview();
    else if (sidePanel.classList.contains("open")) {
      state.selectedId = null;
      sidePanel.classList.remove("open");
      render();
    }
    return;
  }
  if (typing || appRoot.hidden) return;
  if (event.key === "/") {
    event.preventDefault();
    searchInput.focus();
  } else if (event.key === "n" && canEdit() && ["pipeline", "projects", "focus"].includes(state.view)) {
    event.preventDefault();
    addItem();
  }
});

initializeSupabase();
