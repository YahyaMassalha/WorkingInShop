import os
from flask import Flask, request, jsonify, redirect, url_for, session, send_from_directory
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder="static", static_url_path="/static")

# لأي شيء يتعلق بالجلسة (session) – استخدم مفتاح قوي وحافظ عليه سريّاً:
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "تغيّره_لكي_يكون_عشوائياً")

# MongoDB
MONGO_URI = os.environ["MONGO_URI"]
client     = MongoClient(MONGO_URI)
db         = client["work_tracker"]
days_col   = db["work_days"]
wallet_col = db["wallet"]
users_col  = db["users"]    # ← هنا نخزن المستخدمين

# Flask‑Login setup
login_manager = LoginManager()
login_manager.login_view = "login_page"
login_manager.init_app(app)

class User(UserMixin):
    def __init__(self, email, _id):
        self.id = str(_id)
        self.email = email

@login_manager.user_loader
def load_user(user_id):
    doc = users_col.find_one({"_id": user_id})
    if not doc: return None
    return User(doc["email"], doc["_id"])

# إذا لم توجد وثيقة المحفظة؛ ننشئها
if wallet_col.count_documents({"_id": "wallet"}) == 0:
    wallet_col.insert_one({"_id": "wallet", "balance": 0, "salary_adjustment": 0})

# ⏺ صفحة تسجيل الدخول (GET)
@app.route("/login", methods=["GET"])
def login_page():
    return app.send_static_file("login.html")

# ⏺ عملية تسجيل الدخول (POST)
@app.route("/login", methods=["POST"])
def login_action():
    data = request.form
    email = data.get("email","").lower().strip()
    pw    = data.get("password","")
    user_doc = users_col.find_one({"email": email})
    if not user_doc or not check_password_hash(user_doc["pw_hash"], pw):
        return redirect(url_for("login_page") + "?error=1")
    user = User(email, user_doc["_id"])
    login_user(user)
    return redirect("/")

# ⏺ تسجيل الخروج
@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect("/login")

# ─── صفحات ثابتة محمية ────
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
@login_required
def protected_spa(path):
    # أي طلب لمسار غير API يرسل index.html
    return app.send_static_file("index.html")


# ─── طابع الـAPI محمي ────
@app.route("/api/get-days", methods=["GET"])
@login_required
def get_days():
    days = list(days_col.find({}, {"_id": 0}))
    return jsonify(days), 200

# … وهكذا لكل مسارات /api/** أضف @login_required فوقها …

# في النهاية:
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
