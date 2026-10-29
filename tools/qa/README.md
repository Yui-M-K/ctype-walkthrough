# tools/qa：3D 房子自動品質檢測

抓「穿牆、浮空、卡在門或牆裡、畫框卡牆角、門打不開／撞到東西、互動壞掉、家具互相重疊、走不到」這類瑕疵。
不需要 package.json／node_modules；Node 18 以上即可（本機 Node 24 測試）。

## 用法

```
node tools/qa/run.js ideal_c                      # 一棟（data + scene + 視線檢查）
node tools/qa/run.js all                          # 全部房子
node tools/qa/run.js a2 --checks a,b,c            # 只跑指定檢查
node tools/qa/run.js ideal_c --checks data        # 只跑資料層（約 1 秒，不開瀏覽器）
node tools/qa/run.js ideal_c --update-baseline    # 把目前的結果存成基準（之後只報告新增的問題）
node tools/qa/run.js ideal_c --screenshots        # 另外用 Chrome 對每個傳送點截圖（慢，約 3～7 分鐘）
node tools/qa/run.js ideal_c --browser-check      # 同樣的靜態檢查再用實機 Chrome 跑一次並交叉比對
node tools/qa/run.js ideal_c --open-report        # 跑完開啟 report.html
node tools/qa/run.js ideal_c --root <另一份資料夾> # 例如 git worktree 的舊版
```

其他選項：`--out <dir>`（報告輸出，預設 `$QA_OUT` 或系統暫存的 `ctype-qa-out`）、`--all-issues`（連基準內已知問題也列出）、`--min-sev high|mid|low`、`--port`。
輸出：`<out>/reports/<house>.json`（機器可讀）、`<house>.txt`（可讀摘要）、`summary.txt`／`report.html`（總表＋全部摘要）、`<out>/shots/<house>/`（截圖）。

`--checks` 可用：`a`（穿牆＋貼牆範圍）、`b`（浮空）、`c`（重疊）、`d`（門）、`e`（可達性）、`f`（窗洞）、`g`（天花／樓梯）、`h`（組件連續性）、`interact`、`visual`；群組 `data`＝a～h、`scene`＝interact、`all`。

## 三層結構與報告欄位

| 層 | 內容 | 怎麼跑 |
|---|---|---|
| `data` | 靜態狀態的資料與幾何檢查（a～h） | Node，不開瀏覽器。`lib/nodeload.js` 把 `lib/*.js` 與房子頁面的 module script 放進 `vm`，THREE 用真的（首次從 CDN 下載同版 three.js 快取在暫存資料夾），只把 WebGLRenderer／DOM 換成「萬用吸收器」。引擎建出的 `window.__walk`（含 `scene`、碰撞矩形、門、家具、傳送點）原封不動可用，全程 1～10 秒 |
| `scene` | 互動與動畫狀態：逐一觸發、等動畫結束、狀態改變後重跑幾何檢查、再還原；`--browser-check` 時加上實機 Chrome 交叉比對 | `checks/interact.js`，同樣在 Node 的 headless 引擎上用虛擬時鐘推進動畫（`ctx.advance`）；實機交叉比對用 Playwright（`channel:'chrome'`，不用 Playwright MCP） |
| `visual` | 傳送點視線被擋（Node 射線）、截圖全黑／全白、與基準截圖的像素差（Playwright） | `lib/visual.js` |

為了讓 mesh 保持個別狀態，載入時會把 `lib/perf.js` 的 `Perf.mergeStatic` 換成空函式，並在 `lib/storeys.js` 的 `window.__walk` 加上 `E`（引擎內部）與 `wallOpens`，在 `lib/catalog.js` 的 `Piece` 記錄建構時的呼叫堆疊以取得固定設備名稱（`toilet@x,z` 這類）。**這些都是載入時在記憶體內改寫，不會動檔案。**

每筆問題：嚴重度（高／中／低）、檢查項目、物件名稱與零件、世界座標（x, y, z，公尺）、房間名稱、層、截圖路徑、建議。

## 各項檢查的原理與容差

| 代號 | 檢查 | 原理 | 主要容差（`checks/*.js` 開頭的 `TOL`） |
|---|---|---|---|
| a | `wall-pen` 穿牆 | 家具／固定設備／窗簾的每個 mesh 的世界 AABB 與牆體積（引擎的牆碰撞箱）求重疊 | 三軸最小重疊 ≥ 2.5 cm 且（佔零件體積 ≥ 20% 或 ≥ 3 L）。高：≥ 6 cm 且 ≥ 30% |
| a | `mount` 貼牆範圍 | 掛牆物件（`wall:true` 家具、離地 ≥ 25 cm 的設備、離地 ≥ 60 cm 的薄板如畫框）找背面 3 cm 內的牆，算整件在「沿牆方向 × 高度」平面被牆覆蓋的比例，沒被覆蓋的部分就是超出端點、懸在洞口或牆角外 | 覆蓋 < 90% 報告；< 80% 且像畫框（前面有畫面 Plane）為高 |
| b | `float` 浮空 | 全部 mesh 建「AABB 距離 ≤ 3 cm 即相連」的圖；碰到地板（`floorAt`）、天花、牆碰撞箱的視為有支撐，傳遞到相連的 mesh。沒有任何支撐的連通塊就是浮空 | 3 cm。厚度極薄的線材降級；窗簾、零厚度貼圖面不算 |
| c | `overlap` 重疊 | ①可移動家具碰撞矩形面積重疊 ②不同物件的 mesh 3D 穿插（建築小物也算） | ①≥ 0.04 m² 且 ≥ 20%；②最小重疊 ≥ 3 cm 且 ≥ 25% |
| d | `door-sweep` / `door-gap` | 門逐段開到 10%～100%，把門扇當平面線段（加厚度）去撞家具、小物、牆、別的門；全關時量門扇與開口 `col` 的左右上間隙 | 淨空 1.5 cm；縫 > 4 cm 才報（門框本身約 3 cm 屬設計） |
| e | `reach` 可達性 | 5～10 cm 網格洪水填充：碰撞半徑 0.22 m（與引擎 `resolve` 相同）、坡道用 `floorAt`；以傳送點和樓梯上下端為起點，門全開。列出走不到的房間、房內死角、被擋的出入口、落在牆或家具內的傳送點、被封住的樓梯口；另記錄門全關時能到的格數 | 死角 ≥ 1 m² |
| f | `opening` 窗洞 | 窗（窗台 ≥ 0.3 m 的開口）中央與左右 1/4 處要有任何 mesh（玻璃、窗框、窗簾）占據，否則會看穿 | 壁面 ±12 cm |
| g | `level` 天花／樓梯 | 房間中心上方 `CH` 處要有天花或樓板；樓梯踏板的級高要一致 | 級高 ≤ 23 cm、差 ≤ 4 cm |
| h | `continuity` 組件連續性 | 同一件家具／設備的 mesh 用 AABB 距離 ≤ 1 cm 連圖，連通塊超過 1 個就報告（最大縫寬、座標、零件）。互動檢測在每個動畫狀態下再量一次 | 縫 ≥ 2 cm 且零件 ≥ 10 cm（中）；≥ 6 cm，或 ≥ 2.8 cm 且零件 ≥ 50 cm（高） |
| — | `interact` 互動 | 對 `E.things`＋`E.furnThings` 每一項：觸發、等動畫停（只看該物件範圍的 mesh，持續動畫的貓不會干擾）、確認有東西動且標籤改變、再觸發回原狀。偵測：例外、14 秒不停、標籤改變但沒有零件移動（例如紗簾束起來沒作用）、動畫幅度 < 2 cm、來回後沒有回到原位（≥ 10 cm 中、≥ 30 cm 高，例如燙衣板收不回）、狀態改變後新出現的穿牆／浮空／分裂／重疊、動起來的零件穿進固定零件（含建築小物）；另測 30 組最近的互動同時作動 | 初始狀態就有的問題不算「互動造成」 |
| — | `visual` | 每個傳送點正前方（±10°）射線距離 < 60 cm（高：< 40 cm）；截圖平均亮度過暗／過亮 > 90% 像素；與 `<out>/baseline-shots/` 的基準像素差 > 8% | |

## 白名單與基準檔

- `baseline/<house>.json`：`--update-baseline` 把「目前全部問題」存成 `known`；之後同一個檢查、同一物件名稱、座標差 ≤ 25 cm 的問題視為已知，只報告新增。
- `whitelist`（在 `baseline/<house>.json` 與全房子共通的 `baseline/_global.json`）：人手確認過的誤報或刻意設計，格式 `{check?, match(正規表達式), room?(正規表達式), note}`，`match` 對「物件名 ＋ 零件名 ＋ 說明」比對。**`--update-baseline` 不會覆寫 whitelist**。每筆都要寫 `note`（為什麼不是問題）。
- 確認某筆是真問題但暫不修：留在 `known`，`known[].note` 可補註。

## 新增一條檢查

1. 在 `checks/` 寫一個純函式 `(ctx, scan, opt) => issue[]`，只用 `ctx`（`ctx.w` 是 `__walk`、`ctx.THREE`、`ctx.scan()` 的 `meshes[{mesh, box, owner, size}]`、`ctx.allWallCols()`、`ctx.roomOf()`、`ctx.partName()`）與 `lib/util.js` 的 `issue()`；不要 `require` 其他東西（要能被 `lib/bundle.js` 打包到瀏覽器執行）。
2. 在 `run.js` 的 `GROUPS`／`ALIAS` 登記名稱，在 `runHouse` 加一行 `if (want.has('xxx')) run('xxx', ...)`；`lib/report.js` 的 `CHECK_LABEL` 加顯示名；要在實機交叉比對時，把名稱加進 `lib/bundle.js`。
3. 誤報用 `baseline/_global.json` 白名單處理，不要在檢查裡硬寫物件名。

## 已知限制

- `ctype.html` 用的是另一套引擎（沒有 `lib/storeys.js`，場景變數不外露），目前只支援視覺層的截圖。
- 以世界 AABB 判斷：斜放（非 90°）的長物件會高估範圍；牆是引擎的碰撞箱而不是畫出來的牆面，壁龕（凹進去的裝飾）會被當成牆內。
- 浮空與連續性無法分辨「刻意分離的零件」（衣架上的衣服、成套桌椅、盆栽與花盆），靠白名單處理。
- 互動只模擬 `act()`／動畫函式，不經過畫面操作；`setTimeout` 用虛擬時鐘推進。持續動畫（烹飪、清掃）會被標為「14 秒仍在動」（低）。
- 材質、光線、陰影、鏡面反射等純視覺問題只能靠截圖與基準比對。
- 截圖用 SwiftShader 軟體渲染，每房子約 3～7 分鐘；`--browser-check` 不跑互動檢查（`setTimeout` 動畫需要真實時間）。
- 可達性只看平面碰撞，不判斷玩家能不能「看到」或「按到」互動按鈕。

## 建議加入房子程式的斷言（本工具不修改房子與 lib）

以下是在開發模式（網址有 `#debug`）才啟用、發現問題時 `console.warn` 並指出物件名稱與座標的建議。位置以函式名稱表示。

| 斷言 | 加在哪 | 內容 | 估計工作量 |
|---|---|---|---|
| 貼牆物件整件在牆線段內 | `lib/storeys.js` 的 `framedMirror`、`placeItem`（`info.wall` 的件）、`wallSnap`（`Walk.snapToWalls` 的呼叫端）；`ideal_c.html` 3F 走廊的相框區塊（`frame` 這個區域函式）與其他房子自寫的 `B(...)` 相框／層板 | 掛上去時用 `walls` 碰撞箱算背面覆蓋率（同 `mount` 檢查），低於 90% 就 warn，附物件名與座標 | 0.5 日（共用一個 `assertMounted(box)` 放在 `lib/storeys.js`，各處呼叫一行） |
| 固定設備／家具不穿牆 | `fixture()`、`placeItem()`（`lib/storeys.js`） | 建好後用 `piece.group` 的世界包圍盒對牆碰撞箱求最小重疊，> 2.5 cm warn | 0.5 日 |
| 門扇形與家具重疊 | `makeDoor`／`makeSlide`（建立時）與 `FS.apply`（`lib/furniture.js`，家具被搬動時） | 把門扇當線段在 0～100% 掃一遍，撞到家具碰撞矩形就 warn（同 `door-sweep`） | 0.5 日 |
| 門與門互相撞 | `makeDoor` 完成後的 `doors` 迴圈（`lib/storeys.js` 的 `H.build(E)` 之後） | 同一層、距離 < 2.5 m 的門兩兩掃 | 0.25 日 |
| 互動動畫終點等於起點／無作用 | `placeItem` 與 `fixture` 裡包裝 `a.act` 的那段（`furnThings.push`）；`ideal_c.html` 自寫的 `acts(label,G,parts,set,pt,on,verb)` | debug 模式下 `act()` 前後各記錄 `part` 的世界位置，兩次都沒變就 warn；第二次 `act()` 沒回到第一次前的位置也 warn | 0.5 日 |
| 窗簾總開關等「標籤變了但沒有東西動」 | 同上 | 同上（標籤改變＋零位移） | 含在上一項 |
| 組件連續性 | `lib/catalog.js` 的 `Catalog.make`（每個 Piece 建好後） | 對 `piece.group` 的 mesh 用 1 cm 容差連圖，非單一連通塊就 warn，附白名單（`piece.allowSplit = true`） | 0.5 日 |
| 可達性 | `setLayout`／`FS.apply` 之後（`lib/storeys.js`） | 把 `tools/qa/checks/access.js` 的洪水填充搬一份簡化版，家具被搬動後確認每個房間仍連通 | 0.5 日 |

目前已發現的實例：電動躺椅沙發（`Catalog.reclinerSofa`，`lib/catalog.js`）扶手內側從 z=±0.89 開始，但椅座與座框到 ±0.84／±0.86 為止，左右各留 3～5 cm 的縫，見 `continuity` 檢查結果。
