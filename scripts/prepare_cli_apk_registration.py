#!/usr/bin/env python3
"""Create/revoke a per-APK FCM registration key for menuop's CLI generator."""
from __future__ import annotations

import hashlib
import secrets
import sqlite3
import sys
import uuid
from pathlib import Path
from urllib.parse import unquote


def database_path(panel_dir: Path) -> Path:
    env_file = panel_dir / ".env"
    database_url = ""
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.lstrip().startswith("#") or "=" not in line:
                continue
            name, value = line.split("=", 1)
            if name.strip() == "DATABASE_URL":
                database_url = value.strip().strip("\"'")
                break
    if not database_url.startswith("file:"):
        raise RuntimeError("DATABASE_URL ausente ou não configurada para SQLite no .env do painel.")
    raw_path = unquote(database_url[5:].split("?", 1)[0])
    path = Path(raw_path)
    if not path.is_absolute():
        path = panel_dir / "prisma" / path
    path = path.resolve()
    if not path.is_file():
        raise RuntimeError(f"Banco SQLite não encontrado: {path}")
    return path


def ensure_fcm_tables(db: sqlite3.Connection) -> None:
    db.execute(
        '''CREATE TABLE IF NOT EXISTS "device_registration_keys" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "key_hash" TEXT NOT NULL,
          "user_id" TEXT NOT NULL,
          "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "device_registration_keys_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )'''
    )
    db.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS "device_registration_keys_key_hash_key" '
        'ON "device_registration_keys"("key_hash")'
    )
    db.execute(
        'CREATE INDEX IF NOT EXISTS "device_registration_keys_user_id_idx" '
        'ON "device_registration_keys"("user_id")'
    )
    db.execute(
        '''CREATE TABLE IF NOT EXISTS "device_fcm_tokens" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "token" TEXT NOT NULL,
          "user_id" TEXT NOT NULL,
          "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "device_fcm_tokens_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )'''
    )
    db.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS "device_fcm_tokens_token_key" '
        'ON "device_fcm_tokens"("token")'
    )
    db.execute(
        'CREATE INDEX IF NOT EXISTS "device_fcm_tokens_user_id_idx" '
        'ON "device_fcm_tokens"("user_id")'
    )


def create_key(panel_dir: Path) -> None:
    db_path = database_path(panel_dir)
    key = secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(key.encode("utf-8")).hexdigest()
    with sqlite3.connect(db_path, timeout=30) as db:
        db.execute("PRAGMA foreign_keys = ON")
        ensure_fcm_tables(db)
        user = db.execute(
            "SELECT id FROM users ORDER BY is_admin DESC, created_at ASC, id ASC LIMIT 1"
        ).fetchone()
        if not user:
            raise RuntimeError("Não há usuário cadastrado no banco do painel.")
        user_id = str(user[0])
        db.execute(
            'INSERT INTO "device_registration_keys" ("id", "key_hash", "user_id") VALUES (?, ?, ?)',
            (str(uuid.uuid4()), key_hash, user_id),
        )
    # stdout é capturado pelo menuop; a chave nunca é exibida no terminal.
    print(f"{user_id}\t{key}")


def revoke_key(panel_dir: Path) -> None:
    key = sys.stdin.readline().strip()
    if not key:
        return
    key_hash = hashlib.sha256(key.encode("utf-8")).hexdigest()
    db_path = database_path(panel_dir)
    with sqlite3.connect(db_path, timeout=30) as db:
        db.execute('DELETE FROM "device_registration_keys" WHERE "key_hash" = ?', (key_hash,))


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[2] not in {"create", "revoke"}:
        print("Uso: prepare_cli_apk_registration.py <diretorio-painel> <create|revoke>", file=sys.stderr)
        return 2
    panel_dir = Path(sys.argv[1]).resolve()
    try:
        if sys.argv[2] == "create":
            create_key(panel_dir)
        else:
            revoke_key(panel_dir)
    except (OSError, RuntimeError, sqlite3.Error) as error:
        print(f"Não foi possível preparar o registro FCM do APK: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
