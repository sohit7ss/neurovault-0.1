import requests, json

BASE = "http://localhost:5001/api"

# Login first
r = requests.post(f"{BASE}/auth/login", json={
    "email": "api_test_user@example.com",
    "password": "Password123!"
})
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Test AI Search (should fallback to general knowledge)
print("=" * 60)
print("TEST 1: AI Search (General Knowledge Fallback)")
print("=" * 60)
r2 = requests.post(f"{BASE}/ai/query", headers=headers, json={"query": "What is machine learning?"})
print(f"Status: {r2.status_code}")
if r2.status_code == 200:
    data = r2.json()
    print(f"Mode: {data.get('mode', 'unknown')}")
    print(f"Answer (first 300 chars): {data.get('answer', '')[:300]}...")
else:
    print(f"Error: {r2.text[:300]}")

# Test Roadmap Generation
print("\n" + "=" * 60)
print("TEST 2: Roadmap Generation (Enhanced)")
print("=" * 60)
r3 = requests.post(f"{BASE}/roadmap/generate", headers=headers, json={
    "goal": "Python Programming",
    "level": "beginner",
    "time_available": "2 hours/day"
})
print(f"Status: {r3.status_code}")
if r3.status_code == 201:
    rm = r3.json()
    rd = rm.get("roadmap_data", {})
    print(f"Title: {rd.get('title', 'N/A')}")
    print(f"Total Hours: {rd.get('total_estimated_hours', 0)}")
    print(f"Phases: {len(rd.get('phases', []))}")
    for phase in rd.get("phases", []):
        topics = phase.get("topics", [])
        print(f"\n  Phase: {phase.get('title')}")
        print(f"  Prerequisites: {phase.get('prerequisites', 'N/A')}")
        print(f"  Topics: {len(topics)}")
        for t in topics[:2]:  # show first 2 topics per phase
            print(f"    - {t.get('title')} [{t.get('difficulty','?')}] ({t.get('estimated_hours',0)}h)")
            subs = t.get("subtopics", [])
            if subs:
                print(f"      Subtopics: {', '.join(subs[:3])}...")
            resources = t.get("resources", [])
            for res in resources[:2]:
                print(f"      {res.get('type')}: {res.get('title')} -> {res.get('url','')[:50]}")
else:
    print(f"Error: {r3.text[:500]}")
