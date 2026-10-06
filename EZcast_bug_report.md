# EZcast Bug Report

- **測試對象**：EZ Cast v1.1.0（Electron + React 19 + Vite，`/Users/tingrongsu/Desktop/EZ Cast`）。這是影視劇組的演員／服裝／拍攝場次管理 App，不是螢幕投影軟體，所以測試模組依實際功能盤點。
- **測試日期**：2026-10-07
- **測試方式**：靜態程式碼審查、`tsc -b`、`oxlint`、`vite build`、對 `願望_showcase.cast` 做資料完整性檢查，以及用 Node 驗證日期與字元邏輯。
- **限制**：這個環境無法操作 GUI（點擊、拖曳、原生對話框、實際列印 PDF）。UI 類 Bug 是從程式碼推導的，已標註（推導）。實測確認的項目標註（已驗證）。
- **建置結果**：`tsc -b` 0 錯誤，`vite build` 成功，`oxlint` 0 錯誤、4 警告。
- **模組盤點**：①啟動頁／最近專案 ②專案檔 .cast 匯入／匯出／儲存 ③演員資料庫 ④服裝與定妝照 ⑤拍攝日期與場次表 ⑥演員指派與拖曳排序 ⑦PDF 匯出 ⑧Electron 主程序。
- **正常路徑結果**：`願望_showcase.cast`（4 位演員、3 個拍攝日）結構正確，沒有失效的演員／服裝參照。

---

### [專案檔儲存] 專案含大量照片時，localStorage 備份拋例外，導致「儲存」整個失敗（推導＋已驗證檔案大小）
- **嚴重等級**：High
- **重現步驟**：
  1. 匯入含多張照片的專案（示範檔 `願望_showcase.cast` 為 17,869,045 bytes）
  2. 修改任一欄位後按「儲存」
- **預期行為**：資料寫入原 .cast 檔；localStorage 備份失敗也不能影響存檔
- **實際行為**：`handleLocalSave` 在寫檔前先執行 `localStorage.setItem('ezcast_save', ...)`，沒有 try/catch。資料超過瀏覽器配額（約 5–10 MB）時拋出 QuotaExceededError，後面的寫檔程式不會執行，也沒有任何提示
- **核心錯誤日誌**：
  ```
  src/App.tsx:99  localStorage.setItem('ezcast_save', JSON.stringify(data));  // 無 try/catch
  DOMException: QuotaExceededError (預期)
  ```

### [專案檔匯入] 匯入檔案失敗時沒有任何錯誤提示，且不驗證結構
- **嚴重等級**：High
- **重現步驟**：
  1. 準備內容為 `{"actors":"x"}` 或不是 JSON 的 .cast 檔
  2. 按「匯入.cast」或啟動頁的「開啟專案.cast」
- **預期行為**：顯示「檔案格式錯誤」，現有資料不變
- **實際行為**：`JSON.parse` 失敗時只有 `console.error`，使用者看不到任何訊息。若 `actors` 不是陣列，`setActors("x")` 會讓 `actors.map` 崩潰，造成整頁白屏。匯入也不會重設缺少的欄位，結果新舊資料混在一起
- **核心錯誤日誌**：
  ```
  src/App.tsx:125-127  if (data.actors) setActors(data.actors);  // 無型別檢查
  TypeError: actors.map is not a function (預期)
  ```

### [服裝管理] 刪除服裝後再新增，預設名稱重複，並繞過重複名稱檢查（已驗證）
- **嚴重等級**：Medium
- **重現步驟**：
  1. 演員有「服裝A」「服裝B」
  2. 刪除「服裝A」
  3. 按「新增服裝」
- **預期行為**：產生不重複的名稱（例如「服裝C」）
- **實際行為**：新名稱由 `65 + costumes.length` 決定，結果又是「服裝B」，與既有服裝重複。這條路徑不會觸發 `handleChangeCostumeName` 的重複檢查。服裝超過 26 套時，`String.fromCharCode(65+26)` 會產生 `[`，名稱變成「服裝[」
- **核心錯誤日誌**：
  ```
  src/pages/ActorsPage.tsx:279  String.fromCharCode(65 + actor.costumes.length)
  ```

### [資料一致性] 刪除演員或服裝後，拍攝場次殘留失效的演員指派
- **嚴重等級**：Medium
- **重現步驟**：
  1. 在場次中指派「演員X - 服裝A」
  2. 到演員頁刪除該服裝（或刪除演員）
  3. 回到場次頁並匯出 PDF
- **預期行為**：相關指派一併移除，或提示「此服裝已被使用」
- **實際行為**：`removeActor` 和 `handleDeleteCostume` 都沒有清理 `scene.actors`。刪除演員後，場次頁出現空白的演員標籤（`getActorLabel` 回傳 `''`），PDF 的演員欄出現空的 `<li>`。刪除服裝後，標籤只剩「演員 - 」
- **核心錯誤日誌**：
  ```
  AppContext.tsx:145  removeActor -> 只 filter actors
  ActorsPage.tsx:286  handleDeleteCostume -> 只更新 costumes
  ```

### [日期顯示] 在 UTC 以西時區，星期幾顯示錯誤一天（已驗證）
- **嚴重等級**：Medium
- **重現步驟**：
  1. 系統時區設為美洲（例如 America/New_York）
  2. 將拍攝日期設為 2026-11-09（星期一）
- **預期行為**：顯示「星期一」
- **實際行為**：顯示「星期日」。`new Date('YYYY-MM-DD')` 會被當成 UTC 午夜解析。PDF 的 `formatDate` 有加 `T00:00:00`，所以 UI 與 PDF 的星期可能不一致
- **核心錯誤日誌**：
  ```
  TZ=America/New_York  new Date('2026-11-09').toLocaleDateString('zh-TW',{weekday:'long'}) => 星期日
  src/pages/SchedulePage.tsx:380  new Date(dateString)
  ```

### [定妝照上傳] 刪除照片後無法重新選同一張檔案（推導）
- **嚴重等級**：Low
- **重現步驟**：
  1. 為服裝上傳 a.jpg
  2. 刪除照片
  3. 再次選擇 a.jpg
- **預期行為**：照片重新載入
- **實際行為**：`<input type="file">` 沒有在選擇後清空 `value`，同一個檔案不會再觸發 `onChange`，看起來點了沒反應
- **核心錯誤日誌**：
  ```
  src/pages/ActorsPage.tsx:68  onChange={(e) => ... handlePhotoUpload(actorId, costume.id, e.target.files[0])}  // 未重設 e.target.value
  ```

### [狀態更新] 上傳照片使用過期的 actors 快照，可能覆蓋期間的編輯（推導）
- **嚴重等級**：Low
- **重現步驟**：
  1. 上傳大尺寸服裝照片
  2. 在 FileReader 讀取完成前，編輯該演員的其他欄位或服裝名稱
- **預期行為**：兩項修改都保留
- **實際行為**：`reader.onload` 內使用事件發生當下的 `actors`，`updateActor` 也是 `setActors(actors.map(...))` 這種非函式式更新，所以較早的修改可能被舊資料覆蓋
- **核心錯誤日誌**：
  ```
  AppContext.tsx:142  setActors(actors.map(...))   // 非 functional update
  ActorsPage.tsx:266  actors.find(...)             // 在非同步 callback 中讀取舊 state
  ```

### [時間欄位] 只選「時」沒選「分」時，時間會在 PDF 中遺失，也無法清除時間（推導）
- **嚴重等級**：Low
- **重現步驟**：
  1. 場次時間只選 hh=09，不選 mm
  2. 匯出 PDF
- **預期行為**：顯示 09:00，或提示必須兩者都選
- **實際行為**：PDF 時間欄為空，因為條件是 `timeHour && timeMinute`，否則退回舊的 `time` 欄位。下拉選單的 placeholder 是 `disabled`，選了之後無法清回空白
- **核心錯誤日誌**：
  ```
  src/components/pdf/PrintDocument.tsx:118  s.timeHour && s.timeMinute ? ... : (s.time || '')
  ```

### [最近專案] 未命名專案會重複建立紀錄，同名不同檔案會互相覆蓋
- **嚴重等級**：Low
- **重現步驟**：
  1. 將電影名稱清空後儲存兩次
  2. 或儲存兩個不同路徑、同名的專案
- **預期行為**：以檔案為單位更新紀錄
- **實際行為**：查找用 `r.name === name`，但存入時 `name || '未命名專案'`。名稱為空字串時永遠找不到舊紀錄，每次存檔都新增一筆。同名的不同檔案則共用同一個 id，後者的 fileHandle 會覆蓋前者
- **核心錯誤日誌**：
  ```
  src/store/recentProjects.ts:59  results.find(r => r.name === name)
  src/store/recentProjects.ts:66  name: name || '未命名專案'
  ```

### [新增日期] `dayNumber` 在刪除日期後與實際順序脫節
- **嚴重等級**：Low
- **重現步驟**：
  1. 建立 DAY 1、2、3，刪除 DAY 2
  2. 新增日期
- **預期行為**：資料中的 `dayNumber` 與顯示順序一致
- **實際行為**：新日期的 `dayNumber = length + 1`，結果是 3，與既有的 DAY 3 重複。UI 與 PDF 用陣列索引顯示，所以畫面看不出來，但存檔的 JSON 裡編號重複，且拖曳排序後也不會更新
- **核心錯誤日誌**：
  ```
  src/store/AppContext.tsx:160  dayNumber: scheduleDays.length + 1
  ```

### [Electron 安全性] 啟用 nodeIntegration 並關閉 contextIsolation
- **嚴重等級**：Medium
- **重現步驟**：
  1. 檢視 `electron-main.cjs` 的 `webPreferences`
- **預期行為**：`nodeIntegration: false`、`contextIsolation: true`，並透過 preload 暴露 `export-pdf`
- **實際行為**：渲染程序可直接使用 Node API。PDF 匯出就是靠 `window.require('electron')` 取得 ipcRenderer。只要 .cast 匯入或第三方依賴出現 XSS，就可能被升級成本機任意程式執行
- **核心錯誤日誌**：
  ```
  electron-main.cjs:11-12  nodeIntegration: true, contextIsolation: false
  ```

### [程式品質] oxlint 4 個警告
- **嚴重等級**：Low
- **重現步驟**：`npx oxlint`
- **預期行為**：0 警告
- **實際行為**：
  - `App.tsx:108` 與 `SchedulePage.tsx:309`：catch 參數未使用。`App.tsx:108` 的儲存失敗連錯誤原因都沒有記錄
  - `ActorsPage.tsx:24`：在 effect 中同步呼叫 setState（`react(set-state-in-effect)`）
  - `AppContext.tsx:311`：`useAppContext` 的匯出方式觸發 fast-refresh 警告
- **核心錯誤日誌**：
  ```
  eslint(no-unused-vars): Catch parameter 'e' is caught but never used.
  react(set-state-in-effect): Calling setState synchronously within an effect
  ```

---

## 未能測試（需要 GUI／實機）
- PDF 實際輸出：A3／A4 版面、灰階、頁碼「第N頁，共M頁」、標楷體字型、照片是否失真或疊圖
- 拖曳排序（演員、日期、場次、定妝照）
- File System Access API 在 Electron 44 的行為，以及 IndexedDB 還原 fileHandle 後的權限請求
