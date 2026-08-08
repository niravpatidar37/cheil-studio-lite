import requests
import json
import time

body = {
  "campaign_type": "image",
  "product": "test product",
  "products": [],
  "idea": {
      "id": 1,
      "en": "test",
      "fr": "test",
      "headline_en": "test",
      "body_en": "test",
      "headline_fr": "test",
      "body_fr": "test"
  },
  "formats": ["Mobile", "Desktop"],
  "audiences": ["Target A"],
  "secondary": "Test Style",
  "brief": "Test Brief"
}

start = time.time()
print("Starting request...")
try:
    res = requests.post("http://127.0.0.1:8000/api/assets", json=body)
    print("Status:", res.status_code)
except Exception as e:
    print("Error:", e)
end = time.time()
print(f"Time taken: {end-start:.2f}s")
