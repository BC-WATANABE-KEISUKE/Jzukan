function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle('にほんごずかん');
}

// フロントエンド(index.html)が実際に使用する列だけを公開する。
// スプレッドシートに内部用の列が追加されても、ここに無ければ公開Webアプリのレスポンスに含まれない。
const PUBLIC_FIELDS = ['unitId', 'unitRuby', 'orderNo', 'id', 'isKanji', 'meaning', 'ruby', 'text', 'word', 'furigana', 'type'];

function getSheetData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  let allData = [];

  sheets.forEach(sheet => {
    const sheetName = sheet.getName().trim();
    if (sheetName.includes('年生')) {
      const rows = sheet.getDataRange().getValues();
      if (rows.length > 1) {
        const headers = rows[0].map(h => String(h).trim());
        const sheetData = rows.slice(1).map(row => {
          const obj = { grade: sheetName };
          headers.forEach((header, i) => {
            if (!header || PUBLIC_FIELDS.indexOf(header) === -1) return;
            obj[header] = row[i];
          });
          return obj;
        });
        allData = allData.concat(sheetData);
      }
    }
  });
  return allData;
}
