#!/usr/bin/env python3
"""
Utility script to export and import ClickHouse tables to/from JSON Lines files.

- Export writes one `.jsonl` data file per table plus a matching `_schema.json` file
  that records column names and types (from `DESCRIBE TABLE`).
- Import reads those files and replays them back into the database, optionally
  truncating existing data first.

Usage examples:
  python clickhouse_export_import.py export --output-dir backups/latest
  python clickhouse_export_import.py import --input-dir backups/latest --truncate-first
"""

import argparse
import json
import os
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Sequence, Tuple

import clickhouse_connect

# Database configuration mirrors app.py for consistency
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": int(os.environ.get("DB_PORT", "8123")),
    "database": os.environ.get("DB_NAME", "baby_tracker"),
    "username": os.environ.get("DB_USER", "clickhouse"),
    "password": os.environ.get("DB_PASSWORD", "clickhouse"),
}

TABLES = ["entries", "entries_backup", "speech_entries"]

UINT32_MAX = 4_294_967_295


def get_client():
    return clickhouse_connect.get_client(**DB_CONFIG)


def ensure_dir(path: str) -> str:
    os.makedirs(path, exist_ok=True)
    return path


def describe_table(client, table: str) -> List[Tuple[str, str]]:
    """Return [(column, type)] for a table."""
    result = client.query(f"DESCRIBE TABLE {table}")
    return [(row[0], row[1]) for row in result.result_rows]


def serialize_value(value):
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    return value


def export_table(client, table: str, output_dir: str) -> int:
    schema = describe_table(client, table)
    result = client.query(f"SELECT * FROM {table}")

    data_path = os.path.join(output_dir, f"{table}.jsonl")
    schema_path = os.path.join(output_dir, f"{table}_schema.json")

    with open(data_path, "w", encoding="utf-8") as data_file:
        for row in result.result_rows:
            row_dict = {schema[i][0]: serialize_value(row[i]) for i in range(len(schema))}
            data_file.write(json.dumps(row_dict, ensure_ascii=True) + "\n")

    with open(schema_path, "w", encoding="utf-8") as schema_file:
        json.dump(schema, schema_file, indent=2)

    return len(result.result_rows)


def parse_value(value, type_str: str):
    if value is None:
        return None

    if type_str.startswith("Nullable(") and type_str.endswith(")"):
        inner_type = type_str[len("Nullable(") : -1]
        return parse_value(value, inner_type)

    if type_str.startswith("UInt") or type_str.startswith("Int"):
        return int(value)
    if type_str.startswith("Float"):
        return float(value)
    if type_str.startswith("Decimal"):
        return Decimal(str(value))
    if type_str.startswith("DateTime"):
        return datetime.fromisoformat(value)

    return value


def coerce_uint32(value: int) -> int:
    """Ensure value fits into UInt32; wrap if out of range."""
    ivalue = int(value)
    if 0 <= ivalue <= UINT32_MAX:
        return ivalue
    wrapped = (ivalue % UINT32_MAX) or 1
    return wrapped


def import_table(client, table: str, input_dir: str, truncate: bool) -> int:
    schema_path = os.path.join(input_dir, f"{table}_schema.json")
    data_path = os.path.join(input_dir, f"{table}.jsonl")

    if not os.path.exists(schema_path) or not os.path.exists(data_path):
        raise FileNotFoundError(f"Missing files for table {table} in {input_dir}")

    with open(schema_path, "r", encoding="utf-8") as schema_file:
        schema: Sequence[Sequence[str]] = json.load(schema_file)

    columns = [col for col, _ in schema]
    types = {col: col_type for col, col_type in schema}

    # Align types with live table (handles migrations like UInt64 -> UInt32)
    live_schema = describe_table(client, table)
    live_types = {col: col_type for col, col_type in live_schema}
    for col in columns:
        if col in live_types:
            types[col] = live_types[col]

    if truncate:
        client.command(f"TRUNCATE TABLE {table}")

    inserted = 0
    batch: List[List] = []
    batch_size = 5_000

    adjusted_ids = 0

    with open(data_path, "r", encoding="utf-8") as data_file:
        for line in data_file:
            if not line.strip():
                continue
            row_obj: Dict[str, object] = json.loads(line)
            parsed_row: List[object] = []
            for col in columns:
                value = row_obj.get(col)
                parsed = parse_value(value, types[col])
                if col == "id" and types[col].startswith("UInt32"):
                    if parsed is None:
                        raise ValueError("id cannot be None for UInt32 column")
                    coerced = coerce_uint32(parsed)
                    if coerced != parsed:
                        adjusted_ids += 1
                    parsed = coerced
                parsed_row.append(parsed)
            batch.append(parsed_row)
            if len(batch) >= batch_size:
                client.insert(table, batch, column_names=columns)
                inserted += len(batch)
                batch.clear()

    if batch:
        client.insert(table, batch, column_names=columns)
        inserted += len(batch)

    if adjusted_ids:
        print(f"Adjusted {adjusted_ids} ids to fit UInt32 for table {table}")

    return inserted


def export_all(output_dir: str):
    export_path = ensure_dir(output_dir)
    manifest = {"exported_at": datetime.utcnow().isoformat() + "Z", "tables": {}}

    with get_client() as client:
        for table in TABLES:
            count = export_table(client, table, export_path)
            manifest["tables"][table] = {"rows": count}

    manifest_path = os.path.join(export_path, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as manifest_file:
        json.dump(manifest, manifest_file, indent=2)

    print(f"Export completed to {export_path}")
    for table, info in manifest["tables"].items():
        print(f"  {table}: {info['rows']} rows")


def import_all(input_dir: str, truncate: bool):
    with get_client() as client:
        for table in TABLES:
            rows = import_table(client, table, input_dir, truncate)
            print(f"Imported {rows} rows into {table}")


def main():
    parser = argparse.ArgumentParser(description="Export/Import ClickHouse tables")
    subparsers = parser.add_subparsers(dest="command", required=True)

    export_parser = subparsers.add_parser("export", help="Export tables to JSONL files")
    export_parser.add_argument(
        "--output-dir",
        default=os.path.join("backups", f"clickhouse_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}")
    )

    import_parser = subparsers.add_parser("import", help="Import tables from JSONL files")
    import_parser.add_argument("--input-dir", required=True)
    import_parser.add_argument("--truncate-first", action="store_true", help="Truncate tables before import")

    args = parser.parse_args()

    if args.command == "export":
        export_all(args.output_dir)
    elif args.command == "import":
        import_all(args.input_dir, truncate=args.truncate_first)


if __name__ == "__main__":
    main()
