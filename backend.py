# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import random
import string
import time
from datetime import datetime, timedelta
import threading

# Try to import Faker; if not available, we'll use a fallback generator
try:
    from faker import Faker
    HAS_FAKER = True
    fake = Faker()
except Exception:
    HAS_FAKER = False
    fake = None

app = Flask(__name__)
CORS(app)

TOTAL_USERS = 1_000_000  # one million
_USERS = None
_USERS_LOCK = threading.Lock()
_GENERATED = False

def random_phone():
    # Indian-like phone numbers or general format
    return "+1" + "".join(random.choices(string.digits, k=10))

def random_email(name, uid):
    # deterministic-ish small email
    safe = "".join(c for c in name.lower() if c.isalnum())[:12] or "user"
    domain = random.choice(["example.com", "mail.com", "demo.net", "sample.org"])
    return f"{safe}.{uid}@{domain}"

def random_name(uid):
    if HAS_FAKER:
        return fake.name()
    # fallback: combine random first and last
    first = random.choice([
        "Alex","Sam","Taylor","Jordan","Chris","Pat","Morgan","Jamie","Casey","Riley",
        "Avery","Quinn","Drew","Hayden","Cameron","Devin","Skyler","Parker","Rowan","Kendall"
    ])
    last = random.choice([
        "Patel","Sharma","Dubey","Singh","Kumar","Gupta","Malhotra","Mehta","Joshi","Desai",
        "Johnson","Smith","Brown","Miller","Davis","Garcia","Rodriguez","Wilson","Martinez","Anderson"
    ])
    return f"{first} {last}"

def random_last_message_at():
    # return ISO timestamp within last 365 days
    dt = datetime.utcnow() - timedelta(seconds=random.randint(0, 365*24*3600))
    return dt.isoformat() + "Z"

def random_score():
    # 0-1000 with decimal
    return round(random.random() * 1000, 2)

def random_avatar(uid):
    # Use pravatar placeholder service; mod it so it stays in range
    idx = (uid % 70) + 1  # pravatar supports up to ~70
    return f"https://i.pravatar.cc/150?img={idx}"

def random_added_by():
    if HAS_FAKER:
        return random.choice([fake.name() for _ in range(10)])
    return random.choice(["admin", "importer", "john.doe", "jane.smith", "system"])

def generate_user(uid):
    # uid: 1-based
    name = random_name(uid)
    phone = random_phone()
    email = random_email(name, uid)
    score = random_score()
    lastMessageAt = random_last_message_at()
    addedBy = random_added_by()
    avatar = random_avatar(uid)
    return {
        "id": uid,
        "name": name,
        "phone": phone,
        "email": email,
        "score": score,
        "lastMessageAt": lastMessageAt,
        "addedBy": addedBy,
        "avatar": avatar
    }

def generate_users_once():
    global _USERS, _GENERATED
    with _USERS_LOCK:
        if _GENERATED:
            return
        start = time.time()
        print(f"[startup] generating {TOTAL_USERS} users... (this may take ~20-60s depending on CPU)")
        users = [None] * TOTAL_USERS
        # Use chunked generation to be a bit friendlier to memory allocation
        chunk = 50_000
        for base in range(0, TOTAL_USERS, chunk):
            end = min(base + chunk, TOTAL_USERS)
            for i in range(base, end):
                uid = i + 1
                users[i] = generate_user(uid)
            # optional: print progress occasionally
            if (base // chunk) % 4 == 0:
                print(f"  generated {end}/{TOTAL_USERS}")
        _USERS = users
        _GENERATED = True
        took = time.time() - start
        print(f"[startup] done generating {TOTAL_USERS} users in {took:.1f}s")

@app.before_first_request
def maybe_generate():
    # Fire generation in background thread so server responds quickly to health checks.
    # But for this assignment, the generation will start immediately on first request.
    if not _GENERATED:
        t = threading.Thread(target=generate_users_once, daemon=True)
        t.start()

@app.route("/api/users/count")
def users_count():
    # If generation is ongoing, still return the target count
    return jsonify({"total": TOTAL_USERS})

def apply_search_filter(data, search):
    if not search:
        return data
    s = search.strip().lower()
    def match(u):
        return (s in u["name"].lower()) or (s in u["email"].lower()) or (s in u["phone"].lower())
    # Filter using list comprehension (memory usage: ephemeral)
    return [u for u in data if match(u)]

def apply_sort(data, sort_by, sort_order):
    if not sort_by:
        return data
    reverse = (sort_order == "desc")
    # Define key functions for some fields
    if sort_by == "id":
        keyfn = lambda u: u["id"]
    elif sort_by == "score":
        keyfn = lambda u: u["score"]
    elif sort_by == "lastMessageAt":
        keyfn = lambda u: u["lastMessageAt"]
    elif sort_by in ("name", "email", "phone", "addedBy"):
        keyfn = lambda u: u[sort_by].lower() if isinstance(u[sort_by], str) else u[sort_by]
    else:
        # default fallback
        keyfn = lambda u: u.get(sort_by, "")
    try:
        data.sort(key=keyfn, reverse=reverse)
    except Exception:
        pass
    return data

@app.route("/api/users")
def get_users():
    # Wait until generation starts and some users exist (if still generating, we'll serve partial)
    global _USERS
    # Query params
    try:
        page = int(request.args.get("page", 1))
    except:
        page = 1
    try:
        limit = int(request.args.get("limit", 30))
    except:
        limit = 30
    if limit <= 0 or limit > 1000:
        limit = 30
    search = request.args.get("search", None)
    sort_by = request.args.get("sort_by", None)  # e.g., name, email, score
    sort_order = request.args.get("sort_order", "asc").lower()
    if sort_order not in ("asc", "desc"):
        sort_order = "asc"

    # If generation hasn't finished, but _USERS exists partially, we can serve currently generated items.
    # If _USERS is None (not started), trigger generation synchronously.
    if _USERS is None:
        # If first request ever, generate synchronously to ensure availability (could take some seconds)
        generate_users_once()

    # Local reference
    data = _USERS

    # Defensive: if still None, return empty
    if data is None:
        return jsonify({
            "page": page,
            "limit": limit,
            "total": TOTAL_USERS,
            "items": []
        })

    # To avoid sorting/filtering the entire 1M on every request for basic pagination, we could optimize.
    # For this assignment, we implement straightforward behavior: filter & sort then slice.
    # NOTE: For production with 1M, implement indexed search or server-side DB.
    # Apply search
    if search:
        filtered = apply_search_filter(data, search)
        total_filtered = len(filtered)
    else:
        filtered = data
        total_filtered = TOTAL_USERS

    # Apply sorting (in-place on the filtered list copy to avoid mutating global _USERS unintentionally)
    # Make a shallow copy before sorting if needed
    # If no search and sort_by is None, we can directly slice from data
    if sort_by:
        # operate on a copy to avoid mutating global ordering
        working = list(filtered)
        apply_sort(working, sort_by, sort_order)
    else:
        working = filtered

    # Pagination - pages are 1-based
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    items = working[start_idx:end_idx]

    return jsonify({
        "page": page,
        "limit": limit,
        "total": total_filtered,
        "items": items
    })

@app.route("/health")
def health():
    status = "ready" if _GENERATED else "generating"
    return jsonify({"status": status, "total_expected": TOTAL_USERS})

if __name__ == "__main__":
    # Optionally, seed randomness for reproducibility - comment out if you want fresh data each start
    random.seed(42)
    if HAS_FAKER:
        Faker.seed(42)
    # Generate synchronously here if you want the server to be ready immediately at startup.
    # generate_users_once()
    # Start flask app
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
