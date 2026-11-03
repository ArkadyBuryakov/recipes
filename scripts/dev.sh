#!/usr/bin/env bash
# Per-worktree dev environment. Ports and the compose project name derive from the worktree path,
# so every worktree gets its own isolated stack and they never collide.
#   dev.sh up       build, start and watch (foreground, Ctrl-C to stop)
#   dev.sh down     stop and remove containers, keep the database volume
#   dev.sh destroy  remove containers and volumes
#   dev.sh env      print the environment for this worktree
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

slot=$(( $(pwd | cksum | cut -d' ' -f1) % 1000 ))
slug=$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9\n' '-')
export COMPOSE_PROJECT_NAME="recipes-${slug}"
export APP_PORT="${APP_PORT:-$(( 30000 + slot * 2 ))}"
export DB_PORT="${DB_PORT:-$(( 30001 + slot * 2 ))}"

case "${1:-up}" in
  up)
    echo "▶ ${COMPOSE_PROJECT_NAME}: app http://localhost:${APP_PORT}  db postgres://recipes:recipes@localhost:${DB_PORT}/recipes"
    exec docker compose up --build --watch ;;
  down) docker compose down --remove-orphans ;;
  destroy) docker compose down --volumes --remove-orphans --rmi local ;;
  env)
    echo "COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}"
    echo "APP_PORT=${APP_PORT}"
    echo "DB_PORT=${DB_PORT}"
    echo "DATABASE_URL=postgres://recipes:recipes@localhost:${DB_PORT}/recipes" ;;
  *) echo "usage: $0 up|down|destroy|env" >&2; exit 2 ;;
esac
