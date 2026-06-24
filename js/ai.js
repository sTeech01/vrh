'use strict';
// =============================================================
// VRH Production OS — AI-анализ v3.0
// Rule-based движок рекомендаций (без внешних API)
// Работает с новой моделью: doneCount + components + history
// =============================================================

function generateAIRecommendations() {
  const recs = [];
  const stats = getCompanyStats();

  // ── Критическое: просрочено > 0 ─────────────────────────────
  const overdueItems = VRH_ITEMS.filter(i => getItemStatus(i) === ST.OVERDUE);
  if (overdueItems.length > 0) {
    const sorted = [...overdueItems].sort((a,b) => daysOverdue(b.deadline) - daysOverdue(a.deadline));
    recs.push({
      type: 'danger',
      title: `Просрочено ${overdueItems.length} позиций`,
      text: `Позиции вышли за дедлайн. Максимальная просрочка — ${daysOverdue(sorted[0].deadline)} дн. (${sorted[0].nameShort}). Требуется немедленное совещание с руководством.`,
      items: sorted.map(i => ({
        name: i.nameShort, itemId: i.id,
        detail: `Просрочено ${daysOverdue(i.deadline)} дн. · ${getComplexAbbr(i.complexId)}`,
      })),
    });
  }

  // ── Критическое: нет КД ─────────────────────────────────────
  const noKdItems = getNoKdItems('kalalahti');
  if (noKdItems.length > 0) {
    recs.push({
      type: 'danger',
      title: `КД не готово: ${noKdItems.length} позиций`,
      text: 'Производство не может начаться без конструкторской документации. Срочно ускорить выпуск КД.',
      items: noKdItems.map(i => ({
        name: i.nameShort, itemId: i.id,
        detail: i.blockReason || 'Нет КД',
      })),
    });
  }

  // ── Предупреждение: дедлайн менее чем через 14 дней ─────────
  const urgentDate = new Date(TODAY);
  urgentDate.setDate(urgentDate.getDate() + 14);
  const urgentItems = VRH_ITEMS.filter(i => {
    const status = getItemStatus(i);
    if (status === ST.DONE || status === ST.OVERDUE) return false;
    const dl = new Date(i.deadline);
    return dl <= urgentDate && dl >= TODAY;
  }).sort((a,b) => new Date(a.deadline) - new Date(b.deadline));

  if (urgentItems.length > 0) {
    recs.push({
      type: 'warning',
      title: `${urgentItems.length} позиций — дедлайн в течение 2 недель`,
      text: 'Необходимо ежедневный контроль темпа выполнения.',
      items: urgentItems.map(i => {
        const diff = Math.round((new Date(i.deadline) - TODAY) / 86400000);
        return { name: i.nameShort, itemId: i.id, detail: `Осталось ${diff} дн. · ${calcProgress(i)}% готово` };
      }),
    });
  }

  // ── Предупреждение: заблокировано ───────────────────────────
  const blockedItems = VRH_ITEMS.filter(i => {
    const st = getItemStatus(i);
    return st === ST.BLOCKED && !noKdItems.find(x => x.id === i.id);
  });
  if (blockedItems.length > 0) {
    recs.push({
      type: 'warning',
      title: `Заблокировано: ${blockedItems.length} позиций`,
      text: 'Позиции не могут двигаться вперёд из-за внешних блокировок.',
      items: blockedItems.map(i => ({
        name: i.nameShort, itemId: i.id,
        detail: i.blockReason || 'Блокировка не указана',
      })),
    });
  }

  // ── Предупреждение: узкие места в производстве ──────────────
  const ownItems = VRH_ITEMS.filter(i => i.type === 'own' && i.components?.length > 0);
  const bottlenecks = ownItems.map(i => ({
    item: i,
    bn: getBottleneck(i),
    pct: calcProgress(i),
  })).filter(x => x.bn && x.pct < 100 && x.pct > 0)
    .sort((a,b) => a.pct - b.pct)
    .slice(0, 5);

  if (bottlenecks.length > 0) {
    recs.push({
      type: 'warning',
      title: 'Узкие места в производстве',
      text: 'Данные компоненты тормозят выпуск готовой продукции. Фокус на снятии ограничений.',
      items: bottlenecks.map(x => ({
        name: x.item.nameShort, itemId: x.item.id,
        detail: `Узкое место: ${x.bn.name} (${x.bn.done}/${x.item.quantity}) · прогресс ${x.pct}%`,
      })),
    });
  }

  // ── Информация: закупки не инициированы ─────────────────────
  const noPurchase = VRH_ITEMS.filter(i =>
    i.type === 'purchased' && i.purchaseStatus === PUR.PENDING
  );
  if (noPurchase.length > 0) {
    recs.push({
      type: 'info',
      title: `Не инициированы закупки: ${noPurchase.length} позиций`,
      text: 'Эти позиции ещё не заказаны. Задержка закупки может стать критической.',
      items: noPurchase.slice(0, 8).map(i => ({
        name: i.nameShort, itemId: i.id,
        detail: `Дедлайн: ${i.deadline} · ${getComplexAbbr(i.complexId)}`,
      })),
    });
  }

  // ── Успех: хорошие показатели ───────────────────────────────
  const done    = stats.done;
  const inProg  = stats.inProg;
  const completelyDone = VRH_ITEMS.filter(i => calcProgress(i) === 100);
  if (completelyDone.length >= 3) {
    recs.push({
      type: 'success',
      title: `Выполнено: ${completelyDone.length} позиций из ${stats.total}`,
      text: `${done} позиций полностью готовы. ${inProg} в работе. Продолжать текущий темп.`,
      items: completelyDone.slice(0, 4).map(i => ({
        name: i.nameShort, itemId: i.id,
        detail: `${i.quantity} ${i.unit} · ${getComplexAbbr(i.complexId)}`,
      })),
    });
  }

  return recs;
}

function generateWeeklyTasks() {
  const tasks = [];
  const nextWeek = new Date(TODAY);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Просроченные — первый приоритет
  VRH_ITEMS
    .filter(i => getItemStatus(i) === ST.OVERDUE)
    .sort((a,b) => daysOverdue(b.deadline) - daysOverdue(a.deadline))
    .slice(0, 3)
    .forEach(i => {
      tasks.push({
        itemId: i.id, overdue: true,
        text: `Срочно: ${i.nameShort}`,
        detail: `Просрочено на ${daysOverdue(i.deadline)} дн. · ${getComplexAbbr(i.complexId)} · ${calcProgress(i)}% готово`,
      });
    });

  // Дедлайн на этой неделе — второй приоритет
  VRH_ITEMS
    .filter(i => {
      if (getItemStatus(i) === ST.DONE || getItemStatus(i) === ST.OVERDUE) return false;
      const dl = new Date(i.deadline);
      return dl >= TODAY && dl <= nextWeek;
    })
    .sort((a,b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 4)
    .forEach(i => {
      const days = Math.round((new Date(i.deadline) - TODAY) / 86400000);
      tasks.push({
        itemId: i.id, overdue: false,
        text: `${i.nameShort}`,
        detail: `Дедлайн через ${days} дн. · ${getComplexAbbr(i.complexId)} · ${calcProgress(i)}% готово`,
      });
    });

  // Закупки со статусом ORDERED — проверить поступление
  VRH_ITEMS
    .filter(i => i.type === 'purchased' && i.purchaseStatus === PUR.ORDERED)
    .slice(0, 2)
    .forEach(i => {
      tasks.push({
        itemId: i.id, overdue: false,
        text: `Проверить поставку: ${i.nameShort}`,
        detail: `Статус: заказано · ${getComplexAbbr(i.complexId)}`,
      });
    });

  // Узкие места с активным производством — третий приоритет
  VRH_ITEMS
    .filter(i => i.type === 'own' && i.components?.length > 0)
    .map(i => ({ item: i, bn: getBottleneck(i) }))
    .filter(x => x.bn && x.bn.done < x.item.quantity && calcProgress(x.item) > 0 && calcProgress(x.item) < 80)
    .slice(0, 2)
    .forEach(x => {
      tasks.push({
        itemId: x.item.id, overdue: false,
        text: `Ускорить: ${x.item.nameShort} — компонент «${x.bn.name}»`,
        detail: `${x.bn.done}/${x.item.quantity} ${x.item.unit} · узкое место`,
      });
    });

  return tasks.slice(0, 8);
}
