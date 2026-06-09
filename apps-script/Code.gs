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

// ---------------------------------------------------------------------------
// ONE-TIME maintenance (09/06/2026): merge duplicate ingredients and rename one.
// Repoints RecipeIngredients to the keeper, collapses lines that become
// duplicated within a recipe, then deletes the merged ingredient rows.
// Run from the editor: select mergeIngredients → Run. Idempotent-ish (re-running
// is a no-op once the dup ids are gone).
// ---------------------------------------------------------------------------
function mergeIngredients() {
  const MERGES = {   // dup id -> keeper id
    i166: 'i154',    // pita pocket -> pita bread
    i46: 'i58',      // sea salt -> salt
    i77: 'i37',      // brown onion -> onion
    i40: 'i111',     // baby pickle -> pickle
    i162: 'i30',     // brown rice -> rice
    i54: 'i38',      // lime juice -> lime
    i39: 'i139',     // chicken tender -> chicken
    i96: 'i139',     // chicken strip -> chicken
    i105: 'i139',    // chick'n -> chicken
    i128: 'i139',    // crumbed chicken -> chicken
  };
  const RENAMES = { i186: 'liquid stock' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Repoint RecipeIngredients.ingredient_id from dup -> keeper.
  const ri = ss.getSheetByName('RecipeIngredients');
  const riVals = ri.getDataRange().getValues();
  const riHead = riVals[0];
  const ingCol = riHead.indexOf('ingredient_id');
  const recCol = riHead.indexOf('recipe_id');
  for (let r = 1; r < riVals.length; r++) {
    const cur = String(riVals[r][ingCol]);
    if (MERGES[cur]) riVals[r][ingCol] = MERGES[cur];
  }
  ri.getRange(1, 1, riVals.length, riHead.length).setValues(riVals);

  // 2. Collapse rows that are now duplicate (same recipe_id + ingredient_id).
  let dupesRemoved = 0;
  const seen = {};
  for (let r = riVals.length - 1; r >= 1; r--) {
    const key = String(riVals[r][recCol]) + '|' + String(riVals[r][ingCol]);
    if (seen[key]) { ri.deleteRow(r + 1); dupesRemoved++; }
    else seen[key] = true;
  }

  // 3. Rename ingredients.
  const ing = ss.getSheetByName('Ingredients');
  const ingVals = ing.getDataRange().getValues();
  const idCol = ingVals[0].indexOf('id');
  const nameCol = ingVals[0].indexOf('name');
  for (let r = 1; r < ingVals.length; r++) {
    const nm = RENAMES[String(ingVals[r][idCol])];
    if (nm) ing.getRange(r + 1, nameCol + 1).setValue(nm);
  }

  // 4. Delete the merged-away ingredient rows.
  const dupIds = Object.keys(MERGES);
  const ingredientsRemoved = deleteRowsWhere(ss, 'Ingredients', 'id', (v) => dupIds.indexOf(String(v)) !== -1);

  const result = { ingredientsRemoved, dupeLinesCollapsed: dupesRemoved, renamed: Object.keys(RENAMES).length };
  Logger.log('Merge done ' + JSON.stringify(result));
  return result;
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
