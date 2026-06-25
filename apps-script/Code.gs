/**
 * VRH Production OS — Google Apps Script Backend
 * ================================================
 * Этот скрипт превращает Google Таблицу в backend для системы.
 *
 * ИНСТРУКЦИЯ ПО УСТАНОВКЕ:
 * 1. Создайте Google Таблицу с листами: Projects, Items
 * 2. Откройте Extensions → Apps Script
 * 3. Вставьте этот код
 * 4. Нажмите Deploy → New deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone (или Anyone with link)
 * 5. Скопируйте URL веб-приложения
 * 6. В js/data.js установите: const SHEETS_URL = 'ВАШ_URL'
 */

// ── Константы ─────────────────────────────────────────────────
const SHEET_PROJECTS = 'Projects';
const SHEET_ITEMS    = 'Items';

// ── Главный обработчик GET-запросов ───────────────────────────
function doGet(e) {
  const action = e.parameter.action || 'getData';

  let result;
  switch (action) {
    case 'getData':   result = getAllData();              break;
    case 'getStats':  result = getStats();               break;
    case 'getItem':   result = getItem(e.parameter.id);  break;
    default:          result = { error: 'Unknown action' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Главный обработчик POST-запросов ──────────────────────────
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch(err) { return jsonResponse({ error: 'Invalid JSON' }); }

  let result;
  switch (body.action) {
    case 'updateStage':   result = updateStage(body);   break;
    case 'updateComment': result = updateComment(body); break;
    case 'addProject':    result = addProject(body);    break;
    case 'addItem':       result = addItem(body);       break;
    default: result = { error: 'Unknown action' };
  }

  return jsonResponse(result);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Получить все данные ────────────────────────────────────────
function getAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const projects = sheetToObjects(ss.getSheetByName(SHEET_PROJECTS));
  const items    = sheetToObjects(ss.getSheetByName(SHEET_ITEMS));

  // Декодировать JSON-поле stages
  items.forEach(item => {
    if (typeof item.stages === 'string') {
      try { item.stages = JSON.parse(item.stages); }
      catch(e) { item.stages = {}; }
    }
  });

  return { projects, items, timestamp: new Date().toISOString() };
}

// ── Получить статистику ────────────────────────────────────────
function getStats() {
  const data = getAllData();
  const items = data.items;

  const total = items.length;
  const done  = items.filter(i => Object.values(i.stages || {}).every(s => s === 'done' || s === 'na')).length;

  return {
    totalProjects: data.projects.length,
    totalItems: total,
    doneItems: done,
    timestamp: new Date().toISOString()
  };
}

// ── Получить позицию по ID ─────────────────────────────────────
function getItem(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ITEMS);
  const items = sheetToObjects(sheet);
  const item = items.find(i => i.id === id);
  if (!item) return { error: 'Not found' };
  if (typeof item.stages === 'string') {
    try { item.stages = JSON.parse(item.stages); } catch(e) {}
  }
  return item;
}

// ── Обновить статус этапа ──────────────────────────────────────
function updateStage(body) {
  const { itemId, stageId, status, comment } = body;
  if (!itemId || !stageId || !status) return { error: 'Missing fields' };

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ITEMS);
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];

  const idCol      = headers.indexOf('id');
  const stagesCol  = headers.indexOf('stages');
  const commentCol = headers.indexOf('comment');
  const updateCol  = headers.indexOf('lastUpdate');

  for (let r = 1; r < data.length; r++) {
    if (data[r][idCol] === itemId) {
      let stages = {};
      try { stages = JSON.parse(data[r][stagesCol]); } catch(e) {}
      stages[stageId] = status;
      sheet.getRange(r+1, stagesCol+1).setValue(JSON.stringify(stages));
      if (comment && commentCol >= 0) sheet.getRange(r+1, commentCol+1).setValue(comment);
      if (updateCol >= 0) sheet.getRange(r+1, updateCol+1).setValue(new Date().toISOString().split('T')[0]);
      return { success: true, itemId, stageId, status };
    }
  }

  return { error: 'Item not found' };
}

// ── Обновить комментарий ───────────────────────────────────────
function updateComment(body) {
  const { itemId, comment, responsible } = body;
  if (!itemId) return { error: 'Missing itemId' };

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ITEMS);
  const data  = sheet.getDataRange().getValues();
  const h     = data[0];

  const idCol          = h.indexOf('id');
  const commentCol     = h.indexOf('comment');
  const responsibleCol = h.indexOf('responsible');
  const updateCol      = h.indexOf('lastUpdate');

  for (let r = 1; r < data.length; r++) {
    if (data[r][idCol] === itemId) {
      if (comment     && commentCol     >= 0) sheet.getRange(r+1, commentCol+1).setValue(comment);
      if (responsible && responsibleCol >= 0) sheet.getRange(r+1, responsibleCol+1).setValue(responsible);
      if (updateCol   >= 0) sheet.getRange(r+1, updateCol+1).setValue(new Date().toISOString().split('T')[0]);
      return { success: true };
    }
  }

  return { error: 'Item not found' };
}

// ── Добавить проект ────────────────────────────────────────────
function addProject(body) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PROJECTS);
  const h     = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const row = h.map(col => body[col] || '');
  if (!row[h.indexOf('id')]) row[h.indexOf('id')] = 'proj_' + Date.now();
  sheet.appendRow(row);
  return { success: true, id: row[h.indexOf('id')] };
}

// ── Добавить позицию ───────────────────────────────────────────
function addItem(body) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ITEMS);
  const h     = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (body.stages && typeof body.stages === 'object') {
    body.stages = JSON.stringify(body.stages);
  }

  const row = h.map(col => body[col] !== undefined ? body[col] : '');
  if (!row[h.indexOf('id')]) row[h.indexOf('id')] = 'item_' + Date.now();
  sheet.appendRow(row);
  return { success: true, id: row[h.indexOf('id')] };
}

// ── Вспомогательные функции ────────────────────────────────────
function sheetToObjects(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1)
    .filter(row => row[0]) // пропустить пустые строки
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

// ── Инициализация структуры листов ────────────────────────────
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Лист Projects
  let ps = ss.getSheetByName(SHEET_PROJECTS);
  if (!ps) { ps = ss.insertSheet(SHEET_PROJECTS); }
  if (ps.getLastRow() === 0 || ps.getRange(1,1).getValue() === '') {
    ps.getRange(1, 1, 1, 7).setValues([[
      'id','name','client','responsible','deadline','startDate','description'
    ]]);
    ps.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#1E40AF').setFontColor('white');
  }

  // Лист Items
  let is = ss.getSheetByName(SHEET_ITEMS);
  if (!is) { is = ss.insertSheet(SHEET_ITEMS); }
  if (is.getLastRow() === 0 || is.getRange(1,1).getValue() === '') {
    is.getRange(1, 1, 1, 13).setValues([[
      'id','projectId','complexId','number','name','nameShort',
      'quantity','unit','type','responsible','supplier','deadline',
      'stages','comment','lastUpdate'
    ]]);
    is.getRange(1, 1, 1, 15).setFontWeight('bold').setBackground('#1E40AF').setFontColor('white');
  }

  SpreadsheetApp.getUi().alert('✅ Листы Projects и Items успешно созданы!');
}

// ── Тест подключения ──────────────────────────────────────────
function testConnection() {
  const data = getAllData();
  Logger.log('Projects: ' + data.projects.length);
  Logger.log('Items: '    + data.items.length);
  SpreadsheetApp.getUi().alert(
    `✅ Подключение работает!\nПроектов: ${data.projects.length}\nПозиций: ${data.items.length}`
  );
}

// ── Меню в Google Sheets ──────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('VRH Production OS')
    .addItem('Инициализировать листы', 'initSheets')
    .addItem('Тест подключения',       'testConnection')
    .addToUi();
}
