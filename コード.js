// Webアプリのエントリポイント。ブラウザからのGETリクエストに対して index.html を1枚返すだけ。
// （ルーティングは無く、画面遷移はすべてクライアント側のReactが担う）
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle('にほんごずかん');
}

// フロントエンド(index.html)が実際に使用する列だけを公開する。
// スプレッドシートに内部用の列が追加されても、ここに無ければ公開Webアプリのレスポンスに含まれない。
const PUBLIC_FIELDS = ['unitId', 'unitRuby', 'orderNo', 'id', 'isKanji', 'meaning', 'ruby', 'text', 'word', 'furigana', 'type'];

// クライアント（index.html）から google.script.run 経由で呼ばれる唯一のデータAPI。
// バインドされたスプレッドシートのうち、シート名に「年生」を含むシートだけを走査し、
// 1行目をヘッダーとして PUBLIC_FIELDS にある列だけをオブジェクト化して全行を1つの配列で返す。
// 返却する各要素には、どのシート（学年）由来かを示す grade を付与する。
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
