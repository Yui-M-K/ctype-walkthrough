# Ctype 屋內漫步

3D 看房頁面（three.js r186，以 ES module 從 jsDelivr 載入；`lib/` 底下的共用檔仍是一般 `<script>`，three.js 由各房子傳進去）。

## 結構

- `index.html`: 房子切換外殼。每棟房子是獨立頁面，用 iframe 載入（第一次切換時才載入，之後保留，切換即時）。清單在檔案內的 `HOUSES`。
- `ctype.html`: Ctype 這一棟，可單獨開啟。選單裡的「房子」區塊在被外殼載入時才會出現。
- `town3f.html`: 三層透天厝（依參考格局圖推算的草案。多樓層、直跑階梯，俯瞰時可切換樓層）。
- `ideal.html`: 理想之家。依 `住宅要望書` 設計、縮成東京常見尺寸的三層透天（建物 5.8 × 7.0 m、三層合計約 122 m²、土地約 28 坪）：1F 鏡子房兼收納（整面收納櫃・鏡牆・緣側）＋玄關貓用柵欄（防脫逃）＋車庫（Tesla 充電樁＋後段收納）；2F 約 20 帖整層 LDK（地暖開關、間接照明、對面式廚房、貓走道、摺疊餐桌）＋廁所＋陽台；3F 主臥＋更衣間＋書房（日後可當小孩房）＋浴室（浴缸＋單人三溫暖）＋洗面脫衣室＋廁所。全室無段差、拉門為主、樓梯雙側扶手＋感應腳燈、主臥窗簾依日照自動開關。平面以公分為單位（`SX=SZ=0.01`）。存檔 key `idealSmall.v1`、`idealLayout`。
- `ideal_wide.html`: 理想之家（寬敞版）。縮小前的版本（6.3 × 8.5 m、土地約 52 坪；1F 多功能室＋納戸、2F 浴室）。存檔 key `idealFurn.v2`、`idealWideLayout`。
- `lib/storeys.js` ＋ `lib/storeys.css`: 多樓層房子（`town3f.html`、`ideal.html`、`ideal_wide.html`）共用的引擎與畫面樣式 `Walk.Storeys(T,H)`：渲染與材質、牆／門窗／拉門、樓梯與扶手（`handrail`、`glassGuard`、沿坡度的 `stairGuard`；扶手 LED 與天花板間接照明會在牆面／天花板打出暈光 `glowQuad`，白天淡、傍晚與就寢時依情境變化）、家具擺放、燈光、窗簾、走路與碰撞、小地圖、選單、生活模式的共用部分、效能處理。房子頁面只傳入 three.js 模組 `T` 與房子描述 `H`：尺寸單位（`SX`/`SZ`/`LV`）、房間 `rooms`、重點牆 `accents`、各區塊的建構函式（`build` 格局、`stair` 樓梯位置、`stairExtras` 扶手與護欄、`site` 庭院、`layout`/`layout2` 家具、`fixtures` 固定設備、`lighting` 燈具、`modes` 生活模式）與視角設定。建構函式收到 `E`（引擎內所有函式與變數，例如 `E.wall`、`E.Catalog`、`E.curLayout`），修改引擎一次，所有房子同時生效
- `sw.js`: 離線快取（Service Worker，由 `index.html` 與 `lib/perf.js` 註冊）。貼圖、模型、three.js 程式庫先用快取、背景再更新；網頁與程式有網路時一律抓最新版，沒網路才用快取。要讓所有人強制重新下載貼圖時，把檔案開頭的 `CACHE` 版本號加一
- `lib/people.js`: 共用的人物（站姿／坐姿、臉、頭髮、衣服、姿勢預設）。`Walk.People(THREE,lam,fab)`。
- `lib/furniture.js`: 共用的家具系統（移動、旋轉、碰撞、收進物品庫、從型錄拿新的一件、縮圖、存檔、人物跟隨用的座標換算）。`Walk.FurnitureSystem(host)`，UI 由 `initUI(host)` 自己產生。多樓層的房子另外提供 `setLevel` / `dropLevel`，家具可以搬到別的樓層。從型錄拿出來的「額外的一件」存在存檔的 `__x`，收回物品庫時直接刪除。
- `lib/catalog.js`: 共用的家具庫。每件家具尺寸固定、用公尺、以自己的中心為原點畫出來。**登錄表 `Catalog.TYPES`**（id、名稱、分類、正面朝向）是所有可放置家具的清單：`Catalog.make(id)` 產生一件，`Catalog.turnsToFace(id,'N'|'E'|'S'|'W')` 算出要轉幾個 90° 才會面向那個方位，物品庫的「型錄」也直接讀這張表。新增家具 = 寫一個產生函式 + 在 `TYPES` 登記一筆。**分類原則：搬家會帶走的（家具、冰箱、洗衣機、家電櫃…）＝登錄表裡的可移動家具，兩棟共用同一個物件；搬家帶不走的（浴缸、馬桶、洗面台、流理台、窗簾軌道…）＝內建設備，各房子用 `fixture()` 固定放置，不出現在物品庫。**目前有：沙發、茶几、餐桌組、電視櫃（含電視）、床、床頭櫃、棚付きヘッドボード、書桌（含 3D 列印機動畫）、辦公椅、書架、椅子、植物、邊桌、立燈、條紋地毯、行李箱、冰箱（60 cm／70 cm 可開門有食物）、洗衣機（滾筒洗脫烘）、鞋櫃、升降桌、圓地毯、貓（虎斑／灰）、貓耳吊床、貓屋、貓跳台、貓抓柱、貓碗、自動貓砂盆、鞋子、畫（三種尺寸）、L 型沙發、按摩椅、摺疊大餐桌（可展開）、家事作業台、世界地圖、貓窗台吊床、電動升降桌（單人／雙人）、嬰兒床、矮書櫃、電風扇、除濕機、掃地機器人（可啟動）、雙人家用三溫暖、掃除用具櫃、分類垃圾桶、防災備品架、傘架、BBQ 烤爐、戶外桌椅、家電櫃（咖啡機可沖煮）、牆上層板、全身鏡（真的會反射）、吊衣桿與衣服、開放鞋架、毛巾、腳踏墊、Tesla Model 3。登錄時標 `wall:true` 的是掛牆家具（畫、貓牆），擺放模式拖曳時會自動吸到最近的牆面並朝向房間（房子提供 `wallSnap`，共用的計算在 `Walk.snapToWalls`）。會動、能操作的家具用 `piece.anims`（每幀呼叫，有在動就回傳 true）與 `piece.actions`（`{x,z,label(),act()}`，家具自己座標系裡的位置）對外提供，房子只負責把它們接到每幀更新與畫面下方的操作按鈕。流理台、門窗等跟建築綁在一起的東西不算家具，留在各房子裡。`Walk.Catalog(env)` 需要房子提供材質（`M` 的各個欄位）、`lam`/`fab`、亂數、接地影等。
- 植栽（`lib/catalog.js` 的 `gardenTree`／`shrub`／`plant`）：庭樹與灌木是分岔的樹幹加上數百片程式繪製的葉叢卡片（每個樹冠一個 `InstancedMesh`，一次繪製，影子有葉隙），室內盆栽是有葉脈貼圖的琴葉榕
- `lib/look.js`: 共用的畫面質感與鏡子 `Walk.planarMirror`：實拍 HDR 環境光（`textures/env_lebombo_512.hdr`，載不到時沿用各房子的漸層環境）、環境光遮蔽 GTAO（選單可開關，手機預設關、畫面太卡會自動關，俯瞰時不套用）、布料的絨光材質 `Walk.fabricMaterial`。燈光強度已換成 three.js r155 以後的物理單位（環境光／平行光 ×π，天花板點光另乘係數）。
- `lib/perf.js`: 共用的效能處理 `Walk.Perf`：載入後把每個群組內不會動的零件依材質合併（家具、門、版面切換仍以群組為單位運作；有動畫的家具不合併）、靜態家具內相同設定的材質共用、小物件不投影、點光源固定只開最近的 16 盞（切換時不重新編譯著色器）、畫面沒變化時降到約 12 fps、移動中降解析度、持續卡頓時依序關 AO → 降解析度 → 降陰影解析度，以及選單裡的 FPS 顯示。鏡子的反射最多 20 fps、只畫鏡前 8 m 以內、靜止時更慢，鏡中鏡不再重畫。另有：載入畫面顯示貼圖下載進度（`Perf.LoadStatus`，貼圖數由 `lib/finish.js` 的 `onProgress`／`whenLoaded()` 提供），貼圖全部到齊後才編譯著色器（避免進入後再重編一次）；著色器在載入畫面期間於背景編譯（含鏡子用的版本與每面鏡子的首次繪製）、遠處的小零件依畫面大小自動不畫、首頁切換時隱藏中的房子暫停繪製、Retina 螢幕不開 MSAA 並優先用獨立顯示卡。實拍貼圖另有 GPU 壓縮版 `textures/*.ktx2`（清單在 `textures/ktx2.json`），由 `lib/finish.js` 優先載入，不支援或載入失敗時自動改用 `.jpg`。新增或修改貼圖後用 `basisu -etc1s -q 255 -comp_level 4 -mipmap -y_flip`（顏色圖加 `-srgb -mip_srgb`，法線圖加 `-linear -normal_map`）重新轉檔並更新清單；邊長須為 4 的倍數
- `lib/finish.js`: 共用的裝潢：三種配色主題 `Walk.THEMES`（牆面依「角色」上色：oat 主牆、sage／mist／peach 重點牆、hall、genkan、wc、bath…，各房子自己決定哪面牆是哪個角色）與實拍貼圖（木地板、磁磚、牆面、布料、木皮）。`Walk.Finish({...})` 回傳 `applyPalette`、`mapMat` 等。依建築尺寸做的內建設備也在 `lib/catalog.js` 但不在登錄表裡：窗簾 `curtains(寬)`、庭院樹木 `gardenTree`／灌木 `shrub`、牆掛摺疊桌 `wallFoldTable`、充電樁 `evCharger`、防盜攝影機 `securityCamera`、吸頂燈 `ceilingLight(天花板高)`、流理台 `sinkCounter(長,深,水槽位置,門數)`、IH 爐 `ihHob`、水龍頭 `mixerTap`、瀝水架 `dishRack`、洗碗精 `dishSoap`、抽油煙機 `rangeHood(天花板高)`、浴室牆面組 `bathWallSet`（檯面、沐浴用品、恆溫龍頭、淋浴桿）。房子用自己的 `fixture()` 放，碰撞變成固定障礙物。
- 這些檔案是普通的 `<script>`（不是 ES module），所以用 `file://` 也能載入。
- 新增房子：放一個獨立的 `xxx.html`（貼圖、模型沿用 `textures/`、`models/`），在 `HOUSES` 加一筆；localStorage 的 key 要用各自的前綴（Ctype 用 `ctypeFurn.v1`、`ctypeLayout`；三層透天厝用 `town3fFurn.v1`）。

## 貼圖出處（`textures/`）

- [Poly Haven](https://polyhaven.com/)（CC0）: lebombo（HDRI，環境光）, laminate_floor_02, wood_floor, white_planks_clean, plastered_wall, jogging_melange（法線・色）, rough_linen（色）, oak_veneer_01, oak_veneer_03
- [ambientCG](https://ambientcg.com/)（CC0）: Tiles107, Tiles141, Tiles040, Tiles133A, Tiles105, Tiles071, Concrete031, Concrete008, Marble021

直接用 `file://` 開啟時瀏覽器不允許載入貼圖，會自動改用程式繪製的材質；請用網址（http/https）開啟以看到完整質感。

## 3D モデル（`models/`）

- `GlamVelvetSofa.glb`: © 2021 Wayfair, LLC — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。[KhronosGroup/glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlamVelvetSofa) より。長さ 1.8 m に縮小し、布の色を青に変更して使用。
