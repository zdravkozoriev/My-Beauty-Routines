'use strict';

/* =====================================================================
   Константи
   ===================================================================== */

const AREAS = { face: 'Лице', hair: 'Коса' };

// Седмицата започва от понеделник; d е стойността от Date#getDay().
const WEEK = [
  { d: 1, l: 'Пн' }, { d: 2, l: 'Вт' }, { d: 3, l: 'Ср' }, { d: 4, l: 'Чт' },
  { d: 5, l: 'Пт' }, { d: 6, l: 'Сб' }, { d: 0, l: 'Нд' },
];
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0];

const STATUSES = {
  using: 'Ползвам',
  want: 'Искам да пробвам',
  finished: 'Свършил',
  disliked: 'Не ми хареса',
};

const ACTIVES = {
  retinol: 'Ретинол / ретиноиди',
  vitc: 'Витамин C',
  aha: 'AHA киселини (гликолова, млечна)',
  bha: 'BHA (салицилова киселина)',
  pha: 'PHA киселини',
  bpo: 'Бензоил пероксид',
  copper: 'Медни пептиди',
  niacinamide: 'Ниацинамид',
  azelaic: 'Азелаинова киселина',
  peptides: 'Пептиди',
  ha: 'Хиалуронова киселина',
  ceramides: 'Керамиди',
};

// Комбинации, които обикновено не се препоръчват в една и съща рутина.
const CONFLICTS = [
  { a: 'retinol', b: 'aha', text: 'Заедно силно дразнят и изсушават кожата. Разпредели ги в различни вечери.' },
  { a: 'retinol', b: 'bha', text: 'Заедно силно дразнят и изсушават кожата. Разпредели ги в различни вечери.' },
  { a: 'retinol', b: 'pha', text: 'Комбинацията може да раздразни кожата. По-добре в различни вечери.' },
  { a: 'retinol', b: 'bpo', text: 'Бензоил пероксидът може да разгради ретиноида и засилва дразненето.' },
  { a: 'retinol', b: 'vitc', text: 'Обикновено се препоръчва витамин C сутрин, а ретинол вечер.' },
  { a: 'vitc', b: 'aha', text: 'Може да раздразни кожата. Витамин C е по-добре сутрин, киселините вечер.' },
  { a: 'vitc', b: 'bha', text: 'Може да раздразни кожата. Витамин C е по-добре сутрин, киселините вечер.' },
  { a: 'vitc', b: 'bpo', text: 'Бензоил пероксидът окислява витамин C и намалява ефекта му.' },
  { a: 'copper', b: 'vitc', text: 'Медните пептиди и витамин C взаимно си намаляват ефекта.' },
  { a: 'copper', b: 'aha', text: 'Киселините могат да разградят медните пептиди.' },
  { a: 'copper', b: 'bha', text: 'Киселините могат да разградят медните пептиди.' },
  { a: 'aha', b: 'bha', text: 'Двойна ексфолиация — може да е твърде силно, особено всеки ден.' },
];

const DEFAULT_CATEGORIES = {
  face: ['Почистване', 'Тоник', 'Серум', 'Околоочен крем', 'Хидратиращ крем', 'Слънцезащита', 'Ексфолиант', 'Маска'],
  hair: ['Шампоан', 'Балсам', 'Маска за коса', 'Термозащита', 'Олио / серум за коса', 'Стилизиране'],
};

/* =====================================================================
   Помощни функции
   ===================================================================== */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const todayKey = () => dateKey(new Date());
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDate = (k) => parseKey(k).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' });
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const sortDays = (days) => ALL_DAYS.filter((d) => days.includes(d));
const daysLabel = (days) => days.length === 7 ? 'Всеки ден' : days.length ? sortDays(days).map((d) => WEEK.find((w) => w.d === d).l).join(', ') : 'Без дни';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}

/* =====================================================================
   Хранилище (IndexedDB)
   ===================================================================== */

const DB = {
  db: null,
  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('my-beauty-routines', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('kv');
        req.result.createObjectStore('photos');
      };
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  },
  run(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },
  get: (store, key) => DB.run(store, 'readonly', (s) => s.get(key)),
  put: (store, key, val) => DB.run(store, 'readwrite', (s) => s.put(val, key)),
  del: (store, key) => DB.run(store, 'readwrite', (s) => s.delete(key)),
  clear: (store) => DB.run(store, 'readwrite', (s) => s.clear()),
  keys: (store) => DB.run(store, 'readonly', (s) => s.getAllKeys()),
};

let state;
const photoCache = new Map();

function defaultState() {
  const categories = [];
  for (const area of Object.keys(DEFAULT_CATEGORIES)) {
    for (const name of DEFAULT_CATEGORIES[area]) categories.push({ id: uid(), area, name });
  }
  const catId = (area, name) => categories.find((c) => c.area === area && c.name === name).id;
  const steps = (area, names) => names.map((n) => ({ id: uid(), categoryId: catId(area, n), productId: null, note: '', days: null }));
  return {
    version: 1,
    categories,
    products: [],
    journal: [],
    checks: {},
    lastExport: null,
    routines: [
      { id: uid(), area: 'face', name: 'Сутрешна рутина', days: [...ALL_DAYS],
        steps: steps('face', ['Почистване', 'Тоник', 'Серум', 'Хидратиращ крем', 'Слънцезащита']) },
      { id: uid(), area: 'face', name: 'Вечерна рутина', days: [...ALL_DAYS],
        steps: steps('face', ['Почистване', 'Тоник', 'Серум', 'Околоочен крем', 'Хидратиращ крем']) },
      { id: uid(), area: 'hair', name: 'Измиване на косата', days: [2, 5],
        steps: steps('hair', ['Шампоан', 'Балсам', 'Термозащита']) },
    ],
  };
}

async function loadState() {
  await DB.open();
  state = await DB.get('kv', 'state');
  if (!state) {
    state = defaultState();
    await saveState();
  }
}

function saveState() {
  return DB.put('kv', 'state', state).catch((err) => {
    console.error(err);
    toast('Грешка при запис: ' + err.message);
  });
}

function commit() {
  saveState();
  render();
}

async function getPhoto(id) {
  if (!id) return null;
  if (!photoCache.has(id)) photoCache.set(id, await DB.get('photos', id));
  return photoCache.get(id);
}

async function storePhoto(dataUrl) {
  const id = uid();
  await DB.put('photos', id, dataUrl);
  photoCache.set(id, dataUrl);
  return id;
}

async function deletePhoto(id) {
  if (!id) return;
  photoCache.delete(id);
  await DB.del('photos', id);
}

// Сменя снимката според избора във формата: undefined — без промяна, null — премахната, низ — нова.
async function applyPhoto(oldId, picked) {
  if (picked === undefined) return oldId || null;
  await deletePhoto(oldId);
  return picked ? storePhoto(picked) : null;
}

// Намалява снимката до разумен размер, за да не се пълни паметта на телефона.
async function readPhotoFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Снимката не може да се зареди.'));
      i.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function hydratePhotos(root) {
  for (const img of root.querySelectorAll('img[data-photo]')) {
    const src = await getPhoto(img.dataset.photo);
    if (src) img.src = src;
  }
}

/* =====================================================================
   Достъп до данни
   ===================================================================== */

const findCategory = (id) => state.categories.find((c) => c.id === id);
const findProduct = (id) => state.products.find((p) => p.id === id);
const findRoutine = (id) => state.routines.find((r) => r.id === id);
const categoriesOf = (area) => state.categories.filter((c) => c.area === area);
const stepName = (step) => findCategory(step.categoryId)?.name || 'Стъпка';

// Дните, в които стъпката се изпълнява (подмножество от дните на рутината).
const stepDays = (routine, step) =>
  step.days && step.days.length ? routine.days.filter((d) => step.days.includes(d)) : routine.days;

const stepsOn = (routine, weekday) => routine.steps.filter((s) => stepDays(routine, s).includes(weekday));

function findConflict(x, y) {
  return CONFLICTS.find((c) => (c.a === x && c.b === y) || (c.a === y && c.b === x));
}

// Конфликти между активни съставки в рутината. С weekday — само за този ден.
function conflictsFor(routine, weekday = null) {
  const out = [];
  const seen = new Set();
  const steps = routine.steps.filter((s) => s.productId && findProduct(s.productId));
  for (let i = 0; i < steps.length; i++) {
    for (let j = i + 1; j < steps.length; j++) {
      const pa = findProduct(steps[i].productId);
      const pb = findProduct(steps[j].productId);
      if (pa.id === pb.id) continue;
      const shared = stepDays(routine, steps[i]).filter((d) => stepDays(routine, steps[j]).includes(d));
      if (weekday === null ? !shared.length : !shared.includes(weekday)) continue;
      for (const x of pa.actives || []) {
        for (const y of pb.actives || []) {
          const c = findConflict(x, y);
          if (!c) continue;
          const key = [pa.id, pb.id, c.a, c.b].join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ pa, pb, x, y, text: c.text, days: shared });
        }
      }
    }
  }
  return out;
}

function conflictHtml(list, routine, showDays) {
  return list.map((c) => `
    <div class="warn" role="note">⚠️ <b>${esc(ACTIVES[c.x])}</b> (${esc(c.pa.name)}) + <b>${esc(ACTIVES[c.y])}</b> (${esc(c.pb.name)})
      ${showDays && c.days.length !== routine.days.length ? `<span>— ${esc(daysLabel(c.days))}</span>` : ''}
      <div>${esc(c.text)}</div>
    </div>`).join('');
}

function routinesUsing(productId) {
  const out = [];
  for (const r of state.routines) {
    for (const s of r.steps) if (s.productId === productId) out.push({ routine: r, step: s });
  }
  return out;
}

/* =====================================================================
   Навигация
   ===================================================================== */

const ui = {
  viewDate: todayKey(),
  dateTouched: false,
  productArea: 'face',
  productStatus: 'all',
};

function route() {
  const [name, id] = location.hash.replace(/^#/, '').split('/');
  return { name: name || 'today', id };
}

function render() {
  const { name, id } = route();
  const view = document.getElementById('view');
  const tab = { routine: 'routines', product: 'products' }[name] || name;
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));

  const views = { today: viewToday, routines: viewRoutines, routine: viewRoutine, products: viewProducts, product: viewProduct, more: viewMore };
  view.innerHTML = (views[name] || viewToday)(id);
  hydratePhotos(view);
}

/* =====================================================================
   Изглед: Днес
   ===================================================================== */

function viewToday() {
  const key = ui.viewDate;
  const date = parseKey(key);
  const wd = date.getDay();
  const isToday = key === todayKey();
  const dayChecks = state.checks[key] || {};

  let html = `
    <div class="day-nav">
      <button class="icon-btn" data-act="day-prev" aria-label="Предишен ден">‹</button>
      <div>
        <div class="day-title">${isToday ? 'Днес' : esc(cap(date.toLocaleDateString('bg-BG', { weekday: 'long' })))}</div>
        <div class="muted small">${esc(fmtDate(key))}</div>
      </div>
      <button class="icon-btn" data-act="day-next" aria-label="Следващ ден">›</button>
    </div>
    ${isToday ? '' : '<a href="#today" class="today-link" data-act="day-today">Към днес</a>'}`;

  const cards = state.routines
    .filter((r) => r.days.includes(wd))
    .map((r) => {
      const steps = stepsOn(r, wd);
      if (!steps.length) return '';
      const done = new Set(dayChecks[r.id] || []);
      const count = steps.filter((s) => done.has(s.id)).length;
      const all = count === steps.length;
      return `
        <section class="card routine-card area-${r.area} ${all ? 'done' : ''}">
          <div class="card-head">
            <div><span class="tag ${r.area}">${AREAS[r.area]}</span><h2>${esc(r.name)}</h2></div>
            <div class="progress-num">${all ? '✓ ' : ''}${count}/${steps.length}</div>
          </div>
          <div class="progress"><span style="width:${(count / steps.length) * 100}%"></span></div>
          <ul class="checklist">
            ${steps.map((s) => {
              const p = findProduct(s.productId);
              const sub = [p ? `${p.name}${p.brand ? ' · ' + p.brand : ''}` : '', s.note].filter(Boolean).join(' — ');
              return `
                <li><label class="check">
                  <input type="checkbox" data-act="toggle-step" data-routine="${r.id}" data-step="${s.id}" ${done.has(s.id) ? 'checked' : ''}>
                  <span class="box" aria-hidden="true"></span>
                  <span class="step-text"><b>${esc(stepName(s))}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>
                </label></li>`;
            }).join('')}
          </ul>
          <button class="btn ${all ? 'ghost' : 'primary'} full" data-act="check-all" data-routine="${r.id}">
            ${all ? 'Размаркирай всички' : '✓ Отбележи всички'}
          </button>
          ${conflictHtml(conflictsFor(r, wd), r, false)}
        </section>`;
    })
    .join('');

  html += cards || `
    <div class="card empty">
      <p>Няма рутини за този ден.</p>
      <a class="btn secondary" href="#routines">Към рутините</a>
    </div>`;
  return html;
}

function setChecks(key, routineId, ids) {
  state.checks[key] = state.checks[key] || {};
  if (ids.length) state.checks[key][routineId] = ids;
  else delete state.checks[key][routineId];
  if (!Object.keys(state.checks[key]).length) delete state.checks[key];
}

/* =====================================================================
   Изглед: Рутини
   ===================================================================== */

function viewRoutines() {
  let html = '';
  for (const area of Object.keys(AREAS)) {
    const list = state.routines.filter((r) => r.area === area);
    html += `<h2 class="section-title">${AREAS[area]}</h2>`;
    html += list.map((r) => {
      const n = conflictsFor(r).length;
      return `
        <a class="card list-item" href="#routine/${r.id}">
          <div class="grow">
            <h3>${esc(r.name)}</h3>
            <div class="muted small">${esc(daysLabel(r.days))} · ${plural(r.steps.length, 'стъпка', 'стъпки')}</div>
            ${n ? `<div class="small" style="color:var(--warn-text);margin-top:4px">⚠️ ${plural(n, 'предупреждение', 'предупреждения')} за съставки</div>` : ''}
          </div>
          <span class="chev" aria-hidden="true">›</span>
        </a>`;
    }).join('') || '<p class="muted small">Няма рутини.</p>';
  }
  html += '<button class="btn primary full" data-act="new-routine" style="margin-top:8px">+ Нова рутина</button>';
  return html;
}

function viewRoutine(id) {
  const r = findRoutine(id);
  if (!r) return notFound('#routines', 'Рутини');
  return `
    <a class="back" href="#routines">‹ Рутини</a>
    <div class="card">
      <div class="row between">
        <div>
          <span class="tag ${r.area}">${AREAS[r.area]}</span>
          <h2 class="detail-title" style="margin-top:6px">${esc(r.name)}</h2>
          <div class="muted small">${esc(daysLabel(r.days))}</div>
        </div>
        <button class="btn ghost small" data-act="edit-routine" data-routine="${r.id}">Редактирай</button>
      </div>
      ${conflictHtml(conflictsFor(r), r, true)}
    </div>

    <h2 class="section-title">Стъпки</h2>
    <div class="card">
      ${r.steps.length ? `<ol class="steps">${r.steps.map((s, i) => {
        const p = findProduct(s.productId);
        const custom = s.days && s.days.length;
        return `
          <li class="step">
            <span class="step-num">${i + 1}</span>
            <div class="grow">
              <b>${esc(stepName(s))}</b>
              <div class="muted small">${p ? esc(p.name) : '<i>без продукт</i>'}${s.note ? ' — ' + esc(s.note) : ''}</div>
              ${custom ? `<div class="small"><span class="tag plain">Само: ${esc(daysLabel(stepDays(r, s)))}</span></div>` : ''}
            </div>
            <div class="actions">
              <button class="icon-btn" data-act="step-up" data-routine="${r.id}" data-step="${s.id}" aria-label="Нагоре" ${i === 0 ? 'disabled' : ''}>↑</button>
              <button class="icon-btn" data-act="step-down" data-routine="${r.id}" data-step="${s.id}" aria-label="Надолу" ${i === r.steps.length - 1 ? 'disabled' : ''}>↓</button>
              <button class="icon-btn" data-act="edit-step" data-routine="${r.id}" data-step="${s.id}" aria-label="Редактирай">✎</button>
            </div>
          </li>`;
      }).join('')}</ol>` : '<p class="muted">Още няма стъпки.</p>'}
      <button class="btn secondary full" data-act="new-step" data-routine="${r.id}" style="margin-top:10px">+ Добави стъпка</button>
    </div>

    <button class="btn danger full" data-act="delete-routine" data-routine="${r.id}">Изтрий рутината</button>`;
}

function daysPicker(name, selected, allowed = ALL_DAYS) {
  return `<div class="chips">${WEEK.filter((w) => allowed.includes(w.d)).map((w) => `
    <label class="chip"><input type="checkbox" name="${name}" value="${w.d}" ${selected.includes(w.d) ? 'checked' : ''}><span>${w.l}</span></label>`).join('')}</div>`;
}

const readDays = (form, name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => Number(i.value));

function routineModal(r) {
  const isNew = !r;
  const hasSteps = r && r.steps.length;
  openModal({
    title: isNew ? 'Нова рутина' : 'Редактирай рутина',
    body: `
      <label class="field"><span class="label">Име</span>
        <input type="text" name="name" value="${esc(r?.name || '')}" placeholder="напр. Вечерна рутина" required></label>
      <label class="field"><span class="label">За</span>
        <select name="area" ${hasSteps ? 'disabled' : ''}>
          ${Object.entries(AREAS).map(([k, v]) => `<option value="${k}" ${(r?.area || 'face') === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        ${hasSteps ? '<div class="hint">Не може да се смени, докато рутината има стъпки.</div>' : ''}</label>
      <div class="field"><span class="label">В кои дни</span>${daysPicker('days', r?.days || ALL_DAYS)}</div>`,
    onSubmit(form) {
      const name = form.name.value.trim();
      const days = readDays(form, 'days');
      if (!name) return invalid(form.name);
      if (!days.length) { toast('Избери поне един ден.'); return false; }
      if (isNew) {
        const nr = { id: uid(), area: form.area.value, name, days, steps: [] };
        state.routines.push(nr);
        saveState();
        location.hash = `#routine/${nr.id}`;
      } else {
        r.name = name;
        r.days = days;
        if (!hasSteps) r.area = form.area.value;
        commit();
      }
    },
  });
}

function categorySelect(area, selectedId) {
  return `
    <select name="category">
      ${categoriesOf(area).map((c) => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      <option value="__new">+ Нова категория…</option>
    </select>
    <input type="text" name="newCategory" placeholder="Име на новата категория" hidden style="margin-top:8px">`;
}

function wireCategorySelect(form, onChange) {
  const sync = () => {
    const isNew = form.category.value === '__new';
    form.newCategory.hidden = !isNew;
    if (isNew) form.newCategory.focus();
    onChange?.();
  };
  form.category.addEventListener('change', sync);
  sync();
}

// Връща id на избраната категория; създава нова, ако е въведена.
function resolveCategory(form, area) {
  if (form.category.value !== '__new') return form.category.value || null;
  const name = form.newCategory.value.trim();
  if (!name) { invalid(form.newCategory); return undefined; }
  const existing = categoriesOf(area).find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const c = { id: uid(), area, name };
  state.categories.push(c);
  return c.id;
}

function stepModal(r, step) {
  const isNew = !step;
  const custom = !!(step?.days && step.days.length);
  openModal({
    title: isNew ? 'Нова стъпка' : 'Редактирай стъпка',
    body: `
      <label class="field"><span class="label">Стъпка (категория)</span>${categorySelect(r.area, step?.categoryId)}</label>
      <label class="field"><span class="label">Продукт</span>
        <select name="product"></select>
        <div class="hint">Показват се продуктите от каталога в тази категория.</div></label>
      <label class="field"><span class="label">Бележка</span>
        <input type="text" name="note" value="${esc(step?.note || '')}" placeholder="напр. 2–3 капки, остави 10 мин"></label>
      <div class="field"><span class="label">Кога</span>
        <label class="radio-line"><input type="radio" name="when" value="always" ${custom ? '' : 'checked'}> Винаги с рутината (${esc(daysLabel(r.days))})</label>
        <label class="radio-line"><input type="radio" name="when" value="custom" ${custom ? 'checked' : ''}> Само в избрани дни</label>
        <div data-days ${custom ? '' : 'hidden'} style="margin-top:6px">${daysPicker('stepDays', step?.days || [], r.days)}</div>
      </div>
      ${isNew ? '' : '<button type="button" class="btn danger full" data-delete-step>Изтрий стъпката</button>'}`,
    onMount(dlg, form) {
      const fillProducts = () => {
        const catId = form.category.value;
        const list = state.products.filter((p) => p.area === r.area && p.categoryId === catId);
        const current = step?.productId;
        form.product.innerHTML = '<option value="">— без продукт —</option>' + list.map((p) =>
          `<option value="${p.id}" ${p.id === current ? 'selected' : ''}>${esc(p.name)}${p.brand ? ' · ' + esc(p.brand) : ''}${p.status !== 'using' ? ' (' + STATUSES[p.status].toLowerCase() + ')' : ''}</option>`).join('');
      };
      wireCategorySelect(form, fillProducts);
      form.querySelectorAll('input[name="when"]').forEach((el) => el.addEventListener('change', () => {
        dlg.querySelector('[data-days]').hidden = form.when.value !== 'custom';
      }));
      dlg.querySelector('[data-delete-step]')?.addEventListener('click', () => {
        if (!confirm(`Да изтрия ли стъпката „${stepName(step)}“?`)) return;
        r.steps = r.steps.filter((s) => s.id !== step.id);
        dlg.close();
        commit();
      });
    },
    onSubmit(form) {
      const categoryId = resolveCategory(form, r.area);
      if (categoryId === undefined) return false;
      const days = form.when.value === 'custom' ? readDays(form, 'stepDays') : null;
      if (days && !days.length) { toast('Избери поне един ден.'); return false; }
      const data = { categoryId, productId: form.product.value || null, note: form.note.value.trim(), days };
      if (isNew) r.steps.push({ id: uid(), ...data });
      else Object.assign(step, data);
      commit();
    },
  });
}

/* =====================================================================
   Изглед: Продукти
   ===================================================================== */

function productThumb(p) {
  return `<span class="thumb">${p.photoId ? `<img data-photo="${p.photoId}" alt="">` : (p.area === 'hair' ? '✂' : '✿')}</span>`;
}

function activeTags(p) {
  return (p.actives || []).map((a) => `<span class="tag plain">${esc(ACTIVES[a].split(' (')[0])}</span>`).join('');
}

function viewProducts() {
  const area = ui.productArea;
  const all = state.products.filter((p) => p.area === area);
  const list = ui.productStatus === 'all' ? all : all.filter((p) => p.status === ui.productStatus);

  let html = `
    <div class="segmented" role="tablist">
      ${Object.entries(AREAS).map(([k, v]) => `<button role="tab" data-act="product-area" data-area="${k}" class="${k === area ? 'active' : ''}" aria-selected="${k === area}">${v}</button>`).join('')}
    </div>
    <div class="chips filter-chips">
      <button class="chip ${ui.productStatus === 'all' ? 'active' : ''}" data-act="product-status" data-status="all">Всички (${all.length})</button>
      ${Object.entries(STATUSES).map(([k, v]) => {
        const n = all.filter((p) => p.status === k).length;
        return `<button class="chip ${ui.productStatus === k ? 'active' : ''}" data-act="product-status" data-status="${k}">${v} (${n})</button>`;
      }).join('')}
    </div>
    <button class="btn primary full" data-act="new-product" style="margin-bottom:14px">+ Добави продукт</button>`;

  if (!list.length) {
    return html + `<div class="card empty"><p>${all.length ? 'Няма продукти с този статус.' : `Каталогът за ${AREAS[area].toLowerCase()} е празен.`}</p></div>`;
  }

  const groups = categoriesOf(area).map((c) => ({ name: c.name, items: list.filter((p) => p.categoryId === c.id) }));
  const orphans = list.filter((p) => !findCategory(p.categoryId));
  if (orphans.length) groups.push({ name: 'Без категория', items: orphans });

  html += groups.filter((g) => g.items.length).map((g) => `
    <section class="card cat-group">
      <h3 class="cat-name">${esc(g.name)} · ${g.items.length}</h3>
      ${g.items.map((p) => `
        <a class="product" href="#product/${p.id}">
          ${productThumb(p)}
          <div class="grow">
            <h3>${esc(p.name)}</h3>
            ${p.brand ? `<div class="muted small">${esc(p.brand)}</div>` : ''}
            <div class="meta"><span class="tag st-${p.status}">${STATUSES[p.status]}</span>${activeTags(p)}</div>
          </div>
          <span class="chev" aria-hidden="true">›</span>
        </a>`).join('')}
    </section>`).join('');
  return html;
}

function viewProduct(id) {
  const p = findProduct(id);
  if (!p) return notFound('#products', 'Продукти');
  const uses = routinesUsing(p.id);
  const entries = state.journal.filter((j) => j.productId === p.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const first = entries.length ? entries[entries.length - 1].date : null;
  const withPhoto = entries.filter((e) => e.photoId);
  const oldest = withPhoto[withPhoto.length - 1];
  const newest = withPhoto[0];

  return `
    <a class="back" href="#products">‹ Продукти</a>
    <div class="card">
      ${p.photoId ? `<img class="hero-photo" data-photo="${p.photoId}" data-zoom alt="${esc(p.name)}">` : ''}
      <div class="row between" style="align-items:flex-start">
        <div>
          <h2 class="detail-title">${esc(p.name)}</h2>
          ${p.brand ? `<div class="muted">${esc(p.brand)}</div>` : ''}
        </div>
        <button class="btn ghost small" data-act="edit-product" data-product="${p.id}">Редактирай</button>
      </div>
      <div class="tags" style="margin-top:10px">
        <span class="tag ${p.area}">${AREAS[p.area]}</span>
        <span class="tag plain">${esc(findCategory(p.categoryId)?.name || 'Без категория')}</span>
        <span class="tag st-${p.status}">${STATUSES[p.status]}</span>
      </div>
      ${(p.actives || []).length ? `<dl class="kv"><dt>Съставки</dt><dd>${p.actives.map((a) => esc(ACTIVES[a])).join(', ')}</dd></dl>` : ''}
      ${p.notes ? `<p class="notes">${esc(p.notes)}</p>` : ''}
      <dl class="kv"><dt>Ползва се в</dt><dd>${uses.length ? uses.map((u) => `<a href="#routine/${u.routine.id}">${esc(u.routine.name)}</a> (${esc(stepName(u.step))})`).join('<br>') : '<span class="muted">не е добавен в рутина</span>'}</dd></dl>
    </div>

    <div class="row between">
      <h2 class="section-title">Дневник</h2>
      <button class="btn secondary small" data-act="new-entry" data-product="${p.id}">+ Запис</button>
    </div>

    ${oldest && newest && oldest !== newest ? `
      <div class="card">
        <h3 style="font-size:15px;margin-bottom:10px">Преди и след · ${plural(daysBetween(oldest.date, newest.date), 'ден', 'дни')}</h3>
        <div class="compare">
          <figure><img data-photo="${oldest.photoId}" data-zoom alt="Първа снимка"><figcaption>${esc(fmtDate(oldest.date))}</figcaption></figure>
          <figure><img data-photo="${newest.photoId}" data-zoom alt="Последна снимка"><figcaption>${esc(fmtDate(newest.date))}</figcaption></figure>
        </div>
      </div>` : ''}

    <div class="card">
      ${entries.length ? entries.map((e) => `
        <article class="journal-entry">
          <div class="row between">
            <div class="when">${esc(fmtDate(e.date))} <span class="day-count">· ден ${daysBetween(first, e.date) + 1}</span></div>
            <button class="icon-btn" data-act="edit-entry" data-entry="${e.id}" aria-label="Редактирай записа">✎</button>
          </div>
          ${e.text ? `<p>${esc(e.text)}</p>` : ''}
          ${e.photoId ? `<img data-photo="${e.photoId}" data-zoom alt="Снимка от ${esc(fmtDate(e.date))}">` : ''}
        </article>`).join('') : `
        <div class="empty"><p>Записвай как ти действа продуктът — с бележки и снимки. Така ще видиш разликата с времето.</p></div>`}
    </div>

    <button class="btn danger full" data-act="delete-product" data-product="${p.id}">Изтрий продукта</button>`;
}

function photoField(currentId) {
  return `
    <div class="photo-field">
      <div class="photo-preview">${currentId ? `<img data-photo="${currentId}" alt="">` : ''}</div>
      <label class="btn secondary small">📷 Избери снимка<input type="file" accept="image/*" hidden data-photo-input></label>
      <button type="button" class="btn ghost small" data-photo-remove ${currentId ? '' : 'hidden'}>Премахни</button>
    </div>`;
}

// ctx.photo: undefined — без промяна, null — премахната, низ — нова снимка.
function wirePhotoField(dlg, ctx) {
  const preview = dlg.querySelector('.photo-preview');
  const remove = dlg.querySelector('[data-photo-remove]');
  dlg.querySelector('[data-photo-input]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      ctx.photo = await readPhotoFile(file);
      preview.innerHTML = `<img src="${ctx.photo}" alt="">`;
      remove.hidden = false;
    } catch (err) {
      toast(err.message);
    }
  });
  remove.addEventListener('click', () => {
    ctx.photo = null;
    preview.innerHTML = '';
    remove.hidden = true;
  });
}

function productModal(p) {
  const isNew = !p;
  const ctx = {};
  const area = p?.area || ui.productArea;
  openModal({
    title: isNew ? 'Нов продукт' : 'Редактирай продукт',
    body: `
      <label class="field"><span class="label">Име</span>
        <input type="text" name="name" value="${esc(p?.name || '')}" placeholder="напр. Хидратиращ серум" required></label>
      <label class="field"><span class="label">Марка</span>
        <input type="text" name="brand" value="${esc(p?.brand || '')}"></label>
      <label class="field"><span class="label">Каталог</span>
        <select name="area">${Object.entries(AREAS).map(([k, v]) => `<option value="${k}" ${area === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span class="label">Категория (стъпка в рутината)</span><span data-cat>${categorySelect(area, p?.categoryId)}</span></label>
      <div class="field"><span class="label">Статус</span>
        <div class="chips">${Object.entries(STATUSES).map(([k, v]) => `
          <label class="chip"><input type="radio" name="status" value="${k}" ${(p?.status || 'using') === k ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></div>
      <div class="field"><span class="label">Активни съставки</span>
        <div class="chips">${Object.entries(ACTIVES).map(([k, v]) => `
          <label class="chip"><input type="checkbox" name="actives" value="${k}" ${(p?.actives || []).includes(k) ? 'checked' : ''}><span>${esc(v)}</span></label>`).join('')}</div>
        <div class="hint">Използват се за предупреждения при несъвместими комбинации в една рутина.</div></div>
      <div class="field"><span class="label">Снимка</span>${photoField(p?.photoId)}</div>
      <label class="field"><span class="label">Бележки</span>
        <textarea name="notes" placeholder="Къде го купих, цена, как го ползвам…">${esc(p?.notes || '')}</textarea></label>`,
    onMount(dlg, form) {
      wireCategorySelect(form);
      form.area.addEventListener('change', () => {
        dlg.querySelector('[data-cat]').innerHTML = categorySelect(form.area.value, null);
        wireCategorySelect(form);
      });
      wirePhotoField(dlg, ctx);
    },
    async onSubmit(form) {
      const name = form.name.value.trim();
      if (!name) return invalid(form.name);
      const newArea = form.area.value;
      const categoryId = resolveCategory(form, newArea);
      if (categoryId === undefined) return false;
      const target = p || { id: uid(), createdAt: Date.now() };
      Object.assign(target, {
        name,
        brand: form.brand.value.trim(),
        area: newArea,
        categoryId,
        status: form.status.value,
        actives: [...form.querySelectorAll('input[name="actives"]:checked')].map((i) => i.value),
        notes: form.notes.value.trim(),
        photoId: await applyPhoto(p?.photoId, ctx.photo),
      });
      if (p && p.area !== area) {
        // Продуктът е преместен в другия каталог — махаме го от стъпки в рутини за старата област.
        for (const r of state.routines) for (const s of r.steps) if (s.productId === p.id && r.area !== newArea) s.productId = null;
      }
      if (isNew) {
        state.products.push(target);
        ui.productArea = newArea;
      }
      commit();
    },
  });
}

function entryModal(productId, entry) {
  const isNew = !entry;
  const ctx = {};
  openModal({
    title: isNew ? 'Нов запис в дневника' : 'Редактирай запис',
    body: `
      <label class="field"><span class="label">Дата</span>
        <input type="date" name="date" value="${entry?.date || todayKey()}" max="${todayKey()}" required></label>
      <label class="field"><span class="label">Как се чувства кожата / косата?</span>
        <textarea name="text" placeholder="напр. По-малко сухота, без раздразнение…">${esc(entry?.text || '')}</textarea></label>
      <div class="field"><span class="label">Снимка</span>${photoField(entry?.photoId)}</div>
      ${isNew ? '' : '<button type="button" class="btn danger full" data-delete-entry>Изтрий записа</button>'}`,
    onMount(dlg) {
      wirePhotoField(dlg, ctx);
      dlg.querySelector('[data-delete-entry]')?.addEventListener('click', async () => {
        if (!confirm('Да изтрия ли записа?')) return;
        await deletePhoto(entry.photoId);
        state.journal = state.journal.filter((j) => j.id !== entry.id);
        dlg.close();
        commit();
      });
    },
    async onSubmit(form) {
      const date = form.date.value;
      if (!date) return invalid(form.date);
      const text = form.text.value.trim();
      const hasPhoto = ctx.photo || (ctx.photo === undefined && entry?.photoId);
      if (!text && !hasPhoto) { toast('Добави бележка или снимка.'); return false; }
      const target = entry || { id: uid(), productId, createdAt: Date.now() };
      Object.assign(target, { date, text, photoId: await applyPhoto(entry?.photoId, ctx.photo) });
      if (isNew) state.journal.push(target);
      commit();
    },
  });
}

/* =====================================================================
   Изглед: Още
   ===================================================================== */

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  if (route().name === 'more') render();
});

function viewMore() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return `
    <h2 class="section-title">Категории</h2>
    <div class="card">
      <p class="muted small" style="margin-top:0">Категориите са стъпките в рутините. По тях се подреждат продуктите в каталога.</p>
      ${Object.entries(AREAS).map(([area, label]) => `
        <h3 style="font-size:15px;margin:14px 0 4px">${label}</h3>
        ${categoriesOf(area).map((c) => `
          <div class="cat-row">
            <span class="grow">${esc(c.name)}</span>
            <button class="icon-btn" data-act="rename-category" data-category="${c.id}" aria-label="Преименувай">✎</button>
            <button class="icon-btn" data-act="delete-category" data-category="${c.id}" aria-label="Изтрий">🗑</button>
          </div>`).join('')}
        <button class="btn ghost small" data-act="new-category" data-area="${area}" style="margin-top:6px">+ Категория</button>`).join('')}
    </div>

    <h2 class="section-title">Архив на данните</h2>
    <div class="card stack">
      <p class="small" style="margin:0">Данните се пазят само на това устройство. Свали архив от време на време, за да не ги загубиш, или за да ги пренесеш на друг телефон.</p>
      <p class="muted small" style="margin:0">Последен архив: ${state.lastExport ? esc(new Date(state.lastExport).toLocaleString('bg-BG')) : 'никога'}</p>
      <div class="btn-row">
        <button class="btn primary" data-act="export">⬇ Свали архив</button>
        <label class="btn secondary">⬆ Възстанови<input type="file" accept="application/json,.json" hidden data-act="import"></label>
      </div>
    </div>

    <h2 class="section-title">Инсталиране на телефона</h2>
    <div class="card stack small">
      ${standalone ? '<p style="margin:0">✓ Приложението е инсталирано.</p>' : `
        ${installPrompt ? '<button class="btn primary full" data-act="install">Инсталирай приложението</button>' : ''}
        <p style="margin:0"><b>iPhone (Safari):</b> бутон „Сподели“ → „Добави към началния екран“.</p>
        <p style="margin:0"><b>Android (Chrome):</b> меню ⋮ → „Инсталиране на приложението“ или „Добавяне към началния екран“.</p>`}
      <p class="muted" style="margin:0">След инсталиране работи и без интернет.</p>
    </div>

    <h2 class="section-title">Несъвместими съставки</h2>
    <div class="card small">
      <p style="margin-top:0">Приложението предупреждава, когато в една рутина в един и същ ден има:</p>
      <ul class="conflict-ref">
        ${CONFLICTS.map((c) => `<li><b>${esc(ACTIVES[c.a])}</b> + <b>${esc(ACTIVES[c.b])}</b> — ${esc(c.text)}</li>`).join('')}
      </ul>
      <p class="muted" style="margin-bottom:0">Това са общи насоки, а не медицински съвет. При чувствителна кожа се консултирай с дерматолог.</p>
    </div>

    <h2 class="section-title">Нулиране</h2>
    <div class="card">
      <button class="btn danger full" data-act="reset">Изтрий всички данни</button>
    </div>`;
}

function categoryUsage(id) {
  const products = state.products.filter((p) => p.categoryId === id).length;
  const steps = state.routines.reduce((n, r) => n + r.steps.filter((s) => s.categoryId === id).length, 0);
  return { products, steps };
}

function categoryModal(area, c) {
  openModal({
    title: c ? 'Преименувай категория' : `Нова категория · ${AREAS[area]}`,
    body: `<label class="field"><span class="label">Име</span><input type="text" name="name" value="${esc(c?.name || '')}" required></label>`,
    onSubmit(form) {
      const name = form.name.value.trim();
      if (!name) return invalid(form.name);
      const dup = categoriesOf(area).find((x) => x.name.toLowerCase() === name.toLowerCase() && x !== c);
      if (dup) { toast('Вече има такава категория.'); return false; }
      if (c) c.name = name;
      else state.categories.push({ id: uid(), area, name });
      commit();
    },
  });
}

async function exportData() {
  const photos = {};
  for (const id of await DB.keys('photos')) photos[id] = await getPhoto(id);
  state.lastExport = Date.now();
  await saveState();
  const blob = new Blob([JSON.stringify({ app: 'my-beauty-routines', exportedAt: new Date().toISOString(), state, photos })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `my-beauty-routines-${todayKey()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  render();
}

async function importData(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    toast('Файлът не е валиден архив.');
    return;
  }
  const s = data?.state;
  if (data?.app !== 'my-beauty-routines' || !s || !Array.isArray(s.routines) || !Array.isArray(s.products) || !Array.isArray(s.categories)) {
    toast('Файлът не е архив от My Beauty Routines.');
    return;
  }
  if (!confirm('Текущите данни ще бъдат заменени с тези от архива. Продължаваш ли?')) return;
  s.journal = s.journal || [];
  s.checks = s.checks || {};
  await DB.clear('photos');
  photoCache.clear();
  for (const [id, url] of Object.entries(data.photos || {})) if (url) await DB.put('photos', id, url);
  state = s;
  await saveState();
  toast('Данните са възстановени.');
  location.hash = '#today';
  render();
}

/* =====================================================================
   Модални прозорци
   ===================================================================== */

function openModal({ title, body, submitLabel = 'Запази', onSubmit, onMount }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'modal';
  dlg.innerHTML = `
    <form class="modal-form" novalidate>
      <header class="modal-head">
        <h2>${esc(title)}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Затвори">✕</button>
      </header>
      <div class="modal-body">${body}</div>
      <footer class="modal-foot">
        <button type="button" class="btn ghost" data-close>Отказ</button>
        <button type="submit" class="btn primary">${esc(submitLabel)}</button>
      </footer>
    </form>`;
  document.body.append(dlg);
  const form = dlg.querySelector('form');
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') || e.target === dlg) dlg.close();
  });
  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    try {
      if ((await onSubmit(form, dlg)) !== false && dlg.open) dlg.close();
    } finally {
      busy = false;
    }
  });
  onMount?.(dlg, form);
  hydratePhotos(dlg);
  dlg.showModal();
  return dlg;
}

function invalid(input) {
  input.classList.add('invalid');
  input.focus();
  input.addEventListener('input', () => input.classList.remove('invalid'), { once: true });
  return false;
}

function openLightbox(src) {
  const dlg = document.createElement('dialog');
  dlg.className = 'lightbox';
  dlg.innerHTML = `<img alt="">`;
  dlg.querySelector('img').src = src;
  document.body.append(dlg);
  dlg.addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
}

function notFound(href, label) {
  return `<a class="back" href="${href}">‹ ${label}</a><div class="card empty"><p>Не е намерено.</p></div>`;
}

/* =====================================================================
   Събития
   ===================================================================== */

function moveStep(r, stepId, delta) {
  const i = r.steps.findIndex((s) => s.id === stepId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= r.steps.length) return;
  [r.steps[i], r.steps[j]] = [r.steps[j], r.steps[i]];
  commit();
}

const actions = {
  'day-prev'() { shiftDay(-1); },
  'day-next'() { shiftDay(1); },
  'day-today'(el, e) { e.preventDefault(); ui.viewDate = todayKey(); ui.dateTouched = false; render(); },
  'check-all'(el) {
    const r = findRoutine(el.dataset.routine);
    const ids = stepsOn(r, parseKey(ui.viewDate).getDay()).map((s) => s.id);
    const done = state.checks[ui.viewDate]?.[r.id] || [];
    const all = ids.every((id) => done.includes(id));
    setChecks(ui.viewDate, r.id, all ? [] : ids);
    commit();
  },
  'new-routine'() { routineModal(null); },
  'edit-routine'(el) { routineModal(findRoutine(el.dataset.routine)); },
  'delete-routine'(el) {
    const r = findRoutine(el.dataset.routine);
    if (!confirm(`Да изтрия ли „${r.name}“?`)) return;
    state.routines = state.routines.filter((x) => x !== r);
    for (const day of Object.keys(state.checks)) setChecks(day, r.id, []);
    saveState();
    location.hash = '#routines';
  },
  'new-step'(el) { stepModal(findRoutine(el.dataset.routine), null); },
  'edit-step'(el) {
    const r = findRoutine(el.dataset.routine);
    stepModal(r, r.steps.find((s) => s.id === el.dataset.step));
  },
  'step-up'(el) { moveStep(findRoutine(el.dataset.routine), el.dataset.step, -1); },
  'step-down'(el) { moveStep(findRoutine(el.dataset.routine), el.dataset.step, 1); },
  'product-area'(el) { ui.productArea = el.dataset.area; render(); },
  'product-status'(el) { ui.productStatus = el.dataset.status; render(); },
  'new-product'() { productModal(null); },
  'edit-product'(el) { productModal(findProduct(el.dataset.product)); },
  async 'delete-product'(el) {
    const p = findProduct(el.dataset.product);
    const n = state.journal.filter((j) => j.productId === p.id).length;
    if (!confirm(`Да изтрия ли „${p.name}“${n ? ` и ${plural(n, 'запис', 'записа')} в дневника` : ''}?`)) return;
    for (const r of state.routines) for (const s of r.steps) if (s.productId === p.id) s.productId = null;
    for (const j of state.journal.filter((x) => x.productId === p.id)) await deletePhoto(j.photoId);
    await deletePhoto(p.photoId);
    state.journal = state.journal.filter((j) => j.productId !== p.id);
    state.products = state.products.filter((x) => x !== p);
    saveState();
    location.hash = '#products';
  },
  'new-entry'(el) { entryModal(el.dataset.product, null); },
  'edit-entry'(el) {
    const e = state.journal.find((j) => j.id === el.dataset.entry);
    entryModal(e.productId, e);
  },
  'new-category'(el) { categoryModal(el.dataset.area, null); },
  'rename-category'(el) {
    const c = findCategory(el.dataset.category);
    categoryModal(c.area, c);
  },
  'delete-category'(el) {
    const c = findCategory(el.dataset.category);
    const u = categoryUsage(c.id);
    if (u.products || u.steps) {
      alert(`„${c.name}“ се ползва от ${plural(u.products, 'продукт', 'продукта')} и ${plural(u.steps, 'стъпка', 'стъпки')}. Премести ги в друга категория, преди да я изтриеш.`);
      return;
    }
    if (!confirm(`Да изтрия ли категорията „${c.name}“?`)) return;
    state.categories = state.categories.filter((x) => x !== c);
    commit();
  },
  export() { exportData(); },
  async install() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    render();
  },
  async reset() {
    if (!confirm('Всички рутини, продукти, снимки и записи ще бъдат изтрити. Сигурна ли си?')) return;
    if (!confirm('Последно потвърждение: това не може да се отмени.')) return;
    await DB.clear('photos');
    photoCache.clear();
    state = defaultState();
    await saveState();
    location.hash = '#today';
    render();
  },
};

function shiftDay(delta) {
  const d = parseKey(ui.viewDate);
  d.setDate(d.getDate() + delta);
  ui.viewDate = dateKey(d);
  ui.dateTouched = ui.viewDate !== todayKey();
  render();
}

function bindEvents() {
  const view = document.getElementById('view');

  view.addEventListener('click', (e) => {
    const zoom = e.target.closest('img[data-zoom]');
    if (zoom && zoom.src) { openLightbox(zoom.src); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    actions[el.dataset.act]?.(el, e);
  });

  view.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.act === 'toggle-step') {
      const key = ui.viewDate;
      const done = new Set(state.checks[key]?.[el.dataset.routine] || []);
      if (el.checked) done.add(el.dataset.step);
      else done.delete(el.dataset.step);
      setChecks(key, el.dataset.routine, [...done]);
      commit();
    } else if (el.dataset.act === 'import' && el.files[0]) {
      importData(el.files[0]);
      el.value = '';
    }
  });

  window.addEventListener('hashchange', () => {
    render();
    window.scrollTo(0, 0);
  });

  // Ако приложението стои отворено през нощта, „Днес“ да показва новия ден.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !ui.dateTouched && ui.viewDate !== todayKey()) {
      ui.viewDate = todayKey();
      render();
    }
  });
}

/* =====================================================================
   Старт
   ===================================================================== */

(async function init() {
  try {
    await loadState();
  } catch (err) {
    document.getElementById('view').innerHTML = `<div class="card empty"><p>Хранилището на браузъра не е достъпно (${esc(err.message)}). Провери дали не си в режим „инкогнито“.</p></div>`;
    return;
  }
  bindEvents();
  render();
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker:', err));
  }
})();
