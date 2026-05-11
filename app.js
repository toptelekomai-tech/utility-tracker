// =============================================
//  ИНИЦИАЛИЗАЦИЯ TELEGRAM
// =============================================
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// =============================================
//  ХРАНИЛИЩЕ
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
//  НАВИГАЦИЯ
// =============================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// =============================================
//  МЕСЯЦ
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
//  ПОСЛЕДНИЙ РЕЗУЛЬТАТ (для истории и уведомления)
// =============================================
let lastCalcResult = null;

// =============================================
//  ЗАГРУЗКА ДАННЫХ ПРИ СТАРТЕ
// =============================================
function loadAll() {
  const label = getMonthLabel();
  document.getElementById('current-month').textContent = label;
  document.getElementById('result-month-label').textContent = label;

  Storage.get('prev_electric', val => {
    document.getElementById('prev-electric').textContent = val ? `${val} кВт·ч` : '—';
    if (val) document.getElementById('prev-setting-electric').value = val;
  });
  Storage.get('prev_cold', val => {
    document.getElementById('prev-cold').textContent = val ? `${val} м³` : '—';
    if (val) document.getElementById('prev-setting-cold').value = val;
  });
  Storage.get('prev_hot', val => {
    document.getElementById('prev-hot').textContent = val ? `${val} м³` : '—';
    if (val) document.getElementById('prev-setting-hot').value = val;
  });

  Storage.get('tariff_electric', val => { if (val) document.getElementById('tariff-electric').value = val; });
  Storage.get('tariff_cold',     val => { if (val) document.getElementById('tariff-cold').value = val; });
  Storage.get('tariff_hot',      val => { if (val) document.getElementById('tariff-hot').value = val; });

  checkOwner();
}

// =============================================
//  ПРОВЕРКА: ТЫ ВЛАДЕЛЕЦ?
// =============================================
function checkOwner() {
  Storage.get('owner_tg_id', ownerId => {
    const currentId = String(tg?.initDataUnsafe?.user?.id || '');
    const isOwner = ownerId && currentId && ownerId === currentId;
    document.getElementById('btn-history').style.display = isOwner ? 'block' : 'none';
  });
}

// =============================================
//  УСТАНОВИТЬ СЕБЯ КАК ВЛАДЕЛЬЦА
// =============================================
function setAsOwner() {
  const currentId = String(tg?.initDataUnsafe?.user?.id || '');
  if (!currentId || currentId === 'undefined' || currentId === '0') {
    alert('Не удалось получить твой Telegram ID.\nОткрой приложение через Telegram, не через браузер.');
    return;
  }
  Storage.set('owner_tg_id', currentId, () => {
    const status = document.getElementById('owner-status');
    status.textContent = `✅ Ты — владелец (ID: ${currentId})`;
    document.getElementById('btn-history').style.display = 'block';
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

    Storage.set('cur_electric', String(curElectric));
    Storage.set('cur_cold',     String(curCold));
    Storage.set('cur_hot',      String(curHot));

    // Сохраняем результат для истории и уведомления
    lastCalcResult = {
      month: getMonthLabel(),
      year:  new Date().getFullYear(),
      electric: { prev: prevElectric, curr: curElectric, diff: diffEl,   tariff: tariffEl,   price: priceEl   },
      cold:     { prev: prevCold,     curr: curCold,     diff: diffCold, tariff: tariffCold, price: priceCold },
      hot:      { prev: prevHot,      curr: curHot,      diff: diffHot,  tariff: tariffHot,  price: priceHot  },
      total
    };

    showScreen('screen-result');
  });
  });
  });
  });
  });
  });
}

// =============================================
//  СОХРАНЕНИЕ В ИСТОРИЮ
// =============================================
function saveToHistory(data) {
  const key = `history_${data.year}`;
  Storage.get(key, raw => {
    const history = raw ? JSON.parse(raw) : [];
    const idx = history.findIndex(r => r.month === data.month);
    if (idx >= 0) history[idx] = data;
    else history.unshift(data);
    Storage.set(key, JSON.stringify(history));
  });
}

// =============================================
//  ОТПРАВКА УВЕДОМЛЕНИЯ ВЛАДЕЛЬЦУ
// =============================================
function sendNotification(data) {
  Storage.get('bot_token', token => {
    Storage.get('owner_tg_id', ownerId => {
      if (!token || !ownerId) return;

      const fmt = n => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
      const text =
        `🏠 <b>Счётчики ЖКХ — ${data.month}</b>\n\n` +
        `⚡ Электричество: ${fmt(data.electric.diff)} кВт·ч × ${fmt(data.electric.tariff)} ₽ = <b>${fmt(data.electric.price)} ₽</b>\n` +
        `🔵 Холодная вода: ${fmt(data.cold.diff)} м³ × ${fmt(data.cold.tariff)} ₽ = <b>${fmt(data.cold.price)} ₽</b>\n` +
        `🔴 Горячая вода: ${fmt(data.hot.diff)} м³ × ${fmt(data.hot.tariff)} ₽ = <b>${fmt(data.hot.price)} ₽</b>\n\n` +
        `💰 <b>Итого к оплате: ${fmt(data.total)} ₽</b>`;

      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: ownerId, text, parse_mode: 'HTML' })
      }).catch(() => {});
    });
  });
}

// =============================================
//  СОХРАНЕНИЕ И ЗАКРЫТИЕ
// =============================================
function saveAndClose() {
  if (lastCalcResult) {
    saveToHistory(lastCalcResult);
    sendNotification(lastCalcResult);
    lastCalcResult = null;
  }

  Storage.get('cur_electric', val => { if (val) Storage.set('prev_electric', val); });
  Storage.get('cur_cold',     val => { if (val) Storage.set('prev_cold',     val); });
  Storage.get('cur_hot',      val => { if (val) Storage.set('prev_hot',      val); });

  document.getElementById('input-electric').value = '';
  document.getElementById('input-cold').value     = '';
  document.getElementById('input-hot').value      = '';

  loadAll();
  showScreen('screen-main');
  if (tg) tg.close();
}

// =============================================
//  ИСТОРИЯ — загрузка и отображение
// =============================================
function loadHistory() {
  showScreen('screen-history');
  const content = document.getElementById('history-content');
  const empty   = document.getElementById('history-empty');
  content.innerHTML = '';

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
  let hasAny = false;
  let processed = 0;

  years.forEach(year => {
    Storage.get(`history_${year}`, raw => {
      processed++;
      if (raw) {
        const records = JSON.parse(raw);
        if (records.length > 0) {
          hasAny = true;
          content.appendChild(renderYearBlock(year, records));
        }
      }
      if (processed === years.length) {
        empty.style.display = hasAny ? 'none' : 'block';
      }
    });
  });
}

function renderYearBlock(year, records) {
  const fmt = n => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  const rub = n => n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';

  const group = document.createElement('div');
  group.className = 'history-year-group';

  const heading = document.createElement('div');
  heading.className = 'history-year-heading';
  heading.textContent = year;
  group.appendChild(heading);

  records.forEach(r => {
    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = `
      <div class="history-row-month">${r.month.split(' ')[0]}</div>
      <div class="history-row-details">
        <span>⚡ ${fmt(r.electric.diff)} кВт</span>
        <span>🔵 ${fmt(r.cold.diff)} м³</span>
        <span>🔴 ${fmt(r.hot.diff)} м³</span>
      </div>
      <div class="history-row-total">${rub(r.total)}</div>
    `;
    group.appendChild(row);
  });

  return group;
}

// =============================================
//  СОХРАНЕНИЕ НАСТРОЕК
// =============================================
function saveSettings() {
  const prevEl   = document.getElementById('prev-setting-electric').value.trim();
  const prevCold = document.getElementById('prev-setting-cold').value.trim();
  const prevHot  = document.getElementById('prev-setting-hot').value.trim();
  const el       = document.getElementById('tariff-electric').value.trim();
  const cold     = document.getElementById('tariff-cold').value.trim();
  const hot      = document.getElementById('tariff-hot').value.trim();
  const botToken = document.getElementById('bot-token').value.trim();

  if (!el || !cold || !hot) {
    alert('Заполни все три тарифа.');
    return;
  }

  const saves = [
    ['tariff_electric', el],
    ['tariff_cold',     cold],
    ['tariff_hot',      hot],
  ];

  if (prevEl)    saves.push(['prev_electric', prevEl]);
  if (prevCold)  saves.push(['prev_cold',     prevCold]);
  if (prevHot)   saves.push(['prev_hot',      prevHot]);
  if (botToken)  saves.push(['bot_token',     botToken]);

  let done = 0;
  saves.forEach(([key, value]) => {
    Storage.set(key, value, () => {
      done++;
      if (done === saves.length) {
        loadAll();
        const msg = document.getElementById('settings-saved-msg');
        msg.style.display = 'block';
        setTimeout(() => { msg.style.display = 'none'; }, 2000);
      }
    });
  });
}

// =============================================
//  ТАЙНОЕ НАЖАТИЕ — 5 раз на «Настройки»
// =============================================
let tapCount = 0;
let tapTimer = null;

document.getElementById('settings-title').addEventListener('click', () => {
  tapCount++;
  clearTimeout(tapTimer);

  if (tapCount >= 5) {
    tapCount = 0;
    const section = document.getElementById('owner-section');
    section.style.display = 'flex';
    section.style.flexDirection = 'column';

    Storage.get('bot_token',   val => { if (val) document.getElementById('bot-token').value = val; });
    Storage.get('owner_tg_id', val => {
      if (val) document.getElementById('owner-status').textContent = `✅ Владелец установлен (ID: ${val})`;
    });
  } else {
    tapTimer = setTimeout(() => { tapCount = 0; }, 1500);
  }
});

// =============================================
//  ОБРАБОТЧИКИ КНОПОК
// =============================================
document.getElementById('btn-settings').addEventListener('click', () => showScreen('screen-settings'));
document.getElementById('btn-calculate').addEventListener('click', calculate);
document.getElementById('btn-save').addEventListener('click', saveAndClose);
document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
document.getElementById('btn-back-from-result').addEventListener('click', () => showScreen('screen-main'));
document.getElementById('btn-back-from-settings').addEventListener('click', () => showScreen('screen-main'));
document.getElementById('btn-history').addEventListener('click', loadHistory);
document.getElementById('btn-back-from-history').addEventListener('click', () => showScreen('screen-main'));
document.getElementById('btn-set-owner').addEventListener('click', setAsOwner);

// =============================================
//  СТАРТ
// =============================================
loadAll();
