# fx-skill-kit · inkfx · oledfx

<p align="center"><img src="docs/brand/icon-512.png" alt="fx-skill-kit 標誌 — 分格圖與代理迴圈" width="160" height="160"></p>

[English](README.md) · **繁體中文**

**零依賴程序化特效全套件：東方水墨與武俠引擎 (`inkfx`)、嵌入式 1-bit 與 RGB565 微螢幕編譯庫 (`oledfx`)、六大品質守門員、Contact Sheet 視覺自檢與四個 MCP 工具 (`fx-skill-kit`)。**

![6x4 24格同步動態展示牆](records/showcase-grid.gif)

![水墨劍氣斬擊預覽](records/sword/sword-qi-slash/preview.gif) ![好奇眨眼預覽](records/eyes/curious-blink/preview.gif) ![軌道循環預覽](records/orbit-loop/preview.gif)

專為程序化素材開發者、獨立遊戲創作者、ESP32 創客與 AI Coding Agent 打造。撰寫精簡的確定性 JavaScript 特效，透過自動化檢查攔截工程缺陷，並渲染出多模態模型與人類都能一眼審查的時間軸接觸表（Contact Sheet）：**Draft → Check → Render → Look → Refine**。

內建目錄收錄 **32 組特效**，完整涵蓋基礎 RGBA、**InkFX**（`16` 組特效，`Pigment + Wetness` 雙緩衝水墨物理模型、飛白與水暈、傳統礦物色盤、武俠 `act` 蓄力與頓幀，涵蓋 6 大分類）以及 **OLEDFX**（`14` 組特效，`128×64` 1-bit 與 `RGB565` 微螢幕動畫、Ordered Bayer 4×4 抖動演算法、`XOR-Delta + RLE` 差分壓縮與 ESP32 C Header 解碼器，涵蓋 5 大分類）：

| 目錄分類 | 效果數 |
| --- | ---: |
| 基礎入門 (`orbit-loop`、`pulse-dot`) | 2 |
| InkFX 東方水墨 (`sword/*` ×3、`talisman/*` ×3、`zen/*` ×3、`ink-burst/*` ×3、`transitions/*` ×2、`ui/*` ×2) | 16 |
| OLEDFX 微螢幕動畫 (`eyes/*` ×4、`weather/*` ×3、`system/*` ×3、`pomodoro/*` ×2、`transitions/*` ×2) | 14 |
| **合計** | **32** |

## 試一次

需要 Node.js 20 或更新版本。零外部套件、免安裝建置。

```sh
npm test
npm run check
npm run check -- sword/sword-qi-slash eyes/curious-blink --seed 42
npm run render -- sword/sword-qi-slash --seed 42 --sheet --gif
npm run act -- sword/sword-qi-slash --seed 42
npm run export-sheet -- sword/sword-qi-slash --palette zhusha --paper
npm run export-mcu -- eyes/curious-blink --profile ssd1306-128x64 --fps 24 --compress xor-rle

npm run gallery
# 開啟 http://127.0.0.1:8080/gallery/
```

建立自己的效果，然後執行檢查與視覺自檢：

```sh
npm run new -- ui/my-pulse --loop --sim
npm run check -- ui/my-pulse --seed 42
npm run render -- ui/my-pulse --seed 42
npm run act -- ui/my-pulse --seed 42
```

- **水墨遊戲引擎匯出器 (`tools/export-sheet.mjs`)**：支援輸出透明背景 (`sheet.png`) 或宣紙紋理底色 (`--paper`、`sheet-paper.png`)，並附帶相容 Aseprite / Godot / Phaser 的 JSON Atlas（內含 `meta.inkfx.act` 武俠蓄力與頓幀時間點）與四大傳統礦物色盤（`songyan` 松煙、`zhusha` 朱砂、`shiqing` 石青、`nijin` 泥金）。
- **微控制器硬體匯出器 (`tools/export-mcu.mjs`)**：支援 `ssd1306-128x64`、`ssd1306-128x32`、`led-matrix-64x32`、`st7789-128x128` 等硬體規格預設集。`--compress xor-rle` 採用 SSD1306 原生垂直 Page 佈局與 `XOR-Delta + RLE` 差分壓縮（將 48 KB 原始幀壓縮至 `< 3.5 KB`，壓縮率達 90%+），並內建零動態記憶體配置（Zero-malloc）的 `oledfx_step_frame` C 解碼器；同時支援 `--compress xbm` 與 `--compress adafruit`。

在儲存庫用 `npm run mcp` 啟動 stdio MCP 伺服器（用戶端請設定直接執行 `node tools/mcp-server.mjs`）：

| 工具 | 結果 |
| --- | --- |
| `fx_search_catalog(query?, category?)` | 依 ID、標籤與分類做本地關鍵字排序搜尋 |
| `fx_render_contact_sheet(effect_id, palette?)` | 回傳 Base64 PNG 圖塊與產物路徑 |
| `fx_run_diagnostics(effect_id)` | 回傳 CHK-01..06 結構化診斷報告（種子 42） |
| `fx_export_asset(effect_id, target_format, palette?)` | 匯出 `sheet`、`gif`、`png` 或 `c-header` 產物路徑 |

詳見 [MCP 設定與協定](docs/MCP.md) 與 [完整實作報告](docs/IMPLEMENTATION.md)。

## 你會看到什麼

**水墨劍氣斬擊 (`sword/sword-qi-slash`)：** 含負時間軸壓身蓄力、朱砂寒光、飛白劍氣弧線、命中頓幀（Hit-stop）與甩墨水暈。

![水墨劍氣斬擊分格圖](records/sword/sword-qi-slash/contact.png)

**好奇歪頭眨眼 (`eyes/curious-blink`)：** `128×64` 1-bit 參數化雙眼與視線追蹤，經 `export-mcu.mjs` XOR-RLE 壓縮後僅 `2,849 Bytes`。

![好奇眨眼分格圖](records/eyes/curious-blink/contact.png)

## 互動展示牆 (Gallery)

執行 `npm run gallery` 可開啟宣紙／OLED 雙棲互動展示牆：內建 `IntersectionObserver` 60fps 全目錄即時縮圖牆、傳統礦物色盤切換、宣紙纖維粗細滑桿、武俠木人樁 `act` 演出疊加、`0.25x` 慢動作逐幀檢視、SSD1306 單色與經典「上 16px 黃光＋下 48px 藍光」雙色螢光模擬、單檔 JS／React／Vue 元件複製，以及 PNG 與 XOR-RLE C Header 一鍵下載。

中繼資料、緩衝區、種子與檢查契約見 [AUTHORING.md](docs/AUTHORING.md)。AI Agent 請遵循 [FX 撰寫技能](skills/fx-authoring/SKILL.md) 執行視覺自檢閉環。
