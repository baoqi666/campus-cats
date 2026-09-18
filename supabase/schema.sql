-- ============================================================
-- 校园小猫信息记录网站 - 数据库结构
-- 在 Supabase 控制台的 SQL Editor 里一次性执行本文件即可
-- ============================================================

-- 1) 猫咪主表
create table if not exists cats (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  gender      text check (gender in ('公','母','未知')),
  breed       text,
  status      text not null default '在校' check (status in ('在校','已领养','失踪','去世')),
  birth_est   date,
  personality text,
  cover_url   text,
  created_at  timestamptz default now()
);

-- 2) 常出没地点（一只猫可多条）
create table if not exists cat_locations (
  id         uuid primary key default gen_random_uuid(),
  cat_id     uuid references cats(id) on delete cascade,
  area_name  text not null,
  note       text,
  frequency  text check (frequency in ('偶尔','经常','常驻')),
  created_at timestamptz default now()
);

-- 3) 猫际关系
create table if not exists cat_relationships (
  id       uuid primary key default gen_random_uuid(),
  cat_a    uuid references cats(id) on delete cascade,
  cat_b    uuid references cats(id) on delete cascade,
  rel_type text not null check (rel_type in ('母子','父子','兄弟姐妹','情侣','同窝','其他')),
  note     text,
  created_at timestamptz default now(),
  check (cat_a <> cat_b)
);

-- 4) 健康记录（按类型分表记录，各自带日期）
create table if not exists health_records (
  id       uuid primary key default gen_random_uuid(),
  cat_id   uuid references cats(id) on delete cascade,
  rec_type text not null check (rec_type in ('绝育','病史','驱虫','疫苗')),
  rec_date date,
  detail   text,
  vet      text,
  created_at timestamptz default now()
);

-- 5) 用户上传 / 目击（关联已知猫，或留空表示“新猫”）
create table if not exists sightings (
  id           uuid primary key default gen_random_uuid(),
  cat_id       uuid references cats(id) on delete set null,
  photo_urls   text[] default '{}',
  location_note text,
  note         text,
  reporter_name text,
  status       text not null default '待审核' check (status in ('待审核','已发布','已拒绝')),
  created_at   timestamptz default now()
);

-- 6) 筹款项目
create table if not exists campaigns (
  id         uuid primary key default gen_random_uuid(),
  cat_id     uuid references cats(id) on delete set null,
  title      text not null,
  reason     text,
  goal_amount numeric not null default 0,
  deadline   date,
  cover_url  text,
  status     text not null default '进行中' check (status in ('进行中','已结束','已暂停')),
  created_at timestamptz default now()
);

-- 7) 捐款记录（进度由这些记录汇总；实际收款走外部）
create table if not exists donations (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  amount      numeric not null,
  donor_name  text,
  message     text,
  anonymous   boolean default false,
  created_at  timestamptz default now()
);

-- 8) 管理员邮箱表
create table if not exists admins (
  email text primary key
);
-- 把下面的邮箱改成你自己的管理员邮箱（可加多行）
insert into admins (email) values ('admin@example.com') on conflict do nothing;

-- ============================================================
-- 行级安全（RLS）：公开可读，仅管理员可写
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from admins where email = auth.email());
$$;

alter table cats            enable row level security;
alter table cat_locations   enable row level security;
alter table cat_relationships enable row level security;
alter table health_records  enable row level security;
alter table sightings       enable row level security;
alter table campaigns        enable row level security;
alter table donations        enable row level security;
alter table admins          enable row level security;

-- 猫咪、地点、关系、健康、筹款：公开读，管理员写
do $$
declare t text;
begin
  foreach t in array array['cats','cat_locations','cat_relationships','health_records','campaigns'] loop
    execute format('drop policy if exists "public read %1$s" on %1$s;', t);
    execute format('create policy "public read %1$s" on %1$s for select using (true);', t);
    execute format('drop policy if exists "admin write %1$s" on %1$s;', t);
    execute format('create policy "admin write %1$s" on %1$s for all using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- 目击：已发布的可公开看；任何人可提交；管理员可改/删
drop policy if exists "published or admin read sightings" on sightings;
create policy "published or admin read sightings" on sightings for select using (status = '已发布' or public.is_admin());
drop policy if exists "anon submit sightings" on sightings;
create policy "anon submit sightings" on sightings for insert with check (true);
drop policy if exists "admin manage sightings" on sightings;
create policy "admin manage sightings" on sightings for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin delete sightings" on sightings;
create policy "admin delete sightings" on sightings for delete using (public.is_admin());

-- 捐款：公开读，管理员写
drop policy if exists "public read donations" on donations;
create policy "public read donations" on donations for select using (true);
drop policy if exists "admin write donations" on donations;
create policy "admin write donations" on donations for all using (public.is_admin()) with check (public.is_admin());

-- 管理员表：仅管理员可读
drop policy if exists "admin read admins" on admins;
create policy "admin read admins" on admins for select using (public.is_admin());

-- ============================================================
-- 图片存储桶：catphotos（公开读，允许匿名上传）
-- ============================================================
insert into storage.buckets (id, name, public) values ('catphotos','catphotos', true) on conflict (id) do nothing;

drop policy if exists "catphotos public read" on storage.objects;
create policy "catphotos public read" on storage.objects for select using (bucket_id = 'catphotos');
drop policy if exists "catphotos anon upload" on storage.objects;
create policy "catphotos anon upload" on storage.objects for insert to anon, authenticated with check (bucket_id = 'catphotos');
drop policy if exists "catphotos admin delete" on storage.objects;
create policy "catphotos admin delete" on storage.objects for delete to authenticated using (bucket_id = 'catphotos' and public.is_admin());

-- 9) 领养申请
create table if not exists adoption_applications (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid references cats(id) on delete set null,
  applicant_name text not null,
  contact text not null,
  reason text,
  experience text,
  status text not null default '待审核' check (status in ('待审核','通过','拒绝','已领养')),
  created_at timestamptz default now()
);
alter table adoption_applications enable row level security;
drop policy if exists "anon submit adoption" on adoption_applications;
create policy "anon submit adoption" on adoption_applications for insert with check (true);
drop policy if exists "admin manage adoption" on adoption_applications;
create policy "admin manage adoption" on adoption_applications for all using (public.is_admin()) with check (public.is_admin());
