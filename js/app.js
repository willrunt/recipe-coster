import { fetchData, cachedData, setPantry } from './api.js';
import { recipeCost, lineCost, isInPantry } from './costs.js';

let data = null;

const $ = (sel) => document.querySelector(sel);
const aud = (n) => (n === null ? '—' : `$${n.toFixed(2)}`);

function ingredientsById() {
  return Object.fromEntries(data.ingredients.map((i) => [i.id, i]));
}

function linesFor(recipeId) {
  return data.recipeIngredients.filter((l) => String(l.recipe_id) === String(recipeId));
}

function setStatus(msg) {
  const el = $('#status');
  el.textContent = msg || '';
  el.classList.toggle('hidden', !msg);
}

function showView(name) {
  for (const v of document.querySelectorAll('main .view')) v.classList.add('hidden');
  $(`#view-${name}`).classList.remove('hidden');
  for (const b of document.querySelectorAll('nav button[data-view]')) {
    b.classList.toggle('on', b.dataset.view === name);
  }
}

let searchTerm = '';
let sortMode = 'default';

function costClass(total) {
  if (total < 10) return 'cheap';
  if (total <= 20) return 'mid';
  return 'dear';
}

function renderRecipes() {
  const byId = ingredientsById();
  const el = $('#recipe-list');
  el.innerHTML = '';

  let rows = data.recipes.map((r) => ({ r, c: recipeCost(r, linesFor(r.id), byId) }));

  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    rows = rows.filter(({ r }) => String(r.name).toLowerCase().includes(q));
  }

  const sorters = {
    'cost-asc': (a, b) => a.c.total - b.c.total,
    'cost-desc': (a, b) => b.c.total - a.c.total,
    'buy-desc': (a, b) => b.c.toBuy - a.c.toBuy,
    name: (a, b) => String(a.r.name).localeCompare(String(b.r.name)),
  };
  if (sorters[sortMode]) rows.sort(sorters[sortMode]);

  if (!rows.length) {
    el.innerHTML = '<p class="empty">No recipes match.</p>';
    return;
  }

  for (const { r, c } of rows) {
    const row = document.createElement('button');
    row.className = 'recipe-row';
    row.innerHTML = `
      <span>
        <span class="name">${r.name}${c.incomplete ? ' ⚠️' : ''}</span>
        <span class="sub">${linesFor(r.id).length} ingredients${r.servings ? ' · ' + r.servings + ' serves' : ''}</span>
      </span>
      <span class="price">
        <span class="total ${costClass(c.total)}">${aud(c.total)}</span>
        ${c.toBuy < c.total ? `<span class="to-buy">${aud(c.toBuy)} to buy</span>` : ''}
      </span>`;
    row.addEventListener('click', () => renderDetail(r));
    el.appendChild(row);
  }
}

function renderDetail(recipe) {
  const byId = ingredientsById();
  const lines = linesFor(recipe.id);
  const c = recipeCost(recipe, lines, byId);
  $('#dname').textContent = recipe.name;
  $('#dtotal').textContent = aud(c.total);
  $('#dserve').textContent = c.perServe === null ? '—' : aud(c.perServe);
  $('#dbuy').textContent = aud(c.toBuy);
  $('#dwarn').classList.toggle('hidden', !c.incomplete);

  const ul = $('#dlines');
  ul.innerHTML = '';
  for (const line of lines) {
    const ing = byId[line.ingredient_id];
    const cost = lineCost(line, ing);
    const owned = isInPantry(ing);
    const li = document.createElement('div');
    li.className = 'li' + (owned ? ' owned' : '');
    li.innerHTML = `
      <span><span class="lname">${ing ? ing.name : '?'}</span><span class="q">${line.quantity} ${line.unit}</span>${owned ? '<span class="check">✓ pantry</span>' : ''}</span>
      <span class="lcost">${owned ? '—' : cost === null ? 'unpriced' : aud(cost)}</span>`;
    ul.appendChild(li);
  }
  $('#detail').classList.add('show');
  $('#detail').setAttribute('aria-hidden', 'false');
}

function hideDetail() {
  $('#detail').classList.remove('show');
  $('#detail').setAttribute('aria-hidden', 'true');
}

function renderPantry() {
  const el = $('#view-pantry');
  el.innerHTML = '<h2>Pantry — tick what you already have</h2>';
  const sorted = [...data.ingredients].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  for (const ing of sorted) {
    const label = document.createElement('label');
    label.className = 'pantry-row' + (isInPantry(ing) ? ' on' : '');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isInPantry(ing);
    cb.addEventListener('change', async () => {
      const want = cb.checked;
      cb.disabled = true;
      try {
        await setPantry(ing.id, want);
        ing.in_pantry = want ? 'TRUE' : 'FALSE';
        label.classList.toggle('on', want);
        renderRecipes();
      } catch (err) {
        cb.checked = !want;
        setStatus('Pantry update failed — retry');
        setTimeout(() => setStatus(''), 3000);
      } finally {
        cb.disabled = false;
      }
    });
    label.appendChild(cb);
    label.append(` ${ing.name}`);
    el.appendChild(label);
  }
}

function renderAll() {
  renderRecipes();
  renderPantry();
  const avg = data.recipes.length
    ? data.recipes.reduce((s, r) => s + recipeCost(r, linesFor(r.id), ingredientsById()).total, 0) / data.recipes.length
    : 0;
  const inPantry = data.ingredients.filter(isInPantry).length;
  $('#subtitle').textContent = `${data.recipes.length} recipes · avg ${aud(avg)} · ${inPantry} in pantry`;
}

async function load({ refresh } = {}) {
  if (!refresh) {
    const cached = cachedData();
    if (cached) {
      data = cached.data;
      renderAll();
      setStatus('cached — refreshing…');
    }
  }
  try {
    data = await fetchData();
    setStatus('');
    renderAll();
  } catch (err) {
    if (data) setStatus('offline — showing cached data');
    else setStatus('offline — no cached data yet');
  }
}

for (const b of document.querySelectorAll('nav button[data-view]')) {
  b.addEventListener('click', () => showView(b.dataset.view));
}
$('#refresh').addEventListener('click', () => load({ refresh: true }));
$('#back').addEventListener('click', hideDetail);
$('#search').addEventListener('input', (e) => { searchTerm = e.target.value; renderRecipes(); });
$('#sort').addEventListener('change', (e) => { sortMode = e.target.value; renderRecipes(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
load();
