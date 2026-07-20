'use strict';
// =============================================================
// VRH Production OS - Application v3.0
// Новая модель: Изделие → Компоненты → История
// =============================================================

const APP_BUILD = 'DEPLOY #158';

// ── Supabase ────────────────────────────────────────────────────
const _SB_URL = 'https://ypujmvfzboautqesvwib.supabase.co';
const _SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdWptdmZ6Ym9hdXRxZXN2d2liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzODA2NTYsImV4cCI6MjA5Nzk1NjY1Nn0.S49aTm3RWhcbOsiE8-QYzFSaXTkafapXqbeds8P0TwE';
let _sb = null;
let _customAssignees   = [];
let _assigneeProfiles  = {}; // { [name]: { phone, email, title, company } }
let _itemOrder = {};
let _customProjects = [];
let _workflowStages = {}; // { [item_id]: Stage[] }
let _itemMaterials  = {}; // { [item_id]: Material[] }
let _events         = []; // Event[] из Supabase
// CRM: _crmClients / _crmHistory объявлены в js/crm.js (загружается до app.js),
// здесь только сбрасываются при logout и заполняются через loadCrmData()

// Базовые длины массивов (зафиксированы при загрузке из data.js)
const _VRH_ITEMS_BASE_LEN    = VRH_ITEMS.length;
const _VRH_PROJECTS_BASE_LEN = VRH_PROJECTS.length;

// ── State ──────────────────────────────────────────────────────
const state = {
  view: 'dashboard',
  projectId: null,
  itemId: null,
  filter: { complex: 'all', status: 'all', search: '' },
};

let localEdits = {};

// ── Init ────────────────────────────────────────────────────────
// ── Splash ──────────────────────────────────────────────────
let _splashRaf = null;
let _splashPct = 0;

function _setSplashPct(pct) {
  _splashPct = pct;
  const fill = document.getElementById('splash-fill');
  const pctEl = document.getElementById('splash-pct');
  if (fill)  fill.style.width = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
  const idx = pct < 25 ? 0 : pct < 50 ? 1 : pct < 75 ? 2 : 3;
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('splash-step-' + i);
    if (el) el.classList.toggle('splash-step-active', i === idx);
  }
}

function _startSplash() {
  const start = performance.now();
  const TARGET = 82;
  function tick(ts) {
    const t = Math.min((ts - start) / 2200, 1);
    const e = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    _setSplashPct(Math.round(e * TARGET));
    if (_splashPct < TARGET) _splashRaf = requestAnimationFrame(tick);
  }
  _splashRaf = requestAnimationFrame(tick);
}

function _hideSplash(onDone) {
  if (_splashRaf) { cancelAnimationFrame(_splashRaf); _splashRaf = null; }
  const from = _splashPct;
  const start = performance.now();
  function finish(ts) {
    const t = Math.min((ts - start) / 350, 1);
    _setSplashPct(Math.round(from + (100 - from) * t));
    if (t < 1) { requestAnimationFrame(finish); return; }
    setTimeout(() => {
      const el = document.getElementById('splash-screen');
      if (!el) { if (onDone) onDone(); return; }
      el.style.transition = 'opacity 0.35s ease';
      el.style.opacity = '0';
      setTimeout(() => { el.remove(); if (onDone) onDone(); }, 360);
    }, 180);
  }
  requestAnimationFrame(finish);
}

document.addEventListener('DOMContentLoaded', async () => {
  _startSplash();
  _sb = supabase.createClient(_SB_URL, _SB_KEY);
  const { data: { session } } = await _sb.auth.getSession();
  if (!session) { _hideSplash(() => showLoginScreen()); return; }
  await initApp();
  _hideSplash();
});

async function initApp() {
  state.filter = { complex: 'all', status: 'all', search: '' };
  try { await loadRemoteData(); } catch(e) { console.error('loadRemoteData failed:', e); }
  applyEdits();
  setupNavigation();
  handleHash();
  updateProblemsBadge();
  _updateEventsBadge();
  const badge = document.querySelector('.deploy-badge');
  if (badge) badge.textContent = APP_BUILD;
}

function showLoginScreen() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('mobile-nav').style.display = 'none';
  document.getElementById('mobile-more-overlay')?.classList.remove('open');
  document.getElementById('mobile-more-sheet')?.classList.remove('open');
  document.getElementById('login-screen').style.display = 'flex';
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-error');
  if (!email || !pw) { err.textContent = 'Введите email и пароль'; return; }
  btn.disabled = true; btn.textContent = 'Вход...'; err.textContent = '';
  const { error } = await _sb.auth.signInWithPassword({ email, password: pw });
  if (error) {
    err.textContent = 'Неверный email или пароль';
    btn.disabled = false; btn.textContent = 'Войти';
    return;
  }
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = '';
  document.getElementById('mobile-nav').style.display = '';
  await initApp();
}

async function doLogout() {
  await _sb.auth.signOut();
  localEdits = {}; _customAssignees = []; _assigneeProfiles = {}; _itemOrder = {}; _customProjects = []; _workflowStages = {};
  _crmClients = []; _crmHistory = {}; _crmContacts = {};
  if (typeof loadWarehouseData === 'function') loadWarehouseData([], [], []);
  if (typeof loadTasksData === 'function') loadTasksData([], []);
  VRH_ITEMS.splice(_VRH_ITEMS_BASE_LEN);
  VRH_PROJECTS.splice(_VRH_PROJECTS_BASE_LEN);
  VRH_ITEMS.forEach(item => {
    const orig = window._VRH_ORIG?.[item.id];
    if (orig) Object.assign(item, orig);
  });
  showLoginScreen();
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').textContent = '';
}

async function loadRemoteData() {
  const [ovRes, asRes, orRes, cpRes, wsRes, imRes, evRes, crmRes, crmHistRes,
         supRes, supContRes, supHistRes, supBankRes,
         whItemsRes, whCatsRes, whTxRes,
         tkTasksRes, tkCommRes] = await Promise.all([
    _sb.from('item_overrides').select('*'),
    _sb.from('custom_assignees').select('*').order('id'),
    _sb.from('item_order').select('*'),
    _sb.from('custom_projects').select('*').order('created_at'),
    _sb.from('workflow_stages').select('*').order('stage_order'),
    _sb.from('item_materials').select('*').order('sort_order'),
    _sb.from('events').select('*').order('event_date'),
    _sb.from('crm_clients').select('*').order('created_at', { ascending: false }),
    _sb.from('crm_stage_history').select('*').order('created_at'),
    _sb.from('suppliers').select('*').order('created_at', { ascending: false }),
    _sb.from('supplier_contacts').select('*').order('created_at'),
    _sb.from('supplier_history').select('*').order('event_date', { ascending: false }),
    _sb.from('supplier_bank').select('*').order('created_at'),
    _sb.from('inventory_items').select('*').order('created_at'),
    _sb.from('inventory_categories').select('*').order('name'),
    _sb.from('inventory_transactions').select('*').order('date', { ascending: false }),
    _sb.from('manager_tasks').select('*').order('created_at'),
    _sb.from('manager_task_comments').select('*').order('created_at'),
  ]);
  if (ovRes.data) {
    localEdits = {};
    _assigneeProfiles = {};
    ovRes.data.forEach(r => {
      if (r.item_id.startsWith('_ap_')) {
        const name = r.item_id.slice(4);
        _assigneeProfiles[name] = r.data || {};
      } else {
        localEdits[r.item_id] = r.data;
      }
    });
  }
  if (asRes.data) {
    _customAssignees = asRes.data.map(r => ({ name: r.name, colorIdx: r.color_idx }));
  }
  if (orRes.data) {
    _itemOrder = {};
    orRes.data.forEach(r => { _itemOrder[r.complex_id] = r.order_json; });
  }

  // Сброс custom-хвоста массивов (идемпотентность при re-login)
  VRH_ITEMS.splice(_VRH_ITEMS_BASE_LEN);
  VRH_PROJECTS.splice(_VRH_PROJECTS_BASE_LEN);
  _customProjects = [];
  _workflowStages = {};
  _itemMaterials  = {};
  _events         = [];

  // Инжект пользовательских проектов
  if (cpRes.data) {
    cpRes.data.forEach(r => {
      const p = { id: r.id, name: r.name, client: r.client,
        location: r.location, description: r.description,
        deadline: r.deadline, type: r.type,
        cover: Number.isInteger(r.cover) ? r.cover : undefined,
        workflow_version: r.workflow_version ?? 2, _isCustom: true };
      VRH_PROJECTS.push(p);
      _customProjects.push(p);
    });
  }

  // Инжект пользовательских позиций из item_overrides (is_custom: true)
  Object.entries(localEdits).forEach(([id, ed]) => {
    if (ed && ed.is_custom && !ed.deleted) {
      VRH_ITEMS.push(_buildCustomItem(id, ed));
    }
  });

  // Загрузка этапов маршрута (workflow v2)
  if (wsRes.data) {
    wsRes.data.forEach(r => {
      if (!_workflowStages[r.item_id]) _workflowStages[r.item_id] = [];
      _workflowStages[r.item_id].push({
        id: r.id, item_id: r.item_id, project_id: r.project_id,
        name: r.name, stage_order: r.stage_order,
        planned_qty: r.planned_qty, done_qty: r.done_qty,
        assignee: r.assignee, status: r.status, comment: r.comment,
        start_date: r.start_date, end_date: r.end_date,
        priority: r.priority, required: r.required,
        depends_on: Array.isArray(r.depends_on) ? r.depends_on : [], history: r.history || [],
        created_at: r.created_at,
      });
    });
  }

  // Синхронизируем doneCount v2-позиций из узкого места маршрута
  VRH_ITEMS.forEach(item => {
    if (isV2Project(item.projectId)) syncV2ItemDoneCount(item.id);
  });

  // Загрузка событий
  if (evRes.data) {
    _events = evRes.data.map(r => ({
      id: r.id, item_id: r.item_id, project_id: r.project_id,
      title: r.title, event_date: r.event_date,
      type: r.type || 'custom', done: r.done, created_at: r.created_at,
    }));
  }

  // Загрузка спецификаций материалов
  if (imRes.data) {
    imRes.data.forEach(r => {
      if (!_itemMaterials[r.item_id]) _itemMaterials[r.item_id] = [];
      _itemMaterials[r.item_id].push({
        id: r.id, item_id: r.item_id, project_id: r.project_id,
        name: r.name, qty: r.qty, unit: r.unit,
        have: r.have, sort_order: r.sort_order, created_at: r.created_at,
      });
    });
  }

  // Загрузка CRM (клиенты + история этапов) - данные живут в js/crm.js
  loadCrmData(crmRes.data, crmHistRes.data);

  // Загрузка Поставщиков - данные живут в js/suppliers.js
  loadSuppliersData(supRes.data, supContRes.data, supHistRes.data, supBankRes.data);

  // Загрузка Склада - данные живут в js/warehouse.js
  if (typeof loadWarehouseData === 'function') {
    loadWarehouseData(whItemsRes.data, whCatsRes.data, whTxRes.data);
  }

  // Загрузка Задач - данные живут в js/tasks.js
  if (typeof loadTasksData === 'function') {
    loadTasksData(tkTasksRes.data, tkCommRes.data);
  }
}

// =============================================================
// WORKFLOW v2 - HELPERS
// =============================================================
function isV2Project(projectId) {
  const p = VRH_PROJECTS.find(x => x.id === projectId);
  return p?.workflow_version === 2;
}

function getItemStages(itemId) {
  return (_workflowStages[itemId] || []).slice().sort((a, b) => a.stage_order - b.stage_order);
}

function getWorkflowBottleneck(itemId) {
  const stages = getItemStages(itemId).filter(s => s.required);
  if (!stages.length) return null;
  return stages.reduce((min, s) => s.done_qty < min.done_qty ? s : min, stages[0]);
}

function syncV2ItemDoneCount(itemId) {
  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  const stages = getItemStages(itemId).filter(s => s.required);
  if (!stages.length) { item.doneCount = 0; return; }
  item.doneCount = Math.min(...stages.map(s => s.done_qty));
}

function saveStageToStorage(stage) {
  if (!_sb) return;
  (async () => {
    try {
      await _sb.from('workflow_stages').upsert({
        id: stage.id, item_id: stage.item_id, project_id: stage.project_id,
        name: stage.name, stage_order: stage.stage_order,
        planned_qty: stage.planned_qty, done_qty: stage.done_qty,
        assignee: stage.assignee, status: stage.status, comment: stage.comment,
        start_date: stage.start_date, end_date: stage.end_date,
        priority: stage.priority, required: stage.required,
        depends_on: stage.depends_on, history: stage.history,
        created_at: stage.created_at || new Date().toISOString(),
      });
    } catch(e) { console.error('saveStage error:', e); }
  })();
}
window.saveStageToStorage = saveStageToStorage;

function _buildCustomItem(id, ed) {
  return {
    id,
    projectId:       ed.projectId       || '',
    complexId:       ed.complexId       || '',
    number:          ed.number          || '',
    name:            ed.name            || ed.nameShort || '',
    nameShort:       ed.nameShort       || ed.name      || '',
    quantity:        ed.quantity        != null ? ed.quantity : 1,
    unit:            ed.unit            || 'шт',
    deadline:        ed.deadline        || '',
    type:            ed.type            || 'purchased',
    doneCount:       ed.doneCount       || 0,
    materialsStatus: ed.materialsStatus || PUR.PENDING,
    purchaseStatus:      ed.purchaseStatus      || PUR.PENDING,
    blockReason:         ed.blockReason         || null,
    assignee:            ed.assignee            || '',
    notes:               ed.notes               || '',
    supplier:            ed.supplier            || '',
    payment_status:      ed.payment_status      || '',
    payment_date:        ed.payment_date        || '',
    payment_amount:      ed.payment_amount      || 0,
    expected_delivery:   ed.expected_delivery   || '',
    shipping_status:     ed.shipping_status     || '',
    components:          ed.components          || [],
    history:             ed.history             || [],
    _isCustom:           true,
  };
}

window.doLogin  = doLogin;
window.doLogout = doLogout;
window.addEventListener('hashchange', () => { if (_sb) handleHash(); });

// ── Router ──────────────────────────────────────────────────────
function handleHash() {
  const hash  = window.location.hash.replace('#', '') || 'home';
  const parts = hash.split('/');
  state.view      = parts[0] || 'home';
  state.projectId = parts[1] || null;
  state.itemId    = parts[2] || null;
  render();
  updateActiveNav();
  const viewEl = document.getElementById('view');
  if (viewEl) viewEl.scrollTop = 0;
}

function navigate(view, id1, id2) {
  let hash = view;
  if (id1) hash += '/' + id1;
  if (id2) hash += '/' + id2;
  window.location.hash = hash;
}

function setupNavigation() {
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.dataset.nav);
      closeMobileSidebar();
    });
  });
  document.getElementById('topbar-menu-btn')?.addEventListener('click', toggleMobileSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeMobileSidebar);
}

function updateActiveNav() {
  document.querySelectorAll('[data-nav]').forEach(el => {
    const isActive = el.dataset.nav === state.view ||
      (state.view === 'project'        && el.dataset.nav === 'projects') ||
      (state.view === 'item'           && el.dataset.nav === 'projects') ||
      (state.view === 'crm-client'     && el.dataset.nav === 'crm') ||
      (state.view === 'supplier'       && el.dataset.nav === 'suppliers') ||
      (state.view === 'warehouse-item' && el.dataset.nav === 'warehouse');
    el.classList.toggle('active', isActive);
  });
  // Кнопка «Ещё» — активна если текущий вид принадлежит этому меню
  const moreViews = ['dashboard', 'problems', 'ai', 'events', 'suppliers', 'supplier', 'warehouse', 'warehouse-item', 'assignees'];
  const moreBtn = document.getElementById('mobile-more-btn');
  if (moreBtn) moreBtn.classList.toggle('active', moreViews.includes(state.view));
}

function updateProblemsBadge() {
  const probs = getAllProblems();
  const total = probs.overdue.length + probs.noKd.length + probs.blocked.length;
  const badge = document.getElementById('problems-badge');
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-block' : 'none';
  }
  // Синхронизируем бейдж в меню «Ещё»
  const moreBadge = document.getElementById('more-problems-badge');
  if (moreBadge) {
    moreBadge.textContent = total;
    moreBadge.style.display = total > 0 ? 'inline-flex' : 'none';
  }
  _updateMoreBtnDot();
}

function toggleMobileSidebar() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
}
window.toggleMobileSidebar = toggleMobileSidebar;

// ── Mobile More Menu ─────────────────────────────────────────────
function toggleMobileMore() {
  const overlay = document.getElementById('mobile-more-overlay');
  const sheet   = document.getElementById('mobile-more-sheet');
  if (!overlay || !sheet) return;
  const isOpen = overlay.classList.contains('open');
  overlay.classList.toggle('open', !isOpen);
  sheet.classList.toggle('open', !isOpen);
}
function closeMobileMore() {
  document.getElementById('mobile-more-overlay')?.classList.remove('open');
  document.getElementById('mobile-more-sheet')?.classList.remove('open');
}
function _updateMoreBtnDot() {
  const dot = document.querySelector('#mobile-more-btn .mobile-nav-more-dot');
  if (!dot) return;
  const evBadge   = document.getElementById('events-badge');
  const probBadge = document.getElementById('problems-badge');
  const hasAlert  = (evBadge   && evBadge.style.display   !== 'none' && evBadge.textContent   !== '0') ||
                    (probBadge  && probBadge.style.display !== 'none' && probBadge.textContent !== '0');
  dot.style.display = hasAlert ? 'block' : 'none';
}
window.toggleMobileMore = toggleMobileMore;
window.closeMobileMore  = closeMobileMore;

// ── Master Render ───────────────────────────────────────────────
function render() {
  const content = document.getElementById('content');
  if (!content) return;

  if (state.view !== 'assignees') _asgnSearch = '';

  const _prevFocusId = document.activeElement?.id;
  const _prevSelStart = document.activeElement?.selectionStart ?? null;

  content.classList.remove('fade-in');
  void content.offsetWidth;
  content.classList.add('fade-in');

  switch (state.view) {
    case 'dashboard': renderDashboard(content); setBreadcrumb('Обзор');    updatePlatformSidebar('production'); break;
    case 'projects':  renderProjects(content);  setBreadcrumb('Проекты');    updatePlatformSidebar('production'); break;
    case 'project':   renderProject(content, state.projectId);               updatePlatformSidebar('production'); break;
    case 'item':      renderItem(content, state.projectId, state.itemId);    updatePlatformSidebar('production'); break;
    case 'problems':  renderProblems(content);  setBreadcrumb('Проблемы');   updatePlatformSidebar('production'); break;
    case 'ai':        renderAI(content);        setBreadcrumb('AI-помощник'); updatePlatformSidebar('production'); break;
    case 'report':    renderReport(content, state.projectId);                  updatePlatformSidebar('production'); break;
    case 'events':    renderEvents(content);    setBreadcrumb('События');      updatePlatformSidebar('production'); break;
    case 'home':
      renderPlatformHome(content);
      setBreadcrumb('Рабочий стол');
      updatePlatformSidebar('home');
      break;
    case 'crm':
      renderCrmList(content);
      setBreadcrumb('CRM');
      updatePlatformSidebar('crm');
      break;
    case 'crm-client':
      renderCrmClient(content, state.projectId);
      setBreadcrumb('CRM', 'Клиент');
      updatePlatformSidebar('crm');
      break;
    case 'suppliers':
      renderSuppliersList(content);
      updatePlatformSidebar('suppliers');
      break;
    case 'supplier':
      renderSupplierDetail(content, state.projectId);
      updatePlatformSidebar('suppliers');
      break;
    case 'erp-projects':
      renderErpProjects(content);
      setBreadcrumb('Проекты');
      updatePlatformSidebar('erp-projects');
      break;
    case 'warehouse':
      renderWarehouseList(content);
      updatePlatformSidebar('warehouse');
      break;
    case 'warehouse-item':
      renderWarehouseItem(content, state.projectId);
      updatePlatformSidebar('warehouse');
      break;
    case 'tasks':
      renderTasksList(content);
      updatePlatformSidebar('tasks');
      break;
    case 'assignees':
      renderAssigneesPage(content);
      setBreadcrumb('Исполнители');
      updatePlatformSidebar('assignees');
      break;
    default: navigate('home');
  }
  _updateEventsBadge();
  updateProblemsBadge();

  requestAnimationFrame(() => {
    if (_prevFocusId === 'filter-search-input') {
      const inp = document.getElementById('filter-search-input');
      if (inp) {
        inp.focus();
        if (_prevSelStart !== null) inp.setSelectionRange(_prevSelStart, _prevSelStart);
      }
    } else if (!state.filter.search) {
      const inp = document.getElementById('filter-search-input');
      if (inp) inp.value = '';
    }
  });
}

function setBreadcrumb(...parts) {
  const bc = document.getElementById('breadcrumb');
  if (!bc) return;
  bc.innerHTML = parts.map((p, i) =>
    i < parts.length - 1
      ? `<span class="bc-item" style="cursor:pointer" onclick="navigate('${p.link}')">${p.label || p}</span><span class="bc-sep">›</span>`
      : `<span class="bc-item">${p.label || p}</span>`
  ).join('');
}

// =============================================================
// SVG ICON HELPER
// =============================================================
function iconSvg(name, size = 14) {
  const s = size;
  const icons = {
    user:      `<svg viewBox="0 0 16 16" fill="currentColor" width="${s}" height="${s}"><path d="M8 8a3 3 0 100-6 3 3 0 000 6zm-5 6s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3z"/></svg>`,
    calendar:  `<svg viewBox="0 0 16 16" fill="currentColor" width="${s}" height="${s}"><path d="M3.5 0a.5.5 0 01.5.5V1h8V.5a.5.5 0 011 0V1h1a2 2 0 012 2v11a2 2 0 01-2 2H2a2 2 0 01-2-2V3a2 2 0 012-2h1V.5a.5.5 0 01.5-.5zM1 4v10a1 1 0 001 1h12a1 1 0 001-1V4H1z"/></svg>`,
    list:      `<svg viewBox="0 0 16 16" fill="currentColor" width="${s}" height="${s}"><path d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z"/></svg>`,
    warning:   `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
    check:     `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`,
    pause:     `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
    x:         `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`,
    document:  `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>`,
    chart:     `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>`,
    folder:    `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>`,
    clipboard: `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>`,
    chat:      `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd"/></svg>`,
    save:      `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293z"/></svg>`,
    refresh:   `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>`,
    alert:     `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
    clock:     `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>`,
    minus:     `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>`,
    edit:      `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>`,
    plus:      `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>`,
    cart:      `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>`,
    ai:        `<svg viewBox="0 0 24 24" fill="currentColor" width="${s}" height="${s}"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18A2.5 2.5 0 0 0 10 15.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5z"/></svg>`,
    grip:      `<svg viewBox="0 0 16 16" fill="currentColor" width="${s}" height="${s}"><circle cx="5.5" cy="4" r="1.1"/><circle cx="10.5" cy="4" r="1.1"/><circle cx="5.5" cy="8" r="1.1"/><circle cx="10.5" cy="8" r="1.1"/><circle cx="5.5" cy="12" r="1.1"/><circle cx="10.5" cy="12" r="1.1"/></svg>`,
    trash:     `<svg viewBox="0 0 20 20" fill="currentColor" width="${s}" height="${s}"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
  };
  return icons[name] || '';
}

// =============================================================
// VIEW: DASHBOARD
// =============================================================
function renderDashboard(el) {
  const stats = getCompanyStats();
  const pct   = stats.total > 0
    ? Math.round((stats.done / stats.total) * 100) : 0;

  el.innerHTML = `
    <div class="dashboard-shell">
      <div class="dashboard-heading">
        <div>
          <div class="dashboard-eyebrow">Производство · ${formatDate(TODAY)}</div>
          <h1 class="dashboard-title">Обзор производства</h1>
          <p class="dashboard-subtitle">Сводное состояние проектов и позиций ВРХ Инжиниринг</p>
        </div>
        <button class="dashboard-all-projects" onclick="navigate('projects')">
          Все проекты ${iconSvg('list', 13)}
        </button>
      </div>

      <div class="dashboard-metrics">
        ${statCard(stats.overdue, 'Просрочено', stats.overdue > 0 ? 'Требует внимания' : 'Отклонений нет', stats.overdue > 0 ? 'red' : 'green', 'warning')}
        ${statCard(stats.inProg, 'В работе', 'Активных позиций', '', 'refresh')}
        ${statCard(stats.done, 'Готово', `Из ${stats.total} позиций`, 'green', 'check')}
        ${statCard(pct + '%', 'Изготовлено', 'Общая готовность', 'blue', 'chart')}
        ${statCard(VRH_PROJECTS.length, 'Проектов', 'В производственном контуре', '', 'folder')}
        ${statCard(stats.total, 'Позиций', 'Всего оборудования', '', 'list')}
      </div>

      <div class="dashboard-workspace">
        <section class="dashboard-projects-panel">
          <div class="dashboard-panel-heading">
            <div>
              <div class="dashboard-panel-title">Проекты</div>
              <div class="dashboard-panel-subtitle">Текущий производственный портфель</div>
            </div>
            <span class="dashboard-panel-count">${VRH_PROJECTS.length}</span>
          </div>
          <div class="projects-grid dashboard-projects-grid">
            ${VRH_PROJECTS.map(p => projectCard(p)).join('')}
          </div>
        </section>

        <aside class="dashboard-attention-panel">
          ${renderQuickProblems()}
        </aside>
      </div>
    </div>
  `;
}

function statCard(value, label, sub, variant, icon) {
  const iconHtml = icon
    ? `<div class="kpi-icon">${iconSvg(icon, 14)}</div>`
    : '';
  return `
    <div class="kpi-card ${variant}">
      <div class="kpi-header">
        ${iconHtml}
        <span class="kpi-label">${label}</span>
      </div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-sub">${sub}</div>
    </div>`;
}

function getProjectCover(project) {
  // Для legacy-проектов - localStorage override
  if (!project._isCustom) {
    try {
      const ls = JSON.parse(localStorage.getItem('vrh_project_covers') || '{}');
      if (typeof ls[project.id] === 'number') return ls[project.id];
    } catch(e) {}
  }
  if (typeof project.cover === 'number' && project.cover >= 0 && project.cover <= 5) {
    return Math.trunc(project.cover);
  }
  let h = 0;
  for (const c of (project.id || '')) h = (h * 31 + c.charCodeAt(0)) & 0xFFFF;
  return Math.abs(h) % 6;
}

function projectCard(project) {
  const pct      = getProjectProgress(project.id);
  const problems = getAllProblems(project.id);
  const color    = pctColor(pct);
  const isOverdue = new Date(project.deadline) < TODAY;

  const warnings = [];
  if (problems.overdue.length)
    warnings.push(`<span class="project-warn-tag red">${iconSvg('warning',10)} Просрочено: ${problems.overdue.length}</span>`);
  if (problems.noKd.length)
    warnings.push(`<span class="project-warn-tag amber">${iconSvg('document',10)} Нет КД: ${problems.noKd.length}</span>`);
  if (problems.blocked.length)
    warnings.push(`<span class="project-warn-tag blue">${iconSvg('pause',10)} Блок: ${problems.blocked.length}</span>`);

  return `
    <div class="project-card" onclick="navigate('project','${project.id}')">
      <div class="project-card-cover">
        <img src="assets/covers/cover-${getProjectCover(project)}.jpg" alt="" loading="lazy">
      </div>
      <div class="project-card-body">
      <div class="project-card-header">
        <div style="flex:1;min-width:0">
          <div class="project-name">${project.name}</div>
          <div class="project-client">${project.client}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
          <div class="project-pct" style="color:${color}">${pct}%</div>
        </div>
      </div>
      <div class="pbar-wrap">
        <div class="pbar-fill ${pbarClass(pct)}" style="width:${pct}%"></div>
      </div>
      <div class="project-meta">
        <div class="project-meta-item">
          ${iconSvg('calendar', 11)}
          <span style="${isOverdue ? 'color:#EF4444' : ''}">
            ${formatDate(new Date(project.deadline))}${isOverdue ? ' · просрочен' : ''}
          </span>
        </div>
        <div class="project-meta-item">
          ${iconSvg('list', 11)}
          ${getProjectItems(project.id).length} позиций
        </div>
        <div class="project-meta-item">
          ${iconSvg('folder', 11)}
          ${project.location}
        </div>
      </div>
      ${warnings.length ? `<div class="project-warnings">${warnings.join('')}</div>` : ''}
      </div>
    </div>`;
}

function renderQuickProblems() {
  const problems = getAllProblems();
  const total = problems.overdue.length + problems.noKd.length + problems.blocked.length;
  if (!total) return `
    <div class="dashboard-panel-heading">
      <div>
        <div class="dashboard-panel-title">Требует внимания</div>
        <div class="dashboard-panel-subtitle">Отклонения и блокировки</div>
      </div>
    </div>
    <div class="empty-state empty-state--compact">
      <img src="assets/empty/empty-ok.png" class="empty-state-img" alt="">
      <div class="empty-state-title">Отклонений не обнаружено</div>
      <div class="empty-state-text">Все позиции работают в штатном режиме</div>
    </div>`;

  return `
    <div class="dashboard-panel-heading">
      <div>
        <div class="dashboard-panel-title">Требует внимания</div>
        <div class="dashboard-panel-subtitle">${total} отклонений в работе</div>
      </div>
      <button class="dashboard-panel-link" onclick="navigate('problems')">Все проблемы</button>
    </div>
      <div class="dashboard-problem-list">
        ${problems.overdue.slice(0,3).map(item => {
          const days = daysOverdue(item.deadline);
          return `
          <div class="problem-item dashboard-problem-row" onclick="navigate('item','${item.projectId}','${item.id}')">
            <div class="problem-item-icon red">${iconSvg('alert',13)}</div>
            <div style="flex:1">
              <div class="problem-item-name">${item.nameShort}</div>
              <div class="problem-item-meta">${getComplexAbbr(item.complexId)} · Просрочено ${days} дн.</div>
            </div>
            <span class="badge badge-overdue">${days} дн.</span>
          </div>`;
        }).join('')}
        ${problems.noKd.slice(0,2).map(item => `
          <div class="problem-item dashboard-problem-row" onclick="navigate('item','${item.projectId}','${item.id}')">
            <div class="problem-item-icon amber">${iconSvg('document',13)}</div>
            <div style="flex:1">
              <div class="problem-item-name">${item.nameShort}</div>
              <div class="problem-item-meta">${getComplexAbbr(item.complexId)} · Нет КД</div>
            </div>
            <span class="badge badge-blocked">Нет КД</span>
          </div>`).join('')}
      </div>
      <button class="dashboard-attention-footer" onclick="navigate('problems')">
        Открыть панель проблем ${iconSvg('list', 12)}
      </button>`;
}

// =============================================================
// VIEW: PROJECTS LIST
// =============================================================
function renderProjects(el) {
  el.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Все проекты</div>
        <div class="section-sub">${VRH_PROJECTS.length} проектов в работе</div>
      </div>
      <button class="btn-primary" onclick="openCreateProjectModal()" style="display:inline-flex;align-items:center;gap:6px">
        ${iconSvg('plus', 13)} Новый проект
      </button>
    </div>
    ${VRH_PROJECTS.length ? `
      <div class="projects-grid">
        ${VRH_PROJECTS.map(p => projectCard(p)).join('')}
      </div>` : `
      <div class="empty-state">
        <img src="assets/empty/empty-projects.png" class="empty-state-img" alt="">
        <div class="empty-state-title">Нет активных проектов</div>
        <div class="empty-state-text">Создайте первый проект, чтобы начать управление производством</div>
        <button class="btn-primary empty-state-btn" onclick="openCreateProjectModal()">
          ${iconSvg('plus', 12)} Создать проект
        </button>
      </div>`}`;
}

// =============================================================
// VIEW: PROJECT DETAIL
// =============================================================
function renderProject(el, projectId) {
  const project = VRH_PROJECTS.find(p => p.id === projectId);
  if (!project) { el.innerHTML = '<p>Проект не найден</p>'; return; }

  const pct      = getProjectProgress(projectId);
  const items    = getProjectItems(projectId);
  const problems = getAllProblems(projectId);
  setBreadcrumb({ label: 'Проекты', link: 'projects' }, project.name);

  const complexFilter = state.filter.complex;
  const statusFilter  = state.filter.status;
  const searchTerm    = (state.filter.search || '').toLowerCase();

  const filtered = items.filter(i => {
    if (complexFilter !== 'all' && i.complexId !== complexFilter) return false;
    if (statusFilter !== 'all') {
      const st = getItemStatus(i);
      if (statusFilter === 'overdue'     && st !== ST.OVERDUE)  return false;
      if (statusFilter === 'blocked'     && st !== ST.BLOCKED)  return false;
      if (statusFilter === 'in_progress' && st !== ST.IN_PROG)  return false;
      if (statusFilter === 'done'        && st !== ST.DONE)     return false;
      if (statusFilter === 'pending'     && st !== ST.PENDING)  return false;
    }
    if (searchTerm && !i.name.toLowerCase().includes(searchTerm) &&
        !i.nameShort.toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  const complexIds    = [...new Set(items.map(i => i.complexId))];
  const isOverdueProj = new Date(project.deadline) < TODAY;

  el.innerHTML = `
    <div class="card proj-header-card">
      <div class="proj-header-row">
        <div class="proj-header-body">
          <div class="proj-header-title-row">
            <div class="proj-header-name">${project.name}</div>
            <div style="display:flex;gap:8px;align-items:center">
              <button class="btn-secondary" onclick="navigate('report','${project.id}')"
                style="display:inline-flex;align-items:center;gap:6px">
                ${iconSvg('document', 11)} Отчёт закупок
              </button>
              <button class="btn-secondary" onclick="openChangeCoverModal('${project.id}')"
                style="display:inline-flex;align-items:center;gap:6px">
                ${iconSvg('edit', 11)} Обложка
              </button>
              <button class="btn-secondary proj-delete-btn" onclick="confirmDeleteProject('${project.id}')"
                onmouseover="this.style.background='rgba(227,6,19,0.06)';this.style.borderColor='#EF4444'"
                onmouseout="this.style.background='var(--white)';this.style.borderColor='rgba(227,6,19,0.3)'">
                ${iconSvg('x', 11)} Удалить проект
              </button>
            </div>
          </div>
          <div class="proj-header-desc">${project.description}</div>
          <div class="proj-stat-tiles">
            <div class="proj-stat-tile slate">
              <div class="proj-stat-label">Дедлайн</div>
              <div class="proj-stat-value">${formatDate(new Date(project.deadline))}</div>
            </div>
            <div class="proj-stat-tile blue">
              <div class="proj-stat-label">Позиций</div>
              <div class="proj-stat-value">${items.length} шт.</div>
            </div>
            <div class="proj-stat-tile ${problems.overdue.length ? 'red' : 'green'}">
              <div class="proj-stat-label">Просрочено</div>
              <div class="proj-stat-value">${problems.overdue.length}</div>
            </div>
            <div class="proj-stat-tile ${problems.blocked.length ? 'amber' : 'green'}">
              <div class="proj-stat-label">Блок</div>
              <div class="proj-stat-value">${problems.blocked.length}</div>
            </div>
          </div>
        </div>
        <div class="proj-header-circle">${progressCircle(pct)}</div>
      </div>
      <div class="pbar-wrap proj-header-pbar">
        <div class="pbar-fill ${pbarClass(pct)}" style="width:${pct}%"></div>
      </div>
    </div>

    ${problems.overdue.length || problems.noKd.length || problems.blocked.length ? `
    <div class="proj-problems-bar">
      ${problems.overdue.length  ? `<div class="proj-problem-tag red">${iconSvg('warning',12)} Просрочено: ${problems.overdue.length}</div>` : ''}
      ${problems.noKd.length     ? `<div class="proj-problem-tag amber">${iconSvg('document',12)} Нет КД: ${problems.noKd.length}</div>` : ''}
      ${problems.blocked.length  ? `<div class="proj-problem-tag blue">${iconSvg('pause',12)} Блок: ${problems.blocked.length}</div>` : ''}
    </div>` : ''}

    <div class="filters-bar">
      <span class="filter-label">Фильтр:</span>
      <select class="filter-select" onchange="setFilter('complex',this.value)">
        <option value="all" ${state.filter.complex==='all'?'selected':''}>Все блоки</option>
        ${complexIds.map(cid => {
          const c = COMPLEXES.find(x => x.id === cid);
          return `<option value="${cid}" ${state.filter.complex===cid?'selected':''}>${c?.abbr || cid} - ${c?.name || cid}</option>`;
        }).join('')}
      </select>
      <select class="filter-select" onchange="setFilter('status',this.value)">
        <option value="all"         ${state.filter.status==='all'        ?'selected':''}>Все статусы</option>
        <option value="in_progress" ${state.filter.status==='in_progress'?'selected':''}>В работе</option>
        <option value="pending"     ${state.filter.status==='pending'    ?'selected':''}>Ожидает</option>
        <option value="overdue"     ${state.filter.status==='overdue'    ?'selected':''}>Просрочено</option>
        <option value="blocked"     ${state.filter.status==='blocked'    ?'selected':''}>Заблокировано</option>
        <option value="done"        ${state.filter.status==='done'       ?'selected':''}>Готово</option>
      </select>
      <input type="text" class="filter-select" placeholder="Поиск..." value="${state.filter.search||''}"
        oninput="setFilter('search',this.value)" autocomplete="off" name="vrh-filter-q" id="filter-search-input"
        style="padding-right:10px;min-width:140px">
      <span style="font-size:12px;color:var(--gray-400);margin-left:auto">${filtered.length} из ${items.length}</span>
      <button class="btn-primary" onclick="openCreateItemModal('${projectId}')" style="display:inline-flex;align-items:center;gap:6px;flex-shrink:0">
        ${iconSvg('plus', 12)} Добавить позицию
      </button>
    </div>

    ${complexIds
      .filter(cid => filtered.some(i => i.complexId === cid))
      .map(cid => {
        const cItems = applyItemOrder(cid, filtered.filter(i => i.complexId === cid));
        const complex = COMPLEXES.find(c => c.id === cid);
        const cTotalQty  = cItems.reduce((s,i) => s + i.quantity, 0);
        const cTotalDone = cItems.reduce((s,i) => s + getItemDone(i), 0);
        const cPct = cTotalQty > 0 ? Math.round(cTotalDone / cTotalQty * 100) : 0;
        return `
          <div class="items-card" style="margin-bottom:16px">
            <div class="items-card-header">
              <div class="items-card-title">
                <span class="complex-badge complex-${cid}">${cid}</span>
                ${complex?.name || cid}
                <span class="items-count">${cItems.length} поз.</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <div style="font-size:12px;font-weight:700;color:${pctColor(cPct)}">${cPct}%</div>
                <div class="pbar-wrap" style="width:80px;margin-top:0">
                  <div class="pbar-fill ${pbarClass(cPct)}" style="width:${cPct}%"></div>
                </div>
              </div>
            </div>
            <div class="items-grid-wrap">
              <div class="items-grid" data-complex="${cid}">
                <div class="ig-header">
                  <div class="ig-cell ig-drag"></div>
                  <div class="ig-cell ig-num">№</div>
                  <div class="ig-cell ig-name">Наименование</div>
                  <div class="ig-cell ig-qty">Кол-во</div>
                  <div class="ig-cell ig-done">Готово</div>
                  <div class="ig-cell ig-status">Статус</div>
                  <div class="ig-cell ig-progress">Прогресс</div>
                  <div class="ig-cell ig-deadline">Дедлайн</div>
                  <div class="ig-cell ig-shipping">Отгрузка</div>
                </div>
                ${cItems.map(item => itemTableRow(item, projectId)).join('')}
              </div>
            </div>
          </div>`;
      }).join('')}

    ${filtered.length === 0 ? '<div class="empty-state"><p>Нет позиций по выбранным фильтрам</p></div>' : ''}
  `;

  complexIds.forEach(cid => {
    const grid = el.querySelector(`.items-grid[data-complex="${cid}"]`);
    if (grid) initGridDrag(grid, cid, projectId);
  });
}

function purMiniLabel(status) {
  return { received: 'Получено', partial: 'Частично', ordered: 'Заказано', pending: 'Не заказано' }[status] || status;
}

function itemTableRow(item, projectId) {
  const pct    = calcProgress(item);
  const status = getItemStatus(item);
  const done   = getItemDone(item);
  const od     = daysOverdue(item.deadline);
  const color  = pctColor(pct);
  const bn     = getBottleneck(item);

  // Вторичная строка (блокировка / узкое место)
  const secondary = item.blockReason
    ? `<div class="ig-name-secondary warn">${item.blockReason}</div>`
    : bn && bn.done < item.quantity
      ? `<div class="ig-name-secondary">Узкое место: ${bn.name} ${bn.done} / ${item.quantity}</div>`
      : '';

  // Теги: статус закупки + ответственный + примечание
  const purStatus = item.purchaseStatus || item.materialsStatus;
  const purTag      = purStatus
    ? `<span class="pur-mini pur-mini-${purStatus}">${purMiniLabel(purStatus)}</span>`
    : '';
  const assigneeTag = (()=>{
    if (!item.assignee) return `<span class="assignee-mini assignee-empty" onclick="event.stopPropagation();openAssigneeDrop('${item.id}',this)">${iconSvg('user', 9)} Назначить</span>`;
    const aObj = getAllAssignees().find(a => a.name === item.assignee) || { colorIdx: 0 };
    return `<span class="assignee-mini" style="${assigneeStyle(aObj)}" onclick="event.stopPropagation();openAssigneeDrop('${item.id}',this)">${iconSvg('user', 9)} ${item.assignee}</span>`;
  })();
  const tagsLine    = (purTag || assigneeTag)
    ? `<div class="ig-name-tags">${purTag}${assigneeTag}</div>`
    : '';

  const nameTipHtml = (()=>{
    const nf = item.nameFullOverride !== undefined ? item.nameFullOverride : item.name;
    return item.nameFullEnabled !== false && nf && nf !== item.nameShort
      ? `<span class="name-full-tip" onclick="event.stopPropagation()" data-tip="${nf.replace(/"/g,'&quot;')}"><svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2.5a.75.75 0 110 1.5.75.75 0 010-1.5zM7 7h2v4H7V7z"/></svg></span>`
      : '';
  })();
  const noteTipHtml = item.notes && item.noteTipEnabled !== false
    ? `<span class="note-tip" onclick="event.stopPropagation()" data-tip="${item.notes.replace(/"/g,'&quot;')}">${iconSvg('document', 12)}</span>`
    : '';

  // Дедлайн
  const deadlineClass = od > 0 && status !== ST.DONE ? 'overdue' : '';
  const overdueNote   = od > 0 && status !== ST.DONE
    ? `<span class="ig-overdue-note">+${od} дн.</span>` : '';

  return `
    <div class="ig-row" draggable="true" data-id="${item.id}" onclick="navigate('item','${projectId}','${item.id}')">
      <div class="ig-cell ig-drag" onclick="event.stopPropagation()">${iconSvg('grip', 12)}</div>
      <div class="ig-cell ig-num">
        <span class="ig-num-text">${item.number}</span>
      </div>
      <div class="ig-cell ig-name">
        <div class="ig-name-primary">
          <span class="ig-name-text">${item.nameShort}</span>${nameTipHtml}${noteTipHtml}
        </div>
        ${secondary}${tagsLine}
      </div>
      <div class="ig-cell ig-qty">
        <span class="ig-qty-text">${item.quantity} ${item.unit}</span>
      </div>
      <div class="ig-cell ig-done">
        <span class="ig-done-text ${done === 0 ? 'zero' : ''}">${done} / ${item.quantity}</span>
      </div>
      <div class="ig-cell ig-status">
        ${statusPill(status)}
      </div>
      <div class="ig-cell ig-progress">
        <div class="ig-progress-wrap">
          <div class="ig-progress-pct" style="color:${color}">${pct}%</div>
          <div class="ig-progress-track">
            <div class="ig-progress-fill ${pbarClass(pct)}" style="width:${pct}%"></div>
          </div>
        </div>
      </div>
      <div class="ig-cell ig-deadline">
        <div class="ig-deadline-text ${deadlineClass}">
          ${formatDate(new Date(item.deadline))}${overdueNote}
        </div>
        ${(()=>{
          if (!item.expected_delivery || item.purchaseStatus === PUR.RECEIVED) return '';
          const d = daysOverdue(item.expected_delivery);
          return d > 0
            ? `<div style="font-size:10px;color:#EF4444;font-weight:600;margin-top:2px">Поставка просрочена ${d} дн.</div>`
            : '';
        })()}
      </div>
      <div class="ig-cell ig-shipping" onclick="event.stopPropagation()">
        ${_shippingChip(item)}
      </div>
    </div>`;
}

// =============================================================
// VIEW: ITEM DETAIL
// =============================================================
function renderItem(el, projectId, itemId) {
  const item    = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) { el.innerHTML = '<p>Позиция не найдена</p>'; navigate('projects'); return; }

  const project = VRH_PROJECTS.find(p => p.id === item.projectId);
  const pct     = calcProgress(item);
  const status  = getItemStatus(item);
  const od      = daysOverdue(item.deadline);
  const done    = getItemDone(item);
  const bn      = getBottleneck(item);

  setBreadcrumb(
    { label: 'Проекты', link: 'projects' },
    { label: project?.name, link: `project/${item.projectId}` },
    item.nameShort
  );

  const isV2 = isV2Project(item.projectId);

  // Блок закупки — только для v1 purchased
  const purchaseHtml = (!isV2 && item.type === 'purchased') ? renderPurchaseBlock(item) : '';

  // История (только для v1)
  const historyHtml = isV2 ? '' : (item.history?.length)
    ? renderHistory(item)
    : '';

  el.innerHTML = `
    <button onclick="navigate('project','${item.projectId}')" class="btn-secondary no-print" style="margin-bottom:16px">
      ${iconSvg('list',12)} Назад к проекту
    </button>

    <div class="item-header-card">
      <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            <span class="complex-badge complex-${item.complexId}">${getComplexAbbr(item.complexId)}</span>
            ${item.type === 'purchased'
              ? '<span style="background:var(--gray-100);color:var(--gray-500);font-size:10px;font-weight:700;padding:2px 7px;border-radius:2px;letter-spacing:.06em;text-transform:uppercase">Закупка</span>'
              : '<span style="background:var(--cyan-dim);color:#0284C7;font-size:10px;font-weight:700;padding:2px 7px;border-radius:2px;letter-spacing:.06em;text-transform:uppercase">Производство ВРХ</span>'}
            ${od>0&&status!==ST.DONE ? `<span class="badge badge-overdue">Просрочено ${od} дн.</span>` : ''}
            ${statusBadge(status)}
          </div>
          <div class="item-title">${item.name}</div>
          <div class="item-meta">
            <div class="item-meta-pair"><label>Проект</label><span>${project?.name}</span></div>
            <div class="item-meta-pair"><label>Количество</label><span>${item.quantity} ${item.unit}</span></div>
            <div class="item-meta-pair"><label>Готово</label>
              <span style="font-weight:800;color:${pctColor(pct)}">${done} / ${item.quantity} ${item.unit}</span>
            </div>
            <div class="item-meta-pair"><label>Дедлайн</label>
              <span style="${od>0&&status!==ST.DONE?'color:#EF4444;font-weight:600':''}">${formatDate(new Date(item.deadline))}</span>
            </div>
            ${item.blockReason ? `<div class="item-meta-pair"><label>Блокировка</label><span style="color:#F59E0B">${item.blockReason}</span></div>` : ''}
            ${bn ? `<div class="item-meta-pair"><label>Узкое место</label><span style="color:#F59E0B">${bn.name} (${bn.done}/${item.quantity})</span></div>` : ''}
            ${(()=>{
              const ss = item.shipping_status || '';
              if (!ss) return '';
              const cls = ss === 'shipped' ? 'color:#166534;font-weight:600' : 'color:#92400E;font-weight:600';
              return `<div class="item-meta-pair"><label>Отгрузка</label><span style="${cls}">${SHIP_LABELS[ss]}</span></div>`;
            })()}
            ${item.supplier ? `<div class="item-meta-pair"><label>Поставщик</label><span>${item.supplier}</span></div>` : ''}
            ${(()=>{
              const ps = item.payment_status;
              if (!ps && !item.payment_amount && !item.payment_date) return '';
              const psLabel = ps === 'paid' ? '<span style="color:#166534;font-weight:600">Оплачено</span>'
                            : ps === 'invoiced' ? '<span style="color:#92400E;font-weight:600">Счёт выставлен</span>'
                            : '<span style="color:#6B7280">Не оплачено</span>';
              const amtPart = item.payment_amount ? ` · ${Number(item.payment_amount).toLocaleString('ru-RU')} руб.` : '';
              const datePart = item.payment_date ? ` · ${formatDate(new Date(item.payment_date))}` : '';
              return `<div class="item-meta-pair"><label>Оплата</label><span>${psLabel}${amtPart}${datePart}</span></div>`;
            })()}
            ${(()=>{
              if (!item.expected_delivery) return '';
              const dly = item.purchaseStatus === PUR.RECEIVED ? 0 : daysOverdue(item.expected_delivery);
              const txt = dly > 0
                ? `<span style="color:#EF4444;font-weight:600">${formatDate(new Date(item.expected_delivery))} - Задержка ${dly} дн.</span>`
                : `<span>${formatDate(new Date(item.expected_delivery))}</span>`;
              return `<div class="item-meta-pair"><label>Ожид. поставка</label>${txt}</div>`;
            })()}
          </div>
        </div>
        <div style="text-align:center">
          ${progressCircle(pct, 80)}
        </div>
      </div>

      ${item.notes ? `
        <div style="margin-top:16px;padding:12px 14px;background:var(--gray-50);border-radius:4px;font-size:13px;color:var(--gray-700);border-left:2px solid var(--gray-200);line-height:1.6">
          <span style="font-size:10px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:4px">Примечание</span>
          ${item.notes}
        </div>` : ''}
      <div style="margin-top:16px">
        <button class="btn-secondary" onclick="openUpdateModal('${item.id}')" style="display:inline-flex;align-items:center;gap:6px">
          ${iconSvg('edit',12)} Редактировать
        </button>
      </div>
    </div>

    ${isV2
      ? renderWorkflowDetail(item, project)
      : `
    ${purchaseHtml}
    ${renderComponents(item)}
    ${historyHtml}

    <div class="card" style="padding:20px 24px;margin-top:16px">
      <div style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">
        ${iconSvg('plus',12)} Добавить запись в историю
      </div>
      <textarea id="item-comment-input" class="form-textarea" placeholder="Введите текущий статус, что сделано, что ожидается..."></textarea>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn-primary" style="display:flex;align-items:center;gap:6px" onclick="saveHistoryEntry('${item.id}')">
          ${iconSvg('plus',13)} Добавить запись
        </button>
      </div>
    </div>`}

    ${isV2 ? renderComponents(item) : ''}
    ${renderMaterialsSection(item)}
  `;
}

function renderComponents(item) {
  if (!item.components) item.components = [];
  const rows = item.components.map(c => {
    const qty   = c.quantity;
    const done  = c.done;
    const pct   = qty > 0 ? Math.min(100, Math.round(done / qty * 100)) : 0;
    const color = pctColor(pct);
    const isOpt = c.optional;
    const isBN  = !isOpt && getBottleneck(item)?.id === c.id && done < qty;

    return `
      <tr class="comp-row" onclick="openEditCompModal('${item.id}','${c.id}')" title="Нажмите чтобы редактировать" style="${isOpt ? 'opacity:0.65' : ''}">
        <td style="font-weight:${isBN ? '700' : '500'};color:${isBN ? '#F59E0B' : 'inherit'}">
          ${c.name}${isOpt ? ' <span style="font-size:9px;color:var(--gray-400)">(доп.)</span>' : ''}
          ${isBN ? `<div style="font-size:10px;color:#F59E0B;display:flex;align-items:center;gap:4px;margin-top:2px">${iconSvg('warning',9)} Узкое место</div>` : ''}
        </td>
        <td style="text-align:center;font-weight:700;color:${color}">${done} / ${qty}</td>
        <td style="min-width:100px">
          <div class="items-mini-bar" style="height:6px">
            <div class="items-mini-fill ${pbarClass(pct)}" style="width:${pct}%"></div>
          </div>
        </td>
        <td style="text-align:center;font-size:12px;font-weight:700;color:${color}">${pct}%</td>
        <td style="color:var(--gray-500);font-size:11px">${c.unit || '—'}</td>
        <td style="color:var(--gray-400);font-size:11px;max-width:160px">${c.notes || ''}</td>
        <td style="width:28px;text-align:center">
          <span class="comp-edit-icon">${iconSvg('edit',12)}</span>
        </td>
      </tr>`;
  }).join('');

  const tableOrEmpty = item.components.length
    ? `<div style="overflow-x:auto">
        <table class="items-table comp-table">
          <thead>
            <tr>
              <th>Узел / компонент</th>
              <th style="text-align:center">Готово / Всего</th>
              <th>Прогресс</th>
              <th style="text-align:center">%</th>
              <th>Ед.</th>
              <th>Примечание</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
    : `<div style="padding:16px 0 4px;color:var(--gray-300);font-size:13px">Состав не заполнен — нажмите «Добавить» чтобы добавить позицию</div>`;

  return `
    <div class="card" style="padding:20px 24px;margin-top:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <span style="font-size:10px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.08em">
          ${iconSvg('list',12)} Состав изделия по КД
        </span>
        <button class="btn-secondary" style="display:inline-flex;align-items:center;gap:5px;font-size:12px" onclick="openAddCompModal('${item.id}')">
          ${iconSvg('plus',11)} Добавить подпозицию
        </button>
      </div>
      ${tableOrEmpty}
    </div>`;
}

function renderPurchaseBlock(item) {
  const statusLabels = {
    [PUR.PENDING]:  { label: 'Не заказано',  color: '#A8A8A8' },
    [PUR.ORDERED]:  { label: 'Заказано / счёт выставлен', color: '#0EA5E9' },
    [PUR.PARTIAL]:  { label: 'Получено частично', color: '#F59E0B' },
    [PUR.RECEIVED]: { label: 'Получено полностью', color: '#10B981' },
  };
  const cur = statusLabels[item.purchaseStatus] || statusLabels[PUR.PENDING];

  return `
    <div class="card" style="padding:20px 24px;margin-top:16px">
      <div style="font-size:10px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">
        ${iconSvg('cart',12)} Статус закупки
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span style="font-size:14px;font-weight:700;color:${cur.color}">${cur.label}</span>
      </div>
      ${item.notes ? `<div style="margin-top:12px;font-size:13px;color:var(--gray-600)">${item.notes}</div>` : ''}
    </div>`;
}

function renderHistory(item) {
  const sorted = [...item.history].sort((a,b) => b.date.localeCompare(a.date));
  return `
    <div class="card" style="padding:20px 24px;margin-top:16px">
      <div style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">
        ${iconSvg('clock',12)} История · ${sorted.length} записей
      </div>
      <div style="display:grid;gap:0">
        ${sorted.map((h, i) => `
          <div id="hist-row-${i}" style="display:flex;gap:14px;padding:10px 0;${i<sorted.length-1?'border-bottom:1px solid var(--gray-100)':''}">
            <div style="flex-shrink:0;font-size:11px;color:var(--gray-400);font-weight:600;width:80px;padding-top:2px">
              ${formatDateShort(h.date)}
            </div>
            <div class="hist-text" style="font-size:13px;color:var(--gray-700);line-height:1.55;flex:1">${h.text}</div>
            <button onclick="editHistoryEntry('${item.id}',${i})" style="flex-shrink:0;background:none;border:none;cursor:pointer;color:var(--gray-300);padding:2px 4px;border-radius:4px;line-height:1;align-self:flex-start;margin-top:2px" title="Редактировать запись">
              ${iconSvg('edit',11)}
            </button>
          </div>`).join('')}
      </div>
    </div>`;
}

// =============================================================
// VIEW: PROBLEMS
// =============================================================
// =============================================================
// СТАТУС ОТГРУЗКИ
// =============================================================
const SHIP_STATES = ['', 'packed', 'shipped'];
const SHIP_LABELS = { '': '—', packed: 'Упаковано', shipped: 'Отгружено' };
const SHIP_ICONS  = { '': 'minus', packed: 'clipboard', shipped: 'check' };

function _shippingChip(item) {
  const s = item.shipping_status || '';
  const cls = s === 'shipped' ? 'ship-chip-shipped' : s === 'packed' ? 'ship-chip-packed' : 'ship-chip-none';
  return `<span class="ship-chip ${cls}" onclick="cycleShipping('${item.id}',event)" title="Нажмите для смены статуса">
    ${iconSvg(SHIP_ICONS[s], 10)} ${SHIP_LABELS[s]}
  </span>`;
}

function cycleShipping(itemId, e) {
  if (e) e.stopPropagation();
  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  const cur = item.shipping_status || '';
  const next = SHIP_STATES[(SHIP_STATES.indexOf(cur) + 1) % SHIP_STATES.length];
  item.shipping_status = next;
  if (!localEdits[itemId]) localEdits[itemId] = {};
  localEdits[itemId].shipping_status = next;
  saveEditsToStorage(itemId);
  render();
}
window.cycleShipping = cycleShipping;

// =============================================================
// ОТЧЁТ ЗАКУПОК
// =============================================================
function renderReport(el, projectId) {
  const project = VRH_PROJECTS.find(p => p.id === projectId);
  if (!project) { navigate('projects'); return; }

  const items   = getProjectItems(projectId);
  const dateStr = formatDate(new Date());

  // Раздел 1: позиции типа «Закупка» (не полностью получены)
  const purchased = items.filter(i => i.type === 'purchased' && i.purchaseStatus !== PUR.RECEIVED);
  const pPending  = purchased.filter(i => !i.purchaseStatus || i.purchaseStatus === PUR.PENDING);
  const pOrdered  = purchased.filter(i => i.purchaseStatus === PUR.ORDERED);
  const pPartial  = purchased.filter(i => i.purchaseStatus === PUR.PARTIAL);

  // Раздел 2: компоненты позиций «Производство» где done < quantity
  const materialRows = [];
  items.filter(i => i.type === 'own' && i.components?.length).forEach(i => {
    i.components.filter(c => (c.done || 0) < c.quantity).forEach(c => {
      materialRows.push({ parentName: i.nameShort || i.name, component: c, item: i });
    });
  });

  // Группировка по комплексу
  function groupByComplex(rows) {
    const map = {};
    rows.forEach(i => {
      const k = i.complexId || 'other';
      if (!map[k]) map[k] = [];
      map[k].push(i);
    });
    return map;
  }

  function purchaseTable(rows, emptyText) {
    if (!rows.length) return `<div class="pr-empty">${emptyText}</div>`;
    const groups = groupByComplex(rows);
    const complexKeys = Object.keys(groups);
    const multiGroup  = complexKeys.length > 1;

    return complexKeys.map(cid => {
      const cRows = groups[cid];
      const cName = multiGroup ? (getComplexName ? getComplexName(cid) : cid) : null;
      return `
        ${cName ? `<div class="pr-complex-label complex-${cid}">${cName}</div>` : ''}
        <table class="pr-table" style="${multiGroup ? 'margin-bottom:10px' : ''}">
          <thead><tr>
            <th>Наименование</th><th>Кол-во</th><th>Ед.</th><th>Поставщик</th><th>Оплата</th><th>Ожид. поставка</th><th>Примечание</th>
          </tr></thead>
          <tbody>
            ${cRows.map(i => {
              const payLabel = i.payment_status === 'paid' ? '<span style="color:#166534;font-weight:600">Оплачено</span>'
                             : i.payment_status === 'invoiced' ? '<span style="color:#92400E">Счёт выставлен</span>'
                             : '—';
              const expDel   = i.expected_delivery || '';
              const delayD   = (expDel && i.purchaseStatus !== PUR.RECEIVED) ? daysOverdue(expDel) : 0;
              const expDelTxt = expDel
                ? (delayD > 0
                    ? `<span style="color:#EF4444;font-weight:600">${formatDateShort(expDel)} +${delayD}дн.</span>`
                    : formatDateShort(expDel))
                : '—';
              return `<tr>
                <td>${i.name}</td>
                <td style="font-weight:700">${i.quantity} ${i.unit}</td>
                <td>${i.unit}</td>
                <td>${i.supplier || '—'}</td>
                <td>${payLabel}${i.payment_amount ? `<br><span style="font-size:11px;color:var(--gray-500)">${Number(i.payment_amount).toLocaleString('ru-RU')} руб.</span>` : ''}</td>
                <td>${expDelTxt}</td>
                <td style="color:var(--gray-500)">${i.notes || ''}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;
    }).join('');
  }

  function materialsTable(rows) {
    if (!rows.length) return `<div class="pr-empty">Все материалы в наличии</div>`;
    return `
      <table class="pr-table">
        <thead><tr>
          <th>Изделие</th><th>Материал / компонент</th><th>Требуется</th><th>Есть</th><th>Докупить</th><th>Ед.</th>
        </tr></thead>
        <tbody>
          ${rows.map(({ parentName, component: c }) => `<tr>
            <td style="color:var(--gray-500)">${parentName}</td>
            <td style="font-weight:600">${c.name}</td>
            <td>${c.quantity}</td>
            <td>${c.done || 0}</td>
            <td style="font-weight:700;color:#EF4444">${c.quantity - (c.done || 0)}</td>
            <td>${c.unit || 'шт.'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  setBreadcrumb(
    { label: 'Проекты', link: 'projects' },
    { label: project.name, link: `project/${projectId}` },
    'Отчёт закупок'
  );

  el.innerHTML = `
    <div class="pr-wrap">
      <div class="pr-topbar no-print">
        <button class="btn-secondary" onclick="navigate('project','${projectId}')" style="display:inline-flex;align-items:center;gap:6px">
          ${iconSvg('list', 12)} Назад к проекту
        </button>
        <div style="display:flex;gap:8px">
          <button class="btn-secondary" onclick="exportReportCSV('${projectId}')" style="display:inline-flex;align-items:center;gap:6px">
            ${iconSvg('save', 12)} Скачать CSV
          </button>
          <button class="btn-primary" onclick="window.print()" style="display:inline-flex;align-items:center;gap:6px">
            ${iconSvg('document', 12)} Печать / PDF
          </button>
        </div>
      </div>

      <div class="pr-header">
        <div class="pr-header-title">Отчёт по закупкам</div>
        <div class="pr-header-meta">
          <span>${project.name}</span>
          <span>·</span>
          <span>Дедлайн проекта: ${formatDate(new Date(project.deadline))}</span>
          <span>·</span>
          <span>Сформировано: ${dateStr}</span>
        </div>
        <div class="pr-summary">
          <div class="pr-summary-chip pr-chip-red">${iconSvg('cart', 11)} Не заказано: ${pPending.length}</div>
          <div class="pr-summary-chip pr-chip-amber">${iconSvg('clock', 11)} Ожидаем: ${pOrdered.length}</div>
          <div class="pr-summary-chip pr-chip-blue">${iconSvg('minus', 11)} Частично: ${pPartial.length}</div>
          <div class="pr-summary-chip pr-chip-gray">${iconSvg('list', 11)} Материалов: ${materialRows.length}</div>
        </div>
      </div>

      <div class="pr-section">
        <div class="pr-section-title pr-title-red">${iconSvg('warning', 13)} Не заказано - требует немедленного действия</div>
        ${purchaseTable(pPending, 'Все позиции заказаны')}
      </div>

      <div class="pr-section">
        <div class="pr-section-title pr-title-amber">${iconSvg('clock', 13)} Заказано, ожидаем поставки</div>
        ${purchaseTable(pOrdered, 'Нет позиций в ожидании')}
      </div>

      <div class="pr-section">
        <div class="pr-section-title pr-title-blue">${iconSvg('minus', 13)} Частично получено - докупить остаток</div>
        ${purchaseTable(pPartial, 'Нет частично полученных позиций')}
      </div>

      <div class="pr-section">
        <div class="pr-section-title pr-title-gray">${iconSvg('clipboard', 13)} Материалы для производства</div>
        ${materialsTable(materialRows)}
      </div>
    </div>`;
}

function exportReportCSV(projectId) {
  const project = VRH_PROJECTS.find(p => p.id === projectId);
  if (!project) return;
  const items = getProjectItems(projectId);

  const rows = [['Тип','Раздел','Комплекс','Наименование','Родительская позиция','Кол-во','Ед.изм.','Поставщик','Статус оплаты','Сумма (руб.)','Дата оплаты','Ожид. поставка','Примечание']];

  // Закупки
  const statusLabel = { [PUR.PENDING]:'Не заказано', [PUR.ORDERED]:'Заказано', [PUR.PARTIAL]:'Частично' };
  const payLabel    = { '':'Не оплачено', 'invoiced':'Счёт выставлен', 'paid':'Оплачено' };
  items.filter(i => i.type === 'purchased' && i.purchaseStatus !== PUR.RECEIVED).forEach(i => {
    const st = statusLabel[i.purchaseStatus] || 'Не заказано';
    rows.push(['Закупка', st, i.complexId || '', i.name, '', i.quantity, i.unit,
      i.supplier || '', payLabel[i.payment_status || ''] || '',
      i.payment_amount || '', i.payment_date || '', i.expected_delivery || '', i.notes || '']);
  });

  // Материалы
  items.filter(i => i.type === 'own' && i.components?.length).forEach(i => {
    i.components.filter(c => (c.done || 0) < c.quantity).forEach(c => {
      const need = c.quantity - (c.done || 0);
      rows.push(['Материал', 'Производство', i.complexId || '', c.name, i.nameShort || i.name,
        c.quantity, c.unit || 'шт.', '', '', '', '', '', '']);
    });
  });

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
  const bom  = '﻿';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `zakupki_${project.id}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('CSV скачан');
}
window.exportReportCSV = exportReportCSV;

function renderProblems(el) {
  const allProbs = getAllProblems();
  const total = allProbs.overdue.length + allProbs.noKd.length +
                allProbs.blocked.length + allProbs.needPurchase.length;

  el.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Панель проблем</div>
        <div class="section-sub">Автоматически выявленные проблемы · ${formatDate(TODAY)}</div>
      </div>
    </div>

    ${total === 0 ? `
      <div style="text-align:center;padding:80px 20px">
        <div style="width:56px;height:56px;border-radius:50%;background:rgba(0,179,126,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#10B981">${iconSvg('check',28)}</div>
        <div style="font-size:16px;font-weight:800;color:#10B981;letter-spacing:-0.3px">Критических проблем нет</div>
        <div style="font-size:13px;color:var(--gray-400);margin-top:6px">Все позиции в штатном режиме</div>
      </div>` : ''}

    ${allProbs.overdue.length ? problemSection(
      'Просрочено', 'red', 'alert',
      allProbs.overdue
        .sort((a,b) => daysOverdue(b.deadline) - daysOverdue(a.deadline))
        .map(item => ({
          iconType: 'alert', name: item.nameShort,
          meta: `${getComplexName(item.complexId)} · Просрочено ${daysOverdue(item.deadline)} дн.`,
          badge: `<span class="badge badge-overdue">${daysOverdue(item.deadline)} дн.</span>`,
          itemId: item.id, projectId: item.projectId,
        }))
    ) : ''}

    ${allProbs.noKd.length ? problemSection(
      'Нет КД', 'amber', 'document',
      allProbs.noKd.map(item => ({
        iconType: 'document', name: item.nameShort,
        meta: `${getComplexName(item.complexId)} · КД не готово`,
        badge: `<span class="badge badge-blocked">Нет КД</span>`,
        itemId: item.id, projectId: item.projectId,
      }))
    ) : ''}

    ${allProbs.blocked.length ? problemSection(
      'Заблокировано', 'amber', 'pause',
      allProbs.blocked
        .filter(i => !allProbs.noKd.find(x => x.id === i.id))
        .map(item => ({
          iconType: 'pause', name: item.nameShort,
          meta: `${getComplexName(item.complexId)} · ${item.blockReason || 'Блокировка'}`,
          badge: `<span class="badge badge-blocked">Блок</span>`,
          itemId: item.id, projectId: item.projectId,
        }))
    ) : ''}

    ${allProbs.needPurchase.length ? problemSection(
      'Не заказано', 'violet', 'cart',
      allProbs.needPurchase.map(item => ({
        iconType: 'cart', name: item.nameShort,
        meta: `${getComplexName(item.complexId)} · ${item.type === 'purchased' ? 'Закупка не инициирована' : 'Материалы не куплены'}`,
        badge: '',
        itemId: item.id, projectId: item.projectId,
      }))
    ) : ''}
  `;
}

function problemSection(title, colorClass, headerIcon, itemList) {
  if (!itemList.length) return '';
  return `
    <div class="problem-section">
      <div class="problem-section-header ${colorClass}">
        ${iconSvg(headerIcon, 14)}
        <span>${title}</span>
        <span class="count">${itemList.length}</span>
      </div>
      <div class="problem-items ${colorClass}">
        ${itemList.map(p => `
          <div class="problem-item" onclick="navigate('item','${p.projectId}','${p.itemId}')">
            <div class="problem-item-icon ${colorClass}">${iconSvg(p.iconType, 13)}</div>
            <div style="flex:1">
              <div class="problem-item-name">${p.name}</div>
              <div class="problem-item-meta">${p.meta}</div>
            </div>
            <div>${p.badge}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

// =============================================================
// VIEW: AI ASSISTANT
// =============================================================
function renderAI(el) {
  const recs  = generateAIRecommendations();
  const tasks = generateWeeklyTasks();
  const stats = getCompanyStats();
  const pct   = stats.total > 0 ? Math.round(stats.done / stats.total * 100) : 0;

  el.innerHTML = `
    <div class="ai-header">
      <div class="ai-icon">${iconSvg('ai', 20)}</div>
      <div>
        <div class="ai-title">AI-анализ производства</div>
        <div class="ai-sub">Данные из График_работ.xlsx · ${formatDate(TODAY)}</div>
      </div>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:8px;background:var(--cyan-dim);border:1px solid rgba(0,200,255,0.2);border-radius:4px;padding:9px 14px;font-size:12px;font-weight:700;color:#0284C7">
        ${iconSvg('chart',13)} Изготовлено: ${pct}%
      </div>
      <div style="display:flex;align-items:center;gap:8px;background:${stats.overdue>0?'rgba(227,6,19,0.06)':'rgba(0,179,126,0.07)'};color:${stats.overdue>0?'#EF4444':'#10B981'};border:1px solid ${stats.overdue>0?'rgba(227,6,19,0.2)':'rgba(0,179,126,0.2)'};border-radius:4px;padding:9px 14px;font-size:12px;font-weight:700">
        ${iconSvg(stats.overdue>0?'warning':'check',13)} Просрочено: ${stats.overdue}
      </div>
      <div style="display:flex;align-items:center;gap:8px;background:rgba(0,179,126,0.07);border:1px solid rgba(0,179,126,0.2);border-radius:4px;padding:9px 14px;font-size:12px;font-weight:700;color:#10B981">
        ${iconSvg('check',13)} Готово: ${stats.done} из ${stats.total}
      </div>
      <div style="display:flex;align-items:center;gap:8px;background:rgba(255,107,0,0.07);border:1px solid rgba(255,107,0,0.2);border-radius:4px;padding:9px 14px;font-size:12px;font-weight:700;color:#F59E0B">
        ${iconSvg('pause',13)} Блок: ${stats.blocked}
      </div>
    </div>

    <div style="font-size:12px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px">Рекомендации и предупреждения</div>
    ${recs.length === 0 ? `
      <div style="display:flex;align-items:center;gap:12px;padding:20px 24px;background:rgba(0,179,126,0.07);border:1px solid rgba(0,179,126,0.2);border-radius:4px;color:#10B981;font-weight:700;font-size:13px">
        ${iconSvg('check',18)} Нет критических проблем. Производство идёт в штатном режиме.
      </div>` : recs.map(r => aiCard(r)).join('')}

    ${tasks.length ? `
      <div style="font-size:12px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:0.1em;margin:24px 0 12px;display:flex;align-items:center;gap:8px">${iconSvg('clipboard',14)} Задачи на ближайшую неделю</div>
      <div class="items-card">
        ${tasks.map((t,i) => `
          <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-bottom:${i<tasks.length-1?'1px solid var(--gray-100)':'none'};cursor:pointer"
               onclick="${t.itemId ? `navigate('item','${VRH_ITEMS.find(ii=>ii.id===t.itemId)?.projectId}','${t.itemId}')` : ''}">
            <div style="width:22px;height:22px;border-radius:2px;background:${t.overdue?'rgba(227,6,19,0.08)':'var(--gray-100)'};color:${t.overdue?'#EF4444':'var(--gray-500)'};font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:500;color:${t.overdue?'#EF4444':'var(--black)'}">${t.text}</div>
              <div style="font-size:11px;color:var(--gray-400);margin-top:2px">${t.detail}</div>
            </div>
            ${t.overdue ? '<span class="badge badge-overdue" style="flex-shrink:0">Просрочено</span>' : ''}
          </div>`).join('')}
      </div>` : ''}
  `;
}

function aiCard(rec) {
  const itemsHtml = rec.items?.length ? `
    <div class="ai-card-items">
      ${rec.items.slice(0, 6).map(it => `
        <div class="ai-card-item" onclick="${it.itemId ? `navigate('item','${VRH_ITEMS.find(i=>i.id===it.itemId)?.projectId}','${it.itemId}')` : ''}" style="${it.itemId?'cursor:pointer':''}">
          <strong>${it.name}</strong>${it.detail ? ` - ${it.detail}` : ''}
        </div>`).join('')}
      ${rec.items.length > 6 ? `<div class="ai-card-item" style="color:var(--gray-400)">...и ещё ${rec.items.length-6} позиций</div>` : ''}
    </div>` : '';

  const iconMap = { danger: 'alert', warning: 'warning', info: 'chart', success: 'check' };

  return `
    <div class="ai-card ${rec.type}">
      <div class="ai-card-icon">${iconSvg(iconMap[rec.type] || 'warning', 15)}</div>
      <div style="flex:1">
        <div class="ai-card-title">${rec.title}</div>
        <div class="ai-card-text">${rec.text}</div>
        ${itemsHtml}
      </div>
    </div>`;
}

// =============================================================
// MODAL: Edit Item - redesigned card UI
// =============================================================
function _mnStatusLabel(st) {
  return { done:'Готово', in_progress:'В работе', pending:'Ожидает', blocked:'Заблокировано', overdue:'Просрочено' }[st] || st;
}
function _mnDeadlineInfo(deadline) {
  const d = new Date(deadline); d.setHours(0,0,0,0);
  const now = new Date(); now.setHours(0,0,0,0);
  const diff = Math.round((d - now) / 86400000);
  if (diff < 0)  return { cls:'danger', text:`Просрочено на ${Math.abs(diff)} дн.` };
  if (diff === 0) return { cls:'warn',   text:'Срок истекает сегодня' };
  if (diff <= 7)  return { cls:'warn',   text:`Осталось ${diff} дн.` };
  return { cls:'good', text:`Осталось ${diff} дн.` };
}
function _mnFormatDate(s) {
  const d = new Date(s);
  return d.toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
}

function openUpdateModal(itemId) {
  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  const pct     = calcProgress(item);
  const status  = getItemStatus(item);
  const done    = getItemDone(item);
  const R = 38, circ = 2 * Math.PI * R;
  const offset  = circ * (1 - pct / 100);
  const dl      = _mnDeadlineInfo(item.deadline);
  const curPur  = item.purchaseStatus || item.materialsStatus || '';
  const nameFull   = item.nameFullOverride !== undefined ? item.nameFullOverride : item.name;
  const nameFullOn = item.nameFullEnabled !== false;

  // ── Assignee badge ──
  const assigneeHtml = item.assignee
    ? `<span class="mn-hero-pill">${iconSvg('user',11)} ${item.assignee}</span>`
    : '';

  // ── Progress section (own) ──
  const progSection = item.type === 'own' ? `
    <div class="mn-sec">
      <div class="mn-sec-title">Производство</div>
      <div class="mn-stat-row">
        <div class="mn-stat-box">
          <span class="mn-stat-label">Требуется (${item.unit})</span>
          <input class="mn-stat-input" type="number" id="modal-quantity" min="1"
            value="${item.quantity}" oninput="updateModalProgress()">
        </div>
        <div class="mn-stat-box">
          <span class="mn-stat-label">Готово</span>
          <input class="mn-stat-input" type="number" id="modal-done-count" min="0"
            max="${item.quantity}" value="${done}" oninput="updateModalProgress()">
        </div>
        <div class="mn-stat-box">
          <span class="mn-stat-label">Осталось</span>
          <span class="mn-stat-val" id="mn-remaining">${Math.max(0, item.quantity - done)}</span>
        </div>
        <div class="mn-stat-bar-wrap">
          <div class="mn-bar-row">
            <div class="mn-bar-track"><div class="mn-bar-fill" id="mn-bar-fill" style="width:${pct}%"></div></div>
            <span class="mn-bar-pct" id="mn-bar-pct">${pct}%</span>
          </div>
        </div>
      </div>
      ${item.components?.length ? `
        <div style="margin-top:16px">
          <div class="mn-stat-label" style="margin-bottom:10px">Компоненты</div>
          <div class="mn-comp-grid">
            ${item.components.map(c => `
              <div class="mn-comp-item">
                <div class="mn-comp-label">${c.name} (из ${c.quantity})</div>
                <input class="mn-comp-input" type="number" id="comp-${c.id}" min="0" max="${c.quantity}" value="${c.done}">
              </div>`).join('')}
          </div>
        </div>` : ''}
    </div>` : `<input type="hidden" id="modal-quantity" value="${item.quantity}">
               <input type="hidden" id="modal-done-count" value="${done}">`;

  // ── Purchase chips ──
  const purChips = [
    { val: PUR.PENDING,  label:'Не заказано',        dot:'#D1D5DB', active:'background:#F3F4F6;color:#374151;border-color:#D1D5DB' },
    { val: PUR.ORDERED,  label:'Заказано',            dot:'#60A5FA', active:'background:#DBEAFE;color:#1D4ED8;border-color:#93C5FD' },
    { val: PUR.PARTIAL,  label:'Частично получено',   dot:'#FCD34D', active:'background:#FEF3C7;color:#92400E;border-color:#FDE68A' },
    { val: PUR.RECEIVED, label:'Получено полностью',  dot:'#34D399', active:'background:#DCFCE7;color:#166534;border-color:#6EE7B7' },
  ];
  const purSection = `
    <div class="mn-sec">
      <div class="mn-sec-title">Статус закупки / материалов</div>
      <div class="mn-chips" id="mn-chips-pur">
        ${purChips.map(c => {
          const isActive = curPur === c.val;
          return `<button type="button" class="mn-chip${isActive ? ' mn-chip-active' : ''}"
            data-val="${c.val}" data-active="${c.active}"
            style="${isActive ? c.active : ''}"
            onclick="mnSelectChip('modal-pur-status','mn-chips-pur',this)">
            <span class="mn-chip-dot" style="background:${c.dot}"></span>${c.label}
          </button>`;
        }).join('')}
      </div>
      <input type="hidden" id="modal-pur-status" value="${curPur}">
    </div>`;

  // ── Deadline ──
  const dlSection = `
    <div class="mn-sec">
      <div class="mn-sec-title">Дедлайн проекта</div>
      <div class="mn-deadline-row">
        <input type="date" class="mn-date-input" id="modal-deadline"
          value="${item.deadline}" oninput="mnUpdateDeadline(this.value)">
        <span class="mn-deadline-info ${dl.cls}" id="mn-deadline-info">${dl.text}</span>
      </div>
    </div>`;

  // ── Expected delivery ──
  const expDel      = item.expected_delivery || '';
  const expDelDelay = expDel ? daysOverdue(expDel) : 0;
  const expDelSection = `
    <div class="mn-sec">
      <div class="mn-sec-title">Ожидаемая дата поставки</div>
      <div class="mn-deadline-row">
        <input type="date" class="mn-date-input" id="modal-expected-delivery" value="${expDel}">
        ${expDelDelay > 0
          ? `<span class="mn-deadline-info mn-deadline-over">Задержка ${expDelDelay} дн.</span>`
          : expDel ? `<span class="mn-deadline-info mn-deadline-ok">Ожидается</span>` : ''}
      </div>
    </div>`;

  // ── Payment ──
  const payStatus = item.payment_status || '';
  const payChips  = [
    { val: '',          label:'Не оплачено',    dot:'#D1D5DB', active:'background:#F3F4F6;color:#374151;border-color:#D1D5DB' },
    { val: 'invoiced',  label:'Счёт выставлен', dot:'#FCD34D', active:'background:#FEF3C7;color:#92400E;border-color:#FDE68A' },
    { val: 'paid',      label:'Оплачено',       dot:'#34D399', active:'background:#DCFCE7;color:#166534;border-color:#6EE7B7' },
  ];
  const paySection = `
    <div class="mn-sec">
      <div class="mn-sec-title">Оплата</div>
      <div class="mn-chips" id="mn-chips-pay">
        ${payChips.map(c => {
          const isActive = payStatus === c.val;
          return `<button type="button" class="mn-chip${isActive ? ' mn-chip-active' : ''}"
            data-val="${c.val}" data-active="${c.active}"
            style="${isActive ? c.active : ''}"
            onclick="mnSelectChip('modal-pay-status','mn-chips-pay',this)">
            <span class="mn-chip-dot" style="background:${c.dot}"></span>${c.label}
          </button>`;
        }).join('')}
      </div>
      <input type="hidden" id="modal-pay-status" value="${payStatus}">
      <div class="mn-pay-row">
        <div class="mn-pay-field">
          <div class="mn-stat-label" style="margin-bottom:4px">Поставщик</div>
          <input class="mn-text-input" type="text" id="modal-supplier"
            value="${(item.supplier || '').replace(/"/g,'&quot;')}" placeholder="Название поставщика">
        </div>
        <div class="mn-pay-field">
          <div class="mn-stat-label" style="margin-bottom:4px">Сумма (руб.)</div>
          <input class="mn-text-input" type="number" id="modal-pay-amount" min="0"
            value="${item.payment_amount || ''}">
        </div>
        <div class="mn-pay-field">
          <div class="mn-stat-label" style="margin-bottom:4px">Дата оплаты</div>
          <input class="mn-date-input" type="date" id="modal-pay-date"
            value="${item.payment_date || ''}">
        </div>
      </div>
    </div>`;

  // ── Shipping status ──
  const curShip = item.shipping_status || '';
  const shipChips = [
    { val: '',         label:'—',          dot:'#D1D5DB', active:'background:#F3F4F6;color:#374151;border-color:#D1D5DB' },
    { val: 'packed',   label:'Упаковано',  dot:'#FCD34D', active:'background:#FEF3C7;color:#92400E;border-color:#FDE68A' },
    { val: 'shipped',  label:'Отгружено',  dot:'#34D399', active:'background:#DCFCE7;color:#166534;border-color:#6EE7B7' },
  ];
  const shippingSection = `
    <div class="mn-sec">
      <div class="mn-sec-title">Отгрузка</div>
      <div class="mn-chips" id="mn-chips-ship">
        ${shipChips.map(c => {
          const isActive = curShip === c.val;
          return `<button type="button" class="mn-chip${isActive ? ' mn-chip-active' : ''}"
            data-val="${c.val}" data-active="${c.active}"
            style="${isActive ? c.active : ''}"
            onclick="mnSelectChip('modal-ship-status','mn-chips-ship',this)">
            <span class="mn-chip-dot" style="background:${c.dot}"></span>${c.label}
          </button>`;
        }).join('')}
      </div>
      <input type="hidden" id="modal-ship-status" value="${curShip}">
    </div>`;

  // ── Block reason ──
  const hasBlock = !!item.blockReason;
  const blockSection = `
    <div class="mn-sec">
      <div class="mn-sec-title">Блокировка</div>
      <button class="mn-block-add" id="mn-block-add" onclick="mnShowBlock()"
        style="${hasBlock ? 'display:none' : ''}">
        ${iconSvg('plus',12)} Добавить причину блокировки
      </button>
      <div class="mn-block-card${hasBlock ? ' active-danger' : ''}" id="mn-block-card"
        style="${hasBlock ? '' : 'display:none'}">
        <div class="mn-block-icon">${iconSvg('x', 13)}</div>
        <div class="mn-block-content">
          <div class="mn-block-title">Производство остановлено</div>
          <input class="mn-block-input" type="text" id="modal-block-reason"
            value="${(item.blockReason || '').replace(/"/g,'&quot;')}"
            placeholder="Причина блокировки...">
        </div>
        <button class="mn-block-clear" onclick="mnClearBlock()" title="Снять блокировку">
          ${iconSvg('x', 12)}
        </button>
      </div>
    </div>`;

  // ── Notes ──
  const notesSection = `
    <div class="mn-sec">
      <div class="mn-sec-title" style="display:flex;align-items:center;justify-content:space-between">
        <span>Примечание</span>
        <label class="mn-toggle" style="margin-bottom:0">
          <input type="checkbox" id="modal-note-tip-enabled" ${item.noteTipEnabled !== false ? 'checked' : ''}>
          <span class="mn-toggle-track"><span class="mn-toggle-thumb"></span></span>
          <span class="mn-toggle-label">Показывать иконку</span>
        </label>
      </div>
      <textarea class="mn-notes-textarea" id="modal-notes"
        placeholder="Добавьте примечание..."
        oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"
        >${item.notes || ''}</textarea>
    </div>`;

  // ── Name ──
  const nameSection = `
    <div class="mn-sec">
      <div class="mn-sec-title">Наименование</div>
      <div class="mn-stat-label" style="margin-bottom:6px">Короткое (в таблице)</div>
      <input class="mn-name-short" type="text" id="modal-name-short"
        value="${item.nameShort.replace(/"/g,'&quot;')}">
      <div class="mn-name-full-wrap">
        <label class="mn-toggle">
          <input type="checkbox" id="modal-name-full-enabled" ${nameFullOn ? 'checked' : ''}>
          <span class="mn-toggle-track"><span class="mn-toggle-thumb"></span></span>
          <span class="mn-toggle-label">Показывать подсказку с полным наименованием</span>
        </label>
        <textarea class="mn-name-full-textarea" id="modal-name-full-text"
          placeholder="Полное наименование..."
          oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"
          >${nameFull.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
      </div>
    </div>`;

  document.getElementById('modal-box').innerHTML = `
    <button class="mn-close-btn" onclick="closeModal()">${iconSvg('x',13)}</button>

    <div class="mn-hero">
      <div class="mn-hero-info">
        <div class="mn-hero-name">${item.nameShort}</div>
        <div class="mn-hero-meta">
          <span class="mn-hero-badge mn-badge-${status}">${_mnStatusLabel(status)}</span>
          ${assigneeHtml}
          <span class="mn-hero-pill ${dl.cls}">${iconSvg('calendar',11)} ${_mnFormatDate(item.deadline)}</span>
          <span class="mn-hero-pill ${dl.cls}">${dl.text}</span>
        </div>
      </div>
      <div class="mn-ring-wrap">
        <div class="mn-ring-inner">
          <svg class="mn-ring-svg" viewBox="0 0 100 100">
            <circle class="mn-ring-bg" cx="50" cy="50" r="${R}"/>
            <circle class="mn-ring-fg" id="mn-ring-fg" cx="50" cy="50" r="${R}"
              style="stroke-dashoffset:${offset.toFixed(2)}"/>
          </svg>
          <div class="mn-ring-text">
            <span class="mn-ring-pct" id="mn-ring-pct">${pct}%</span>
          </div>
        </div>
        <span class="mn-ring-sub" id="mn-ring-qty">${done} из ${item.quantity} ${item.unit}</span>
      </div>
    </div>

    <div class="mn-body" data-unit="${item.unit}">
      <div class="mn-col mn-col-left">
        ${progSection}
        ${purSection}
        ${paySection}
        ${shippingSection}
        ${blockSection}
      </div>
      <div class="mn-col mn-col-right">
        ${dlSection}
        ${expDelSection}
        ${notesSection}
        ${nameSection}
      </div>
    </div>

    <div class="mn-footer">
      <button class="mn-btn-danger" onclick="deleteItem('${item.id}')">
        ${iconSvg('trash',13)} Удалить позицию
      </button>
      <button class="mn-btn-save" onclick="saveItemUpdate('${item.id}')">
        ${iconSvg('save',14)} Сохранить изменения
      </button>
    </div>`;

  document.getElementById('modal-overlay').classList.add('open');

  // Auto-resize textareas
  ['modal-notes','modal-name-full-text'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  });
}
window.openUpdateModal = openUpdateModal;

function updateModalProgress() {
  const qty  = Math.max(1, parseInt(document.getElementById('modal-quantity')?.value, 10) || 1);
  const done = Math.min(qty, Math.max(0, parseInt(document.getElementById('modal-done-count')?.value, 10) || 0));
  const pct  = Math.min(100, Math.round(done / qty * 100));
  const unit = document.querySelector('.mn-body')?.dataset?.unit || '';
  const R = 38, circ = 2 * Math.PI * R;
  const el = (id) => document.getElementById(id);
  if (el('mn-remaining'))       el('mn-remaining').textContent   = Math.max(0, qty - done);
  if (el('mn-bar-fill'))        el('mn-bar-fill').style.width    = pct + '%';
  if (el('mn-bar-pct'))         el('mn-bar-pct').textContent     = pct + '%';
  if (el('mn-ring-fg'))         el('mn-ring-fg').style.strokeDashoffset = (circ*(1-pct/100)).toFixed(2);
  if (el('mn-ring-pct'))        el('mn-ring-pct').textContent    = pct + '%';
  if (el('mn-ring-qty'))        el('mn-ring-qty').textContent    = done + ' из ' + qty + ' ' + unit;
}
window.updateModalProgress = updateModalProgress;

function mnSelectChip(inputId, groupId, btn) {
  const val = btn.dataset.val;
  document.getElementById(inputId).value = val;
  document.getElementById(groupId).querySelectorAll('.mn-chip').forEach(c => {
    const active = c.dataset.val === val;
    c.classList.toggle('mn-chip-active', active);
    c.style.cssText = active ? (c.dataset.active || '') : '';
  });
}
window.mnSelectChip = mnSelectChip;

function mnUpdateDeadline(val) {
  if (!val) return;
  const info = _mnDeadlineInfo(val);
  const el = document.getElementById('mn-deadline-info');
  if (!el) return;
  el.textContent = info.text;
  el.className = 'mn-deadline-info ' + info.cls;
}
window.mnUpdateDeadline = mnUpdateDeadline;

function mnShowBlock() {
  document.getElementById('mn-block-add').style.display  = 'none';
  document.getElementById('mn-block-card').style.display = 'flex';
  document.getElementById('modal-block-reason')?.focus();
}
window.mnShowBlock = mnShowBlock;

function mnClearBlock() {
  const inp = document.getElementById('modal-block-reason');
  if (inp) inp.value = '';
  document.getElementById('mn-block-card').style.display = 'none';
  document.getElementById('mn-block-add').style.display  = '';
}
window.mnClearBlock = mnClearBlock;

function saveProgressUpdate(itemId) {
  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  const newDone = parseInt(document.getElementById('modal-done-count')?.value, 10);
  if (!isNaN(newDone) && newDone >= 0 && newDone <= item.quantity) {
    item.doneCount = newDone;
    if (!localEdits[itemId]) localEdits[itemId] = {};
    localEdits[itemId].doneCount = newDone;
  }

  // Компоненты
  if (item.components) {
    item.components.forEach(c => {
      const inp = document.getElementById(`comp-${c.id}`);
      if (inp) {
        const v = parseInt(inp.value, 10);
        if (!isNaN(v) && v >= 0 && v <= c.quantity) {
          c.done = v;
          if (!localEdits[itemId].components) localEdits[itemId].components = [];
          const ec = localEdits[itemId].components.find(x => x.id === c.id);
          if (ec) ec.done = v;
          else localEdits[itemId].components.push({ id: c.id, done: v });
        }
      }
    });
  }

  saveEditsToStorage(itemId);
  closeModal();
  showToast('Прогресс обновлён');
  updateProblemsBadge();
  render();
}
window.saveProgressUpdate = saveProgressUpdate;

function savePurchaseUpdate(itemId) {
  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  const val = document.getElementById('modal-pur-status')?.value;
  if (!val) return;
  item.purchaseStatus = val;
  if (!localEdits[itemId]) localEdits[itemId] = {};
  localEdits[itemId].purchaseStatus = val;
  saveEditsToStorage(itemId);
  closeModal();
  showToast('Статус закупки обновлён');
  updateProblemsBadge();
  render();
}
window.savePurchaseUpdate = savePurchaseUpdate;

// Единое сохранение: прогресс + закупка + примечание
function saveItemUpdate(itemId) {
  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  if (!localEdits[itemId]) localEdits[itemId] = {};

  // Короткое имя
  const nameShortVal = (document.getElementById('modal-name-short')?.value ?? '').trim();
  if (nameShortVal) {
    item.nameShort = nameShortVal;
    localEdits[itemId].nameShort = nameShortVal;
  }

  // Полное наименование / подсказка
  const nameFullEn = document.getElementById('modal-name-full-enabled')?.checked ?? true;
  const nameFullTxt = (document.getElementById('modal-name-full-text')?.value ?? '').trim();
  item.nameFullEnabled = nameFullEn;
  item.nameFullOverride = nameFullTxt || item.name;
  localEdits[itemId].nameFullEnabled = nameFullEn;
  localEdits[itemId].nameFullOverride = item.nameFullOverride;

  // Количество (все типы)
  const newQty = parseInt(document.getElementById('modal-quantity')?.value, 10);
  if (!isNaN(newQty) && newQty > 0 && newQty !== item.quantity) {
    const oldQty = item.quantity;
    item.quantity = newQty;
    localEdits[itemId].quantity = newQty;
    // Логируем изменение количества в историю
    const today = new Date().toISOString().split('T')[0];
    const qtyEntry = { date: today, text: `Количество изменено: ${oldQty} → ${newQty} ${item.unit}` };
    if (!item.history) item.history = [];
    item.history.push(qtyEntry);
    if (!localEdits[itemId].historyFull) localEdits[itemId].historyFull = [...item.history];
    else localEdits[itemId].historyFull.push(qtyEntry);
  }

  // Прогресс (только для own)
  if (item.type === 'own') {
    const newDone = parseInt(document.getElementById('modal-done-count')?.value, 10);
    if (!isNaN(newDone) && newDone >= 0 && newDone <= item.quantity) {
      item.doneCount = newDone;
      localEdits[itemId].doneCount = newDone;
    }
    if (item.components) {
      item.components.forEach(c => {
        const inp = document.getElementById(`comp-${c.id}`);
        if (!inp) return;
        const v = parseInt(inp.value, 10);
        if (!isNaN(v) && v >= 0 && v <= c.quantity) {
          c.done = v;
          if (!localEdits[itemId].components) localEdits[itemId].components = [];
          const ec = localEdits[itemId].components.find(x => x.id === c.id);
          if (ec) ec.done = v; else localEdits[itemId].components.push({ id: c.id, done: v });
        }
      });
    }
  }

  // Статус закупки (все типы)
  const purVal = document.getElementById('modal-pur-status')?.value;
  if (purVal !== undefined) {
    item.purchaseStatus = purVal;
    item.materialsStatus = purVal;
    localEdits[itemId].purchaseStatus = purVal;
  }


  // Дедлайн (все типы)
  const dlVal = document.getElementById('modal-deadline')?.value;
  if (dlVal) {
    item.deadline = dlVal;
    localEdits[itemId].deadline = dlVal;
  }

  // Блокировка (все типы)
  const blockVal = (document.getElementById('modal-block-reason')?.value ?? '').trim();
  item.blockReason = blockVal || null;
  if (blockVal) localEdits[itemId].blockReason = blockVal;
  else if ('blockReason' in (localEdits[itemId] || {})) localEdits[itemId].blockReason = null;

  // Примечание (все типы)
  const notesVal = document.getElementById('modal-notes')?.value ?? '';
  item.notes = notesVal;
  localEdits[itemId].notes = notesVal;
  const noteTipEn = document.getElementById('modal-note-tip-enabled')?.checked ?? true;
  item.noteTipEnabled = noteTipEn;
  localEdits[itemId].noteTipEnabled = noteTipEn;

  // Оплата
  const payStatusVal = document.getElementById('modal-pay-status')?.value ?? '';
  item.payment_status = payStatusVal;
  localEdits[itemId].payment_status = payStatusVal;

  const supplierVal = (document.getElementById('modal-supplier')?.value ?? '').trim();
  item.supplier = supplierVal;
  localEdits[itemId].supplier = supplierVal;

  const payAmountRaw = document.getElementById('modal-pay-amount')?.value;
  const payAmountVal = payAmountRaw ? parseFloat(payAmountRaw) : 0;
  item.payment_amount = payAmountVal;
  localEdits[itemId].payment_amount = payAmountVal;

  const payDateVal = document.getElementById('modal-pay-date')?.value || '';
  item.payment_date = payDateVal;
  localEdits[itemId].payment_date = payDateVal;

  // Ожидаемая дата поставки
  const expDelVal = document.getElementById('modal-expected-delivery')?.value || '';
  item.expected_delivery = expDelVal;
  localEdits[itemId].expected_delivery = expDelVal;

  // Отгрузка
  const shipVal = document.getElementById('modal-ship-status')?.value ?? '';
  item.shipping_status = shipVal;
  localEdits[itemId].shipping_status = shipVal;

  saveEditsToStorage(itemId);
  closeModal();
  showToast('Сохранено');
  updateProblemsBadge();
  render();
}
window.saveItemUpdate = saveItemUpdate;

function saveNameFull(itemId) {
  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  const enabled = document.getElementById('name-full-enabled')?.checked ?? true;
  const text = (document.getElementById('name-full-text')?.value ?? '').trim();
  item.nameFullEnabled = enabled;
  item.nameFullOverride = text || item.name;
  if (!localEdits[itemId]) localEdits[itemId] = {};
  localEdits[itemId].nameFullEnabled = enabled;
  localEdits[itemId].nameFullOverride = item.nameFullOverride;
  saveEditsToStorage(itemId);
  showToast('Сохранено');
  render();
}
window.saveNameFull = saveNameFull;

// =============================================================
// DELETE PROJECT
// =============================================================
function confirmDeleteProject(projectId) {
  const project = VRH_PROJECTS.find(p => p.id === projectId);
  if (!project) return;
  const itemCount = getProjectItems(projectId).length;

  document.getElementById('modal-box').innerHTML = `
    <div class="modal-header">
      <div class="modal-title" style="color:#EF4444;display:flex;align-items:center;gap:8px">
        ${iconSvg('warning', 16)} Удалить проект
      </div>
      <button class="modal-close" onclick="closeModal()">${iconSvg('x', 12)}</button>
    </div>
    <div class="modal-body">
      <div style="font-size:14px;font-weight:600;color:var(--gray-900);margin-bottom:6px">«${project.name}»</div>
      <div style="font-size:13px;color:var(--gray-500);line-height:1.6;margin-bottom:16px">
        Будут безвозвратно удалены проект и все <strong>${itemCount} позиций</strong> оборудования.
        Это действие нельзя отменить.
      </div>
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Введите <strong>secret</strong> для подтверждения</label>
        <input type="text" class="form-input" id="modal-secret-input"
          placeholder="secret" autocomplete="off" spellcheck="false" style="margin-top:6px">
        <div id="modal-secret-error"
          style="display:none;color:#EF4444;font-size:12px;margin-top:6px">
          Неверное слово. Попробуйте ещё раз.
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn-secondary" onclick="closeModal()" style="flex:1">Отмена</button>
        <button class="btn-primary" onclick="deleteProject('${projectId}')"
          style="flex:1;background:#EF4444;display:flex;align-items:center;justify-content:center;gap:8px">
          ${iconSvg('x', 13)} Удалить
        </button>
      </div>
    </div>`;

  document.getElementById('modal-overlay').classList.add('open');
}
window.confirmDeleteProject = confirmDeleteProject;

function openChangeCoverModal(projectId) {
  const project = VRH_PROJECTS.find(p => p.id === projectId);
  if (!project) return;
  const current = getProjectCover(project);

  document.getElementById('modal-box').innerHTML = `
    <div style="padding:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="font-size:15px;font-weight:700">Выбрать обложку</div>
        <button class="mn-close-btn" onclick="closeModal()" style="position:static">${iconSvg('x', 13)}</button>
      </div>
      <div class="cover-picker" role="radiogroup">
        ${[0,1,2,3,4,5].map(i => `
          <button type="button" class="cover-option ${i === current ? 'is-selected' : ''}"
            data-cover="${i}" onclick="saveProjectCover('${projectId}', ${i})">
            <img src="assets/covers/cover-${i}.jpg" alt="Обложка ${i+1}">
          </button>`).join('')}
      </div>
    </div>`;
  document.getElementById('modal-overlay').classList.add('open');
}
window.openChangeCoverModal = openChangeCoverModal;

function saveProjectCover(projectId, coverIdx) {
  const project = VRH_PROJECTS.find(p => p.id === projectId);
  if (!project) return;
  project.cover = coverIdx;
  if (project._isCustom) {
    const cp = _customProjects.find(p => p.id === projectId);
    if (cp) cp.cover = coverIdx;
    if (_sb) {
      (async () => {
        try { await _sb.from('custom_projects').update({ cover: coverIdx }).eq('id', projectId); } catch(e) { console.error(e); }
      })();
    }
  } else {
    try {
      const ls = JSON.parse(localStorage.getItem('vrh_project_covers') || '{}');
      ls[projectId] = coverIdx;
      localStorage.setItem('vrh_project_covers', JSON.stringify(ls));
    } catch(e) {}
  }
  closeModal();
  showToast('Обложка обновлена');
  render();
}
window.saveProjectCover = saveProjectCover;

function deleteProject(projectId) {
  const input = document.getElementById('modal-secret-input')?.value?.trim().toLowerCase();
  if (input !== 'secret') {
    const err = document.getElementById('modal-secret-error');
    if (err) err.style.display = 'block';
    document.getElementById('modal-secret-input')?.focus();
    return;
  }
  const proj = VRH_PROJECTS.find(p => p.id === projectId);
  const idx  = VRH_PROJECTS.findIndex(p => p.id === projectId);
  if (idx === -1) return;
  VRH_PROJECTS.splice(idx, 1);
  const itemIds = VRH_ITEMS.filter(i => i.projectId === projectId).map(i => i.id);
  itemIds.forEach(id => {
    const i = VRH_ITEMS.findIndex(x => x.id === id);
    if (i !== -1) VRH_ITEMS.splice(i, 1);
    delete localEdits[id];
    if (_sb) (async () => { try { await _sb.from('item_overrides').delete().eq('item_id', id); } catch(e) {} })();
  });
  // Удаляем из Supabase если это пользовательский проект
  if (proj?._isCustom && _sb) {
    (async () => { try { await _sb.from('custom_projects').delete().eq('id', projectId); } catch(e) {} })();
    const ci = _customProjects.findIndex(p => p.id === projectId);
    if (ci !== -1) _customProjects.splice(ci, 1);
  }
  closeModal();
  updateProblemsBadge();
  showToast('Проект удалён');
  // Явный переход + render на случай если hash уже #projects (hashchange не сработает)
  state.view = 'projects'; state.projectId = null; state.itemId = null;
  window.location.hash = 'projects';
  render();
}
window.deleteProject = deleteProject;

// =============================================================
// CREATE ITEM
// =============================================================
function openCreateItemModal(projectId) {
  const project = VRH_PROJECTS.find(p => p.id === projectId);
  const assignees = getAllAssignees();
  const today = new Date().toISOString().slice(0, 10);
  const projectDeadline = project?.deadline || today;

  document.getElementById('modal-box').innerHTML = `
    <div class="modal-header">
      <div class="modal-title" style="display:flex;align-items:center;gap:8px">
        ${iconSvg('plus', 15)} Новая позиция
      </div>
      <button class="modal-close" onclick="closeModal()">${iconSvg('x', 12)}</button>
    </div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Комплекс <span style="color:#EF4444">*</span></label>
          <select class="form-input" id="ci-complex">
            ${COMPLEXES.map(c => `<option value="${c.id}">${c.abbr} - ${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Тип <span style="color:#EF4444">*</span></label>
          <select class="form-input" id="ci-type">
            <option value="own">Производство (изготавливаем)</option>
            <option value="purchased">Закупка (покупаем)</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Полное наименование <span style="color:#EF4444">*</span></label>
        <input class="form-input" type="text" id="ci-name" placeholder="Полное техническое название" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">Короткое название <span style="color:#EF4444">*</span></label>
        <input class="form-input" type="text" id="ci-name-short" placeholder="Для таблицы (до 40 символов)" autocomplete="off">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Количество <span style="color:#EF4444">*</span></label>
          <input class="form-input" type="number" id="ci-quantity" min="1" value="1">
        </div>
        <div class="form-group">
          <label class="form-label">Единица</label>
          <select class="form-input" id="ci-unit">
            <option value="шт">шт</option>
            <option value="м³">м³</option>
            <option value="м²">м²</option>
            <option value="м">м</option>
            <option value="кг">кг</option>
            <option value="компл.">компл.</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Дедлайн</label>
          <input class="form-input" type="date" id="ci-deadline" value="${projectDeadline}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Ответственный</label>
        <select class="form-input" id="ci-assignee">
          <option value="">— не назначен —</option>
          ${assignees.map(a => `<option value="${a.name}">${a.name}</option>`).join('')}
        </select>
      </div>
      <div id="ci-error" style="display:none;color:#EF4444;font-size:12px"></div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <button class="btn-secondary" onclick="closeModal()" style="flex:1">Отмена</button>
        <button class="btn-primary" onclick="saveNewItem('${projectId}')" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px">
          ${iconSvg('save', 13)} Добавить позицию
        </button>
      </div>
    </div>`;
  document.getElementById('modal-overlay').classList.add('open');
  requestAnimationFrame(() => document.getElementById('ci-name')?.focus());
}
window.openCreateItemModal = openCreateItemModal;

function saveNewItem(projectId) {
  const name      = document.getElementById('ci-name')?.value.trim();
  const nameShort = document.getElementById('ci-name-short')?.value.trim();
  const qtyRaw    = parseInt(document.getElementById('ci-quantity')?.value, 10);

  const showErr = (msg) => {
    const e = document.getElementById('ci-error');
    if (e) { e.textContent = msg; e.style.display = 'block'; }
  };
  if (!name)                 { showErr('Введите полное наименование'); document.getElementById('ci-name')?.focus(); return; }
  if (!nameShort)            { showErr('Введите короткое название');   document.getElementById('ci-name-short')?.focus(); return; }
  if (!qtyRaw || qtyRaw < 1){ showErr('Количество должно быть ≥ 1');  document.getElementById('ci-quantity')?.focus(); return; }

  const type     = document.getElementById('ci-type')?.value     || 'purchased';
  const complexId= document.getElementById('ci-complex')?.value  || COMPLEXES[0]?.id;
  const unit     = document.getElementById('ci-unit')?.value     || 'шт';
  const deadline = document.getElementById('ci-deadline')?.value  || '';
  const assignee = document.getElementById('ci-assignee')?.value || '';

  // Порядковый номер: макс существующий + 1 в этом комплексе
  const existingNums = VRH_ITEMS
    .filter(i => i.projectId === projectId && i.complexId === complexId)
    .map(i => parseInt(i.number, 10))
    .filter(n => !isNaN(n));
  const number = existingNums.length ? String(Math.max(...existingNums) + 1) : '1';

  const id = 'custom_item_' + Date.now();
  const ed = {
    is_custom:       true,
    projectId,
    complexId,
    number,
    name,
    nameShort,
    quantity:        qtyRaw,
    unit,
    deadline,
    type,
    doneCount:       0,
    materialsStatus: PUR.PENDING,
    purchaseStatus:  PUR.PENDING,
    assignee,
    blockReason:     null,
    notes:           '',
    components:      [],
    history:         [],
    parent_id:       null,
  };

  localEdits[id] = ed;
  VRH_ITEMS.push(_buildCustomItem(id, ed));
  saveEditsToStorage(id);
  applyEdits();
  closeModal();
  updateProblemsBadge();
  showToast('Позиция добавлена');
  render();
}
window.saveNewItem = saveNewItem;

// =============================================================
// CREATE PROJECT
// =============================================================
function openCreateProjectModal() {
  const typeOptions = [
    { val: 'uzv',   label: 'УЗВ (установка замкнутого водоснабжения)' },
    { val: 'ras',   label: 'РАС (рыбоводный аквасистем)' },
    { val: 'other', label: 'Другой тип' },
  ];
  document.getElementById('modal-box').innerHTML = `
    <div class="modal-header">
      <div class="modal-title" style="display:flex;align-items:center;gap:8px">
        ${iconSvg('folder', 15)} Новый проект
      </div>
      <button class="modal-close" onclick="closeModal()">${iconSvg('x', 12)}</button>
    </div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group">
        <label class="form-label">Название <span style="color:#EF4444">*</span></label>
        <input class="form-input" type="text" id="cp-name" placeholder="Калалахти-2" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">Заказчик</label>
        <input class="form-input" type="text" id="cp-client" placeholder="ООО «Наименование»" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">Местоположение</label>
        <input class="form-input" type="text" id="cp-location" placeholder="Город, регион" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">Описание</label>
        <input class="form-input" type="text" id="cp-description" placeholder="Краткое описание проекта" autocomplete="off">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Дедлайн <span style="color:#EF4444">*</span></label>
          <input class="form-input" type="date" id="cp-deadline">
        </div>
        <div class="form-group">
          <label class="form-label">Тип проекта</label>
          <select class="form-input" id="cp-type">
            ${typeOptions.map(o => `<option value="${o.val}">${o.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Обложка проекта</label>
        <div class="cover-picker" role="radiogroup" aria-label="Обложка проекта">
          ${Array.from({ length: 6 }, (_, i) => `
            <button type="button" class="cover-option ${i === 0 ? 'is-selected' : ''}"
              data-cover="${i}" role="radio" aria-checked="${i === 0}"
              onclick="selectProjectCover(${i})" aria-label="Обложка ${i + 1}">
              <img src="assets/covers/cover-${i}.jpg" alt="">
            </button>`).join('')}
        </div>
        <input type="hidden" id="cp-cover" value="0">
      </div>
      <div id="cp-error" style="display:none;color:#EF4444;font-size:12px"></div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <button class="btn-secondary" onclick="closeModal()" style="flex:1">Отмена</button>
        <button class="btn-primary" onclick="saveNewProject()" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px">
          ${iconSvg('save', 13)} Создать проект
        </button>
      </div>
    </div>`;
  document.getElementById('modal-overlay').classList.add('open');
  requestAnimationFrame(() => document.getElementById('cp-name')?.focus());
}
window.openCreateProjectModal = openCreateProjectModal;

function selectProjectCover(index) {
  const safeIndex = Math.max(0, Math.min(5, Number(index) || 0));
  const input = document.getElementById('cp-cover');
  if (input) input.value = String(safeIndex);
  document.querySelectorAll('.cover-option').forEach(option => {
    const selected = Number(option.dataset.cover) === safeIndex;
    option.classList.toggle('is-selected', selected);
    option.setAttribute('aria-checked', String(selected));
  });
}
window.selectProjectCover = selectProjectCover;

function saveNewProject() {
  const name     = document.getElementById('cp-name')?.value.trim();
  const deadline = document.getElementById('cp-deadline')?.value;
  if (!name) {
    const e = document.getElementById('cp-error');
    if (e) { e.textContent = 'Введите название проекта'; e.style.display = 'block'; }
    document.getElementById('cp-name')?.focus();
    return;
  }
  if (!deadline) {
    const e = document.getElementById('cp-error');
    if (e) { e.textContent = 'Выберите дедлайн'; e.style.display = 'block'; }
    document.getElementById('cp-deadline')?.focus();
    return;
  }
  const id = 'custom_proj_' + Date.now();
  const project = {
    id,
    name,
    client:      document.getElementById('cp-client')?.value.trim()      || '',
    location:    document.getElementById('cp-location')?.value.trim()    || '',
    description: document.getElementById('cp-description')?.value.trim() || '',
    deadline,
    type:             document.getElementById('cp-type')?.value || 'uzv',
    cover:            Number(document.getElementById('cp-cover')?.value || 0),
    workflow_version: 2,
    _isCustom:        true,
  };
  VRH_PROJECTS.push(project);
  _customProjects.push(project);
  if (_sb) {
    (async () => {
      try {
        await _sb.from('custom_projects').insert({
          id: project.id, name: project.name, client: project.client,
          location: project.location, description: project.description,
          deadline: project.deadline, type: project.type, cover: project.cover,
          workflow_version: 2,
          created_at: new Date().toISOString(),
        });
      } catch(e) { console.error('saveNewProject error:', e); }
    })();
  }
  closeModal();
  updateProblemsBadge();
  showToast('Проект создан');
  navigate('project', id);
}
window.saveNewProject = saveNewProject;

function closeModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('modal-overlay').classList.remove('open');
  const box = document.getElementById('modal-box');
  if (box) box.style.maxWidth = '';
}
window.closeModal = closeModal;

// =============================================================
// ASSIGNEE INLINE DROPDOWN
// =============================================================
const ASSIGNEE_PALETTE = [
  { bg: 'rgba(99,102,241,0.12)',  color: '#4338CA' },
  { bg: 'rgba(20,184,166,0.13)',  color: '#0F766E' },
  { bg: 'rgba(245,158,11,0.13)',  color: '#B45309' },
  { bg: 'rgba(236,72,153,0.12)',  color: '#9D174D' },
  { bg: 'rgba(59,130,246,0.13)',  color: '#1D4ED8' },
  { bg: 'rgba(34,197,94,0.13)',   color: '#166534' },
  { bg: 'rgba(239,68,68,0.12)',   color: '#991B1B' },
  { bg: 'rgba(168,85,247,0.12)',  color: '#6B21A8' },
];
const ASSIGNEE_DEFAULTS = [
  { name: 'Тренин А.',      colorIdx: 0 },
  { name: 'Парамузов О.Н.', colorIdx: 1 },
];
function loadAssignees() { return _customAssignees; }
async function saveAssignees(list) {
  _customAssignees = list;
  if (!_sb) return;
  await _sb.from('custom_assignees').delete().neq('name', '__never__');
  if (list.length) {
    await _sb.from('custom_assignees').insert(list.map(a => ({ name: a.name, color_idx: a.colorIdx })));
  }
}
function getAllAssignees() {
  const custom = loadAssignees();
  const suppressed = new Set(custom.filter(a => a.colorIdx === -1).map(a => a.name));
  const customVisible = custom.filter(a => a.colorIdx !== -1);
  const defaultNames = new Set(ASSIGNEE_DEFAULTS.map(a => a.name));
  const merged = [
    ...ASSIGNEE_DEFAULTS.filter(a => !suppressed.has(a.name)),
    ...customVisible.filter(a => !defaultNames.has(a.name)),
  ];
  // Дедупликация по имени — оставляем первое вхождение
  const seen = new Set();
  return merged.filter(a => { if (seen.has(a.name)) return false; seen.add(a.name); return true; });
}
function assigneeStyle(a) {
  const p = ASSIGNEE_PALETTE[a.colorIdx % ASSIGNEE_PALETTE.length];
  return `background:${p.bg};color:${p.color}`;
}
function assigneeDotStyle(a) {
  return `background:${ASSIGNEE_PALETTE[a.colorIdx % ASSIGNEE_PALETTE.length].color}`;
}

function renderAssigneeDrop(itemId) {
  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  const all = getAllAssignees();
  return all.map(a => {
    const active = item.assignee === a.name;
    const safeName = a.name.replace(/'/g, "\\'");
    const editBtn  = `<button class="adrop-edit-btn"   onclick="event.stopPropagation();showEditAssigneeInput('${itemId}','${safeName}')">${iconSvg('edit', 11)}</button>`;
    const delBtn   = `<button class="adrop-delete-btn" onclick="event.stopPropagation();deleteAssignee('${safeName}')">${iconSvg('trash', 11)}</button>`;
    return `<div class="adrop-item${active ? ' active' : ''}" onclick="setAssignee('${itemId}','${safeName}')" style="${active ? assigneeStyle(a) : ''}">
      <span class="adrop-color-dot" style="${assigneeDotStyle(a)}"></span>
      <span style="flex:1">${a.name}</span>${editBtn}${delBtn}
    </div>`;
  }).join('') +
  `<div class="adrop-divider"></div>
   <div class="adrop-item adrop-add" onclick="showAddAssigneeInput('${itemId}')">${iconSvg('plus',12)} Добавить...</div>
   <div class="adrop-divider"></div>
   <div class="adrop-item adrop-clear" onclick="setAssignee('${itemId}','')">— Не назначен —</div>`;
}

function openAssigneeDrop(itemId, anchor) {
  closeAssigneeDrop();
  const rect = anchor.getBoundingClientRect();
  const drop = document.createElement('div');
  drop.id = 'assignee-drop';
  drop.innerHTML = renderAssigneeDrop(itemId);
  document.body.appendChild(drop);
  positionDrop(drop, rect);
  setTimeout(() => document.addEventListener('click', closeAssigneeDrop, { once: true }), 0);
}
function positionDrop(drop, rect) {
  const dw = drop.offsetWidth, dh = drop.offsetHeight;
  let left = rect.left;
  let top  = rect.bottom + 5;
  if (left + dw > window.innerWidth - 8)  left = window.innerWidth - dw - 8;
  if (top  + dh > window.innerHeight - 8) top  = rect.top - dh - 5;
  drop.style.left = left + 'px';
  drop.style.top  = top  + 'px';
}
function closeAssigneeDrop() {
  const el = document.getElementById('assignee-drop');
  if (el) el.remove();
}
function showAddAssigneeInput(itemId) {
  const drop = document.getElementById('assignee-drop');
  if (!drop) return;
  document.removeEventListener('click', closeAssigneeDrop);
  drop.innerHTML = `<div class="adrop-new-row" onclick="event.stopPropagation()">
    <input id="adrop-new-input" type="text" placeholder="Имя Фамилия" autocomplete="off">
    <button onclick="confirmAddAssignee('${itemId}')">Ок</button>
  </div>`;
  const inp = document.getElementById('adrop-new-input');
  inp.focus();
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmAddAssignee(itemId);
    if (e.key === 'Escape') closeAssigneeDrop();
  });
  setTimeout(() => document.addEventListener('click', closeAssigneeDrop, { once: true }), 0);
}
function confirmAddAssignee(itemId) {
  const inp = document.getElementById('adrop-new-input');
  if (!inp) return;
  const name = inp.value.trim();
  if (!name) return;
  const all = getAllAssignees();
  if (!all.find(a => a.name === name)) {
    const custom = loadAssignees();
    const nextIdx = all.length % ASSIGNEE_PALETTE.length;
    custom.push({ name, colorIdx: nextIdx });
    saveAssignees(custom);
  }
  setAssignee(itemId, name);
}
function setAssignee(itemId, value) {
  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  item.assignee = value;
  if (!localEdits[itemId]) localEdits[itemId] = {};
  localEdits[itemId].assignee = value;
  saveEditsToStorage(itemId);
  closeAssigneeDrop();
  render();
}
function showEditAssigneeInput(itemId, oldName) {
  const drop = document.getElementById('assignee-drop');
  if (!drop) return;
  document.removeEventListener('click', closeAssigneeDrop);
  drop.innerHTML = `<div class="adrop-new-row" onclick="event.stopPropagation()">
    <input id="adrop-edit-input" type="text" value="${oldName.replace(/"/g, '&quot;')}" autocomplete="off">
    <button onclick="confirmEditAssignee('${itemId}','${oldName.replace(/'/g, "\\'")}')">Ок</button>
  </div>`;
  const inp = document.getElementById('adrop-edit-input');
  inp.focus();
  inp.select();
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmEditAssignee(itemId, oldName);
    if (e.key === 'Escape') closeAssigneeDrop();
  });
  setTimeout(() => document.addEventListener('click', closeAssigneeDrop, { once: true }), 0);
}
function confirmEditAssignee(itemId, oldName) {
  const inp = document.getElementById('adrop-edit-input');
  if (!inp) return;
  const newName = inp.value.trim();
  if (!newName || newName === oldName) { closeAssigneeDrop(); return; }
  const custom = loadAssignees();
  const ci = custom.findIndex(a => a.name === oldName);
  if (ci !== -1 && custom[ci].colorIdx !== -1) {
    custom[ci].name = newName;
  } else {
    // стандартный исполнитель - подавляем оригинал tombstone + добавляем переименованный
    const orig = ASSIGNEE_DEFAULTS.find(d => d.name === oldName);
    const tombIdx = custom.findIndex(a => a.name === oldName);
    if (tombIdx !== -1) custom[tombIdx].colorIdx = -1;
    else custom.push({ name: oldName, colorIdx: -1 });
    if (!custom.find(a => a.name === newName && a.colorIdx !== -1)) {
      custom.push({ name: newName, colorIdx: orig ? orig.colorIdx : 0 });
    }
  }
  saveAssignees(custom);
  const _affectedIds = [];
  VRH_ITEMS.forEach(item => {
    if (item.assignee === oldName) {
      item.assignee = newName;
      if (!localEdits[item.id]) localEdits[item.id] = {};
      localEdits[item.id].assignee = newName;
      _affectedIds.push(item.id);
    }
  });
  _affectedIds.forEach(id => saveEditsToStorage(id));
  closeAssigneeDrop();
  render();
}
function deleteAssignee(name) {
  const custom = loadAssignees();
  const isDefault = ASSIGNEE_DEFAULTS.some(d => d.name === name);
  if (isDefault) {
    const existing = custom.findIndex(a => a.name === name);
    if (existing !== -1) custom[existing].colorIdx = -1;
    else custom.push({ name, colorIdx: -1 });
  } else {
    const ci = custom.findIndex(a => a.name === name);
    if (ci !== -1) custom.splice(ci, 1);
  }
  saveAssignees(custom);
  closeAssigneeDrop();
  render();
}
window.openAssigneeDrop      = openAssigneeDrop;
window.setAssignee           = setAssignee;
window.showAddAssigneeInput  = showAddAssigneeInput;
window.confirmAddAssignee    = confirmAddAssignee;
window.showEditAssigneeInput = showEditAssigneeInput;
window.confirmEditAssignee   = confirmEditAssignee;
window.deleteAssignee        = deleteAssignee;

// =============================================================
// СТРАНИЦА «ИСПОЛНИТЕЛИ»
// =============================================================

function _apKey(name) { return '_ap_' + name; }

function saveAssigneeProfile(name, profile) {
  _assigneeProfiles[name] = profile;
  if (!_sb) return;
  (async () => {
    try {
      await _sb.from('item_overrides').upsert({
        item_id: _apKey(name), data: profile, updated_at: new Date().toISOString()
      });
    } catch(e) { console.error('saveAssigneeProfile:', e); }
  })();
}

function deleteAssigneeProfile(name) {
  delete _assigneeProfiles[name];
  if (!_sb) return;
  (async () => {
    try { await _sb.from('item_overrides').delete().eq('item_id', _apKey(name)); } catch(e) {}
  })();
}

let _asgnSearch = '';

function renderAssigneesPage(el) {
  const all = getAllAssignees();
  const q   = _asgnSearch.toLowerCase();
  const filtered = q
    ? all.filter(a => {
        const prof = _assigneeProfiles[a.name] || {};
        return a.name.toLowerCase().includes(q)
          || (prof.title   || '').toLowerCase().includes(q)
          || (prof.company || '').toLowerCase().includes(q);
      })
    : all;

  const rows = filtered.map(a => {
    const p    = ASSIGNEE_PALETTE[a.colorIdx % ASSIGNEE_PALETTE.length];
    const prof = _assigneeProfiles[a.name] || {};
    const sn   = a.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const initials = a.name.trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase();
    const sub = prof.title || '';
    return `
    <div class="asgn-row" onclick="openAssigneeCard('${sn}')" style="cursor:pointer">
      <div class="asgn-avatar" style="background:${p.bg};color:${p.color}">${initials}</div>
      <div class="asgn-info">
        <div class="asgn-name">${a.name}</div>
        ${sub ? `<div class="asgn-sub">${sub}</div>` : ''}
      </div>
      <div class="asgn-row-actions">
        <button class="asgn-icon-btn" title="Изменить" onclick="event.stopPropagation();openAssigneeModal('${sn}',${a.colorIdx})">${iconSvg('edit',15)}</button>
        <button class="asgn-icon-btn asgn-icon-btn-danger" title="Удалить" onclick="event.stopPropagation();deleteAssigneeFromPage('${sn}')">${iconSvg('trash',15)}</button>
      </div>
    </div>`;
  }).join('');

  const countLabel = q
    ? `${filtered.length} из ${all.length}`
    : `${all.length} ${all.length === 1 ? 'сотрудник' : all.length < 5 ? 'сотрудника' : 'сотрудников'}`;

  el.innerHTML = `
  <div style="max-width:640px;margin:0 auto;padding:28px 24px 80px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <h1 style="font-size:24px;font-weight:700;margin:0">Исполнители</h1>
        <div style="color:var(--gray-400);font-size:13px;margin-top:2px">${countLabel}</div>
      </div>
      <button class="btn-primary" onclick="openAssigneeModal(null,null)">${iconSvg('plus',16)} Добавить</button>
    </div>
    <div style="position:relative;margin-bottom:16px">
      <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--gray-400);pointer-events:none">${iconSvg('list',15)}</span>
      <input id="asgn-search" class="mn-input" type="search" placeholder="Поиск по имени, должности, компании..."
             value="${_asgnSearch.replace(/"/g,'&quot;')}"
             style="padding-left:36px;width:100%"
             oninput="setAsgnSearch(this.value)">
    </div>
    ${filtered.length === 0
      ? `<div style="text-align:center;color:var(--gray-400);padding:48px 0">${iconSvg('user',36)}<div style="margin-top:12px">${q ? 'Ничего не найдено' : 'Нет исполнителей'}</div></div>`
      : `<div class="asgn-list">${rows}</div>`}
  </div>`;
}

function setAsgnSearch(val) {
  _asgnSearch = val;
  const el = document.getElementById('content');
  if (el) renderAssigneesPage(el);
  // Восстановить фокус
  requestAnimationFrame(() => {
    const inp = document.getElementById('asgn-search');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  });
}
window.setAsgnSearch = setAsgnSearch;

function openAssigneeCard(name) {
  const a    = getAllAssignees().find(x => x.name === name);
  if (!a) return;
  const p    = ASSIGNEE_PALETTE[a.colorIdx % ASSIGNEE_PALETTE.length];
  const prof = _assigneeProfiles[name] || {};
  const sn   = name.replace(/'/g, "\\'");
  const initials = name.trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase();

  const row = (label, val) => val
    ? `<div class="asgn-card-field"><span class="asgn-card-label">${label}</span><span class="asgn-card-val">${val}</span></div>`
    : '';

  const hasFields = prof.title || prof.company || prof.phone || prof.email;

  const box = document.getElementById('modal-box');
  box.style.maxWidth = '360px';
  box.innerHTML = `
    <div class="modal-header" style="padding:12px 16px">
      <span style="font-size:14px">Профиль</span>
      <button class="modal-close" onclick="closeModal()">${iconSvg('x',16)}</button>
    </div>
    <div style="padding:16px">
      <div class="asgn-card-top">
        <div class="asgn-card-avatar" style="background:${p.bg};color:${p.color}">${initials}</div>
        <div class="asgn-card-name">${name}</div>
      </div>
      ${hasFields ? `<div class="asgn-card-fields">
        ${row('Должность', prof.title)}
        ${row('Компания',  prof.company)}
        ${row('Телефон',   prof.phone)}
        ${row('Email',     prof.email)}
      </div>` : `<div style="color:var(--gray-400);font-size:13px;padding:8px 0">Контактные данные не заполнены</div>`}
      <button class="btn-primary" style="width:100%;margin-top:14px" onclick="closeModal();openAssigneeModal('${sn}',${a.colorIdx})">${iconSvg('edit',14)} Редактировать</button>
    </div>`;
  document.getElementById('modal-overlay').classList.add('open');
}

function openAssigneeModal(name, colorIdx) {
  const isEdit = name !== null && name !== undefined && name !== '';
  const selIdx = (colorIdx !== null && colorIdx !== undefined) ? colorIdx : 0;
  const prof   = isEdit ? (_assigneeProfiles[name] || {}) : {};

  const swatches = ASSIGNEE_PALETTE.map((p, i) => `
    <button type="button" class="asgn-color-swatch${i === selIdx ? ' selected' : ''}"
            style="background:${p.color}" data-idx="${i}"
            onclick="asgnSelectColor(${i})"></button>`).join('');

  const esc = v => (v || '').replace(/"/g, '&quot;');

  document.getElementById('modal-box').innerHTML = `
    <div class="modal-header">
      <span>${isEdit ? 'Редактировать' : 'Новый исполнитель'}</span>
      <button class="modal-close" onclick="closeModal()">${iconSvg('x',18)}</button>
    </div>
    <div style="padding:20px 24px 24px;display:flex;flex-direction:column;gap:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="grid-column:1/-1">
          <label class="mn-label">Отображаемое имя <span style="color:#EF4444">*</span></label>
          <input id="asgn-modal-name" class="mn-input" type="text" placeholder="Иванов А.В." autocomplete="off"
                 value="${esc(isEdit ? name : '')}">
        </div>
        <div>
          <label class="mn-label">Телефон</label>
          <input id="asgn-modal-phone" class="mn-input" type="tel" placeholder="+7 (900) 000-00-00"
                 value="${esc(prof.phone)}">
        </div>
        <div>
          <label class="mn-label">Email</label>
          <input id="asgn-modal-email" class="mn-input" type="email" placeholder="ivan@example.com"
                 value="${esc(prof.email)}">
        </div>
        <div>
          <label class="mn-label">Должность</label>
          <input id="asgn-modal-title" class="mn-input" type="text" placeholder="Инженер-технолог"
                 value="${esc(prof.title)}">
        </div>
        <div>
          <label class="mn-label">Компания</label>
          <input id="asgn-modal-company" class="mn-input" type="text" placeholder="ООО Пример"
                 value="${esc(prof.company)}">
        </div>
      </div>
      <div>
        <label class="mn-label">Цвет</label>
        <div class="asgn-color-row">${swatches}</div>
        <input type="hidden" id="asgn-modal-color" value="${selIdx}">
      </div>
      <div id="asgn-modal-error" style="display:none;color:#EF4444;font-size:12px"></div>
      <div style="display:flex;gap:10px;margin-top:4px">
        ${isEdit ? `<button class="mn-btn-danger" style="margin-right:auto" onclick="deleteAssigneeFromPage('${name.replace(/'/g, "\\'")}')">${iconSvg('trash',14)} Удалить</button>` : ''}
        <button class="btn-secondary" onclick="closeModal()">Отмена</button>
        <button class="btn-primary" onclick="saveAssigneeModal('${isEdit ? name.replace(/'/g, "\\'") : ''}')">${iconSvg('save',14)} Сохранить</button>
      </div>
    </div>`;
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('asgn-modal-name').focus();
}

function asgnSelectColor(idx) {
  document.getElementById('asgn-modal-color').value = idx;
  document.querySelectorAll('.asgn-color-swatch').forEach((el, i) => {
    el.classList.toggle('selected', i === idx);
  });
}

function saveAssigneeModal(oldName) {
  const newName  = document.getElementById('asgn-modal-name')?.value.trim();
  const colorIdx = parseInt(document.getElementById('asgn-modal-color')?.value ?? '0', 10);
  const errEl    = document.getElementById('asgn-modal-error');

  if (!newName) { if (errEl) { errEl.textContent = 'Введите имя'; errEl.style.display = 'block'; } return; }

  const profile = {
    phone:   document.getElementById('asgn-modal-phone')?.value.trim()   || '',
    email:   document.getElementById('asgn-modal-email')?.value.trim()   || '',
    title:   document.getElementById('asgn-modal-title')?.value.trim()   || '',
    company: document.getElementById('asgn-modal-company')?.value.trim() || '',
  };

  const custom    = loadAssignees();
  const all       = getAllAssignees();
  const isDefault = n => ASSIGNEE_DEFAULTS.some(d => d.name === n);

  if (oldName) {
    if (newName !== oldName) {
      // Подавляем/удаляем старое имя
      if (isDefault(oldName)) {
        const ti = custom.findIndex(a => a.name === oldName);
        if (ti !== -1) custom[ti].colorIdx = -1; else custom.push({ name: oldName, colorIdx: -1 });
      } else {
        const ci = custom.findIndex(a => a.name === oldName);
        if (ci !== -1) custom.splice(ci, 1);
      }
      // Переносим профиль и задачи
      const oldProf = _assigneeProfiles[oldName];
      if (oldProf) { saveAssigneeProfile(newName, { ...oldProf, ...profile }); deleteAssigneeProfile(oldName); }
      VRH_ITEMS.forEach(item => {
        if (item.assignee === oldName) {
          item.assignee = newName;
          if (!localEdits[item.id]) localEdits[item.id] = {};
          localEdits[item.id].assignee = newName;
          saveEditsToStorage(item.id);
        }
      });
    } else {
      saveAssigneeProfile(newName, profile);
    }
    // Обновляем colorIdx
    if (isDefault(newName) && newName === oldName) {
      const ti = custom.findIndex(a => a.name === newName && a.colorIdx !== -1);
      if (ti !== -1) custom[ti].colorIdx = colorIdx; else custom.push({ name: newName, colorIdx });
      const tbi = custom.findIndex(a => a.name === newName && a.colorIdx === -1);
      if (tbi !== -1) custom.splice(tbi, 1);
    } else {
      const ci = custom.findIndex(a => a.name === newName && a.colorIdx !== -1);
      if (ci !== -1) custom[ci].colorIdx = colorIdx; else custom.push({ name: newName, colorIdx });
    }
  } else {
    if (all.find(a => a.name === newName)) {
      if (errEl) { errEl.textContent = 'Исполнитель с таким именем уже есть'; errEl.style.display = 'block'; } return;
    }
    custom.push({ name: newName, colorIdx });
    saveAssigneeProfile(newName, profile);
  }

  saveAssignees(custom);
  closeModal();
  if (typeof showToast === 'function') showToast(oldName ? 'Исполнитель обновлён' : 'Исполнитель добавлен');
  render();
}

function deleteAssigneeFromPage(name) {
  if (!confirm(`Удалить исполнителя «${name}»?`)) return;
  const custom    = loadAssignees();
  const isDefault = ASSIGNEE_DEFAULTS.some(d => d.name === name);
  if (isDefault) {
    const ei = custom.findIndex(a => a.name === name);
    if (ei !== -1) custom[ei].colorIdx = -1; else custom.push({ name, colorIdx: -1 });
  } else {
    const ci = custom.findIndex(a => a.name === name);
    if (ci !== -1) custom.splice(ci, 1);
  }
  deleteAssigneeProfile(name);
  saveAssignees(custom);
  if (typeof showToast === 'function') showToast('Исполнитель удалён');
  closeModal();
  render();
}

window.renderAssigneesPage    = renderAssigneesPage;
window.openAssigneeCard       = openAssigneeCard;
window.openAssigneeModal      = openAssigneeModal;
window.asgnSelectColor        = asgnSelectColor;
window.saveAssigneeModal      = saveAssigneeModal;
window.deleteAssigneeFromPage = deleteAssigneeFromPage;

// =============================================================
// NAME TOOLTIP
// =============================================================
document.addEventListener('mouseover', e => {
  const tip = e.target.closest('.name-full-tip, .note-tip');
  if (!tip) return;
  const text = tip.getAttribute('data-tip');
  if (!text) return;
  let el = document.getElementById('name-tooltip');
  if (!el) { el = document.createElement('div'); el.id = 'name-tooltip'; document.body.appendChild(el); }
  el.textContent = text;
  const rect = tip.getBoundingClientRect();
  el.style.visibility = 'hidden';
  el.style.display = 'block';
  const tw = el.offsetWidth, th = el.offsetHeight;
  let top = rect.top - th - 8;
  let left = rect.left + rect.width / 2 - tw / 2;
  if (top < 8) top = rect.bottom + 8;
  if (left < 8) left = 8;
  if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
  el.style.top = top + 'px';
  el.style.left = left + 'px';
  el.style.visibility = 'visible';
});
document.addEventListener('mouseout', e => {
  if (e.target.closest('.name-full-tip, .note-tip')) {
    const el = document.getElementById('name-tooltip');
    if (el) el.remove();
  }
});

// =============================================================
// PERSISTENCE
// =============================================================
// =============================================================
// ITEM ORDER (drag-and-drop)
// =============================================================
let _dragId = null;

function loadItemOrder() { return { ..._itemOrder }; }
function saveItemOrder(o) {
  _itemOrder = { ...o };
  if (!_sb) return;
  (async () => {
    try {
      for (const [complex_id, order_json] of Object.entries(o)) {
        await _sb.from('item_order').upsert({ complex_id, order_json });
      }
    } catch(e) { console.error('saveOrder error:', e); }
  })();
}
function applyItemOrder(complexId, items) {
  const ids = loadItemOrder()[complexId];
  if (!ids || !ids.length) return items;
  return [...items].sort((a, b) => {
    const ai = ids.indexOf(a.id), bi = ids.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
function initGridDrag(grid, complexId, projectId) {
  grid.addEventListener('dragstart', e => {
    const row = e.target.closest('.ig-row[draggable]');
    if (!row) return;
    _dragId = row.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => row.classList.add('dragging'), 0);
  });
  grid.addEventListener('dragend', () => {
    _dragId = null;
    grid.querySelectorAll('.ig-row').forEach(r => r.classList.remove('dragging', 'drag-over'));
  });
  grid.addEventListener('dragover', e => {
    e.preventDefault();
    const row = e.target.closest('.ig-row[draggable]');
    if (!row || row.dataset.id === _dragId) return;
    grid.querySelectorAll('.ig-row.drag-over').forEach(r => r.classList.remove('drag-over'));
    row.classList.add('drag-over');
  });
  grid.addEventListener('dragleave', e => {
    if (!grid.contains(e.relatedTarget))
      grid.querySelectorAll('.ig-row.drag-over').forEach(r => r.classList.remove('drag-over'));
  });
  grid.addEventListener('drop', e => {
    e.preventDefault();
    const target = e.target.closest('.ig-row[draggable]');
    if (!target || !_dragId || target.dataset.id === _dragId) return;
    const allItems = VRH_ITEMS.filter(i => i.complexId === complexId && i.projectId === projectId);
    const order = loadItemOrder();
    const ids = order[complexId] ? [...order[complexId]] : allItems.map(i => i.id);
    allItems.forEach(i => { if (!ids.includes(i.id)) ids.push(i.id); });
    const si = ids.indexOf(_dragId);
    const ti = ids.indexOf(target.dataset.id);
    if (si === -1 || ti === -1) return;
    ids.splice(si, 1);
    const newTi = ids.indexOf(target.dataset.id);
    const after = e.clientY > target.getBoundingClientRect().top + target.offsetHeight / 2;
    ids.splice(after ? newTi + 1 : newTi, 0, _dragId);
    order[complexId] = ids;
    saveItemOrder(order);
    navigate('project', projectId);
  });
}

function saveEditsToStorage(changedItemId) {
  if (!_sb || changedItemId === undefined) return;
  const data = localEdits[changedItemId];
  (async () => {
    try {
      if (data === undefined) {
        await _sb.from('item_overrides').delete().eq('item_id', changedItemId);
      } else {
        await _sb.from('item_overrides').upsert({ item_id: changedItemId, data, updated_at: new Date().toISOString() });
      }
    } catch(e) { console.error('saveEdits error:', e); }
  })();
}

function loadEditsFromStorage() { /* data loaded from Supabase via loadRemoteData() */ }

function applyEdits() {
  VRH_ITEMS.forEach(item => {
    const edit = localEdits[item.id];
    if (!edit) return;
    if (edit.nameShort        !== undefined)  item.nameShort        = edit.nameShort;
    if (edit.quantity         !== undefined)  item.quantity         = edit.quantity;
    if (edit.doneCount !== undefined && !isV2Project(item.projectId)) item.doneCount = edit.doneCount;
    if (edit.purchaseStatus   !== undefined)  item.purchaseStatus   = edit.purchaseStatus;
    if (edit.notes            !== undefined)  item.notes            = edit.notes;
    if (edit.deadline         !== undefined)  item.deadline         = edit.deadline;
    if (edit.assignee         !== undefined)  item.assignee         = edit.assignee;
    if (edit.blockReason      !== undefined)  item.blockReason      = edit.blockReason;
    if (edit.nameFullEnabled    !== undefined)  item.nameFullEnabled    = edit.nameFullEnabled;
    if (edit.nameFullOverride   !== undefined)  item.nameFullOverride   = edit.nameFullOverride;
    if (edit.noteTipEnabled     !== undefined)  item.noteTipEnabled     = edit.noteTipEnabled;
    if (edit.supplier           !== undefined)  item.supplier           = edit.supplier;
    if (edit.payment_status     !== undefined)  item.payment_status     = edit.payment_status;
    if (edit.payment_date       !== undefined)  item.payment_date       = edit.payment_date;
    if (edit.payment_amount     !== undefined)  item.payment_amount     = edit.payment_amount;
    if (edit.expected_delivery  !== undefined)  item.expected_delivery  = edit.expected_delivery;
    if (edit.shipping_status    !== undefined)  item.shipping_status    = edit.shipping_status;
    if (edit.components) {
      edit.components.forEach(ec => {
        const c = item.components?.find(x => x.id === ec.id);
        if (!c) return;
        if (ec.done       !== undefined) c.done       = ec.done;
        if (ec.name       !== undefined) c.name       = ec.name;
        if (ec.quantity   !== undefined) c.quantity   = ec.quantity;
        if (ec.unit       !== undefined) c.unit       = ec.unit;
        if (ec.responsible!== undefined) c.responsible= ec.responsible;
        if (ec.notes      !== undefined) c.notes      = ec.notes;
      });
    }
    if (edit.extraComponents) {
      if (!item.components) item.components = [];
      edit.extraComponents.forEach(ec => {
        if (!item.components.find(c => c.id === ec.id)) item.components.push({ ...ec });
      });
    }
    if (edit.deletedComponents?.length) {
      if (!item.components) item.components = [];
      item.components = item.components.filter(c => !edit.deletedComponents.includes(c.id));
    }
    if (edit.historyFull) {
      item.history = edit.historyFull.map(h => ({ ...h }));
    } else if (edit.history) {
      edit.history.forEach(h => {
        if (!item.history.find(x => x.date === h.date && x.text === h.text)) {
          item.history.push(h);
        }
      });
    }
  });
  // Удаляем помеченные как deleted
  for (let i = VRH_ITEMS.length - 1; i >= 0; i--) {
    if (localEdits[VRH_ITEMS[i].id]?.deleted) VRH_ITEMS.splice(i, 1);
  }
}

function deleteItem(itemId) {
  if (!confirm('Удалить позицию? Это действие нельзя отменить.')) return;
  if (!localEdits[itemId]) localEdits[itemId] = {};
  localEdits[itemId].deleted = true;
  saveEditsToStorage(itemId);
  // Убираем из памяти сразу, не ждём перезагрузки
  const _di = VRH_ITEMS.findIndex(i => i.id === itemId);
  if (_di !== -1) VRH_ITEMS.splice(_di, 1);
  closeModal();
  navigate('project', state.projectId);
}
window.deleteItem = deleteItem;

function saveHistoryEntry(itemId) {
  const text = document.getElementById('item-comment-input')?.value?.trim();
  if (!text) { showToast('Введите текст записи'); return; }

  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  const today = new Date().toISOString().split('T')[0];
  const entry = { date: today, text };
  item.history.push(entry);

  if (!localEdits[itemId]) localEdits[itemId] = {};
  if (localEdits[itemId].historyFull) {
    localEdits[itemId].historyFull.push(entry);
  } else {
    if (!localEdits[itemId].history) localEdits[itemId].history = [];
    localEdits[itemId].history.push(entry);
  }

  saveEditsToStorage(itemId);
  showToast('Запись добавлена в историю');
  document.getElementById('item-comment-input').value = '';
  render();
}
window.saveHistoryEntry = saveHistoryEntry;

function editHistoryEntry(itemId, idx) {
  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  const sorted = [...item.history].sort((a,b) => b.date.localeCompare(a.date));
  const entry = sorted[idx];
  if (!entry) return;
  const row = document.getElementById(`hist-row-${idx}`);
  if (!row) return;
  const textEl = row.querySelector('.hist-text');
  if (!textEl) return;
  textEl.innerHTML = `
    <div>
      <textarea id="hist-edit-${idx}" class="form-textarea" style="min-height:52px;margin-bottom:8px">${entry.text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
      <div style="display:flex;gap:6px">
        <button class="btn-primary" style="font-size:11px;padding:4px 12px;display:inline-flex;align-items:center;gap:4px" onclick="saveHistoryEdit('${itemId}',${idx})">${iconSvg('save',11)} Сохранить</button>
        <button class="btn-secondary" style="font-size:11px;padding:4px 10px" onclick="render()">Отмена</button>
      </div>
    </div>`;
  row.querySelector(`#hist-edit-${idx}`)?.focus();
}
window.editHistoryEntry = editHistoryEntry;

function saveHistoryEdit(itemId, idx) {
  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  const sorted = [...item.history].sort((a,b) => b.date.localeCompare(a.date));
  const entry = sorted[idx];
  if (!entry) return;
  const newText = (document.getElementById(`hist-edit-${idx}`)?.value ?? '').trim();
  if (!newText) { showToast('Текст не может быть пустым'); return; }
  const orig = item.history.find(h => h.date === entry.date && h.text === entry.text);
  if (orig) orig.text = newText;
  if (!localEdits[itemId]) localEdits[itemId] = {};
  localEdits[itemId].historyFull = item.history.map(h => ({ ...h }));
  delete localEdits[itemId].history;
  saveEditsToStorage(itemId);
  showToast('Запись обновлена');
  render();
}
window.saveHistoryEdit = saveHistoryEdit;

// =============================================================
// WORKFLOW v2 - STAGE UI
// =============================================================

// Топологические уровни: level 0 = без зависимостей, level N = после уровня N-1
function _wfComputeLevels(stages) {
  const byId = {};
  stages.forEach(s => byId[s.id] = s);
  const levels = {};
  const visiting = new Set();

  function getLevel(s) {
    if (s.id in levels) return levels[s.id];
    if (visiting.has(s.id)) { levels[s.id] = 0; return 0; } // защита от циклов
    visiting.add(s.id);
    const deps = (s.depends_on || []).filter(id => id in byId);
    levels[s.id] = deps.length
      ? Math.max(...deps.map(id => getLevel(byId[id]))) + 1
      : 0;
    visiting.delete(s.id);
    return levels[s.id];
  }

  stages.forEach(s => getLevel(s));
  return levels;
}

function renderWorkflowDetail(item, project) {
  const stages = getItemStages(item.id);
  const bn     = getWorkflowBottleneck(item.id);
  const bnId   = bn?.id;

  let stagesHtml = '';
  if (!stages.length) {
    stagesHtml = `
      <div class="empty-state">
        <img src="assets/empty/empty-workflow.png" class="empty-state-img" alt="">
        <div class="empty-state-title">Маршрут не настроен</div>
        <div class="empty-state-text">Добавьте первый этап производства, чтобы отслеживать прогресс и узкие места</div>
        <button class="btn-primary empty-state-btn" onclick="openAddStageModal('${item.id}')">
          ${iconSvg('plus', 12)} Добавить этап
        </button>
      </div>`;
  } else {
    const levels   = _wfComputeLevels(stages);
    const byLevel  = {};
    stages.forEach(s => {
      const lv = levels[s.id] ?? 0;
      if (!byLevel[lv]) byLevel[lv] = [];
      byLevel[lv].push(s);
    });
    const sortedLvs = Object.keys(byLevel).map(Number).sort((a, b) => a - b);

    sortedLvs.forEach((lv, idx) => {
      if (idx > 0) stagesHtml += `<div class="wf-level-arrow">${iconSvg('chart', 10)}</div>`;
      const group = byLevel[lv];
      if (group.length === 1) {
        stagesHtml += renderStageCard(group[0], item, bnId, stages);
      } else {
        stagesHtml += `
          <div class="wf-parallel-group">
            <div class="wf-parallel-label">${iconSvg('refresh', 10)} Параллельно</div>
            <div class="wf-parallel-cards">
              ${group.map(s => renderStageCard(s, item, bnId, stages)).join('')}
            </div>
          </div>`;
      }
    });
  }

  const bottleneckTag = bn
    ? `<span class="wf-bottleneck-tag">${iconSvg('warning', 11)} Узкое место: ${bn.name} (${bn.done_qty}/${item.quantity} ${item.unit})</span>`
    : '';

  return `
    <div class="card" style="padding:20px 24px;margin-top:16px">
      <div class="wf-header">
        <div class="wf-title">${iconSvg('list', 13)} Маршрут производства</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${bottleneckTag}
          <button class="wf-btn primary" onclick="openAddStageModal('${item.id}')">${iconSvg('plus', 11)} Добавить этап</button>
        </div>
      </div>
      <div class="wf-stage-list">${stagesHtml}</div>
    </div>`;
}

function renderStageCard(stage, item, bnId, allStages) {
  const isBN  = stage.id === bnId && stage.required;
  const pct   = stage.planned_qty > 0 ? Math.min(100, Math.round(stage.done_qty / stage.planned_qty * 100)) : 0;
  const pillMap = {
    done:        ['wf-pill-done',     'Готово'],
    in_progress: ['wf-pill-progress', 'В работе'],
    pending:     ['wf-pill-pending',  'Ожидает'],
    blocked:     ['wf-pill-blocked',  'Заблок.'],
  };
  const [pillCls, pillLabel] = pillMap[stage.status] || pillMap.pending;

  // Зависимости: имена и предупреждение
  const deps = (stage.depends_on || []);
  let depWarningHtml = '';
  if (deps.length && allStages) {
    const depStages = deps.map(id => allStages.find(s => s.id === id)).filter(Boolean);
    const incomplete = depStages.filter(s => s.done_qty < s.planned_qty);
    if (incomplete.length) {
      depWarningHtml = `<div class="wf-dep-warning">
        ${iconSvg('warning', 11)} Ожидает завершения: ${incomplete.map(s => `«${s.name}»`).join(', ')}
      </div>`;
    }
  }

  const assigneeHtml = stage.assignee
    ? `<span class="wf-meta-chip">${iconSvg('user', 10)} ${stage.assignee}</span>` : '';
  const dateHtml = stage.end_date
    ? `<span class="wf-meta-chip">${iconSvg('calendar', 10)} до ${formatDate(new Date(stage.end_date))}</span>` : '';
  const reqHtml = stage.required
    ? `<span class="wf-meta-chip" style="color:var(--gray-600)">Обязательный</span>`
    : `<span class="wf-meta-chip" style="color:var(--gray-400)">Доп.</span>`;
  const commentHtml = stage.comment
    ? `<div class="wf-comment">${stage.comment}</div>` : '';

  return `
    <div class="wf-stage-card ${isBN ? 'is-bottleneck' : ''}">
      <div class="wf-stage-head">
        <div class="wf-stage-order">${stage.stage_order}</div>
        <div class="wf-stage-name">${stage.name}</div>
        ${isBN ? `<span class="wf-bottleneck-star">★ УЗКОЕ МЕСТО</span>` : ''}
        <span class="wf-stage-pill ${pillCls}">${pillLabel}</span>
      </div>
      <div class="wf-stage-body">
        ${depWarningHtml}
        <div class="wf-stage-meta">${assigneeHtml}${dateHtml}${reqHtml}</div>
        <div class="wf-progress-row">
          <input class="wf-done-input" type="number" min="0" max="${stage.planned_qty}"
            value="${stage.done_qty}"
            onchange="updateStageDone('${stage.id}','${item.id}',this.value)">
          <span style="font-size:12px;color:var(--gray-400);white-space:nowrap">/ ${stage.planned_qty} ${item.unit}</span>
          <div class="wf-progress-track">
            <div class="wf-progress-fill" style="width:${pct}%"></div>
          </div>
          <span class="wf-progress-pct">${pct}%</span>
        </div>
        ${commentHtml}
        <div class="wf-stage-actions">
          <button class="wf-btn" onclick="openEditStageModal('${stage.id}','${item.id}')">${iconSvg('edit', 11)} Изменить</button>
          <button class="wf-btn danger" onclick="deleteStage('${stage.id}','${item.id}')">${iconSvg('trash', 11)} Удалить</button>
        </div>
      </div>
    </div>`;
}

function _wfAssigneeOpts(selected) {
  return getAllAssignees().map(a =>
    `<option value="${a.name}" ${selected === a.name ? 'selected' : ''}>${a.name}</option>`
  ).join('');
}

function _wfDepsOpts(stages, selectedId, excludeId) {
  return stages
    .filter(s => s.id !== excludeId)
    .map(s => `<option value="${s.id}" ${selectedId === s.id ? 'selected' : ''}>${s.stage_order}. ${s.name}</option>`)
    .join('');
}

function openAddStageModal(itemId) {
  const item   = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  const stages    = getItemStages(itemId);
  const nextOrder = stages.length + 1;

  document.getElementById('modal-box').innerHTML = `
    <div style="padding:24px;overflow-y:auto;max-height:80vh">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="font-size:15px;font-weight:700">Добавить этап</div>
        <button class="mn-close-btn" onclick="closeModal()" style="position:static">${iconSvg('x', 13)}</button>
      </div>
      <div class="form-group">
        <label class="form-label">Название этапа *</label>
        <input id="wf-stage-name" class="form-input" type="text" placeholder="Напр.: Сварка рамы, Покраска...">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Порядок</label>
          <input id="wf-stage-order" class="form-input" type="number" min="1" value="${nextOrder}">
        </div>
        <div class="form-group">
          <label class="form-label">Плановое кол-во</label>
          <input id="wf-stage-planned" class="form-input" type="number" min="1" value="${item.quantity}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Выполняется после</label>
        <select id="wf-stage-depends" class="form-input">
          <option value="">— без зависимости (параллельно) —</option>
          ${_wfDepsOpts(stages, '', '')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Исполнитель</label>
        <select id="wf-stage-assignee" class="form-input">
          <option value="">— не задан —</option>
          ${_wfAssigneeOpts('')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Начало</label>
          <input id="wf-stage-start" class="form-input" type="date">
        </div>
        <div class="form-group">
          <label class="form-label">Окончание</label>
          <input id="wf-stage-end" class="form-input" type="date" value="${item.deadline || ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Комментарий</label>
        <textarea id="wf-stage-comment" class="form-textarea" placeholder="Необязательно..."></textarea>
      </div>
      <div style="margin-bottom:16px;display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="wf-stage-required" checked style="width:16px;height:16px;cursor:pointer">
        <label for="wf-stage-required" style="font-size:13px;cursor:pointer">Обязательный этап (влияет на прогресс)</label>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn-secondary" onclick="closeModal()">Отмена</button>
        <button class="btn-primary" onclick="saveStage('${itemId}',null)">${iconSvg('plus', 12)} Добавить</button>
      </div>
    </div>`;
  document.getElementById('modal-overlay').classList.add('open');
}
window.openAddStageModal = openAddStageModal;

function openEditStageModal(stageId, itemId) {
  const item   = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  const stages = _workflowStages[itemId] || [];
  const stage  = stages.find(s => s.id === stageId);
  if (!stage) return;

  const currentDep = (stage.depends_on || [])[0] || '';
  const statusOpts = [
    ['pending',     'Ожидает'],
    ['in_progress', 'В работе'],
    ['done',        'Готово'],
    ['blocked',     'Заблокировано'],
  ].map(([v, l]) => `<option value="${v}" ${stage.status === v ? 'selected' : ''}>${l}</option>`).join('');

  document.getElementById('modal-box').innerHTML = `
    <div style="padding:24px;overflow-y:auto;max-height:80vh">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="font-size:15px;font-weight:700">Редактировать этап</div>
        <button class="mn-close-btn" onclick="closeModal()" style="position:static">${iconSvg('x', 13)}</button>
      </div>
      <div class="form-group">
        <label class="form-label">Название этапа *</label>
        <input id="wf-stage-name" class="form-input" type="text" value="${stage.name.replace(/"/g, '&quot;')}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Порядок</label>
          <input id="wf-stage-order" class="form-input" type="number" min="1" value="${stage.stage_order}">
        </div>
        <div class="form-group">
          <label class="form-label">Плановое кол-во</label>
          <input id="wf-stage-planned" class="form-input" type="number" min="1" value="${stage.planned_qty}">
        </div>
        <div class="form-group">
          <label class="form-label">Статус</label>
          <select id="wf-stage-status" class="form-input">${statusOpts}</select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Выполняется после</label>
        <select id="wf-stage-depends" class="form-input">
          <option value="">— без зависимости (параллельно) —</option>
          ${_wfDepsOpts(getItemStages(itemId), currentDep, stageId)}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Исполнитель</label>
        <select id="wf-stage-assignee" class="form-input">
          <option value="">— не задан —</option>
          ${_wfAssigneeOpts(stage.assignee || '')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Начало</label>
          <input id="wf-stage-start" class="form-input" type="date" value="${stage.start_date || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Окончание</label>
          <input id="wf-stage-end" class="form-input" type="date" value="${stage.end_date || ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Комментарий</label>
        <textarea id="wf-stage-comment" class="form-textarea">${stage.comment || ''}</textarea>
      </div>
      <div style="margin-bottom:16px;display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="wf-stage-required" ${stage.required ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer">
        <label for="wf-stage-required" style="font-size:13px;cursor:pointer">Обязательный этап (влияет на прогресс)</label>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn-secondary" onclick="closeModal()">Отмена</button>
        <button class="btn-primary" onclick="saveStage('${itemId}','${stageId}')">${iconSvg('save', 12)} Сохранить</button>
      </div>
    </div>`;
  document.getElementById('modal-overlay').classList.add('open');
}
window.openEditStageModal = openEditStageModal;

function saveStage(itemId, stageId) {
  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  const name     = document.getElementById('wf-stage-name')?.value?.trim();
  if (!name) { showToast('Введите название этапа'); return; }

  const order    = parseInt(document.getElementById('wf-stage-order')?.value)   || 1;
  const planned  = parseInt(document.getElementById('wf-stage-planned')?.value) || item.quantity;
  const depVal   = document.getElementById('wf-stage-depends')?.value || '';
  const dependsOn = depVal ? [depVal] : [];
  const assignee = document.getElementById('wf-stage-assignee')?.value || '';
  const start    = document.getElementById('wf-stage-start')?.value   || null;
  const endDate  = document.getElementById('wf-stage-end')?.value     || null;
  const comment  = document.getElementById('wf-stage-comment')?.value?.trim() || '';
  const required = document.getElementById('wf-stage-required')?.checked ?? true;
  const status   = document.getElementById('wf-stage-status')?.value  || 'pending';

  if (!_workflowStages[itemId]) _workflowStages[itemId] = [];
  const stages = _workflowStages[itemId];

  if (stageId) {
    const s = stages.find(x => x.id === stageId);
    if (!s) return;
    s.name = name; s.stage_order = order; s.planned_qty = planned;
    s.depends_on = dependsOn;
    s.assignee = assignee; s.start_date = start; s.end_date = endDate;
    s.comment = comment; s.required = required; s.status = status;
    saveStageToStorage(s);
  } else {
    const newStage = {
      id:         `stage_${itemId}_${Date.now()}`,
      item_id:    itemId,
      project_id: item.projectId,
      name, stage_order: order, planned_qty: planned, done_qty: 0,
      assignee, status: 'pending',
      comment, start_date: start, end_date: endDate,
      priority: 2, required, depends_on: dependsOn, history: [],
      created_at: new Date().toISOString(),
    };
    stages.push(newStage);
    saveStageToStorage(newStage);
  }

  syncV2ItemDoneCount(itemId);
  closeModal();
  showToast(stageId ? 'Этап обновлён' : 'Этап добавлен');
  render();
}
window.saveStage = saveStage;

function deleteStage(stageId, itemId) {
  if (!confirm('Удалить этот этап?')) return;
  const stages = _workflowStages[itemId];
  if (!stages) return;
  const idx = stages.findIndex(s => s.id === stageId);
  if (idx < 0) return;
  stages.splice(idx, 1);
  if (_sb) {
    (async () => {
      try { await _sb.from('workflow_stages').delete().eq('id', stageId); } catch(e) { console.error(e); }
    })();
  }
  syncV2ItemDoneCount(itemId);
  showToast('Этап удалён');
  render();
}
window.deleteStage = deleteStage;

function updateStageDone(stageId, itemId, value) {
  const stages = _workflowStages[itemId];
  if (!stages) return;
  const stage = stages.find(s => s.id === stageId);
  if (!stage) return;
  const val = Math.max(0, Math.min(stage.planned_qty, parseInt(value) || 0));
  stage.done_qty = val;
  if (val >= stage.planned_qty && stage.planned_qty > 0) stage.status = 'done';
  else if (val > 0) stage.status = 'in_progress';
  else if (stage.status === 'done') stage.status = 'pending';
  saveStageToStorage(stage);
  syncV2ItemDoneCount(itemId);
  render();
}
window.updateStageDone = updateStageDone;

// =============================================================
// COMPONENTS - СОСТАВ ИЗДЕЛИЯ ПО КД
// =============================================================
function _compModalHtml(title, saveCall, c) {
  return `
    <div style="padding:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px">
        <div style="font-size:16px;font-weight:700;color:var(--gray-900)">${title}</div>
        <button class="modal-close" onclick="closeModal()">${iconSvg('x',14)}</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div>
          <label class="mn-label">Наименование *</label>
          <input id="comp-name" class="mn-input" type="text" value="${c.name || ''}" placeholder="Узел, деталь, материал..." autocomplete="off">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <div>
            <label class="mn-label">Количество *</label>
            <input id="comp-qty" class="mn-input" type="number" min="0" step="0.001" value="${c.quantity ?? ''}">
          </div>
          <div>
            <label class="mn-label">Готово</label>
            <input id="comp-done" class="mn-input" type="number" min="0" step="0.001" value="${c.done ?? 0}" placeholder="0">
          </div>
          <div>
            <label class="mn-label">Единица</label>
            <input id="comp-unit" class="mn-input" type="text" value="${c.unit || ''}" placeholder="шт, м, кг...">
          </div>
        </div>
        <div>
          <label class="mn-label">Примечание</label>
          <input id="comp-notes" class="mn-input" type="text" value="${c.notes || ''}" placeholder="Необязательно">
        </div>
      </div>
      <div style="margin-top:22px;padding-top:14px;border-top:1px solid var(--border)">${saveCall}</div>
    </div>
  `;
}

function openEditCompModal(itemId, compId) {
  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  const comp = item.components.find(c => c.id === compId);
  if (!comp) return;

  const footer = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <button class="btn-primary" onclick="saveComp('${itemId}','${compId}')">${iconSvg('save',13)} Сохранить</button>
      <div style="display:flex;gap:8px">
        <button class="btn-secondary" onclick="closeModal()">Отмена</button>
        <button class="mn-btn-danger" onclick="deleteComp('${itemId}','${compId}')">${iconSvg('trash',13)} Удалить</button>
      </div>
    </div>`;
  document.getElementById('modal-box').innerHTML = _compModalHtml('Редактировать подпозицию', footer, comp);
  document.getElementById('modal-overlay').classList.add('open');
  requestAnimationFrame(() => document.getElementById('comp-name')?.focus());
}
window.openEditCompModal = openEditCompModal;

function openAddCompModal(itemId) {
  const footer = `
    <div style="display:flex;gap:8px">
      <button class="btn-primary" onclick="saveComp('${itemId}',null)">${iconSvg('plus',13)} Добавить</button>
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
    </div>`;
  document.getElementById('modal-box').innerHTML = _compModalHtml('Добавить подпозицию', footer, {});
  document.getElementById('modal-overlay').classList.add('open');
  requestAnimationFrame(() => document.getElementById('comp-name')?.focus());
}
window.openAddCompModal = openAddCompModal;

function saveComp(itemId, compId) {
  const name  = document.getElementById('comp-name')?.value.trim();
  if (!name) { alert('Введите наименование'); return; }
  const qty   = parseFloat(document.getElementById('comp-qty')?.value);
  if (isNaN(qty) || qty < 0) { alert('Укажите количество'); return; }
  const doneRaw = parseFloat(document.getElementById('comp-done')?.value);
  const done  = isNaN(doneRaw) ? 0 : Math.min(Math.max(0, doneRaw), qty);
  const unit  = document.getElementById('comp-unit')?.value.trim() || '';
  const notes = document.getElementById('comp-notes')?.value.trim() || '';

  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  if (!item.components) item.components = [];
  if (!localEdits[itemId]) localEdits[itemId] = {};

  if (compId) {
    // Редактирование существующего
    const comp = item.components.find(c => c.id === compId);
    if (comp) { comp.name = name; comp.quantity = qty; comp.unit = unit; comp.notes = notes; comp.done = done; }
    if (!localEdits[itemId].components) localEdits[itemId].components = [];
    const ec = localEdits[itemId].components.find(x => x.id === compId);
    if (ec) { ec.name = name; ec.quantity = qty; ec.unit = unit; ec.notes = notes; ec.done = done; }
    else localEdits[itemId].components.push({ id: compId, name, quantity: qty, unit, notes, done });
  } else {
    // Добавление нового
    const newComp = { id: `comp_${Date.now()}`, name, quantity: qty, unit, done, optional: false, notes };
    item.components.push(newComp);
    if (!localEdits[itemId].extraComponents) localEdits[itemId].extraComponents = [];
    localEdits[itemId].extraComponents.push({ ...newComp });
  }

  saveEditsToStorage(itemId);
  closeModal();
  render();
}
window.saveComp = saveComp;

function deleteComp(itemId, compId) {
  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  if (!item.components) item.components = [];
  item.components = item.components.filter(c => c.id !== compId);
  if (!localEdits[itemId]) localEdits[itemId] = {};
  if (!localEdits[itemId].deletedComponents) localEdits[itemId].deletedComponents = [];
  if (!localEdits[itemId].deletedComponents.includes(compId)) localEdits[itemId].deletedComponents.push(compId);
  // Также убрать из extraComponents если это новая подпозиция
  if (localEdits[itemId].extraComponents) {
    localEdits[itemId].extraComponents = localEdits[itemId].extraComponents.filter(c => c.id !== compId);
  }
  saveEditsToStorage(itemId);
  closeModal();
  render();
}
window.deleteComp = deleteComp;

// =============================================================
// MATERIALS - СПЕЦИФИКАЦИЯ МАТЕРИАЛОВ
// =============================================================
function getItemMaterials(itemId) {
  return (_itemMaterials[itemId] || []).slice().sort((a, b) => a.sort_order - b.sort_order);
}

function saveMatToStorage(mat) {
  if (!_sb) return;
  (async () => {
    try {
      await _sb.from('item_materials').upsert({
        id: mat.id, item_id: mat.item_id, project_id: mat.project_id,
        name: mat.name, qty: mat.qty, unit: mat.unit,
        have: mat.have, sort_order: mat.sort_order,
      });
    } catch(e) { console.error('saveMatToStorage error:', e); }
  })();
}

function deleteMatFromStorage(matId) {
  if (!_sb) return;
  (async () => {
    try { await _sb.from('item_materials').delete().eq('id', matId); }
    catch(e) { console.error('deleteMatFromStorage error:', e); }
  })();
}

function toggleMatHave(matId, itemId) {
  const mats = _itemMaterials[itemId];
  if (!mats) return;
  const mat = mats.find(m => m.id === matId);
  if (!mat) return;
  mat.have = !mat.have;
  saveMatToStorage(mat);
  render();
}
window.toggleMatHave = toggleMatHave;

function openAddMatModal(itemId) {
  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  const mats = getItemMaterials(itemId);
  const nextOrder = mats.length > 0 ? Math.max(...mats.map(m => m.sort_order)) + 1 : 0;

  document.getElementById('modal-box').innerHTML = `
    <div style="display:flex;flex-direction:column;max-height:85dvh;overflow:hidden">
      <div class="modal-header">
        <div class="modal-title">Добавить материал</div>
        <button class="modal-close" onclick="closeModal()">${iconSvg('x',14)}</button>
      </div>
      <div class="wh-modal-body" style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="mn-label">Наименование *</label>
          <input id="mat-name" class="mn-input" type="text" placeholder="Труба 40×40×3 AISI304" autocomplete="off">
        </div>
        <div class="wh-grid2">
          <div>
            <label class="mn-label">Количество</label>
            <input id="mat-qty" class="mn-input" type="number" step="0.001" min="0" placeholder="64.39">
          </div>
          <div>
            <label class="mn-label">Единица</label>
            <input id="mat-unit" class="mn-input" type="text" placeholder="м / шт. / кг / кв.м">
          </div>
        </div>
        <div>
          <label class="mn-label">В наличии</label>
          <div style="display:flex;gap:8px;margin-top:6px">
            <label class="mat-radio-label mat-radio-active" id="mat-have-no-lbl">
              <input type="radio" name="mat-have" value="0" checked onchange="document.getElementById('mat-have-no-lbl').classList.add('mat-radio-active');document.getElementById('mat-have-yes-lbl').classList.remove('mat-radio-active')">
              Нет
            </label>
            <label class="mat-radio-label" id="mat-have-yes-lbl">
              <input type="radio" name="mat-have" value="1" onchange="document.getElementById('mat-have-yes-lbl').classList.add('mat-radio-active');document.getElementById('mat-have-no-lbl').classList.remove('mat-radio-active')">
              Есть
            </label>
          </div>
        </div>
        <div>
          <label class="mn-label">Примечание</label>
          <textarea id="mat-notes" class="mn-input" rows="2" placeholder="Поставщик, артикул, комментарий..." style="resize:vertical"></textarea>
        </div>
        <input type="hidden" id="mat-sort-order" value="${nextOrder}">
      </div>
      <div class="wh-modal-footer">
        <button class="btn-primary" onclick="saveMat('${itemId}', null)">Добавить</button>
        <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      </div>
    </div>
  `;
  document.getElementById('modal-overlay').classList.add('open');
  requestAnimationFrame(() => document.getElementById('mat-name')?.focus());
}
window.openAddMatModal = openAddMatModal;

function openEditMatModal(matId, itemId) {
  const mats = _itemMaterials[itemId];
  if (!mats) return;
  const mat = mats.find(m => m.id === matId);
  if (!mat) return;

  document.getElementById('modal-box').innerHTML = `
    <div style="display:flex;flex-direction:column;max-height:85dvh;overflow:hidden">
      <div class="modal-header">
        <div class="modal-title">Редактировать материал</div>
        <button class="modal-close" onclick="closeModal()">${iconSvg('x',14)}</button>
      </div>
      <div class="wh-modal-body" style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="mn-label">Наименование *</label>
          <input id="mat-name" class="mn-input" type="text" value="${mat.name}" autocomplete="off">
        </div>
        <div class="wh-grid2">
          <div>
            <label class="mn-label">Количество</label>
            <input id="mat-qty" class="mn-input" type="number" step="0.001" min="0" value="${mat.qty ?? ''}">
          </div>
          <div>
            <label class="mn-label">Единица</label>
            <input id="mat-unit" class="mn-input" type="text" value="${mat.unit ?? ''}">
          </div>
        </div>
        <div>
          <label class="mn-label">В наличии</label>
          <div style="display:flex;gap:8px;margin-top:6px">
            <label class="mat-radio-label${!mat.have ? ' mat-radio-active' : ''}" id="mat-have-no-lbl">
              <input type="radio" name="mat-have" value="0" ${!mat.have ? 'checked' : ''} onchange="document.getElementById('mat-have-no-lbl').classList.add('mat-radio-active');document.getElementById('mat-have-yes-lbl').classList.remove('mat-radio-active')">
              Нет
            </label>
            <label class="mat-radio-label${mat.have ? ' mat-radio-active' : ''}" id="mat-have-yes-lbl">
              <input type="radio" name="mat-have" value="1" ${mat.have ? 'checked' : ''} onchange="document.getElementById('mat-have-yes-lbl').classList.add('mat-radio-active');document.getElementById('mat-have-no-lbl').classList.remove('mat-radio-active')">
              Есть
            </label>
          </div>
        </div>
        <div>
          <label class="mn-label">Примечание</label>
          <textarea id="mat-notes" class="mn-input" rows="2" style="resize:vertical">${mat.notes ?? ''}</textarea>
        </div>
        <input type="hidden" id="mat-sort-order" value="${mat.sort_order}">
      </div>
      <div class="wh-modal-footer">
        <button class="btn-primary" onclick="saveMat('${itemId}', '${matId}')">Сохранить</button>
        <div style="display:flex;gap:8px">
          <button class="btn-secondary" onclick="closeModal()">Отмена</button>
          <button class="mn-btn-danger" onclick="deleteMat('${matId}','${itemId}')">Удалить</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modal-overlay').classList.add('open');
  requestAnimationFrame(() => document.getElementById('mat-name')?.focus());
}
window.openEditMatModal = openEditMatModal;

function saveMat(itemId, matId) {
  const name = document.getElementById('mat-name')?.value.trim();
  if (!name) { alert('Введите наименование материала'); return; }
  const qty       = parseFloat(document.getElementById('mat-qty')?.value) || null;
  const unit      = document.getElementById('mat-unit')?.value.trim() || null;
  const notes     = document.getElementById('mat-notes')?.value.trim() || null;
  const haveVal   = document.querySelector('input[name="mat-have"]:checked')?.value;
  const have      = haveVal === '1';
  const sortOrder = parseInt(document.getElementById('mat-sort-order')?.value) || 0;
  const item      = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  if (matId) {
    const mat = (_itemMaterials[itemId] || []).find(m => m.id === matId);
    if (!mat) return;
    mat.name = name; mat.qty = qty; mat.unit = unit; mat.have = have; mat.notes = notes;
    saveMatToStorage(mat);
  } else {
    const newMat = {
      id: `mat_${itemId}_${Date.now()}`,
      item_id: itemId,
      project_id: item.projectId,
      name, qty, unit, have, notes,
      sort_order: sortOrder,
      created_at: new Date().toISOString(),
    };
    if (!_itemMaterials[itemId]) _itemMaterials[itemId] = [];
    _itemMaterials[itemId].push(newMat);
    saveMatToStorage(newMat);
  }
  closeModal();
  render();
}
window.saveMat = saveMat;

function deleteMat(matId, itemId) {
  if (!_itemMaterials[itemId]) return;
  _itemMaterials[itemId] = _itemMaterials[itemId].filter(m => m.id !== matId);
  deleteMatFromStorage(matId);
  closeModal();
  render();
}
window.deleteMat = deleteMat;

function renderMaterialsSection(item) {
  const mats  = getItemMaterials(item.id);
  const total = mats.length;
  const haveC = mats.filter(m => m.have).length;
  const pct   = total > 0 ? Math.round(haveC / total * 100) : 0;
  const pctColor = pct === 100 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';

  const rows = mats.map(m => `
    <tr class="mat-row" onclick="openEditMatModal('${m.id}','${item.id}')">
      <td>
        <button class="mat-toggle ${m.have ? 'mat-toggle-have' : 'mat-toggle-no'}"
          onclick="event.stopPropagation();toggleMatHave('${m.id}','${item.id}')"
          title="${m.have ? 'Есть в наличии - нажмите чтобы отметить отсутствующим' : 'Нет в наличии - нажмите чтобы отметить как имеющийся'}">
          ${m.have ? iconSvg('check', 12) : iconSvg('minus', 12)}
        </button>
      </td>
      <td class="mat-name">${m.name}</td>
      <td class="mat-qty">${m.qty != null ? m.qty : '—'}</td>
      <td class="mat-unit">${m.unit || '—'}</td>
      <td>
        <span class="mat-status-chip ${m.have ? 'mat-status-have' : 'mat-status-no'}">
          ${m.have ? 'Есть' : 'Нет'}
        </span>
      </td>
    </tr>`).join('');

  return `
    <div class="card mat-section" style="padding:20px 24px;margin-top:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:10px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.08em">${iconSvg('list',12)} Спецификация материалов</span>
          ${total > 0 ? `<span style="font-size:11px;font-weight:700;color:${pctColor}">${haveC} / ${total} в наличии</span>` : ''}
        </div>
        <button class="btn-secondary" style="display:inline-flex;align-items:center;gap:5px;font-size:12px" onclick="openAddMatModal('${item.id}')">
          ${iconSvg('plus',11)} Добавить материал
        </button>
      </div>

      ${total > 0 ? `
        <div class="mat-progress-bar" style="margin-bottom:14px">
          <div class="mat-progress-fill" style="width:${pct}%;background:${pctColor}"></div>
        </div>

        <div style="overflow-x:auto">
          <table class="mat-table">
            <thead>
              <tr>
                <th style="width:36px"></th>
                <th>Наименование</th>
                <th style="width:80px;text-align:right">Кол-во</th>
                <th style="width:60px">Ед.</th>
                <th style="width:72px;text-align:center">Наличие</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      ` : `
        <div style="padding:20px 0;text-align:center;color:var(--gray-400);font-size:13px">
          Спецификация пуста. Добавьте материалы вручную.
        </div>
      `}
    </div>`;
}

// =============================================================
// EVENTS - СТРАНИЦА СОБЫТИЙ
// =============================================================
const EV_TYPES = {
  custom:   { label: 'Событие',  color: '#6366F1', bg: '#EEF2FF' },
  deadline: { label: 'Дедлайн',  color: '#EF4444', bg: '#FEF2F2' },
  delivery: { label: 'Поставка', color: '#3B82F6', bg: '#EFF6FF' },
  payment:  { label: 'Оплата',   color: '#F59E0B', bg: '#FFFBEB' },
  shipment: { label: 'Отгрузка', color: '#10B981', bg: '#ECFDF5' },
};

function _getAutoEvents() {
  const evs = [];
  // Дедлайны проектов
  VRH_PROJECTS.forEach(p => {
    if (!p.deadline) return;
    evs.push({ id: `auto_proj_${p.id}`, title: `Дедлайн проекта: ${p.name}`,
      event_date: p.deadline, type: 'deadline', auto: true,
      item_id: null, project_id: p.id, done: false });
  });
  // Ожидаемые поставки
  VRH_ITEMS.forEach(item => {
    if (!item.expected_delivery) return;
    const isDone = item.purchaseStatus === PUR.RECEIVED || item.materialsStatus === PUR.RECEIVED;
    evs.push({ id: `auto_del_${item.id}`, title: `${item.nameShort} - поставка`,
      event_date: item.expected_delivery, type: 'delivery', auto: true,
      item_id: item.id, project_id: item.projectId, done: isDone });
  });
  // Даты оплаты
  VRH_ITEMS.forEach(item => {
    if (!item.payment_date) return;
    evs.push({ id: `auto_pay_${item.id}`, title: `${item.nameShort} - оплата`,
      event_date: item.payment_date, type: 'payment', auto: true,
      item_id: item.id, project_id: item.projectId, done: item.payment_status === 'paid' });
  });
  return evs;
}

function _getAllEvents() {
  return [..._getAutoEvents(), ..._events]
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
}

function _updateEventsBadge() {
  const badge = document.getElementById('events-badge');
  if (!badge) return;
  const urgent = _getAllEvents().filter(e => !e.done && daysOverdue(e.event_date) >= -7).length;
  badge.textContent = urgent;
  badge.style.display = urgent > 0 ? '' : 'none';
  // Синхронизируем бейдж в меню «Ещё»
  const moreBadge = document.getElementById('more-events-badge');
  if (moreBadge) {
    moreBadge.textContent = urgent;
    moreBadge.style.display = urgent > 0 ? 'inline-flex' : 'none';
  }
  _updateMoreBtnDot();
}

function saveEventToStorage(ev) {
  if (!_sb || ev.auto) return;
  (async () => {
    try {
      await _sb.from('events').upsert({
        id: ev.id, item_id: ev.item_id || null, project_id: ev.project_id || null,
        title: ev.title, event_date: ev.event_date, type: ev.type, done: ev.done,
        comment: ev.comment || null,
      });
    } catch(e) { console.error('saveEventToStorage error:', e); }
  })();
}

function deleteEventFromStorage(evId) {
  if (!_sb) return;
  (async () => {
    try { await _sb.from('events').delete().eq('id', evId); }
    catch(e) { console.error('deleteEventFromStorage error:', e); }
  })();
}

function toggleEventDone(evId) {
  const ev = _events.find(e => e.id === evId);
  if (!ev) return;
  ev.done = !ev.done;
  saveEventToStorage(ev);
  render();
}
window.toggleEventDone = toggleEventDone;

function deleteEvent(evId) {
  _events = _events.filter(e => e.id !== evId);
  deleteEventFromStorage(evId);
  closeModal();
  render();
}
window.deleteEvent = deleteEvent;

function _evModalHtml(title, evId, prefill) {
  const todayStr  = new Date().toISOString().slice(0, 10);
  const curType   = prefill.type || 'custom';
  const curItemId = prefill.item_id || '';
  const typeChips = Object.entries(EV_TYPES).map(([k, v]) => `
    <label class="ev-type-radio ${k === curType ? 'ev-type-radio-active' : ''}" id="ev-type-lbl-${k}"
      style="${k === curType ? `background:${v.bg};border-color:${v.color};color:${v.color}` : ''}">
      <input type="radio" name="ev-type-radio" value="${k}" ${k === curType ? 'checked' : ''}
        onchange="document.querySelectorAll('.ev-type-radio').forEach(l=>{l.classList.remove('ev-type-radio-active');l.removeAttribute('style')});this.parentElement.classList.add('ev-type-radio-active');this.parentElement.style.background='${v.bg}';this.parentElement.style.borderColor='${v.color}';this.parentElement.style.color='${v.color}'">
      ${v.label}
    </label>`).join('');
  const itemOptions = VRH_ITEMS.map(i =>
    `<option value="${i.id}" ${i.id === curItemId ? 'selected' : ''}>[${getComplexAbbr(i.complexId)}] ${i.nameShort}</option>`
  ).join('');
  const saveCall = evId ? `saveEvent('${evId}')` : `saveEvent(null)`;
  const footer = evId
    ? `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
         <button class="btn-primary" onclick="${saveCall}">${iconSvg('save',13)} Сохранить</button>
         <div style="display:flex;gap:8px">
           <button class="btn-secondary" onclick="closeModal()">Отмена</button>
           <button class="mn-btn-danger" onclick="deleteEvent('${evId}')">${iconSvg('trash',13)} Удалить</button>
         </div>
       </div>`
    : `<div style="display:flex;gap:8px">
         <button class="btn-primary" onclick="${saveCall}">${iconSvg('plus',13)} Добавить</button>
         <button class="btn-secondary" onclick="closeModal()">Отмена</button>
       </div>`;

  return `
    <div style="padding:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px">
        <div style="font-size:16px;font-weight:700;color:var(--gray-900)">${title}</div>
        <button class="modal-close" onclick="closeModal()">${iconSvg('x',14)}</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:18px">
        <div>
          <label class="mn-label">Название *</label>
          <input id="ev-title" class="mn-input" type="text"
            value="${prefill.title || ''}"
            placeholder="Напр.: Забор груза поляки, оплата счёта, встреча..."
            autocomplete="off">
        </div>

        <div>
          <label class="mn-label">Дата *</label>
          <input id="ev-date" class="mn-input" type="date"
            value="${prefill.event_date || todayStr}"
            style="max-width:200px">
        </div>

        <div>
          <label class="mn-label">Тип события</label>
          <div class="ev-type-chips" id="ev-type-chips">${typeChips}</div>
        </div>

        <div>
          <label class="mn-label">Связать с позицией <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--gray-400)">(необязательно)</span></label>
          <select id="ev-item-id" class="mn-input">
            <option value="">— не привязано —</option>
            ${itemOptions}
          </select>
        </div>

        <div>
          <label class="mn-label">Комментарий <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--gray-400)">(необязательно)</span></label>
          <textarea id="ev-comment" class="mn-input" rows="2"
            placeholder="Дополнительные сведения..."
            style="resize:vertical;min-height:60px">${prefill.comment || ''}</textarea>
        </div>
      </div>

      <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border)">${footer}</div>
    </div>
  `;
}

function openAddEventModal(prefillDate) {
  document.getElementById('modal-box').innerHTML = _evModalHtml(
    'Добавить событие', null, { event_date: prefillDate }
  );
  document.getElementById('modal-overlay').classList.add('open');
  requestAnimationFrame(() => document.getElementById('ev-title')?.focus());
}
window.openAddEventModal = openAddEventModal;

function openEditEventModal(evId) {
  const ev = _events.find(e => e.id === evId);
  if (!ev) return;
  document.getElementById('modal-box').innerHTML = _evModalHtml(
    'Редактировать событие', evId, ev
  );
  document.getElementById('modal-overlay').classList.add('open');
  requestAnimationFrame(() => document.getElementById('ev-title')?.focus());
}
window.openEditEventModal = openEditEventModal;

function saveEvent(evId) {
  const title = document.getElementById('ev-title')?.value.trim();
  if (!title) { alert('Введите название события'); return; }
  const date    = document.getElementById('ev-date')?.value;
  if (!date)  { alert('Укажите дату'); return; }
  const type    = document.querySelector('input[name="ev-type-radio"]:checked')?.value || 'custom';
  const itemId  = document.getElementById('ev-item-id')?.value || null;
  const comment = document.getElementById('ev-comment')?.value.trim() || null;
  const item    = itemId ? VRH_ITEMS.find(i => i.id === itemId) : null;
  const projId  = item ? item.projectId : null;

  if (evId) {
    const ev = _events.find(e => e.id === evId);
    if (!ev) return;
    ev.title = title; ev.event_date = date; ev.type = type;
    ev.item_id = itemId; ev.project_id = projId; ev.comment = comment;
    saveEventToStorage(ev);
  } else {
    const newEv = {
      id: `ev_${Date.now()}`, title, event_date: date, type,
      item_id: itemId, project_id: projId, comment, done: false,
      created_at: new Date().toISOString(),
    };
    _events.push(newEv);
    saveEventToStorage(newEv);
  }
  closeModal();
  render();
}
window.saveEvent = saveEvent;

function renderEvents(el) {
  const all = _getAllEvents();

  const overdue = all.filter(e => !e.done && daysOverdue(e.event_date) > 0);
  const todayEv = all.filter(e => !e.done && daysOverdue(e.event_date) === 0);
  const weekEv  = all.filter(e => !e.done && daysOverdue(e.event_date) < 0 && daysOverdue(e.event_date) >= -7);
  const monthEv = all.filter(e => !e.done && daysOverdue(e.event_date) < -7 && daysOverdue(e.event_date) >= -30);
  const laterEv = all.filter(e => !e.done && daysOverdue(e.event_date) < -30);
  const doneEv  = all.filter(e => e.done);

  function evCard(ev) {
    const t     = EV_TYPES[ev.type] || EV_TYPES.custom;
    const od    = daysOverdue(ev.event_date);
    const dateColor = od > 0 ? '#EF4444' : od === 0 ? '#10B981' : 'var(--gray-500)';
    const linked = ev.item_id ? VRH_ITEMS.find(i => i.id === ev.item_id) : null;
    const proj   = ev.project_id ? VRH_PROJECTS.find(p => p.id === ev.project_id) : null;
    const editBtn = ev.auto ? '' :
      `<button class="ev-btn-edit" onclick="openEditEventModal('${ev.id}')" title="Редактировать">${iconSvg('edit',12)}</button>`;
    const doneBtn = ev.auto ? '' :
      `<button class="ev-btn-done ${ev.done ? 'ev-btn-done-active' : ''}" onclick="toggleEventDone('${ev.id}')" title="${ev.done ? 'Отметить активным' : 'Отметить завершённым'}">${iconSvg('check',12)}</button>`;
    const linkPart = linked
      ? `<span class="ev-link" onclick="navigate('item','${linked.projectId}','${linked.id}')">${iconSvg('list',10)} ${linked.nameShort}</span>`
      : proj ? `<span class="ev-meta-proj">${proj.name}</span>` : '';
    const odText = od > 0 ? `<span class="ev-overdue-text">Просрочено ${od} дн.</span>` : '';

    return `
      <div class="ev-card ${ev.done ? 'ev-card-done' : ''}" style="border-left-color:${t.color}">
        <div class="ev-date-col">
          <span class="ev-date" style="color:${dateColor}">${formatDateShort(ev.event_date)}</span>
          ${odText}
        </div>
        <div class="ev-body">
          <div class="ev-title">${ev.title}</div>
          ${ev.comment ? `<div class="ev-comment">${ev.comment}</div>` : ''}
          <div class="ev-meta">
            <span class="ev-type-chip" style="color:${t.color};background:${t.bg}">${t.label}</span>
            ${linkPart}
          </div>
        </div>
        <div class="ev-actions">${doneBtn}${editBtn}</div>
      </div>`;
  }

  function group(label, evs, color) {
    if (!evs.length) return '';
    return `
      <div class="ev-group">
        <div class="ev-group-label" style="color:${color}">${label} <span class="ev-group-count">${evs.length}</span></div>
        ${evs.map(evCard).join('')}
      </div>`;
  }

  el.innerHTML = `
    <div class="ev-wrap">
      <div class="ev-topbar">
        <div>
          <div style="font-size:20px;font-weight:800;color:var(--gray-900)">События</div>
          <div style="font-size:12px;color:var(--gray-400);margin-top:2px">${formatDate(new Date())} · ${all.filter(e=>!e.done).length} активных</div>
        </div>
        <button class="btn-primary" style="display:inline-flex;align-items:center;gap:6px" onclick="openAddEventModal()">
          ${iconSvg('plus',13)} Добавить событие
        </button>
      </div>

      ${!all.length ? `
        <div class="ev-empty">
          ${iconSvg('calendar',28)}
          <div>Событий пока нет</div>
          <div style="font-size:12px;color:var(--gray-400);margin-top:4px">Добавьте событие - дедлайн, поставку, напоминание</div>
        </div>` : `
        ${group('Просроченные', overdue, '#EF4444')}
        ${group('Сегодня', todayEv, '#10B981')}
        ${group('Эта неделя', weekEv, '#3B82F6')}
        ${group('В течение месяца', monthEv, 'var(--gray-500)')}
        ${group('Позже', laterEv, 'var(--gray-400)')}
        ${doneEv.length ? `
          <details class="ev-done-section">
            <summary class="ev-group-label" style="color:var(--gray-300);cursor:pointer">
              Завершённые <span class="ev-group-count">${doneEv.length}</span>
            </summary>
            ${doneEv.map(evCard).join('')}
          </details>` : ''}
      `}
    </div>
  `;
}

// =============================================================
// FILTER
// =============================================================
let _searchTimer = null;
function setFilter(key, value) {
  state.filter[key] = value;
  if (key === 'search') {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(render, 250);
  } else {
    render();
  }
}
window.setFilter = setFilter;

// =============================================================
// UI HELPERS
// =============================================================
function statusBadge(status) {
  const map = {
    done:        ['badge-done',        'Готово'],
    in_progress: ['badge-in_progress', 'В работе'],
    overdue:     ['badge-overdue',     'Просрочено'],
    pending:     ['badge-pending',     'Ожидает'],
    blocked:     ['badge-blocked',     'Заблокировано'],
  };
  const [cls, label] = map[status] || ['badge-pending', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

// Pill для CSS Grid-таблицы (фиксированный размер, единая ширина)
function statusPill(status) {
  const map = {
    done:        ['sp-done',        'Готово'],
    in_progress: ['sp-in_progress', 'В работе'],
    overdue:     ['sp-overdue',     'Просрочено'],
    pending:     ['sp-pending',     'Ожидает'],
    blocked:     ['sp-blocked',     'Заблок.'],
  };
  const [cls, label] = map[status] || ['sp-pending', status];
  return `<span class="status-pill ${cls}">${label}</span>`;
}

function progressCircle(pct, size = 100) {
  const r             = size * 0.4;
  const circumference = 2 * Math.PI * r;
  const offset        = circumference - (pct / 100) * circumference;
  const color         = pct >= 80 ? '#10B981' : pct >= 50 ? '#0EA5E9' : pct >= 25 ? '#F59E0B' : '#EF4444';
  const fontSize      = size > 80 ? 18 : 14;
  return `
    <div class="progress-circle-wrap" style="width:${size}px;height:${size}px">
      <svg class="progress-circle" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle class="progress-circle-bg" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${size*0.08}"/>
        <circle class="progress-circle-fill" cx="${size/2}" cy="${size/2}" r="${r}"
          stroke="${color}" stroke-width="${size*0.08}"
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
      </svg>
      <div class="progress-circle-text" style="font-size:${fontSize}px">
        <span>${pct}%</span>
      </div>
    </div>`;
}

function pctColor(pct) {
  if (pct >= 80) return '#10B981';
  if (pct >= 50) return '#0EA5E9';
  if (pct >= 25) return '#F59E0B';
  return '#EF4444';
}

function pbarClass(pct) {
  if (pct >= 80) return 'pbar-green';
  if (pct >= 50) return 'pbar-blue';
  if (pct >= 25) return 'pbar-amber';
  return 'pbar-red';
}

function formatDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return '—';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// Expose globals
window.navigate          = navigate;
window.showNotifications = () => navigate('problems');
