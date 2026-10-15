-- 排程設定（含專案專屬值，所以不放進 migration，請在 SQL Editor 手動執行一次）。
-- 前置：Dashboard → Database → Extensions 啟用 pg_cron、pg_net。
-- 1) 設定函式 secret：supabase secrets set CRON_SECRET=<隨機長字串>
-- 2) 把下面的 <PROJECT_REF> 與 <CRON_SECRET> 換成實際值。
select cron.schedule(
  'cleanup-rooms',
  '30 seconds',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-rooms',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
  );
  $$
);
