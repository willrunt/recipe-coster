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
