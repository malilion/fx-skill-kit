# 開源程序化特效三專案 PRD 全集

> inkfx · oledfx · fx-skill-kit  
> 私人 repo（malilion），零依賴核心，Agent Skill 閉環可擴充

---

## 共通原則

- **零 runtime 依賴**（核心引擎與特效檔）：純 ES modules + Node 內建。
- **決定性**：禁止 `Math.random()`；一律用 seed PRNG（mulberry32）。
- **單檔特效**：每個特效一個檔，可直接複製使用。
- **Agent 友好**：contact sheet 有準星／幀號／秒數／填充率；check.mjs 自動守門。
- **授權**：私人 repo，**不放 LICENSE**（除非日後明示開源）。
- **CI**：Node test workflow；**不啟用 GitHub Pages**（私人）。
- **Dependabot**：啟用。
- Commit author：`Malilion <296698118+malilion@users.noreply.github.com>`，無 AI trailer，不 force-push。

---

# PRD 01：inkfx

程序化東方水墨與武俠意境特效引擎。

## 核心洞察

傳統粒子特效用 color + light（加法混合）表現火焰／魔法；套在水墨上會像霓虹。inkfx 改成**物理語義**：pigment（墨沉積）+ wetness（水分）+ paperGrain（宣紙纖維）。

## 緩衝區資料結構

```ts
export interface InkFrame {
  w: number;                // 畫布寬（建議 160~360px）
  h: number;
  ox: number;               // 局部原點 X
  oy: number;               // 局部原點 Y
  pigment: Float32Array;    // 墨色濃度 [0..1]，0 留白，1 焦墨
  tint: Uint8Array;         // 色盤通道索引（0 主墨、1 朱砂／點綴、2 金粉／高光）
  wetness: Float32Array;    // 水分 [0..1]，決定擴散半徑與飛白閾值
  paperGrain: Float32Array; // Seed 預生成宣紙纖維高低圖
}
```

## 三大核心演算法

### 1. 飛白（Dry-Brush / Feibai）

當筆觸速率 `v` 極快或殘餘水分 `w` 偏低：

```
落墨條件：pigment_input + wetness > paperGrain[idx] * dryFactor
```

紙紋凹處不上墨 → 高速劍氣尾端斷續蒼勁的飛白絲縷。

### 2. 水暈墨章（Wet Diffusion & Dark Fringe）

Sim 模式每步 120Hz：若 `wetness[idx] > threshold`，墨色向四鄰微幅擴散；濕潤交界堆積微量墨粒（水痕）。

### 3. 礦物色盤（Mineral Color Ramp）

6 階非線性：清、淡、重、濃、焦 ＋ 點綴色。預設：

| id | 名稱 | 說明 |
|----|------|------|
| songyan | 松煙古墨 | 暖黑 → 宣紙米白 `#f4efe6` |
| zhusha | 朱砂血墨 | 焦黑／暗紅 → 丹朱 `#c83228`（殺氣、符咒） |
| shiqing | 石青竹翠 | 墨綠／花青 → 石青 `#2c6e7f`（風系、劍意） |
| nijin | 泥金佛光 | 玄黑底＋鎏金 `#d4af37`（破陣、金剛） |

## 武俠動作節奏（act）

```ts
export interface WuxiaActSpec {
  windup: number; // 蓄力秒數（負時間軸，如 -0.45）
  poses: Array<[time: number, poseId: string, easing?: 'snap'|'linear'|'easeOut']>;
  hits: Array<{
    t: number;
    freeze: number;    // Hit-stop，重擊 0.12~0.18s
    shakeAmp: number;
    inkSplash: number;
  }>;
  recovery: number;
}
```

節奏：長蓄力 → 1~2 幀極速出招 → Hit-stop → 殘墨緩散。

## 首發特效分類（目標 80~120）

- sword、talisman、zen、ink-burst、transitions、ui

## Phase 1 交付

1. `src/core/`：frame、seed（mulberry32 + hash2d）、compositor（pigment→RGBA via palette）
2. 四套礦物色盤
3. 飛白 + 水暈演算法
4. `sword/sword-qi-slash`（完整 PoC）+ 至少數個 sword／transition 特效
5. `gallery/` 本地預覽（Vite 可選，或純靜態）
6. `docs/PRD.md`、產品向 README、CI、Dependabot
7. 與 fx-skill-kit 整合：可被 `render.mjs` / `check.mjs` 消費

### PoC 骨架：sword-qi-slash

見規格：duration 0.75、act windup 0.4、hits freeze 0.15、28 墨滴粒子、15% 朱砂、飛白弧線掃描。

---

# PRD 02：oledfx

嵌入式微螢幕程序化動畫與硬體編譯庫（SSD1306 128×64 等）。

## 痛點

GIF→陣列塞爆 MCU 記憶體；改動畫要重燒韌體。

## Phase 1 交付

1. **1-bit API**：frame buffer（1bpp 或 byte-packed pages）
2. **抗閃爍有序抖動**：
   - `threshold`：銳利邊緣
   - `bayer4x4`：17 階穩定網點灰階
   - `checker`：棋盤變體
   - 禁止誤差擴散（會有 Temporal Shimmering）
3. **SSD1306 Web 模擬器**：像素格、螢光 glow、黃藍雙色分割（常見 OLED 配色）
4. **標竿特效**：`eyes`、`happy-squint`（圓角幾何＋遮罩切削；`lookX`/`lookY` 參數）
5. **`tools/export-mcu.mjs`**：XOR-Delta + RLE → C Header；對齊 SSD1306 垂直 Page 佈局；附零 malloc ESP32 解碼器 + 測試
6. `docs/PRD.md`、產品向 README、CI、Dependabot

### 壓縮目標

30KB+ 點陣 → 2KB~3.5KB；XOR 0 區塊可跳過。

---

# PRD 03：fx-skill-kit

Agent 自動渲染與視覺自檢閉環工具鏈（先做最小閉環）。

## Phase 1 最小閉環（優先）

1. `tools/new.mjs` — 特效腳手架
2. `tools/render.mjs` — Contact sheet（每格：淡色安全框、`(ox,oy)` 十字準星、幀號、精確秒數、像素填充率）
3. `tools/check.mjs` — 至少 CHK-01..03：
   - **CHK-01 決定性**：monkey-patch 封鎖 `Math.random()`；雙次執行 SHA-256 一致
   - **CHK-02 邊界溢出（Edge Spill）**：最外圈 1px 非透明比例超標失敗
   - **CHK-03 循環無縫（Loop Seam）**：首尾幀 MSE 超標失敗
4. `skills/fx-authoring/SKILL.md` — Draft → Check → Render → Look → Refine
5. `docs/PRD.md`、`docs/AUTHORING.md`、產品向 README、CI、Dependabot
6. 範例特效 1~2 個供 smoke test

### 後續（本輪可預留檔位，非必須全做）

- CHK-04 空白／過曝、CHK-05 120Hz p95&lt;1.5ms、CHK-06 領域外掛
- MCP server、GIF／sprite sheet 匯出

## 目錄骨架（三專案共通變體）

```
├── README.md
├── package.json
├── .github/workflows/ci.yml
├── .github/dependabot.yml
├── docs/PRD.md
├── docs/AUTHORING.md          # kit / inkfx
├── skills/.../SKILL.md        # kit
├── src/core/
├── src/fx/ 或 fx/
├── tools/
└── gallery/
```

## 啟動順序

1. **fx-skill-kit** 最小閉環（new / render / check CHK-01..03 + contact sheet）
2. **inkfx** Phase 1
3. **oledfx** Phase 1

## README 風格

產品介紹：標語、能做什麼、怎麼用（幾行指令）、截圖／contact sheet、資料／免責若有。不要內部稽核長文。
