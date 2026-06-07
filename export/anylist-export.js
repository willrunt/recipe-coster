const AnyList = require('anylist');
const fs = require('fs');

async function main() {
  const { ANYLIST_EMAIL: email, ANYLIST_PASSWORD: password } = process.env;
  if (!email || !password) throw new Error('Set ANYLIST_EMAIL and ANYLIST_PASSWORD env vars');

  const client = new AnyList({ email, password });
  await client.login();

  const recipes = await client.getRecipes();
  const out = recipes.map((r) => ({
    name: r.name,
    servings: r.servings ?? null,
    note: r.note ?? '',
    ingredients: (r.ingredients || []).map((i) => ({
      raw: i.rawIngredient ?? '',
      name: i.name ?? '',
      quantity: i.quantity ?? '',
      note: i.note ?? '',
    })),
  }));

  fs.writeFileSync(`${__dirname}/raw-recipes.json`, JSON.stringify(out, null, 2));
  console.log(`Exported ${out.length} recipes to raw-recipes.json`);
  client.teardown();
}

main().catch((err) => { console.error(err); process.exit(1); });
