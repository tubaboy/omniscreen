# 📺 Omniscreen

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg)](https://www.docker.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js-black.svg)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Backend-Fastify-green.svg)](https://www.fastify.io/)

**Omniscreen** 是一款開源的數位看板 (Digital Signage) 解決方案，旨在讓任何人都能輕鬆建立、管理並播放專業的螢幕內容。無論是單店門市、企業辦公室，還是專業的媒體展示，Omniscreen 都能提供強大且彈性的功能。

![Omniscreen Preview](https://github.com/tubaboy/omniscreen/raw/main/preview.png) *(示意圖，請自行更換)*

---

## ✨ 核心特色

- 🎨 **動態看板微件 (Widgets)**: 內建天氣、時鐘、公告、倒數計時等高質感微件。
- 🎞️ **多樣化素材支援**: 支援圖片 (JPG/PNG)、影片 (MP4)、YouTube、網頁 URL 及跑馬燈。
- 📅 **智慧排程系統**: 可針對不同時段設定不同的播放清單與跑馬燈內容。
- 🚀 **一鍵部署**: 完整支援 Docker Compose，數分鐘內即可完成環境建置。
- 📺 **Kiosk 模式優化**: 提供 Linux/Windows 自動全螢幕播放與雙螢幕監控解決方案。
- ☁️ **混合雲支援**: 支援地端部署 (Local)、雲端部署 (Zeabur) 以及遠端控制模式。

---

## 🏗️ 系統架構

Omniscreen 採用現代化的技術棧，確保穩定性與擴充性：

- **Frontend**: Next.js 14, Tailwind CSS, Lucide React.
- **Backend**: Fastify (Node.js), Prisma ORM.
- **Database**: PostgreSQL.
- **Storage**: MinIO (S3 Compatible Storage).
- **Runtime**: Docker & Docker Compose.

---

## 🚀 快速開始 (Quick Start)

### 1. 前置需求
確保你的電腦已安裝 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 與 [Git](https://git-scm.com/downloads)。

### 2. 啟動系統
```bash
git clone https://github.com/tubaboy/omniscreen.git
cd omniscreen
docker compose up -d --build
```

啟動後即可存取：
- **管理後台**: [http://localhost:3000](http://localhost:3000)
- **播放器**: [http://localhost:3000/player](http://localhost:3000/player)
- **預設登入**: `admin` / `omniscreen2024` (若有啟用)

---

## 📚 詳細指南

我們針對不同情境準備了完整的文檔：

### 📥 部署與設定
- [**本地部屬指南**](./LOCAL_DEPLOY_GUIDE.md): 詳細的新手入門 Step-by-Step。
- [**Ubuntu CLI 部署指南**](./CLI_DEPLOY_GUIDE_UBUNTU.md): 針對無 GUI 伺服器的專業部署。
- [**Zeabur 雲端部署**](./ZEABUR_DEPLOY_GUIDE.md): 一鍵將看板託管到雲端。

### 🖥️ 實體播放器 (Hardware)
- [**Kiosk 模式設定指南**](./KIOSK_SETUP_GUIDE.md): 讓電腦開機自動全螢幕播放。
- [**雙螢幕監控模式**](./KIOSK_SETUP_GUIDE.md#🖥️-專業雙螢幕監控模式-imac舊電腦轉生): 用舊 iMac 同時進行監控與播放。
- [**Wonder Mesh 遠端管理**](./WONDER_MESH_PLAYER_GUIDE.md): 人在外面也能更新地端播放器。

### 🛠️ 維護與自動化
- [**自動備份教學**](./BACKUP_GUIDE.md): 確保資料庫與素材不遺失。
- [**Crontab 排程設定**](./CRONTAB_SETUP.md): 自動清理、自動備份、定時關機。

---

## 🤝 貢獻代碼

歡迎提交 Issue 或 Pull Request 來改進 Omniscreen！

1. Fork 本專案
2. 建立你的 Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit 你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. Push 到 Branch (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

---

## 📄 開源許可

本專案採用 **MIT License**。詳細內容請參閱 [LICENSE](./LICENSE) 文件。

---

## ☕ 支持我們

如果你覺得這個專案對你有幫助，歡迎給我們一個 ⭐️ Star！

開發者：[tubaboy](https://github.com/tubaboy)
