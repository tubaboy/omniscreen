# OmniScreen 備份與還原指南

為了防止資料遺失，我們建立了一套自動化備份系統。本指南將教您如何設定並維護這套系統。

## 1. 快速開始 (手動測試)

首先，進入項目目錄並為腳本賦予執行權限：

```bash
chmod +x scripts/backup.sh scripts/restore.sh
```

執行一次手動備份測試：

```bash
./scripts/backup.sh
```

備份檔案會存放在 `~/omniscreen_backups` 目錄下。

---

## 2. 設定自動定時備份 (Crontab)

強烈建議設定**每日備份**。請執行：

```bash
crontab -e
```

在檔案末尾加入以下這行（每天凌晨 03:00 自動執行備份）：

```cron
0 3 * * * /bin/bash /路徑/到/您的/項目/scripts/backup.sh >> /home/david/backup.log 2>&1
```

*(請記得將 `/路徑/到/您的/項目/` 替換為實際路徑)*

---

## 3. 災難還原流程

如果發生資料遺失，請找到您想還原的日期目錄：

```bash
# 列出所有備份
ls ~/omniscreen_backups

# 執行還原 (以 20260415 為例)
./scripts/restore.sh ~/omniscreen_backups/20260415_030000
```

還原完成後，執行 `docker compose restart` 即可。

---

## 4. 最佳實踐與安全建議

### 4.1 異地備份 (遠端同步)
目前的備份是存在本機磁碟。如果「整個伺服器」壞了，備份也會遺失。建議您使用 `rclone` 或 `rsync` 定時將備份目錄同步到：
*   另一台電腦
*   Google Drive / Dropbox / S3
*   您的外部 NAS

### 4.2 不要依賴 `--accept-data-loss`
我們已經將 `package.json` 中的這個危險參數移除。未來如果您修改了資料庫欄位，請：
1. 先執行 `./scripts/backup.sh`。
2. 使用 `npx prisma migrate dev` 或 `prisma db push` 並仔細閱讀終端提示。

---

> [!IMPORTANT]
> **定期檢查備份有效性**
> 每個月檢查一次備份目錄，確保 SQL 檔案不是空的 (0 KB)，這能保證在真正需要時備份是可用的。
