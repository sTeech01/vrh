/* ═══════════════════════════════════════════════════════════════
   VRH ERP Platform — рабочий стол, конфиг модулей, sidebar-контекст
   ═══════════════════════════════════════════════════════════════ */
'use strict';

/* ── SVG-иконки модулей (32x32, stroke, lucide-стиль) ─────────── */
function _platModIcon(inner) {
  return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

const ERP_MODULES = [
  {
    id: 'production', label: 'Production OS', subLabel: 'Управление производством',
    active: true, hash: 'dashboard',
    icon: _platModIcon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  },
  {
    id: 'crm', label: 'CRM', subLabel: 'Движение клиента',
    active: true, hash: 'crm',
    icon: _platModIcon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  },
  {
    id: 'procurement', label: 'Закупки', subLabel: 'Управление поставщиками',
    active: false,
    icon: _platModIcon('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'),
  },
  {
    id: 'warehouse', label: 'Склад', subLabel: 'Складской учёт',
    active: false,
    icon: _platModIcon('<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'),
  },
  {
    id: 'contracts', label: 'Согласование договоров', subLabel: 'Управление договорами',
    active: false,
    icon: _platModIcon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>'),
  },
  {
    id: 'suppliers', label: 'Поставщики', subLabel: 'База поставщиков',
    active: true, hash: 'suppliers',
    icon: _platModIcon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  },
  {
    id: 'documents', label: 'Документы', subLabel: 'Документооборот',
    active: false,
    icon: _platModIcon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
  },
  {
    id: 'reports', label: 'Отчёты', subLabel: 'Аналитика',
    active: false,
    icon: _platModIcon('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
  },
  {
    id: 'ai', label: 'AI Ассистент', subLabel: 'Интеллектуальный помощник',
    active: false,
    icon: _platModIcon('<rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>'),
  },
];

/* ── Главный экран платформы (рабочий стол) ───────────────────── */
function renderPlatformHome(el) {
  const sorted = [...ERP_MODULES].sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));
  const cards = sorted.map(m => {
    if (m.active) {
      return `
        <div class="plat-card plat-card-active" onclick="navigate('${m.hash}')">
          <div class="plat-card-icon">${m.icon}</div>
          <div class="plat-card-name">${m.label}</div>
          <div class="plat-card-sub">${m.subLabel}</div>
          <span class="plat-card-badge plat-card-badge-active">${iconSvg('check', 12)} Активен</span>
        </div>`;
    }
    return `
      <div class="plat-card plat-card-inactive">
        <div class="plat-card-icon">${m.icon}</div>
        <div class="plat-card-name">${m.label}</div>
        <div class="plat-card-sub">${m.subLabel}</div>
        <span class="plat-card-badge plat-card-badge-soon">${iconSvg('clock', 12)} Скоро</span>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="plat-home">
      <div class="plat-grid">${cards}</div>
    </div>`;
}

/* ── Контекстный sidebar ──────────────────────────────────────── */

const _PLAT_BACK_BTN = `
  <button class="plat-back-link" onclick="navigate('home')">
    <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
      <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/>
    </svg>
    Платформа
  </button>`;

function updatePlatformSidebar(view) {
  const nav = document.querySelector('#sidebar .sidebar-nav');
  if (!nav) return;

  let html = '';

  if (view === 'home') {
    html = `
      <div class="sidebar-section">Платформа</div>
      <a class="nav-item active" data-nav="home" href="#home">
        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
          <path d="M3 3.5A1.5 1.5 0 014.5 2h3A1.5 1.5 0 019 3.5v3A1.5 1.5 0 017.5 8h-3A1.5 1.5 0 013 6.5v-3zM11 3.5A1.5 1.5 0 0112.5 2h3A1.5 1.5 0 0117 3.5v3A1.5 1.5 0 0115.5 8h-3A1.5 1.5 0 0111 6.5v-3zM3 11.5A1.5 1.5 0 014.5 10h3A1.5 1.5 0 019 11.5v3A1.5 1.5 0 017.5 16h-3A1.5 1.5 0 013 14.5v-3zM11 11.5a1.5 1.5 0 011.5-1.5h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3a1.5 1.5 0 01-1.5-1.5v-3z"/>
        </svg>
        Рабочий стол
      </a>`;
  }
  else if (view === 'production') {
    html = `
      ${_PLAT_BACK_BTN}
      <div class="sidebar-section">Production OS</div>
      <a class="nav-item" data-nav="dashboard" href="#dashboard">
        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
          <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z"/>
          <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z"/>
        </svg>
        Обзор
      </a>
      <a class="nav-item" data-nav="projects" href="#projects">
        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
        </svg>
        Проекты
      </a>
      <a class="nav-item" data-nav="problems" href="#problems">
        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        Проблемы
        <span id="problems-badge" class="nav-badge" style="display:none">0</span>
      </a>
      <a class="nav-item" data-nav="ai" href="#ai">
        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
        </svg>
        AI-помощник
      </a>
      <a class="nav-item" data-nav="events" href="#events">
        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
          <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
        </svg>
        События
        <span id="events-badge" class="nav-badge" style="display:none">0</span>
      </a>`;
  }
  else if (view === 'crm') {
    html = `
      ${_PLAT_BACK_BTN}
      <div class="sidebar-section">CRM</div>
      <a class="nav-item" data-nav="crm" href="#crm">
        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
        </svg>
        Клиенты
      </a>`;
  }
  else if (view === 'suppliers') {
    html = `
      ${_PLAT_BACK_BTN}
      <div class="sidebar-section">Поставщики</div>
      <a class="nav-item" data-nav="suppliers" href="#suppliers">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        Справочник
      </a>`;
  }

  nav.innerHTML = html;

  // Заново навесить обработчики навигации на новые data-nav элементы
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.onclick = (e) => {
      e.preventDefault();
      navigate(el.dataset.nav);
      if (typeof closeMobileSidebar === 'function') closeMobileSidebar();
    };
  });
}

/* ── Определение контекста по state.view ──────────────────────── */
function getPlatformContext(view) {
  const PRODUCTION_VIEWS = ['dashboard', 'projects', 'project', 'item', 'problems', 'ai', 'report', 'events'];
  const CRM_VIEWS       = ['crm', 'crm-client'];
  const SUPPLIERS_VIEWS = ['suppliers', 'supplier'];
  if (CRM_VIEWS.includes(view))       return 'crm';
  if (SUPPLIERS_VIEWS.includes(view)) return 'suppliers';
  if (PRODUCTION_VIEWS.includes(view)) return 'production';
  return 'home';
}

/* ── Экспорт ──────────────────────────────────────────────────── */
window.ERP_MODULES = ERP_MODULES;
window.renderPlatformHome = renderPlatformHome;
window.updatePlatformSidebar = updatePlatformSidebar;
window.getPlatformContext = getPlatformContext;
