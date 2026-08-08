import sqlite3
import json

conn = sqlite3.connect("studio.db")
conn.row_factory = sqlite3.Row
cur = conn.cursor()
try:
    cur.execute("SELECT id, status, error, created_at, updated_at FROM jobs ORDER BY datetime(created_at) DESC LIMIT 5")
    rows = [dict(r) for r in cur.fetchall()]
    with open('out.json', 'w') as f:
        json.dump(rows, f, indent=2)
except Exception as e:
    print(f"Error querying DB: {e}")
