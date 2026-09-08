# 微氣候觀測站

NodeMCU ESP8266 + DHT11 溫溼度監測站。支援兩種模式：USB 連接電腦即時監測，以及定時透過 Wi-Fi 上傳 Google 試算表並由 GitHub Pages 顯示雲端面板。

## 雲端架構

```text
ESP8266 → Google Apps Script → Google 試算表 → GitHub Pages 圓形儀表
```

- `google-apps-script/Code.gs`：Google 試算表接收及查詢 API。
- `firmware/dht_google_upload/`：保持 Wi-Fi 連線並每分鐘上傳的 ESP8266 韌體。
- `docs/`：可直接發布至 GitHub Pages 的圓形指針面板。
- `firmware/dht_google_upload/secrets.local.h`：本機 Wi-Fi、部署網址及裝置金鑰；已排除 Git 追蹤。

先依照 [Google 設定步驟](google-apps-script/設定步驟.md)部署 Apps Script。取得 `/exec` 網址與裝置金鑰後，填入本機 `secrets.local.h`，並將 `/exec` 網址填入 `docs/index.html` 的 `GOOGLE_SCRIPT_URL`。

目前雲端韌體不使用深度睡眠，因此不需要連接 D0 與 RST。NodeMCU 會保持開機並每 60 秒上傳一次，適合 USB 或穩定外接電源；使用電池時的續航會比深度睡眠模式短。

## USB 本機模式

## 接線

請先拔除 USB 電源，再依感應器模組的標示確認接線，勿僅依線材顏色判斷。

| DHT11 模組 | NodeMCU |
| --- | --- |
| S / DATA 訊號 | D5（GPIO14） |
| + / VCC | 3V3 |
| − / GND | GND |

## 使用 VS Code

1. 用 VS Code 開啟這個資料夾。
2. 按 `Ctrl+Shift+B`：編譯韌體，不必接上開發板。
3. 備妥 **Micro-USB 資料傳輸線**，接上開發板。
4. 選「終端機 → 執行工作」→「上傳 DHT11 韌體」，或雙擊 `上傳感應器程式.cmd`。上傳會取代板上原有程式。
5. 執行「啟動溫溼度監測畫面」，或雙擊 `開啟監測.cmd`。
6. 開啟 http://127.0.0.1:8765 ，等待約 5–10 秒出現第一筆讀值。

每 2.5 秒量測一次。USB 拔除後顯示離線，插回後自動重試連接。不會產生模擬數值。服務僅監聽本機 127.0.0.1。

圓形指針儀表顯示溫度（0–50 °C）與相對溼度（0–100%），並保留精確數字。離線或資料超過 10 秒未更新時隱藏指針。

圖表顯示最近 10 分鐘；記憶體最多保留本次執行最近 1,440 筆，約一小時。關閉網頁不會停止背景接收；雙擊 `停止監測.cmd` 可停止服務。停止服務或重新啟動電腦後資料不保留，請用 CSV 匯出保存。CSV 時間使用 UTC ISO 格式。

## 連線問題

- 完全找不到 USB 連接埠：先確認線材能傳資料，再看 Windows 裝置管理員；依實際 USB 晶片安裝官方驅動，不要只憑照片猜測。
- 多塊板同時連接：在終端機執行 `./scripts/upload.ps1 -Port COM3`，把 COM3 換成實際連接埠。監測可用 tools.local.json 指定的 Python 執行 `monitor.py --port COM3`，先關閉既有監測程序。
- 連接埠被占用：關閉其他串列監控器。此專案上傳時會自動暫停自己的監測服務。
- 已連線但沒有讀值：先上傳本專案韌體；讀取失敗則檢查感應器型號與 D5 / 3V3 / GND。
- 這份韌體設定為照片中的藍色 DHT11；若實物標示為 DHT22，需修改韌體的感應器型別後重新上傳。

## 工具設定

`tools.local.json` 與 `arduino-cli.yaml` 保存本機工具位置。Arduino 套件與編譯快取放在電腦本機，不放雲端硬碟；韌體與網頁原始碼留在本資料夾。

官方參考：[Arduino CLI](https://arduino.github.io/arduino-cli/)、[ESP8266 安裝說明](https://arduino-esp8266.readthedocs.io/en/latest/installing.html)、[Adafruit DHT 函式庫](https://github.com/adafruit/DHT-sensor-library)。

