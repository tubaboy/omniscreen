# 🚀 Omniscreen 本地部屬新手指南 (Step-by-Step)

歡迎使用 Omniscreen！這是一份專為新手設計的詳細指南，幫助你在自己的電腦上成功執行這套系統。請按照以下步驟操作：

---

## 🛠️ 前置準備 (軟體安裝)

在開始之前，請確保你的電腦已經安裝了以下工具：

1.  **Git**: [點此下載安裝](https://git-scm.com/downloads) (用於拉取程式碼)。
2.  **Docker Desktop**: [點此下載安裝](https://www.docker.com/products/docker-desktop/) (用於執行整個系統)。
    *   *注意：安裝後請務必啟動 Docker Desktop，看到左下角呈現綠色（Engine Running）才算成功。*

---

## 📝 第一步：從 GitHub 取得程式碼

打開你的終端機 (Windows 請搜尋 `CMD` 或 `PowerShell`，Mac 則打開 `Terminal`)，並依序輸入以下指令：

1.  **移動到你想要存放專案的資料夾** (例如桌面)：
    ```bash
    cd Desktop
    ```
2.  **拉取最新程式碼**：
    ```bash
    git clone https://github.com/tubaboy/omniscreen.git
    ```
3.  **進入專案資料夾**：
    ```bash
    cd omniscreen
    ```

---

## ⚙️ 第二步：設定環境變數 (.env)

雖然我們已經在系統中預設了基本的設定，但建議手動建立一個 `.env` 檔案以確保穩定性：

1.  在 `omniscreen` 資料夾中，找到 `.env.example` 檔案。
2.  將其**複製**一份，並重新命名為 `.env`。
3.  目前暫時不需要修改內容，預設值即可用於本地測試。

---

## 🚀 第三步：一鍵啟動系統 (Docker)

在終端機中確保你還在 `omniscreen` 資料夾下，然後輸入：

```bash
docker compose up -d --build
```

> **這在做什麼？**
> - `docker compose up`: 啟動設定檔中的所有服務（資料庫、儲存空間、前端、後端）。
> - `-d`: 在背景執行（執行完後你還可以繼續用終端機）。
> - `--build`: 第一次執行或程式碼有更新時，確保重新建置最新的映像。

**等待約 3-5 分鐘**（這取決於你的網路速度，系統正在下載必要的元件）。

---

## 🌐 第四步：存取系統

當所有服務顯示 `Started` 或 `Running` 後，打開你的瀏覽器：

1.  **前台管理介面 (Dashboard)**: [http://localhost:3000](http://localhost:3000)
    *   這是你管理螢幕、內容和排程的地方。
2.  **後端 API 介面**: [http://localhost:3001](http://localhost:3001)
    *   (通常不需要手動存取，除非你要調試)。
3.  **MinIO 儲存管理控制台**: [http://localhost:9001](http://localhost:9001)
    *   **帳號**: `minioadmin`
    *   **密碼**: `minioadmin`
    *   (這裡存放你上傳的所有圖片與影片)。

---

## 🔄 如何更新系統 (Update)

當專案程式碼有新的版本或修復時，請按照以下步驟更新你的本地系統：

1.  **取得最新程式碼**：
    在 `omniscreen` 資料夾中執行：
    ```bash
    git pull
    ```

2.  **重新建置並啟動**：
    確保最新修改被套用：
    ```bash
    docker compose up -d --build
    ```

3.  **同步資料庫結構 (選做)**：
    如果更新內容涉及資料庫欄位更動，請執行：
    ```bash
    docker exec -it omniscreen-backend npx prisma db push
    ```

---

## 🔍 第五步：常見問題與解決

### 1. 登入資訊
如果系統提示需要登入，預設的開發帳號通常如下（若有設定）：
- **帳號**: `admin`
- **密碼**: `omniscreen2024`

### 2. 資料庫出錯？
後端啟動時會自動嘗試初始化資料庫。如果發現資料沒有成功運作，可以嘗試輸入以下指令更新資料庫結構：
```bash
docker exec -it omniscreen-backend npx prisma db push
```

### 3. 如何停止系統？
如果你想暫時關閉系統，輸入：
```bash
docker compose stop
```
若想完整移除容器：
```bash
docker compose down
```

---

祝你使用愉快！如果有任何問題，請隨時詢問。

---
+
+## 🌐 如何讓區網內的其他電腦也能連線？
+
+預設情況下，Omniscreen 只能在「安裝它的那台電腦」上使用 `localhost` 存取。如果你希望店內的其他筆電、平板也能連進來管理，請按照以下步驟設定：
+
+### 1. 找出你的本機 IP
+在安裝系統的電腦上：
+- **Windows**: 打開 CMD 輸入 `ipconfig`，找出 `IPv4 位址` (例如 `192.168.1.107`)。
+- **Mac/Linux**: 打開 Terminal 輸入 `ifconfig` 或 `ip addr`。
+
+### 2. 修改 `.env` 設定檔
+打開專案根目錄的 `.env`，將所有 `localhost` 替換成的你的本機 IP：
+```env
+NEXT_PUBLIC_API_URL=http://192.168.1.107:3001/api
+MINIO_ENDPOINT=http://192.168.1.107:9000
+```
+
+### 3. 重新建置並啟動 (非常重要)
+由於前端網址是在編譯時寫入的，你**必須**執行以下指令重新建置：
+```bash
+docker compose up -d --build
+```
+
+### 4. 從其他裝置存取
+現在，只要在同一台路由器的 WiFi 下，其他裝置就可以透過你的 IP 存取系統：
+- **管理後台**: `http://192.168.1.107:3000`
+- **播放器**: `http://192.168.1.107:3000/player`
+
+---
+
 ## 🎓 進階應用：要把這台電腦直接當成螢幕播放器？

如果你這台電腦就是要接上電視當成播放端（電子看板），我們建議使用 **Kiosk Mode**，讓它開機就自動進入全螢幕播放狀態。

👉 請參考：[實體螢幕播放器設定指南 (KIOSK_SETUP_GUIDE.md)](./KIOSK_SETUP_GUIDE.md)

---

## ☁️ 想要換成雲端部屬？

如果您不想自己維護伺服器，或者想要讓其他人透過網路連進來，可以考慮使用 **Zeabur** 雲端服務。

👉 請參考：[Zeabur 雲端部屬指南 (ZEABUR_DEPLOY_GUIDE.md)](./ZEABUR_DEPLOY_GUIDE.md)

---

## 🌩️ 進階：混合雲部屬 (Wonder Mesh)

如果您想用自己的舊電腦 (如 iMac) 跑系統，但又希望人在外面能遠端管理與自動更新：

👉 請參考：[Wonder Mesh + 本地播放器整合手冊 (WONDER_MESH_PLAYER_GUIDE.md)](./WONDER_MESH_PLAYER_GUIDE.md)
