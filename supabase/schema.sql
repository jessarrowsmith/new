-- Meal Planner & Food Logger schema.
-- Paste into the Supabase SQL editor and run once. Safe to re-run.

create extension if not exists "pgcrypto";

-- Foods ---------------------------------------------------------------
create table if not exists foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  serving_size numeric not null default 100 check (serving_size > 0),
  serving_unit text not null default 'g' check (serving_unit in ('g', 'ml')),
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fibre numeric not null default 0,
  sugar numeric not null default 0,
  category text,
  source text not null default 'manual' check (source in ('manual', 'photo')),
  created_at timestamptz not null default now()
);

-- Meals ---------------------------------------------------------------
create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_url text,
  created_at timestamptz not null default now()
);

-- servings = number of the food's serving size (1 = one serving, 1.5, 0.5 ...)
create table if not exists meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references meals(id) on delete cascade,
  food_id uuid not null references foods(id) on delete restrict,
  servings numeric not null default 1 check (servings > 0)
);
create index if not exists meal_items_meal_idx on meal_items(meal_id);

-- Day templates -------------------------------------------------------
create table if not exists day_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists day_template_meals (
  id uuid primary key default gen_random_uuid(),
  day_template_id uuid not null references day_templates(id) on delete cascade,
  meal_id uuid not null references meals(id) on delete restrict,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  servings numeric not null default 1 check (servings > 0)
);
create index if not exists day_template_meals_idx on day_template_meals(day_template_id);

-- Week plans ----------------------------------------------------------
-- is_template = true  -> a saved, reusable Week Template
-- is_template = false -> the working planner (one row, named 'Current')
create table if not exists week_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_template boolean not null default false,
  created_at timestamptz not null default now()
);

-- at most one working planner
create unique index if not exists week_plans_one_current on week_plans ((is_template)) where is_template = false;

-- day_of_week: 0 = Monday ... 6 = Sunday
create table if not exists week_plan_days (
  id uuid primary key default gen_random_uuid(),
  week_plan_id uuid not null references week_plans(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  day_template_id uuid references day_templates(id) on delete set null,
  unique (week_plan_id, day_of_week)
);

-- Daily log -----------------------------------------------------------
create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  day_template_id uuid references day_templates(id) on delete set null
);

create table if not exists log_entries (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid not null references daily_logs(id) on delete cascade,
  food_id uuid references foods(id) on delete restrict,
  meal_id uuid references meals(id) on delete restrict,
  slot text not null default 'snack' check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  servings numeric not null default 1 check (servings > 0),
  logged_at timestamptz not null default now(),
  check ((food_id is not null) <> (meal_id is not null))
);
create index if not exists log_entries_log_idx on log_entries(daily_log_id);

-- Settings (single row) -----------------------------------------------
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  calorie_target numeric not null default 2000,
  protein_target numeric not null default 150,
  carbs_target numeric not null default 200,
  fat_target numeric not null default 65
);
insert into settings (id) values (1) on conflict do nothing;

-- Shopping list -------------------------------------------------------
create table if not exists shopping_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity numeric,
  unit text,
  category text not null default 'Other',
  checked boolean not null default false,
  created_at timestamptz not null default now()
);

-- Access --------------------------------------------------------------
-- This app has no login: it is a single-user app protected only by the
-- obscurity of its URL. The policies below let the anon key read and write
-- everything. Anyone who has your Supabase URL + anon key can modify the
-- data. Fine for personal use; add Supabase Auth before sharing the app.
do $$
declare t text;
begin
  foreach t in array array[
    'foods','meals','meal_items','day_templates','day_template_meals',
    'week_plans','week_plan_days','daily_logs','log_entries','settings',
    'shopping_items'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "open access" on %I', t);
    execute format('create policy "open access" on %I for all using (true) with check (true)', t);
  end loop;
end $$;
