// Deployed from the Recipe Coster sheet: Extensions → Apps Script.
// Web app settings: Execute as ME, access: ANYONE. Token + unguessable URL = access control.
const TOKEN = 'REPLACE_WITH_LONG_RANDOM_STRING';

function doGet(e) {
  if (!e || !e.parameter || e.parameter.token !== TOKEN) return json({ error: 'unauthorised' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return json({
    recipes: tabToObjects(ss, 'Recipes'),
    ingredients: tabToObjects(ss, 'Ingredients'),
    recipeIngredients: tabToObjects(ss, 'RecipeIngredients'),
  });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json({ error: 'bad json' }); }
  if (body.token !== TOKEN) return json({ error: 'unauthorised' });

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ingredients');
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const idCol = header.indexOf('id');
  const pantryCol = header.indexOf('in_pantry');
  if (idCol === -1 || pantryCol === -1) return json({ error: 'sheet missing id/in_pantry columns' });

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(body.ingredientId)) {
      sheet.getRange(r + 1, pantryCol + 1).setValue(body.inPantry === true);
      return json({ ok: true });
    }
  }
  return json({ error: 'ingredient not found' });
}

function tabToObjects(ss, name) {
  const values = ss.getSheetByName(name).getDataRange().getValues();
  const header = values[0];
  return values
    .slice(1)
    .filter((row) => row[0] !== '')
    .map((row) => Object.fromEntries(header.map((h, i) => [h, row[i]])));
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// ONE-TIME maintenance (09/06/2026): delete 6 recipes, their RecipeIngredients
// rows, and any ingredient used ONLY by those recipes. Run from the editor:
// select cleanupRecipes → Run. Re-running is safe (already-gone names are skipped).
// ---------------------------------------------------------------------------
function cleanupRecipes() {
  const NAMES = [
    'Marry Me Tofu', 'Breakfast Muffins', 'Rice Bowls Don',
    'Vanilla Orange Blossom Syrup', 'Sandwich', 'Kastu sando',
  ];
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const recipes = tabToObjects(ss, 'Recipes');
  const ri = tabToObjects(ss, 'RecipeIngredients');

  const delRecipeIds = new Set(
    recipes.filter((r) => NAMES.indexOf(r.name) !== -1).map((r) => String(r.id))
  );

  // ingredients used only by the deleted recipes = orphans
  const bySurvivor = new Set();
  const byDeleted = new Set();
  ri.forEach((l) => {
    (delRecipeIds.has(String(l.recipe_id)) ? byDeleted : bySurvivor).add(String(l.ingredient_id));
  });
  const orphanIds = new Set([...byDeleted].filter((id) => !bySurvivor.has(id)));

  const removed = {
    recipes: deleteRowsWhere(ss, 'Recipes', 'id', (v) => delRecipeIds.has(String(v))),
    recipeIngredients: deleteRowsWhere(ss, 'RecipeIngredients', 'recipe_id', (v) => delRecipeIds.has(String(v))),
    ingredients: deleteRowsWhere(ss, 'Ingredients', 'id', (v) => orphanIds.has(String(v))),
  };
  Logger.log('Deleted ' + JSON.stringify(removed));
  return removed;
}

// Delete every data row in a tab whose value in `colName` passes `match`.
// Walks bottom-up so row indices don't shift during deletion.
function deleteRowsWhere(ss, tabName, colName, match) {
  const sheet = ss.getSheetByName(tabName);
  const data = sheet.getDataRange().getValues();
  const col = data[0].indexOf(colName);
  if (col === -1) throw new Error(tabName + ' has no ' + colName + ' column');
  let count = 0;
  for (let r = data.length - 1; r >= 1; r--) {
    if (match(data[r][col])) {
      sheet.deleteRow(r + 1);
      count++;
    }
  }
  return count;
}
