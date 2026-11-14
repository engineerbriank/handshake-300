"""Loads the Paid Tasks catalogue and the verified app directory into the database.
Run after a remix (data does not copy):  python3 seed/load_seed.py
Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment. Safe to re-run (upserts)."""
import json, os, pathlib, requests
here = pathlib.Path(__file__).parent
url = os.environ["SUPABASE_URL"]; key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
h = {"apikey": key, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"}
if not key.startswith("sb_"): h["Authorization"] = "Bearer " + key

def upsert(table, conflict, rows):
    for i in range(0, len(rows), 200):
        r = requests.post(f"{url}/rest/v1/{table}?on_conflict={conflict}", headers=h, json=rows[i:i+200], timeout=60)
        r.raise_for_status()
    print(table, len(rows))

apps = json.load(open(here / "apps.json"))
upsert("task_app_directory", "package_id", [{k: a.get(k) for k in ["name","publisher","category","package_id","play_store_url","website_url","listing_available","last_verified_at","client_authorized","testing_instructions"]} for a in apps])
tp = here / "task_templates.json"
if tp.exists():
    fields = ["code","category_slug","title","summary","description","instructions","deliverables","verification_checklist","submission_types","required_skills","difficulty","suggested_pay_usd","estimated_minutes"]
    upsert("task_templates", "code", [{k: t[k] for k in fields} for t in json.load(open(tp))])
