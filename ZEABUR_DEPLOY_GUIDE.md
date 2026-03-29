# ☁️ Omniscreen Zeabur 雲端部屬指南 (新手版)

這份指南將帶領你使用 **Zeabur** 平台，將 Omniscreen 從你的電腦搬到雲端，讓全世界的螢幕都能透過網路抓取到你的內容。

---

## 🏗️ 雲端架構概覽

在雲端上，我們會建立四個服務（Service）：
1. **PostgreSQL**: 存放排程、播放清單等資料的資料庫。
2. **MinIO**: 存放圖片、影片等檔案的儲存空間。
3. **Backend**: 處理邏輯、與資料庫溝通的後端程式（位於 `/backend` 資料夾）。
4. **Frontend**: 給你看的管理後台（位於 `/frontend` 資料夾）。

---

## 📝 第一步：將程式碼上傳至 GitHub

Zeabur 會從 GitHub 抓取你的最新程式碼來部署。
1. 在 GitHub 建立一個新的專案（Repository），命名為 `omniscreen`。
2. 將你電腦上的程式碼 Push 到這個 GitHub 專案中。
   * *(如果你還不會用 Git，建議先搜尋「GitHub Desktop 教學」使用視覺化操作)*

---

## 🚀 第二步：在 Zeabur 建立專案與資料庫

1. 登入 [Zeabur 控制台](https://zeabur.com/)。
2. 點擊 **"Create Project"**。
3. **建立資料庫**：
   * 點擊 **"Deploy Service"** -> **"Marketplace"** -> 搜尋並選擇 **"PostgreSQL"**。
4. **建立儲存空間**：
   * 點擊 **"Deploy Service"** -> **"Marketplace"** -> 搜尋並選擇 **"MinIO"**。
   * *部署後，進入 MinIO 的 "Networking" 分頁，設定一個公網域名（例如 `my-minio.zeabur.app`）並設定 Port 9000。*

---

## ⚙️ 第三步：部屬後端 (Backend)

1. 點擊 **"Deploy Service"** -> **"GitHub"** -> 選擇你的 `omniscreen` 專案。
2. **關鍵設定 (Root Directory)**：
   * 部署後點擊進入後端服務 -> **"Settings"** -> **"Root Directory"**，輸入 `/backend`。
3. **設定環境變數 (Variables)**：
   * 在後端服務的 **"Variables"** 分頁加入以下內容：
     * `DATABASE_URL`: 點擊右側的 "Add from other service" 選擇 PostgreSQL 的連結字串。
     * `MINIO_ENDPOINT`: 輸入剛才設定的 MinIO 網址（例如 `https://my-minio.zeabur.app`）。
     * `MINIO_ACCESS_KEY`: `minioadmin` (除非你有改)。
     * `MINIO_SECRET_KEY`: `minioadmin`。
     * `MINIO_BUCKET_NAME`: `omniscreen-assets`。
     * `JWT_SECRET`: 隨便輸入一串亂碼（用於加密連線）。
     * `CMS_USER`: 設定您的管理後台帳號 (例如 `admin`)。
     * `CMS_PASS`: 設定您的管理後台密碼 (例如 `omniscreen2024`)。
     * `LINE_CHANNEL_TOKEN`: (選填) 若需要斷線通知才設定。
     * `LINE_USER_ID`: (選填) 若需要斷線通知才設定。

---

## 🎨 第四步：部屬前端 (Frontend)

1. 再次點擊 **"Deploy Service"** -> **"GitHub"** -> 選擇同一個 `omniscreen` 專案。
2. **關鍵設定 (Root Directory)**：
   * 點擊進入前端服務 -> **"Settings"** -> **"Root Directory"**，輸入 `/frontend`。
3. **設定環境變數 (Variables)**：
   * 在前端服務的 **"Variables"** 分頁加入：
     * `NEXT_PUBLIC_API_URL`: 輸入**後端服務**自動生成的域名（例如 `https://omniscreen-backend.zeabur.app/api`）。
4. **建立前端網址**：
   * 在前端服務的 **"Networking"** 分頁，點擊 **"Generate Domain"**，這就是你日後登入後台的網址！

---

## ✅ 第五步：驗證

1. 等待所有服務顯示 **"Running"**。
2. 打開前端生成的網址。
3. 嘗試上傳一張圖片，看看圖片是否能成功顯示（這代表後端與 MinIO 連線正常）。

---

## 💡 常見問題

### 1. 為什麼我的圖片上傳後看不到？
請確保 MinIO 的 **Bucket (omniscreen-assets)** 權限已經在 MinIO 控制台改為 **"Public" (公開)**，否則瀏覽器會被擋掉。

### 2. 資料庫需要手動建立資料表嗎？
不用！我們的後端在啟動時會自動執行 `npx prisma db push`，Zeabur 會幫你把資料表建好。

---

👉 回到本地部屬指南：[LOCAL_DEPLOY_GUIDE.md](./LOCAL_DEPLOY_GUIDE.md)
