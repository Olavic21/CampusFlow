#!/usr/bin/env python3
"""
sqlite_util.py — utilitaires SQLite pour CampusFlow en production.

Aucune dépendance externe (bibliothèque standard uniquement) : peut être appelé
par les scripts de déploiement avec le python du venv ou le python système.

Sous-commandes :
  check   <db>                 contrôle d'intégrité (PRAGMA integrity_check + quick_check)
  count   <db> [table]         nombre de lignes (0 si la table n'existe pas encore)
  backup  <db> <dest>          sauvegarde COHÉRENTE (API sqlite3 Connection.backup)
  restore <backup> <db>        restauration (refuse un fichier qui n'est pas du SQLite)
  prune   <dir> <jours>        purge des sauvegardes plus anciennes que N jours

Codes de sortie : 0 = succès, 1 = échec.
"""
from __future__ import annotations

import argparse
import glob
import os
import sqlite3
import sys
import time


def _ro(path: str) -> sqlite3.Connection:
    """Connexion lecture seule (URI) — ne crée pas le fichier s'il est absent."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"base introuvable : {path}")
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=30)


def _is_sqlite(path: str) -> bool:
    """Vérifie l'en-tête magique 'SQLite format 3' du fichier."""
    try:
        with open(path, "rb") as fh:
            return fh.read(16) == b"SQLite format 3\x00"
    except OSError:
        return False


def _table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone()
    return row is not None


def cmd_check(args: argparse.Namespace) -> int:
    print(f"[check] {args.db}")
    if not _is_sqlite(args.db):
        print("  ERREUR : ce fichier n'est pas une base SQLite valide", file=sys.stderr)
        return 1
    conn = _ro(args.db)
    try:
        for pragma in ("integrity_check", "quick_check"):
            value = conn.execute(f"PRAGMA {pragma};").fetchone()[0]
            status = "OK" if value == "ok" else "ERREUR (" + str(value) + ")"
            print(f"  {pragma:15s} : {status}")
            if value != "ok":
                return 1
        page_count = conn.execute("PRAGMA page_count;").fetchone()[0]
        page_size = conn.execute("PRAGMA page_size;").fetchone()[0]
        journal = conn.execute("PRAGMA journal_mode;").fetchone()[0]
        print(f"  taille          : {page_count * page_size / 1024:.0f} Kio")
        print(f"  journal_mode    : {journal}")
    finally:
        conn.close()
    return 0


def cmd_count(args: argparse.Namespace) -> int:
    conn = _ro(args.db)
    try:
        if not _table_exists(conn, args.table):
            print(0)
            return 0
        print(conn.execute(f"SELECT count(*) FROM {args.table};").fetchone()[0])
    finally:
        conn.close()
    return 0

def cmd_backup(args: argparse.Namespace) -> int:
    """Sauvegarde cohérente, même si l'API écrit en parallèle (mode WAL inclus)."""
    src = _ro(args.db)
    dest = os.path.abspath(args.dest)
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    if os.path.exists(dest):
        os.remove(dest)
    dst = sqlite3.connect(dest)
    try:
        # L'API de sauvegarde de sqlite3 produit un instantané transactionnel :
        # contrairement à un simple cp, elle reste cohérente pendant les écritures.
        src.backup(dst)
        dst.commit()
    finally:
        dst.close()
        src.close()

    if not _is_sqlite(dest):
        print(f"[backup] ERREUR : sauvegarde invalide → {dest}", file=sys.stderr)
        return 1
    print(f"[backup] OK → {dest} ({os.path.getsize(dest) / 1024:.0f} Kio)")

    # Contrôle de la copie produite
    if cmd_check(argparse.Namespace(db=dest)) != 0:
        print("[backup] ERREUR : la copie ne passe pas le contrôle d'intégrité", file=sys.stderr)
        return 1
    return 0


def cmd_restore(args: argparse.Namespace) -> int:
    if not _is_sqlite(args.backup):
        print(f"[restore] ERREUR : {args.backup} n'est pas une base SQLite", file=sys.stderr)
        return 1
    if not os.path.exists(args.db):
        raise FileNotFoundError(f"base cible introuvable : {args.db}")
    src = _ro(args.backup)
    dst = sqlite3.connect(args.db)
    try:
        # Remplace intégralement le contenu de la base cible par la sauvegarde.
        src.backup(dst)
        dst.commit()
    finally:
        dst.close()
        src.close()
    print(f"[restore] OK : {args.backup} → {args.db}")
    return 0


def cmd_prune(args: argparse.Namespace) -> int:
    cutoff = time.time() - args.days * 86400
    removed = 0
    for path in glob.glob(os.path.join(args.directory, args.pattern)):
        if os.path.isfile(path) and os.path.getmtime(path) < cutoff:
            os.remove(path)
            removed += 1
            print(f"[prune] supprime : {path}")
    print(f"[prune] {removed} sauvegarde(s) de plus de {args.days} jour(s) purgee(s)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Utilitaires SQLite CampusFlow")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("check", help="contrôle d'intégrité")
    p.add_argument("db")
    p.set_defaults(func=cmd_check)

    p = sub.add_parser("count", help="nombre de lignes d'une table")
    p.add_argument("db")
    p.add_argument("table", nargs="?", default="locations")
    p.set_defaults(func=cmd_count)

    p = sub.add_parser("backup", help="sauvegarde cohérente")
    p.add_argument("db")
    p.add_argument("dest")
    p.set_defaults(func=cmd_backup)

    p = sub.add_parser("restore", help="restauration")
    p.add_argument("backup")
    p.add_argument("db")
    p.set_defaults(func=cmd_restore)

    p = sub.add_parser("prune", help="rotation des sauvegardes")
    p.add_argument("directory")
    p.add_argument("days", type=int)
    p.add_argument("--pattern", default="campusflow-*.db")
    p.set_defaults(func=cmd_prune)

    args = parser.parse_args()
    try:
        return args.func(args)
    except Exception as exc:  # message clair plutôt qu'une traceback dans les logs de déploiement
        print(f"[{args.command}] ERREUR : {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())

