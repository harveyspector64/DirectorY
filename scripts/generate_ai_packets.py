import json
from pathlib import Path
from typing import Dict, List

DIRECTORS_JSON = Path("public/data/atlas/directors.json")
PACKETS_DIR = Path("data/ai_packets")
BATCH_SIZE = 50


def select_manual_fields(director: Dict[str, str]) -> Dict[str, str]:
    manual_fields = director.get("manual_fields", {}) or {}
    selected = {}
    for key, value in manual_fields.items():
        key_lower = key.lower()
        if "filmography" in key_lower or "recent" in key_lower or "credits" in key_lower:
            if str(value).strip():
                selected[key] = str(value).strip()
    return selected


def build_packet_lines(directors: List[Dict[str, str]]) -> str:
    lines = [
        "# Director Radar AI Mission",
        "",
        "Paste the block below into ChatGPT (with web browsing enabled).",
        "Return ONLY CSV rows in the exact format:",
        "",
        "id,tier_ai,tier_ai_confidence,availability_ai,availability_ai_confidence,ai_evidence_urls,ai_as_of,notes",
        "",
        "Guidelines:",
        "- Use short tier labels (e.g., A, B, C) if possible.",
        "- availability_ai should be one of: Available, Maybe, Not Available, Unknown.",
        "- Provide confidence as High/Medium/Low.",
        "- ai_evidence_urls must be pipe-separated URLs (|) with no spaces.",
        "- ai_as_of should be YYYY-MM-DD.",
        "- notes should be brief.",
        "",
        "## Directors",
        "",
    ]

    for director in directors:
        lines.append(f"### {director.get('name', '').strip()} ({director.get('id')})")
        selected_fields = select_manual_fields(director)
        if selected_fields:
            lines.append("Manual fields:")
            for key, value in selected_fields.items():
                lines.append(f"- {key}: {value}")
        else:
            lines.append("Manual fields: (none provided)")
        lines.append("")

    return "\n".join(lines).strip() + "\n"


def main() -> None:
    if not DIRECTORS_JSON.exists():
        raise SystemExit("directors.json not found. Run import_manual_xlsx.py first.")

    directors = json.loads(DIRECTORS_JSON.read_text(encoding="utf-8"))
    PACKETS_DIR.mkdir(parents=True, exist_ok=True)

    for index in range(0, len(directors), BATCH_SIZE):
        batch_number = index // BATCH_SIZE + 1
        packet_path = PACKETS_DIR / f"packet_{batch_number:03d}.md"
        packet_content = build_packet_lines(directors[index : index + BATCH_SIZE])
        packet_path.write_text(packet_content, encoding="utf-8")


if __name__ == "__main__":
    main()
