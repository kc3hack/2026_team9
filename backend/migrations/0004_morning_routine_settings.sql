create table if not exists "morning_routine_settings" (
  "user_id" text primary key,
  "routine_json" text not null,
  "created_at" text not null,
  "updated_at" text not null
);
