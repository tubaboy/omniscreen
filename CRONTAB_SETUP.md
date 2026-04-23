# Omniscreen 自動化排程設定指南

本專案使用 Linux 標準的 `cron` 工具來實現看板系統的定時開關機。

## 1. 準備腳本
請確保以下腳本位於同一目錄下（建議路徑：`/home/david/project/omniscreen/`）：
*   `start_kiosk.sh`: 負責啟動 btop 與 Chromium。
*   `stop_kiosk.sh`: 負責關閉所有相關程式。

給予執行權限：
```bash
chmod +x start_kiosk.sh stop_kiosk.sh
```

## 2. 設定 Crontab
執行以下指令進入編輯模式：
```bash
crontab -e
```

將以下內容貼到檔案末端（**請務必根據你的實際使用者目錄修改路徑**）：

```cron
# [啟動] 週一至週五 08:30
30 8 * * 1-5 /home/david/project/omniscreen/start_kiosk.sh > /tmp/kiosk_start.log 2>&1
# [啟動] 週六 09:00
0 9 * * 6 /home/david/project/omniscreen/start_kiosk.sh > /tmp/kiosk_start.log 2>&1

# [關閉] 週一至週五 16:00
0 16 * * 1-5 /home/david/project/omniscreen/stop_kiosk.sh > /tmp/kiosk_stop.log 2>&1
# [關閉] 週六 15:00
0 15 * * 6 /home/david/project/omniscreen/stop_kiosk.sh > /tmp/kiosk_stop.log 2>&1
```

## 3. 注意事項
*   **DISPLAY 變數**：`start_kiosk.sh` 內部已包含 `export DISPLAY=:0`，這是讓指令能在圖形介面執行的關鍵。
*   **日誌檢查**：如果腳本沒有如期執行，可以查看 `/tmp/kiosk_start.log` 獲取錯誤資訊。
*   **路徑環境**：在 Crontab 中，建議一律使用 **絕對路徑**。

## 4. (進階) 配合硬體自動開機
若要實現「通電即開機」，請執行以下指令後，再搭配智慧插座設定 08:25 通電：
```bash
sudo setpci -s 00:1f.0 0xa4.b=0
```
