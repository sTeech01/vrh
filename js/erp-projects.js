'use strict';
/* ============================================================
   VRH ERP - Модуль «Проекты»
   Жизненный цикл: CRM → Договор подписан → Проект
   Текущий статус: заглушка (в разработке)
   ============================================================ */

function renderErpProjects(el) {
  if (!el) return;
  if (typeof window.setBreadcrumb === 'function') setBreadcrumb('Проекты');

  const features = [
    { icon: 'chart',     label: 'Производство',    desc: 'Производственный маршрут и задачи' },
    { icon: 'cart',      label: 'Закупки',          desc: 'Заказы материалов и комплектующих' },
    { icon: 'list',      label: 'Склад',            desc: 'Учёт материалов и готовой продукции' },
    { icon: 'document',  label: 'Документы',        desc: 'Договоры, акты, спецификации' },
    { icon: 'clipboard', label: 'Монтаж',           desc: 'Выездные работы и монтажные операции' },
    { icon: 'refresh',   label: 'Сервис',           desc: 'Гарантийное и послегарантийное обслуживание' },
    { icon: 'save',      label: 'Финансы',          desc: 'Бюджет, платежи, рентабельность' },
    { icon: 'clock',     label: 'История проекта',  desc: 'Полный журнал событий и изменений' },
  ];

  const featureCards = features.map(f => `
    <div class="erp-proj-feature">
      <div class="erp-proj-feature-icon">${iconSvg(f.icon, 18)}</div>
      <div class="erp-proj-feature-label">${f.label}</div>
      <div class="erp-proj-feature-desc">${f.desc}</div>
    </div>`).join('');

  /* SVG-иллюстрация: поток жизненного цикла */
  const illustration = `
  <svg class="erp-proj-illustration" viewBox="0 0 520 160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <!-- Линии соединения -->
    <line x1="90" y1="80" x2="148" y2="80" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.3"/>
    <line x1="218" y1="80" x2="276" y2="80" stroke="currentColor" stroke-width="2" stroke-dasharray="0" opacity="0.5"/>
    <line x1="346" y1="80" x2="404" y2="80" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.25"/>

    <!-- Стрелки -->
    <polyline points="144,75 152,80 144,85" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
    <polyline points="272,75 280,80 272,85" stroke="currentColor" stroke-width="2" opacity="0.6"/>
    <polyline points="400,75 408,80 400,85" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>

    <!-- Узел 1: CRM -->
    <circle cx="54" cy="80" r="36" fill="currentColor" opacity="0.06"/>
    <circle cx="54" cy="80" r="26" fill="currentColor" opacity="0.10"/>
    <text x="54" y="76" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor" opacity="0.55">CRM</text>
    <text x="54" y="90" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.38">Переговоры</text>

    <!-- Узел 2: Договор -->
    <circle cx="183" cy="80" r="36" fill="currentColor" opacity="0.06"/>
    <circle cx="183" cy="80" r="26" fill="currentColor" opacity="0.10"/>
    <text x="183" y="76" text-anchor="middle" font-size="9" font-weight="600" fill="currentColor" opacity="0.55">Договор</text>
    <text x="183" y="89" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.38">подписан</text>

    <!-- Узел 3: Проект (активный, акцентный) -->
    <circle cx="311" cy="80" r="42" fill="currentColor" opacity="0.08"/>
    <circle cx="311" cy="80" r="32" fill="currentColor" opacity="0.15"/>
    <circle cx="311" cy="80" r="22" fill="currentColor" opacity="0.18"/>
    <text x="311" y="76" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" opacity="0.75">ПРОЕКТ</text>
    <text x="311" y="90" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.45">Активная работа</text>

    <!-- Узел 4: Завершён -->
    <circle cx="437" cy="80" r="36" fill="currentColor" opacity="0.04"/>
    <circle cx="437" cy="80" r="26" fill="currentColor" opacity="0.07"/>
    <text x="437" y="76" text-anchor="middle" font-size="9" font-weight="600" fill="currentColor" opacity="0.40">Завершён</text>
    <text x="437" y="89" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.28">Сдача объекта</text>

    <!-- Метки под узлами -->
    <text x="54" y="126" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.3">Этап 1</text>
    <text x="183" y="126" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.3">Этап 2</text>
    <text x="311" y="132" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.45">Этап 3</text>
    <text x="437" y="126" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.25">Этап 4</text>
  </svg>`;

  el.innerHTML = `
  <div class="erp-proj-page">
    <div class="erp-proj-hero">
      ${illustration}
      <div class="erp-proj-badge">В разработке</div>
      <h1 class="erp-proj-title">Модуль находится в разработке</h1>
      <p class="erp-proj-sub">
        После подписания договора все проекты автоматически будут отображаться здесь.<br>
        История переговоров, документы и контакты из CRM сохраняются полностью.
      </p>
      <button class="btn-secondary" onclick="navigate('crm')" style="margin-top:8px">${iconSvg('user', 14)} Перейти в CRM</button>
    </div>

    <div class="erp-proj-future">
      <div class="erp-proj-future-title">В будущем данный модуль станет центром управления проектом и объединит:</div>
      <div class="erp-proj-features">${featureCards}</div>
    </div>
  </div>`;

  const view = document.getElementById('view');
  if (view) view.scrollTop = 0;
}

window.renderErpProjects = renderErpProjects;
