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
//  КВАРТИРЫ
// =============================================
let currentAptId = 'default';

function aptKey(key) {
  return currentAptId === 'default' ? key : `apt_${currentAptId}_${key}`;
}

function AptStorage() {}
AptStorage.get = (key, cb) => Storage.get(aptKey(key), cb);
AptStorage.set = (key, val, cb) => Storage.set(aptKey(key), val, cb);

function loadApartments(cb) {
  Storage.get('apartments', raw => {
    const apts = raw ? JSON.parse(raw) : [{ id: 'default', name: 'Квартира 1' }];
    cb(apts);
  });
}

function saveApartments(apts, cb) {
  Storage.set('apartments', JSON.stringify(apts), cb);
}

function initAptSelector() {
  Storage.get('owner_tg_id', ownerId => {
    const currentId = String(tg?.initDataUnsafe?.user?.id || '');
    const isOwner = ownerId && currentId && ownerId === currentId;
    if (!isOwner) return;

    loadApartments(apts => {
      if (apts.length <= 1) return;
      const wrap = document.getElementById('apt-selector-wrap');
      const sel  = document.getElementById('apt-selector');
      sel.innerHTML = '';
      apts.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.name;
        if (a.id === currentAptId) opt.selected = true;
        sel.appendChild(opt);
      });
      wrap.style.display = 'flex';
    });
  });
}

function addApartment() {
  const name = prompt('Название квартиры (например: ул. Ленина 5, кв.12):');
  if (!name || !name.trim()) return;
  loadApartments(apts => {
    const id = `apt${Date.now()}`;
    apts.push({ id, name: name.trim() });
    saveApartments(apts, () => {
      currentAptId = id;
      initAptSelector();
      loadAll();
    });
  });
}

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
//  ВИДИМОСТЬ ГАЗА
// =============================================
function applyGasVisibility(on) {
  document.getElementById('meter-gas').style.display        = on ? '' : 'none';
  document.getElementById('result-row-gas').style.display   = on ? '' : 'none';
  document.getElementById('gas-tariff-row').style.display   = on ? '' : 'none';
  document.getElementById('prev-gas-row').style.display     = on ? '' : 'none';
}

// =============================================
//  ПОСЛЕДНИЙ РЕЗУЛЬТАТ (для истории и уведомления)
// =============================================
let lastCalcResult = null;
let isOwnerRole    = false;
let botUsername    = '';

// =============================================
//  ЗАГРУЗКА ДАННЫХ ПРИ СТАРТЕ
// =============================================
function loadAll() {
  const label = getMonthLabel();
  document.getElementById('current-month').textContent = label;
  document.getElementById('result-month-label').textContent = label;

  AptStorage.get('prev_electric', val => {
    document.getElementById('prev-electric').textContent = val ? `${val} кВт·ч` : '—';
    if (val) document.getElementById('prev-setting-electric').value = val;
  });
  AptStorage.get('prev_cold', val => {
    document.getElementById('prev-cold').textContent = val ? `${val} м³` : '—';
    if (val) document.getElementById('prev-setting-cold').value = val;
  });
  AptStorage.get('prev_hot', val => {
    document.getElementById('prev-hot').textContent = val ? `${val} м³` : '—';
    if (val) document.getElementById('prev-setting-hot').value = val;
  });
  AptStorage.get('prev_gas', val => {
    document.getElementById('prev-gas').textContent = val ? `${val} м³` : '—';
    if (val) document.getElementById('prev-setting-gas').value = val;
  });

  AptStorage.get('tariff_electric', val => { if (val) document.getElementById('tariff-electric').value = val; });
  AptStorage.get('tariff_cold',     val => { if (val) document.getElementById('tariff-cold').value = val; });
  AptStorage.get('tariff_hot',      val => { if (val) document.getElementById('tariff-hot').value = val; });
  AptStorage.get('tariff_hot_heat', val => { if (val) document.getElementById('tariff-hot-heat').value = val; });
  AptStorage.get('tariff_drainage', val => { if (val) document.getElementById('tariff-drainage').value = val; });
  AptStorage.get('tariff_internet', val => { if (val) document.getElementById('tariff-internet').value = val; });
  AptStorage.get('gas_enabled', val => {
    const on = val === '1';
    document.getElementById('toggle-gas').checked = on;
    applyGasVisibility(on);
    if (on) AptStorage.get('tariff_gas', v => { if (v) document.getElementById('tariff-gas').value = v; });
  });

  Storage.get('bot_username', val => { if (val) botUsername = val; });
  checkOwner();
  initAptSelector();
}

// =============================================
//  ПРОВЕРКА: ТЫ ВЛАДЕЛЕЦ?
// =============================================
function checkOwner() {
  Storage.get('owner_tg_id', ownerId => {
    const currentId  = String(tg?.initDataUnsafe?.user?.id || '');
    const ownerSet   = !!ownerId;
    const isOwner    = ownerSet && currentId && ownerId === currentId;

    isOwnerRole = isOwner;

    const canSettings = !ownerSet || isOwner;

    document.getElementById('btn-history').style.display  = 'block'; // история — всем
    document.getElementById('btn-remind').style.display   = isOwner     ? 'block' : 'none';
    document.getElementById('btn-settings').style.display = canSettings ? 'block' : 'none';

    // Метка роли
    const badge = document.getElementById('role-badge');
    if (badge) {
      if (!ownerSet) {
        badge.textContent = '';
      } else if (isOwner) {
        badge.textContent = 'Владелец';
        badge.className = 'role-badge role-badge--owner';
      } else {
        badge.textContent = 'Жилец';
        badge.className = 'role-badge role-badge--tenant';
      }
    }
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
//  ЭКСПОРТ PDF
// =============================================
function exportPdf() {
  if (!lastCalcResult) { alert('Сначала выполни расчёт.'); return; }
  const { jsPDF } = window.jspdf;
  if (!jsPDF) { alert('PDF недоступен.'); return; }

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const data = lastCalcResult;
  const fmt = n => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

  doc.setFont('helvetica');
  doc.setFontSize(16);
  doc.text(`Schetchiki ZhKH - ${data.month}`, 20, 20);

  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text('Utility meters report', 20, 28);

  doc.setTextColor(0);
  doc.setFontSize(12);

  let y = 42;
  const rows = [
    ['Electricity',  `${fmt(data.electric.diff)} kWh x ${fmt(data.electric.tariff)} RUB`, `${fmt(data.electric.price)} RUB`],
    ['Cold water',   `${fmt(data.cold.diff)} m3 x ${fmt(data.cold.tariff)} RUB`,          `${fmt(data.cold.price)} RUB`],
    ['Hot water',    `${fmt(data.hot.diff)} m3 x ${fmt(data.hot.tariff)} RUB`,            `${fmt(data.hot.price)} RUB`],
  ];
  if (data.hotHeat && data.hotHeat.tariff > 0) {
    rows.push(['Hot heating', `${fmt(data.hotHeat.diff)} m3 x ${fmt(data.hotHeat.tariff)} RUB`, `${fmt(data.hotHeat.price)} RUB`]);
  }
  if (data.gas && data.gas.price > 0) {
    rows.push(['Gas', `${fmt(data.gas.diff)} m3 x ${fmt(data.gas.tariff)} RUB`, `${fmt(data.gas.price)} RUB`]);
  }
  if (data.drainage && data.drainage.tariff > 0) {
    rows.push(['Drainage', `${fmt(data.drainage.diff)} m3 x ${fmt(data.drainage.tariff)} RUB`, `${fmt(data.drainage.price)} RUB`]);
  }
  if (data.internet && data.internet.price > 0) {
    rows.push(['Internet', 'fixed', `${fmt(data.internet.price)} RUB`]);
  }

  rows.forEach(([name, detail, price]) => {
    doc.setFontSize(12);
    doc.text(name, 20, y);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(detail, 20, y + 5);
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text(price, 170, y, { align: 'right' });
    y += 16;
  });

  doc.setDrawColor(200);
  doc.line(20, y, 190, y);
  y += 8;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 20, y);
  doc.text(`${fmt(data.total)} RUB`, 170, y, { align: 'right' });

  y += 12;
  doc.setFontSize(8);
  doc.setTextColor(180);
  const botLink = botUsername ? `t.me/${botUsername}` : 'Счётчики ЖКХ';
  doc.text(`Создано в ${botLink}`, 105, y, { align: 'center' });

  doc.save(`utility-${data.month.replace(' ', '-')}.pdf`);
}

// =============================================
//  АКТ ПРИЁМА-ПЕРЕДАЧИ
// =============================================
function openAct() {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('act-date').value = today;

  Storage.get('move_in_act', raw => {
    const block = document.getElementById('act-saved-block');
    if (raw) {
      const act = JSON.parse(raw);
      document.getElementById('act-saved-text').textContent =
        `Дата заезда: ${act.date}\n` +
        `⚡ Электричество: ${act.electric} кВт·ч\n` +
        `🔵 Холодная вода: ${act.cold} м³\n` +
        `🔴 Горячая вода: ${act.hot} м³\n` +
        `🟣 Газ: ${act.gas} м³`;
      block.style.display = 'block';
    } else {
      block.style.display = 'none';
    }
  });

  showScreen('screen-act');
}

function saveAct() {
  const date    = document.getElementById('act-date').value;
  const electric = document.getElementById('act-electric').value.trim();
  const cold     = document.getElementById('act-cold').value.trim();
  const hot      = document.getElementById('act-hot').value.trim();
  const gas      = document.getElementById('act-gas').value.trim();

  if (!electric || !cold || !hot || !gas || !date) {
    alert('Заполни все поля.');
    return;
  }

  const act = { date, electric, cold, hot, gas };
  Storage.set('move_in_act', JSON.stringify(act), () => {
    Storage.set('prev_electric', electric);
    Storage.set('prev_cold',     cold);
    Storage.set('prev_hot',      hot);
    Storage.set('prev_gas',      gas, () => {
      const msg = document.getElementById('act-saved-msg');
      msg.style.display = 'block';
      setTimeout(() => { msg.style.display = 'none'; }, 2000);
      openAct();
    });
  });
}

// =============================================
//  НАПОМИНАНИЕ ЖИЛЬЦУ
// =============================================
function sendReminder() {
  Storage.get('bot_token', token => {
    Storage.get('tenant_tg_id', tenantId => {
      Storage.get('bot_username', botName => {
        if (!token) {
          alert('Укажи токен бота в настройках (5 нажатий на «Настройки»).');
          return;
        }
        if (!tenantId) {
          alert('Укажи Telegram ID жильца в настройках.');
          return;
        }
        const link = botName ? `\n\nhttps://t.me/${botName}` : '';
        const text = `🏠 Привет! Пора передать показания счётчиков за этот месяц.${link}`;
        fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tenantId, text })
        })
        .then(r => r.json())
        .then(r => {
          if (r.ok) alert('✅ Напоминание отправлено жильцу!');
          else alert('Ошибка отправки. Проверь ID жильца.');
        })
        .catch(() => alert('Ошибка сети.'));
      });
    });
  });
}

// =============================================
//  ФОТО СЧЁТЧИКА
// =============================================
function handleMeterPhoto(input, targetId) {
  const file = input.files[0];
  if (!file) return;

  const existingPreview = document.getElementById(`photo-preview-${targetId}`);
  if (existingPreview) existingPreview.remove();

  const reader = new FileReader();
  reader.onload = e => {
    const img = document.createElement('img');
    img.id = `photo-preview-${targetId}`;
    img.src = e.target.result;
    img.style.cssText = 'width:100%;border-radius:8px;margin-top:6px;max-height:160px;object-fit:cover;';
    const inputEl = document.getElementById(targetId);
    inputEl.closest('.meter-input-row').after(img);
    inputEl.focus();
  };
  reader.readAsDataURL(file);
  input.value = '';
}

// =============================================
//  РАСЧЁТ
// =============================================
function calculate() {
  const gasOn       = document.getElementById('toggle-gas').checked;
  const curElectric = parseFloat(document.getElementById('input-electric').value);
  const curCold     = parseFloat(document.getElementById('input-cold').value);
  const curHot      = parseFloat(document.getElementById('input-hot').value);
  const curGas      = gasOn ? parseFloat(document.getElementById('input-gas').value) : 0;

  if (isNaN(curElectric) || isNaN(curCold) || isNaN(curHot) || (gasOn && isNaN(curGas))) {
    alert('Пожалуйста, заполни все показания счётчиков.');
    return;
  }

  AptStorage.get('prev_electric', prevElStr => {
  AptStorage.get('prev_cold',     prevColdStr => {
  AptStorage.get('prev_hot',      prevHotStr  => {
  AptStorage.get('prev_gas',      prevGasStr  => {
  AptStorage.get('tariff_electric', tElStr => {
  AptStorage.get('tariff_cold',     tColdStr => {
  AptStorage.get('tariff_hot',      tHotStr  => {
  AptStorage.get('tariff_gas',      tGasStr  => {
  AptStorage.get('tariff_drainage', tDrainStr => {
  AptStorage.get('tariff_hot_heat', tHotHeatStr => {

    const prevElectric = parseFloat(prevElStr)   || 0;
    const prevCold     = parseFloat(prevColdStr) || 0;
    const prevHot      = parseFloat(prevHotStr)  || 0;
    const prevGas      = parseFloat(prevGasStr)  || 0;

    const tariffEl       = parseFloat(tElStr)       || 0;
    const tariffCold     = parseFloat(tColdStr)     || 0;
    const tariffHot      = parseFloat(tHotStr)      || 0;
    const tariffGas      = gasOn ? (parseFloat(tGasStr) || 0) : 0;
    const tariffDrainage = parseFloat(tDrainStr)    || 0;
    const tariffHotHeat  = parseFloat(tHotHeatStr)  || 0;
    const tariffInternet = parseFloat(document.getElementById('tariff-internet').value) || 0;

    if (tariffEl === 0 || tariffCold === 0 || tariffHot === 0) {
      alert('Сначала укажи тарифы в настройках (кнопка ⚙️).');
      return;
    }

    const diffEl       = Math.max(0, curElectric - prevElectric);
    const diffCold     = Math.max(0, curCold     - prevCold);
    const diffHot      = Math.max(0, curHot      - prevHot);
    const diffGas      = gasOn ? Math.max(0, curGas - prevGas) : 0;
    const diffDrainage = diffCold + diffHot;

    const priceEl       = diffEl       * tariffEl;
    const priceCold     = diffCold     * tariffCold;
    const priceHot      = diffHot      * tariffHot;
    const priceHotHeat  = diffHot      * tariffHotHeat;
    const priceGas      = diffGas      * tariffGas;
    const priceDrainage = diffDrainage * tariffDrainage;
    const priceInternet = tariffInternet;
    const total         = priceEl + priceCold + priceHot + priceHotHeat + priceGas + priceDrainage + priceInternet;

    const fmt = n => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
    const rub = n => `${fmt(n)} ₽`;

    document.getElementById('result-electric-detail').textContent =
      `${fmt(diffEl)} кВт·ч × ${fmt(tariffEl)} ₽`;
    document.getElementById('result-cold-detail').textContent =
      `${fmt(diffCold)} м³ × ${fmt(tariffCold)} ₽`;
    document.getElementById('result-hot-detail').textContent =
      `${fmt(diffHot)} м³ × ${fmt(tariffHot)} ₽`;
    document.getElementById('result-hot-heat-detail').textContent =
      tariffHotHeat > 0
        ? `${fmt(diffHot)} м³ × ${fmt(tariffHotHeat)} ₽`
        : '(тариф не указан)';
    document.getElementById('result-gas-detail').textContent =
      `${fmt(diffGas)} м³ × ${fmt(tariffGas)} ₽`;
    document.getElementById('result-drainage-detail').textContent =
      tariffDrainage > 0
        ? `${fmt(diffDrainage)} м³ × ${fmt(tariffDrainage)} ₽`
        : '(тариф не указан)';

    document.getElementById('result-electric-price').textContent  = rub(priceEl);
    document.getElementById('result-cold-price').textContent      = rub(priceCold);
    document.getElementById('result-hot-price').textContent       = rub(priceHot);
    document.getElementById('result-hot-heat-price').textContent  = rub(priceHotHeat);
    document.getElementById('result-gas-price').textContent       = rub(priceGas);
    document.getElementById('result-drainage-price').textContent  = rub(priceDrainage);
    const internetRow = document.getElementById('result-row-internet');
    if (priceInternet > 0) {
      document.getElementById('result-internet-price').textContent = rub(priceInternet);
      internetRow.style.display = '';
    } else {
      internetRow.style.display = 'none';
    }
    document.getElementById('result-total').textContent           = rub(total);

    AptStorage.set('cur_electric', String(curElectric));
    AptStorage.set('cur_cold',     String(curCold));
    AptStorage.set('cur_hot',      String(curHot));
    AptStorage.set('cur_gas',      String(curGas));

    lastCalcResult = {
      month: getMonthLabel(),
      year:  new Date().getFullYear(),
      electric: { prev: prevElectric, curr: curElectric, diff: diffEl,       tariff: tariffEl,       price: priceEl       },
      cold:     { prev: prevCold,     curr: curCold,     diff: diffCold,     tariff: tariffCold,     price: priceCold     },
      hot:      { prev: prevHot,      curr: curHot,      diff: diffHot,      tariff: tariffHot,      price: priceHot      },
      hotHeat:  {                                         diff: diffHot,      tariff: tariffHotHeat,  price: priceHotHeat  },
      gas:      { prev: prevGas,      curr: curGas,      diff: diffGas,      tariff: tariffGas,      price: priceGas      },
      drainage: {                                         diff: diffDrainage, tariff: tariffDrainage, price: priceDrainage },
      internet: {                                                             tariff: tariffInternet, price: priceInternet  },
      total
    };

    showScreen('screen-result');
  });
  });
  });
  });
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
  AptStorage.get(key, raw => {
    const history = raw ? JSON.parse(raw) : [];
    const idx = history.findIndex(r => r.month === data.month);
    if (idx >= 0) history[idx] = data;
    else history.unshift(data);
    AptStorage.set(key, JSON.stringify(history));
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
      const hotHeatLine  = (data.hotHeat  && data.hotHeat.tariff  > 0) ? `🟠 Подогрев г/в: ${fmt(data.hotHeat.diff)} м³ × ${fmt(data.hotHeat.tariff)} ₽ = <b>${fmt(data.hotHeat.price)} ₽</b>\n` : '';
      const gasLine      = (data.gas      && data.gas.price       > 0) ? `🟣 Газ: ${fmt(data.gas.diff)} м³ × ${fmt(data.gas.tariff)} ₽ = <b>${fmt(data.gas.price)} ₽</b>\n` : '';
      const drainageLine = (data.drainage && data.drainage.tariff > 0) ? `🚿 Водоотведение: ${fmt(data.drainage.diff)} м³ × ${fmt(data.drainage.tariff)} ₽ = <b>${fmt(data.drainage.price)} ₽</b>\n` : '';
      const internetLine = (data.internet && data.internet.price  > 0) ? `🌐 Интернет: <b>${fmt(data.internet.price)} ₽</b>\n` : '';
      const text =
        `🏠 <b>Счётчики ЖКХ — ${data.month}</b>\n\n` +
        `⚡ Электричество: ${fmt(data.electric.diff)} кВт·ч × ${fmt(data.electric.tariff)} ₽ = <b>${fmt(data.electric.price)} ₽</b>\n` +
        `🔵 Холодная вода: ${fmt(data.cold.diff)} м³ × ${fmt(data.cold.tariff)} ₽ = <b>${fmt(data.cold.price)} ₽</b>\n` +
        `🔴 Горячая вода: ${fmt(data.hot.diff)} м³ × ${fmt(data.hot.tariff)} ₽ = <b>${fmt(data.hot.price)} ₽</b>\n` +
        hotHeatLine + gasLine + drainageLine + internetLine +
        `\n💰 <b>Итого к оплате: ${fmt(data.total)} ₽</b>`;

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

  AptStorage.get('cur_electric', val => { if (val) AptStorage.set('prev_electric', val); });
  AptStorage.get('cur_cold',     val => { if (val) AptStorage.set('prev_cold',     val); });
  AptStorage.get('cur_hot',      val => { if (val) AptStorage.set('prev_hot',      val); });
  AptStorage.get('cur_gas',      val => { if (val) AptStorage.set('prev_gas',      val); });

  document.getElementById('input-electric').value = '';
  document.getElementById('input-cold').value     = '';
  document.getElementById('input-hot').value      = '';
  document.getElementById('input-gas').value      = '';

  loadAll();
  showScreen('screen-main');
  if (tg) tg.close();
}

// =============================================
//  ИСТОРИЯ — загрузка и отображение
// =============================================
function renderChart(allRecords) {
  const wrap = document.getElementById('history-chart-wrap');
  const container = document.getElementById('history-chart');
  if (allRecords.length === 0) { wrap.style.display = 'none'; return; }

  const sorted = [...allRecords].reverse().slice(-12);
  const maxTotal = Math.max(...sorted.map(r => r.total), 1);

  const bars = document.createElement('div');
  bars.className = 'chart-bars';

  sorted.forEach(r => {
    const heightPct = Math.max(4, (r.total / maxTotal) * 100);
    const col = document.createElement('div');
    col.className = 'chart-bar-col';
    col.innerHTML = `
      <div class="chart-bar-value">${Math.round(r.total)}</div>
      <div class="chart-bar" style="height:${heightPct}%"></div>
      <div class="chart-bar-label">${r.month.split(' ')[0].slice(0, 3)}</div>
    `;
    bars.appendChild(col);
  });

  container.innerHTML = '';
  container.appendChild(bars);
  wrap.style.display = 'block';
}

function loadHistory() {
  showScreen('screen-history');
  const content = document.getElementById('history-content');
  const empty   = document.getElementById('history-empty');
  content.innerHTML = '';
  document.getElementById('history-chart-wrap').style.display = 'none';

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
  let processed = 0;
  const byYear = {};

  years.forEach(year => {
    AptStorage.get(`history_${year}`, raw => {
      processed++;
      if (raw) {
        const records = JSON.parse(raw);
        if (records.length > 0) byYear[year] = records;
      }
      if (processed === years.length) {
        const sortedYears = Object.keys(byYear).map(Number).sort((a, b) => b - a);
        let allRecords = [];

        sortedYears.forEach(year => {
          const records = byYear[year];
          allRecords = allRecords.concat(records);
          if (isOwnerRole) {
            const prevYear = byYear[year - 1] || null;
            content.appendChild(renderYearBlock(year, records, prevYear));
          } else {
            content.appendChild(renderYearBlockTenant(year, records));
          }
        });

        const hasAny = sortedYears.length > 0;
        empty.style.display = hasAny ? 'none' : 'block';
        if (hasAny) renderChart(allRecords);
      }
    });
  });
}

function renderYearBlockTenant(year, records) {
  const rub = n => n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
  const fmt = n => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

  const group = document.createElement('div');
  group.className = 'history-year-group';

  const heading = document.createElement('div');
  heading.className = 'history-year-heading';
  heading.textContent = year;
  group.appendChild(heading);

  records.forEach((r, idx) => {
    const prev = records[idx + 1];
    let trendHtml = '';
    let trendDesc = '';

    if (prev && prev.total > 0) {
      const diff = (r.total - prev.total) / prev.total * 100;
      const abs  = Math.abs(diff).toFixed(0);
      if (diff > 3) {
        trendHtml = `<span class="trend-chip trend-chip--up">+${abs}%</span>`;
        trendDesc = `<span class="tenant-trend-desc">на ${abs}% больше</span>`;
      } else if (diff < -3) {
        trendHtml = `<span class="trend-chip trend-chip--down">−${abs}%</span>`;
        trendDesc = `<span class="tenant-trend-desc">на ${abs}% меньше</span>`;
      } else {
        trendHtml = `<span class="trend-chip trend-chip--same">≈</span>`;
        trendDesc = `<span class="tenant-trend-desc">как в прошлом</span>`;
      }
    }

    const row = document.createElement('div');
    row.className = 'history-row history-row--tenant';
    row.innerHTML = `
      <div class="history-row-month">${r.month.split(' ')[0]}</div>
      <div class="tenant-trend-wrap">${trendHtml}${trendDesc}</div>
      <div class="history-row-total">${rub(r.total)}</div>
    `;
    group.appendChild(row);
  });

  return group;
}

function renderYearBlock(year, records, prevYearRecords) {
  const fmt = n => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  const rub = n => n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';

  const group = document.createElement('div');
  group.className = 'history-year-group';

  const yearTotal = records.reduce((s, r) => s + r.total, 0);
  const prevYearTotal = prevYearRecords ? prevYearRecords.reduce((s, r) => s + r.total, 0) : null;

  let yearTrendHtml = '';
  if (prevYearTotal && prevYearTotal > 0) {
    const diff = (yearTotal - prevYearTotal) / prevYearTotal * 100;
    const abs = Math.abs(diff).toFixed(0);
    if (diff > 3)       yearTrendHtml = `<span class="trend-chip trend-chip--up">+${abs}%</span>`;
    else if (diff < -3) yearTrendHtml = `<span class="trend-chip trend-chip--down">−${abs}%</span>`;
    else                yearTrendHtml = `<span class="trend-chip trend-chip--same">≈</span>`;
  }

  const heading = document.createElement('div');
  heading.className = 'history-year-heading';
  heading.style.display = 'flex';
  heading.style.justifyContent = 'space-between';
  heading.style.alignItems = 'center';
  heading.innerHTML = `<span>${year}</span><span style="display:flex;gap:6px;align-items:center">${yearTrendHtml}<span style="font-variant-numeric:tabular-nums">${rub(yearTotal)}</span></span>`;
  group.appendChild(heading);

  records.forEach((r, idx) => {
    const prev = records[idx + 1];
    let trendHtml = '';
    if (prev && prev.total > 0) {
      const diff = (r.total - prev.total) / prev.total * 100;
      const abs = Math.abs(diff).toFixed(0);
      if (diff > 3)       trendHtml = `<span class="trend-chip trend-chip--up">+${abs}%</span>`;
      else if (diff < -3) trendHtml = `<span class="trend-chip trend-chip--down">−${abs}%</span>`;
      else                trendHtml = `<span class="trend-chip trend-chip--same">≈</span>`;
    }

    const row = document.createElement('div');
    row.className = 'history-row';
    const gasStr = r.gas ? `<span>🟣 ${fmt(r.gas.diff)} м³</span>` : '';
    row.innerHTML = `
      <div class="history-row-month">${r.month.split(' ')[0]}</div>
      <div class="history-row-details">
        <span>⚡ ${fmt(r.electric.diff)} кВт</span>
        <span>🔵 ${fmt(r.cold.diff)} м³</span>
        <span>🔴 ${fmt(r.hot.diff)} м³</span>
        ${gasStr}
      </div>
      <div class="history-row-right">
        ${trendHtml}
        <div class="history-row-total">${rub(r.total)}</div>
      </div>
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
  const prevGas  = document.getElementById('prev-setting-gas').value.trim();
  const el       = document.getElementById('tariff-electric').value.trim();
  const cold     = document.getElementById('tariff-cold').value.trim();
  const hot      = document.getElementById('tariff-hot').value.trim();
  const gas      = document.getElementById('tariff-gas').value.trim();
  const drainage = document.getElementById('tariff-drainage').value.trim();
  const botToken = document.getElementById('bot-token').value.trim();

  const gasOn = document.getElementById('toggle-gas').checked;
  if (!el || !cold || !hot || (gasOn && !gas)) {
    alert('Заполни тарифы (электричество, холодная и горячая вода' + (gasOn ? ', газ' : '') + ').');
    return;
  }

  const saves = [
    ['tariff_electric', el],
    ['tariff_cold',     cold],
    ['tariff_hot',      hot],
    ['tariff_gas',      gas],
  ];
  const hotHeat  = document.getElementById('tariff-hot-heat').value.trim();
  const internet = document.getElementById('tariff-internet').value.trim();
  if (hotHeat)  saves.push(['tariff_hot_heat', hotHeat]);
  if (drainage) saves.push(['tariff_drainage', drainage]);
  if (internet) saves.push(['tariff_internet', internet]);

  if (prevEl)    saves.push(['prev_electric', prevEl]);
  if (prevCold)  saves.push(['prev_cold',     prevCold]);
  if (prevHot)   saves.push(['prev_hot',      prevHot]);
  if (prevGas)   saves.push(['prev_gas',      prevGas]);

  const botUsername = document.getElementById('bot-username').value.trim();
  const tenantId    = document.getElementById('tenant-tg-id').value.trim();

  const globalSaves = [];
  if (botToken)    globalSaves.push(['bot_token',    botToken]);
  if (botUsername) globalSaves.push(['bot_username', botUsername]);
  if (tenantId)    globalSaves.push(['tenant_tg_id', tenantId]);

  const total = saves.length + globalSaves.length;
  let done = 0;
  const onDone = () => {
    done++;
    if (done === total) {
      loadAll();
      const msg = document.getElementById('settings-saved-msg');
      msg.style.display = 'block';
      setTimeout(() => { msg.style.display = 'none'; }, 2000);
    }
  };

  saves.forEach(([key, value]) => AptStorage.set(key, value, onDone));
  globalSaves.forEach(([key, value]) => Storage.set(key, value, onDone));
  if (total === 0) { loadAll(); }
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

    Storage.get('bot_token',    val => { if (val) document.getElementById('bot-token').value = val; });
    Storage.get('bot_username', val => { if (val) document.getElementById('bot-username').value = val; });
    Storage.get('tenant_tg_id',val => { if (val) document.getElementById('tenant-tg-id').value = val; });
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
document.getElementById('btn-remind').addEventListener('click', sendReminder);
document.getElementById('btn-calculate').addEventListener('click', calculate);
document.getElementById('btn-save').addEventListener('click', saveAndClose);
document.getElementById('btn-pdf').addEventListener('click', exportPdf);
document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
document.getElementById('btn-back-from-result').addEventListener('click', () => showScreen('screen-main'));
document.getElementById('btn-back-from-settings').addEventListener('click', () => showScreen('screen-main'));
document.getElementById('btn-history').addEventListener('click', loadHistory);
document.getElementById('btn-back-from-history').addEventListener('click', () => showScreen('screen-main'));
document.getElementById('btn-set-owner').addEventListener('click', setAsOwner);
document.getElementById('btn-open-act').addEventListener('click', openAct);
document.getElementById('btn-back-from-act').addEventListener('click', () => showScreen('screen-settings'));
document.getElementById('btn-save-act').addEventListener('click', saveAct);
document.getElementById('btn-add-apt').addEventListener('click', addApartment);
document.getElementById('apt-selector').addEventListener('change', e => {
  currentAptId = e.target.value;
  loadAll();
});

document.getElementById('toggle-gas').addEventListener('change', e => {
  const on = e.target.checked;
  AptStorage.set('gas_enabled', on ? '1' : '0');
  applyGasVisibility(on);
});

// =============================================
//  СТАРТ
// =============================================
if (!tg?.initData) {
  Storage.get('bot_username', val => {
    if (val) document.getElementById('landing-bot-link').href = `https://t.me/${val}`;
  });
  showScreen('screen-landing');
} else {
  loadAll();
}
