'use strict';
/* ============================================================
   VRH ERP — CRM-модуль «Движение клиента»
   Vanilla JS, зависимости: iconSvg, navigate, closeModal,
   setBreadcrumb, _sb (Supabase client), state
   ============================================================ */

/* ---------------- КОНСТАНТЫ ---------------- */

const CRM_STAGES = [
  { key: 'new',         label: 'Неразобран',            color: '#94A3B8', bg: '#F1F5F9' },
  { key: 'in_work',     label: 'Взят в работу',          color: '#3B82F6', bg: '#EFF6FF' },
  { key: 'warming',     label: 'Прогрев',                color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'lead_ready',  label: 'Лид / Готов проект',     color: '#8B5CF6', bg: '#F5F3FF' },
  { key: 'negotiation', label: 'Согласование КП',        color: '#EC4899', bg: '#FDF2F8' },
  { key: 'proposal',    label: 'Коммерческое предложение', color: '#10B981', bg: '#ECFDF5' },
  { key: 'done',        label: 'Сделка успешна',         color: '#22C55E', bg: '#F0FDF4' },
];

/* Совместимость с устаревшими ключами этапов */
const _STAGE_COMPAT = {
  'pers': 'lead_ready', 'contract': 'negotiation',
  'prepayment': 'proposal', 'engineering': 'proposal',
};

const CRM_TYPES = [
  { key: 'forel', label: 'Форель' },
  { key: 'osetr', label: 'Осётр' },
  { key: 'ikra',  label: 'Икра' },
  { key: 'combo', label: 'Форель + Осётр' },
  { key: 'other', label: 'Другое' },
];

const CRM_CATEGORIES = [
  { key: 'A', label: 'Горячий' },
  { key: 'B', label: 'Тёплый' },
  { key: 'C', label: 'Холодный' },
];

const CRM_TABS = [
  { key: 'general',   label: 'Общее' },
  { key: 'history',   label: 'История' },
  { key: 'docs',      label: 'Документы' },
  { key: 'cp',        label: 'КП' },
  { key: 'contracts', label: 'Договоры' },
  { key: 'finances',  label: 'Финансы' },
  { key: 'project',   label: 'Проект' },
  { key: 'contacts',  label: 'Контакты' },
];

let _crmClients = [];
let _crmHistory = {}; // { [clientId]: historyEntry[] }

let _crmFilter = { search: '', stage: 'all', cat: 'all', lifecycle: 'crm' };
let _crmSearchDebounce = null;
let _crmActiveTab = 'general';
let _crmLastClientId = null;

const _CRM_PIN_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

/* ---------------- УТИЛИТЫ ---------------- */

function _crmEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _crmToast(msg) {
  if (typeof window.showToast === 'function') window.showToast(msg);
  else alert(msg);
}

function formatDateShort(str) {
  if (!str) return '';
  if (typeof window.formatDate === 'function') return window.formatDate(String(str).slice(0, 10));
  const p = String(str).slice(0, 10).split('-');
  if (p.length !== 3) return str;
  return p[2] + '.' + p[1] + '.' + p[0];
}

function getCrmStageInfo(key) {
  const k = _STAGE_COMPAT[key] || key;
  return CRM_STAGES.find(s => s.key === k) || CRM_STAGES[0];
}

function getNextStage(currentKey) {
  const idx = CRM_STAGES.findIndex(s => s.key === currentKey);
  if (idx === -1 || idx >= CRM_STAGES.length - 1) return null;
  return CRM_STAGES[idx + 1].key;
}

function getCrmCatLabel(key) {
  const found = CRM_CATEGORIES.find(c => c.key === (key || 'C'));
  return found ? found.label : key || '—';
}

function getCrmTypeLabel(key) {
  const t = CRM_TYPES.find(t => t.key === key);
  return t ? t.label : (key || '');
}

/* Класс подсветки даты следующего контакта */
function _crmContactDateClass(str) {
  if (!str) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(String(str).slice(0, 10) + 'T00:00:00');
  if (isNaN(d)) return '';
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0) return 'crm-date-overdue';
  if (diff <= 1) return 'crm-date-soon';
  return '';
}

/* Дата перехода на этап (последняя запись истории с этим этапом) */
function _crmStageDate(clientId, stageKey) {
  const hist = _crmHistory[clientId] || [];
  let latest = null;
  hist.forEach(h => {
    if (h.stage === stageKey && (!latest || String(h.created_at) > String(latest))) latest = h.created_at;
  });
  return latest ? formatDateShort(String(latest).slice(0, 10)) : '';
}

/* ---------------- ЗАГРУЗКА ДАННЫХ (вызывается из app.js) ---------------- */

function loadCrmData(clientsData, historyData) {
  _crmClients = clientsData || [];
  _crmHistory = {};
  (historyData || []).forEach(h => {
    if (!_crmHistory[h.client_id]) _crmHistory[h.client_id] = [];
    _crmHistory[h.client_id].push(h);
  });
}
window.loadCrmData = loadCrmData;

/* ---------------- ПЕРЕРЕНДЕР ---------------- */

function _crmRerender() {
  const el = document.getElementById('content');
  if (!el) return;
  if (state && state.view === 'crm-client' && state.projectId) renderCrmClient(el, state.projectId);
  else renderCrmList(el);
}

function _crmRerenderList() {
  const inp = document.getElementById('crm-search');
  const hadFocus = inp && document.activeElement === inp;
  const selStart = hadFocus ? inp.selectionStart : null;
  const el = document.getElementById('content');
  if (!el) return;
  renderCrmList(el);
  if (hadFocus) {
    requestAnimationFrame(() => {
      const ni = document.getElementById('crm-search');
      if (ni) {
        ni.focus();
        try { ni.setSelectionRange(selStart, selStart); } catch (e) {}
      }
    });
  }
}

function setCrmFilter(key, val) {
  _crmFilter[key] = val;
  if (key === 'lifecycle') {
    _crmFilter.cat = 'all';
    _crmFilter.stage = 'all';
  }
  if (key === 'search') {
    clearTimeout(_crmSearchDebounce);
    _crmSearchDebounce = setTimeout(_crmRerenderList, 250);
  } else {
    _crmRerenderList();
  }
}
window.setCrmFilter = setCrmFilter;

/* Возвращает фактический lifecycle карточки (с обратной совместимостью для category=D) */
function _crmGetLifecycle(c) {
  return c.lifecycle || (c.category === 'D' ? 'archived' : 'crm');
}

/* ---------------- СПИСОК КЛИЕНТОВ ---------------- */

function _crmFilteredClients() {
  const q = (_crmFilter.search || '').trim().toLowerCase();
  return _crmClients.filter(c => {
    if (_crmGetLifecycle(c) !== _crmFilter.lifecycle) return false;
    if (_crmFilter.stage !== 'all' && c.stage !== _crmFilter.stage) return false;
    if (_crmFilter.cat !== 'all' && c.category !== _crmFilter.cat) return false;
    if (q) {
      const hay = [c.project_name, c.org_name, c.region, c.contact_person, c.manager]
        .map(v => String(v || '').toLowerCase()).join(' ');
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
}

function crmClientCard(client) {
  const stage = getCrmStageInfo(client.stage);
  const cat = (client.category || 'D').toLowerCase();
  const typeLabel = getCrmTypeLabel(client.project_type);

  return `
  <div class="crm-card" style="border-left-color:${stage.color}" onclick="navigate('crm-client','${_crmEsc(client.id)}')">
    <div class="crm-card-top">
      <span class="crm-cat-badge crm-cat-${_crmEsc(cat)}">${_crmEsc(getCrmCatLabel(client.category))}</span>
      ${client.client_priority ? `<span class="crm-card-priority">${_crmEsc(client.client_priority)}</span>` : ''}
    </div>
    <div class="crm-card-project">${_crmEsc(client.project_name || 'Без названия')}</div>
    ${client.org_name ? `<div class="crm-card-org">${_crmEsc(client.org_name)}</div>` : ''}
    ${client.region ? `<div class="crm-card-region">${_CRM_PIN_SVG}<span>${_crmEsc(client.region)}</span></div>` : ''}
    <div><span class="crm-card-stage" style="color:${stage.color};background:${stage.bg}">${_crmEsc(stage.label)}</span></div>
    <div class="crm-card-footer">
      <span class="crm-card-manager">${iconSvg('user', 12)} ${_crmEsc(client.manager || '—')}</span>
      ${typeLabel ? `<span class="crm-card-type">${_crmEsc(typeLabel)}</span>` : ''}
    </div>
  </div>`;
}

function renderCrmList(el) {
  el = el || document.getElementById('content');
  if (!el) return;
  if (typeof window.setBreadcrumb === 'function') setBreadcrumb('CRM');

  const activeCount   = _crmClients.filter(c => _crmGetLifecycle(c) === 'crm').length;
  const archiveCount  = _crmClients.filter(c => _crmGetLifecycle(c) === 'archived').length;
  const projectCount  = _crmClients.filter(c => _crmGetLifecycle(c) === 'project').length;
  const clients = _crmFilteredClients();
  const isArchive = _crmFilter.lifecycle === 'archived';

  const stageOpts = ['<option value="all">Все этапы</option>']
    .concat(CRM_STAGES.map(s =>
      `<option value="${s.key}" ${_crmFilter.stage === s.key ? 'selected' : ''}>${_crmEsc(s.label)}</option>`))
    .join('');

  const catOpts = ['<option value="all">Все категории</option>']
    .concat(CRM_CATEGORIES.map(c =>
      `<option value="${c.key}" ${_crmFilter.cat === c.key ? 'selected' : ''}>${_crmEsc(c.label)}</option>`))
    .join('');

  let body;
  if (!_crmClients.length) {
    body = `
    <div class="crm-empty">
      ${iconSvg('folder', 48)}
      <div class="crm-empty-title">Клиентов пока нет</div>
      <div class="crm-empty-sub">Добавьте первого клиента, чтобы начать вести воронку продаж</div>
      <button class="btn-primary" onclick="openAddClientModal()">${iconSvg('plus', 14)} Добавить клиента</button>
    </div>`;
  } else if (!clients.length) {
    body = `
    <div class="crm-empty">
      ${iconSvg('list', 48)}
      <div class="crm-empty-title">${isArchive ? 'Архив пуст' : 'Ничего не найдено'}</div>
      <div class="crm-empty-sub">${isArchive ? 'Архивированные клиенты появятся здесь' : 'Попробуйте изменить фильтры или поисковый запрос'}</div>
    </div>`;
  } else {
    body = `<div class="crm-clients-grid">${clients.map(crmClientCard).join('')}</div>`;
  }

  el.innerHTML = `
  <div class="crm-page-wrap">
    <div class="crm-page-header">
      <div>
        <div class="crm-page-title">CRM — Движение клиента</div>
        <div class="crm-page-subtitle">${clients.length} клиентов</div>
      </div>
      <button class="btn-primary" onclick="openAddClientModal()">${iconSvg('plus', 14)} Добавить клиента</button>
    </div>
    <div class="crm-list-tabs">
      <button class="crm-list-tab ${_crmFilter.lifecycle === 'crm' ? 'crm-list-tab-active' : ''}" onclick="setCrmFilter('lifecycle','crm')">
        Активные <span class="crm-list-tab-count">${activeCount}</span>
      </button>
      <button class="crm-list-tab ${_crmFilter.lifecycle === 'archived' ? 'crm-list-tab-active' : ''}" onclick="setCrmFilter('lifecycle','archived')">
        Архив <span class="crm-list-tab-count">${archiveCount}</span>
      </button>
      ${projectCount > 0 ? `<button class="crm-list-tab ${_crmFilter.lifecycle === 'project' ? 'crm-list-tab-active' : ''}" onclick="navigate('erp-projects')" style="color:var(--cyan)">
        Проекты <span class="crm-list-tab-count" style="background:var(--cyan-dim);color:var(--cyan)">${projectCount}</span>
      </button>` : ''}
    </div>
    <div class="crm-filters">
      <input type="text" id="crm-search" placeholder="Поиск по имени, проекту, региону..."
             value="${_crmEsc(_crmFilter.search)}"
             oninput="setCrmFilter('search', this.value)">
      <select id="crm-filter-stage" onchange="setCrmFilter('stage', this.value)">${stageOpts}</select>
      ${!isArchive ? `<select id="crm-filter-cat" onchange="setCrmFilter('cat', this.value)">${catOpts}</select>` : ''}
    </div>
    ${body}
  </div>`;

  const view = document.getElementById('view');
  if (view && document.activeElement !== document.getElementById('crm-search')) view.scrollTop = 0;
}
window.renderCrmList = renderCrmList;
window.crmClientCard = crmClientCard;

/* ---------------- ВОРОНКА (PIPELINE) ---------------- */

function _crmArrow(dir) {
  const pts = dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6';
  return `<span class="crm-stage-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="${pts}"/></svg></span>`;
}

function _crmStageNode(client, stage, idx, currentIdx) {
  let cls = 'crm-stage-node';
  let style = '';
  let checkMark = '';
  let btn = '';

  if (idx === currentIdx) {
    cls += ' crm-stage-node-active';
    style = `border-color:${stage.color};background:${stage.bg};`;
  } else if (idx < currentIdx) {
    cls += ' crm-stage-node-past';
    checkMark = `<span class="crm-stage-check" style="color:#16A34A">${iconSvg('check', 12)}</span>`;
  } else {
    cls += ' crm-stage-node-future';
  }

  if (idx === currentIdx + 1 && client.stage !== 'done') {
    btn = `<button class="crm-stage-btn" onclick="openStageTransitionModal('${_crmEsc(client.id)}','${stage.key}')">Перейти</button>`;
  }

  const date = _crmStageDate(client.id, stage.key);

  return `
  <div class="${cls}" style="${style}">
    <div class="crm-stage-num">${checkMark} Этап ${idx + 1}</div>
    <div class="crm-stage-name" style="${idx === currentIdx ? `color:${stage.color}` : ''}">${_crmEsc(stage.label)}</div>
    ${date ? `<div class="crm-stage-date">${date}</div>` : ''}
    ${btn}
  </div>`;
}

function renderCrmPipeline(client) {
  const currentIdx = Math.max(0, CRM_STAGES.findIndex(s => s.key === client.stage));

  const row1 = CRM_STAGES.slice(0, 4).map((s, i) => _crmStageNode(client, s, i, currentIdx))
    .join(_crmArrow('right'));
  const row2 = CRM_STAGES.slice(4, 7).map((s, i) => _crmStageNode(client, s, i + 4, currentIdx))
    .join(_crmArrow('left'));

  const connector = `
  <div class="crm-pipeline-connector">
    <svg width="34" height="26" viewBox="0 0 34 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M26 2 v8 a8 8 0 0 1 -8 8 H10"/>
      <polyline points="14 14 10 18 14 22"/>
    </svg>
  </div>`;

  return `
  <div class="crm-pipeline">
    <div class="crm-pipeline-title">Воронка сделки</div>
    <div class="crm-pipeline-snake">
      <div class="crm-pipeline-row">${row1}</div>
      ${connector}
      <div class="crm-pipeline-row">${row2}</div>
    </div>
  </div>`;
}
window.renderCrmPipeline = renderCrmPipeline;

/* ---------------- ВКЛАДКИ ---------------- */

function renderCrmTabs(client, activeTab) {
  return CRM_TABS.map(t =>
    `<button class="crm-tab ${t.key === activeTab ? 'crm-tab-active' : ''}"
             onclick="setCrmTab('${_crmEsc(client.id)}','${t.key}')">${_crmEsc(t.label)}</button>`
  ).join('');
}
window.renderCrmTabs = renderCrmTabs;

function setCrmTab(clientId, tab) {
  _crmActiveTab = tab;
  const client = _crmClients.find(c => c.id === clientId);
  if (!client) return;
  const tabsEl = document.getElementById('crm-tabs-wrap');
  const contentEl = document.getElementById('crm-tab-content');
  if (tabsEl) tabsEl.innerHTML = renderCrmTabs(client, tab);
  if (contentEl) contentEl.innerHTML = renderTabContent(client, tab);
}
window.setCrmTab = setCrmTab;

function _crmInfoItem(label, value) {
  return `
  <div class="crm-info-item">
    <div class="crm-info-label">${_crmEsc(label)}</div>
    <div class="crm-info-value">${value ? _crmEsc(value) : '<span style="color:var(--gray-300)">—</span>'}</div>
  </div>`;
}

function _crmBoolText(v) {
  if (v === true || v === 'true' || v === 'yes') return 'Да';
  if (v === false || v === 'false' || v === 'no') return 'Нет';
  return v || '';
}

function _crmTabStub(title) {
  return `
  <div class="crm-tab-stub">
    ${iconSvg('document', 36)}
    <div class="crm-tab-stub-text">${_crmEsc(title)}</div>
  </div>`;
}

function renderTabContent(client, tab) {
  if (tab === 'general') {
    return `
    <div class="crm-info-grid">
      ${_crmInfoItem('Регион', client.region)}
      ${_crmInfoItem('Адрес', client.address)}
      ${_crmInfoItem('Тип проекта', getCrmTypeLabel(client.project_type))}
      ${_crmInfoItem('Производительность', client.productivity)}
      ${_crmInfoItem('Наличие участка', _crmBoolText(client.has_land))}
      ${_crmInfoItem('Наличие здания', _crmBoolText(client.has_building))}
      ${_crmInfoItem('Вид рыбы', client.fish_type)}
      ${_crmInfoItem('Источник финансирования', client.funding_source)}
      ${_crmInfoItem('Срок реализации (мес.)', client.deadline_months)}
      ${_crmInfoItem('Посещённые хозяйства', client.visited_farms)}
      ${_crmInfoItem('Приоритет клиента', client.client_priority)}
      ${_crmInfoItem('Почему выбрали нас', client.why_chose_us)}
      ${_crmInfoItem('ЛПР', client.lpr)}
      ${_crmInfoItem('Партнёры', client.partners)}
      ${_crmInfoItem('Конкуренты', client.competitors)}
      ${_crmInfoItem('Комментарий', client.comment)}
    </div>`;
  }

  if (tab === 'history') {
    const hist = (_crmHistory[client.id] || []).slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    if (!hist.length) {
      return `<div class="crm-tab-stub">${iconSvg('clock', 36)}<div class="crm-tab-stub-text">История этапов пока пуста</div></div>`;
    }
    return `<div class="crm-history-timeline">${hist.map(h => {
      const st = getCrmStageInfo(h.stage);
      return `
      <div class="crm-history-item">
        <div class="crm-history-dot" style="background:${st.bg};color:${st.color}">${iconSvg('check', 14)}</div>
        <div class="crm-history-content">
          <div class="crm-history-meta">
            <span class="crm-history-date">${formatDateShort(String(h.created_at).slice(0, 10))}</span>
            <span class="crm-card-stage" style="color:${st.color};background:${st.bg}">${_crmEsc(st.label)}</span>
            <span class="crm-history-author">${_crmEsc(h.author || '')}</span>
          </div>
          ${h.comment ? `<div class="crm-history-comment">${_crmEsc(h.comment)}</div>` : ''}
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  if (tab === 'contacts') {
    return `
    <div class="crm-info-grid">
      ${_crmInfoItem('Контактное лицо', client.contact_person)}
      ${_crmInfoItem('Телефон', client.phone)}
      ${_crmInfoItem('Email', client.email)}
      ${_crmInfoItem('Telegram', client.telegram)}
    </div>`;
  }

  if (tab === 'docs')      return _crmTabStub('Документы будут добавлены в следующей версии');
  if (tab === 'cp')        return _crmTabStub('Коммерческие предложения');
  if (tab === 'contracts') return _crmTabStub('Договоры');
  if (tab === 'finances')  return _crmTabStub('Финансовый учёт');
  if (tab === 'project')   return _crmTabStub('Данные проекта');
  return '';
}
window.renderTabContent = renderTabContent;

/* ---------------- КАРТОЧКА КЛИЕНТА ---------------- */

function renderCrmClient(el, clientId) {
  el = el || document.getElementById('content');
  if (!el) return;

  const client = _crmClients.find(c => c.id === clientId);
  if (!client) {
    el.innerHTML = `
    <div class="crm-client-wrap">
      <div class="crm-empty">
        ${iconSvg('warning', 48)}
        <div class="crm-empty-title">Клиент не найден</div>
        <div class="crm-empty-sub">Возможно, клиент был удалён</div>
        <button class="btn-secondary" onclick="navigate('crm')">Вернуться к списку</button>
      </div>
    </div>`;
    return;
  }

  if (_crmLastClientId !== clientId) { _crmActiveTab = 'general'; _crmLastClientId = clientId; }
  if (typeof window.setBreadcrumb === 'function') setBreadcrumb('CRM', client.project_name || '');

  const cat = (client.category || 'C').toLowerCase();
  const lifecycle = _crmGetLifecycle(client);

  let lifecycleBanner = '';
  if (lifecycle === 'project') {
    lifecycleBanner = `
    <div class="crm-lifecycle-banner crm-lifecycle-project">
      <span style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
        ${iconSvg('check', 14)}
        <span>Договор подписан. Карточка перенесена в модуль <strong>«Проекты»</strong>. Все данные и история сохранены.</span>
      </span>
      <button onclick="navigate('erp-projects')" class="crm-lifecycle-link">Открыть Проекты →</button>
    </div>`;
  } else if (lifecycle === 'archived') {
    lifecycleBanner = `
    <div class="crm-lifecycle-banner crm-lifecycle-archived">
      <span style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
        ${iconSvg('minus', 14)}
        <span>Клиент в архиве. Воронка скрыта. Все данные сохранены.</span>
      </span>
      <button onclick="restoreClientFromArchive('${_crmEsc(client.id)}')" class="crm-lifecycle-link">Восстановить</button>
    </div>`;
  }

  let lifecycleActions = '';
  if (lifecycle === 'crm') {
    lifecycleActions = `
      <button class="btn-secondary" onclick="openArchiveClientModal('${_crmEsc(client.id)}')" title="Переместить в архив">${iconSvg('minus', 14)} В архив</button>
      <button class="crm-contract-btn" onclick="openContractSignedModal('${_crmEsc(client.id)}')">${iconSvg('check', 14)} Договор подписан</button>`;
  } else if (lifecycle === 'project') {
    lifecycleActions = `<button class="btn-primary" onclick="navigate('erp-projects')">${iconSvg('folder', 14)} Перейти в Проекты</button>`;
  } else if (lifecycle === 'archived') {
    lifecycleActions = `<button class="btn-secondary" onclick="restoreClientFromArchive('${_crmEsc(client.id)}')">${iconSvg('refresh', 14)} Восстановить</button>`;
  }

  el.innerHTML = `
  <div class="crm-client-wrap">
    <button class="crm-back-btn" onclick="navigate('crm')">${_crmArrow('left')} Назад к списку</button>
    ${lifecycleBanner}
    <div class="crm-client-header">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div class="crm-client-name">${_crmEsc(client.project_name || 'Без названия')}</div>
          ${client.category ? `<span class="crm-cat-badge crm-cat-${_crmEsc(cat)}">${_crmEsc(getCrmCatLabel(client.category))}</span>` : ''}
        </div>
        ${client.org_name ? `<div class="crm-client-org">${_crmEsc(client.org_name)}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${lifecycleActions}
        <button class="btn-secondary" onclick="openEditClientModal('${_crmEsc(client.id)}')">${iconSvg('edit', 14)} Редактировать</button>
      </div>
    </div>
    ${lifecycle !== 'archived' ? renderCrmPipeline(client) : ''}
    <div class="crm-tabs" id="crm-tabs-wrap">${renderCrmTabs(client, _crmActiveTab)}</div>
    <div id="crm-tab-content">${renderTabContent(client, _crmActiveTab)}</div>
  </div>`;

  const view = document.getElementById('view');
  if (view) view.scrollTop = 0;
}
window.renderCrmClient = renderCrmClient;

/* ---------------- МОДАЛКИ: КЛИЕНТ ---------------- */

function _crmFieldInput(id, label, value, type, full) {
  return `
  <div class="${full ? 'crm-modal-full' : ''}">
    <label class="mn-label" for="${id}">${_crmEsc(label)}</label>
    <input class="mn-input" type="${type || 'text'}" id="${id}" value="${_crmEsc(value)}">
  </div>`;
}

function _crmFieldSelect(id, label, options, selected) {
  const opts = options.map(o =>
    `<option value="${_crmEsc(o.value)}" ${String(o.value) === String(selected) ? 'selected' : ''}>${_crmEsc(o.label)}</option>`
  ).join('');
  return `
  <div>
    <label class="mn-label" for="${id}">${_crmEsc(label)}</label>
    <select class="mn-input" id="${id}">${opts}</select>
  </div>`;
}

function _crmClientModalHtml(client, isEdit) {
  const c = client || {};
  const typeOpts = [{ value: '', label: '—' }].concat(CRM_TYPES.map(t => ({ value: t.key, label: t.label })));
  const stageOpts = CRM_STAGES.map(s => ({ value: s.key, label: s.label }));
  const catOpts = CRM_CATEGORIES.map(c => ({ value: c.key, label: c.label }));

  return `
  <div class="crm-modal">
    <div class="crm-modal-head">
      <div class="crm-modal-title">${isEdit ? 'Редактирование клиента' : 'Новый клиент'}</div>
      <button class="modal-close" onclick="closeModal()">${iconSvg('x', 16)}</button>
    </div>
    <div class="crm-modal-body">
      <div class="crm-modal-grid">
        ${_crmFieldInput('crm-f-project_name', 'Название проекта *', c.project_name)}
        ${_crmFieldInput('crm-f-org_name', 'Организация', c.org_name)}
        ${_crmFieldInput('crm-f-contact_person', 'Контактное лицо', c.contact_person)}
        ${_crmFieldInput('crm-f-phone', 'Телефон', c.phone)}
        ${_crmFieldInput('crm-f-email', 'Email', c.email)}
        ${_crmFieldInput('crm-f-telegram', 'Telegram', c.telegram)}
        ${_crmFieldInput('crm-f-region', 'Регион', c.region)}
        ${_crmFieldInput('crm-f-address', 'Адрес', c.address)}
        ${_crmFieldSelect('crm-f-project_type', 'Тип проекта', typeOpts, c.project_type || '')}
        ${isEdit ? _crmFieldSelect('crm-f-stage', 'Этап', stageOpts, c.stage || 'new') : ''}
        ${_crmFieldSelect('crm-f-category', 'Категория', catOpts, c.category || 'C')}
        ${_crmFieldInput('crm-f-manager', 'Менеджер', c.manager)}
        <div class="crm-modal-full">
          <label class="mn-label" for="crm-f-comment">Комментарий</label>
          <textarea class="mn-input" id="crm-f-comment" rows="3" style="height:auto;padding:8px 12px;resize:vertical">${_crmEsc(c.comment)}</textarea>
        </div>
      </div>
    </div>
    <div class="crm-modal-footer">
      ${isEdit ? `<button class="mn-btn-danger" onclick="deleteClient('${_crmEsc(c.id)}')">${iconSvg('trash', 14)} Удалить клиента</button>` : ''}
      <div style="flex:1"></div>
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="btn-primary" onclick="saveClient(${isEdit ? `'${_crmEsc(c.id)}'` : 'null'})">${isEdit ? 'Сохранить' : 'Добавить'}</button>
    </div>
  </div>`;
}

function openAddClientModal() {
  document.getElementById('modal-box').innerHTML = _crmClientModalHtml(null, false);
  document.getElementById('modal-overlay').classList.add('open');
}
window.openAddClientModal = openAddClientModal;

function openEditClientModal(clientId) {
  const client = _crmClients.find(c => c.id === clientId);
  if (!client) return;
  document.getElementById('modal-box').innerHTML = _crmClientModalHtml(client, true);
  document.getElementById('modal-overlay').classList.add('open');
}
window.openEditClientModal = openEditClientModal;

function _crmReadField(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function saveClient(clientId) {
  const isNew = clientId === null || clientId === undefined;
  const fields = {
    project_name:   _crmReadField('crm-f-project_name'),
    org_name:       _crmReadField('crm-f-org_name'),
    contact_person: _crmReadField('crm-f-contact_person'),
    phone:          _crmReadField('crm-f-phone'),
    email:          _crmReadField('crm-f-email'),
    telegram:       _crmReadField('crm-f-telegram'),
    region:         _crmReadField('crm-f-region'),
    address:        _crmReadField('crm-f-address'),
    project_type:   _crmReadField('crm-f-project_type') || null,
    stage:          isNew ? 'new' : (_crmReadField('crm-f-stage') || 'new'),
    category:       _crmReadField('crm-f-category') || 'C',
    manager:        _crmReadField('crm-f-manager'),
    comment:        _crmReadField('crm-f-comment'),
  };

  if (!fields.project_name) {
    _crmToast('Укажите название проекта');
    const inp = document.getElementById('crm-f-project_name');
    if (inp) inp.focus();
    return;
  }

  let client;
  if (isNew) {
    client = Object.assign({
      id: 'crm_' + Date.now(),
      created_at: new Date().toISOString(),
      last_contact: null,
      fish_type: null, funding_source: null, deadline_months: null,
      has_land: null, has_building: null, visited_farms: null,
      client_priority: null, why_chose_us: null, lpr: null,
      partners: null, competitors: null,
    }, fields);
    _crmClients.push(client);
  } else {
    client = _crmClients.find(c => c.id === clientId);
    if (!client) return;
    Object.assign(client, fields);
  }

  (async () => {
    try {
      await _sb.from('crm_clients').upsert(client);
    } catch (e) { console.error('saveClient error:', e); }
  })();

  closeModal();
  if (isNew) navigate('crm-client', client.id);
  else _crmRerender();
}
window.saveClient = saveClient;

function deleteClient(clientId) {
  if (!confirm('Удалить клиента?')) return;
  const idx = _crmClients.findIndex(c => c.id === clientId);
  if (idx !== -1) _crmClients.splice(idx, 1);
  delete _crmHistory[clientId];

  (async () => {
    try {
      await _sb.from('crm_stage_history').delete().eq('client_id', clientId);
      await _sb.from('crm_clients').delete().eq('id', clientId);
    } catch (e) { console.error('deleteClient error:', e); }
  })();

  closeModal();
  navigate('crm');
}
window.deleteClient = deleteClient;

/* ---------------- МОДАЛКА: ПЕРЕХОД ЭТАПА ---------------- */

function openStageTransitionModal(clientId, nextStageKey) {
  const client = _crmClients.find(c => c.id === clientId);
  if (!client) return;
  const cur = getCrmStageInfo(client.stage);
  const next = getCrmStageInfo(nextStageKey);

  document.getElementById('modal-box').innerHTML = `
  <div class="crm-modal crm-modal-md">
    <div class="crm-modal-head">
      <div class="crm-modal-title">
        Переход:
        <span class="crm-card-stage" style="color:${cur.color};background:${cur.bg}">${_crmEsc(cur.label)}</span>
        ${_crmArrow('right')}
        <span class="crm-card-stage" style="color:${next.color};background:${next.bg}">${_crmEsc(next.label)}</span>
      </div>
      <button class="modal-close" onclick="closeModal()">${iconSvg('x', 16)}</button>
    </div>
    <div class="crm-modal-body">
      <div class="crm-modal-grid">
        <div class="crm-modal-full">
          <label class="mn-label" for="strans-comment">Комментарий *</label>
          <textarea class="mn-input" id="strans-comment" rows="3" style="height:auto;padding:8px 12px;resize:vertical" placeholder="Что было сделано на этом этапе"></textarea>
        </div>
      </div>
    </div>
    <div class="crm-modal-footer">
      <div style="flex:1"></div>
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="btn-primary" onclick="saveStageTransition('${_crmEsc(clientId)}','${_crmEsc(nextStageKey)}')">Подтвердить переход</button>
    </div>
  </div>`;
  document.getElementById('modal-overlay').classList.add('open');
}
window.openStageTransitionModal = openStageTransitionModal;

function saveStageTransition(clientId, nextStageKey) {
  const comment = _crmReadField('strans-comment');

  if (!comment) {
    _crmToast('Заполните комментарий');
    return;
  }

  const client = _crmClients.find(c => c.id === clientId);
  if (!client) return;

  client.stage = nextStageKey;
  client.last_contact = new Date().toISOString().slice(0, 10);

  const entry = {
    id: 'crmh_' + Date.now(),
    client_id: clientId,
    stage: nextStageKey,
    author: 'Менеджер',
    comment: comment,
    created_at: new Date().toISOString(),
  };
  if (!_crmHistory[clientId]) _crmHistory[clientId] = [];
  _crmHistory[clientId].push(entry);

  (async () => {
    try {
      await _sb.from('crm_clients').upsert(client);
      await _sb.from('crm_stage_history').insert(entry);
    } catch (e) { console.error('saveStageTransition error:', e); }
  })();

  closeModal();
  _crmRerender();
}
window.saveStageTransition = saveStageTransition;

/* ---------------- LIFECYCLE: ДОГОВОР ПОДПИСАН ---------------- */

function openContractSignedModal(clientId) {
  const client = _crmClients.find(c => c.id === clientId);
  if (!client) return;
  document.getElementById('modal-box').innerHTML = `
  <div class="crm-modal crm-modal-sm">
    <div class="crm-modal-head">
      <div class="crm-modal-title">${iconSvg('check', 16)} Договор подписан</div>
      <button class="modal-close" onclick="closeModal()">${iconSvg('x', 16)}</button>
    </div>
    <div class="crm-modal-body">
      <div class="crm-contract-info-box">
        Карточка <strong>${_crmEsc(client.project_name || 'клиента')}</strong> будет перенесена
        в модуль <strong>«Проекты»</strong>. Вся история переговоров и данные сохранятся.
      </div>
      <div class="crm-modal-grid">
        <div class="crm-modal-full">
          <label class="mn-label" for="contract-comment">Комментарий</label>
          <textarea class="mn-input" id="contract-comment" rows="3"
            style="height:auto;padding:8px 12px;resize:vertical"
            placeholder="Дата подписания, номер договора..."></textarea>
        </div>
      </div>
    </div>
    <div class="crm-modal-footer">
      <div style="flex:1"></div>
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="crm-contract-btn" onclick="saveContractSigned('${_crmEsc(clientId)}')">${iconSvg('check', 14)} Подтвердить</button>
    </div>
  </div>`;
  document.getElementById('modal-overlay').classList.add('open');
}
window.openContractSignedModal = openContractSignedModal;

function saveContractSigned(clientId) {
  const client = _crmClients.find(c => c.id === clientId);
  if (!client) return;
  const comment = _crmReadField('contract-comment');

  client.lifecycle = 'project';

  const entry = {
    id: 'crmh_' + Date.now(),
    client_id: clientId,
    stage: client.stage,
    author: 'Менеджер',
    comment: '[Договор подписан]' + (comment ? ': ' + comment : ''),
    created_at: new Date().toISOString(),
  };
  if (!_crmHistory[clientId]) _crmHistory[clientId] = [];
  _crmHistory[clientId].push(entry);

  (async () => {
    try {
      await _sb.from('crm_clients').upsert(client);
      await _sb.from('crm_stage_history').insert(entry);
    } catch (e) { console.error('saveContractSigned error:', e); }
  })();

  showProjectCreatedModal(clientId);
}
window.saveContractSigned = saveContractSigned;

function showProjectCreatedModal(clientId) {
  document.getElementById('modal-box').innerHTML = `
  <div class="crm-modal crm-modal-sm">
    <div class="crm-modal-head" style="border-bottom:none;padding-bottom:4px">
      <div style="flex:1"></div>
      <button class="modal-close" onclick="closeModal();_crmRerender()">${iconSvg('x', 16)}</button>
    </div>
    <div style="text-align:center;padding:8px 32px 28px">
      <div class="crm-project-success-icon">${iconSvg('check', 28)}</div>
      <div class="crm-project-success-title">Проект успешно создан</div>
      <div class="crm-project-success-sub">
        Карточка теперь доступна в модуле «Проекты».<br>
        Вся история переговоров и данные сохранены.
      </div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:24px">
        <button class="btn-secondary" onclick="closeModal();_crmRerender()">Остаться в CRM</button>
        <button class="btn-primary" onclick="closeModal();navigate('erp-projects')">${iconSvg('folder', 14)} Перейти в Проекты</button>
      </div>
    </div>
  </div>`;
  document.getElementById('modal-overlay').classList.add('open');
}
window.showProjectCreatedModal = showProjectCreatedModal;

/* ---------------- LIFECYCLE: АРХИВ ---------------- */

function openArchiveClientModal(clientId) {
  const client = _crmClients.find(c => c.id === clientId);
  if (!client) return;
  document.getElementById('modal-box').innerHTML = `
  <div class="crm-modal crm-modal-sm">
    <div class="crm-modal-head">
      <div class="crm-modal-title">Переместить в архив</div>
      <button class="modal-close" onclick="closeModal()">${iconSvg('x', 16)}</button>
    </div>
    <div class="crm-modal-body">
      <div class="crm-modal-grid">
        <div class="crm-modal-full">
          <label class="mn-label" for="archive-comment">Причина (необязательно)</label>
          <textarea class="mn-input" id="archive-comment" rows="3"
            style="height:auto;padding:8px 12px;resize:vertical"
            placeholder="Почему клиент переходит в архив?"></textarea>
        </div>
      </div>
    </div>
    <div class="crm-modal-footer">
      <div style="flex:1"></div>
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="mn-btn-danger" onclick="saveArchiveClient('${_crmEsc(clientId)}')">${iconSvg('minus', 14)} В архив</button>
    </div>
  </div>`;
  document.getElementById('modal-overlay').classList.add('open');
}
window.openArchiveClientModal = openArchiveClientModal;

function saveArchiveClient(clientId) {
  const client = _crmClients.find(c => c.id === clientId);
  if (!client) return;
  const comment = _crmReadField('archive-comment');

  client.lifecycle = 'archived';

  const entry = {
    id: 'crmh_' + Date.now(),
    client_id: clientId,
    stage: client.stage,
    author: 'Менеджер',
    comment: '[Переведён в архив]' + (comment ? ': ' + comment : ''),
    created_at: new Date().toISOString(),
  };
  if (!_crmHistory[clientId]) _crmHistory[clientId] = [];
  _crmHistory[clientId].push(entry);

  (async () => {
    try {
      await _sb.from('crm_clients').upsert(client);
      await _sb.from('crm_stage_history').insert(entry);
    } catch (e) { console.error('saveArchiveClient error:', e); }
  })();

  closeModal();
  navigate('crm');
}
window.saveArchiveClient = saveArchiveClient;

function restoreClientFromArchive(clientId) {
  const client = _crmClients.find(c => c.id === clientId);
  if (!client) return;

  client.lifecycle = 'crm';
  if (client.category === 'D') client.category = 'C';

  (async () => {
    try {
      await _sb.from('crm_clients').upsert(client);
    } catch (e) { console.error('restoreClientFromArchive error:', e); }
  })();

  _crmRerender();
  _crmToast('Клиент восстановлен в CRM');
}
window.restoreClientFromArchive = restoreClientFromArchive;

/* Экспорт для модуля Проекты */
window.getCrmProjectClients = function() {
  return _crmClients.filter(c => _crmGetLifecycle(c) === 'project');
};

/* ---------------- ЭКСПОРТ ХЕЛПЕРОВ ---------------- */

window.getCrmStageInfo = getCrmStageInfo;
window.getNextStage = getNextStage;
window.getCrmTypeLabel = getCrmTypeLabel;
window.formatDateShort = window.formatDateShort || formatDateShort;
