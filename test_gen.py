import requests

print("Generating ideas...")
resp = requests.post("http://localhost:8000/api/ideas", json={
    "brief": "sell galaxy s26 and watch 6",
    "product": "galaxy s26",
    "products": ["galaxy s26", "watch 6"],
    "background": "",
    "formats": ["Website", "Desktop", "Mobile"],
    "audiences": ["tech lovers"]
}, headers={"X-Demo-Mode": "false"})
print(resp.status_code)
print(resp.text)
ideas = resp.json().get("ideas", [])
print(ideas)

print("\nTranslating...")
resp2 = requests.post("http://localhost:8000/api/ideas/translate", json={
    "ideas": ideas
}, headers={"X-Demo-Mode": "false"})
print(resp2.status_code)
print(resp2.json())
