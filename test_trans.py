import requests

resp = requests.post("http://localhost:8000/api/ideas/translate", json={
    "ideas": [{"id":1, "en": "Test", "headline_en": "Test H", "body_en": "Test B"}]
}, headers={"X-Demo-Mode": "false"})
print(resp.status_code)
print(resp.json())
