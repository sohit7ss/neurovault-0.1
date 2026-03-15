import requests

BASE = "http://localhost:5001/api"

# Test login
r = requests.post(f"{BASE}/auth/login", json={
    "email": "api_test_user@example.com",
    "password": "Password123!"
})
print(f"Login Status: {r.status_code}")
data = r.json()
user = data.get("user", {})
print(f"User: {user.get('name', 'N/A')}")
token = data.get("access_token", "")
print(f"Token: {token[:30]}...")

# Test dashboard
headers = {"Authorization": f"Bearer {token}"}
r2 = requests.get(f"{BASE}/dashboard/stats", headers=headers)
print(f"\nDashboard Status: {r2.status_code}")
if r2.status_code == 200:
    stats = r2.json().get("stats", {})
    print(f"Docs: {stats.get('documents', 0)}, Roadmaps: {stats.get('roadmaps', 0)}")
else:
    print(f"Dashboard error: {r2.text[:200]}")

# Test documents list
r3 = requests.get(f"{BASE}/documents", headers=headers)
print(f"\nDocuments Status: {r3.status_code}")
if r3.status_code == 200:
    print(f"Total docs: {r3.json().get('total', 0)}")
else:
    print(f"Docs error: {r3.text[:200]}")
