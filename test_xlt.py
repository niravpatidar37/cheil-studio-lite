import requests

payload = {
    "ideas": [
        {
            "id": 1,
            "en": "hello concept",
            "headline_en": "test hook",
            "body_en": "test body copy"
        }
    ]
}

try:
    resp = requests.post("http://127.0.0.1:8000/api/ideas/translate", json=payload)
    print("STATUS", resp.status_code)
    print("RESPONSE", resp.text)
except Exception as e:
    print("EXCEPTION", e)
