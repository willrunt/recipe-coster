import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineCost, recipeCost, isInPantry } from '../js/costs.js';

const flour = { id: 'i1', name: 'plain flour', unit: 'g', price_aud: 1.6, pack_size: 1000, in_pantry: false };
const oil = { id: 'i2', name: 'olive oil', unit: 'ml', price_aud: 9, pack_size: 750, in_pantry: true };
const mystery = { id: 'i3', name: 'saffron', unit: 'g', price_aud: '', pack_size: '', in_pantry: false };
const byId = { i1: flour, i2: oil, i3: mystery };

test('lineCost: pro-rates pack price', () => {
  assert.equal(lineCost({ ingredient_id: 'i1', quantity: 500 }, flour), 0.8);
});

test('lineCost: missing price/pack_size returns null', () => {
  assert.equal(lineCost({ ingredient_id: 'i3', quantity: 1 }, mystery), null);
  assert.equal(lineCost({ ingredient_id: 'i1', quantity: 500 }, undefined), null);
});

test('lineCost: non-numeric quantity returns null', () => {
  assert.equal(lineCost({ ingredient_id: 'i1', quantity: 'a pinch' }, flour), null);
});

test('isInPantry: handles boolean true and sheet-string TRUE', () => {
  assert.equal(isInPantry(oil), true);
  assert.equal(isInPantry({ ...oil, in_pantry: 'TRUE' }), true);
  assert.equal(isInPantry(flour), false);
});

test('recipeCost: total, toBuy excludes pantry, perServe', () => {
  const recipe = { id: 'r1', servings: 4 };
  const lines = [
    { recipe_id: 'r1', ingredient_id: 'i1', quantity: 500 },
    { recipe_id: 'r1', ingredient_id: 'i2', quantity: 75 },
  ];
  const c = recipeCost(recipe, lines, byId);
  assert.equal(c.total, 1.7);
  assert.equal(c.toBuy, 0.8);
  assert.equal(c.perServe, 0.425);
  assert.equal(c.incomplete, false);
});

test('recipeCost: unpriced line marks incomplete, excluded from totals', () => {
  const c = recipeCost({ id: 'r1', servings: 2 }, [
    { recipe_id: 'r1', ingredient_id: 'i1', quantity: 1000 },
    { recipe_id: 'r1', ingredient_id: 'i3', quantity: 1 },
  ], byId);
  assert.equal(c.total, 1.6);
  assert.equal(c.incomplete, true);
});

test('recipeCost: missing servings gives null perServe', () => {
  const c = recipeCost({ id: 'r1', servings: '' }, [
    { recipe_id: 'r1', ingredient_id: 'i1', quantity: 1000 },
  ], byId);
  assert.equal(c.perServe, null);
});
