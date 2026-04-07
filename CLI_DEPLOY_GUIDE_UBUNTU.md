# 🐧 Omniscreen Ubuntu Server CLI 部屬全攻略 (新手友善版)

如果您手邊只有一台純黑白的 CLI 介面（例如 Ubuntu Server 22.04/24.04），甚至是透過 SSH 連線進去的遠端主機，請按照這份指南操作。我們避開了複雜的理論，直接給您「複製貼上」就能執行的指令。

---

## 🛠️ 第一階段：安裝「執行環境」 (Docker)

在 Linux 上，我們需要手動安裝 Docker。請「按順序」輸入以下每一行指令：

### 1. 更新系統套件
```bash
sudo apt-get update && sudo apt-get upgrade -y
```

### 2. 安裝 Docker (官方一鍵安裝腳本)
這是最省事的方法，會自動幫您處理所有相依性：
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### 3. 安裝 Docker Compose 插件
```bash
sudo apt-get install -y docker-compose-plugin
```

### 4. 檢查是否安裝成功
```bash
docker compose version
```
> 如果有顯示 `Docker Compose version v2.x.x`，恭喜您，第一關過了！

---

## 📝 第二階段：取得專案與設定變數

### 1. 安裝 Git 並拉取程式碼
```bash
sudo apt-get install -y git
git clone https://github.com/tubaboy/omniscreen.git
cd omniscreen
```

### 2. 準備環境檔案 (.env)
```bash
cp .env.example .env
```

### 3. ⚠️ 最重要的一步：找出伺服器 IP 並修改設定
因為您是在 CLI 伺服器部屬，但從您的「自己筆電」存取網頁。**如果您不修改 API 位址，網頁會壞掉。**

**A. 找出您的伺服器 IP：**
輸入以下指令，看第一個出現的數字（通常是 `192.168.x.x` 或 `10.x.x.x`）：
```bash
hostname -I | awk '{print $1}'
```
> 假設您看到的 IP 是 `192.168.1.50`。

**B. 編輯 .env 檔案：**
```bash
nano .env
```
用方向鍵移動游標，找到 `NEXT_PUBLIC_API_URL` 這行，將 `localhost` 改成您的 **伺服器 IP**：
```env
# 修改前
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# 修改後 (請換成您剛才查到的 IP)
NEXT_PUBLIC_API_URL=http://192.168.1.50:3001/api
```
> 修改完後：
> 1. 按下 `Ctrl + O` (存檔)
> 2. 按下 `Enter` (確認檔名)
> 3. 按下 `Ctrl + X` (離開)

---

## 🚀 第三階段：啟動系統

### 1. 一鍵重啟 (包含編譯)
```bash
sudo docker compose up -d --build
```
> 這步會跑很久（約 5-10 分鐘），請去喝杯咖啡。

### 2. 初始化資料庫 (必做！)
啟動完後，請告訴資料庫要建立資料表：
```bash
sudo docker exec -it omniscreen-backend npx prisma db push
```
> 看到 `Your database is now in sync` 就代表大功告成了！

---

## 🌐 第四階段：如何開始使用？

現在，請回到您自己的筆電（與伺服器同一個網路），打開瀏覽器輸入：

1. **管理後台 (Dashboard)**: `http://192.168.1.50:3000`
2. **儲存管理 (MinIO)**: `http://192.168.1.50:9001`
   - 帳號：`minioadmin`
   - 密碼：`minioadmin`

---

## 🆘 常見問題維護 (常用指令)

- **查看系統有沒有在跑？**
  ```bash
  sudo docker compose ps
  ```

- **🔄 如何更新系統？ (當有最新程式碼時)**
  ```bash
  # 1. 取得最新版本
  git pull

  # 2. 重新建置並啟動
  sudo docker compose up -d --build

  # 3. 同步資料庫 (若有結構變動)
  sudo docker exec -it omniscreen-backend npx prisma db push
  ```

- **如果要看錯誤紀錄 (Log)？**
  ```bash
  sudo docker compose logs -f backend
  ```

- **如何徹底關閉系統？**
  ```bash
  sudo docker compose down
  ```

---

## 📺 進階：All-in-One 播放器設定 (伺服器即播放器)

如果您打算直接把伺服器主機接上電視當成播放端（電子看板），您需要安裝「極簡」的圖形顯示組件：

### 1. 安裝顯示驅動、圖形介面與瀏覽器
```bash
sudo apt-get update
sudo apt-get install -y xorg chromium-browser unclutter
```

### 2. 啟動播放器 (Kiosk 模式)
輸入以下指令，系統會啟動一個隱藏視窗框架的瀏覽器，並直接進入播放畫面：
```bash
startx /usr/bin/chromium-browser --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required http://localhost:3000/player
```

> **💡 小撇步：**
> - **隱藏滑鼠**: `unclutter` 會自動幫您隱藏沒在動的滑鼠游標。
> - **自動播放**: 我們加入了 `--autoplay-policy` 參數，確保背景音樂或影片在開機後能自動出聲（不需點擊）。
> - **localhost**: 既然是同一台機器，播放器網址可以直接用 `localhost`。

---

祝您部屬順利！如果有任何錯誤訊息，請直接截圖或貼上文字問我。
