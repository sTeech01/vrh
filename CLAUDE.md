# VRH Production OS — Справочник для Claude

## Проект
- **Название:** Мини-MES система ВРХ Инжиниринг
- **URL:** https://steech01.github.io/vrh/
- **Репозиторий:** https://github.com/sTeech01/vrh (ветка `main` = GitHub Pages)
- **Текущий деплой:** DEPLOY #120
- **Деплой:** `git add <files> && git commit -m "DEPLOY #NNN: ..." && git push`

## Файлы
```
index.html        — SPA-оболочка, login screen, modal overlay, toast
js/data.js        — VRH_ITEMS, VRH_PROJECTS, хелперы (getItemStatus, calcProgress...)
js/app.js         — вся логика: роутер, рендер, Supabase, исполнители, модалки, workflow
js/ai.js          — rule-based AI рекомендации
css/styles.css    — кастомные стили (Notion+Linear+Apple дизайн)
График_работ.xlsx — источник данных (реальный Excel)
CLAUDE.md         — этот файл, архитектура и справочник
ITEMS.md          — индекс всех 74 позиций (id, №, название, тип) — читать вместо data.js
```

## Стек
- Vanilla JS (без фреймворков), `'use strict'`
- TailwindCSS CDN
- Supabase JS v2 CDN: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js`
- Hash-based роутер: `#dashboard`, `#projects`, `#project/id`, `#item/projectId/itemId`, `#events`
- Скрипты подключаются в порядке: supabase → data.js → ai.js → app.js

## Supabase
```js
_SB_URL = 'https://ypujmvfzboautqesvwib.supabase.co'
_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'  // legacy JWT anon key (НЕ sb_publishable_!)
```
- **Project ref:** `ypujmvfzboautqesvwib`
- **Авторизация:** email/пароль через `_sb.auth.signInWithPassword()`
- **RLS:** все таблицы только для `authenticated` пользователей

### Таблицы Supabase
| Таблица | Назначение |
|---------|-----------|
| `item_overrides` | `item_id TEXT PK, data JSONB, updated_at` — все правки позиций (включая кастомные) |
| `custom_assignees` | `id SERIAL PK, name TEXT, color_idx INT` — пользовательские исполнители |
| `item_order` | `complex_id TEXT PK, order_json JSONB` — порядок позиций |
| `custom_projects` | `id TEXT PK, name, client, location, description, deadline, type, workflow_version INT, created_at` — созданные пользователем проекты |
| `workflow_stages` | `id TEXT PK, item_id, project_id, name, stage_order INT, planned_qty INT, done_qty INT, assignee, status, comment, start_date, end_date, priority INT, required BOOL, depends_on JSONB, history JSONB, created_at` — этапы производственного маршрута |
| `item_materials` | `id TEXT PK, item_id TEXT, name TEXT, have BOOL, notes TEXT, created_at` — спецификация материалов по позиции |
| `events` | `id TEXT PK, title TEXT, event_date TEXT, type TEXT, item_id TEXT, project_id TEXT, comment TEXT, done BOOL, created_at` — ручные события (дедлайны, поставки, напоминания) |

### Что хранится в `item_overrides.data` (JSONB)
```
doneCount, purchaseStatus, notes, deadline, assignee, blockReason,
nameShort, nameFullEnabled, nameFullOverride, noteTipEnabled,
components: [{id, done}], history: [...], historyFull: [...],
quantity, deleted: true,
is_custom: true,   // позиция создана пользователем (не из data.js)
parent_id: null    // зарезервировано для будущих подпозиций
```

## Состояние приложения (app.js)
```js
const state = { view, projectId, itemId, filter: { complex, status, search } }
let localEdits = {}          // { [itemId]: {...overrides} } — загружается из Supabase
let _customAssignees = []    // загружается из Supabase
let _itemOrder = {}          // загружается из Supabase
let _customProjects = []     // загружается из Supabase (custom_projects)
let _workflowStages = {}     // { [item_id]: Stage[] } — загружается из Supabase
let _itemMaterials = {}      // { [item_id]: Material[] } — загружается из Supabase
let _events = []             // Event[] — загружается из Supabase (ручные события)
let _sb = null               // Supabase client

// Базовые длины массивов — для идемпотентного повторного входа
const _VRH_ITEMS_BASE_LEN    = VRH_ITEMS.length;    // 74
const _VRH_PROJECTS_BASE_LEN = VRH_PROJECTS.length; // 1
```

## Поток инициализации
```
DOMContentLoaded → createClient → getSession
  → нет сессии → showLoginScreen()
  → есть сессия → initApp()
    → state.filter = {complex:'all', status:'all', search:''}
    → loadRemoteData()   // 7 параллельных запросов:
                         //   item_overrides, custom_assignees, item_order,
                         //   custom_projects, workflow_stages,
                         //   item_materials, events
                         // → инжектирует кастомные проекты в VRH_PROJECTS
                         // → инжектирует кастомные позиции в VRH_ITEMS
                         // → заполняет _workflowStages
                         // → syncV2ItemDoneCount для каждой v2-позиции
    → applyEdits()       // применяет localEdits к VRH_ITEMS (мутирует массив)
                         // + удаляет items с deleted:true через splice
    → setupNavigation()
    → handleHash() → render()
```

## Данные (data.js)

### Константы статусов
```js
ST  = { DONE, IN_PROG, PENDING, BLOCKED, OVERDUE }
PUR = { RECEIVED:'received', PARTIAL:'partial', ORDERED:'ordered', PENDING:'pending' }
```

### VRH_PROJECTS
- `kalalahti` — реальные данные из Excel, комплексы: MB, IB, LMK, OPO, VK; `workflow_version: 1`
- `karelia`, `murmansk` — mock данные; `workflow_version: 1`
- Кастомные проекты из `custom_projects` инжектируются в массив при загрузке; `workflow_version: 2`

**Поле `workflow_version`:**
- `1` = Legacy (Калалахти и все существующие проекты) — классическая модель без изменений
- `2` = Workflow (новые проекты) — производственный маршрут с этапами

### VRH_ITEMS — поля позиции
```js
{
  id, projectId, complexId, number,
  name,          // полное наименование
  nameShort,     // короткое для таблицы
  quantity, unit,
  deadline,      // 'YYYY-MM-DD'
  type,          // 'own' | 'purchased'
  doneCount,     // для own: кол-во готово (для v2 — синхронизируется из узкого места)
  materialsStatus/purchaseStatus,  // PUR.*
  blockReason,   // строка или null
  assignee,      // имя исполнителя
  components,    // [{id, name, quantity, unit, done, notes}] — только Legacy (редактируемые)
  history,       // [{date, text}] — только Legacy
  notes,
  _isCustom,     // true для позиций, созданных пользователем
}
```

### getItemStatus(item) — логика статуса (НЕ МЕНЯТЬ)
```
done >= quantity          → DONE
blockReason               → BLOCKED
purchased + partial/ordered → OVERDUE или IN_PROG
purchased + pending       → OVERDUE или PENDING
own: doneCount > 0        → OVERDUE или IN_PROG
own: materialsStatus===PENDING → OVERDUE или BLOCKED
иначе                     → OVERDUE или IN_PROG
```

## Исполнители
```js
ASSIGNEE_DEFAULTS = [{ name:'Тренин А.', colorIdx:0 }, { name:'Парамузов О.Н.', colorIdx:1 }]
ASSIGNEE_PALETTE  = 8 цветов (indigo, teal, amber, pink, blue, green, red, purple)
```
- `_customAssignees` = массив из Supabase, включая tombstone-записи (`colorIdx: -1`)
- **Tombstone:** запись с `colorIdx: -1` подавляет default-исполнителя с тем же именем
- `getAllAssignees()` → фильтрует tombstone, мёрджит defaults + custom
- `saveAssignees(list)` → DELETE всех + INSERT (async, полная перезапись)

## Ключевые функции app.js

| Функция | Что делает |
|---------|-----------|
| `navigate(view, id1, id2)` | меняет `state`, вызывает `render()`, сбрасывает `#view.scrollTop` |
| `handleHash()` | парсит `location.hash`, обновляет `state`, вызывает `render()` |
| `render()` | рендерит текущий `state.view` в `#content`, восстанавливает фокус поиска |
| `setFilter(key, val)` | обновляет `state.filter`, поиск с дебаунсом 250мс |
| `saveEditsToStorage(itemId)` | async IIFE upsert в `item_overrides` |
| `applyEdits()` | мутирует VRH_ITEMS по localEdits, удаляет deleted |
| `openUpdateModal(itemId)` | открывает модалку редактирования позиции (двухколоночная) |
| `saveItemUpdate(itemId)` | читает все поля модалки, сохраняет в localEdits + Supabase |
| `deleteItem(itemId)` | confirm() → `deleted:true` в localEdits → navigate back |
| `deleteAssignee(name)` | tombstone для defaults, splice для custom |
| `confirmEditAssignee(itemId, oldName)` | tombstone + новая запись для defaults |
| `openCreateProjectModal()` | модалка создания нового проекта |
| `saveNewProject()` | сохраняет в VRH_PROJECTS + Supabase `custom_projects`; `workflow_version:2` |
| `deleteProject(projectId)` | удаляет из VRH_PROJECTS; если `_isCustom` — удаляет из Supabase |
| `openCreateItemModal(projectId)` | модалка создания новой позиции |
| `saveNewItem(projectId)` | сохраняет в VRH_ITEMS + `item_overrides` с `is_custom:true` |
| `_buildCustomItem(id, ed)` | восстанавливает объект позиции из данных item_overrides |
| `getItemMaterials(itemId)` | возвращает массив материалов из `_itemMaterials[itemId]` |
| `saveMatToStorage(mat)` | fire-and-forget upsert в `item_materials` |
| `toggleMatHave(matId, itemId)` | переключает `have` у материала + сохраняет |
| `openAddMatModal(itemId)` | модалка добавления материала |
| `openEditMatModal(matId, itemId)` | модалка редактирования/удаления материала |
| `saveMat(itemId, matId)` | создаёт или обновляет материал |
| `deleteMat(matId, itemId)` | удаляет материал из `_itemMaterials` и Supabase |
| `renderMaterialsSection(item)` | секция «Спецификация материалов» на странице позиции (для всех типов) |
| `openEditCompModal(itemId, compId)` | модалка редактирования подпозиции (name, qty, unit, notes) |
| `openAddCompModal(itemId)` | модалка добавления новой подпозиции |
| `saveComp(itemId, compId)` | сохраняет подпозицию в localEdits (`components`/`extraComponents`) |
| `deleteComp(itemId, compId)` | помечает подпозицию в `deletedComponents` |
| `saveEventToStorage(ev)` | fire-and-forget upsert в `events` |
| `deleteEventFromStorage(evId)` | fire-and-forget delete из `events` |
| `toggleEventDone(evId)` | переключает `done` у события |
| `openAddEventModal(prefillDate)` | модалка добавления события |
| `openEditEventModal(evId)` | модалка редактирования события |
| `saveEvent(evId)` | создаёт или обновляет событие (title, date, type, item_id, comment) |
| `deleteEvent(evId)` | удаляет вручную созданное событие |
| `_getAutoEvents()` | генерирует авто-события из данных позиций (дедлайны, поставки, оплаты) |
| `_getAllEvents()` | мёрджит авто-события + ручные из `_events` |
| `_updateEventsBadge()` | обновляет счётчик непрочитанных в nav-badge |
| `renderEvents(el)` | рендерит страницу #events: таймлайн по группам (просроченные/сегодня/неделя/месяц/позже/выполненные) |

## Workflow v2 — производственный маршрут

Используется **только** для проектов с `workflow_version: 2`. Калалахти и все legacy-данные не затронуты.

### Структура этапа (Stage)
```js
{
  id,           // 'stage_{itemId}_{timestamp}'
  item_id,      // к какой позиции привязан
  project_id,
  name,         // название этапа
  stage_order,  // порядок отображения (число)
  planned_qty,  // плановое количество
  done_qty,     // выполнено
  assignee,     // исполнитель
  status,       // 'pending' | 'in_progress' | 'done' | 'blocked'
  comment,
  start_date, end_date,  // 'YYYY-MM-DD' или null
  priority,     // число (1-3), зарезервировано
  required,     // bool — участвует ли в расчёте узкого места
  depends_on,   // [] — массив ID этапов-предшественников
  history,      // [] — зарезервировано для будущего журнала
  created_at,
}
```

### Workflow-хелперы
| Функция | Что делает |
|---------|-----------|
| `isV2Project(projectId)` | `true` если `workflow_version === 2` |
| `getItemStages(itemId)` | возвращает этапы из `_workflowStages[itemId]`, отсортированные по `stage_order` |
| `getWorkflowBottleneck(itemId)` | этап с min `done_qty` среди обязательных (`required:true`) |
| `syncV2ItemDoneCount(itemId)` | пишет `item.doneCount = min(done_qty)` обязательных этапов → всё остальное (Dashboard, AI, прогресс) работает без изменений |
| `saveStageToStorage(stage)` | fire-and-forget upsert в `workflow_stages` |
| `_wfComputeLevels(stages)` | топологический сорт: level 0 = без зависимостей, level N = после N-1; защита от циклов |

### Workflow UI-функции
| Функция | Что делает |
|---------|-----------|
| `renderWorkflowDetail(item, project)` | секция «Маршрут производства» на странице позиции |
| `renderStageCard(stage, item, bnId, allStages)` | карточка этапа с прогрессом, предупреждением о зависимостях, кнопками |
| `openAddStageModal(itemId)` | модалка создания этапа |
| `openEditStageModal(stageId, itemId)` | модалка редактирования этапа |
| `saveStage(itemId, stageId)` | создаёт или обновляет этап; `stageId=null` → новый |
| `deleteStage(stageId, itemId)` | удаляет из `_workflowStages` и Supabase |
| `updateStageDone(stageId, itemId, value)` | инлайн-обновление `done_qty`; автостатус + `syncV2ItemDoneCount` |

### Логика зависимостей
- `depends_on: []` — этап независимый (параллельный)
- `depends_on: ['stage_id']` — выполняется после указанного этапа
- Структура поддерживает несколько зависимостей, UI пока выбирает одну
- `_wfComputeLevels` строит топологические уровни → этапы одного уровня — параллельные
- Если зависимый этап не завершён → карточка показывает `⚠ Ожидает завершения «Название»`

### Визуализация маршрута
```
[Рама]                         ← уровень 0
    ↓
[Крышка]                       ← уровень 1
    ↓
┌──────────────┬─────────────┐
│  Покраска    │  Электрика  │  ← уровень 2, параллельная группа
└──────────────┴─────────────┘
```

## Рендер-архитектура
```
#app → #sidebar + .main-wrap
.main-wrap → #topbar + #view
#view (overflow-y:auto — ЕДИНСТВЕННЫЙ скролл-контейнер) → .view-inner → #content
```
- `window.scrollTo` НЕ работает — нужно `document.getElementById('view').scrollTop = 0`
- Модалка: `#modal-overlay > #modal-box`, открывается классом `.open`
- CSS-классы модалки редактирования позиции: `mn-*`
- CSS-классы workflow: `wf-*`
- CSS-классы материалов: `mat-*`
- CSS-классы событий: `ev-*`
- CSS-классы состава изделия: `comp-*`
- `btn-danger` **не существует** — использовать `mn-btn-danger`
- `modal-close-btn` **не существует** — использовать `modal-close`

## Паттерны кода

### Сохранение в Supabase (fire-and-forget)
```js
function saveEditsToStorage(changedItemId) {
  if (!_sb || changedItemId === undefined) return;
  const data = localEdits[changedItemId];
  (async () => {
    try {
      if (data === undefined) await _sb.from('item_overrides').delete().eq('item_id', changedItemId);
      else await _sb.from('item_overrides').upsert({ item_id: changedItemId, data, updated_at: new Date().toISOString() });
    } catch(e) { console.error('saveEdits error:', e); }
  })();
}
```

### Идемпотентный повторный вход
`loadRemoteData` обрезает `VRH_ITEMS` и `VRH_PROJECTS` до базовой длины перед повторной инжекцией кастомных сущностей, чтобы не дублировать их при logout/login.

### Восстановление фокуса поиска после render()
```js
requestAnimationFrame(() => {
  if (_prevFocusId === 'filter-search-input') {
    inp.focus(); inp.setSelectionRange(_prevSelStart, _prevSelStart);
  }
});
```

### iconSvg(name, size)
Доступные иконки: `user, calendar, list, warning, check, pause, x, document, chart, folder, clipboard, chat, save, refresh, alert, clock, minus, edit, plus, cart, ai, grip, trash`

## Правила (от пользователя)
- **Никаких эмодзи** — только векторные иконки
- **Запрещено** придумывать проекты — только реальный Калалахти
- **Запрещено** создавать тестовые данные — только из График_работ.xlsx
- Не фантазировать
- **Никогда не менять** Dashboard, AI, алгоритм прогресса, Legacy Workflow, Калалахти

## Секреты (НИКОГДА в клиентский код и НИКОГДА в CLAUDE.md)
- Service role JWT
- Postgres password
- Personal access token (sbp_...)
- Secret key (sb_secret_...)

## История деплоев
| # | Что сделано |
|---|------------|
| 046 | Supabase миграция с localStorage |
| 047 | Login screen |
| 048 | Async IIFE для Supabase saves; фикс autofill |
| 049 | Фикс Supabase key (legacy JWT вместо sb_publishable_) |
| 050 | Очистка поиска после render; autofill fix |
| 051 | Дебаунс поиска 250мс + requestAnimationFrame для фокуса |
| 052 | Убрать сообщение "Состав по КД не внесён" |
| 053 | Кнопка удаления исполнителей; фикс редактирования дефолтных (tombstone) |
| 054 | Убрать hardcoded blockReason из mb_41 |
| 055 | Фикс scroll-to-top: `#view.scrollTop` вместо `window.scrollTo` |
| 056 | Фикс blockReason: не писать null если поле не трогали |
| 057 | Редактирование количества (quantity); удаление позиций (deleted flag) |
| 058–060 | Редизайн модалки редактирования: двухколоночная, 1060px, помещается без прокрутки |
| 061 | Кольцо прогресса 84px: только % внутри, кол-во подписью снизу |
| 062 | Инфраструктура CRUD: `custom_projects`, `_buildCustomItem`, идемпотентный re-login |
| 063 | Создание проектов: кнопка + форма + сохранение в Supabase + удаление |
| 064 | Создание позиций: кнопка + форма + сохранение в `item_overrides` (`is_custom:true`) |
| 065 | Workflow v2 инфраструктура: `workflow_stages`, `_workflowStages`, `isV2Project`, `syncV2ItemDoneCount`, `saveStageToStorage` |
| 066 | Workflow v2 UI: карточки этапов, модалки добавления/редактирования/удаления, инлайн `done_qty`, `wf-*` CSS |
| 067 | Зависимости между этапами: `depends_on[]`, топосорт, параллельные группы, поле «Выполняется после», предупреждение о незавершённых зависимостях |
| 068–080 | (промежуточные итерации) |
| 081 | Спецификация материалов: таблица `item_materials`, CRUD (have/no тоггл, прогресс-бар), секция на странице позиции для всех типов |
| 082 | Страница «События»: таймлайн с группировкой, авто-события из данных позиций, CRUD ручных событий, таблица `events`, badge в навигации |
| 082-fix | Фикс дизайна модалок: добавлены CSS `.mn-label`, `.mn-input`; чипы типа события вместо select |
| 083 | Редактирование и добавление подпозиций в «Состав изделия по КД»: клик по строке → модалка, кнопка «+», хранение в `extraComponents`/`deletedComponents` |
| 084 | Фикс дизайна модалок: `btn-danger` → `mn-btn-danger`, `modal-close-btn` → `modal-close` |
| 085 | Отступы по бокам в модалках событий и подпозиций (`padding:24px`); поле «Комментарий» в событии |
