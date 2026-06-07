import { API_URL, API_TOKEN } from './config.js';

const CACHE_KEY = 'recipe-coster-data';

export async function fetchData() {
  const res = await fetch(`${API_URL}?token=${API_TOKEN}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  return data;
}

export function cachedData() {
  const raw = localStorage.getItem(CACHE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function setPantry(ingredientId, inPantry) {
  // text/plain avoids CORS preflight; Apps Script can't answer OPTIONS.
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ token: API_TOKEN, ingredientId, inPantry }),
  });
  const out = await res.json();
  if (!out.ok) throw new Error(out.error || 'write failed');
}
