import csv
import hashlib
import json
import sys
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Tuple
from xml.etree import ElementTree as ET

SOURCE_XLSX = Path("data/manual/source/directors.xlsx")
MANUAL_CSV = Path("data/manual/directors_manual.csv")
DIRECTORS_JSON = Path("public/data/atlas/directors.json")

EXTRA_COLUMNS = [
    "id",
    "director_qid",
    "tier_ai",
    "tier_ai_confidence",
    "tier_ai_as_of",
    "availability_ai",
    "availability_ai_confidence",
    "availability_ai_as_of",
    "ai_evidence_urls",
    "reps_manual",
    "internal_notes",
    "exclude",
    "watchlist_priority",
]

STUB_JSON_FILES = [
    Path("public/data/atlas/films.json"),
    Path("public/data/atlas/actors.json"),
    Path("public/data/atlas/edges_actor_director.json"),
]


def normalize_name(value: str) -> str:
    return " ".join(value.strip().lower().split())


def column_letter_to_index(cell_ref: str) -> int:
    letters = "".join([ch for ch in cell_ref if ch.isalpha()])
    index = 0
    for char in letters:
        index = index * 26 + (ord(char.upper()) - ord("A") + 1)
    return index - 1


def read_shared_strings(zip_handle: zipfile.ZipFile) -> List[str]:
    try:
        content = zip_handle.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ET.fromstring(content)
    namespace = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    strings = []
    for si in root.findall(f"{namespace}si"):
        text_parts = [t.text or "" for t in si.findall(f".//{namespace}t")]
        strings.append("".join(text_parts))
    return strings


def read_workbook_sheets(zip_handle: zipfile.ZipFile) -> List[Tuple[str, str]]:
    workbook_xml = zip_handle.read("xl/workbook.xml")
    workbook_root = ET.fromstring(workbook_xml)
    namespace = {
        "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    }
    rels_xml = zip_handle.read("xl/_rels/workbook.xml.rels")
    rels_root = ET.fromstring(rels_xml)
    rel_map = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels_root.findall(".//{http://schemas.openxmlformats.org/package/2006/relationships}Relationship")
    }
    sheets = []
    for sheet in workbook_root.findall("main:sheets/main:sheet", namespace):
        name = sheet.attrib.get("name")
        rel_id = sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
        target = rel_map.get(rel_id, "")
        if target:
            target = target.lstrip("/")
            if not target.startswith("xl/"):
                target = f"xl/{target}"
            sheets.append((name, target))
    return sheets


def extract_inline_string(cell: ET.Element, namespace: str) -> str:
    inline = cell.find(f"{namespace}is")
    if inline is None:
        return ""
    text_parts = [t.text or "" for t in inline.findall(f".//{namespace}t")]
    return "".join(text_parts)


def read_sheet(zip_handle: zipfile.ZipFile, sheet_path: str, shared_strings: List[str]) -> List[List[str]]:
    content = zip_handle.read(sheet_path)
    root = ET.fromstring(content)
    namespace = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    rows = []
    for row in root.findall(f".//{namespace}row"):
        row_values: Dict[int, str] = {}
        for cell in row.findall(f"{namespace}c"):
            cell_ref = cell.attrib.get("r", "")
            col_index = column_letter_to_index(cell_ref) if cell_ref else None
            if col_index is None:
                continue
            cell_type = cell.attrib.get("t")
            value = ""
            if cell_type == "inlineStr":
                value = extract_inline_string(cell, namespace)
            else:
                value_elem = cell.find(f"{namespace}v")
                if value_elem is not None:
                    value = value_elem.text or ""
                if cell_type == "s":
                    try:
                        value = shared_strings[int(value)]
                    except (IndexError, ValueError):
                        value = ""
            row_values[col_index] = value
        if row_values:
            max_index = max(row_values.keys())
            row_list = [row_values.get(i, "") for i in range(max_index + 1)]
            rows.append(row_list)
    return rows


def read_xlsx(path: Path) -> Dict[str, List[List[str]]]:
    data = {}
    with zipfile.ZipFile(path) as zip_handle:
        shared_strings = read_shared_strings(zip_handle)
        sheets = read_workbook_sheets(zip_handle)
        for name, sheet_path in sheets:
            data[name] = read_sheet(zip_handle, sheet_path, shared_strings)
    return data


def select_directors_sheet(sheets: Dict[str, List[List[str]]]) -> Tuple[str, List[List[str]]]:
    selected_name = None
    selected_rows: List[List[str]] = []
    max_rows = -1
    for name, rows in sheets.items():
        row_count = len(rows)
        if row_count > max_rows:
            max_rows = row_count
            selected_name = name
            selected_rows = rows
    if selected_name is None:
        raise SystemExit("No sheets found in the workbook.")
    print(f"Selected directors sheet: {selected_name} ({max_rows} rows)")
    return selected_name, selected_rows


def find_name_column(columns: List[str]) -> str:
    lowered = {col.lower(): col for col in columns}
    for candidate in ["name", "director_name", "director", "director name"]:
        if candidate in lowered:
            return lowered[candidate]
    return columns[0]


def rows_to_records(rows: List[List[str]]) -> Tuple[List[Dict[str, str]], List[str]]:
    header = []
    header_index = None
    for index, row in enumerate(rows):
        if any(cell.strip() for cell in row):
            header = [cell.strip() for cell in row]
            header_index = index
            break
    if header_index is None:
        return [], []

    records = []
    for row in rows[header_index + 1 :]:
        if not any(cell.strip() for cell in row):
            continue
        record = {header[i]: (row[i] if i < len(row) else "") for i in range(len(header))}
        records.append(record)
    return records, header


def build_directors_from_records(
    records: List[Dict[str, str]],
    sheet_columns: List[str],
    csv_columns: List[str],
) -> List[Dict[str, Any]]:
    name_column = find_name_column(sheet_columns)

    directors = []
    for index, row in enumerate(records):
        name = str(row.get(name_column, "")).strip()
        normalized = normalize_name(name)
        director_qid = str(row.get("director_qid", "")).strip()
        if director_qid and director_qid.upper().startswith("Q") and director_qid[1:].isdigit():
            director_id = director_qid
        else:
            digest = hashlib.sha1(f"{normalized}:{index}".encode("utf-8")).hexdigest()
            director_id = f"MANUAL:{digest}"

        manual_fields = {column: str(row.get(column, "")) for column in sheet_columns}

        director = {
            "id": director_id,
            "name": name,
            "director_qid": director_qid,
            "tier_ai": str(row.get("tier_ai", "")),
            "tier_ai_confidence": str(row.get("tier_ai_confidence", "")),
            "tier_ai_as_of": str(row.get("tier_ai_as_of", "")),
            "availability_ai": str(row.get("availability_ai", "")),
            "availability_ai_confidence": str(row.get("availability_ai_confidence", "")),
            "availability_ai_as_of": str(row.get("availability_ai_as_of", "")),
            "ai_evidence_urls": str(row.get("ai_evidence_urls", "")),
            "reps_manual": str(row.get("reps_manual", "")),
            "internal_notes": str(row.get("internal_notes", "")),
            "exclude": str(row.get("exclude", "")),
            "watchlist_priority": str(row.get("watchlist_priority", "")),
            "manual_fields": manual_fields,
        }
        directors.append(director)

        for column in csv_columns:
            row.setdefault(column, "")
        row["id"] = director_id

    directors.sort(key=lambda item: (item["name"].lower(), item["id"]))
    return directors


def write_manual_csv(records: List[Dict[str, str]], csv_columns: List[str]) -> None:
    MANUAL_CSV.parent.mkdir(parents=True, exist_ok=True)
    with MANUAL_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=csv_columns)
        writer.writeheader()
        for record in records:
            writer.writerow({col: record.get(col, "") for col in csv_columns})


def write_directors_json(directors: List[Dict[str, Any]]) -> None:
    DIRECTORS_JSON.parent.mkdir(parents=True, exist_ok=True)
    with DIRECTORS_JSON.open("w", encoding="utf-8") as handle:
        json.dump(directors, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def write_stub_json() -> None:
    for path in STUB_JSON_FILES:
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_text("[]\n", encoding="utf-8")


def build_from_xlsx(source_path: Path = SOURCE_XLSX) -> None:
    if not source_path.exists():
        print(f"Source spreadsheet not found: {source_path}")
        sys.exit(1)

    sheets = read_xlsx(source_path)
    _, rows = select_directors_sheet(sheets)
    records, sheet_columns = rows_to_records(rows)

    csv_columns = sheet_columns + [col for col in EXTRA_COLUMNS if col not in sheet_columns]
    for column in csv_columns:
        for record in records:
            record.setdefault(column, "")

    directors = build_directors_from_records(records, sheet_columns, csv_columns)

    write_manual_csv(records, csv_columns)
    write_directors_json(directors)
    write_stub_json()


if __name__ == "__main__":
    build_from_xlsx()
