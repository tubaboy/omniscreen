# 🚀 Wonder Mesh + 本地播放器整合指南 (iMac & Linux 專用)

這是一份進階指南，教你如何利用 **Zeabur Wonder Mesh** 將你的舊電腦（如 iMac A1311 跑 Linux Mint）變成一台受雲端控管的專業電子看板。

> [!NOTE]
> **為什麼要用 Wonder Mesh？**
> - **自動更新**：只要 `git push` 到 GitHub，你的 iMac 就會自動拉取最新程式並重啟。
> - **遠端監控**：人在國外也能看這台 iMac 的 CPU 使用量與報錯 Log。
> - **公網域名**：Zeabur 會給你一個專屬網址，不需設定 IP 就能管理。

---

## 🛠️ 第一階段：設備接入 Wonder Mesh

1. 登入 [Zeabur 控制台](https://zeabur.com/servers)。
2. 點擊 **"Create Server"** -> 選擇 **"Wonder Mesh"**。
3. 系統會給你一條類似下方的指令：
   ```bash
   curl -fsSL https://wonder-mesh.sh | sh -s -- --token YOUR_TOKEN
   ```
4. 在你的 **Linux Mint** 終端機貼入這條指令。
5. 看到 `Wonder Mesh started successfully` 字樣後，這台 iMac 就已經連上雲端了！

---

## 📝 第二階段：在 Zeabur 建立混合雲部署

1. 在 Zeabur 建立一個新專案。
2. 點擊 **"Deploy Service"** -> **"GitHub"** -> 選擇你的 `omniscreen` 專案。
3. **重要設定**: 
   - 進入該服務的 **"Settings"** -> **"Server"**。
   - 將部署目標改為你剛剛加入的 **"Wonder Mesh 設備"**。
4. **環境變數 (Variables)**:
   - 確保你的 `DATABASE_URL` 指向你設備上的資料庫（或同樣透過 Zeabur 部署在同一節點的 PostgreSQL）。
   - 設定 `NEXT_PUBLIC_API_URL` 為 Zeabur 給你的公網地址。

---

## 📺 第三階段：Kiosk 自動播放設定 (Linux Mint 版)

既然你的後端與前端現在由 Zeabur 自動管轄，你的播放器腳本需要做一點微調。

### 1. 取得播放網址
在 Zeabur 控制台查看你的 Frontend 服務網址，例如：`https://my-player.zeabur.app`。

### 2. 更新啟動腳本
編輯你的 `start_player.sh` (或參考 `KIOSK_SETUP_GUIDE.md`)：
```bash
#!/bin/bash
# 等待 Zeabur 服務在本地啟動 (通常需要 30-60 秒)
sleep 45

# 啟動 Chromium
chromium-browser --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required "https://你的域名.zeabur.app/player"
```

---

## 🖥️ iMac A1311 特殊優化 (雙螢幕模式)

針對 iMac A1311 搭配 Linux Mint，如果你有接第二螢幕，請注意：

1. **螢幕名稱格式**:
   - iMac 內建螢幕通常叫 `eDP-1` 或 `LVDS-1`。
   - 外接 Mini DP 轉 HDMI 通常叫 `HDMI-1`。
   - 請輸入 `xrandr` 確認名稱。

2. **使用專案中的自動偵測腳本**:
   - 你依然可以使用 [dual_monitor_kiosk.sh](./dual_monitor_kiosk.sh)。
   - **優點**: 即使 Zeabur 正在後台更新程式碼導致瀏覽器瞬間閃退，這個腳本會立刻把它抓回來重新打開，達成 **99.9% 高可用性**。

---

## 🗄️ 第四階段：處理資料庫與儲存 (Postgres & MinIO)

在 Wonder Mesh 環境下，建議將這兩個基礎服務也改由 Zeabur 控管，以確保整體系統的一致性：

### 1. 部署 PostgreSQL
1. 在 Zeabur 點擊 **"Deploy Service"** -> **"Marketplace"** -> 搜尋並部署 **PostgreSQL**。
2. **關鍵設定**: 在該服務的 **"Settings"** -> **"Server"**，將部署目標選為你的 **iMac 節點**。
3. **資料持久化**: 進入 **"Storage"** 分頁，建立一個 Volume 掛載到 `/var/lib/postgresql/data`，這能確保你的排程資料在 iMac 重啟後依然存在。

### 2. 部署 MinIO
1. 同樣在 Marketplace 搜尋並部署 **MinIO**，部署目標選為 **iMac 節點**。
2. **環境變數對接**:
   - `MINIO_ROOT_USER`: `minioadmin`
   - `MINIO_ROOT_PASSWORD`: `minioadmin` (建議改掉)
3. **對接後端**: 在你的後端服務 (Backend) 的 Variables 中，將 `MINIO_ENDPOINT` 指向這個 MinIO 服務的內網位址。

### 3. 環境變項 (Variables) 快速參考表
在 Zeabur 的 **Backend 服務** 中，請確保以下變數已正確設定：

| 變數名稱 | 數值範例 (建議使用 Zeabur 注入) | 說明 |
| :--- | :--- | :--- |
| `DATABASE_URL` | `${POSTGRES_URL}` | 直接引用 Postgres 服務的連結 |
| `MINIO_ENDPOINT` | `${MINIO_PRIVATE_DOMAIN}` | 使用 Wonder Mesh 內網域名速度最快 |
| `MINIO_ACCESS_KEY` | `minioadmin` | 需與 MinIO 服務設定一致 |
| `MINIO_SECRET_KEY` | `minioadmin` | 需與 MinIO 服務設定一致 |
| `NEXT_PUBLIC_API_URL`| `https://your-api.zeabur.app/api` | 前端存取後端的公網地址 |

---

## 🔄 每日維護：如何更新？

這就是 Wonder Mesh 最強大的地方：
1. 你在你的開發筆電改好程式碼。
2. 執行 `git push`。
3. **沒了。** 你的 iMac 會自動完成下載、建置、重啟，幾分鐘後螢幕上的看板就會變新。

---

## ⚡️ 離線穩定性 (Offline Resilience)

雖然 Wonder Mesh 讓我們可以從雲端管理，但店面佈屬最怕「網路斷線」。為了確保斷網時看板不跳出 404，請遵循以下設定建議：

### 1. 播放器優先存取 Localhost
在 `start_player.sh` (Kiosk 腳本) 中，**不要指向公網域名**，而是使用本地迴路：
- **正確做法**: `http://localhost:3000/player`
- **優點**: 就算對外網路斷掉，瀏覽器依然能抓到跑在同一台 iMac 上的後端 API。

### 2. 素材存取優化
確保前端部署時，`NEXT_PUBLIC_API_URL` 設定為與播放器環境一致的位址。
> [!TIP]
> 如果你的播放器與伺服器是同一台 iMac，建議將環境變數中的存取位址設為本地 IP (如 `192.168.1.x`) 而非公網網址，這樣素材能直接在區網內抓取，速度最快且斷網不影響。

### 3. 當斷網時，你能做什麼？
- **觀看看板**: 依然正常運作 (因為使用 Localhost 存取)。
- **切換內容**: 只要在店內區域網路內打開 `http://iMac的IP:3000`，你依然能進入管理後台。
- **雲端同步**: 暫時停止，待網路恢復後，Zeabur 會自動重新補回離線期間的 Log。

---

## 🆘 常見問題

### 1. 裝置離線了怎麼辦？
只要 iMac 維持開機且有網路，連線會自動恢復。如果真的連不上，請檢查 `sudo systemctl status wonder-mesh`。

### 2. 一定要用公網域名嗎？
不用，如果你怕外網慢，可以去 Zeabur 服務的 **"Networking"** 分頁找 **"Private Mesh IP"**，用那個 IP 跑 Kiosk 會更快。

---

👉 回到本地部屬指南：[LOCAL_DEPLOY_GUIDE.md](./LOCAL_DEPLOY_GUIDE.md)
