'use strict';
/* ═══════════════════════════════════════════════════════════════
   VRH ERP — Модуль «Склад» (складской учёт)
   CSS-префикс: wh-*
   Таблицы: inventory_items, inventory_categories, inventory_transactions
   ═══════════════════════════════════════════════════════════════ */

// ──── Константы ────────────────────────────────────────────────
const WH_ITEM_TYPES = [
  { id: 'material',  label: 'Материал' },
  { id: 'equipment', label: 'Оборудование' },
];

const WH_TX_TYPES = [
  { id: 'receipt',   label: 'Приход',        sign: +1 },
  { id: 'expense',   label: 'Расход',         sign: -1 },
  { id: 'writeoff',  label: 'Списание',       sign: -1 },
  { id: 'transfer',  label: 'Перемещение',    sign:  0 },
  { id: 'inventory', label: 'Инвентаризация', sign:  0 },
];

// ──── Состояние ────────────────────────────────────────────────
let _whItems        = [];
let _whCategories   = [];
let _whTransactions = {};   // { [itemId]: Transaction[] }
let _whFilter       = { typeTab: 'all', search: '', category: 'all' };
let _whSearchTimer  = null;

// ──── Загрузка данных из app.js ────────────────────────────────
function loadWarehouseData(itemsData, catsData, txData) {
  _whCategories = (catsData || []).slice();
  _whItems      = (itemsData || []).slice();
  _whTransactions = {};
  (txData || []).forEach(r => {
    if (!_whTransactions[r.item_id]) _whTransactions[r.item_id] = [];
    _whTransactions[r.item_id].push({
      id:         r.id,
      item_id:    r.item_id,
      type:       r.type,
      quantity:   Number(r.quantity),
      price:      r.price != null ? Number(r.price) : null,
      date:       r.date,
      comment:    r.comment || '',
      project_id: r.project_id || null,
      created_at: r.created_at,
    });
  });
}

// ──── Вспомогательные функции ──────────────────────────────────
function _whEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _whFmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return isNaN(d) ? dateStr : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function _whFmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

function _whCalcQty(itemId) {
  const txs = [...(_whTransactions[itemId] || [])].sort((a, b) => {
    const d = (a.date || '').localeCompare(b.date || '');
    return d !== 0 ? d : (a.created_at || '').localeCompare(b.created_at || '');
  });
  let qty = 0, startIdx = 0;
  for (let i = txs.length - 1; i >= 0; i--) {
    if (txs[i].type === 'inventory') { qty = txs[i].quantity; startIdx = i + 1; break; }
  }
  for (let i = startIdx; i < txs.length; i++) {
    const t = txs[i];
    if (t.type === 'receipt')                      qty += t.quantity;
    else if (t.type === 'expense' || t.type === 'writeoff') qty -= t.quantity;
  }
  return qty;
}

function _whGetCategoryName(catId) {
  const c = _whCategories.find(x => x.id === catId);
  return c ? c.name : '';
}

function _whGetSupplierName(suppId) {
  if (!suppId) return '';
  if (typeof _suppliers !== 'undefined') {
    const s = _suppliers.find(x => x.id === suppId);
    if (s) return s.short_name || s.full_name || '';
  }
  return '';
}

function _whFiltered() {
  let list = _whItems.slice();
  const { typeTab, search, category } = _whFilter;
  if (typeTab !== 'all')  list = list.filter(x => x.type === typeTab);
  if (category !== 'all') list = list.filter(x => x.category_id === category);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(x =>
      (x.name || '').toLowerCase().includes(q) ||
      (x.sku  || '').toLowerCase().includes(q) ||
      _whGetCategoryName(x.category_id).toLowerCase().includes(q)
    );
  }
  return list;
}

function _whRerenderList() {
  if (typeof state === 'undefined' || state.view !== 'warehouse') return;
  const el = document.getElementById('content');
  if (el) renderWarehouseList(el);
}

function setWhFilter(key, val) {
  if (key === 'search') {
    clearTimeout(_whSearchTimer);
    _whSearchTimer = setTimeout(() => { _whFilter.search = val; _whRerenderList(); }, 250);
  } else {
    _whFilter[key] = val;
    _whRerenderList();
  }
}

// ──── Главная страница (список) ─────────────────────────────────
function renderWarehouseList(el) {
  el = el || document.getElementById('content');
  if (!el) return;
  if (typeof setBreadcrumb === 'function') setBreadcrumb('Склад');

  const list  = _whFiltered();
  const total = _whItems.length;

  const catOpts = [
    `<option value="all" ${_whFilter.category === 'all' ? 'selected' : ''}>Все категории</option>`,
    ..._whCategories.map(c =>
      `<option value="${_whEsc(c.id)}" ${_whFilter.category === c.id ? 'selected' : ''}>${_whEsc(c.name)}</option>`
    ),
  ].join('');

  const tabs = [
    { key: 'all',       label: 'Все' },
    { key: 'material',  label: 'Материалы' },
    { key: 'equipment', label: 'Оборудование' },
  ];
  const tabsHtml = tabs.map(t =>
    `<button class="wh-tab ${_whFilter.typeTab === t.key ? 'wh-tab-active' : ''}"
             onclick="setWhFilter('typeTab','${t.key}')">${t.label}</button>`
  ).join('');

  const lowCount = _whItems.filter(item => {
    const q = _whCalcQty(item.id);
    return item.min_qty > 0 && q <= item.min_qty;
  }).length;

  const rows = list.map(item => {
    const qty    = _whCalcQty(item.id);
    const isLow  = item.min_qty > 0 && qty <= item.min_qty;
    const isZero = qty <= 0;
    const catName = _whGetCategoryName(item.category_id);
    return `
    <tr class="wh-tr" onclick="navigate('warehouse-item','${_whEsc(item.id)}')">
      <td>
        <div class="wh-tr-name">${_whEsc(item.name)}</div>
        ${item.sku ? `<div class="wh-tr-sku">${_whEsc(item.sku)}</div>` : ''}
      </td>
      <td>${catName ? `<span class="wh-cat-chip">${_whEsc(catName)}</span>` : '<span style="color:var(--gray-300)">—</span>'}</td>
      <td><span class="wh-type-chip wh-type-${_whEsc(item.type)}">${item.type === 'material' ? 'Материал' : 'Оборудование'}</span></td>
      <td class="wh-td-num">
        <span class="wh-qty-val ${isLow ? 'wh-qty-low' : isZero ? 'wh-qty-zero' : 'wh-qty-ok'}">${_whFmtNum(qty)}</span>
        <span class="wh-td-unit">${_whEsc(item.unit)}</span>
      </td>
      <td class="wh-td-num" style="color:var(--gray-400)">
        ${item.min_qty > 0 ? `${_whFmtNum(item.min_qty)} ${_whEsc(item.unit)}` : '—'}
      </td>
      <td>
        ${isLow
          ? `<span class="wh-status-chip wh-status-low">${iconSvg('warning', 11)} Мало</span>`
          : isZero
            ? `<span class="wh-status-chip wh-status-zero">Нет</span>`
            : `<span class="wh-status-chip wh-status-ok">${iconSvg('check', 11)} OK</span>`}
      </td>
    </tr>`;
  }).join('');

  const tableHtml = list.length === 0
    ? `<div class="wh-empty">${iconSvg('folder', 36)}<div>Позиции не найдены</div><div class="wh-empty-sub">Добавьте первую позицию на склад</div></div>`
    : `<div class="wh-table-wrap">
        <table class="wh-table">
          <thead><tr>
            <th>Наименование</th>
            <th>Категория</th>
            <th>Тип</th>
            <th>Кол-во</th>
            <th>Минимум</th>
            <th>Статус</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

  el.innerHTML = `
  <div class="wh-page-wrap">
    <div class="wh-page-header">
      <div>
        <div class="wh-page-title">Склад</div>
        <div class="wh-page-subtitle">
          ${list.length} из ${total} позиций
          ${lowCount > 0 ? `&nbsp;·&nbsp;<span class="wh-hdr-warn">${iconSvg('warning', 11)} ${lowCount} ниже минимума</span>` : ''}
        </div>
      </div>
      <button class="btn-primary" onclick="openAddWhItemModal()">${iconSvg('plus', 14)} Добавить позицию</button>
    </div>
    <div class="wh-toolbar">
      <div class="wh-tabs">${tabsHtml}</div>
      <div class="wh-filters">
        <input type="text" class="wh-search" placeholder="Поиск по названию, артикулу..."
               value="${_whEsc(_whFilter.search)}"
               oninput="setWhFilter('search', this.value)">
        <select class="wh-select" onchange="setWhFilter('category', this.value)">${catOpts}</select>
      </div>
    </div>
    ${tableHtml}
  </div>`;
}

// ──── Детальная страница позиции ───────────────────────────────
function renderWarehouseItem(el, itemId) {
  el = el || document.getElementById('content');
  if (!el) return;
  const item = _whItems.find(x => x.id === itemId);
  if (!item) { if (typeof navigate === 'function') navigate('warehouse'); return; }

  if (typeof setBreadcrumb === 'function') setBreadcrumb('Склад', item.name || '');

  const qty    = _whCalcQty(itemId);
  const isLow  = item.min_qty > 0 && qty <= item.min_qty;
  const isZero = qty <= 0;
  const catName = _whGetCategoryName(item.category_id);
  const supName = _whGetSupplierName(item.supplier_id);

  const txs = [...(_whTransactions[itemId] || [])].sort((a, b) => {
    const d = (b.date || '').localeCompare(a.date || '');
    return d !== 0 ? d : (b.created_at || '').localeCompare(a.created_at || '');
  });

  const txRows = txs.map(tx => {
    const txDef = WH_TX_TYPES.find(t => t.id === tx.type);
    const isInventory  = tx.type === 'inventory';
    const isPositive   = tx.type === 'receipt';
    const isNegative   = tx.type === 'expense' || tx.type === 'writeoff';
    const signStr = isPositive ? '+' : isNegative ? '−' : '';
    const proj = tx.project_id && typeof VRH_PROJECTS !== 'undefined'
      ? VRH_PROJECTS.find(p => p.id === tx.project_id) : null;
    return `
    <tr class="wh-tx-row">
      <td class="wh-td-date">${_whFmt(tx.date)}</td>
      <td><span class="wh-tx-badge wh-tx-${_whEsc(tx.type)}">${_whEsc(txDef?.label || tx.type)}</span></td>
      <td class="wh-td-num ${isPositive ? 'wh-tx-pos' : isNegative ? 'wh-tx-neg' : ''}">
        ${isInventory ? `= ${_whFmtNum(tx.quantity)}` : `${signStr}${_whFmtNum(tx.quantity)}`}
        <span class="wh-td-unit">${_whEsc(item.unit)}</span>
      </td>
      <td class="wh-td-num" style="color:var(--gray-400)">
        ${tx.price != null ? Number(tx.price).toLocaleString('ru-RU') + ' ₽' : '—'}
      </td>
      <td style="color:var(--gray-600);font-size:13px">
        ${tx.comment ? _whEsc(tx.comment) : ''}
        ${proj ? `<span class="wh-tx-proj">${iconSvg('folder', 11)} ${_whEsc(proj.name)}</span>` : ''}
      </td>
      <td class="wh-tx-actions">
        <button class="wh-icon-btn" onclick="openEditTxModal('${_whEsc(tx.id)}','${_whEsc(itemId)}')" title="Редактировать">${iconSvg('edit', 14)}</button>
        <button class="wh-icon-btn wh-icon-btn-danger" onclick="deleteTx('${_whEsc(tx.id)}','${_whEsc(itemId)}')" title="Удалить">${iconSvg('trash', 14)}</button>
      </td>
    </tr>`;
  }).join('');

  const txSection = txs.length === 0
    ? `<div class="wh-empty wh-empty-sm">${iconSvg('list', 28)}<div>Операций нет</div></div>`
    : `<div class="wh-table-wrap">
        <table class="wh-table wh-tx-table">
          <thead><tr>
            <th>Дата</th><th>Тип</th><th>Кол-во</th><th>Цена / ед.</th><th>Комментарий</th><th></th>
          </tr></thead>
          <tbody>${txRows}</tbody>
        </table>
      </div>`;

  el.innerHTML = `
  <div class="wh-detail-wrap">
    <button class="sup-back-btn" onclick="navigate('warehouse')">${iconSvg('minus', 12)} Назад к складу</button>

    <div class="wh-detail-header">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
          <div class="wh-detail-name">${_whEsc(item.name)}</div>
          ${item.sku ? `<span class="wh-sku-badge">SKU: ${_whEsc(item.sku)}</span>` : ''}
          ${catName ? `<span class="wh-cat-chip">${_whEsc(catName)}</span>` : ''}
          <span class="wh-type-chip wh-type-${_whEsc(item.type)}">${item.type === 'material' ? 'Материал' : 'Оборудование'}</span>
        </div>
      </div>
      <button class="btn-secondary" onclick="openEditWhItemModal('${_whEsc(itemId)}')">${iconSvg('edit', 14)} Редактировать</button>
    </div>

    <div class="wh-detail-stats">
      <div class="wh-stat-card ${isLow ? 'wh-stat-low' : isZero ? 'wh-stat-zero' : ''}">
        <div class="wh-stat-label">На складе</div>
        <div class="wh-stat-value">${_whFmtNum(qty)} <span class="wh-stat-unit">${_whEsc(item.unit)}</span></div>
        ${isLow  ? `<div class="wh-stat-warn">${iconSvg('warning', 12)} Ниже минимума</div>` : ''}
        ${isZero ? `<div class="wh-stat-warn">${iconSvg('warning', 12)} Нет в наличии</div>` : ''}
      </div>
      <div class="wh-stat-card">
        <div class="wh-stat-label">Минимальный остаток</div>
        <div class="wh-stat-value">${_whFmtNum(item.min_qty || 0)} <span class="wh-stat-unit">${_whEsc(item.unit)}</span></div>
      </div>
      <div class="wh-stat-card">
        <div class="wh-stat-label">Операций</div>
        <div class="wh-stat-value">${txs.length}</div>
      </div>
      ${supName ? `<div class="wh-stat-card">
        <div class="wh-stat-label">Поставщик</div>
        <div class="wh-stat-value wh-stat-sup">${_whEsc(supName)}</div>
      </div>` : ''}
    </div>

    ${(item.description || item.notes) ? `
    <div class="wh-detail-info">
      ${item.description ? `<div class="wh-detail-field"><span class="wh-field-label">Описание</span>${_whEsc(item.description)}</div>` : ''}
      ${item.notes       ? `<div class="wh-detail-field"><span class="wh-field-label">Заметки</span>${_whEsc(item.notes)}</div>` : ''}
    </div>` : ''}

    <div class="wh-section-header">
      <div class="wh-section-title">${iconSvg('list', 16)} Журнал операций</div>
      <button class="btn-primary" onclick="openAddTxModal('${_whEsc(itemId)}')">${iconSvg('plus', 14)} Новая операция</button>
    </div>
    ${txSection}
  </div>`;
}

// ──── Единицы измерения ────────────────────────────────────────
const WH_UNITS = [
  { group: 'Штучные',      items: ['шт', 'пара', 'компл', 'упак', 'рул', 'бухта', 'кассета'] },
  { group: 'Длина',        items: ['м', 'п.м', 'мм', 'см', 'км'] },
  { group: 'Площадь',      items: ['м²'] },
  { group: 'Объём',        items: ['м³', 'л', 'мл'] },
  { group: 'Масса',        items: ['кг', 'г', 'т'] },
  { group: 'Листовые',     items: ['лист', 'плита', 'панель'] },
  { group: 'Фасовка',      items: ['мешок', 'ведро', 'канистра', 'баллон', 'тюбик'] },
];

function _whUnitOpts(selected) {
  const sel = selected || 'шт';
  return WH_UNITS.map(g =>
    `<optgroup label="${_whEsc(g.group)}">${
      g.items.map(u => `<option value="${_whEsc(u)}" ${u === sel ? 'selected' : ''}>${_whEsc(u)}</option>`).join('')
    }</optgroup>`
  ).join('');
}

// ──── Модалка: позиция (создание / редактирование) ─────────────
let _whEditingItemId = null;

function openAddWhItemModal() {
  _whEditingItemId = null;
  _openWhItemModal(null);
}

function openEditWhItemModal(itemId) {
  _whEditingItemId = itemId;
  const item = _whItems.find(x => x.id === itemId);
  _openWhItemModal(item || null);
}

function _openWhItemModal(item) {
  const overlay = document.getElementById('modal-overlay');
  const box     = document.getElementById('modal-box');
  if (!overlay || !box) return;

  const catOpts = _whCategories.map(c =>
    `<option value="${_whEsc(c.id)}" ${item?.category_id === c.id ? 'selected' : ''}>${_whEsc(c.name)}</option>`
  ).join('');

  const typeOpts = WH_ITEM_TYPES.map(t =>
    `<option value="${t.id}" ${(item?.type || 'material') === t.id ? 'selected' : ''}>${t.label}</option>`
  ).join('');

  let supOpts = `<option value="">— Не выбран —</option>`;
  if (typeof _suppliers !== 'undefined') {
    supOpts += _suppliers
      .filter(s => s.status !== 'inactive')
      .map(s => `<option value="${_whEsc(s.id)}" ${item?.supplier_id === s.id ? 'selected' : ''}>${_whEsc(s.short_name || s.full_name || '')}</option>`)
      .join('');
  }

  box.innerHTML = `
  <div class="modal-header">
    <span class="modal-title">${item ? 'Редактировать позицию' : 'Новая позиция'}</span>
    <button class="modal-close" onclick="closeModal()">${iconSvg('x', 14)}</button>
  </div>
  <div class="wh-modal-body">
    <div class="wh-grid2">
      <div>
        <label class="mn-label">Наименование *</label>
        <input class="mn-input" id="wh-inp-name" type="text" placeholder="Труба ПП 32мм"
               value="${_whEsc(item?.name || '')}">
      </div>
      <div>
        <label class="mn-label">Артикул / SKU</label>
        <input class="mn-input" id="wh-inp-sku" type="text" placeholder="TP-32"
               value="${_whEsc(item?.sku || '')}">
      </div>
      <div>
        <label class="mn-label">Тип</label>
        <select class="mn-input" id="wh-inp-type">${typeOpts}</select>
      </div>
      <div>
        <label class="mn-label">Категория</label>
        <select class="mn-input" id="wh-inp-cat">
          <option value="">— Без категории —</option>
          ${catOpts}
        </select>
      </div>
      <div>
        <label class="mn-label">Единица измерения</label>
        <select class="mn-input" id="wh-inp-unit">${_whUnitOpts(item?.unit || 'шт')}</select>
      </div>
      <div>
        <label class="mn-label">Минимальный остаток</label>
        <input class="mn-input" id="wh-inp-minqty" type="number" min="0" step="0.01"
               placeholder="0" value="${item?.min_qty ?? 0}">
      </div>
    </div>
    <div style="margin-top:14px">
      <label class="mn-label">Поставщик</label>
      <select class="mn-input" id="wh-inp-sup">${supOpts}</select>
    </div>
    <div style="margin-top:14px">
      <label class="mn-label">Описание</label>
      <textarea class="mn-input" id="wh-inp-desc" rows="2"
                placeholder="Краткое описание позиции...">${_whEsc(item?.description || '')}</textarea>
    </div>
    <div style="margin-top:14px">
      <label class="mn-label">Заметки</label>
      <textarea class="mn-input" id="wh-inp-notes" rows="2"
                placeholder="Внутренние заметки...">${_whEsc(item?.notes || '')}</textarea>
    </div>
  </div>
  <div class="wh-modal-footer">
    ${item
      ? `<button class="mn-btn-danger" onclick="deleteWhItem('${_whEsc(item.id)}')">${iconSvg('trash', 14)} Удалить</button>`
      : '<div></div>'}
    <div style="display:flex;gap:8px">
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="btn-primary" onclick="saveWhItem('${_whEsc(item?.id || '')}')">${iconSvg('save', 14)} Сохранить</button>
    </div>
  </div>`;

  overlay.classList.add('open');
  requestAnimationFrame(() => document.getElementById('wh-inp-name')?.focus());
}

function saveWhItem(itemId) {
  const name = document.getElementById('wh-inp-name')?.value.trim();
  if (!name) { if (typeof showToast === 'function') showToast('Введите наименование'); return; }

  const sku    = document.getElementById('wh-inp-sku')?.value.trim()   || null;
  const type   = document.getElementById('wh-inp-type')?.value         || 'material';
  const catId  = document.getElementById('wh-inp-cat')?.value          || null;
  const unit   = document.getElementById('wh-inp-unit')?.value.trim()  || 'шт';
  const minQty = parseFloat(document.getElementById('wh-inp-minqty')?.value) || 0;
  const supId  = document.getElementById('wh-inp-sup')?.value          || null;
  const desc   = document.getElementById('wh-inp-desc')?.value.trim()  || null;
  const notes  = document.getElementById('wh-inp-notes')?.value.trim() || null;

  const isNew = !itemId;
  const id    = itemId || `whi_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

  const record = {
    id, name,
    sku:         sku         || null,
    category_id: catId       || null,
    type,
    unit,
    min_qty:     minQty,
    description: desc        || null,
    supplier_id: supId       || null,
    notes:       notes       || null,
    created_at:  isNew ? new Date().toISOString() : (_whItems.find(x => x.id === id)?.created_at || new Date().toISOString()),
  };

  if (isNew) {
    _whItems.push(record);
  } else {
    const idx = _whItems.findIndex(x => x.id === id);
    if (idx !== -1) Object.assign(_whItems[idx], record);
  }

  _whSaveItem(record);
  if (typeof closeModal === 'function') closeModal();
  if (typeof showToast === 'function') showToast(isNew ? 'Позиция добавлена' : 'Позиция сохранена');

  const el = document.getElementById('content');
  if (!el) return;
  if (typeof state !== 'undefined') {
    if (state.view === 'warehouse')       renderWarehouseList(el);
    else if (state.view === 'warehouse-item') renderWarehouseItem(el, id);
  }
}

function deleteWhItem(itemId) {
  if (!confirm('Удалить позицию? Все операции по ней будут также удалены.')) return;
  _whItems = _whItems.filter(x => x.id !== itemId);
  delete _whTransactions[itemId];
  if (typeof closeModal === 'function') closeModal();
  if (_sb) {
    (async () => {
      try {
        await _sb.from('inventory_items').delete().eq('id', itemId);
        if (typeof showToast === 'function') showToast('Позиция удалена');
      } catch(e) { console.error('deleteWhItem:', e); }
    })();
  } else {
    if (typeof showToast === 'function') showToast('Позиция удалена');
  }
  if (typeof navigate === 'function') navigate('warehouse');
}

// ──── Модалка: операция (создание / редактирование) ─────────────
function openAddTxModal(itemId) {
  _openTxModal(null, itemId);
}

function openEditTxModal(txId, itemId) {
  const tx = (_whTransactions[itemId] || []).find(x => x.id === txId) || null;
  _openTxModal(tx, itemId);
}

function _openTxModal(tx, itemId) {
  const item  = _whItems.find(x => x.id === itemId);
  const today = new Date().toISOString().slice(0, 10);

  const overlay = document.getElementById('modal-overlay');
  const box     = document.getElementById('modal-box');
  if (!overlay || !box) return;

  const curType = tx?.type || 'receipt';

  const typeChips = WH_TX_TYPES.map(t => `
    <button type="button" class="wh-tx-chip wh-tx-chip-${_whEsc(t.id)} ${curType === t.id ? 'wh-tx-chip-active' : ''}"
            data-txtype="${t.id}" onclick="_whSelectTxType('${t.id}')">${_whEsc(t.label)}</button>`
  ).join('');

  let projOpts = `<option value="">— Не указан —</option>`;
  if (typeof VRH_PROJECTS !== 'undefined') {
    projOpts += VRH_PROJECTS.map(p =>
      `<option value="${_whEsc(p.id)}" ${tx?.project_id === p.id ? 'selected' : ''}>${_whEsc(p.name)}</option>`
    ).join('');
  }

  box.innerHTML = `
  <div class="modal-header">
    <span class="modal-title">${tx ? 'Редактировать операцию' : 'Новая операция'}</span>
    <button class="modal-close" onclick="closeModal()">${iconSvg('x', 14)}</button>
  </div>
  <div class="wh-modal-body">
    ${item ? `<div class="wh-modal-item-ref">${iconSvg('folder', 13)} ${_whEsc(item.name)}</div>` : ''}
    <div style="margin-bottom:16px">
      <label class="mn-label">Тип операции</label>
      <div class="wh-tx-chips">${typeChips}</div>
    </div>
    <div class="wh-grid2">
      <div>
        <label class="mn-label" id="wh-qty-label">${curType === 'inventory' ? 'Фактическое количество *' : 'Количество *'}</label>
        <input class="mn-input" id="wh-inp-qty" type="number" min="0" step="0.01"
               placeholder="0" value="${tx ? tx.quantity : ''}">
      </div>
      <div>
        <label class="mn-label">Дата *</label>
        <input class="mn-input" id="wh-inp-date" type="date" value="${tx?.date || today}">
      </div>
      <div>
        <label class="mn-label">Цена за ед., ₽</label>
        <input class="mn-input" id="wh-inp-price" type="number" min="0" step="0.01"
               placeholder="Опционально" value="${tx?.price != null ? tx.price : ''}">
      </div>
      <div>
        <label class="mn-label">Проект</label>
        <select class="mn-input" id="wh-inp-proj">${projOpts}</select>
      </div>
    </div>
    <div style="margin-top:14px">
      <label class="mn-label">Комментарий</label>
      <input class="mn-input" id="wh-inp-txcomment" type="text"
             placeholder="Комментарий к операции..." value="${_whEsc(tx?.comment || '')}">
    </div>
  </div>
  <div class="wh-modal-footer">
    ${tx
      ? `<button class="mn-btn-danger" onclick="deleteTx('${_whEsc(tx.id)}','${_whEsc(itemId)}')">${iconSvg('trash', 14)} Удалить</button>`
      : '<div></div>'}
    <div style="display:flex;gap:8px">
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="btn-primary" onclick="saveTx('${_whEsc(itemId)}','${_whEsc(tx?.id || '')}')">${iconSvg('save', 14)} Сохранить</button>
    </div>
  </div>`;

  overlay.classList.add('open');
  requestAnimationFrame(() => document.getElementById('wh-inp-qty')?.focus());
}

function _whSelectTxType(typeId) {
  document.querySelectorAll('[data-txtype]').forEach(btn => {
    btn.classList.toggle('wh-tx-chip-active', btn.dataset.txtype === typeId);
  });
  const label = document.getElementById('wh-qty-label');
  if (label) label.textContent = typeId === 'inventory' ? 'Фактическое количество *' : 'Количество *';
}

function saveTx(itemId, txId) {
  const typeChip = document.querySelector('[data-txtype].wh-tx-chip-active');
  const txType   = typeChip?.dataset.txtype || 'receipt';
  const qtyRaw   = parseFloat(document.getElementById('wh-inp-qty')?.value);
  if (isNaN(qtyRaw) || qtyRaw < 0) {
    if (typeof showToast === 'function') showToast('Введите корректное количество');
    return;
  }
  const date    = document.getElementById('wh-inp-date')?.value || new Date().toISOString().slice(0, 10);
  const priceRaw = parseFloat(document.getElementById('wh-inp-price')?.value);
  const projId  = document.getElementById('wh-inp-proj')?.value  || null;
  const comment = document.getElementById('wh-inp-txcomment')?.value.trim() || '';

  const isNew = !txId;
  const id    = txId || `whtx_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

  const record = {
    id,
    item_id:    itemId,
    type:       txType,
    quantity:   qtyRaw,
    price:      isNaN(priceRaw) ? null : priceRaw,
    date,
    comment:    comment || null,
    project_id: projId  || null,
    created_at: isNew
      ? new Date().toISOString()
      : ((_whTransactions[itemId] || []).find(x => x.id === txId)?.created_at || new Date().toISOString()),
  };

  if (!_whTransactions[itemId]) _whTransactions[itemId] = [];
  if (isNew) {
    _whTransactions[itemId].push(record);
  } else {
    const idx = _whTransactions[itemId].findIndex(x => x.id === txId);
    if (idx !== -1) _whTransactions[itemId][idx] = record;
    else _whTransactions[itemId].push(record);
  }

  _whSaveTx(record);
  if (typeof closeModal === 'function') closeModal();
  if (typeof showToast === 'function') showToast(isNew ? 'Операция добавлена' : 'Операция сохранена');

  const el = document.getElementById('content');
  if (el) renderWarehouseItem(el, itemId);
}

function deleteTx(txId, itemId) {
  if (!confirm('Удалить операцию?')) return;
  if (_whTransactions[itemId]) {
    _whTransactions[itemId] = _whTransactions[itemId].filter(x => x.id !== txId);
  }
  if (typeof closeModal === 'function') closeModal();
  if (_sb) {
    (async () => {
      try {
        await _sb.from('inventory_transactions').delete().eq('id', txId);
        if (typeof showToast === 'function') showToast('Операция удалена');
      } catch(e) { console.error('deleteTx:', e); }
    })();
  } else {
    if (typeof showToast === 'function') showToast('Операция удалена');
  }
  const el = document.getElementById('content');
  if (el) renderWarehouseItem(el, itemId);
}

// ──── Supabase (fire-and-forget) ───────────────────────────────
function _whSaveItem(item) {
  if (!_sb) return;
  (async () => {
    try {
      await _sb.from('inventory_items').upsert({
        id:          item.id,
        name:        item.name,
        sku:         item.sku,
        category_id: item.category_id,
        type:        item.type,
        unit:        item.unit,
        min_qty:     item.min_qty,
        description: item.description,
        supplier_id: item.supplier_id,
        notes:       item.notes,
      });
    } catch(e) { console.error('_whSaveItem:', e); }
  })();
}

function _whSaveTx(tx) {
  if (!_sb) return;
  (async () => {
    try {
      await _sb.from('inventory_transactions').upsert({
        id:         tx.id,
        item_id:    tx.item_id,
        type:       tx.type,
        quantity:   tx.quantity,
        price:      tx.price,
        date:       tx.date,
        comment:    tx.comment,
        project_id: tx.project_id,
      });
    } catch(e) { console.error('_whSaveTx:', e); }
  })();
}

// ──── Экспорт ───────────────────────────────────────────────────
window.loadWarehouseData   = loadWarehouseData;
window.renderWarehouseList = renderWarehouseList;
window.renderWarehouseItem = renderWarehouseItem;
window.setWhFilter         = setWhFilter;
window.openAddWhItemModal  = openAddWhItemModal;
window.openEditWhItemModal = openEditWhItemModal;
window.saveWhItem          = saveWhItem;
window.deleteWhItem        = deleteWhItem;
window.openAddTxModal      = openAddTxModal;
window.openEditTxModal     = openEditTxModal;
window._whSelectTxType     = _whSelectTxType;
window.saveTx              = saveTx;
window.deleteTx            = deleteTx;
