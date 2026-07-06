/* ═══════════════════════════════════════════════════════════════
   VRH ERP — Модуль «Поставщики» (Справочник организаций)
   Prefix: sup-*   Route: #suppliers / #supplier/{id}
   ═══════════════════════════════════════════════════════════════ */
'use strict';

// ── Константы ─────────────────────────────────────────────────────
const SUP_TYPES = [
  { key: 'supplier',     label: 'Поставщик' },
  { key: 'manufacturer', label: 'Производитель' },
  { key: 'contractor',   label: 'Подрядчик' },
  { key: 'installer',    label: 'Монтажная организация' },
  { key: 'designer',     label: 'Проектировщик' },
  { key: 'carrier',      label: 'Перевозчик' },
  { key: 'service',      label: 'Сервисная компания' },
  { key: 'other',        label: 'Другое' },
];

const SUP_EVENT_TYPES = [
  { key: 'call',             label: 'Позвонили' },
  { key: 'meeting',          label: 'Встреча' },
  { key: 'kp_received',      label: 'Получено КП' },
  { key: 'contract_sent',    label: 'Отправлен договор' },
  { key: 'invoice_received', label: 'Получен счёт' },
  { key: 'paid',             label: 'Оплачено' },
  { key: 'other',            label: 'Другое' },
];

const SUP_TABS = [
  { key: 'main',     label: 'Основное' },
  { key: 'contacts', label: 'Контакты' },
  { key: 'bank',     label: 'Реквизиты' },
  { key: 'docs',     label: 'Документы' },
  { key: 'history',  label: 'История' },
  { key: 'links',    label: 'Связанные объекты' },
];

// ── Состояние ─────────────────────────────────────────────────────
let _suppliers         = [];
let _supContacts       = {};  // { [supplier_id]: Contact[] }
let _supHistory        = {};  // { [supplier_id]: HistoryEntry[] }
let _supBank           = {};  // { [supplier_id]: BankRecord[] }
let _supFilter         = { search: '', type: 'all', status: 'all' };
let _supViewMode       = 'cards';
let _supActiveTab      = 'main';
let _supLastId         = null;
let _supSearchDebounce = null;

// ── Загрузка данных (вызывается из app.js → loadRemoteData) ───────
function loadSuppliersData(suppliersData, contactsData, historyData, bankData) {
  _suppliers   = suppliersData || [];
  _supContacts = {};
  _supHistory  = {};
  _supBank     = {};
  (contactsData || []).forEach(r => {
    if (!_supContacts[r.supplier_id]) _supContacts[r.supplier_id] = [];
    _supContacts[r.supplier_id].push(r);
  });
  (historyData || []).forEach(r => {
    if (!_supHistory[r.supplier_id]) _supHistory[r.supplier_id] = [];
    _supHistory[r.supplier_id].push(r);
  });
  (bankData || []).forEach(r => {
    if (!_supBank[r.supplier_id]) _supBank[r.supplier_id] = [];
    _supBank[r.supplier_id].push(r);
  });
}

// ── Хелперы ───────────────────────────────────────────────────────
function _supEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function getSupTypeLabel(key) {
  return (SUP_TYPES.find(t => t.key === key) || {}).label || key || '—';
}
function _getSupEventLabel(key) {
  return (SUP_EVENT_TYPES.find(t => t.key === key) || {}).label || key || '—';
}
function _supReadField(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  return el.tagName === 'TEXTAREA' ? (el.value || '').trim()
       : el.tagName === 'SELECT'   ? el.value
       : (el.value || '').trim();
}
function _supToast(msg) {
  if (typeof showToast === 'function') showToast(msg);
}
function _supFmt(str) {
  if (!str) return '—';
  if (typeof formatDateShort === 'function') return formatDateShort(str);
  return str;
}

// ── Фильтрация ────────────────────────────────────────────────────
function _supFiltered() {
  const q = (_supFilter.search || '').trim().toLowerCase();
  return _suppliers.filter(s => {
    if (_supFilter.status !== 'all' && s.status !== _supFilter.status) return false;
    if (_supFilter.type   !== 'all' && s.org_type !== _supFilter.type)  return false;
    if (q) {
      const conts = (_supContacts[s.id] || []);
      const hay = [
        s.full_name, s.short_name, s.inn, s.city, s.region, s.email,
        ...conts.map(c => (c.name||'') + ' ' + (c.phone||'') + ' ' + (c.email||'')),
      ].map(v => String(v || '').toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function _supRerenderList() {
  const el = document.getElementById('content');
  if (el && typeof state !== 'undefined' && state.view === 'suppliers') renderSuppliersList(el);
}

function setSupFilter(key, val) {
  _supFilter[key] = val;
  if (key === 'search') {
    clearTimeout(_supSearchDebounce);
    _supSearchDebounce = setTimeout(_supRerenderList, 250);
  } else {
    _supRerenderList();
  }
}

function setSupViewMode(mode) {
  _supViewMode = mode;
  _supRerenderList();
}

// ── СПИСОК ПОСТАВЩИКОВ ────────────────────────────────────────────
function renderSuppliersList(el) {
  el = el || document.getElementById('content');
  if (!el) return;
  if (typeof setBreadcrumb === 'function') setBreadcrumb('Поставщики');

  const list  = _supFiltered();
  const total = _suppliers.length;

  const typeOpts = ['<option value="all">Все типы</option>']
    .concat(SUP_TYPES.map(t =>
      `<option value="${t.key}" ${_supFilter.type === t.key ? 'selected':''}>${_supEsc(t.label)}</option>`))
    .join('');

  const statusOpts =
    `<option value="all"      ${_supFilter.status==='all'      ?'selected':''}>Все статусы</option>
     <option value="active"   ${_supFilter.status==='active'   ?'selected':''}>Активные</option>
     <option value="inactive" ${_supFilter.status==='inactive' ?'selected':''}>Неактивные</option>`;

  let body;
  if (!total) {
    body = `
    <div class="sup-empty">
      ${iconSvg('folder', 48)}
      <div class="sup-empty-title">Справочник пуст</div>
      <div class="sup-empty-sub">Добавьте первого поставщика, чтобы начать работу</div>
      <button class="btn-primary" onclick="openAddSupplierModal()">${iconSvg('plus', 14)} Добавить поставщика</button>
    </div>`;
  } else if (!list.length) {
    body = `
    <div class="sup-empty">
      ${iconSvg('list', 48)}
      <div class="sup-empty-title">Ничего не найдено</div>
      <div class="sup-empty-sub">Попробуйте изменить фильтры или поисковый запрос</div>
    </div>`;
  } else if (_supViewMode === 'table') {
    body = `
    <div class="sup-table-wrap">
      <table class="sup-table">
        <thead><tr>
          <th>Организация</th><th>Тип</th><th>ИНН</th>
          <th>Город</th><th>Контакт</th><th>Статус</th>
        </tr></thead>
        <tbody>${list.map(_supTableRow).join('')}</tbody>
      </table>
    </div>`;
  } else {
    body = `<div class="sup-cards-grid">${list.map(_supCard).join('')}</div>`;
  }

  el.innerHTML = `
  <div class="sup-page-wrap">
    <div class="sup-page-header">
      <div>
        <div class="sup-page-title">Поставщики</div>
        <div class="sup-page-subtitle">${list.length} из ${total} организаций</div>
      </div>
      <button class="btn-primary" onclick="openAddSupplierModal()">${iconSvg('plus', 14)} Добавить поставщика</button>
    </div>
    <div class="sup-toolbar">
      <div class="sup-filters">
        <input type="text" id="sup-search" placeholder="Поиск по названию, ИНН, городу..."
               value="${_supEsc(_supFilter.search)}"
               oninput="setSupFilter('search', this.value)">
        <select onchange="setSupFilter('type', this.value)">${typeOpts}</select>
        <select onchange="setSupFilter('status', this.value)">${statusOpts}</select>
      </div>
      <div class="sup-view-toggle">
        <button class="sup-view-btn ${_supViewMode==='cards'?'sup-view-btn-active':''}"
                onclick="setSupViewMode('cards')" title="Карточки">${iconSvg('folder',16)}</button>
        <button class="sup-view-btn ${_supViewMode==='table'?'sup-view-btn-active':''}"
                onclick="setSupViewMode('table')" title="Таблица">${iconSvg('list',16)}</button>
      </div>
    </div>
    ${body}
  </div>`;
}

function _supCard(s) {
  const conts    = _supContacts[s.id] || [];
  const firstC   = conts[0];
  const hist     = _supHistory[s.id] || [];
  const lastEv   = hist[0];
  const isActive = s.status !== 'inactive';
  return `
  <div class="sup-card ${isActive ? '' : 'sup-card-inactive'}" onclick="navigate('supplier','${_supEsc(s.id)}')">
    <div class="sup-card-top">
      <span class="sup-type-badge">${_supEsc(getSupTypeLabel(s.org_type))}</span>
      <span class="sup-status-chip ${isActive ? 'sup-status-active' : 'sup-status-inactive'}">${isActive ? 'Активен' : 'Неактивен'}</span>
    </div>
    <div class="sup-card-name">${_supEsc(s.short_name || s.full_name || 'Без названия')}</div>
    ${s.inn  ? `<div class="sup-card-meta">ИНН: ${_supEsc(s.inn)}</div>` : ''}
    ${s.city ? `<div class="sup-card-meta">${iconSvg('calendar',11)} ${_supEsc(s.city)}</div>` : ''}
    ${firstC ? `<div class="sup-card-contact">${iconSvg('user',11)} ${_supEsc(firstC.name||'')}${firstC.phone?' · '+_supEsc(firstC.phone):''}</div>` : ''}
    <div class="sup-card-footer">
      <span class="sup-card-cnt">${conts.length} конт.</span>
      ${lastEv ? `<span class="sup-card-last">${_supFmt(lastEv.event_date)}</span>` : ''}
    </div>
  </div>`;
}

function _supTableRow(s) {
  const conts    = _supContacts[s.id] || [];
  const firstC   = conts[0];
  const isActive = s.status !== 'inactive';
  return `
  <tr class="sup-tr" onclick="navigate('supplier','${_supEsc(s.id)}')">
    <td>
      <div class="sup-tr-name">${_supEsc(s.short_name || s.full_name || '—')}</div>
      ${s.short_name && s.full_name && s.short_name !== s.full_name
        ? `<div class="sup-tr-sub">${_supEsc(s.full_name)}</div>` : ''}
    </td>
    <td><span class="sup-type-badge">${_supEsc(getSupTypeLabel(s.org_type))}</span></td>
    <td>${_supEsc(s.inn || '—')}</td>
    <td>${_supEsc(s.city || '—')}</td>
    <td>${_supEsc(firstC ? (firstC.name||'')+(firstC.phone?' · '+firstC.phone:'') : '—')}</td>
    <td><span class="sup-status-chip ${isActive?'sup-status-active':'sup-status-inactive'}">${isActive?'Активен':'Неактивен'}</span></td>
  </tr>`;
}

// ── ДЕТАЛЬНАЯ СТРАНИЦА ────────────────────────────────────────────
function renderSupplierDetail(el, supplierId) {
  el = el || document.getElementById('content');
  if (!el) return;
  const s = _suppliers.find(x => x.id === supplierId);
  if (!s) { if (typeof navigate === 'function') navigate('suppliers'); return; }
  if (_supLastId !== supplierId) { _supActiveTab = 'main'; _supLastId = supplierId; }
  if (typeof setBreadcrumb === 'function') setBreadcrumb('Поставщики', s.short_name || s.full_name || '');

  const isActive = s.status !== 'inactive';
  const tabsHtml = SUP_TABS.map(t => `
    <button class="sup-tab ${_supActiveTab === t.key ? 'sup-tab-active' : ''}"
            data-tab="${t.key}"
            onclick="setSupTab('${_supEsc(s.id)}','${t.key}')">${_supEsc(t.label)}</button>`).join('');

  el.innerHTML = `
  <div class="sup-detail-wrap">
    <button class="sup-back-btn" onclick="navigate('suppliers')">${iconSvg('minus', 12)} Назад к списку</button>
    <div class="sup-detail-header">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px">
          <div class="sup-detail-name">${_supEsc(s.full_name || s.short_name || 'Без названия')}</div>
          <span class="sup-type-badge">${_supEsc(getSupTypeLabel(s.org_type))}</span>
          <span class="sup-status-chip ${isActive?'sup-status-active':'sup-status-inactive'}">${isActive?'Активен':'Неактивен'}</span>
        </div>
        ${s.short_name && s.full_name && s.short_name !== s.full_name
          ? `<div class="sup-detail-sub">${_supEsc(s.short_name)}</div>` : ''}
      </div>
      <button class="btn-secondary" onclick="openEditSupplierModal('${_supEsc(s.id)}')">${iconSvg('edit', 14)} Редактировать</button>
    </div>
    <div class="sup-tabs">${tabsHtml}</div>
    <div id="sup-tab-content">${_supTabContent(s, _supActiveTab)}</div>
  </div>`;

  const view = document.getElementById('view');
  if (view) view.scrollTop = 0;
}

function setSupTab(supplierId, tab) {
  _supActiveTab = tab;
  const s = _suppliers.find(x => x.id === supplierId);
  if (!s) return;
  document.querySelectorAll('.sup-tab').forEach(el =>
    el.classList.toggle('sup-tab-active', el.dataset.tab === tab));
  const cont = document.getElementById('sup-tab-content');
  if (cont) cont.innerHTML = _supTabContent(s, tab);
}

function _supTabContent(s, tab) {
  switch (tab) {
    case 'main':     return _supTabMain(s);
    case 'contacts': return _supTabContacts(s);
    case 'bank':     return _supTabBank(s);
    case 'docs':     return _supTabDocs(s);
    case 'history':  return _supTabHistory(s);
    case 'links':    return _supTabLinks(s);
    default:         return _supTabMain(s);
  }
}

function _ii(label, value) {
  if (!value) return '';
  return `<div class="sup-info-item"><div class="sup-info-label">${label}</div><div class="sup-info-value">${_supEsc(value)}</div></div>`;
}

function _supTabMain(s) {
  return `
  <div class="sup-tab-body">
    <div class="sup-tab-section">
      <div class="sup-section-title">Регистрационные данные</div>
      <div class="sup-info-grid">
        ${_ii('Полное наименование', s.full_name)}
        ${_ii('Краткое наименование', s.short_name)}
        ${_ii('Тип организации', getSupTypeLabel(s.org_type))}
        ${_ii('ИНН', s.inn)}
        ${_ii('КПП', s.kpp)}
        ${_ii('ОГРН', s.ogrn)}
        ${_ii('Сайт', s.website)}
      </div>
    </div>
    <div class="sup-tab-section">
      <div class="sup-section-title">Адрес</div>
      <div class="sup-info-grid">
        ${_ii('Страна', s.country)}
        ${_ii('Регион', s.region)}
        ${_ii('Город', s.city)}
        ${_ii('Юридический адрес', s.legal_address)}
        ${_ii('Фактический адрес', s.actual_address)}
      </div>
    </div>
    ${s.comment ? `<div class="sup-tab-section"><div class="sup-section-title">Комментарий</div><div class="sup-info-comment">${_supEsc(s.comment)}</div></div>` : ''}
  </div>`;
}

function _supTabContacts(s) {
  const conts = _supContacts[s.id] || [];
  const rows = conts.length
    ? conts.map(c => `
      <div class="sup-contact-card">
        <div class="sup-contact-top">
          <div>
            <div class="sup-contact-name">${_supEsc(c.name || '—')}</div>
            ${c.position ? `<div class="sup-contact-pos">${_supEsc(c.position)}</div>` : ''}
          </div>
          <button class="sup-icon-btn" onclick="openEditContactModal('${_supEsc(c.id)}','${_supEsc(s.id)}')">${iconSvg('edit',14)}</button>
        </div>
        <div class="sup-contact-fields">
          ${c.phone    ? `<span>${iconSvg('user',11)} ${_supEsc(c.phone)}</span>`    : ''}
          ${c.phone2   ? `<span>${iconSvg('user',11)} ${_supEsc(c.phone2)}</span>`   : ''}
          ${c.email    ? `<span>${iconSvg('document',11)} ${_supEsc(c.email)}</span>`: ''}
          ${c.telegram ? `<span>TG: ${_supEsc(c.telegram)}</span>`                  : ''}
          ${c.whatsapp ? `<span>WA: ${_supEsc(c.whatsapp)}</span>`                  : ''}
        </div>
        ${c.comment ? `<div class="sup-contact-comment">${_supEsc(c.comment)}</div>` : ''}
      </div>`).join('')
    : `<div class="sup-tab-empty">Контактные лица не добавлены</div>`;

  return `
  <div class="sup-tab-body">
    <div class="sup-tab-section">
      <div class="sup-section-header">
        <div class="sup-section-title">Контактные лица</div>
        <button class="btn-primary sup-btn-sm" onclick="openAddContactModal('${_supEsc(s.id)}')">${iconSvg('plus',12)} Добавить</button>
      </div>
      <div class="sup-contacts-list">${rows}</div>
    </div>
  </div>`;
}

function _supTabBank(s) {
  const banks = _supBank[s.id] || [];
  const rows = banks.length
    ? banks.map(b => `
      <div class="sup-bank-card">
        <div class="sup-bank-top">
          <div class="sup-bank-name">${_supEsc(b.bank_name || 'Банк')}</div>
          <button class="sup-icon-btn" onclick="openEditBankModal('${_supEsc(b.id)}','${_supEsc(s.id)}')">${iconSvg('edit',14)}</button>
        </div>
        <div class="sup-info-grid">
          ${_ii('БИК', b.bik)}
          ${_ii('Расчётный счёт', b.account)}
          ${_ii('Корр. счёт', b.corr_account)}
          ${_ii('Получатель', b.recipient)}
        </div>
        ${b.comment ? `<div class="sup-contact-comment">${_supEsc(b.comment)}</div>` : ''}
      </div>`).join('')
    : `<div class="sup-tab-empty">Банковские реквизиты не добавлены</div>`;

  return `
  <div class="sup-tab-body">
    <div class="sup-tab-section">
      <div class="sup-section-header">
        <div class="sup-section-title">Банковские реквизиты</div>
        <button class="btn-primary sup-btn-sm" onclick="openAddBankModal('${_supEsc(s.id)}')">${iconSvg('plus',12)} Добавить счёт</button>
      </div>
      <div class="sup-banks-list">${rows}</div>
    </div>
  </div>`;
}

function _supTabDocs(s) {
  return `
  <div class="sup-tab-body">
    <div class="sup-tab-section">
      <div class="sup-section-header">
        <div class="sup-section-title">Документы</div>
      </div>
      <div class="sup-tab-empty">
        ${iconSvg('document', 36)}
        <div style="margin-top:10px">Хранилище документов будет доступно после настройки Supabase Storage</div>
      </div>
    </div>
  </div>`;
}

function _supTabHistory(s) {
  const entries = _supHistory[s.id] || [];
  const timeline = entries.length
    ? entries.map(e => `
      <div class="sup-hist-item">
        <div class="sup-hist-dot">${iconSvg('clock', 13)}</div>
        <div class="sup-hist-body">
          <div class="sup-hist-meta">
            <span class="sup-hist-type">${_supEsc(_getSupEventLabel(e.event_type))}</span>
            <span class="sup-hist-date">${_supFmt(e.event_date)}</span>
            ${e.author ? `<span class="sup-hist-author">${_supEsc(e.author)}</span>` : ''}
          </div>
          ${e.comment ? `<div class="sup-hist-comment">${_supEsc(e.comment)}</div>` : ''}
        </div>
      </div>`).join('')
    : `<div class="sup-tab-empty">История взаимодействия пуста</div>`;

  return `
  <div class="sup-tab-body">
    <div class="sup-tab-section">
      <div class="sup-section-header">
        <div class="sup-section-title">История взаимодействия</div>
        <button class="btn-primary sup-btn-sm" onclick="openAddHistoryModal('${_supEsc(s.id)}')">${iconSvg('plus',12)} Добавить запись</button>
      </div>
      <div class="sup-hist-timeline">${timeline}</div>
    </div>
  </div>`;
}

function _supTabLinks(s) {
  return `
  <div class="sup-tab-body">
    <div class="sup-tab-section">
      <div class="sup-section-title">Связанные объекты</div>
      <div class="sup-tab-empty">
        ${iconSvg('chart', 36)}
        <div style="margin-top:10px">Связи с другими модулями (Закупки, Производство, Склад и др.) появятся здесь автоматически по мере их подключения</div>
      </div>
    </div>
  </div>`;
}

// ── ХЕЛПЕРЫ ФОРМ ─────────────────────────────────────────────────
function _sfi(id, label, val, type, full) {
  return `<div class="${full ? 'sup-f-full' : ''}">
    <label class="mn-label" for="${id}">${_supEsc(label)}</label>
    <input class="mn-input" type="${type||'text'}" id="${id}" value="${_supEsc(val)}">
  </div>`;
}
function _sfs(id, label, options, selected, full) {
  const opts = options.map(o =>
    `<option value="${_supEsc(o.value)}" ${String(o.value)===String(selected)?'selected':''}>${_supEsc(o.label)}</option>`
  ).join('');
  return `<div class="${full ? 'sup-f-full' : ''}">
    <label class="mn-label" for="${id}">${_supEsc(label)}</label>
    <select class="mn-input" id="${id}">${opts}</select>
  </div>`;
}
function _sfta(id, label, val, full) {
  return `<div class="${full ? 'sup-f-full' : ''}">
    <label class="mn-label" for="${id}">${_supEsc(label)}</label>
    <textarea class="mn-input" id="${id}" rows="3" style="height:auto;padding:8px 12px;resize:vertical">${_supEsc(val)}</textarea>
  </div>`;
}

// ── МОДАЛКА: ПОСТАВЩИК ────────────────────────────────────────────
function _supModalHtml(supplier, isEdit) {
  const s       = supplier || {};
  const typeOpts   = [{ value: '', label: '—' }].concat(SUP_TYPES.map(t => ({ value: t.key, label: t.label })));
  const statusOpts = [{ value: 'active', label: 'Активный' }, { value: 'inactive', label: 'Неактивный' }];
  return `
  <div class="sup-modal">
    <div class="crm-modal-head">
      <div class="crm-modal-title">${isEdit ? 'Редактирование поставщика' : 'Новый поставщик'}</div>
      <button class="modal-close" onclick="closeModal()">${iconSvg('x',16)}</button>
    </div>
    <div class="crm-modal-body">
      <div class="sup-form-section">Основное</div>
      <div class="sup-form-grid">
        ${_sfi('sup-f-full_name', 'Полное наименование *', s.full_name, 'text', true)}
        ${_sfi('sup-f-short_name', 'Краткое наименование', s.short_name, 'text', true)}
        ${_sfs('sup-f-org_type', 'Тип организации', typeOpts, s.org_type || '')}
        ${_sfs('sup-f-status', 'Статус', statusOpts, s.status || 'active')}
        ${_sfi('sup-f-inn',  'ИНН',  s.inn)}
        ${_sfi('sup-f-kpp',  'КПП',  s.kpp)}
        ${_sfi('sup-f-ogrn', 'ОГРН', s.ogrn)}
        ${_sfi('sup-f-website', 'Сайт', s.website)}
      </div>
      <div class="sup-form-section">Адрес</div>
      <div class="sup-form-grid">
        ${_sfi('sup-f-country', 'Страна', s.country || 'Россия')}
        ${_sfi('sup-f-region',  'Регион', s.region)}
        ${_sfi('sup-f-city',    'Город',  s.city)}
        ${_sfi('sup-f-legal_address',  'Юридический адрес',  s.legal_address,  'text', true)}
        ${_sfi('sup-f-actual_address', 'Фактический адрес',  s.actual_address, 'text', true)}
      </div>
      <div class="sup-form-section">Дополнительно</div>
      <div class="sup-form-grid">
        ${_sfta('sup-f-comment', 'Комментарий', s.comment, true)}
      </div>
    </div>
    <div class="crm-modal-footer">
      ${isEdit ? `<button class="mn-btn-danger" onclick="deleteSupplier('${_supEsc(s.id)}')">${iconSvg('trash',14)} Удалить</button>` : ''}
      <div style="flex:1"></div>
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="btn-primary" onclick="saveSupplier(${isEdit?`'${_supEsc(s.id)}'`:'null'})">${isEdit ? 'Сохранить' : 'Добавить'}</button>
    </div>
  </div>`;
}

function openAddSupplierModal() {
  document.getElementById('modal-box').innerHTML = _supModalHtml(null, false);
  document.getElementById('modal-overlay').classList.add('open');
}
function openEditSupplierModal(id) {
  const s = _suppliers.find(x => x.id === id);
  if (!s) return;
  document.getElementById('modal-box').innerHTML = _supModalHtml(s, true);
  document.getElementById('modal-overlay').classList.add('open');
}

function saveSupplier(supplierId) {
  const isNew = supplierId === null || supplierId === undefined;
  const fields = {
    full_name:      _supReadField('sup-f-full_name'),
    short_name:     _supReadField('sup-f-short_name'),
    org_type:       _supReadField('sup-f-org_type') || null,
    status:         _supReadField('sup-f-status') || 'active',
    inn:            _supReadField('sup-f-inn'),
    kpp:            _supReadField('sup-f-kpp'),
    ogrn:           _supReadField('sup-f-ogrn'),
    website:        _supReadField('sup-f-website'),
    country:        _supReadField('sup-f-country'),
    region:         _supReadField('sup-f-region'),
    city:           _supReadField('sup-f-city'),
    legal_address:  _supReadField('sup-f-legal_address'),
    actual_address: _supReadField('sup-f-actual_address'),
    comment:        _supReadField('sup-f-comment'),
  };
  if (!fields.full_name) {
    _supToast('Укажите полное наименование');
    document.getElementById('sup-f-full_name')?.focus();
    return;
  }
  let supplier;
  if (isNew) {
    supplier = Object.assign({ id: 'sup_' + Date.now(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, fields);
    _suppliers.unshift(supplier);
  } else {
    supplier = _suppliers.find(x => x.id === supplierId);
    if (!supplier) return;
    Object.assign(supplier, fields);
    supplier.updated_at = new Date().toISOString();
  }
  (async () => {
    try { await _sb.from('suppliers').upsert(supplier); }
    catch (e) { console.error('saveSupplier error:', e); }
  })();
  closeModal();
  if (isNew) {
    navigate('supplier', supplier.id);
  } else {
    const el = document.getElementById('content');
    if (el && typeof state !== 'undefined' && state.view === 'supplier') renderSupplierDetail(el, supplier.id);
  }
}
window.saveSupplier = saveSupplier;

function deleteSupplier(id) {
  if (!confirm('Удалить поставщика? Это действие нельзя отменить.')) return;
  _suppliers = _suppliers.filter(x => x.id !== id);
  delete _supContacts[id]; delete _supHistory[id]; delete _supBank[id];
  (async () => {
    try { await _sb.from('suppliers').delete().eq('id', id); }
    catch (e) { console.error('deleteSupplier error:', e); }
  })();
  closeModal();
  navigate('suppliers');
}
window.deleteSupplier = deleteSupplier;

// ── МОДАЛКА: КОНТАКТ ─────────────────────────────────────────────
function _supContactModalHtml(contact, supplierId, isEdit) {
  const c = contact || {};
  return `
  <div class="sup-modal">
    <div class="crm-modal-head">
      <div class="crm-modal-title">${isEdit ? 'Редактирование контакта' : 'Новый контакт'}</div>
      <button class="modal-close" onclick="closeModal()">${iconSvg('x',16)}</button>
    </div>
    <div class="crm-modal-body">
      <div class="sup-form-grid">
        ${_sfi('sup-c-name',     'Имя *',          c.name,     'text', true)}
        ${_sfi('sup-c-position', 'Должность',       c.position, 'text', true)}
        ${_sfi('sup-c-phone',    'Телефон',         c.phone)}
        ${_sfi('sup-c-phone2',   'Доп. телефон',    c.phone2)}
        ${_sfi('sup-c-email',    'Email',            c.email)}
        ${_sfi('sup-c-telegram', 'Telegram',         c.telegram)}
        ${_sfi('sup-c-whatsapp', 'WhatsApp',         c.whatsapp)}
        ${_sfta('sup-c-comment', 'Комментарий', c.comment, true)}
      </div>
    </div>
    <div class="crm-modal-footer">
      ${isEdit ? `<button class="mn-btn-danger" onclick="deleteContact('${_supEsc(c.id)}','${_supEsc(supplierId)}')">${iconSvg('trash',14)} Удалить</button>` : ''}
      <div style="flex:1"></div>
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="btn-primary" onclick="saveContact('${_supEsc(supplierId)}',${isEdit?`'${_supEsc(c.id)}'`:'null'})">${isEdit ? 'Сохранить' : 'Добавить'}</button>
    </div>
  </div>`;
}

function openAddContactModal(supplierId) {
  document.getElementById('modal-box').innerHTML = _supContactModalHtml(null, supplierId, false);
  document.getElementById('modal-overlay').classList.add('open');
}
function openEditContactModal(contactId, supplierId) {
  const c = (_supContacts[supplierId] || []).find(x => x.id === contactId);
  if (!c) return;
  document.getElementById('modal-box').innerHTML = _supContactModalHtml(c, supplierId, true);
  document.getElementById('modal-overlay').classList.add('open');
}

function saveContact(supplierId, contactId) {
  const isNew = !contactId;
  const fields = {
    supplier_id: supplierId,
    name:     _supReadField('sup-c-name'),
    position: _supReadField('sup-c-position'),
    phone:    _supReadField('sup-c-phone'),
    phone2:   _supReadField('sup-c-phone2'),
    email:    _supReadField('sup-c-email'),
    telegram: _supReadField('sup-c-telegram'),
    whatsapp: _supReadField('sup-c-whatsapp'),
    comment:  _supReadField('sup-c-comment'),
  };
  if (!fields.name) { _supToast('Укажите имя контакта'); return; }
  if (!_supContacts[supplierId]) _supContacts[supplierId] = [];
  let contact;
  if (isNew) {
    contact = Object.assign({ id: 'supc_' + Date.now(), created_at: new Date().toISOString() }, fields);
    _supContacts[supplierId].push(contact);
  } else {
    contact = _supContacts[supplierId].find(x => x.id === contactId);
    if (!contact) return;
    Object.assign(contact, fields);
  }
  (async () => {
    try { await _sb.from('supplier_contacts').upsert(contact); }
    catch (e) { console.error('saveContact error:', e); }
  })();
  closeModal();
  setSupTab(supplierId, 'contacts');
}
window.saveContact = saveContact;

function deleteContact(contactId, supplierId) {
  if (!confirm('Удалить контакт?')) return;
  if (_supContacts[supplierId])
    _supContacts[supplierId] = _supContacts[supplierId].filter(x => x.id !== contactId);
  (async () => {
    try { await _sb.from('supplier_contacts').delete().eq('id', contactId); }
    catch (e) { console.error('deleteContact error:', e); }
  })();
  closeModal();
  setSupTab(supplierId, 'contacts');
}
window.deleteContact = deleteContact;

// ── МОДАЛКА: ИСТОРИЯ ─────────────────────────────────────────────
function openAddHistoryModal(supplierId) {
  const evOpts = [{ value: '', label: '— Выберите тип —' }]
    .concat(SUP_EVENT_TYPES.map(t => ({ value: t.key, label: t.label })));
  document.getElementById('modal-box').innerHTML = `
  <div class="sup-modal">
    <div class="crm-modal-head">
      <div class="crm-modal-title">Запись в историю</div>
      <button class="modal-close" onclick="closeModal()">${iconSvg('x',16)}</button>
    </div>
    <div class="crm-modal-body">
      <div class="sup-form-grid">
        ${_sfs('sup-h-type',    'Тип события *',  evOpts, '', false)}
        ${_sfi('sup-h-date',    'Дата *',          new Date().toISOString().slice(0,10), 'date', false)}
        ${_sfi('sup-h-author',  'Автор',           '', 'text', false)}
        ${_sfta('sup-h-comment','Комментарий *',   '', true)}
      </div>
    </div>
    <div class="crm-modal-footer">
      <div style="flex:1"></div>
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="btn-primary" onclick="saveHistoryEntry('${_supEsc(supplierId)}')">Сохранить</button>
    </div>
  </div>`;
  document.getElementById('modal-overlay').classList.add('open');
}

function saveHistoryEntry(supplierId) {
  const fields = {
    supplier_id: supplierId,
    event_type:  _supReadField('sup-h-type'),
    event_date:  _supReadField('sup-h-date'),
    author:      _supReadField('sup-h-author'),
    comment:     _supReadField('sup-h-comment'),
  };
  if (!fields.event_type || !fields.event_date || !fields.comment) {
    _supToast('Заполните тип события, дату и комментарий');
    return;
  }
  if (!_supHistory[supplierId]) _supHistory[supplierId] = [];
  const entry = Object.assign({ id: 'suph_' + Date.now(), created_at: new Date().toISOString() }, fields);
  _supHistory[supplierId].unshift(entry);
  (async () => {
    try { await _sb.from('supplier_history').insert(entry); }
    catch (e) { console.error('saveHistoryEntry error:', e); }
  })();
  closeModal();
  setSupTab(supplierId, 'history');
}
window.saveHistoryEntry = saveHistoryEntry;

// ── МОДАЛКА: БАНКОВСКИЕ РЕКВИЗИТЫ ─────────────────────────────────
function _supBankModalHtml(bank, supplierId, isEdit) {
  const b = bank || {};
  return `
  <div class="sup-modal">
    <div class="crm-modal-head">
      <div class="crm-modal-title">${isEdit ? 'Редактирование реквизитов' : 'Новые реквизиты'}</div>
      <button class="modal-close" onclick="closeModal()">${iconSvg('x',16)}</button>
    </div>
    <div class="crm-modal-body">
      <div class="sup-form-grid">
        ${_sfi('sup-b-bank',    'Банк *',          b.bank_name,    'text', true)}
        ${_sfi('sup-b-bik',     'БИК',             b.bik)}
        ${_sfi('sup-b-account', 'Расчётный счёт',  b.account,      'text', true)}
        ${_sfi('sup-b-corr',    'Корр. счёт',      b.corr_account, 'text', true)}
        ${_sfi('sup-b-recip',   'Получатель',      b.recipient,    'text', true)}
        ${_sfta('sup-b-comment','Комментарий', b.comment, true)}
      </div>
    </div>
    <div class="crm-modal-footer">
      ${isEdit ? `<button class="mn-btn-danger" onclick="deleteBankRecord('${_supEsc(b.id)}','${_supEsc(supplierId)}')">${iconSvg('trash',14)} Удалить</button>` : ''}
      <div style="flex:1"></div>
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="btn-primary" onclick="saveBankRecord('${_supEsc(supplierId)}',${isEdit?`'${_supEsc(b.id)}'`:'null'})">${isEdit ? 'Сохранить' : 'Добавить'}</button>
    </div>
  </div>`;
}

function openAddBankModal(supplierId) {
  document.getElementById('modal-box').innerHTML = _supBankModalHtml(null, supplierId, false);
  document.getElementById('modal-overlay').classList.add('open');
}
function openEditBankModal(bankId, supplierId) {
  const b = (_supBank[supplierId] || []).find(x => x.id === bankId);
  if (!b) return;
  document.getElementById('modal-box').innerHTML = _supBankModalHtml(b, supplierId, true);
  document.getElementById('modal-overlay').classList.add('open');
}

function saveBankRecord(supplierId, bankId) {
  const isNew = !bankId;
  const fields = {
    supplier_id:  supplierId,
    bank_name:    _supReadField('sup-b-bank'),
    bik:          _supReadField('sup-b-bik'),
    account:      _supReadField('sup-b-account'),
    corr_account: _supReadField('sup-b-corr'),
    recipient:    _supReadField('sup-b-recip'),
    comment:      _supReadField('sup-b-comment'),
  };
  if (!fields.bank_name) { _supToast('Укажите название банка'); return; }
  if (!_supBank[supplierId]) _supBank[supplierId] = [];
  let record;
  if (isNew) {
    record = Object.assign({ id: 'supb_' + Date.now(), created_at: new Date().toISOString() }, fields);
    _supBank[supplierId].push(record);
  } else {
    record = _supBank[supplierId].find(x => x.id === bankId);
    if (!record) return;
    Object.assign(record, fields);
  }
  (async () => {
    try { await _sb.from('supplier_bank').upsert(record); }
    catch (e) { console.error('saveBankRecord error:', e); }
  })();
  closeModal();
  setSupTab(supplierId, 'bank');
}
window.saveBankRecord = saveBankRecord;

function deleteBankRecord(bankId, supplierId) {
  if (!confirm('Удалить реквизиты?')) return;
  if (_supBank[supplierId])
    _supBank[supplierId] = _supBank[supplierId].filter(x => x.id !== bankId);
  (async () => {
    try { await _sb.from('supplier_bank').delete().eq('id', bankId); }
    catch (e) { console.error('deleteBankRecord error:', e); }
  })();
  closeModal();
  setSupTab(supplierId, 'bank');
}
window.deleteBankRecord = deleteBankRecord;

// ── Экспорт ───────────────────────────────────────────────────────
window.loadSuppliersData    = loadSuppliersData;
window.renderSuppliersList  = renderSuppliersList;
window.renderSupplierDetail = renderSupplierDetail;
window.setSupFilter         = setSupFilter;
window.setSupViewMode       = setSupViewMode;
window.setSupTab            = setSupTab;
window.openAddSupplierModal  = openAddSupplierModal;
window.openEditSupplierModal = openEditSupplierModal;
window.openAddContactModal   = openAddContactModal;
window.openEditContactModal  = openEditContactModal;
window.openAddHistoryModal   = openAddHistoryModal;
window.openAddBankModal      = openAddBankModal;
window.openEditBankModal     = openEditBankModal;
window.getSupTypeLabel       = getSupTypeLabel;
