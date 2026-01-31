import csv
from pathlib import Path
from typing import Dict, List

from import_manual_xlsx import build_from_xlsx

AI_RESULTS_CSV = Path("data/manual/ai_results.csv")
MANUAL_CSV = Path("data/manual/directors_manual.csv")


def load_ai_results() -> List[Dict[str, str]]:
    if not AI_RESULTS_CSV.exists():
        raise SystemExit("ai_results.csv not found. Create data/manual/ai_results.csv first.")
    with AI_RESULTS_CSV.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return [row for row in reader]


def load_manual_rows() -> List[Dict[str, str]]:
    if not MANUAL_CSV.exists():
        raise SystemExit("directors_manual.csv not found. Run import_manual_xlsx.py first.")
    with MANUAL_CSV.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return [row for row in reader]


def write_manual_rows(rows: List[Dict[str, str]], fieldnames: List[str]) -> None:
    with MANUAL_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def apply_ai_results() -> None:
    ai_rows = load_ai_results()
    manual_rows = load_manual_rows()

    if not manual_rows:
        raise SystemExit("directors_manual.csv is empty.")

    fieldnames = list(manual_rows[0].keys())
    ai_lookup = {row.get("id", ""): row for row in ai_rows if row.get("id")}

    for row in manual_rows:
        director_id = row.get("id", "")
        if not director_id or director_id not in ai_lookup:
            continue
        ai_row = ai_lookup[director_id]
        row["tier_ai"] = ai_row.get("tier_ai", row.get("tier_ai", ""))
        row["tier_ai_confidence"] = ai_row.get("tier_ai_confidence", row.get("tier_ai_confidence", ""))
        row["availability_ai"] = ai_row.get("availability_ai", row.get("availability_ai", ""))
        row["availability_ai_confidence"] = ai_row.get(
            "availability_ai_confidence", row.get("availability_ai_confidence", "")
        )
        ai_as_of = ai_row.get("ai_as_of", "")
        if ai_as_of:
            row["tier_ai_as_of"] = ai_as_of
            row["availability_ai_as_of"] = ai_as_of
        row["ai_evidence_urls"] = ai_row.get("ai_evidence_urls", row.get("ai_evidence_urls", ""))
        notes = ai_row.get("notes", "").strip()
        if notes:
            existing_notes = row.get("internal_notes", "").strip()
            combined = f"{existing_notes}\n{notes}".strip()
            row["internal_notes"] = combined

    write_manual_rows(manual_rows, fieldnames)
    build_from_xlsx()


if __name__ == "__main__":
    apply_ai_results()
