create table "morning_briefing_cache" (
  "id" text not null primary key,
  "user_id" text not null,
  "slot_key" text not null,
  "location_key" text not null,
  "prep_minutes" integer not null,
  "payload_json" text not null,
  "created_at" date not null,
  "updated_at" date not null
);

create unique index "morning_briefing_cache_unique_idx"
  on "morning_briefing_cache" ("user_id", "slot_key", "location_key", "prep_minutes");

create index "morning_briefing_cache_user_slot_idx"
  on "morning_briefing_cache" ("user_id", "slot_key");
