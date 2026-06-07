export function isInPantry(ing) {
  return ing?.in_pantry === true || ing?.in_pantry === 'TRUE';
}

export function lineCost(line, ing) {
  const quantity = Number(line.quantity);
  const pack = Number(ing?.pack_size);
  const price = Number(ing?.price_aud);
  if (!ing) return null;
  if (line.quantity === '' || ing.pack_size === '' || ing.price_aud === '') return null;
  if (!Number.isFinite(quantity) || !(pack > 0) || !(price >= 0)) return null;
  return (quantity / pack) * price;
}

export function recipeCost(recipe, lines, ingredientsById) {
  let total = 0;
  let toBuy = 0;
  let incomplete = false;
  for (const line of lines) {
    const ing = ingredientsById[line.ingredient_id];
    const cost = lineCost(line, ing);
    if (cost === null) {
      incomplete = true;
      continue;
    }
    total += cost;
    if (!isInPantry(ing)) toBuy += cost;
  }
  const servings = Number(recipe.servings);
  const round = (n) => Math.round(n * 1e9) / 1e9;
  return {
    total: round(total),
    toBuy: round(toBuy),
    incomplete,
    perServe: servings > 0 ? round(total / servings) : null,
  };
}
