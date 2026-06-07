const AnyList = require('anylist');
const fs = require('fs');
const readline = require('readline');

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      rl._writeToOutput = (s) => {
        rl.output.write(s.includes(question) ? question : '*');
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function main() {
  const email = process.env.ANYLIST_EMAIL || (await ask('AnyList email: '));
  const password = process.env.ANYLIST_PASSWORD || (await ask('AnyList password: ', { hidden: true }));
  if (!email || !password) throw new Error('Email and password are required');

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
