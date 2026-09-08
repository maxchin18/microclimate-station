const SHEET_NAME = '感測資料';
const MAX_ROWS = 50000;

/** 第一次貼上程式後手動執行一次，建立工作表與裝置金鑰。 */
function setupStation() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = book.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['時間', '裝置', '溫度 °C', '相對溼度 %', 'Wi-Fi RSSI dBm', '電池 V']);
    sheet.setFrozenRows(1);
  }
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('SPREADSHEET_ID', book.getId());
  let apiKey = properties.getProperty('DEVICE_API_KEY');
  if (!apiKey) {
    apiKey = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    properties.setProperty('DEVICE_API_KEY', apiKey);
  }
  console.log('裝置金鑰（請貼到 ESP8266 程式）：' + apiKey);
  return apiKey;
}

/** ESP8266 以 HTTPS POST JSON 呼叫此函式。 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const expectedKey = PropertiesService.getScriptProperties().getProperty('DEVICE_API_KEY');
    if (!expectedKey || data.api_key !== expectedKey) return json_({ok: false, error: 'UNAUTHORIZED'});

    const temperature = Number(data.temperature);
    const humidity = Number(data.humidity);
    if (!Number.isFinite(temperature) || temperature < -40 || temperature > 125 ||
        !Number.isFinite(humidity) || humidity < 0 || humidity > 100) {
      return json_({ok: false, error: 'INVALID_SAMPLE'});
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = getSheet_();
      sheet.appendRow([
        new Date(), String(data.device_id || 'esp8266-01').slice(0, 64),
        temperature, humidity,
        data.rssi == null ? '' : Number(data.rssi),
        data.battery == null ? '' : Number(data.battery)
      ]);
      if (sheet.getLastRow() > MAX_ROWS + 1) sheet.deleteRows(2, 1000);
    } finally {
      lock.releaseLock();
    }
    return json_({ok: true, saved_at: new Date().toISOString()});
  } catch (error) {
    return json_({ok: false, error: 'BAD_REQUEST'});
  }
}

/** 瀏覽部署網址可檢查服務，?format=json 會取得最近 1,440 筆資料。 */
function doGet(e) {
  if (!e || e.parameter.format !== 'json') {
    return ContentService.createTextOutput('微氣候觀測站 Google 接收服務運作中');
  }
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return json_({ok: true, history: []});
  const start = Math.max(2, lastRow - 1439);
  const rows = sheet.getRange(start, 1, lastRow - start + 1, 6).getValues();
  return json_({
    ok: true,
    history: rows.map(row => ({
      timestamp: row[0] instanceof Date ? row[0].toISOString() : row[0],
      device_id: row[1], temperature: row[2], humidity: row[3],
      rssi: row[4], battery: row[5]
    }))
  }, e.parameter.callback);
}

function getSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('請先執行 setupStation');
  return SpreadsheetApp.openById(id).getSheetByName(SHEET_NAME);
}

function json_(value, callback) {
  const json = JSON.stringify(value);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
