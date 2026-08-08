import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_mock_fallback_ideas():
    response = client.post("/api/ideas", json={
        "brief": "Test campaign",
        "product": "Test Product",
        "background": "Dark",
        "formats": ["Mobile"],
        "audiences": ["Students"],
        "products": ["Test Product"]
    }, headers={"X-Demo-Mode": "true"})
    
    assert response.status_code == 200
    data = response.json()
    assert "ideas" in data
    assert data.get("source") == "mock"
    assert len(data["ideas"]) > 0

def test_mock_fallback_assets():
    response = client.post("/api/assets", json={
        "campaign_type": "image",
        "product": "Galaxy",
        "idea": {"id": 1, "en": "Test ideas", "fr": "Test fr"},
        "formats": ["Mobile"],
        "audiences": ["Students"],
        "secondary": "Dark",
        "brief": "Test brief",
        "products": ["Galaxy"]
    }, headers={"X-Demo-Mode": "true"})
    
    assert response.status_code == 200
    data = response.json()
    assert data.get("source") == "mock"
    assert "Mobile" in data["assets"]

def test_campaign_save_and_resume():
    # Save dummy campaign
    save_resp = client.post("/api/campaigns", json={
        "id": None,
        "name": "Test Save",
        "campaign_type": "image",
        "status": "draft",
        "state": {"step": 2, "brief": "test"}
    })
    assert save_resp.status_code == 200
    c_id = save_resp.json()["id"]

    # Resume campaign
    get_resp = client.get(f"/api/campaigns/{c_id}")
    assert get_resp.status_code == 200
    c_data = get_resp.json()
    assert c_data["state"]["step"] == 2
    assert c_data["state"]["brief"] == "test"

def test_quality_check_endpoint():
    # Calling quality check which should return standard deterministic failures for an empty object
    response = client.post("/api/quality-check", json={
        "product": "Galaxy",
        "campaign_type": "image",
        "formats": ["Mobile"],
        "assets": {
            "Mobile": {
                 "en": {"headline": "", "body": ""},
                 "fr": {"headline": "", "body": ""}
            }
        },
        "brief": "Test brief",
        "logo_placements": [],
        "products": ["Galaxy"]
    })
    assert response.status_code == 200
    data = response.json()
    assert "overall" in data
    assert "checks" in data
    # At least some checks like missing headline should fail
    has_fail = any(c["status"] == "fail" for c in data["checks"])
    assert has_fail
