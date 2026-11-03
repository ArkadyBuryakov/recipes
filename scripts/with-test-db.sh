#!/usr/bin/env bash
# Run a command against a throwaway Postgres. Uses $TEST_DATABASE_URL when set (CI service container);
# otherwise starts a temporary container on a free port and removes it afterwards.
set -euo pipefail

if [[ -n "${TEST_DATABASE_URL:-}" ]]; then
  DATABASE_URL="$TEST_DATABASE_URL" exec "$@"
fi

name="recipes-test-$$"
docker run -d --rm --name "$name" -e POSTGRES_USER=recipes -e POSTGRES_PASSWORD=recipes -e POSTGRES_DB=recipes \
  -p 127.0.0.1::5432 postgres:17-alpine >/dev/null
trap 'docker stop "$name" >/dev/null' EXIT
port=$(docker port "$name" 5432/tcp | head -1 | sed 's/.*://')
until docker exec "$name" pg_isready -U recipes -q 2>/dev/null; do sleep 0.3; done
sleep 0.5
DATABASE_URL="postgres://recipes:recipes@127.0.0.1:${port}/recipes" "$@"
