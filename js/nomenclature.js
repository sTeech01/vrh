'use strict';
/* ═══════════════════════════════════════════════════════════════
   VRH ERP — Модуль «Номенклатура» (унификация названий материалов)
   Идея: одна и та же позиция у разных поставщиков называется по-разному
   («рейка 20х40» / «деревянная рейка 20х40» / «отшлифованная...» и т.д.).
   Модуль собирает варианты названий от разных специалистов в одной таблице,
   чтобы прийти к единому стандарту наименования для 1С.
   CSS-префикс: nom-*
   Таблицы: nomenclature_items, nomenclature_columns, nomenclature_values
   ═══════════════════════════════════════════════════════════════ */

// Базовый список наименований — источник: "склад номенклатура (edit).xlsx"
// (реальная номенклатура склада, 442 позиции; служебная строка "Итого" исключена)
const NOMENCLATURE_SEED = ["15\" Ноутбук MacBook Air M4 10-core CPU/16384/SSD 512GB/GPU 10-core/Silver","17.3'' Ноутбук Acer Nitro V 17 AI (ANV17-41-R00N) (QHD/IPS) Ryzen 7 260/16384/SSD 1Tb/NV RTX5060/Dos","Амортизация матрицы конуса","Анкер клиновой М10*100 нерж_GS","Анкер клиновой М8х80 нерж. А4 RMG","Аргон газообразный","Аргон_GS","Баллон аргоновый","Бензин 92","Бита RedVerg Pz2x50","Болт 10х35 нерж._GS","Болт 10х40 нерж._GS","Болт 10х40 оцин._GS","Болт 10х50 нерж._GS","Болт 10х60 нерж._GS","Болт 10х75 нерж._GS","Болт 12х45 нерж._GS","Болт 14х65 нерж._GS","Болт 5х60 нерж. с неполной резьбой_GS","Болт 6х10 нерж._GS","Болт 6х20 нерж. DIN 933 с шестигр. головкой полная резьба_GS","Болт 6х20 нерж._GS","Болт 6х25 нерж._GS","Болт 6х30 нерж._GS","Болт 6х35 нерж._GS","Болт 6х40 нерж._GS","Болт 6х45 нерж._GS","Болт 6х50 нерж_GS","Болт 6х80 нерж._GS","Болт 8х20 нерж._GS","Болт 8х30 нерж._GS","Болт 8х45 нерж. потай_GS","Болт 8х55 нерж._GS","Болт 8х65 нерж._GS","Болт 8х70 нерж. потай_GS","Болт M6x18 нерж DIN 933","Болт нерж M6x35 DIN 933","Болт нерж M6x45 DIN 933","Болт нерж M6x70 DIN 933","Ботинки","Ботинки утепл.","Брусок обраб. консерв. 100*100*6000","Бункер 45л с крышкой, с патрубком D=110мм","Быстросьем","Валик","Валик шлифовальный _GS","Веревка туристическая 12 мм. Шнур полипропиленовый плетеный с сердечником.","Вилка эл. каб. 32А 3Р+РЕ 380В ССИ-024_GS","Вилка эл. каб. 32А 3Р+РЕ+N 380В ССИ-025_GS","Винт 5х10 мм нерж. потай_GS","Винт 6х20 мм нерж. потай_GS","Винт нерж с потайной головкой M6x70 DIN 965","Винт нерж с потайной головкой и шестигранным углублением M6x45 DIN 7991","Винт-конфирмат 7х50, потай, оцинк. 6-ти гр.","Выключатель авт. модульный 1п С 16а_GS","Гайка M6 нерж DIN 985","Гайка барашковая М 5 нерж._GS","Гайка М 6 нерж._GS","Гайка М10 нерж. мелкая резьба_GS","Гайка М10 нерж. удлиненная_GS","Гайка М10 нерж._GS","Гайка М12 нерж._GS","Гайка М5 нерж. с вставкой_GS","Гайка М6 нерж. с вставкой_GS","Гайка М6 нерж. удлиненная _GS","Гайка М8 нерж. колпаковая_GS","Гайка М8 нерж. с вставкой_GS","Гайка М8 нерж. удлиненная _GS","Гайка М8 нерж._GS","Гайка шестигранная самостоп высокая M6 А4","Гровер 5_GS","Грунтовка ГФ-021","Двигатель шпинделя с ЧПУ 500 Вт, 100 В постоянного тока, 12000об","Диск пильный по алюминию ЗУБР 185x30/20 мм, 60Т 36916-185-30-60_z01","Диск пильный по ламинату 185 х 20 х 40Т карбидные режущие вставки для циркулярной пилы","Доска профилированная 25*120*3","Доска профилированная 40*100*6","Дрель-шуруповерт, 18В, 2 АКБ 2Ач, в кейсе ДШЛ-185-22 ЗУБР","Дюбель 10х100 распорный с шипами ПП_GS","Дюбель распорный с шипами 6х30","Заглушка клеевая d110 PVC-UH PN16","Заглушка клеевая d50 PVC-UH PN16","Заглушка ПВХ d25","Заглушка ПВХ d40","Заглушка ПП 110 _GS","Задвижка шиберная ПВХ d110 DN100 PN 3.5, диск из нержавеющей стали, уплотнение EPDM","Зажим наборный ЗНИ-2,5 25А серый_GS","Зажим наборный ЗНИ-2,5 25А синий_GS","Заклепка 3х8 нерж._GS","Заклепка 4,8х16 нерж DIN 7337","Заклепка 4,8х30 нерж._GS","Заклепка вытяжная 4,8х14 нерж._GS","Заклепка вытяжная 4,8х16 нерж._GS","Заклепка вытяжная нержавеющая сталь А2/А2 4.8х10","Заклепка нерж 4,8х12 DIN 7337","Заклепка нерж 4,8х14 DIN 7337","Заклепочник промышленный Hans","Замок трехгр. для ЩМП-П ip65 proxima PB65LOCK_GS","Измеритель освещенности Testo 540","Инвертор сварочный TIG 200 P AC/DC \"REAL\" E20101 95484 Сварог","Инструмент для установки резьбовых заклепок /Адаптер для шуруповерта_GS","Источник питания для светодиодного освещения ELG-300-12A_GS","Кепка","Кисть плоская","Клей для ПВХ (473 мл.) Bailey L-6023 35923 AQUAVIVA","Клей универсальный Момент 88 30 мл","Клемма СМК 222-412_GS","Ключ трещотка 1/4 72 зубца для торцевых головок_GS","Кнопка ВА31 зеленая NO IP65 PROxima_GS","Коврик резиновый противоскользящий 120x100","Колер паста","Кольцо гимнастическое пластиковое","Кольцо стопор. D 36 _GS","Компрессорная установка АФ125МТ-5,5-ПШК.125","Контейнер на 500л (КЛ500СПТ) со сливом на пластмассовой подставке с колесами","Конусный отстойник","Конусный отстойник 1000х1000х800 с запорами","Костюм сварщика","Костюм утепл.","Краги спилковые","Краска акриловая интерьерная влагостойкая","Крепление для труб d-16 мм, клипса_GS","Круг d 8.0 мм нерж.","Круг зачистной 150х7х22.2/ для зачистки сварочных швов_GS","Круг лепестковый торцевой  125 зерно 150_GS","Круг лепестковый торцевой  125 зерно 60_GS","Круг отрезн. по мет 125х1,2х22","Круг отрезной 125_GS","Круг отрезной BC-2N 125х0.8х22.23","Круг фибровый шлифовальный 125мм по металлу_GS","Круг шлифовальный доводочный 125х13х22_GS","Кружка мерная 1 л, емкость мерная пластиковая, стакан мерный с носиком, прозрачный","Кружка мерная 500 мл, мерная емкость, мерный стакан, кувшин прозрачный пластиковый","Крышка контейнера К500","Куртка утепл.","Куртка х/б","Лазерный маркиратор ручной волоконный, модель LM-F30","Лампа бактерицидная ультрафиолетовая кварцевая, безозоновая , 30Вт, 92 см","Лезвия для ножей 18х100х0,5 мм","Лента тарная стальная оцинкованная 0,55х20 мм","Лист AISI Т=1,0мм (1000 х 4300мм)","Лист AISI Т=1,0мм (1250 х 1600мм)","Лист AISI Т=1,0мм (1250 х 2300мм)","Лист AISI Т=1,0мм (1500 х 3000мм)","Лист AISI Т=1,5мм (1250 х 2100мм)","Лист AISI Т=1,5мм (1500 х 3000мм)","Лист AISI Т=2,0мм (1000 х 2000мм)","Лист AISI Т=2,0мм (1500 х 2000мм)","Лист AISI Т=3,0мм (1250 х 2500мм)","Лист AISI Т=3,0мм (1250 х 2750мм)","Лист AISI Т=3,0мм (1500 х 3000мм)","Лист AISI Т=3,0мм (1500 х 3500мм)","Лист В-ПП-БСГ 8х1500х3000 (24,84кг) цв. зеленый УФ + пленка","Лист перфорированный Rv1,5-3 AISI 304 1х1000х2000 мм","Лист перфорированный Rv8-12 AISI 304 1,5 мм 1000х2000 мм","Лист ПП 10х1200х50 голубой","Лист ПП 10х1500х3000 (41,4кг) цв. голубой УФ + пленка","Лист ПП 10х360х20 голубой","Лист ПП 10х380х50 голубой","Лист ПП 10х500х20 голубой","Лист ПП 10х630х50 голубой","Лист ПП 10х950х50 голубой","Лист ПП 3х1500х3000 серый_GS","Лист ПП 4х1500х3000 серый_GS","Лист ПП 5х1500х3000 (20,7кг) цв. зеленый УФ + пленка","Лист ПП 5х1500х4000 (27,6кг) цв. зеленый УФ + пленка","Лист ПП 6х1500х3000 (24,84кг) цв. зеленый УФ + пленка","Лист ПП 8х1000х130 зеленый","Лист ПП 8х1000х150 зеленый","Лист ПП 8х1100х5000 (40,48кг) цв. зеленый УФ + пленка","Лист ПП 8х1195х1050 зеленый","Лист ПП 8х1195х580 зеленый","Лист ПП 8х1195х650 зеленый","Лист ПП 8х1300х950 зеленый","Лист ПП 8х1500х3000 (33,12кг) цв. зеленый УФ + пленка","Лист ПП 8х1595х350 зеленый","Лист ПП 8х1700х380 зеленый","Лист ПП 8х2000х4000 (58,88кг) цв. зеленый УФ + пленка","Лист ПП 8х2000х4500 (66,24кг) цв. зеленый УФ + пленка","Лист ПП 8х2000х5000 (73,6кг) цв. зеленый УФ + пленка","Лист ПП 8х300х50 зеленый","Лист ПП 8х380х150 зеленый","Лист ПП 8х500х50 зеленый","Лист ПП 8х550х355 зеленый","Лист ПП 8х630х150 зеленый","Лист ПП 8х950х150 зеленый","Лобзик ПМ5-720Э ИДФР298256003-К3 Фиолент","Лобзик ПМ5-720Э Фиолент_GS","Манжета 16х35х7_GS","Маркер белый_GS","Маркер черный","Маркер черный_GS","Машина ЗУБР УШМ 125 мм, 1100 Вт_GS","Мембрана д/гидроаккумулятора_GS","Микроскоп цифровой Levenhuk MED D40T, тринокулярный","Муфта 3/8\"AISI_GS","Муфта DN 40 нерж. (48,3 мм)_GS","Муфта полнорезьбовая AISI 304  ISO, 1 1/4","Муфта полнорезьбовая AISI 304 ISO, 3/8\"","Мыло туалетное","Набор бит PH2x127, сталь S2, Gross","Наконечник штыревой НШВИ 1,0-8_GS","Направляющие_GS","Насадка №16","Насадка для заклепок 2,4-4,8 мм с ручкой и тремя зажимами_GS","Насадка для сварки треуг. прутком 3х3х5мм_GS","Насадка фторопластовая №8","Насадка-заклепочник для шуруповерта хвостовик шестигранный, 2.4-3.2-4-4.8-6.4 мм","Насос DAB NOVA 180 M-A","Насос погружной (помпа) охл. жидкости для шпинделя, 80 Вт_GS","Насос погружной 200 m3/h 4.5kw 380V","Натяжитель для стропы","Наушники противошумные_GS","Ниппель приварной (резьба) ДУ 10 (3/8\") AISI","Ножницы электрогидравлические для резки уголка MD-60","Опрыскиватель садовый помповый Жук Классик 2,5 литра","Отвод PP-B коричневый Дн 110х45гр б/нап в/к VALFEX 30102110","Отвод канализационный Дн 110х90гр","Отвод ПП 110/45_GS","Отвод ПП 200х200/87_GS","Очиститель рук","Очки защитные","Пена монтажная","Пенополистерол экструдир.","Перчатки акриловые зимние с латекс. покрытием","Перчатки ПАЛМА","Перчатки трикотажные с ПВХ","Пилки для лобзика по дереву пластику 100/75 шаг 2 мм_GS","Пилки для лобзика по дереву пластику 75/3 Т-110С_GS","Пилки для лобзика по металлу 50 мм_GS","Пилки для лобзика по металлу Makita D-34908_GS","Пилки для лобзика по металлу Т118А_GS","Пилки для лобзика по пластику 100/75 _GS","Пилки для лобзика по пластику Т101А_GS","Плащ Дождевик","Пленка термоусадочная 3,9","Пленка термоусадочная 6,1","Подшипник 15х35х11_GS","Подшипник 16х31х10_GS","Подшипник 16х35х10_GS","Полоса 100мм*4мм нерж._GS","Полоса 30мм*3мм нерж._GS","Полоса 40мм*3мм нерж._GS","Полоса 40мм*4мм нерж._GS","Полоса 40мм*5мм нерж._GS","Полоса AISI 304 40мм х 3,0мм","Полукомбинезон х/б","Полумаска","Помпа для станка ЧПУ погруж._GS","Приспособление для сверления прямых отверстий под углом 90 градусов с 8 стальными сверлильными втулк","Провод ПВС 2х0,75_GS","Провод ПВС 4х1_GS","Профилированная доска 25*100*6000 2 сорт","Профилированный брусок 40*50*3000 2 сорт","Профилированный брусок 50*50*3000 2 сорт","Профиль ПП 50х35_GS","Профиль ПП 60х40_GS","Пруток ПП круг. 4 мм зеленый_GS","Пруток ПП круг. 4мм зеленый","Пруток ПП треуг. 2,9х2,9х5мм зеленый","Пруток ПП треуг. 2,9х2,9х5мм зеленый_GS","Пруток ПП треуг. 4х4х7 мм зеленый_GS","Пруток ПП треуг. 4х4х7мм зеленый","Пруток присадочный нержавеющий 2,0 мм для аргонодуговой сварки  SvarCity","Пруток ПЭ круг. 4мм черный","Пряжка металлическая 16мм","ПФ_Лист ПП 10х1500х3000 (41,4кг) цв. голубой УФ + пленка","ПФ_Лист ПП 8х1500х3000 (33,12кг) цв. зеленый УФ + пленка","ПФ_Подвес труб - для биофильтра","ПФ_ПП переход  - для  биофильтра","Радиатор игольчатый И-120 (269*110*20)_GS","Разъем 2-х контактный _GS","Разъем 9-х контактный _GS","Рама аэратора погружного - спецификация  ВРХИ.АП01.01.00.27","Рама биофильтр 2000х5000 - Спецификация ВРХИ.БФ.01.01.00.22 СБ","Расходомер-счетчик ультразвуковой Streamlux SLS-720F, комплектация \"Средний\"","Розетка панельная с крышкой РП 14-3_GS","Розетка стационарная ССИ-124 32А 380В_GS","Розетка стационарная ССИ-125 32А 380В_GS","Рулетка выдвижная стальная 10 м x 25 мм, автоблокировка, две кнопки остановки 67-225 NEO TOOLS","Рулетка измерительная 7,5мх25мм, Special, обрезиненный корпус, 3 механ. фиксации, 671355 RABBITEX","Рулетка строительная 5м x 19мм","Рулетка строительная 5м x 25мм","Ручка круглая с резьбовой втулкой_GS","Рым-гайка М 6 нерж._GS","Рым-гайка М 8 нерж._GS","Сальник 16х30х8_GS","Сальник 16х35х7_GS","Саморез 3,5x 41 мм гипсокартон/дерево","Саморез 4.2 x 12 мм нерж сталь","Саморез 6,3х100  мм нерж. с острым концом, потайной головкой, крест. шлиц_GS","Саморез 6,3х100  мм нерж. с острым концом, шестигр. головкой полной резьбой _GS","Саморез 6,3х50  мм нерж. с полукр. головкой крест. шлиц_GS","Саморез 6.3х100 A2 DIN7976","Саморез нерж потай 4,2x50 DIN 7982 А2, универсал","Саморез универ. по дереву жел. цинк 5х50 мм","Саморез универсальный жел. цинк PZ 6х60 мм","Сапоги ЭВА","Сверло по металлу 1.0 мм","Сверло по металлу 1.0 мм ц/х HSS","Сверло по металлу 2.0х49 мм ц/х HSS-Co","Сверло по металлу кобальтовое (Р6М5К5) М35 5.0 мм","Сверло по металлу кобальтовое (Р6М5К5) М35 6.5 мм","Сверло по металлу кобальтовое (Р6М5К5) М35 7.0 мм","Сверло по металлу кобальтовое (Р6М5К5) М35 8.0 мм","Сверло по металлу кобальтовое HSS-Co5 ц/хв, размер 1x14x36 мм","Сверло по металлу кобальтовое HSS-Co5 ц/хв, размер 2,0x24x49 мм","Скотч специализированный (термоусадочный)","Стрейч-пленка","Стропа тканная","Струбцина F-образная, 100х300мм, кованая Denzel","Струбцина F-образная, 100х300мм, кованая_GS","Тент зеленый 4х8","Тент синий 6х10","Теплообменник ТВ-123.187","Термометр Testo 103 кулинарный с щупом 7,5 см","Тест для измерения концентрации в воде аммиака и аммония НИЛПА NH3/NH4","Тест для измерения концентрации нитритов НИЛПА NO2","Тиски поворотные, слесарные, с наковальней 150 мм","Тройник PP-B кор б/н Дн110х110х87гр в/к VALFEX 34110110","Тройник PP-B кор б/н Дн160х110х45гр перех в/к VALFEX 33160110","Тройник клеевой 90° d110 PVC-UH PN16","Тройник клеевой 90° d50 PVC-UH PN16","Тройник ПП 110х110/87_GS","Тройник ПП 160х110/45_GS","Труба 10х1,0 нерж (м)_GS","Труба 12 нерж (по 0,7 м)_GS","Труба 15х1,0 нерж (м)_GS","Труба 16 нерж (по 0,5 м)_GS","Труба 16х1,0 нерж (м)_GS","Труба 20 нерж (по 0,8 м)_GS","Труба 40х2 нерж. (м)_GS","Труба 57 нерж. (м)_GS","Труба AISI 304 d=08мм х 1,0мм","Труба AISI 304 d=10мм х 1,0мм","Труба AISI 304 d=12мм х 1,0мм","Труба AISI 304 d=16мм х 2,0мм (6000мм)","Труба AISI 304 d=20мм х 2,0мм","Труба AISI 304 d=57мм х 3,0 мм","Труба AISI 304 проф. 15мм х 15мм х 1,5мм (6000мм)","Труба AISI 304 проф. 20мм х 20мм х 1,0мм (6000мм)","Труба AISI 304 проф. 20мм х 20мм х 2,0мм (6000мм)","Труба AISI 304 проф. 30мм х 30мм х 2,0мм (6000мм)","Труба AISI 304 проф. 40мм х 20мм х 2,0мм (6000мм)","Труба AISI 304 проф. 40мм х 40мм х 3.0мм (6000мм)","Труба AISI 304 проф. 50мм х 25мм х 2.0мм (6000мм)","Труба PP-B кор б/н Дн110х3,4 SN4 L=0,5м в/к VALFEX 301100050","Труба PP-B кор б/н Дн110х3,4 SN4 L=1,0м в/к VALFEX 301100100","Труба PP-B кор б/н Дн110х3,4 SN4 L=2,0м в/к VALFEX 301100200","Труба PP-B кор б/н Дн160х4,9 SN4 L=0,5м в/к VALFEX 301600050","Труба PP-B кор б/н Дн160х4,9 SN4 L=1,0м в/к VALFEX 301600100","Труба PP-B с раструбом коричневая Дн 200х6,2 б/нап SN4 L=2 м в/к VALFEX 200200600","Труба PP-FIBER арм. стекл., PN  20, 20 ММ/белый/","Труба напорная НПВХ PN 10 (110*4,2) с гладкими концами, 2000 мм","Труба напорная НПВХ PN 10 (40*1,9) с гладкими концами, 2385 мм","Труба напорная НПВХ PN 16 (25*1,9) с гладкими концами, 1385 мм","Труба напорная НПВХ PN 16 (25*1,9) с гладкими концами, 2000 мм","Труба напорная НПВХ PN 16 (50*3,7) с раструбом, 3000 мм","Труба ПП 160-1000_GS","Труба ПП 160-2000_GS","Труба проф. 08-3ПС 30мм х 30мм х 2.0мм (6000мм)","Труба проф. 20х20х1 нерж._GS","Труба проф. 20х20х2 нерж._GS","Труба проф. 25х25х1 нерж._GS","Труба проф. 25х25х2 нерж._GS","Труба проф. 30х15х1,5 нерж._GS","Труба проф. 30х30х2 нерж._GS","Труба проф. 35х15х1,5 нерж._GS","Труба проф. 40х20х2 нерж._GS","Труба проф. 50х25х2 нерж._GS","Труба проф. 50х50х3 нерж._GS","Труба проф. 60мм х 40мм х 3.0мм ст.3","Труба проф. 80мм х 40мм х 3.0мм ст.3","Уайт-спирит (5,0л)","Угол упаковочный для стреппинг ленты 12-19мм ПП 45х7х3мм","Уголок 20*20*3 нерж._GS","Уголок 30*30*3 нерж._GS","Уголок 50*50*5 нерж._GS","Уголок AISI 304 20мм х 20мм х 3.0мм","Уголок AISI 304 35мм х 35мм х 3.0мм","Уголок AISI 304 40мм х 40мм х 3.0мм","Уголок AISI 304 50мм х 50мм х 5.0мм","Уголок строительный \"Стандарт\" 30 см","Угольник слесарный цельно-металлический, крашеная шкала, 400x600 мм FIT IT","УШМ 125 мм, 1100 Вт УШМ-125-1105 ЭТ ЗУБР","Фанера 4 мм","Фезер кромочный 750 вт ФПК-750 ЗУБР","Фен","Фен с насадками","Фиксатор резьбы_GS","Фреза 6х10х30_GS","Фреза 6х12х30_GS","Фреза 6х3х13_GS","Фреза 6х4х30_GS","Фреза 6х5х20_GS","Фреза 6х6х30_GS","Фреза 6х8х30_GS","Фреза концевая спиральная однозаходная 6х12х50мм по дереву _GS","Фреза кромочная конусная 45 градусов 30.2 х 13 мм подшипник 12.7 мм хвостовик 8 мм VIRA","Фреза пазовая V-образная 8х10х10_GS","Фреза по дереву 28х13х57 мм_GS","Футболка","Хомут - опора для труб пластик 160 мм_GS","Хомут - опора для труб пластик 32 мм_GS","Хомут - опора для труб пластик 40 мм_GS","Хомут 12-22_GS","Хомут 25-40_GS","Хомут пластик Дн110 с защелкой б/к VALFEX 20107110","Хомут силовой шарнирный 201-213/24 мм_GS","Хомут силовой шарнирный 214-226/24 мм_GS","Хомут силовой шарнирный D149-161мм, нерж.сталь Gigant 123981","Цанги 16_GS","Цепь 3/8 (06В-1 Ir)_GS","Чашка одноразовая BONVIDA кофейная 200мл","Шаблон, чертилка по металлу РусскИн","Шайба A.6 нерж DIN 125","Шайба A.6.21 нерж cталь","Шайба М 10 нерж увеличенная_GS","Шайба М 12 нерж_GS","Шайба М 6 нерж увеличенная_GS","Шайба М 8 нерж_GS","Шайба М6 нерж_GS","Шапка утепл.","Шар запортный 110 для конуса","Швеллер алюминиевый 2000x30x30x30x1,5 мм ДИАЛ","Шланг из ПВХ спиральновитой (?вн/нар 150/162мм, бухта 20м) PHD UL-70-150","Шланг кислородный D//d17/10 мм Micro 360","Шпатлевка финишная гипсовая","Шпилька d 10_GS","Шпилька d 16_GS","Шпилька d 4_GS","Шпилька d 6_GS","Шпилька d 8_GS","Шплинт разводной 3,2х45 мм нерж._GS","Шпонка квадрат 5х5 L 160мм_GS","Штукатурка 30 кг","Щетка для УШМ 125 нерж_GS","Щетка кистевая плетеная с хвостиком 19 мм_GS","Экструдер ручной сварочный Лидер-2","Электроды вольфрамовые WT-20-175 диам. 2,0 мм красный DC G-X-612 Gigant","Электроды вольфрамовые WT-20-175 диам. 3,0 мм красный DC TE-WT-X-3,0 Gigant","Ящик п/э 420х420х292 черный \"Фин-Пак\""];

// ── Состояние ────────────────────────────────────────────────
let _nomItems   = [];   // [{id, name, sort_order}]
let _nomColumns = [];   // [{id, assignee_name, sort_order}]
let _nomValues  = {};   // { [itemId]: { [columnId]: value } }
let _nomSearch  = '';
let _nomSearchTimer = null;
let _nomReady   = false; // false пока таблицы не созданы в Supabase

// ── Загрузка данных ─────────────────────────────────────────────
function loadNomenclatureData(itemsData, columnsData, valuesData) {
  // Supabase возвращает data:null, если таблицы ещё не созданы
  if (itemsData === null || columnsData === null || valuesData === null) {
    _nomItems = []; _nomColumns = []; _nomValues = {};
    _nomReady = false;
    return;
  }
  _nomReady = true;
  _nomItems = (itemsData || [])
    .map(r => ({ id: r.id, name: r.name, sort_order: r.sort_order || 0 }))
    .sort((a, b) => a.sort_order - b.sort_order);
  _nomColumns = (columnsData || [])
    .map(r => ({ id: r.id, assignee_name: r.assignee_name, sort_order: r.sort_order || 0 }))
    .sort((a, b) => a.sort_order - b.sort_order);
  _nomValues = {};
  (valuesData || []).forEach(r => {
    if (!_nomValues[r.item_id]) _nomValues[r.item_id] = {};
    _nomValues[r.item_id][r.column_id] = r.value || '';
  });
  _nomMaybeSeed();
}

// Разовое заполнение базовым списком (только если таблица ещё пуста)
function _nomMaybeSeed() {
  if (!_sb || !_nomReady) return;
  if (_nomItems.length === 0) {
    const rows = NOMENCLATURE_SEED.map((name, i) => ({ id: `nom_${i + 1}`, name, sort_order: i }));
    _nomItems = rows.map(r => ({ ...r }));
    (async () => {
      try { await _sb.from('nomenclature_items').upsert(rows); }
      catch (e) { console.error('nomenclature seed items:', e); }
    })();
  }
  if (_nomColumns.length === 0) {
    const now = Date.now();
    const cols = [0, 1, 2, 3].map(i => ({ id: `nomcol_${now}_${i}`, assignee_name: null, sort_order: i }));
    _nomColumns = cols.map(c => ({ ...c }));
    (async () => {
      try { await _sb.from('nomenclature_columns').upsert(cols); }
      catch (e) { console.error('nomenclature seed columns:', e); }
    })();
  }
}

// ── Хелперы ──────────────────────────────────────────────────────
function _nomEsc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _nomFiltered() {
  const q = _nomSearch.trim().toLowerCase();
  if (!q) return _nomItems;
  return _nomItems.filter(i => i.name.toLowerCase().includes(q));
}
function _nomRerender() {
  if (typeof state === 'undefined' || state.view !== 'nomenclature') return;
  const el = document.getElementById('content');
  if (el) renderNomenclaturePage(el);
}
function setNomSearch(val) {
  clearTimeout(_nomSearchTimer);
  _nomSearchTimer = setTimeout(() => { _nomSearch = val; _nomRerender(); }, 250);
}

// ── CRUD: позиции ────────────────────────────────────────────────
function confirmAddNomItem() {
  const inp = document.getElementById('nom-new-name');
  if (!inp) return;
  const name = inp.value.trim();
  if (!name) return;
  const maxOrder = _nomItems.reduce((m, i) => Math.max(m, i.sort_order), -1);
  const item = { id: `nom_c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name, sort_order: maxOrder + 1 };
  _nomItems.push(item);
  if (_sb) {
    (async () => { try { await _sb.from('nomenclature_items').upsert(item); } catch (e) { console.error('nom add item:', e); } })();
  }
  _nomRerender();
}
function renameNomItem(itemId, newName) {
  const name = (newName || '').trim();
  const item = _nomItems.find(i => i.id === itemId);
  if (!item || !name || name === item.name) return;
  item.name = name;
  if (_sb) {
    (async () => { try { await _sb.from('nomenclature_items').update({ name }).eq('id', itemId); } catch (e) { console.error('nom rename item:', e); } })();
  }
}
function deleteNomItem(itemId) {
  if (!confirm('Удалить позицию номенклатуры вместе со всеми предложениями по ней?')) return;
  _nomItems = _nomItems.filter(i => i.id !== itemId);
  delete _nomValues[itemId];
  if (_sb) {
    (async () => { try { await _sb.from('nomenclature_items').delete().eq('id', itemId); } catch (e) { console.error('nom delete item:', e); } })();
  }
  _nomRerender();
}

// ── CRUD: колонки специалистов ────────────────────────────────────
function addNomColumn() {
  const maxOrder = _nomColumns.reduce((m, c) => Math.max(m, c.sort_order), -1);
  const col = { id: `nomcol_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, assignee_name: null, sort_order: maxOrder + 1 };
  _nomColumns.push(col);
  if (_sb) {
    (async () => { try { await _sb.from('nomenclature_columns').upsert(col); } catch (e) { console.error('nom add column:', e); } })();
  }
  _nomRerender();
}
function deleteNomColumn(colId) {
  if (!confirm('Удалить колонку и все значения в ней?')) return;
  _nomColumns = _nomColumns.filter(c => c.id !== colId);
  Object.keys(_nomValues).forEach(itemId => { if (_nomValues[itemId]) delete _nomValues[itemId][colId]; });
  if (_sb) {
    (async () => { try { await _sb.from('nomenclature_columns').delete().eq('id', colId); } catch (e) { console.error('nom delete column:', e); } })();
  }
  _nomRerender();
}
function setNomColumnAssignee(colId, name) {
  const col = _nomColumns.find(c => c.id === colId);
  if (!col) return;
  col.assignee_name = name || null;
  if (_sb) {
    (async () => { try { await _sb.from('nomenclature_columns').update({ assignee_name: col.assignee_name }).eq('id', colId); } catch (e) { console.error('nom set column assignee:', e); } })();
  }
  closeAssigneeDrop();
  _nomRerender();
}

// ── Попап выбора исполнителя для заголовка колонки (справочник «Исполнители») ──
function _nomColumnPickerHtml(colId) {
  const col = _nomColumns.find(c => c.id === colId);
  if (!col) return '';
  const all = typeof getAllAssignees === 'function' ? getAllAssignees() : [];
  const rows = all.map(a => {
    const active = col.assignee_name === a.name;
    const safeName = a.name.replace(/'/g, "\\'");
    return `<div class="adrop-item${active ? ' active' : ''}" onclick="setNomColumnAssignee('${colId}','${safeName}')">
      <span class="adrop-color-dot" style="${assigneeDotStyle(a)}"></span>
      <span style="flex:1">${_nomEsc(a.name)}</span>
    </div>`;
  }).join('');
  return rows +
    `<div class="adrop-divider"></div>
     <div class="adrop-item adrop-clear" onclick="setNomColumnAssignee('${colId}','')">— Без исполнителя —</div>`;
}
function openNomColumnPicker(colId, anchor) {
  closeAssigneeDrop();
  const rect = anchor.getBoundingClientRect();
  const drop = document.createElement('div');
  drop.id = 'assignee-drop';
  drop.innerHTML = _nomColumnPickerHtml(colId);
  document.body.appendChild(drop);
  positionDrop(drop, rect);
  setTimeout(() => document.addEventListener('click', closeAssigneeDrop, { once: true }), 0);
}

// ── Значения ячеек (предложение специалиста) ──────────────────────
function setNomValue(itemId, colId, newValue) {
  const value = (newValue || '').trim();
  if (!_nomValues[itemId]) _nomValues[itemId] = {};
  const old = _nomValues[itemId][colId] || '';
  if (value === old) return;
  _nomValues[itemId][colId] = value;
  if (!_sb) return;
  (async () => {
    try {
      if (!value) await _sb.from('nomenclature_values').delete().eq('item_id', itemId).eq('column_id', colId);
      else await _sb.from('nomenclature_values').upsert({ item_id: itemId, column_id: colId, value, updated_at: new Date().toISOString() });
    } catch (e) { console.error('nom set value:', e); }
  })();
}

// ── Рендер страницы ───────────────────────────────────────────────
function renderNomenclaturePage(el) {
  el = el || document.getElementById('content');
  if (!el) return;
  if (typeof setBreadcrumb === 'function') setBreadcrumb('Номенклатура');

  if (!_nomReady) {
    el.innerHTML = `
      <div class="nom-empty">
        ${iconSvg('folder', 40)}
        <div class="nom-empty-title">Таблицы модуля ещё не созданы в Supabase</div>
        <div class="nom-empty-sub">Нужно один раз выполнить SQL-скрипт создания таблиц
          <code>nomenclature_items</code>, <code>nomenclature_columns</code>, <code>nomenclature_values</code>
          в Supabase → SQL Editor, затем обновить страницу.</div>
      </div>`;
    return;
  }

  const filtered = _nomFiltered();

  const colHeaders = _nomColumns.map(c => {
    const name = c.assignee_name || '';
    let style = '';
    if (name && typeof getAllAssignees === 'function' && typeof assigneeStyle === 'function') {
      const aObj = getAllAssignees().find(a => a.name === name) || { colorIdx: 0 };
      style = assigneeStyle(aObj);
    }
    return `
    <th class="nom-col-head">
      <div class="nom-col-head-inner">
        <span class="nom-col-head-name${name ? '' : ' nom-col-head-empty'}" style="${style}" onclick="openNomColumnPicker('${c.id}',this)">${name ? _nomEsc(name) : 'Выбрать исполнителя'}</span>
        <button class="nom-col-del-btn" title="Удалить колонку" onclick="event.stopPropagation();deleteNomColumn('${c.id}')">${iconSvg('x', 11)}</button>
      </div>
    </th>`;
  }).join('');

  const rows = filtered.map(item => {
    const vals = _nomValues[item.id] || {};
    const cells = _nomColumns.map(c => {
      const val = vals[c.id] || '';
      return `
      <td class="nom-cell">
        <input type="text" class="nom-cell-input" value="${_nomEsc(val)}" title="${_nomEsc(val)}"
               onblur="setNomValue('${item.id}','${c.id}',this.value)"
               onkeydown="if(event.key==='Enter')this.blur()">
      </td>`;
    }).join('');
    return `
    <tr class="nom-row">
      <td class="nom-name-cell">
        <input type="text" class="nom-name-input" value="${_nomEsc(item.name)}" title="${_nomEsc(item.name)}"
               onblur="renameNomItem('${item.id}',this.value)"
               onkeydown="if(event.key==='Enter')this.blur()">
      </td>
      ${cells}
      <td class="nom-row-del">
        <button class="nom-row-del-btn" title="Удалить позицию" onclick="deleteNomItem('${item.id}')">${iconSvg('trash', 13)}</button>
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="nom-wrap">
      <div class="nom-topbar">
        <div>
          <div class="nom-title">Номенклатура</div>
          <div class="nom-sub">Унификация названий материалов — варианты названий от специалистов по каждой позиции</div>
        </div>
        <div class="nom-topbar-actions">
          <div class="nom-actions-row">
            <input type="text" class="nom-search" placeholder="Поиск по наименованию..." value="${_nomEsc(_nomSearch)}" oninput="setNomSearch(this.value)">
            <button class="btn-secondary" onclick="addNomColumn()">${iconSvg('plus', 14)} Колонка</button>
          </div>
          <div class="nom-actions-row">
            <input type="text" id="nom-new-name" class="nom-name-input nom-add-input" placeholder="Новая позиция..." onkeydown="if(event.key==='Enter')confirmAddNomItem()">
            <button class="btn-secondary" onclick="confirmAddNomItem()">${iconSvg('plus', 14)} Добавить позицию</button>
          </div>
        </div>
      </div>
      <div class="nom-table-scroll">
        <table class="nom-table">
          <thead>
            <tr>
              <th class="nom-name-head">Наименование</th>
              ${colHeaders}
              <th class="nom-th-actions"></th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="${_nomColumns.length + 2}" class="nom-empty-cell">Ничего не найдено</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Экспорт ────────────────────────────────────────────────────
window.loadNomenclatureData  = loadNomenclatureData;
window.renderNomenclaturePage = renderNomenclaturePage;
window.setNomSearch          = setNomSearch;
window.confirmAddNomItem     = confirmAddNomItem;
window.renameNomItem         = renameNomItem;
window.deleteNomItem         = deleteNomItem;
window.addNomColumn           = addNomColumn;
window.deleteNomColumn        = deleteNomColumn;
window.setNomColumnAssignee   = setNomColumnAssignee;
window.openNomColumnPicker    = openNomColumnPicker;
window.setNomValue            = setNomValue;
