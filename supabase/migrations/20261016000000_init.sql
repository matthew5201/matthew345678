-- 匿名聊天室：資料表、RLS、RPC、Storage、Realtime
-- 設計說明見 docs/architecture.md

create extension if not exists pgcrypto with schema extensions;

-- ───────────────────────── 資料表 ─────────────────────────

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_at timestamptz not null default now(),
  closed_at timestamptz            -- 非 null：已關閉，等待排程刪除資料與檔案
);

create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null,
  nickname text not null check (char_length(nickname) between 1 and 24),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create unique index room_members_nickname_uq on public.room_members (room_id, lower(nickname));
create index room_members_last_seen_idx on public.room_members (last_seen_at);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid,                    -- 系統訊息為 null
  nickname text not null,          -- 發送當下的暱稱快照
  kind text not null check (kind in ('text', 'image', 'file', 'system')),
  content text not null default '' check (char_length(content) <= 4000),
  file_path text,
  file_name text,
  file_size bigint check (file_size is null or file_size <= 20971520),
  file_mime text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  check (kind not in ('image', 'file') or (file_path is not null and file_name is not null))
);
create index messages_room_created_idx on public.messages (room_id, created_at);

create table public.message_edits (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  content text not null,           -- 被取代的舊內容
  replaced_at timestamptz not null default now()
);
create index message_edits_message_idx on public.message_edits (message_id, replaced_at);

create table public.rate_events (
  user_id uuid not null,
  action text not null,
  at timestamptz not null default now()
);
create index rate_events_idx on public.rate_events (user_id, action, at);

-- ───────────────────────── 輔助函式 ─────────────────────────

create function public.is_room_member(p_room uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members m
    join public.rooms r on r.id = m.room_id
    where m.room_id = p_room and m.user_id = auth.uid() and r.closed_at is null
  );
$$;

-- 產生房間代碼：31 個易辨認字元（去掉 0/O、1/I/L）× 6 碼
create function public._gen_code()
returns text
language plpgsql
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := gen_random_bytes(6);
  result text := '';
  i int;
begin
  for i in 0..5 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;

create function public._check_rate(p_action text, p_max int, p_window interval)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  select count(*) into n from public.rate_events
   where user_id = uid and action = p_action and at > now() - p_window;
  if n >= p_max then
    raise exception 'RATE_LIMITED';
  end if;
  insert into public.rate_events (user_id, action) values (uid, p_action);
end;
$$;

create function public._clean_nickname(p_nickname text)
returns text
language plpgsql immutable
as $$
declare
  n text := btrim(coalesce(p_nickname, ''));
begin
  if char_length(n) < 1 or char_length(n) > 20 then
    raise exception 'INVALID_NICKNAME';
  end if;
  return n;
end;
$$;

-- ───────────────────────── 訊息 trigger ─────────────────────────
-- 非系統訊息：暱稱與發送者由伺服器決定，不信任前端；附件路徑必須在該房間資料夾內

create function public._messages_before_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  member_nick text;
begin
  if new.kind = 'system' then
    return new;
  end if;

  select nickname into member_nick from public.room_members
   where room_id = new.room_id and user_id = auth.uid();
  if member_nick is null then
    raise exception 'FORBIDDEN';
  end if;

  new.user_id := auth.uid();
  new.nickname := member_nick;
  new.edited_at := null;

  if new.kind in ('image', 'file') and new.file_path not like new.room_id::text || '/%' then
    raise exception 'FORBIDDEN';
  end if;
  if new.kind = 'text' and btrim(new.content) = '' then
    raise exception 'EMPTY_MESSAGE';
  end if;
  return new;
end;
$$;

create trigger messages_before_insert
before insert on public.messages
for each row execute function public._messages_before_insert();

-- ───────────────────────── RLS ─────────────────────────

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_edits enable row level security;
alter table public.rate_events enable row level security;

create policy rooms_select on public.rooms
  for select to authenticated using (public.is_room_member(id));

create policy members_select on public.room_members
  for select to authenticated using (public.is_room_member(room_id));

create policy messages_select on public.messages
  for select to authenticated using (public.is_room_member(room_id));

create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    public.is_room_member(room_id)
    and kind in ('text', 'image', 'file')
  );

create policy edits_select on public.message_edits
  for select to authenticated using (public.is_room_member(room_id));

-- rooms / room_members / message_edits / rate_events 沒有寫入政策：只能經由 RPC 變更。
-- messages 沒有 update / delete 政策：編輯只能經 edit_message。

-- ───────────────────────── RPC ─────────────────────────

create function public.create_room(p_nickname text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  nick text;
  new_room public.rooms;
  tries int := 0;
begin
  if uid is null then raise exception 'UNAUTHENTICATED'; end if;
  nick := public._clean_nickname(p_nickname);
  perform public._check_rate('create_room', 5, interval '1 minute');

  loop
    insert into public.rooms (code) values (public._gen_code())
    on conflict (code) do nothing
    returning * into new_room;
    exit when new_room.id is not null;
    tries := tries + 1;
    if tries > 20 then raise exception 'CODE_GENERATION_FAILED'; end if;
  end loop;

  insert into public.room_members (room_id, user_id, nickname) values (new_room.id, uid, nick);
  insert into public.messages (room_id, kind, nickname, content)
    values (new_room.id, 'system', nick, 'join');

  return json_build_object('room_id', new_room.id, 'code', new_room.code, 'nickname', nick, 'rejoined', false);
end;
$$;

create function public.join_room(p_code text, p_nickname text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.rooms;
  existing public.room_members;
  nick text;
  suggestion text;
  n int := 2;
begin
  if uid is null then raise exception 'UNAUTHENTICATED'; end if;
  perform public._check_rate('join_room', 30, interval '1 minute');

  -- 鎖住房間列，避免兩人同時搶最後一個名額
  select * into r from public.rooms
   where code = upper(btrim(coalesce(p_code, ''))) and closed_at is null
   for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  -- 已是成員：視為重連，保留原暱稱與身分
  select * into existing from public.room_members where room_id = r.id and user_id = uid;
  if found then
    update public.room_members set last_seen_at = now() where room_id = r.id and user_id = uid;
    return json_build_object('room_id', r.id, 'code', r.code, 'nickname', existing.nickname, 'rejoined', true);
  end if;

  nick := public._clean_nickname(p_nickname);

  if (select count(*) from public.room_members where room_id = r.id) >= 20 then
    raise exception 'ROOM_FULL';
  end if;

  if exists (select 1 from public.room_members where room_id = r.id and lower(nickname) = lower(nick)) then
    loop
      suggestion := nick || '#' || n;
      exit when not exists (
        select 1 from public.room_members where room_id = r.id and lower(nickname) = lower(suggestion)
      );
      n := n + 1;
    end loop;
    raise exception 'NICKNAME_TAKEN' using hint = suggestion;
  end if;

  insert into public.room_members (room_id, user_id, nickname) values (r.id, uid, nick);
  insert into public.messages (room_id, kind, nickname, content) values (r.id, 'system', nick, 'join');

  return json_build_object('room_id', r.id, 'code', r.code, 'nickname', nick, 'rejoined', false);
end;
$$;

-- 心跳：回傳 false 代表自己已不在房間（逾時被移除或房間已關閉）
create function public.heartbeat(p_room uuid)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  hit int;
begin
  update public.room_members m set last_seen_at = now()
   from public.rooms r
   where m.room_id = p_room and m.user_id = auth.uid()
     and r.id = m.room_id and r.closed_at is null;
  get diagnostics hit = row_count;
  return hit > 0;
end;
$$;

create function public.leave_room(p_room uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  gone public.room_members;
begin
  delete from public.room_members
   where room_id = p_room and user_id = auth.uid()
   returning * into gone;
  if not found then return; end if;

  insert into public.messages (room_id, kind, nickname, content)
    values (p_room, 'system', gone.nickname, 'leave');

  -- 沒人了：標記關閉，由排程刪除檔案與資料
  if not exists (select 1 from public.room_members where room_id = p_room) then
    update public.rooms set closed_at = now() where id = p_room and closed_at is null;
  end if;
end;
$$;

create function public.edit_message(p_id uuid, p_content text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  m public.messages;
  new_content text := btrim(coalesce(p_content, ''));
begin
  select * into m from public.messages where id = p_id for update;
  if not found or m.user_id is distinct from auth.uid() or m.kind <> 'text'
     or not public.is_room_member(m.room_id) then
    raise exception 'FORBIDDEN';
  end if;
  if new_content = '' or char_length(new_content) > 4000 then
    raise exception 'EMPTY_MESSAGE';
  end if;
  if new_content = m.content then return; end if;

  insert into public.message_edits (message_id, room_id, content) values (m.id, m.room_id, m.content);
  update public.messages set content = new_content, edited_at = now() where id = m.id;
end;
$$;

-- 排程用（僅 service_role）：
-- 1. 移除失聯超過 10 分鐘的成員並寫入「離開」訊息
-- 2. 關閉沒有任何「近 60 秒內有心跳」成員的房間（含空房間與全員斷線）
-- 3. 回傳所有待刪除（已關閉）的房間 id；Edge Function 會先刪檔案再刪房間
create function public.sweep_rooms()
returns setof uuid
language plpgsql security definer
set search_path = public
as $$
begin
  with gone as (
    delete from public.room_members
     where last_seen_at < now() - interval '10 minutes'
    returning room_id, nickname
  )
  insert into public.messages (room_id, kind, nickname, content)
  select room_id, 'system', nickname, 'leave' from gone;

  update public.rooms r set closed_at = now()
   where r.closed_at is null
     and not exists (
       select 1 from public.room_members m
        where m.room_id = r.id and m.last_seen_at >= now() - interval '60 seconds'
     );

  delete from public.rate_events where at < now() - interval '10 minutes';

  return query select id from public.rooms where closed_at is not null;
end;
$$;

-- 權限：RPC 只給登入（含匿名）使用者；sweep_rooms 只給 service_role
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.create_room(text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.heartbeat(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;
grant execute on function public.edit_message(uuid, text) to authenticated;
grant execute on function public.is_room_member(uuid) to authenticated;
grant execute on function public.sweep_rooms() to service_role;

-- ───────────────────────── Realtime ─────────────────────────
-- 只發布 messages（RLS 會套用）。room_members 不發布：DELETE 事件不受 RLS 過濾，
-- 成員名單改由「系統訊息（加入／離開）」觸發前端重新抓取。
alter publication supabase_realtime add table public.messages;

-- Presence 頻道 `room:<代碼>` 為私有頻道，只有該房成員能收發
create policy room_presence_select on realtime.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.rooms r
       where 'room:' || r.code = (select realtime.topic())
         and public.is_room_member(r.id)
    )
  );

create policy room_presence_insert on realtime.messages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.rooms r
       where 'room:' || r.code = (select realtime.topic())
         and public.is_room_member(r.id)
    )
  );

-- ───────────────────────── Storage ─────────────────────────

insert into storage.buckets (id, name, public, file_size_limit)
values ('room-files', 'room-files', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

-- 路徑第一段必須是 room_id，且呼叫者是該房成員
create policy room_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'room-files'
    and public.is_room_member(((storage.foldername(name))[1])::uuid)
  );

create policy room_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'room-files'
    and public.is_room_member(((storage.foldername(name))[1])::uuid)
  );
