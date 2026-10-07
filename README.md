# Ctype 屋內漫步

3D 看房頁面（three.js）。

## 結構

- `index.html`: 房子切換外殼。每棟房子是獨立頁面，用 iframe 載入（第一次切換時才載入，之後保留，切換即時）。清單在檔案內的 `HOUSES`。
- `ctype.html`: Ctype 這一棟，可單獨開啟。選單裡的「房子」區塊在被外殼載入時才會出現。
- `lib/people.js`: 共用的人物（站姿／坐姿、臉、頭髮、衣服、姿勢預設）。`Walk.People(THREE,lam,fab)`。
- `lib/furniture.js`: 共用的家具系統（移動、旋轉、碰撞、收進物品庫、縮圖、存檔、人物跟隨用的座標換算）。`Walk.FurnitureSystem(host)`，UI 由 `initUI(host)` 自己產生。
- 這些檔案是普通的 `<script>`（不是 ES module），所以用 `file://` 也能載入。
- 新增房子：放一個獨立的 `xxx.html`（貼圖、模型沿用 `textures/`、`models/`），在 `HOUSES` 加一筆；localStorage 的 key 要用各自的前綴（Ctype 用 `ctypeFurn.v1`、`ctypeLayout`）。

## 貼圖出處（`textures/`）

- [Poly Haven](https://polyhaven.com/)（CC0）: laminate_floor_02, wood_floor, white_planks_clean, plastered_wall, jogging_melange（法線・色）, rough_linen（色）, oak_veneer_01, oak_veneer_03
- [ambientCG](https://ambientcg.com/)（CC0）: Tiles107, Tiles141, Tiles040, Tiles133A, Tiles105, Tiles071, Concrete031, Concrete008, Marble021

直接用 `file://` 開啟時瀏覽器不允許載入貼圖，會自動改用程式繪製的材質；請用網址（http/https）開啟以看到完整質感。

## 3D モデル（`models/`）

- `GlamVelvetSofa.glb`: © 2021 Wayfair, LLC — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。[KhronosGroup/glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlamVelvetSofa) より。長さ 1.8 m に縮小し、布の色を青に変更して使用。
