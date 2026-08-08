import requests
import json
import time

body = {
  "product": "test product",
  "products": [],
  "idea_en": "test",
  "style": "Test Style",
  "banner_sizes": ["Mobile"],
  "audiences": ["Target A"],
  "product_image": "",
  "product_images": []
}
print("Starting image generation...")
start = time.time()
try:
    res = requests.post("http://127.0.0.1:8000/api/image-generation", json=body)
    print("Status:", res.status_code)
except Exception as e:
    print("Error:", e)
end = time.time()
print(f"Time taken: {end-start:.2f}s")
