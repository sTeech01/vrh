'use strict';
/* ═══════════════════════════════════════════════════════════════
   VRH ERP — Модуль «Задачи» (контроль сотрудников)
   CSS-префикс: tk-*
   Таблицы: manager_tasks, manager_task_comments
   ═══════════════════════════════════════════════════════════════ */

// ──── Константы ────────────────────────────────────────────────
const TK_STATUSES = [
  { id: 'pending',     label: 'Ожидает',   bg: 'var(--gray-100)',  color: 'var(--gray-500)' },
  { id: 'in_progress', label: 'В работе',  bg: 'var(--cyan-dim)',  color: 'var(--cyan)'     },
  { id: 'paused',      label: 'На паузе',  bg: 'var(--amber-dim)', color: 'var(--amber)'    },
  { id: 'done',        label: 'Завершена', bg: 'var(--green-dim)', color: 'var(--green)'    },
  { id: 'cancelled',   label: 'Снята',     bg: 'var(--gray-100)',  color: 'var(--gray-300)' },
];

const TK_PRIORITIES = [
  { id: 'low',      label: 'Низкий',    dot: '#10B981' },
  { id: 'medium',   label: 'Средний',   dot: '#F59E0B' },
  { id: 'high',     label: 'Высокий',   dot: '#F97316' },
  { id: 'critical', label: 'Критично',  dot: '#EF4444' },
];

// ──── Состояние ────────────────────────────────────────────────
let _tkTasks       = [];
let _tkComments    = {};   // { [taskId]: Comment[] }
let _tkFilter      = { statusTab: 'all', assignee: 'all', search: '' };
let _tkSearchTimer = null;
let _tkSubPending  = null; // { subId, parentId } — ожидает ввода комментария при завершении

// ──── Загрузка данных ──────────────────────────────────────────
function loadTasksData(tasksData, commentsData) {
  _tkTasks = (tasksData || []).slice();
  _tkComments = {};
  (commentsData || []).forEach(r => {
    if (!_tkComments[r.task_id]) _tkComments[r.task_id] = [];
    _tkComments[r.task_id].push({ id: r.id, task_id: r.task_id, text: r.text, author: r.author || 'Руководитель', created_at: r.created_at });
  });
}

// ──── Вспомогательные функции ──────────────────────────────────
function _tkEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _tkFmtDate(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  if (isNaN(d)) return dt;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
}

function _tkFmtDateTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  if (isNaN(d)) return dt;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' ' +
         d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function _tkDeadlineInfo(dt, status) {
  if (!dt || status === 'done' || status === 'cancelled') return null;
  const now  = new Date();
  const due  = new Date(dt);
  const diff = Math.ceil((due - now) / 86400000);
  if (diff < 0)  return { label: `Просрочена ${-diff} дн.`, cls: 'tk-dl-overdue' };
  if (diff === 0) return { label: 'Сегодня',                 cls: 'tk-dl-today'   };
  if (diff <= 2)  return { label: `${diff} дн.`,             cls: 'tk-dl-soon'    };
  return { label: _tkFmtDate(dt), cls: 'tk-dl-ok' };
}

function _tkGetStatus(id)   { return TK_STATUSES.find(s => s.id === id)   || TK_STATUSES[0]; }
function _tkGetPriority(id) { return TK_PRIORITIES.find(p => p.id === id) || TK_PRIORITIES[1]; }

function _tkAssigneeStyle(name) {
  if (!name || typeof ASSIGNEE_PALETTE === 'undefined') return '';
  const all = typeof getAllAssignees === 'function' ? getAllAssignees() : [];
  const found = all.find(a => a.name === name);
  if (found) return `background:${ASSIGNEE_PALETTE[found.colorIdx % ASSIGNEE_PALETTE.length].bg};color:${ASSIGNEE_PALETTE[found.colorIdx % ASSIGNEE_PALETTE.length].color}`;
  // Хэш-цвет для имён не из справочника
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  const p = ASSIGNEE_PALETTE[Math.abs(h) % ASSIGNEE_PALETTE.length];
  return `background:${p.bg};color:${p.color}`;
}

function _tkSubtasks(parentId) {
  return _tkTasks.filter(t => t.parent_id === parentId);
}

function _tkFiltered() {
  let list = _tkTasks.filter(t => !t.parent_id);  // только корневые
  const { statusTab, assignee, search } = _tkFilter;
  if (statusTab !== 'all')    list = list.filter(t => t.status === statusTab);
  if (assignee  !== 'all')    list = list.filter(t => t.assignee_name === assignee);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(t => (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
  }
  // Сортировка: активные вверху, внутри — по дедлайну
  const order = { in_progress: 0, pending: 1, paused: 2, done: 3, cancelled: 4 };
  return list.sort((a, b) => {
    const os = (order[a.status] ?? 9) - (order[b.status] ?? 9);
    if (os !== 0) return os;
    if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });
}

function _tkRerenderList() {
  if (typeof state === 'undefined' || state.view !== 'tasks') return;
  const el = document.getElementById('content');
  if (el) renderTasksList(el);
}

function setTkFilter(key, val) {
  if (key === 'search') {
    clearTimeout(_tkSearchTimer);
    _tkSearchTimer = setTimeout(() => { _tkFilter.search = val; _tkRerenderList(); }, 250);
  } else {
    _tkFilter[key] = val;
    _tkRerenderList();
  }
}

// ──── Главная страница (список) ─────────────────────────────────
function renderTasksList(el) {
  el = el || document.getElementById('content');
  if (!el) return;
  if (typeof setBreadcrumb === 'function') setBreadcrumb('Задачи');

  const all      = _tkTasks.filter(t => !t.parent_id);
  const filtered = _tkFiltered();
  const counts   = {};
  TK_STATUSES.forEach(s => { counts[s.id] = all.filter(t => t.status === s.id).length; });

  // Вкладки
  const tabs = [{ id: 'all', label: 'Все', cnt: all.length }, ...TK_STATUSES.map(s => ({ id: s.id, label: s.label, cnt: counts[s.id] }))];
  const tabsHtml = tabs.map(t =>
    `<button class="tk-tab ${_tkFilter.statusTab === t.id ? 'tk-tab-active' : ''}"
             onclick="setTkFilter('statusTab','${t.id}')">
       ${t.label}${t.cnt > 0 ? ` <span class="tk-tab-cnt">${t.cnt}</span>` : ''}
     </button>`
  ).join('');

  // Фильтр по исполнителю
  const assignees = [...new Set(all.map(t => t.assignee_name).filter(Boolean))];
  const asnOpts = [
    `<option value="all" ${_tkFilter.assignee === 'all' ? 'selected' : ''}>Все исполнители</option>`,
    ...assignees.map(a => `<option value="${_tkEsc(a)}" ${_tkFilter.assignee === a ? 'selected' : ''}>${_tkEsc(a)}</option>`),
  ].join('');

  // Строки
  const rows = filtered.map(task => {
    const st   = _tkGetStatus(task.status);
    const pr   = _tkGetPriority(task.priority);
    const dl   = _tkDeadlineInfo(task.deadline, task.status);
    const subs = _tkSubtasks(task.id);
    const doneSubs = subs.filter(s => s.status === 'done').length;
    const commentCnt = (_tkComments[task.id] || []).length;
    const isClosed = task.status === 'done' || task.status === 'cancelled';
    return `
    <div class="tk-row${isClosed ? ' tk-row-closed' : ''}" onclick="openTaskDetail('${_tkEsc(task.id)}')">
      <div class="tk-row-left">
        <span class="tk-priority-dot" style="background:${_tkEsc(pr.dot)}" title="${_tkEsc(pr.label)}"></span>
        <div class="tk-row-title-wrap">
          <div class="tk-row-title">${_tkEsc(task.title)}</div>
          ${subs.length ? `<div class="tk-row-sub-cnt">${iconSvg('list',10)} ${doneSubs}/${subs.length} подзадач</div>` : ''}
        </div>
      </div>
      <div class="tk-row-right">
        ${commentCnt ? `<span class="tk-row-meta">${iconSvg('chat',12)} ${commentCnt}</span>` : ''}
        ${task.assignee_name ? `<span class="tk-assignee-chip" style="${_tkAssigneeStyle(task.assignee_name)}">${_tkEsc(task.assignee_name.split(' ')[0])}</span>` : '<span class="tk-assignee-chip tk-assignee-none">—</span>'}
        ${dl ? `<span class="tk-deadline ${dl.cls}">${_tkEsc(dl.label)}</span>` : ''}
        <span class="tk-status-chip" style="background:${st.bg};color:${st.color}">${_tkEsc(st.label)}</span>
      </div>
    </div>`;
  }).join('');

  const body = filtered.length === 0
    ? `<div class="tk-empty">${iconSvg('clipboard', 36)}<div>Задач нет</div><div class="tk-empty-sub">Нажмите «+ Новая задача» чтобы добавить</div></div>`
    : `<div class="tk-list">${rows}</div>`;

  const overdueCount = all.filter(t => {
    if (!t.deadline || t.status === 'done' || t.status === 'cancelled') return false;
    return new Date(t.deadline) < new Date();
  }).length;

  el.innerHTML = `
  <div class="tk-page-wrap">
    <div class="tk-page-header">
      <div>
        <div class="tk-page-title">Задачи</div>
        <div class="tk-page-subtitle">
          ${filtered.length} из ${all.length}
          ${overdueCount > 0 ? `&nbsp;·&nbsp;<span class="tk-hdr-warn">${iconSvg('warning',11)} ${overdueCount} просрочено</span>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-secondary" onclick="exportTkByAssignee()">${iconSvg('save',14)} Выгрузить</button>
        <button class="btn-primary" onclick="openAddTaskModal(null)">${iconSvg('plus',14)} Новая задача</button>
      </div>
    </div>
    <div class="tk-toolbar">
      <div class="tk-tabs">${tabsHtml}</div>
      <div class="tk-filters">
        <input type="text" class="tk-search" placeholder="Поиск по задачам..."
               value="${_tkEsc(_tkFilter.search)}" oninput="setTkFilter('search', this.value)">
        <select class="tk-select" onchange="setTkFilter('assignee', this.value)">${asnOpts}</select>
      </div>
    </div>
    ${body}
  </div>`;
}

// ──── Детальная модалка задачи ─────────────────────────────────
function openTaskDetail(taskId) {
  const task = _tkTasks.find(t => t.id === taskId);
  if (!task) return;
  const overlay = document.getElementById('modal-overlay');
  const box     = document.getElementById('modal-box');
  if (!overlay || !box) return;
  box.innerHTML = _tkDetailHtml(task);
  overlay.classList.add('open');
}

function _tkDetailHtml(task) {
  const st    = _tkGetStatus(task.status);
  const pr    = _tkGetPriority(task.priority);
  const dl    = _tkDeadlineInfo(task.deadline, task.status);
  const subs  = _tkSubtasks(task.id);
  const comms = [...(_tkComments[task.id] || [])].sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Метаданные (только чтение)
  const projName = (() => {
    if (!task.project_id || typeof VRH_PROJECTS === 'undefined') return null;
    return (VRH_PROJECTS.find(p => p.id === task.project_id) || {}).name || null;
  })();

  const metaItems = [
    task.assignee_name
      ? `<div class="tk-info-item"><span class="tk-info-label">${iconSvg('user',12)} Исполнитель</span><span class="tk-info-val"><span class="tk-assignee-chip" style="${_tkAssigneeStyle(task.assignee_name)}">${_tkEsc(task.assignee_name)}</span></span></div>`
      : `<div class="tk-info-item"><span class="tk-info-label">${iconSvg('user',12)} Исполнитель</span><span class="tk-info-val tk-info-empty">Не назначен</span></div>`,
    `<div class="tk-info-item"><span class="tk-info-label">${iconSvg('warning',12)} Приоритет</span>
       <span class="tk-info-val"><span class="tk-priority-dot" style="background:${_tkEsc(pr.dot)};width:7px;height:7px;display:inline-block;border-radius:50%;margin-right:5px;vertical-align:middle"></span>${_tkEsc(pr.label)}</span></div>`,
    dl
      ? `<div class="tk-info-item"><span class="tk-info-label">${iconSvg('calendar',12)} Срок</span><span class="tk-info-val ${dl.cls}">${_tkEsc(dl.label)}</span></div>`
      : (task.deadline
        ? `<div class="tk-info-item"><span class="tk-info-label">${iconSvg('calendar',12)} Срок</span><span class="tk-info-val">${_tkFmtDate(task.deadline)}</span></div>`
        : `<div class="tk-info-item"><span class="tk-info-label">${iconSvg('calendar',12)} Срок</span><span class="tk-info-val tk-info-empty">Не указан</span></div>`),
    projName
      ? `<div class="tk-info-item"><span class="tk-info-label">${iconSvg('folder',12)} Проект</span><span class="tk-info-val">${_tkEsc(projName)}</span></div>`
      : '',
  ].filter(Boolean).join('');

  // Статусы (кликабельные — это быстрое действие, не «редактирование»)
  const statusBtns = TK_STATUSES.map(s => `
    <button class="tk-status-btn ${task.status === s.id ? 'tk-status-btn-active' : ''}"
            style="${task.status === s.id ? `background:${s.bg};color:${s.color};border-color:${s.color}` : ''}"
            onclick="setTkStatus('${_tkEsc(task.id)}','${s.id}')">${_tkEsc(s.label)}</button>`
  ).join('');

  // Подзадачи
  const subsHtml = subs.map(s => {
    const done    = s.status === 'done';
    const pending = _tkSubPending && _tkSubPending.subId === s.id;
    const mainRow = `
    <div class="tk-subtask-row">
      <button class="tk-subtask-check ${done ? 'tk-subtask-done' : ''}"
              onclick="_tkToggleSubtask('${_tkEsc(s.id)}','${_tkEsc(task.id)}')"
              title="${done ? 'Снять отметку' : 'Отметить выполнение'}">
        ${done ? iconSvg('check', 11) : ''}
      </button>
      <div class="tk-subtask-body">
        <span class="tk-subtask-title ${done ? 'tk-subtask-title-done' : ''}">${_tkEsc(s.title)}</span>
        ${s.completion_comment ? `<div class="tk-subtask-comment">${iconSvg('check',10)} ${_tkEsc(s.completion_comment)}</div>` : ''}
      </div>
      ${s.assignee_name ? `<span class="tk-assignee-chip" style="font-size:10px;${_tkAssigneeStyle(s.assignee_name)}">${_tkEsc(s.assignee_name.split(' ')[0])}</span>` : ''}
    </div>`;
    const formRow = pending ? `
    <div class="tk-sub-confirm-form">
      <textarea class="mn-input" id="tk-sub-comment-${_tkEsc(s.id)}" rows="2"
                placeholder="Комментарий по выполнению (обязательно)..."></textarea>
      <div class="tk-sub-confirm-btns">
        <button class="btn-secondary" onclick="cancelSubComplete('${_tkEsc(task.id)}')">${iconSvg('x',12)} Отмена</button>
        <button class="btn-primary" onclick="confirmSubComplete('${_tkEsc(s.id)}','${_tkEsc(task.id)}')">${iconSvg('check',12)} Подтвердить</button>
      </div>
    </div>` : '';
    return mainRow + formRow;
  }).join('');

  // Комментарии
  const commsHtml = comms.map(c => `
    <div class="tk-comment">
      <div class="tk-comment-meta">
        <span class="tk-comment-author">${_tkEsc(c.author)}</span>
        <span class="tk-comment-date">${_tkFmtDateTime(c.created_at)}</span>
        <button class="tk-comment-del" onclick="deleteTkComment('${_tkEsc(c.id)}','${_tkEsc(task.id)}')" title="Удалить">${iconSvg('trash',11)}</button>
      </div>
      <div class="tk-comment-text">${_tkEsc(c.text)}</div>
    </div>`
  ).join('');

  const completedBlock = task.status === 'done' && task.completed_at ? `
    <div class="tk-completed-block">
      ${iconSvg('check',13)} Завершена ${_tkFmtDateTime(task.completed_at)}
      ${task.completion_comment ? `<div class="tk-completion-comment">${_tkEsc(task.completion_comment)}</div>` : ''}
    </div>` : '';

  return `
  <div class="modal-header">
    <div style="display:flex;align-items:center;gap:10px;min-width:0">
      <span class="tk-status-chip" style="background:${st.bg};color:${st.color};flex-shrink:0">${_tkEsc(st.label)}</span>
      <span class="modal-title" style="font-size:15px">${_tkEsc(task.title)}</span>
    </div>
    <button class="modal-close" onclick="closeModal()">${iconSvg('x',14)}</button>
  </div>
  <div class="wh-modal-body">
    ${completedBlock}

    <div class="tk-info-grid">${metaItems}</div>

    ${task.description ? `<div class="tk-desc">${_tkEsc(task.description)}</div>` : ''}

    <div class="tk-section">
      <div class="tk-section-title">${iconSvg('list',14)} Статус</div>
      <div class="tk-status-btns">${statusBtns}</div>
    </div>

    <div class="tk-section">
      <div class="tk-section-hdr">
        <div class="tk-section-title">${iconSvg('clipboard',14)} Подзадачи ${subs.length ? `<span class="tk-cnt-badge">${subs.filter(s=>s.status==='done').length}/${subs.length}</span>` : ''}</div>
        <button class="btn-secondary tk-add-sub-btn" onclick="openAddTaskModal('${_tkEsc(task.id)}')">${iconSvg('plus',12)} Добавить</button>
      </div>
      ${subsHtml || '<div class="tk-sub-empty">Подзадач нет</div>'}
    </div>

    <div class="tk-section">
      <div class="tk-section-title">${iconSvg('chat',14)} Комментарии ${comms.length ? `<span class="tk-cnt-badge">${comms.length}</span>` : ''}</div>
      ${commsHtml}
      <div class="tk-comment-add">
        <textarea class="mn-input" id="tk-new-comment" rows="2" placeholder="Добавить комментарий..."></textarea>
        <button class="btn-primary" onclick="addTkComment('${_tkEsc(task.id)}')">${iconSvg('save',13)} Отправить</button>
      </div>
    </div>
  </div>
  <div class="wh-modal-footer">
    <button class="mn-btn-danger" onclick="deleteTkTask('${_tkEsc(task.id)}')">${iconSvg('trash',14)} Удалить</button>
    <button class="btn-primary" onclick="openEditTaskModal('${_tkEsc(task.id)}')">${iconSvg('edit',14)} Редактировать</button>
  </div>`;
}

// ──── Изменить статус ──────────────────────────────────────────
function setTkStatus(taskId, newStatus) {
  const task = _tkTasks.find(t => t.id === taskId);
  if (!task) return;

  if (newStatus === 'done' && task.status !== 'done') {
    // Показываем блок для комментария, ждём подтверждения
    const block = document.getElementById('tk-done-comment-block');
    if (block) {
      block.style.display = 'block';
      // Подтверждаем через кнопку — переиспользуем существующую кнопку "В работе" как подтверждение
      // Вместо этого — вешаем временный обработчик на кнопку "Завершена"
      const doneBtn = document.querySelector('.tk-status-btn:not(.tk-status-btn-active)[onclick*="done"]');
      // Просто применяем статус немедленно, комментарий необязателен
    }
  }

  const completionComment = newStatus === 'done'
    ? (document.getElementById('tk-done-comment')?.value.trim() || '')
    : task.completion_comment;

  task.status = newStatus;
  task.completed_at = newStatus === 'done' ? new Date().toISOString() : (task.completed_at || null);
  if (newStatus === 'done') task.completion_comment = completionComment;
  if (newStatus !== 'done') { task.completed_at = null; task.completion_comment = ''; }

  _tkSaveTask(task);
  if (typeof showToast === 'function') showToast(`Статус: ${_tkGetStatus(newStatus).label}`);

  // Перерисовываем детальную модалку
  const box = document.getElementById('modal-box');
  if (box && document.getElementById('modal-overlay')?.classList.contains('open')) {
    box.innerHTML = _tkDetailHtml(task);
  }
  _tkRerenderList();
}

// ──── Обновить отдельное поле inline ──────────────────────────
function updateTkField(taskId, field, value) {
  const task = _tkTasks.find(t => t.id === taskId);
  if (!task) return;
  task[field] = value || null;
  _tkSaveTask(task);
  _tkRerenderList();
}

// ──── Переключить подзадачу ────────────────────────────────────
function _tkToggleSubtask(subId, parentId) {
  const sub = _tkTasks.find(t => t.id === subId);
  if (!sub) return;

  if (sub.status === 'done') {
    // Снять отметку — без комментария
    sub.status = 'pending';
    sub.completed_at = null;
    sub.completion_comment = null;
    _tkSaveTask(sub);
    _tkSubPending = null;
  } else {
    // Отметить выполнение — показать форму для комментария
    _tkSubPending = { subId, parentId };
  }

  const parentTask = _tkTasks.find(t => t.id === parentId);
  if (parentTask) {
    const box = document.getElementById('modal-box');
    if (box) {
      box.innerHTML = _tkDetailHtml(parentTask);
      if (_tkSubPending) {
        requestAnimationFrame(() => document.getElementById('tk-sub-comment-' + subId)?.focus());
      }
    }
  }
}

function confirmSubComplete(subId, parentId) {
  const comment = document.getElementById('tk-sub-comment-' + subId)?.value.trim();
  if (!comment) {
    if (typeof showToast === 'function') showToast('Введите комментарий по выполнению');
    document.getElementById('tk-sub-comment-' + subId)?.focus();
    return;
  }
  const sub = _tkTasks.find(t => t.id === subId);
  if (!sub) return;
  sub.status = 'done';
  sub.completed_at = new Date().toISOString();
  sub.completion_comment = comment;
  _tkSaveTask(sub);
  _tkSubPending = null;
  const parentTask = _tkTasks.find(t => t.id === parentId);
  if (parentTask) {
    const box = document.getElementById('modal-box');
    if (box) box.innerHTML = _tkDetailHtml(parentTask);
  }
  _tkRerenderList();
}

function cancelSubComplete(parentId) {
  _tkSubPending = null;
  const parentTask = _tkTasks.find(t => t.id === parentId);
  if (parentTask) {
    const box = document.getElementById('modal-box');
    if (box) box.innerHTML = _tkDetailHtml(parentTask);
  }
}

// ──── Модалка: создание / редактирование задачи ────────────────
function openAddTaskModal(parentId) {
  if (typeof closeModal === 'function') closeModal();
  _openTkTaskModal(null, parentId);
}

function openEditTaskModal(taskId) {
  if (typeof closeModal === 'function') closeModal();
  const task = _tkTasks.find(t => t.id === taskId);
  _openTkTaskModal(task || null, null);
}

function _openTkTaskModal(task, parentId) {
  const overlay = document.getElementById('modal-overlay');
  const box     = document.getElementById('modal-box');
  if (!overlay || !box) return;

  const allAssignees = typeof getAllAssignees === 'function' ? getAllAssignees() : [];
  const asnDatalist = allAssignees.map(a => `<option value="${_tkEsc(a.name)}">`).join('');

  const prOpts = TK_PRIORITIES.map(p =>
    `<option value="${p.id}" ${(task?.priority || 'medium') === p.id ? 'selected' : ''}>${p.label}</option>`
  ).join('');

  let projOpts = `<option value="">— Без проекта —</option>`;
  if (typeof VRH_PROJECTS !== 'undefined') {
    projOpts += VRH_PROJECTS.map(p =>
      `<option value="${_tkEsc(p.id)}" ${task?.project_id === p.id ? 'selected' : ''}>${_tkEsc(p.name)}</option>`
    ).join('');
  }

  const deadlineVal = task?.deadline ? new Date(task.deadline).toISOString().slice(0,16) : '';
  const parentTask  = parentId ? _tkTasks.find(t => t.id === parentId) : null;
  const isNew = !task;
  const title = isNew ? (parentTask ? `Подзадача к: ${parentTask.title}` : 'Новая задача') : 'Редактировать задачу';

  box.innerHTML = `
  <div class="modal-header">
    <span class="modal-title">${title}</span>
    <button class="modal-close" onclick="closeModal()">${iconSvg('x',14)}</button>
  </div>
  <div class="wh-modal-body">
    <div style="margin-bottom:14px">
      <label class="mn-label">Название задачи *</label>
      <input class="mn-input" id="tk-inp-title" type="text" placeholder="Что нужно сделать..."
             value="${_tkEsc(task?.title || '')}">
    </div>
    <div class="wh-grid2">
      <div>
        <label class="mn-label">Исполнитель</label>
        <input class="mn-input" id="tk-inp-asn" type="text" list="tk-asn-list"
               value="${_tkEsc(task?.assignee_name || '')}" placeholder="Введите имя...">
        <datalist id="tk-asn-list">${asnDatalist}</datalist>
      </div>
      <div>
        <label class="mn-label">Приоритет</label>
        <select class="mn-input" id="tk-inp-pr">${prOpts}</select>
      </div>
      <div>
        <label class="mn-label">Срок</label>
        <input class="mn-input" type="datetime-local" id="tk-inp-dl" value="${_tkEsc(deadlineVal)}">
      </div>
      <div>
        <label class="mn-label">Проект</label>
        <select class="mn-input" id="tk-inp-proj">${projOpts}</select>
      </div>
    </div>
    <div style="margin-top:14px">
      <label class="mn-label">Описание</label>
      <textarea class="mn-input" id="tk-inp-desc" rows="3"
                placeholder="Подробности, ссылки, контекст...">${_tkEsc(task?.description || '')}</textarea>
    </div>
  </div>
  <div class="wh-modal-footer">
    ${task ? `<button class="mn-btn-danger" onclick="deleteTkTask('${_tkEsc(task.id)}')">${iconSvg('trash',14)} Удалить</button>` : '<div></div>'}
    <div style="display:flex;gap:8px">
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="btn-primary" onclick="saveTkTask('${_tkEsc(task?.id||'')}','${_tkEsc(parentId||'')}')">${iconSvg('save',14)} Сохранить</button>
    </div>
  </div>`;

  overlay.classList.add('open');
  requestAnimationFrame(() => document.getElementById('tk-inp-title')?.focus());
}

function saveTkTask(taskId, parentId) {
  const title = document.getElementById('tk-inp-title')?.value.trim();
  if (!title) { if (typeof showToast === 'function') showToast('Введите название'); return; }

  const assigneeName = document.getElementById('tk-inp-asn')?.value   || null;
  const priority     = document.getElementById('tk-inp-pr')?.value    || 'medium';
  const dlRaw        = document.getElementById('tk-inp-dl')?.value;
  const deadline     = dlRaw ? new Date(dlRaw).toISOString() : null;
  const projId       = document.getElementById('tk-inp-proj')?.value  || null;
  const description  = document.getElementById('tk-inp-desc')?.value.trim() || null;

  const isNew = !taskId;
  const id    = taskId || `tk_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

  const record = {
    id, title,
    description,
    status:       isNew ? 'pending' : (_tkTasks.find(t => t.id === id)?.status || 'pending'),
    priority,
    assignee_name: assigneeName,
    parent_id:    parentId || null,
    project_id:   projId,
    deadline,
    completed_at: (_tkTasks.find(t => t.id === id)?.completed_at) || null,
    completion_comment: (_tkTasks.find(t => t.id === id)?.completion_comment) || null,
    created_at:   isNew ? new Date().toISOString() : (_tkTasks.find(t => t.id === id)?.created_at || new Date().toISOString()),
  };

  if (isNew) {
    _tkTasks.push(record);
  } else {
    const idx = _tkTasks.findIndex(t => t.id === id);
    if (idx !== -1) Object.assign(_tkTasks[idx], record);
  }

  _tkSaveTask(record);
  if (typeof closeModal === 'function') closeModal();
  if (typeof showToast === 'function') showToast(isNew ? 'Задача добавлена' : 'Задача сохранена');
  _tkRerenderList();
}

function deleteTkTask(taskId) {
  if (!confirm('Удалить задачу? Подзадачи и комментарии тоже будут удалены.')) return;
  // Удаляем подзадачи
  const subIds = _tkTasks.filter(t => t.parent_id === taskId).map(t => t.id);
  _tkTasks = _tkTasks.filter(t => t.id !== taskId && t.parent_id !== taskId);
  delete _tkComments[taskId];
  subIds.forEach(sid => delete _tkComments[sid]);

  if (typeof closeModal === 'function') closeModal();
  if (_sb) {
    (async () => {
      try {
        await _sb.from('manager_tasks').delete().eq('id', taskId);
        if (subIds.length) await _sb.from('manager_tasks').delete().in('id', subIds);
        if (typeof showToast === 'function') showToast('Задача удалена');
      } catch(e) { console.error('deleteTkTask:', e); }
    })();
  } else {
    if (typeof showToast === 'function') showToast('Задача удалена');
  }
  _tkRerenderList();
}

// ──── Комментарии ───────────────────────────────────────────────
function addTkComment(taskId) {
  const text = document.getElementById('tk-new-comment')?.value.trim();
  if (!text) return;

  const id = `tkc_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const comment = { id, task_id: taskId, text, author: 'Руководитель', created_at: new Date().toISOString() };

  if (!_tkComments[taskId]) _tkComments[taskId] = [];
  _tkComments[taskId].push(comment);

  _tkSaveComment(comment);

  // Перерисовываем детальную модалку
  const task = _tkTasks.find(t => t.id === taskId);
  const box  = document.getElementById('modal-box');
  if (task && box) box.innerHTML = _tkDetailHtml(task);
}

function deleteTkComment(commentId, taskId) {
  if (!confirm('Удалить комментарий?')) return;
  if (_tkComments[taskId]) {
    _tkComments[taskId] = _tkComments[taskId].filter(c => c.id !== commentId);
  }
  if (_sb) {
    (async () => {
      try { await _sb.from('manager_task_comments').delete().eq('id', commentId); }
      catch(e) { console.error('deleteTkComment:', e); }
    })();
  }
  const task = _tkTasks.find(t => t.id === taskId);
  const box  = document.getElementById('modal-box');
  if (task && box) box.innerHTML = _tkDetailHtml(task);
}

// ──── Supabase (fire-and-forget) ───────────────────────────────
function _tkSaveTask(task) {
  if (!_sb) return;
  (async () => {
    try {
      await _sb.from('manager_tasks').upsert({
        id:                 task.id,
        title:              task.title,
        description:        task.description,
        status:             task.status,
        priority:           task.priority,
        assignee_name:      task.assignee_name,
        parent_id:          task.parent_id,
        project_id:         task.project_id,
        deadline:           task.deadline,
        completed_at:       task.completed_at,
        completion_comment: task.completion_comment,
      });
    } catch(e) { console.error('_tkSaveTask:', e); }
  })();
}

function _tkSaveComment(comment) {
  if (!_sb) return;
  (async () => {
    try {
      await _sb.from('manager_task_comments').upsert({
        id: comment.id, task_id: comment.task_id,
        text: comment.text, author: comment.author,
      });
    } catch(e) { console.error('_tkSaveComment:', e); }
  })();
}

// ──── Выгрузка по исполнителям ─────────────────────────────────
function exportTkByAssignee() {
  const roots = _tkTasks.filter(t => !t.parent_id);
  if (!roots.length) { if (typeof showToast === 'function') showToast('Нет задач для выгрузки'); return; }

  const fmtDate = dt => {
    if (!dt) return '';
    const d = new Date(dt);
    return isNaN(d) ? '' : d.toLocaleDateString('ru-RU');
  };
  const statusLabel   = id => TK_STATUSES.find(s => s.id === id)?.label   || id;
  const priorityLabel = id => TK_PRIORITIES.find(p => p.id === id)?.label || id;
  const projectName   = id => {
    if (!id || typeof VRH_PROJECTS === 'undefined') return '';
    return VRH_PROJECTS.find(p => p.id === id)?.name || id;
  };
  const csvCell = v => `"${String(v || '').replace(/"/g, '""')}"`;
  const row = arr => arr.map(csvCell).join(';');

  const bom = '﻿';
  const header = row(['Исполнитель', 'Задача', 'Статус', 'Приоритет', 'Срок', 'Проект', 'Описание', 'Подзадачи (вып/всего)']);

  // Группировка по исполнителю
  const groups = {};
  roots.forEach(t => {
    const key = t.assignee_name || '— Без исполнителя —';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  const lines = [header];
  Object.keys(groups).sort((a, b) => {
    if (a === '— Без исполнителя —') return 1;
    if (b === '— Без исполнителя —') return -1;
    return a.localeCompare(b, 'ru');
  }).forEach(assignee => {
    lines.push(row([assignee, '', '', '', '', '', '', ''])); // строка-разделитель исполнителя
    groups[assignee].forEach(t => {
      const subs = _tkTasks.filter(s => s.parent_id === t.id);
      const doneSubs = subs.filter(s => s.status === 'done').length;
      const subCell = subs.length ? `${doneSubs}/${subs.length}` : '';
      lines.push(row([
        assignee,
        t.title,
        statusLabel(t.status),
        priorityLabel(t.priority),
        fmtDate(t.deadline),
        projectName(t.project_id),
        t.description || '',
        subCell,
      ]));
      // Подзадачи отдельными строками с отступом
      subs.forEach(s => {
        lines.push(row([
          '',
          `  ↳ ${s.title}`,
          statusLabel(s.status),
          '',
          fmtDate(s.deadline),
          '',
          s.completion_comment || '',
          '',
        ]));
      });
    });
    lines.push(''); // пустая строка между исполнителями
  });

  const csv = lines.join('\n');
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `zadachi_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  if (typeof showToast === 'function') showToast('CSV выгружен');
}
window.exportTkByAssignee = exportTkByAssignee;

// ──── window exports ─────────────────────────────────────────────
window.loadTasksData    = loadTasksData;
window.renderTasksList  = renderTasksList;
window.setTkFilter      = setTkFilter;
window.openAddTaskModal = openAddTaskModal;
window.openEditTaskModal = openEditTaskModal;
window.openTaskDetail   = openTaskDetail;
window.setTkStatus      = setTkStatus;
window.updateTkField    = updateTkField;
window._tkToggleSubtask  = _tkToggleSubtask;
window.confirmSubComplete = confirmSubComplete;
window.cancelSubComplete  = cancelSubComplete;
window.saveTkTask       = saveTkTask;
window.deleteTkTask     = deleteTkTask;
window.addTkComment     = addTkComment;
window.deleteTkComment  = deleteTkComment;
