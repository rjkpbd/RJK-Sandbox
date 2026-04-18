-- Stores QBO OAuth credentials per user for cross-device access.
-- The short-lived access token is cached in browser cookies only;
-- the long-lived refresh token lives here so any device can reconnect.
create table if not exists qbo_connections (
  user_id                   text        primary key,
  realm_id                  text        not null,
  refresh_token             text        not null,
  refresh_token_expires_at  timestamptz not null,
  updated_at                timestamptz not null default now()
);
