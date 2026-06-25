'use strict';
// =============================================================
// VRH Production OS — Application v3.0
// Новая модель: Изделие → Компоненты → История
// =============================================================

const APP_BUILD = 'DEPLOY #039';

// ── State ──────────────────────────────────────────────────────
const state = {
  view: 'dashboard',
  projectId: null,
  itemId: null,
  filter: { complex: 'all', status: 'all', search: '' },
};

let localEdits = {};

// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadEditsFromStorage();
  applyEdits();
  setupNavigation();
  handleHash();
  updateProblemsBadge();
  const badge = document.querySelector('.deploy-badge');
  if (badge) badge.textContent = APP_BUILD;
});
window.addEventListener('hashchange', handleHash);

// ── Router ──────────────────────────────────────────────────────
function handleHash() {
  const hash  = window.location.hash.replace('#', '') || 'dashboard';
  const parts = hash.split('/');
  state.view      = parts[0] || 'dashboard';
  state.projectId = parts[1] || null;
  state.itemId    = parts[2] || null;
  render();
  updateActiveNav();
  window.scrollTo(0, 0);
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
      (state.view === 'project' && el.dataset.nav === 'projects') ||
      (state.view === 'item'    && el.dataset.nav === 'projects');
    el.classList.toggle('active', isActive);
  });
}

function updateProblemsBadge() {
  const probs = getAllProblems();
  const total = probs.overdue.length + probs.noKd.length + probs.blocked.length;
  const badge = document.getElementById('problems-badge');
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-block' : 'none';
  }
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

// ── Master Render ───────────────────────────────────────────────
function render() {
  const content = document.getElementById('content');
  if (!content) return;
  content.classList.remove('fade-in');
  void content.offsetWidth;
  content.classList.add('fade-in');

  switch (state.view) {
    case 'dashboard': renderDashboard(content); setBreadcrumb('Обзор');    break;
    case 'projects':  renderProjects(content);  setBreadcrumb('Проекты');    break;
    case 'project':   renderProject(content, state.projectId);               break;
    case 'item':      renderItem(content, state.projectId, state.itemId);    break;
    case 'problems':  renderProblems(content);  setBreadcrumb('Проблемы');   break;
    case 'ai':        renderAI(content);        setBreadcrumb('AI-помощник'); break;
    default: navigate('dashboard');
  }
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
    <div class="section-header">
      <div>
        <div class="section-title">Обзор производства</div>
        <div class="section-sub">ООО «ВРХ Инжиниринг» · ${formatDate(TODAY)}</div>
      </div>
    </div>

    <div class="stats-grid">
      ${statCard(VRH_PROJECTS.length, 'Проектов', 'Активных проектов', 'blue', 'folder')}
      ${statCard(stats.total, 'Позиций', 'Единиц оборудования', '', 'list')}
      ${statCard(stats.inProg, 'В работе', 'Активных позиций', '', 'refresh')}
      ${statCard(stats.overdue, 'Просрочено', stats.overdue > 0 ? 'Требует внимания' : 'Всё в норме', stats.overdue > 0 ? 'red' : 'green', 'warning')}
      ${statCard(stats.done, 'Готово', 'Завершённых позиций', 'green', 'check')}
      ${statCard(pct + '%', 'Изготовлено', 'По количеству единиц', 'blue', 'chart')}
    </div>

    <div class="section-header" style="margin-bottom:14px">
      <div class="section-title">Проекты</div>
      <button class="btn-secondary" onclick="navigate('projects')">Все проекты →</button>
    </div>
    <div class="projects-grid">
      ${VRH_PROJECTS.map(p => projectCard(p)).join('')}
    </div>

    ${renderQuickProblems()}
  `;
}

function statCard(value, label, sub, variant, icon) {
  const iconHtml = icon
    ? `<div class="kpi-icon">${iconSvg(icon, 14)}</div>`
    : '';
  return `
    <div class="kpi-card ${variant}">
      <div class="kpi-header">
        <span class="kpi-label">${label}</span>
        ${iconHtml}
      </div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-sub">${sub}</div>
    </div>`;
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
      <div class="project-card-header">
        <div style="flex:1;min-width:0">
          <div class="project-name">${project.name}</div>
          <div class="project-client">${project.client}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
          <div class="project-pct" style="color:${color}">${pct}%</div>
          <button class="project-delete-btn" title="Удалить проект"
            onclick="event.stopPropagation();confirmDeleteProject('${project.id}')"
            style="width:26px;height:26px;border-radius:4px;border:1px solid var(--gray-200);background:var(--white);color:var(--gray-400);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.15s;flex-shrink:0"
            onmouseover="this.style.background='rgba(227,6,19,0.08)';this.style.borderColor='#EF4444';this.style.color='#EF4444'"
            onmouseout="this.style.background='var(--white)';this.style.borderColor='var(--gray-200)';this.style.color='var(--gray-400)'">
            ${iconSvg('x', 11)}
          </button>
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
    </div>`;
}

function renderQuickProblems() {
  const problems = getAllProblems();
  const total = problems.overdue.length + problems.noKd.length + problems.blocked.length;
  if (!total) return `
    <div style="margin-top:24px;padding:20px 24px;background:rgba(0,179,126,0.07);border:1px solid rgba(0,179,126,0.2);border-radius:6px;display:flex;align-items:center;gap:12px">
      <div style="width:32px;height:32px;border-radius:50%;background:#10B981;display:flex;align-items:center;justify-content:center;flex-shrink:0">${iconSvg('check',16)}</div>
      <div>
        <div style="font-size:13px;font-weight:700;color:#10B981">Критических проблем не обнаружено</div>
        <div style="font-size:11px;color:#A8A8A8;margin-top:2px">Все позиции в штатном режиме</div>
      </div>
    </div>`;

  return `
    <div style="margin-top:24px">
      <div class="section-header" style="margin-bottom:12px">
        <div class="section-title" style="color:#EF4444;display:flex;align-items:center;gap:8px">${iconSvg('warning',18)} Требует внимания</div>
        <button class="btn-secondary" onclick="navigate('problems')">Все проблемы →</button>
      </div>
      <div style="display:grid;gap:8px">
        ${problems.overdue.slice(0,3).map(item => {
          const days = daysOverdue(item.deadline);
          return `
          <div class="problem-item" onclick="navigate('item','${item.projectId}','${item.id}')">
            <div class="problem-item-icon red">${iconSvg('alert',13)}</div>
            <div style="flex:1">
              <div class="problem-item-name">${item.nameShort}</div>
              <div class="problem-item-meta">${getComplexAbbr(item.complexId)} · Просрочено ${days} дн.</div>
            </div>
            <span class="badge badge-overdue">${days} дн.</span>
          </div>`;
        }).join('')}
        ${problems.noKd.slice(0,2).map(item => `
          <div class="problem-item" onclick="navigate('item','${item.projectId}','${item.id}')">
            <div class="problem-item-icon amber">${iconSvg('document',13)}</div>
            <div style="flex:1">
              <div class="problem-item-name">${item.nameShort}</div>
              <div class="problem-item-meta">${getComplexAbbr(item.complexId)} · Нет КД</div>
            </div>
            <span class="badge badge-blocked">Нет КД</span>
          </div>`).join('')}
      </div>
    </div>`;
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
    </div>
    <div class="projects-grid">
      ${VRH_PROJECTS.map(p => projectCard(p)).join('')}
    </div>`;
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
            <button class="btn-secondary proj-delete-btn" onclick="confirmDeleteProject('${project.id}')"
              onmouseover="this.style.background='rgba(227,6,19,0.06)';this.style.borderColor='#EF4444'"
              onmouseout="this.style.background='var(--white)';this.style.borderColor='rgba(227,6,19,0.3)'">
              ${iconSvg('x', 11)} Удалить проект
            </button>
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
          return `<option value="${cid}" ${state.filter.complex===cid?'selected':''}>${c?.abbr || cid} — ${c?.name || cid}</option>`;
        }).join('')}
      </select>
      <select class="filter-select" onchange="setFilter('status',this.value)">
        <option value="all"         ${state.filter.status==='all'        ?'selected':''}>Все статусы</option>
        <option value="in_progress" ${state.filter.status==='in_progress'?'selected':''}>В работе</option>
        <option value="overdue"     ${state.filter.status==='overdue'    ?'selected':''}>Просрочено</option>
        <option value="blocked"     ${state.filter.status==='blocked'    ?'selected':''}>Заблокировано</option>
        <option value="done"        ${state.filter.status==='done'       ?'selected':''}>Готово</option>
      </select>
      <input type="search" class="filter-select" placeholder="Поиск..." value="${state.filter.search||''}"
        oninput="setFilter('search',this.value)" style="padding-right:10px;min-width:140px">
      <span style="font-size:12px;color:var(--gray-400);margin-left:auto">${filtered.length} из ${items.length}</span>
    </div>

    ${complexIds
      .filter(cid => filtered.some(i => i.complexId === cid))
      .map(cid => {
        const cItems = filtered.filter(i => i.complexId === cid);
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
              <div class="items-grid">
                <div class="ig-header">
                  <div class="ig-cell ig-num">№</div>
                  <div class="ig-cell ig-name">Наименование</div>
                  <div class="ig-cell ig-qty">Кол-во</div>
                  <div class="ig-cell ig-done">Готово</div>
                  <div class="ig-cell ig-status">Статус</div>
                  <div class="ig-cell ig-progress">Прогресс</div>
                  <div class="ig-cell ig-deadline">Дедлайн</div>
                </div>
                ${cItems.map(item => itemTableRow(item, projectId)).join('')}
              </div>
            </div>
          </div>`;
      }).join('')}

    ${filtered.length === 0 ? '<div class="empty-state"><p>Нет позиций по выбранным фильтрам</p></div>' : ''}
  `;
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
    <div class="ig-row" onclick="navigate('item','${projectId}','${item.id}')">
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

  // Компоненты (только для 'own' изделий с данными)
  const componentsHtml = (item.type === 'own' && item.components?.length)
    ? renderComponents(item)
    : item.type === 'own'
      ? `<div style="margin-top:16px;padding:14px 16px;background:var(--gray-50);border-radius:4px;border:1px solid var(--gray-200);font-size:12px;color:var(--gray-400);display:flex;align-items:center;gap:6px">${iconSvg('document',12)} Состав по КД не внесён — «Требует уточнения»</div>`
      : renderPurchaseBlock(item);

  // История
  const historyHtml = (item.history?.length)
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

    ${componentsHtml}
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
    </div>
  `;
}

function renderComponents(item) {
  const rows = item.components.map(c => {
    const qty    = c.quantity;
    const done   = c.done;
    const pct    = item.quantity > 0 ? Math.min(100, Math.round(done / qty * 100)) : 0;
    const color  = pctColor(pct);
    const isOpt  = c.optional;
    const isBN   = !isOpt && getBottleneck(item)?.id === c.id && done < qty;

    return `
      <tr style="${isOpt ? 'opacity:0.65' : ''}">
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
        <td style="color:var(--gray-500);font-size:11px">${c.responsible || '—'}</td>
        <td style="color:var(--gray-400);font-size:11px;max-width:200px">${c.notes || ''}</td>
      </tr>`;
  }).join('');

  return `
    <div class="card" style="padding:20px 24px;margin-top:16px">
      <div style="font-size:10px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">
        ${iconSvg('list',12)} Состав изделия по КД
      </div>
      <div style="overflow-x:auto">
        <table class="items-table">
          <thead>
            <tr>
              <th>Узел / компонент</th>
              <th style="text-align:center">Готово / Всего</th>
              <th>Прогресс</th>
              <th style="text-align:center">%</th>
              <th>Ответственный</th>
              <th>Примечание</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
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
        <button class="btn-secondary" onclick="openUpdateModal('${item.id}')" style="font-size:11px">
          ${iconSvg('edit',11)} Изменить статус
        </button>
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
          <strong>${it.name}</strong>${it.detail ? ` — ${it.detail}` : ''}
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
// MODAL: Edit Item (все поля в одном месте)
// =============================================================
function openUpdateModal(itemId) {
  const item = VRH_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  const purOpts = [
    { val: '',            label: '— не указано —' },
    { val: PUR.PENDING,  label: 'Не заказано' },
    { val: PUR.ORDERED,  label: 'Заказано / счёт выставлен' },
    { val: PUR.PARTIAL,  label: 'Получено частично' },
    { val: PUR.RECEIVED, label: 'Получено полностью' },
  ];
  const curPur = item.purchaseStatus || item.materialsStatus || '';
  const nameFull = item.nameFullOverride !== undefined ? item.nameFullOverride : item.name;
  const nameFullOn = item.nameFullEnabled !== false;

  const sec = (label) =>
    `<div style="font-size:10px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">${label}</div>`;
  const div = () =>
    `<div style="height:1px;background:var(--gray-100);margin:18px 0"></div>`;

  // Прогресс — только для 'own'
  let progressSection = '';
  if (item.type === 'own') {
    const hasComp = item.components?.length > 0;
    const compRows = hasComp ? item.components.map(c => `
      <div class="form-group">
        <label class="form-label">${c.name} <span style="color:var(--gray-400);font-weight:400">(из ${c.quantity})</span></label>
        <input type="number" class="form-input" id="comp-${c.id}" min="0" max="${c.quantity}" value="${c.done}" style="margin-top:4px">
      </div>`).join('') : '';
    progressSection = `
      ${div()}
      ${sec('Прогресс')}
      <div class="form-group">
        <label class="form-label">Готово <span style="color:var(--gray-400);font-weight:400">(из ${item.quantity} ${item.unit})</span></label>
        <input type="number" class="form-input" id="modal-done-count" min="0" max="${item.quantity}" value="${item.doneCount || 0}" style="margin-top:4px">
      </div>
      ${hasComp ? `<div style="background:var(--gray-50);border-radius:8px;padding:12px;margin-top:4px">${compRows}</div>` : ''}`;
  }

  document.getElementById('modal-box').innerHTML = `
    <div class="modal-header">
      <div class="modal-title">${iconSvg('edit',14)} Редактировать позицию</div>
      <button class="modal-close" onclick="closeModal()">${iconSvg('x', 12)}</button>
    </div>
    <div class="modal-body">

      ${sec('Наименование')}
      <div class="form-group">
        <label class="form-label">Короткое имя <span style="color:var(--gray-400);font-weight:400">(отображается в таблице)</span></label>
        <input type="text" class="form-input" id="modal-name-short"
          value="${item.nameShort.replace(/"/g,'&quot;')}" style="margin-top:4px">
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label" style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2.5a.75.75 0 110 1.5.75.75 0 010-1.5zM7 7h2v4H7V7z"/></svg>
          Подсказка с полным наименованием
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;margin-bottom:10px">
          <input type="checkbox" id="modal-name-full-enabled" ${nameFullOn ? 'checked' : ''} style="width:15px;height:15px;accent-color:#0EA5E9;cursor:pointer;flex-shrink:0">
          <span style="font-size:13px;color:var(--gray-700)">Показывать иконку подсказки</span>
        </label>
        <textarea class="form-textarea" id="modal-name-full-text" style="min-height:52px;resize:vertical"
          placeholder="Полное наименование для подсказки...">${nameFull.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
      </div>

      ${progressSection}

      ${div()}
      ${sec('Статус')}
      <div class="form-group">
        <label class="form-label">Статус закупки / материалов</label>
        <select class="form-select" id="modal-pur-status" style="margin-top:4px">
          ${purOpts.map(o => `<option value="${o.val}" ${curPur===o.val?'selected':''}>${o.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Дедлайн</label>
        <input type="date" class="form-input" id="modal-deadline" value="${item.deadline}" style="margin-top:4px">
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label" style="display:flex;align-items:center;gap:6px">
          Блокировка
          ${item.blockReason ? `<span class="block-badge-active">АКТИВНА</span>` : ''}
        </label>
        <input type="text" class="form-input" id="modal-block-reason"
          value="${(item.blockReason || '').replace(/"/g,'&quot;')}"
          placeholder="Нет (оставьте пустым чтобы снять блокировку)"
          style="margin-top:4px">
        ${item.blockReason ? `<div style="margin-top:5px;font-size:11px;color:var(--gray-400)">Очистите поле и сохраните — блокировка будет снята</div>` : ''}
      </div>

      ${div()}
      ${sec('Примечание')}
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;margin-bottom:10px">
          <input type="checkbox" id="modal-note-tip-enabled" ${item.noteTipEnabled !== false ? 'checked' : ''} style="width:15px;height:15px;accent-color:#0EA5E9;cursor:pointer;flex-shrink:0">
          <span style="font-size:13px;color:var(--gray-700)">Показывать иконку примечания в таблице</span>
        </label>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <textarea class="form-textarea" id="modal-notes" style="min-height:68px">${item.notes || ''}</textarea>
      </div>

      <button class="btn-primary" onclick="saveItemUpdate('${item.id}')"
        style="margin-top:18px;width:100%;display:flex;align-items:center;justify-content:center;gap:8px">
        ${iconSvg('save', 14)} Сохранить изменения
      </button>
    </div>`;

  document.getElementById('modal-overlay').classList.add('open');
}
window.openUpdateModal = openUpdateModal;

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

  saveEditsToStorage();
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
  saveEditsToStorage();
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
  localEdits[itemId].blockReason = blockVal || null;

  // Примечание (все типы)
  const notesVal = document.getElementById('modal-notes')?.value ?? '';
  item.notes = notesVal;
  localEdits[itemId].notes = notesVal;
  const noteTipEn = document.getElementById('modal-note-tip-enabled')?.checked ?? true;
  item.noteTipEnabled = noteTipEn;
  localEdits[itemId].noteTipEnabled = noteTipEn;

  saveEditsToStorage();
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
  saveEditsToStorage();
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
        <label class="form-label">Введите секретное слово для подтверждения</label>
        <input type="text" class="form-input" id="modal-secret-input"
          placeholder="секретное слово..." autocomplete="off" style="margin-top:6px">
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

function deleteProject(projectId) {
  const input = document.getElementById('modal-secret-input')?.value?.trim().toLowerCase();
  if (input !== 'секрет') {
    const err = document.getElementById('modal-secret-error');
    if (err) err.style.display = 'block';
    document.getElementById('modal-secret-input')?.focus();
    return;
  }
  const idx = VRH_PROJECTS.findIndex(p => p.id === projectId);
  if (idx === -1) return;
  VRH_PROJECTS.splice(idx, 1);
  const itemIds = VRH_ITEMS.filter(i => i.projectId === projectId).map(i => i.id);
  itemIds.forEach(id => {
    const i = VRH_ITEMS.findIndex(x => x.id === id);
    if (i !== -1) VRH_ITEMS.splice(i, 1);
    delete localEdits[id];
  });
  saveEditsToStorage();
  closeModal();
  updateProblemsBadge();
  navigate('projects');
  showToast('Проект удалён');
}
window.deleteProject = deleteProject;

function closeModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('modal-overlay').classList.remove('open');
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
const ASSIGNEES_KEY = 'vrh_assignees_v1';

function loadAssignees() {
  try { return JSON.parse(localStorage.getItem(ASSIGNEES_KEY)) || []; } catch { return []; }
}
function saveAssignees(list) {
  localStorage.setItem(ASSIGNEES_KEY, JSON.stringify(list));
}
function getAllAssignees() {
  const custom = loadAssignees();
  const names  = new Set(ASSIGNEE_DEFAULTS.map(a => a.name));
  return [...ASSIGNEE_DEFAULTS, ...custom.filter(a => !names.has(a.name))];
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
    return `<div class="adrop-item${active ? ' active' : ''}" onclick="setAssignee('${itemId}','${a.name.replace(/'/g,'\\\'')}')" style="${active ? assigneeStyle(a) : ''}">
      <span class="adrop-color-dot" style="${assigneeDotStyle(a)}"></span>${a.name}
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
  drop.innerHTML = `<div class="adrop-new-row">
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
  saveEditsToStorage();
  closeAssigneeDrop();
  render();
}
window.openAssigneeDrop   = openAssigneeDrop;
window.setAssignee        = setAssignee;
window.showAddAssigneeInput = showAddAssigneeInput;
window.confirmAddAssignee = confirmAddAssignee;

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
function saveEditsToStorage() {
  try { localStorage.setItem('vrh_edits_v2', JSON.stringify(localEdits)); } catch(e) {}
}

function loadEditsFromStorage() {
  try {
    const raw = localStorage.getItem('vrh_edits_v2');
    if (raw) localEdits = JSON.parse(raw);
  } catch(e) { localEdits = {}; }
}

function applyEdits() {
  VRH_ITEMS.forEach(item => {
    const edit = localEdits[item.id];
    if (!edit) return;
    if (edit.nameShort        !== undefined)  item.nameShort        = edit.nameShort;
    if (edit.doneCount        !== undefined)  item.doneCount        = edit.doneCount;
    if (edit.purchaseStatus   !== undefined)  item.purchaseStatus   = edit.purchaseStatus;
    if (edit.notes            !== undefined)  item.notes            = edit.notes;
    if (edit.deadline         !== undefined)  item.deadline         = edit.deadline;
    if (edit.assignee         !== undefined)  item.assignee         = edit.assignee;
    if (edit.blockReason      !== undefined)  item.blockReason      = edit.blockReason;
    if (edit.nameFullEnabled  !== undefined)  item.nameFullEnabled  = edit.nameFullEnabled;
    if (edit.nameFullOverride !== undefined)  item.nameFullOverride = edit.nameFullOverride;
    if (edit.noteTipEnabled   !== undefined)  item.noteTipEnabled   = edit.noteTipEnabled;
    if (edit.components) {
      edit.components.forEach(ec => {
        const c = item.components?.find(x => x.id === ec.id);
        if (c && ec.done !== undefined) c.done = ec.done;
      });
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
}

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

  saveEditsToStorage();
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
  saveEditsToStorage();
  showToast('Запись обновлена');
  render();
}
window.saveHistoryEdit = saveHistoryEdit;

function exportData() {
  const data = {
    exportDate: new Date().toISOString(),
    projects: VRH_PROJECTS,
    items: VRH_ITEMS,
    edits: localEdits,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vrh_production_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  showToast('Данные экспортированы');
}
window.exportData = exportData;

// =============================================================
// FILTER
// =============================================================
function setFilter(key, value) {
  state.filter[key] = value;
  render();
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
