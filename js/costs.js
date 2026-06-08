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

// Cost to BUY one whole pack of an ingredient (you can't buy 60ml of soy sauce
// — you buy the bottle). Independent of recipe quantity.
export function packCost(ing) {
  if (!ing) return null;
  const price = Number(ing.price_aud);
  if (ing.price_aud === '' || !Number.isFinite(price) || price < 0) return null;
  return price;
}

export function recipeCost(recipe, lines, ingredientsById) {
  let total = 0;   // pro-rated value of all ingredients consumed
  let toBuy = 0;   // whole packs of the ingredients you don't already have
  let incomplete = false;
  for (const line of lines) {
    const ing = ingredientsById[line.ingredient_id];
    const consumed = lineCost(line, ing);
    if (consumed === null) {
      incomplete = true;
    } else {
      total += consumed;
    }
    if (!isInPantry(ing)) {
      const pack = packCost(ing);
      if (pack === null) incomplete = true;
      else toBuy += pack;
    }
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
