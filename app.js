// =============================================
//  ИНИЦИАЛИЗАЦИЯ TELEGRAM
// =============================================
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// =============================================
//  ХРАНИЛИЩЕ (Telegram CloudStorage или localStorage)
//  CloudStorage работает только внутри Telegram.
//  localStorage — для тестирования в браузере.
// =============================================
const Storage = {
  get(key, callback) {
    if (tg?.CloudStorage) {
      tg.CloudStorage.getItem(key, (err, value) => callback(value || null));
    } else {
      callback(localStorage.getItem(key));
    }
  },
  set(key, value, callback) {
    if (tg?.CloudStorage) {
      tg.CloudStorage.setItem(key, value, () => callback && callback());
    } else {
      localStorage.setItem(key, value);
      callback && callback();
    }
  }
};

// =============================================
//  НАВИГАЦИЯ МЕЖДУ ЭКРАНАМИ
// =============================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// =============================================
//  МЕСЯЦ — название текущего месяца на русском
// =============================================
const MONTHS_RU = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'
];

function getMonthLabel() {
  const d = new Date();
  return `${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`;
}

// =============================================
//  ЗАГРУЗКА ДАННЫХ ПРИ СТАРТЕ
// =============================================
function loadAll() {
  const label = getMonthLabel();
  document.getElementById('current-month').textContent = label;
  document.getElementById('result-month-label').textContent = label;

  // Показываем прошлые показания
  Storage.get('prev_electric', val => {
    document.getElementById('prev-electric').textContent = val ? `${val} кВт·ч` : '—';
  });
  Storage.get('prev_cold', val => {
    document.getElementById('prev-cold').textContent = val ? `${val} м³` : '—';
  });
  Storage.get('prev_hot', val => {
    document.getElementById('prev-hot').textContent = val ? `${val} м³` : '—';
  });

  // Загружаем тарифы в настройки
  Storage.get('tariff_electric', val => {
    if (val) document.getElementById('tariff-electric').value = val;
  });
  Storage.get('tariff_cold', val => {
    if (val) document.getElementById('tariff-cold').value = val;
  });
  Storage.get('tariff_hot', val => {
    if (val) document.getElementById('tariff-hot').value = val;
  });
}

// =============================================
//  РАСЧЁТ
// =============================================
function calculate() {
  const curElectric = parseFloat(document.getElementById('input-electric').value);
  const curCold     = parseFloat(document.getElementById('input-cold').value);
  const curHot      = parseFloat(document.getElementById('input-hot').value);

  if (isNaN(curElectric) || isNaN(curCold) || isNaN(curHot)) {
    alert('Пожалуйста, заполни все три показания счётчиков.');
    return;
  }

  // Получаем прошлые показания и тарифы, затем считаем
  Storage.get('prev_electric', prevElStr => {
  Storage.get('prev_cold',     prevColdStr => {
  Storage.get('prev_hot',      prevHotStr  => {
  Storage.get('tariff_electric', tElStr => {
  Storage.get('tariff_cold',     tColdStr => {
  Storage.get('tariff_hot',      tHotStr  => {

    const prevElectric = parseFloat(prevElStr)   || 0;
    const prevCold     = parseFloat(prevColdStr) || 0;
    const prevHot      = parseFloat(prevHotStr)  || 0;

    const tariffEl   = parseFloat(tElStr)   || 0;
    const tariffCold = parseFloat(tColdStr) || 0;
    const tariffHot  = parseFloat(tHotStr)  || 0;

    if (tariffEl === 0 || tariffCold === 0 || tariffHot === 0) {
      alert('Сначала укажи тарифы в настройках (кнопка ⚙️).');
      return;
    }

    const diffEl   = Math.max(0, curElectric - prevElectric);
    const diffCold = Math.max(0, curCold     - prevCold);
    const diffHot  = Math.max(0, curHot      - prevHot);

    const priceEl   = diffEl   * tariffEl;
    const priceCold = diffCold * tariffCold;
    const priceHot  = diffHot  * tariffHot;
    const total     = priceEl + priceCold + priceHot;

    const fmt = n => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
    const rub = n => `${fmt(n)} ₽`;

    document.getElementById('result-electric-detail').textContent =
      `${fmt(diffEl)} кВт·ч × ${fmt(tariffEl)} ₽`;
    document.getElementById('result-cold-detail').textContent =
      `${fmt(diffCold)} м³ × ${fmt(tariffCold)} ₽`;
    document.getElementById('result-hot-detail').textContent =
      `${fmt(diffHot)} м³ × ${fmt(tariffHot)} ₽`;

    document.getElementById('result-electric-price').textContent = rub(priceEl);
    document.getElementById('result-cold-price').textContent     = rub(priceCold);
    document.getElementById('result-hot-price').textContent      = rub(priceHot);
    document.getElementById('result-total').textContent          = rub(total);

    // Сохраняем текущие как «прошлые» для следующего месяца
    Storage.set('cur_electric', String(curElectric));
    Storage.set('cur_cold',     String(curCold));
    Storage.set('cur_hot',      String(curHot));

    showScreen('screen-result');
  });
  });
  });
  });
  });
  });
}

// =============================================
//  СОХРАНЕНИЕ — фиксируем текущие как прошлые
// =============================================
function saveAndClose() {
  Storage.get('cur_electric', val => {
    if (val) Storage.set('prev_electric', val);
  });
  Storage.get('cur_cold', val => {
    if (val) Storage.set('prev_cold', val);
  });
  Storage.get('cur_hot', val => {
    if (val) Storage.set('prev_hot', val);
  });

  // Очищаем поля ввода
  document.getElementById('input-electric').value = '';
  document.getElementById('input-cold').value     = '';
  document.getElementById('input-hot').value      = '';

  // Обновляем отображение прошлых показаний
  loadAll();
  showScreen('screen-main');

  if (tg) tg.close();
}

// =============================================
//  СОХРАНЕНИЕ ТАРИФОВ
// =============================================
function saveSettings() {
  const el   = document.getElementById('tariff-electric').value.trim();
  const cold = document.getElementById('tariff-cold').value.trim();
  const hot  = document.getElementById('tariff-hot').value.trim();

  if (!el || !cold || !hot) {
    alert('Заполни все три тарифа.');
    return;
  }

  Storage.set('tariff_electric', el, () => {
  Storage.set('tariff_cold', cold, () => {
  Storage.set('tariff_hot', hot, () => {
    const msg = document.getElementById('settings-saved-msg');
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 2000);
  });
  });
  });
}

// =============================================
//  НАЗНАЧАЕМ ОБРАБОТЧИКИ КНОПОК
// =============================================
document.getElementById('btn-settings').addEventListener('click', () => showScreen('screen-settings'));
document.getElementById('btn-calculate').addEventListener('click', calculate);
document.getElementById('btn-save').addEventListener('click', saveAndClose);
document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
document.getElementById('btn-back-from-result').addEventListener('click', () => showScreen('screen-main'));
document.getElementById('btn-back-from-settings').addEventListener('click', () => showScreen('screen-main'));

// =============================================
//  СТАРТ
// =============================================
loadAll();
