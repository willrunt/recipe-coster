import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineCost, packCost, recipeCost, isInPantry } from '../js/costs.js';

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

test('packCost: whole pack price, null when unpriced', () => {
  assert.equal(packCost(flour), 1.6);
  assert.equal(packCost(mystery), null);
  assert.equal(packCost(undefined), null);
});

test('recipeCost: total pro-rates all, toBuy = whole packs of non-pantry', () => {
  const recipe = { id: 'r1', servings: 4 };
  const lines = [
    { recipe_id: 'r1', ingredient_id: 'i1', quantity: 500 }, // flour, not pantry: consumed 0.80, pack 1.60
    { recipe_id: 'r1', ingredient_id: 'i2', quantity: 75 },  // oil, pantry: consumed 0.90, excluded from toBuy
  ];
  const c = recipeCost(recipe, lines, byId);
  assert.equal(c.total, 1.7);   // pro-rated value of all consumed (incl. pantry)
  assert.equal(c.toBuy, 1.6);   // one whole flour pack; oil owned → skipped
  assert.equal(c.perServe, 0.425);
  assert.equal(c.incomplete, false);
});

test('recipeCost: unpriced line marks incomplete; whole-pack toBuy skips it', () => {
  const c = recipeCost({ id: 'r1', servings: 2 }, [
    { recipe_id: 'r1', ingredient_id: 'i1', quantity: 1000 }, // flour: consumed 1.60, pack 1.60
    { recipe_id: 'r1', ingredient_id: 'i3', quantity: 1 },    // saffron: unpriced
  ], byId);
  assert.equal(c.total, 1.6);
  assert.equal(c.toBuy, 1.6);   // flour pack only; saffron unpriced
  assert.equal(c.incomplete, true);
});

test('recipeCost: toBuy is whole pack regardless of quantity used', () => {
  // 60ml soy from a 500ml bottle still costs one whole bottle to buy
  const soy = { id: 's', name: 'soy sauce', unit: 'ml', price_aud: 3, pack_size: 500, in_pantry: false };
  const c = recipeCost({ id: 'r9', servings: 1 }, [
    { recipe_id: 'r9', ingredient_id: 's', quantity: 60 },
  ], { s: soy });
  assert.equal(c.toBuy, 3);                 // whole bottle
  assert.equal(c.total, 0.36);              // 60/500 * 3 consumed
});

test('recipeCost: missing servings gives null perServe', () => {
  const c = recipeCost({ id: 'r1', servings: '' }, [
    { recipe_id: 'r1', ingredient_id: 'i1', quantity: 1000 },
  ], byId);
  assert.equal(c.perServe, null);
});
