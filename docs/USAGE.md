# Director Radar — Usage Guide (Non-Technical)

This guide explains how to update the spreadsheet, regenerate the site data, and run the AI mission workflow step-by-step.

## 1) Upload a new spreadsheet

1. Open the repo on GitHub.
2. Navigate to `data/manual/source/`.
3. Click **Add file → Upload files**.
4. Upload your new `directors.xlsx` (same filename).
5. Commit the change to the `work` branch.

✅ Once committed, the GitHub Action will regenerate the JSON files automatically.

## 2) Run the importer locally (optional)

If you have access to a terminal with Python installed:

```bash
python scripts/import_manual_xlsx.py
```

This will:
- Read `data/manual/source/directors.xlsx`
- Write `data/manual/directors_manual.csv`
- Write `public/data/atlas/directors.json`

## 3) Generate AI packets

1. Make sure you already ran the importer so `public/data/atlas/directors.json` exists.
2. Run:

```bash
python scripts/generate_ai_packets.py
```

3. Open the newly created file at `data/ai_packets/packet_001.md`.
4. Copy the contents into ChatGPT with web browsing enabled.

## 4) Paste ChatGPT results back

1. Create or open `data/manual/ai_results.csv`.
2. Paste the CSV rows produced by ChatGPT.
3. Ensure the header is:

```csv
id,tier_ai,tier_ai_confidence,availability_ai,availability_ai_confidence,ai_evidence_urls,ai_as_of,notes
```

## 5) Apply AI results + rebuild the JSON

Run:

```bash
python scripts/apply_ai_results.py
```

This will:
- Merge AI fields into `data/manual/directors_manual.csv`
- Rebuild `public/data/atlas/directors.json`

## 6) View the site

1. Open the site URL (GitHub Pages or wherever it is hosted).
2. Use the search and filters to browse directors.
3. Click any director to see details and pin them for comparison.
4. Visit `/compare` to compare up to 3 pinned directors.
