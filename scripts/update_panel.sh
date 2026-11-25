#!/usr/bin/env bash
set -Eeuo pipefail

PANEL_DIR="${DTMOD_INSTALL_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
EXPECTED_BRANCH="main"
EXPECTED_REMOTE_RE="^(https://github\.com/Jbmb4/DTMod2(\.git)?|git@github\.com:Jbmb4/DTMod2(\.git)?)$"
PM2_BIN="${PM2_BIN:-$(command -v pm2 2>/dev/null || true)}"

if [[ -z "$PM2_BIN" ]] && command -v npm >/dev/null 2>&1; then
    npm_bin="$(npm prefix -g 2>/dev/null || true)/bin/pm2"
    [[ ! -x "$npm_bin" ]] || PM2_BIN="$npm_bin"
fi

say() { printf '%s\n' "$*"; }
fail() { printf 'Erro: %s\n' "$*" >&2; exit 1; }

[[ -d "$PANEL_DIR/.git" ]] || fail "A pasta não é um clone Git: $PANEL_DIR"
command -v git >/dev/null 2>&1 || fail "git não está instalado."

remote_url="$(git -C "$PANEL_DIR" remote get-url origin 2>/dev/null || true)"
[[ "$remote_url" =~ $EXPECTED_REMOTE_RE ]] || fail "O origin configurado não é o repositório autorizado Jbmb4/DTMod2. Nenhum arquivo foi alterado."
branch="$(git -C "$PANEL_DIR" branch --show-current)"
[[ "$branch" == "$EXPECTED_BRANCH" ]] || fail "A branch atual é '$branch'; este atualizador só opera na branch main."

if [[ -n "$(git -C "$PANEL_DIR" status --porcelain)" ]]; then
    fail "Há alterações locais no painel. Faça backup/commit ou limpe-as antes; o atualizador não sobrescreve mudanças locais."
fi

say "Instalação: $PANEL_DIR"
say "Repositório: $remote_url"
say "Buscando atualizações de origin/main..."
if ! GIT_TERMINAL_PROMPT=0 git -C "$PANEL_DIR" fetch origin main; then
    fail "Não foi possível buscar origin/main. Verifique internet/DNS e a autenticação GitHub/SSH deste servidor. Nenhum arquivo foi atualizado."
fi
local_commit="$(git -C "$PANEL_DIR" rev-parse HEAD)"
remote_commit="$(git -C "$PANEL_DIR" rev-parse origin/main)"
if [[ "$local_commit" == "$remote_commit" ]]; then
    say "Busca concluída: origin/main=$remote_commit. O painel já está atualizado."
    exit 0
fi
if ! git -C "$PANEL_DIR" merge-base --is-ancestor "$local_commit" "$remote_commit"; then
    ahead="$(git -C "$PANEL_DIR" rev-list --count "$remote_commit..$local_commit")"
    behind="$(git -C "$PANEL_DIR" rev-list --count "$local_commit..$remote_commit")"
    fail "A branch local divergiu de origin/main (local à frente: $ahead; atualização remota pendente: $behind). Nenhum reset destrutivo foi executado; resolva o histórico manualmente."
fi

say "Alterações que serão instaladas:"
git -C "$PANEL_DIR" --no-pager log --oneline "$local_commit..$remote_commit"
command -v pnpm >/dev/null 2>&1 || fail "A atualização foi encontrada, mas pnpm não está instalado. Instale pnpm e execute a opção 9 novamente; o código ainda não foi alterado."
[[ -n "$PM2_BIN" && -x "$PM2_BIN" ]] || fail "A atualização foi encontrada, mas PM2 não foi encontrado antes da instalação. Instale/configure PM2 e tente novamente; o código ainda não foi alterado."
menu_entry="$(command -v menuop 2>/dev/null || true)"
repo_menu="$PANEL_DIR/menuop"
if [[ -n "$menu_entry" && -f "$repo_menu" && -f "$menu_entry" ]]; then
    entry_real="$(readlink -f "$menu_entry" 2>/dev/null || printf '%s' "$menu_entry")"
    repo_real="$(readlink -f "$repo_menu" 2>/dev/null || printf '%s' "$repo_menu")"
    if [[ "$entry_real" != "$repo_real" && ! -w "$menu_entry" ]]; then
        fail "O código do painel está pronto para atualizar, mas $menu_entry não é gravável. Execute menuop como root para atualizar também o menu instalado."
    fi
fi
printf '\nEsta operação fará backup de .env e do banco SQLite local, atualizará dependências, aplicará apenas migrations SQL novas, compilará e reiniciará o painel.\n'
read -r -p "Continuar com a atualização? [s/N] " confirm
[[ "$confirm" == "s" || "$confirm" == "S" ]] || { say "Atualização cancelada."; exit 0; }

stamp="$(date +%Y%m%d_%H%M%S)"
backup_root="${HOME}/dtmod-update-backups"
backup_stage="$(mktemp -d "${TMPDIR:-/tmp}/dtmod-update-backup.XXXXXX")"
backup_archive="${backup_root}/dtmod-${stamp}.tar.gz"
mkdir -p "$backup_root"
[[ ! -f "$PANEL_DIR/.env" ]] || cp -p "$PANEL_DIR/.env" "$backup_stage/.env"

db_path="$(python3 - "$PANEL_DIR/.env" "$PANEL_DIR" <<'PY'
from pathlib import Path
import sys

env_file = Path(sys.argv[1])
root = Path(sys.argv[2])
url = ""
if env_file.is_file():
    for line in env_file.read_text(errors="replace").splitlines():
        if line.strip().startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip().strip("\"'")
            break
if url.startswith("file:"):
    raw = url[5:].split("?", 1)[0]
    p = Path(raw)
    candidates = [p] if p.is_absolute() else [root / p, root / "prisma" / p]
    for candidate in candidates:
        if candidate.is_file():
            print(candidate.resolve())
            break
PY
)"
if [[ -n "$db_path" && -f "$db_path" ]]; then
    cp -p "$db_path" "$backup_stage/database-$(basename "$db_path")"
fi
if [[ -n "$(find "$backup_stage" -maxdepth 1 -type f -print -quit)" ]]; then
    tar -czf "$backup_archive" -C "$backup_stage" .
    say "Backup criado: $backup_archive"
else
    say "Aviso: não foi encontrado .env nem banco SQLite local para copiar."
fi
rm -rf "$backup_stage"

old_commit="$local_commit"
git -C "$PANEL_DIR" merge --ff-only "$remote_commit"

rollback_code_only() {
    say "A compilação falhou; voltando o código para o commit anterior (sem reverter dados do banco)." >&2
    git -C "$PANEL_DIR" reset --hard "$old_commit" || true
    (cd "$PANEL_DIR" && pnpm install --frozen-lockfile && pnpm exec prisma generate && pnpm build) || true
    [[ -z "$PM2_BIN" ]] || "$PM2_BIN" restart DTunnel --update-env || true
}

if ! (cd "$PANEL_DIR" && pnpm install --frozen-lockfile && pnpm exec prisma generate && pnpm build); then
    rollback_code_only
    fail "Falha na instalação/compilação. O código foi restaurado quando possível; confira os logs e o backup."
fi

changed_migrations="$(git -C "$PANEL_DIR" diff --name-only "$old_commit" "$remote_commit" -- prisma/migrations | grep -E '/migration\.sql$' || true)"
schema_changed="$(git -C "$PANEL_DIR" diff --name-only "$old_commit" "$remote_commit" -- prisma/schema.prisma)"
if [[ -n "$changed_migrations" ]]; then
    if ! (cd "$PANEL_DIR" && pnpm exec prisma migrate deploy); then
        fail "As migrations SQL falharam. Nenhum baseline/reset foi aplicado; o código novo foi mantido. Revise o schema, faça backup e confira $backup_archive."
    fi
elif [[ -n "$schema_changed" ]]; then
    fail "prisma/schema.prisma mudou sem migration.sql correspondente. Nenhuma alteração de banco foi tentada; crie/revise a migration antes de atualizar."
else
    say "Nenhuma migration SQL/schema mudou neste update; ignorando migrate deploy (sem alteração no banco)."
fi

"$PM2_BIN" restart DTunnel --update-env || fail "A atualização compilou, mas o PM2 não conseguiu reiniciar DTunnel. Verifique 'pm2 logs DTunnel'."

# Se o instalador copiou menuop para /usr/local/bin, atualize também essa cópia.
if [[ -n "$menu_entry" && -f "$repo_menu" && -f "$menu_entry" ]]; then
    if [[ "$entry_real" != "$repo_real" && -w "$menu_entry" ]]; then
        install -m 0755 "$repo_menu" "$menu_entry" || fail "O painel foi atualizado, mas não foi possível atualizar o menu instalado em $menu_entry."
        say "Menuop instalado atualizado: $menu_entry"
    fi
fi
say "Atualização concluída com sucesso."
