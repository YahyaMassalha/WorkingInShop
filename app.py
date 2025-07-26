import os
from flask import Flask, request, jsonify, redirect, url_for
from flask_login import (
    LoginManager, UserMixin,
    login_user, logout_user, login_required,
    current_user
)
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash

# تهيئة Flask
app = Flask(__name__, static_folder="static", static_url_path="/static")
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "غيّر_هذا_لسرية_أكبر")

# إعداد MongoDB
MONGO_URI = os.environ["MONGO_URI"]
client     = MongoClient(MONGO_URI)
db         = client["work_tracker"]
users_col  = db["users"]
days_col   = db["work_days"]
wallet_col = db["wallet"]

# Flask-Login setup
login_manager = LoginManager(app)
login_manager.login_view = "login_page"

class User(UserMixin):
    def __init__(self, uid, email):
        self.id = uid
        self.email = email

@login_manager.user_loader
def load_user(uid):
    doc = users_col.find_one({"_id": uid})
    if not doc:
        return None
    return User(doc["_id"], doc["email"])

# ————————— صفحات تسجيل الدخول —————————

@app.route("/login", methods=["GET"])
def login_page():
    return app.send_static_file("login.html")

@app.route("/login", methods=["POST"])
def login_action():
    email = request.form.get("email", "").lower().strip()
    pw    = request.form.get("password", "")
    user = users_col.find_one({"email": email})
    if not user or not check_password_hash(user["pw_hash"], pw):
        return redirect(url_for("login_page") + "?error=1")
    login_user(User(user["_id"], email))
    return redirect("/")

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect("/login")

# ————————— حماية الصفحات الثابتة —————————

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
@login_required
def protected_spa(path):
    return app.send_static_file("index.html")

# ————————— API محمي —————————

def ensure_wallet(uid):
    if wallet_col.count_documents({"_id": uid}) == 0:
        wallet_col.insert_one({"_id": uid, "balance": 0, "salary_adjustment": 0})

@app.route("/api/get-days", methods=["GET"])
@login_required
def get_days():
    days = list(days_col.find(
        {"user_id": current_user.id},
        {"_id": 0, "user_id": 0}
    ))
    return jsonify(days), 200

@app.route("/api/save-day", methods=["POST"])
@login_required
def save_day():
    data = request.get_json() or {}
    date = data.get("date")
    if not date:
        return jsonify({"error": "Missing date"}), 400
    update = {k: data[k] for k in ("start","end","salary","status") if k in data}
    days_col.update_one(
        {"date": date, "user_id": current_user.id},
        {"$set": update},
        upsert=True
    )
    return jsonify({"message": "Saved!"}), 200

@app.route("/api/get-wallet", methods=["GET"])
@login_required
def get_wallet():
    ensure_wallet(current_user.id)
    w = wallet_col.find_one({"_id": current_user.id})
    return jsonify({
        "balance": w["balance"],
        "salary_adjustment": w["salary_adjustment"]
    }), 200

@app.route("/api/modify-wallet", methods=["POST"])
@login_required
def modify_wallet():
    amt = request.get_json().get("amount", 0)
    ensure_wallet(current_user.id)
    wallet_col.update_one(
        {"_id": current_user.id},
        {"$inc": {"balance": amt}}
    )
    w = wallet_col.find_one({"_id": current_user.id})
    return jsonify({"balance": w["balance"]}), 200

@app.route("/api/modify-salary", methods=["POST"])
@login_required
def modify_salary():
    amt = request.get_json().get("amount", 0)
    ensure_wallet(current_user.id)
    wallet_col.update_one(
        {"_id": current_user.id},
        {"$inc": {"salary_adjustment": amt}}
    )
    w = wallet_col.find_one({"_id": current_user.id})
    return jsonify({
        "salary_adjustment": w["salary_adjustment"],
        "balance": w["balance"]
    }), 200

@app.route("/api/receive-salary", methods=["POST"])
@login_required
def receive_salary():
    done_days = days_col.find({
        "user_id": current_user.id,
        "status": "done"
    }, {"salary": 1})
    total_done = sum(d.get("salary", 0) for d in done_days)
    ensure_wallet(current_user.id)
    w = wallet_col.find_one({"_id": current_user.id})
    total = total_done + w["salary_adjustment"]
    wallet_col.update_one(
        {"_id": current_user.id},
        {"$inc": {"balance": total}, "$set": {"salary_adjustment": 0}}
    )
    days_col.update_many(
        {"user_id": current_user.id, "status": "done"},
        {"$set": {"status": "paid"}}
    )
    return jsonify({"received": total}), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
