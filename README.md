# 匿名聊天室

免註冊的即時聊天室：填暱稱 → 建立房間（取得代碼）或輸入代碼加入。支援文字、圖片、表情符號、檔案（≤ 20MB），訊息可編輯並保留舊版本，所有人離開後房間與內容全部清除。

設計與取捨見 [docs/architecture.md](docs/architecture.md)。

## 設定 Supabase

1. 建立 Supabase 專案，Authentication → Providers 啟用 **Anonymous Sign-Ins**（建議同時開 CAPTCHA）。
2. 套用資料庫結構：`supabase db push`（或把 `supabase/migrations/*.sql` 貼到 SQL Editor 執行）。
3. 部署清理函式：
   ```
   supabase secrets set CRON_SECRET=<隨機長字串>
   supabase functions deploy cleanup-rooms --no-verify-jwt
   ```
4. 啟用 `pg_cron`、`pg_net` extension，然後依 [supabase/cron.sql](supabase/cron.sql) 的說明建立每 30 秒的排程。
5. 前端環境變數：`cp .env.example .env`，填入專案 URL 與 anon key。**不要**把 service_role key 放進前端或提交到 git。

## 開發

```
npm install
npm run dev        # 開發伺服器
npm run typecheck
npm test
npm run build
```
