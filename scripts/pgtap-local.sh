#!/usr/bin/env bash
# pgTAP local para Medoxigas-OPP.
#
# Levanta un Postgres desechable en /tmp (initdb + pg_ctl, sin servicio del
# sistema), crea una base vacía, instala un stub mínimo de Supabase, aplica
# TODAS las migraciones en orden de nombre y corre supabase/tests/*.sql.
# Sale con código != 0 si una migración o un assert falla.
#
# Uso:
#   scripts/pgtap-local.sh
#   PG_PORT=54329 scripts/pgtap-local.sh   # otro puerto
#   PG_BINDIR=/ruta/bin scripts/pgtap-local.sh
#   PGTAP_KEEP=1 scripts/pgtap-local.sh    # conserva el cluster al terminar
#
# Requiere initdb/pg_ctl (postgresql-17) y la extensión pgtap instalada
# (paquete postgresql-17-pgtap). No toca ningún Supabase remoto.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PG_PORT:-54329}"
DB="medoxigas_pgtap"

if [ "$(id -u)" -eq 0 ]; then
  # En el VPS los agentes corren como root e initdb lo rechaza. Se escenifican
  # las migraciones y los tests en /tmp y se re-ejecuta como `postgres`
  # (usuario que crea el paquete postgresql). Sin esto el repo vive bajo
  # /root, ilegible para ese usuario.
  PG_RUN_USER="${PG_RUN_USER:-postgres}"
  if ! id "$PG_RUN_USER" >/dev/null 2>&1; then
    echo "Como root hace falta el usuario '$PG_RUN_USER' (paquete postgresql)." >&2
    echo "Alternativa: ejecuta el script como usuario normal." >&2
    exit 1
  fi
  STAGE="$(mktemp -d /tmp/medoxigas-pgtap-stage.XXXXXX)"
  mkdir -p "$STAGE/repo/supabase" "$STAGE/repo/scripts"
  cp -a "$ROOT/supabase/migrations" "$ROOT/supabase/tests" "$STAGE/repo/supabase/" 2>/dev/null || true
  cp -a "${BASH_SOURCE[0]}" "$STAGE/repo/scripts/pgtap-local.sh"
  chmod -R a+rX "$STAGE"
  chown -R "$PG_RUN_USER":"$PG_RUN_USER" "$STAGE"
  echo "== Re-ejecutando como $PG_RUN_USER (escenificado en $STAGE)"
  exec setpriv --reuid "$PG_RUN_USER" --regid "$PG_RUN_USER" --clear-groups \
    env PG_PORT="$PORT" PGTAP_KEEP="${PGTAP_KEEP:-0}" \
    bash "$STAGE/repo/scripts/pgtap-local.sh" "$@"
fi

find_bindir() {
  local candidate
  if [ -n "${PG_BINDIR:-}" ]; then
    if [ -x "$PG_BINDIR/initdb" ]; then
      printf '%s\n' "$PG_BINDIR"
      return 0
    fi
    echo "PG_BINDIR=$PG_BINDIR no contiene initdb." >&2
    return 1
  fi
  if command -v initdb >/dev/null 2>&1; then
    dirname "$(command -v initdb)"
    return 0
  fi
  if command -v pg_config >/dev/null 2>&1; then
    candidate="$(pg_config --bindir)"
    if [ -x "$candidate/initdb" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  fi
  # Debian/Ubuntu y el paquete extraído a /tmp (cuando apt no está disponible).
  for candidate in /usr/lib/postgresql/*/bin /usr/local/pgsql/bin \
                   /tmp/pg17/usr/lib/postgresql/*/bin; do
    if [ -x "$candidate/initdb" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  echo "No encuentro initdb. Instala postgresql-17 o define PG_BINDIR." >&2
  return 1
}

BINDIR="$(find_bindir)"
if [ -n "${PSQL_BIN:-}" ]; then
  PSQL="$PSQL_BIN"
elif [ -x "$BINDIR/psql" ]; then
  PSQL="$BINDIR/psql"
elif command -v psql >/dev/null 2>&1; then
  PSQL="$(command -v psql)"
else
  echo "No encuentro psql." >&2
  exit 1
fi
WORK="$(mktemp -d /tmp/medoxigas-pgtap.XXXXXX)"
DATA="$WORK/data"
SOCK="$WORK/sock"
LOG="$WORK/postgres.log"
mkdir -p "$SOCK"

cleanup() {
  local status=$?
  if [ -f "$DATA/postmaster.pid" ]; then
    "$BINDIR/pg_ctl" -D "$DATA" -m immediate -w stop >/dev/null 2>&1 || true
  fi
  if [ "${PGTAP_KEEP:-0}" = "1" ]; then
    echo "Cluster conservado en $WORK" >&2
  else
    rm -rf "$WORK"
  fi
  exit "$status"
}
trap cleanup EXIT

echo "== Cluster temporal: $DATA (puerto $PORT, socket $SOCK)"
"$BINDIR/initdb" -D "$DATA" -U postgres --auth=trust --no-instructions >/dev/null
"$BINDIR/pg_ctl" -D "$DATA" -l "$LOG" -w \
  -o "-p $PORT -k $SOCK -c listen_addresses=''" start >/dev/null

"$PSQL" -h "$SOCK" -p "$PORT" -U postgres -d postgres -X -q \
  -v ON_ERROR_STOP=1 -c "create database \"$DB\""

echo "== Stub de Supabase (roles, auth, extensiones)"
"$PSQL" -h "$SOCK" -p "$PORT" -U postgres -d "$DB" \
  -X -q -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

-- Privilegios por defecto como Supabase: los roles tienen grants directos y
-- la protección real es RLS (las migraciones revocan lo que quieren cerrar).
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgtap with schema extensions;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.instances (
  id uuid primary key,
  uuid uuid,
  raw_base_config text,
  created_at timestamptz,
  updated_at timestamptz
);
insert into auth.instances (id) values ('00000000-0000-0000-0000-000000000000');

create table auth.users (
  instance_id uuid references auth.instances (id),
  id uuid primary key,
  aud text,
  role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'role', '')
$$;

grant execute on function auth.jwt(), auth.uid(), auth.role()
  to anon, authenticated, service_role;

-- Stub mínimo de Supabase Storage: las migraciones crean buckets y políticas
-- sobre storage.objects; los tests solo verifican que esas piezas existen.
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
SQL

"$PSQL" -h "$SOCK" -p "$PORT" -U postgres -d "$DB" -X -q \
  -c "alter database \"$DB\" set search_path = \"\$user\", public, extensions"

echo "== Migraciones"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "   $(basename "$migration")"
  # Cada migración en una transacción: la importación de Odoo usa temp tables
  # `on commit drop` y psql en autocommit las borraría entre statements.
  if ! "$PSQL" -h "$SOCK" -p "$PORT" -U postgres -d "$DB" \
       -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$migration"; then
    echo "FALLÓ la migración $migration" >&2
    exit 1
  fi
done

echo "== Tests"
failed=0
declare -a summary=()
for test_file in "$ROOT"/supabase/tests/*.sql; do
  name="$(basename "$test_file")"
  out="$WORK/$name.out"
  set +e
  "$PSQL" -h "$SOCK" -p "$PORT" -U postgres -d "$DB" \
    -X -q -v ON_ERROR_STOP=1 -f "$test_file" >"$out" 2>&1
  rc=$?
  set -e

  read -r ok bad < <(awk '
    /^[[:space:]]*not ok [0-9]+/ { bad++; next }
    /^[[:space:]]*ok [0-9]+/ { ok++ }
    END { printf "%d %d\n", ok + 0, bad + 0 }
  ' "$out")
  summary+=("$name: $ok ok, $bad fallidos (psql=$rc)")

  if [ "$rc" -ne 0 ] || [ "$bad" -ne 0 ] || [ "$ok" -eq 0 ]; then
    failed=1
    echo "-- $name FALLÓ (psql=$rc, ok=$ok, fallidos=$bad)"
    grep -E 'not ok [0-9]+|ERROR:|Looks like you failed' "$out" >&2 || true
  fi
done

printf '\n== Resumen\n'
printf '   %s\n' "${summary[@]}"

if [ "$failed" -ne 0 ]; then
  echo "Hay pruebas fallidas." >&2
  exit 1
fi

echo "Todo en verde."
