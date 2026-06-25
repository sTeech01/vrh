'use strict';
// =============================================================
// VRH Production OS — Data Layer v2.0
// Источник данных: График_работ.xlsx (актуально на 19.06.2026)
// =============================================================

const ST = {
  DONE:    'done',
  IN_PROG: 'in_progress',
  PENDING: 'pending',
  BLOCKED: 'blocked',
  OVERDUE: 'overdue',
};

const PUR = {
  RECEIVED: 'received',
  PARTIAL:  'partial',
  ORDERED:  'ordered',
  PENDING:  'pending',
};

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

// ── Проект ──────────────────────────────────────────────────────────
const VRH_PROJECTS = [
  {
    id:          'kalalahti',
    name:        'Калалахти',
    client:      'ООО «Рыбохозяйственный комплекс «Карелия»',
    location:    'Калалахти, Республика Карелия',
    deadline:    '2026-07-20',
    description: 'УЗВ-комплекс для выращивания атлантического лосося мощностью 100 т/год',
    type:        'uzv',
  },
];

// ── Комплексы ────────────────────────────────────────────────────────
const COMPLEXES = [
  { id: 'MB',  name: 'Мальковый блок',                abbr: 'МБ'  },
  { id: 'IB',  name: 'Инкубационный блок',             abbr: 'ИБ'  },
  { id: 'LMK', name: 'Личиночно-мальковый комплекс',   abbr: 'ЛМК' },
  { id: 'OPO', name: 'Оборудование общего назначения', abbr: 'ОПО' },
  { id: 'VK',  name: 'Оборудование для вакцинации',    abbr: 'ВК'  },
];

// ── Позиции ──────────────────────────────────────────────────────────
// type: 'own' = производим ВРХ  |  'purchased' = закупаем
// doneCount      — кол-во полностью готовых единиц (из Excel)
// components[]   — узлы/компоненты (для 'own' с данными по КД)
//   .quantity    — кол-во узлов на весь тираж изделия
//   .done        — кол-во готовых узлов
//   .optional    — true → не учитывается в прогрессе
// history[]      — хронология из еженедельных колонок Excel
// purchaseStatus — PUR.* (для purchased)
// materialsStatus— PUR.* статус закупки материалов (для own)
// blockReason    — причина блокировки
const VRH_ITEMS = [

  // ════════════════════════════════════════════════════════════════
  // МБ — Мальковый блок
  // ════════════════════════════════════════════════════════════════

  {
    id: 'mb_31', projectId: 'kalalahti', complexId: 'MB',
    number: '31', name: 'Конусный отстойник с запорным механизмом',
    nameShort: 'Конусный отстойник', quantity: 64, unit: 'шт',
    deadline: '2026-03-14', type: 'own',
    doneCount: 64,
    materialsStatus: PUR.RECEIVED,
    components: [],
    history: [
      { date: '2026-06-05', text: 'Упаковали все. Шарики надо поискать коробку для них.' },
      { date: '2026-04-10', text: 'Упаковали, лежат на улице, ждут отправки.' },
      { date: '2026-03-30', text: 'Начали упаковывать. Саморезы не получили.' },
      { date: '2026-03-23', text: 'Профилем связали. Не хватает нерж. саморезов, чтоб закрепить трубы к конусам.' },
      { date: '2026-03-17', text: 'Не хватает саморезов, собрать в готовые конструкции с профилем.' },
    ],
    notes: 'Все 64 упакованы. Шарики — найти коробку.',
  },

  {
    id: 'mb_32', projectId: 'kalalahti', complexId: 'MB',
    number: '32', name: 'Шиберная задвижка входная с направляющими из листового полипропилена',
    nameShort: 'Шибер входной ПП', quantity: 16, unit: 'шт',
    deadline: '2026-07-02', type: 'own',
    doneCount: 16, materialsStatus: PUR.RECEIVED,
    components: [],
    history: [
      { date: '2026-05-08', text: 'Готово. Все 16 шт выполнены.' },
      { date: '2026-04-24', text: 'Тяги 16 шт без пластика приехали. Переделываем крепление к бетону.' },
    ],
    notes: 'Все 16 единиц готовы (подтверждено 08.05.2026).',
    assignee: 'Тренин А.',
  },

  {
    id: 'mb_33', projectId: 'kalalahti', complexId: 'MB',
    number: '33', name: 'Шиберная задвижка выходная из листового полипропилена, толщина 8 мм',
    nameShort: 'Шибер выходной ПП', quantity: 6, unit: 'шт',
    deadline: '2026-07-20', type: 'own',
    doneCount: 6, materialsStatus: PUR.RECEIVED,
    components: [],
    history: [
      { date: '2026-04-10', text: 'Готово. Все 6 шт выполнены.' },
    ],
    notes: 'Все 6 единиц готовы (подтверждено 10.04.2026).',
  },

  {
    id: 'mb_34', projectId: 'kalalahti', complexId: 'MB',
    number: '34', name: 'Направляющие для выходного шибера из листового ПП, толщина 12 мм',
    nameShort: 'Направляющие шибера', quantity: 16, unit: 'шт',
    deadline: '2026-07-20', type: 'own',
    doneCount: 16, materialsStatus: PUR.RECEIVED,
    components: [],
    history: [
      { date: '2026-04-10', text: 'Готово. Все 16 шт выполнены.' },
    ],
    notes: 'Все 16 единиц готовы (подтверждено 10.04.2026).',
  },

  {
    id: 'mb_35', projectId: 'kalalahti', complexId: 'MB',
    number: '35', name: 'Решетка заградительная 2×1.6 выход, зазор между ламелями 5мм, AISI 304',
    nameShort: 'Решетка выход 2×1.6', quantity: 32, unit: 'шт',
    deadline: '2026-05-12', type: 'own',
    doneCount: 16, materialsStatus: PUR.RECEIVED,
    components: [],
    history: [
      { date: '2026-06-12', text: 'Начали делать направляющие.' },
      { date: '2026-06-19', text: 'Готово 16 шт (с ламелями, без направляющих).' },
    ],
    notes: 'Готово 16 шт с ламелями. Направляющие в работе.',
  },

  {
    id: 'mb_36', projectId: 'kalalahti', complexId: 'MB',
    number: '36', name: 'Решетка заградительная 2×1.5 вход, зазор между ламелями 5мм, AISI 304',
    nameShort: 'Решетка вход 2×1.5', quantity: 16, unit: 'шт',
    deadline: '2026-06-02', type: 'own',
    doneCount: 12, materialsStatus: PUR.RECEIVED,
    components: [],
    history: [
      { date: '2026-06-12', text: 'Трубки настыковали, все готовы.' },
      { date: '2026-06-19', text: 'Готово 12 шт (без направляющих).' },
    ],
    notes: 'Готово 12 шт. Направляющие не установлены.',
  },

  {
    id: 'mb_36p', projectId: 'kalalahti', complexId: 'MB',
    number: '36п', name: 'Решетка заградительная 2×1.5 промежуточная, зазор между ламелями 5мм, AISI 304',
    nameShort: 'Решетка промеж. 2×1.5', quantity: 16, unit: 'шт',
    deadline: '2026-06-02', type: 'own',
    doneCount: 0, materialsStatus: PUR.RECEIVED,
    components: [], history: [], notes: '',
  },

  {
    id: 'mb_37', projectId: 'kalalahti', complexId: 'MB',
    number: '37', name: 'Дегазатор погружной аэрационный 2×3м',
    nameShort: 'Дегазатор погружной МБ', quantity: 22, unit: 'шт',
    deadline: '2026-07-03', type: 'own',
    doneCount: 22, materialsStatus: PUR.RECEIVED,
    components: [],
    history: [
      { date: '2026-06-25', text: 'Все 22 шт готовы.' },
      { date: '2026-06-02', text: 'Нет полосы. Иначе стоят упакованные.' },
      { date: '2026-04-24', text: '24 готовы без пластин крепления к стене.' },
    ],
    notes: 'Все 22 шт готовы.',
  },

  {
    id: 'mb_38', projectId: 'kalalahti', complexId: 'MB',
    number: '38', name: 'Платформа биофильтра 5×2м',
    nameShort: 'Платформа биофильтра МБ', quantity: 24, unit: 'шт',
    deadline: '2026-07-20', type: 'own',
    doneCount: 0, materialsStatus: PUR.RECEIVED,
    components: [],
    history: [
      { date: '2026-04-30', text: 'Шибера выходные начали делать у Тренина, режет.' },
    ],
    notes: 'В работе у Тренина. Ранняя стадия.',
    assignee: 'Тренин А.',
  },

  {
    id: 'mb_40', projectId: 'kalalahti', complexId: 'MB',
    number: '40', name: 'Оксигенатор 120 л/с',
    nameShort: 'Оксигенатор 120 л/с МБ', quantity: 12, unit: 'шт',
    deadline: '2026-05-12', type: 'own',
    doneCount: 12, materialsStatus: PUR.RECEIVED,
    components: [],
    history: [
      { date: '2026-06-19', text: '12 готовы. Не хватало перегородок — изготовили. Клипсы заказаны.' },
    ],
    notes: 'Договор заключён, материал передан. Клипсы заказаны.',
  },

  {
    id: 'mb_41', projectId: 'kalalahti', complexId: 'MB',
    number: '41', name: 'Комплект фиксации насоса',
    nameShort: 'Комплект фиксации насоса', quantity: 12, unit: 'шт',
    deadline: '2026-06-03', type: 'own',
    doneCount: 0, materialsStatus: PUR.PENDING,
    blockReason: 'КД не готово',
    components: [], history: [],
    notes: 'КД ещё не сделано.',
  },

  {
    id: 'mb_45', projectId: 'kalalahti', complexId: 'MB',
    number: '45', name: 'Прижим для рыбы 2000×1600',
    nameShort: 'Прижим для рыбы', quantity: 4, unit: 'шт',
    deadline: '2026-05-12', type: 'own',
    doneCount: 0, materialsStatus: PUR.PARTIAL,
    components: [], history: [],
    notes: 'Материалы куплены на 70%.',
  },

  {
    id: 'mb_51', projectId: 'kalalahti', complexId: 'MB',
    number: '51', name: 'Аэратор погружной 4×0.2м',
    nameShort: 'Аэратор погружной', quantity: 32, unit: 'шт',
    deadline: '2026-06-07', type: 'own',
    doneCount: 0, materialsStatus: PUR.PARTIAL,
    components: [],
    history: [
      { date: '2026-06-12', text: 'Металл готов у О.Н. на ВРХ. Нужно дозаказать фитинги: американки и клипсы Ø25. Ведётся подготовка фасонных элементов. Заказать стопорные пальцы.' },
    ],
    notes: 'Металл на ВРХ. Нужны фитинги (американки, клипсы Ø25), стопорные пальцы. Куплено ~70%.',
    assignee: 'Тренин А.',
  },

  // — Закупаемые позиции МБ —

  {
    id: 'mb_39', projectId: 'kalalahti', complexId: 'MB',
    number: '39', name: 'Наполнитель биофильтра',
    nameShort: 'Наполнитель биофильтра МБ', quantity: 192, unit: 'м³',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.ORDERED, doneCount: 0,
    history: [
      { date: '2026-03-17', text: 'Оплачен. Начато изготовление.' },
    ],
    notes: 'Оплачен, производство начато (17.03.2026). Ждём поставки.',
  },

  {
    id: 'mb_42', projectId: 'kalalahti', complexId: 'MB',
    number: '42', name: 'Насос пропелерный 2,5 кВт (GSD)',
    nameShort: 'Насос пропелерный 2,5 кВт', quantity: 12, unit: 'шт',
    deadline: '2026-07-05', type: 'purchased',
    purchaseStatus: PUR.ORDERED, doneCount: 0,
    history: [
      { date: '2026-03-23', text: 'Оплачен. Начато изготовление.' },
      { date: '2026-04-30', text: 'Ждём в июле.' },
    ],
    notes: 'Оплачен (23.03.2026). Ожидается поставка в июле.',
  },

  {
    id: 'mb_43', projectId: 'kalalahti', complexId: 'MB',
    number: '43', name: 'Кормушки маятниковые',
    nameShort: 'Кормушки маятниковые', quantity: 32, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.ORDERED, doneCount: 0,
    history: [{ date: '2026-03-23', text: 'Оплачены бункеры.' }],
    notes: 'Оплачены (23.03.2026). Ждём поставки.',
  },

  {
    id: 'mb_44', projectId: 'kalalahti', complexId: 'MB',
    number: '44', name: 'Шланги аварийного кислородоснабжения',
    nameShort: 'Шланги аварийного O₂', quantity: 448, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'mb_46', projectId: 'kalalahti', complexId: 'MB',
    number: '46', name: 'Рыбнасос д110мм',
    nameShort: 'Рыбнасос д110', quantity: 2, unit: 'шт',
    deadline: '2026-06-05', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём результатов теста.',
  },

  {
    id: 'mb_47', projectId: 'kalalahti', complexId: 'MB',
    number: '47', name: 'Сортировщик 3 фракции',
    nameShort: 'Сортировщик 3 фр.', quantity: 2, unit: 'шт',
    deadline: '2026-07-06', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'mb_48', projectId: 'kalalahti', complexId: 'MB',
    number: '48', name: 'Съёмочный блок счётчика',
    nameShort: 'Съёмочный блок счётчика МБ', quantity: 8, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'mb_49', projectId: 'kalalahti', complexId: 'MB',
    number: '49', name: 'Погружной теплообменник 2.7 м²',
    nameShort: 'Теплообменник 2.7 м² МБ', quantity: 4, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.RECEIVED, doneCount: 0,
    history: [
      { date: '2026-03-17', text: 'Оплачен.' },
      { date: '2026-04-17', text: 'Забрали. Все 4 получены.' },
    ],
    notes: 'Получены 17.04.2026. Оплачены ранее.',
  },

  {
    id: 'mb_50', projectId: 'kalalahti', complexId: 'MB',
    number: '50', name: 'Сачок квадратный 328×440',
    nameShort: 'Сачок квадратный', quantity: 4, unit: 'шт',
    deadline: '2026-05-13', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  // ════════════════════════════════════════════════════════════════
  // ИБ — Инкубационный блок
  // ════════════════════════════════════════════════════════════════

  {
    id: 'ib_1', projectId: 'kalalahti', complexId: 'IB',
    number: '1', name: 'Инкубатор лоточный',
    nameShort: 'Инкубатор лоточный', quantity: 10, unit: 'шт',
    deadline: '2026-05-10', type: 'own',
    doneCount: 2, materialsStatus: PUR.PARTIAL,
    components: [
      {
        id: 'rama', name: 'Рама', quantity: 10, done: 2,
        notes: 'Готовы 2 рамы. Заготовки нарезаны 100%. Сборка 8 рам — 25%.',
      },
    ],
    history: [
      { date: '2026-06-19', text: 'Готовы 2 рамы. Заготовки нарезаны 100%. 8 рам — сборка 25%.' },
      { date: '2026-06-05', text: 'Перевезли весь металл Тренину, он отправил на лазерную резку (03.06.2026).' },
    ],
    notes: 'Корректируем КД. Материалы куплены на 90%.',
    assignee: 'Тренин А.',
  },

  {
    id: 'ib_2', projectId: 'kalalahti', complexId: 'IB',
    number: '2', name: 'Раковина технологическая',
    nameShort: 'Раковина технологическая', quantity: 2, unit: 'шт',
    deadline: '2026-05-24', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'ib_3', projectId: 'kalalahti', complexId: 'IB',
    number: '3', name: 'Стол',
    nameShort: 'Стол ИБ', quantity: 2, unit: 'шт',
    deadline: '2026-06-24', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'ib_4', projectId: 'kalalahti', complexId: 'IB',
    number: '4', name: 'Стеллаж для инвентаря',
    nameShort: 'Стеллаж для инвентаря', quantity: 2, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'ib_5', projectId: 'kalalahti', complexId: 'IB',
    number: '5', name: 'Спринцовка-клизма',
    nameShort: 'Спринцовка-клизма', quantity: 2, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'ib_6', projectId: 'kalalahti', complexId: 'IB',
    number: '6', name: 'Мерный стакан 2 л',
    nameShort: 'Мерный стакан 2 л', quantity: 2, unit: 'шт',
    deadline: '2026-05-10', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'ib_7', projectId: 'kalalahti', complexId: 'IB',
    number: '7', name: 'Таз строительный 40 л',
    nameShort: 'Таз строительный 40 л', quantity: 2, unit: 'шт',
    deadline: '2026-05-26', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'ib_8', projectId: 'kalalahti', complexId: 'IB',
    number: '8', name: 'Пинцет прямой 250 мм',
    nameShort: 'Пинцет прямой 250 мм', quantity: 2, unit: 'шт',
    deadline: '2026-06-26', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'ib_10', projectId: 'kalalahti', complexId: 'IB',
    number: '10', name: 'Локтевой диспенсер',
    nameShort: 'Локтевой диспенсер', quantity: 2, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'ib_11', projectId: 'kalalahti', complexId: 'IB',
    number: '11', name: 'Термометр электрический',
    nameShort: 'Термометр электрический', quantity: 16, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'ib_13', projectId: 'kalalahti', complexId: 'IB',
    number: '13', name: 'Сачок для рыб 10 см',
    nameShort: 'Сачок д/рыб 10 см ИБ', quantity: 2, unit: 'шт',
    deadline: '2026-05-11', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'ib_14', projectId: 'kalalahti', complexId: 'IB',
    number: '14', name: 'Трубка ПВХ гибкая д8 мм',
    nameShort: 'Трубка ПВХ д8 мм', quantity: 2, unit: 'шт',
    deadline: '2026-05-27', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  // ════════════════════════════════════════════════════════════════
  // ЛМК — Личиночно-мальковый комплекс
  // ════════════════════════════════════════════════════════════════

  {
    id: 'lmk_15', projectId: 'kalalahti', complexId: 'LMK',
    number: '15', name: 'Ванна мальковая',
    nameShort: 'Ванна мальковая', quantity: 48, unit: 'шт',
    deadline: '2026-06-27', type: 'own',
    doneCount: 28,
    materialsStatus: PUR.RECEIVED,
    // Компоненты по КД (Спецификация - Общая (пара ванн).xlsx)
    // .quantity = кол-во единиц данного узла на весь тираж 48 шт
    components: [
      {
        id: 'rama', name: 'Рама сварная', quantity: 48, done: 48,
        notes: 'Все 48 рам на складе ВРХ (подтверждено 02.06.2026).',
      },
      {
        id: 'vkladysh', name: 'Вкладыш (ПП)', quantity: 48, done: 28,
        notes: '28 вкладышей готовы — это финальный этап сборки ванны. Оставшиеся 20 в работе.',
      },
      {
        id: 'oblicovka', name: 'Облицовка (ПП)', quantity: 48, done: 28,
        notes: 'Листы ПП переданы в Монолит 02.06.2026.',
      },
      {
        id: 'kryshki', name: 'Крышка основная', quantity: 96, done: 56,
        notes: '2 шт на ванну. Для 28 готовых ванн = 56 шт. Сетки на крышки заказаны 12.06.',
      },
      {
        id: 'reshetka', name: 'Решётка', quantity: 96, done: 0,
        notes: 'Заказана 12.06.2026. Не получена.',
      },
      {
        id: 'shibery', name: 'Шиберы в сборе', quantity: 192, done: 112,
        notes: '4 шт на ванну. 28 ванн × 4 = 112 шт готовы.',
      },
      {
        id: 'soedinitel', name: 'Соединитель ванн', quantity: 96, done: 56,
        notes: '2 шт на ванну.',
      },
      {
        id: 'gazlift', name: 'Газлифты', quantity: 48, done: 0,
        optional: true,
        notes: 'Не заказаны по состоянию на 12.06.2026.',
      },
    ],
    history: [
      { date: '2026-06-19', text: '28 полностью готовы (вкладыши — финальный этап).' },
      { date: '2026-06-12', text: '24 полностью готовы, 3 практически. Заказали решетку и сетку на крышки. Газлифты не заказали. Упоры не совпадают по чертежам.' },
      { date: '2026-06-02', text: '18 вкладышей готовы. Рамы все на складе. Не закуплены: сетки, решётки, газлифты. Листы на облицовку отвезли в Монолит. Дно сварено 31 шт.' },
      { date: '2026-05-22', text: 'Рама 41 шт на ВРХ. Вкладыши 16 шт, из них 4 полностью собраны.' },
      { date: '2026-05-15', text: '36 каркасов на складе ВРХ. Сделали 9 вкладышей.' },
    ],
    notes: 'Делаем испытательную ванну. Неделя ушла на пробную ванну (впайка пластика). Упоры не совпадают по чертежам — уточняем.',
  },

  {
    id: 'lmk_17', projectId: 'kalalahti', complexId: 'LMK',
    number: '17', name: 'Платформа биофильтра 5×2м',
    nameShort: 'Платформа биофильтра ЛМК', quantity: 10, unit: 'шт',
    deadline: '2026-07-20', type: 'own',
    doneCount: 5,
    materialsStatus: PUR.RECEIVED,
    components: [
      {
        id: 'rama', name: 'Рама', quantity: 10, done: 10,
        notes: 'Все 10 рам изготовлены. Одна партия ждёт плёнки для упаковки.',
      },
      {
        id: 'shibery_vyhod', name: 'Шиберы выходные', quantity: 10, done: 10,
        notes: 'Готовы, хранятся у Тренина.',
      },
      {
        id: 'shibery_vhod', name: 'Шиберы входные', quantity: 10, done: 0,
        notes: 'Не готовы. Заготовки у Монолита. Материалы куплены.',
      },
      {
        id: 'kreplenie', name: 'Крепление биофильтра 204', quantity: 10, done: 0,
        notes: 'Андрей гнёт — в процессе.',
      },
    ],
    history: [
      { date: '2026-06-12', text: 'Изготовлены все 34 рамы (МБ+ЛМК вместе). Одна пачка без упаковки — нет плёнки. Входные шиберы не готовы, материалы куплены, заготовки у Монолита. Крепление 204 — Андрей в процессе.' },
    ],
    notes: 'Сделали 5 штук. Начали делать новую партию.',
    assignee: 'Тренин А.',
  },

  {
    id: 'lmk_20', projectId: 'kalalahti', complexId: 'LMK',
    number: '20', name: 'Оксигенатор 120 л/с',
    nameShort: 'Оксигенатор 120 л/с ЛМК', quantity: 4, unit: 'шт',
    deadline: '2026-05-28', type: 'own',
    doneCount: 4, materialsStatus: PUR.PARTIAL,
    components: [],
    history: [
      { date: '2026-06-19', text: '4 готовы. Не хватало перегородок — изготовили. Клипсы заказаны.' },
    ],
    notes: 'Договор заключён. Материал передан почти весь. Куплено ~90%. Клипсы заказаны.',
  },

  {
    id: 'lmk_21', projectId: 'kalalahti', complexId: 'LMK',
    number: '21', name: 'Дегазатор погружной 2×3м',
    nameShort: 'Дегазатор погружной ЛМК', quantity: 8, unit: 'шт',
    deadline: '2026-06-29', type: 'own',
    doneCount: 8, materialsStatus: PUR.RECEIVED,
    components: [],
    history: [
      { date: '2026-06-12', text: 'Полоса установлена. Все 8 шт готовы.' },
      { date: '2026-06-05', text: 'Упаковали все, но без полосы.' },
      { date: '2026-06-02', text: 'Полосы должны приехать в четверг.' },
    ],
    notes: 'Все 8 шт готовы (подтверждено 12.06.2026).',
  },

  {
    id: 'lmk_25', projectId: 'kalalahti', complexId: 'LMK',
    number: '25', name: 'Канал сбросной из ПП',
    nameShort: 'Канал сбросной ПП', quantity: 4, unit: 'шт',
    deadline: '2026-05-30', type: 'own',
    doneCount: 0, materialsStatus: PUR.RECEIVED,
    blockReason: 'Ожидание утверждения строительных чертежей',
    components: [],
    history: [
      { date: '2026-06-02', text: 'КД есть, но возможно требуется доработка после корректировки проекта.' },
    ],
    notes: 'Производство возможно только после утверждения строительных чертежей. КД есть, требует доработки.',
  },

  // — Закупаемые позиции ЛМК —

  {
    id: 'lmk_19', projectId: 'kalalahti', complexId: 'LMK',
    number: '19', name: 'Насос подачи воды в оксигенационные колодцы, Q-60 л/с, H-3м',
    nameShort: 'Насос подачи воды ЛМК', quantity: 6, unit: 'шт',
    deadline: '2026-05-11', type: 'purchased',
    purchaseStatus: PUR.ORDERED, doneCount: 0,
    history: [
      { date: '2026-03-30', text: 'Оплачен.' },
      { date: '2026-05-22', text: 'Лежат у подрядчика на складе, готов отгрузить в любой момент.' },
      { date: '2026-06-02', text: 'Через 2–2,5 недели будет на таможне.' },
    ],
    notes: 'Оплачен (30.03). По состоянию на 02.06 — ожидается на таможне ~16.06.2026.',
  },

  {
    id: 'lmk_23', projectId: 'kalalahti', complexId: 'LMK',
    number: '23', name: 'Ультразвуковой расходомер Ду 50-700 мм',
    nameShort: 'УЗ расходомер', quantity: 2, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.ORDERED, doneCount: 0,
    history: [
      { date: '2026-03-30', text: 'Заказаны и оплачены.' },
      { date: '2026-04-24', text: 'Отправили к нам.' },
    ],
    notes: 'Оплачены (30.03). Отгружены к нам 24.04. Ожидается получение.',
  },

  {
    id: 'lmk_30', projectId: 'kalalahti', complexId: 'LMK',
    number: '30', name: 'Погружной теплообменник 2.7 м²',
    nameShort: 'Теплообменник 2.7 м² ЛМК', quantity: 2, unit: 'шт',
    deadline: '2026-06-01', type: 'purchased',
    purchaseStatus: PUR.RECEIVED, doneCount: 0,
    history: [
      { date: '2026-03-17', text: 'Оплачены, ждём готовности.' },
      { date: '2026-04-10', text: 'Сделаны, надо забирать.' },
      { date: '2026-04-17', text: 'Приехали. Готовы к отгрузке.' },
    ],
    notes: 'Получены 17.04.2026.',
  },

  {
    id: 'lmk_18', projectId: 'kalalahti', complexId: 'LMK',
    number: '18', name: 'Наполнитель биофильтра',
    nameShort: 'Наполнитель биофильтра ЛМК', quantity: 80, unit: 'м³',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.ORDERED, doneCount: 0,
    history: [
      { date: '2026-03-17', text: 'Оплачен.' },
    ],
    notes: 'Оплачен (17.03.2026). Ждём поставки.',
  },

  {
    id: 'lmk_22', projectId: 'kalalahti', complexId: 'LMK',
    number: '22', name: 'Кормушка дисковая 3 л',
    nameShort: 'Кормушка дисковая 3 л', quantity: 48, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Богдана.',
  },

  {
    id: 'lmk_24', projectId: 'kalalahti', complexId: 'LMK',
    number: '24', name: 'Диффузор для аварийного кислорода',
    nameShort: 'Диффузор аварийного O₂', quantity: 48, unit: 'шт',
    deadline: '2026-05-11', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'lmk_26', projectId: 'kalalahti', complexId: 'LMK',
    number: '26', name: 'Сачок для рыб 10 см',
    nameShort: 'Сачок д/рыб 10 см ЛМК', quantity: 10, unit: 'шт',
    deadline: '2026-06-30', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'lmk_27', projectId: 'kalalahti', complexId: 'LMK',
    number: '27', name: 'Рыбнасос д75 мм',
    nameShort: 'Рыбнасос д75', quantity: 2, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Надо произвести тесты.',
  },

  {
    id: 'lmk_28', projectId: 'kalalahti', complexId: 'LMK',
    number: '28', name: 'Сортировщик 1–50 г',
    nameShort: 'Сортировщик 1–50 г', quantity: 2, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'lmk_29', projectId: 'kalalahti', complexId: 'LMK',
    number: '29', name: 'Съёмочный блок счётчика',
    nameShort: 'Съёмочный блок счётчика ЛМК', quantity: 6, unit: 'шт',
    deadline: '2026-05-11', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  // ════════════════════════════════════════════════════════════════
  // ОПО — Оборудование общего назначения
  // ════════════════════════════════════════════════════════════════

  {
    id: 'opo_55', projectId: 'kalalahti', complexId: 'OPO',
    number: '55', name: 'Коллектор для вентиляторов дегазации',
    nameShort: 'Коллектор вентиляторов', quantity: 2, unit: 'шт',
    deadline: '2026-05-13', type: 'own',
    doneCount: 0, materialsStatus: PUR.PENDING,
    blockReason: 'Ожидание посадки здания на участке',
    components: [], history: [],
    notes: 'Уточнять после посадки здания на участке.',
  },

  {
    id: 'opo_56', projectId: 'kalalahti', complexId: 'OPO',
    number: '56', name: 'Подставка для вентиляторов',
    nameShort: 'Подставка вентиляторов', quantity: 2, unit: 'шт',
    deadline: '2026-06-08', type: 'own',
    doneCount: 0, materialsStatus: PUR.PENDING,
    blockReason: 'Ожидание посадки здания на участке',
    components: [], history: [],
    notes: 'Уточнять после посадки здания на участке.',
  },

  // — Закупаемые позиции ОПО —

  {
    id: 'opo_52', projectId: 'kalalahti', complexId: 'OPO',
    number: '52', name: 'Компрессор коловратный (Мегатехника)',
    nameShort: 'Компрессор коловратный', quantity: 2, unit: 'шт',
    deadline: '2026-07-08', type: 'purchased',
    purchaseStatus: PUR.RECEIVED, doneCount: 0,
    history: [
      { date: '2026-03-17', text: 'Оплачен.' },
      { date: '2026-04-17', text: 'Забираем.' },
      { date: '2026-04-24', text: 'На складе, готовы к отгрузке.' },
    ],
    notes: 'Получены ~17–24.04.2026.',
  },

  {
    id: 'opo_53', projectId: 'kalalahti', complexId: 'OPO',
    number: '53', name: 'Генератор озона 200 г/ч (3озон)',
    nameShort: 'Генератор озона 200 г/ч', quantity: 2, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.ORDERED, doneCount: 0,
    history: [
      { date: '2026-03-30', text: 'Оплачен.' },
    ],
    notes: 'Оплачен (30.03.2026). Ждём поставки.',
  },

  {
    id: 'opo_54', projectId: 'kalalahti', complexId: 'OPO',
    number: '54', name: 'Вентилятор напорный 5.5 кВт',
    nameShort: 'Вентилятор напорный 5.5 кВт', quantity: 10, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.ORDERED, doneCount: 0,
    history: [
      { date: '2026-03-23', text: 'Оплачен, ждём поставку.' },
      { date: '2026-04-30', text: 'Ждём в июле.' },
    ],
    notes: 'Оплачен (23.03.2026). Ожидается поставка в июле.',
  },

  {
    id: 'opo_57', projectId: 'kalalahti', complexId: 'OPO',
    number: '57', name: 'Счётчик малька вычислительный блок',
    nameShort: 'Счётчик малька выч. блок', quantity: 2, unit: 'шт',
    deadline: '2026-07-09', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'opo_58', projectId: 'kalalahti', complexId: 'OPO',
    number: '58', name: 'Микроскоп',
    nameShort: 'Микроскоп', quantity: 2, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.ORDERED, doneCount: 0,
    history: [
      { date: '2026-04-24', text: 'На складе у поставщика, готовы к отгрузке (модель по запросу Руслана).' },
    ],
    notes: 'Готов к отгрузке у поставщика (24.04.2026). Ожидаем получения.',
  },

  {
    id: 'opo_59', projectId: 'kalalahti', complexId: 'OPO',
    number: '59', name: 'Весы отвеса корма 20 кг',
    nameShort: 'Весы корма 20 кг', quantity: 2, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'opo_60', projectId: 'kalalahti', complexId: 'OPO',
    number: '60', name: 'Весы отгрузки до 2 т',
    nameShort: 'Весы отгрузки до 2 т', quantity: 2, unit: 'шт',
    deadline: '2026-05-13', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'opo_61', projectId: 'kalalahti', complexId: 'OPO',
    number: '61', name: 'Морозильник 165 л',
    nameShort: 'Морозильник 165 л', quantity: 2, unit: 'шт',
    deadline: '2026-06-09', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'opo_62', projectId: 'kalalahti', complexId: 'OPO',
    number: '62', name: 'Морозильник для отхода малька 165 л',
    nameShort: 'Морозильник малька', quantity: 2, unit: 'шт',
    deadline: '2026-07-11', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'opo_63', projectId: 'kalalahti', complexId: 'OPO',
    number: '63', name: 'Пульверизатор 16 л',
    nameShort: 'Пульверизатор 16 л', quantity: 2, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'opo_64', projectId: 'kalalahti', complexId: 'OPO',
    number: '64', name: 'Измеритель уровня CO₂',
    nameShort: 'Измеритель CO₂', quantity: 2, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'opo_65', projectId: 'kalalahti', complexId: 'OPO',
    number: '65', name: 'Ручной измеритель TDS',
    nameShort: 'Измеритель TDS', quantity: 4, unit: 'шт',
    deadline: '2026-05-13', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'opo_66', projectId: 'kalalahti', complexId: 'OPO',
    number: '66', name: 'Ручной измеритель ОВП',
    nameShort: 'Измеритель ОВП', quantity: 4, unit: 'шт',
    deadline: '2026-06-11', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'opo_67', projectId: 'kalalahti', complexId: 'OPO',
    number: '67', name: 'Ручной измеритель pH',
    nameShort: 'Измеритель pH', quantity: 4, unit: 'шт',
    deadline: '2026-07-12', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'opo_68', projectId: 'kalalahti', complexId: 'OPO',
    number: '68', name: 'Ручной измеритель растворённого кислорода',
    nameShort: 'Измеритель O₂', quantity: 4, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  // ════════════════════════════════════════════════════════════════
  // ВК — Оборудование для вакцинации
  // ════════════════════════════════════════════════════════════════

  {
    id: 'vk_69', projectId: 'kalalahti', complexId: 'VK',
    number: '69', name: 'Ванна для вакцинации ПП в каркасе нерж.',
    nameShort: 'Ванна вакцинации ПП', quantity: 2, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.ORDERED, doneCount: 0,
    history: [{ date: '2026-03-23', text: 'Оплачена.' }],
    notes: 'Оплачена (23.03.2026). Требует корректировки после уточнения проекта.',
  },

  {
    id: 'vk_70', projectId: 'kalalahti', complexId: 'VK',
    number: '70', name: 'Перекидная ванна для вакцинации ПП',
    nameShort: 'Перекидная ванна ПП', quantity: 4, unit: 'шт',
    deadline: '2026-05-14', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'vk_71', projectId: 'kalalahti', complexId: 'VK',
    number: '71', name: 'Насос подачи воды в ванну вакцинации',
    nameShort: 'Насос подачи воды ВК', quantity: 2, unit: 'шт',
    deadline: '2026-06-13', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'vk_72', projectId: 'kalalahti', complexId: 'VK',
    number: '72', name: 'Стол для вакцинации 2000×1200×700',
    nameShort: 'Стол вакцинации', quantity: 2, unit: 'шт',
    deadline: '2026-07-14', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'vk_73', projectId: 'kalalahti', complexId: 'VK',
    number: '73', name: 'Счётчик воды Ду15 с импульсным выходом',
    nameShort: 'Счётчик воды Ду15', quantity: 2, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'vk_74', projectId: 'kalalahti', complexId: 'VK',
    number: '74', name: 'Дозирующий насос для компонента А',
    nameShort: 'Дозирующий насос А', quantity: 2, unit: 'шт',
    deadline: '2026-07-20', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'vk_75', projectId: 'kalalahti', complexId: 'VK',
    number: '75', name: 'Дозирующий насос для компонента Б',
    nameShort: 'Дозирующий насос Б', quantity: 2, unit: 'шт',
    deadline: '2026-05-14', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

  {
    id: 'vk_76', projectId: 'kalalahti', complexId: 'VK',
    number: '76', name: 'Съёмочный блок счётчика малька',
    nameShort: 'Съёмочный блок малька', quantity: 2, unit: 'шт',
    deadline: '2026-06-14', type: 'purchased',
    purchaseStatus: PUR.PENDING, doneCount: 0, history: [],
    notes: 'Ждём Максима.',
  },

];

// ── Вычисляемые функции ──────────────────────────────────────────────

function daysOverdue(deadline) {
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  return Math.floor((TODAY - d) / 86400000);
}

function getItemDone(item) {
  if (item.type === 'purchased') {
    return item.purchaseStatus === PUR.RECEIVED ? item.quantity : 0;
  }
  return item.doneCount || 0;
}

function calcProgress(item) {
  if (!item || item.quantity <= 0) return 0;
  return Math.min(100, Math.round(getItemDone(item) / item.quantity * 100));
}

function getItemStatus(item) {
  const done = getItemDone(item);
  if (done >= item.quantity) return ST.DONE;

  if (item.blockReason) return ST.BLOCKED;

  const overdue = daysOverdue(item.deadline);

  if (item.type === 'purchased') {
    const ps = item.purchaseStatus;
    if (ps === PUR.PARTIAL || ps === PUR.ORDERED) {
      return overdue > 0 ? ST.OVERDUE : ST.IN_PROG;
    }
    return overdue > 0 ? ST.OVERDUE : ST.PENDING;
  }

  // Собственное производство
  if (done > 0) return overdue > 0 ? ST.OVERDUE : ST.IN_PROG;
  const ms = item.materialsStatus;
  if (!ms || ms === PUR.PENDING) return overdue > 0 ? ST.OVERDUE : ST.BLOCKED;
  if (ms === PUR.PARTIAL)        return overdue > 0 ? ST.OVERDUE : ST.IN_PROG;
  return overdue > 0 ? ST.OVERDUE : ST.PENDING;
}

// Бутылочное горлышко: компонент с наименьшим прогрессом
function getBottleneck(item) {
  if (!item.components || !item.components.length) return null;
  const required = item.components.filter(c => !c.optional);
  if (!required.length) return null;
  return required.reduce((worst, c) => {
    const pct   = c.done / item.quantity;
    const wPct  = worst.done / item.quantity;
    return pct < wPct ? c : worst;
  });
}

function getProjectItems(projectId) {
  return VRH_ITEMS.filter(i => i.projectId === projectId);
}

function getComplexItems(projectId, complexId) {
  return VRH_ITEMS.filter(i => i.projectId === projectId && i.complexId === complexId);
}

function getProjectProgress(projectId) {
  const items = getProjectItems(projectId);
  if (!items.length) return 0;
  const totalQty  = items.reduce((s, i) => s + i.quantity, 0);
  const totalDone = items.reduce((s, i) => s + getItemDone(i), 0);
  return totalQty > 0 ? Math.round(totalDone / totalQty * 100) : 0;
}

function getOverdueItems(projectId) {
  const items = projectId ? getProjectItems(projectId) : VRH_ITEMS;
  return items.filter(i => getItemStatus(i) === ST.OVERDUE);
}

function getNoKdItems(projectId) {
  const items = projectId ? getProjectItems(projectId) : VRH_ITEMS;
  return items.filter(i =>
    i.type === 'own' && i.blockReason && i.blockReason.toLowerCase().includes('кд')
  );
}

function getBlockedItems(projectId) {
  const items = projectId ? getProjectItems(projectId) : VRH_ITEMS;
  return items.filter(i => getItemStatus(i) === ST.BLOCKED);
}

function getItemsNeedingPurchase(projectId) {
  const items = projectId ? getProjectItems(projectId) : VRH_ITEMS;
  return items.filter(i =>
    (i.type === 'purchased' && i.purchaseStatus === PUR.PENDING) ||
    (i.type === 'own' && (!i.materialsStatus || i.materialsStatus === PUR.PENDING))
  );
}

function getAllProblems(projectId) {
  return {
    overdue:      getOverdueItems(projectId),
    noKd:         getNoKdItems(projectId),
    blocked:      getBlockedItems(projectId),
    needPurchase: getItemsNeedingPurchase(projectId),
  };
}

function getCompanyStats() {
  let done = 0, inProg = 0, overdue = 0, blocked = 0, pending = 0;
  VRH_ITEMS.forEach(i => {
    const s = getItemStatus(i);
    if      (s === ST.DONE)    done++;
    else if (s === ST.IN_PROG) inProg++;
    else if (s === ST.OVERDUE) overdue++;
    else if (s === ST.BLOCKED) blocked++;
    else                       pending++;
  });
  return { total: VRH_ITEMS.length, done, inProg, overdue, blocked, pending };
}

function getResponsibles(projectId) {
  const items = projectId ? getProjectItems(projectId) : VRH_ITEMS;
  const resp  = new Set();
  items.forEach(i => {
    if (i.components) i.components.forEach(c => { if (c.responsible) resp.add(c.responsible); });
  });
  return [...resp];
}

function getProjectName(projectId) {
  return VRH_PROJECTS.find(p => p.id === projectId)?.name || projectId;
}

function getComplexName(complexId) {
  return COMPLEXES.find(c => c.id === complexId)?.name || complexId;
}

function getComplexAbbr(complexId) {
  return COMPLEXES.find(c => c.id === complexId)?.abbr || complexId;
}
