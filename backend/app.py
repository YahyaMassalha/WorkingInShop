from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import os

app = Flask(__name__)
CORS(app)

MONGO_URI = (
    "mongodb+srv://unknownmasalha1:FvehuNBd3L0DPA4U"
    "@cluster0.nekekvh.mongodb.net/work_tracker"
    "?retryWrites=true&w=majority&appName=Cluster0"
)
client     = MongoClient(MONGO_URI)
db         = client["work_tracker"]
days_col   = db["work_days"]
wallet_col = db["wallet"]

# تأكد من وجود وثيقة المحفظة
if wallet_col.count_documents({"_id": "wallet"}) == 0:
    wallet_col.insert_one({"_id": "wallet", "balance": 0, "salary_adjustment": 0})

@app.route("/api/get-days", methods=["GET"])
def get_days():
    days = list(days_col.find({}, {"_id": 0}))
    return jsonify(days), 200

@app.route("/api/save-day", methods=["POST"])
def save_day():
    data = request.get_json()
    date = data.get("date")
    if not date:
        return jsonify({"error": "Missing date"}), 400
    update = {}
    for f in ("start", "end", "salary", "status"):
        if f in data:
            update[f] = data[f]
    days_col.update_one({"date": date}, {"$set": update}, upsert=True)
    return jsonify({"message": "Saved!"}), 200

@app.route("/api/get-wallet", methods=["GET"])
def get_wallet():
    w = wallet_col.find_one({"_id": "wallet"})
    return jsonify({
        "balance": w["balance"],
        "salary_adjustment": w.get("salary_adjustment", 0)
    }), 200

@app.route("/api/modify-wallet", methods=["POST"])
def modify_wallet():
    amt = request.get_json().get("amount", 0)
    wallet_col.update_one({"_id": "wallet"}, {"$inc": {"balance": amt}})
    w = wallet_col.find_one({"_id": "wallet"})
    return jsonify({"balance": w["balance"]}), 200

@app.route("/api/modify-salary", methods=["POST"])
def modify_salary():
    amt = request.get_json().get("amount", 0)
    wallet_col.update_one({"_id": "wallet"}, {"$inc": {"salary_adjustment": amt}})
    w = wallet_col.find_one({"_id": "wallet"})
    return jsonify({
        "salary_adjustment": w["salary_adjustment"],
        "balance": w["balance"]
    }), 200

@app.route("/api/receive-salary", methods=["POST"])
def receive_salary():
    done_days = days_col.find({"status": "done"}, {"salary": 1})
    total_done = sum(d.get("salary", 0) for d in done_days)
    w = wallet_col.find_one({"_id": "wallet"})
    adj = w.get("salary_adjustment", 0)
    total = total_done + adj

    wallet_col.update_one(
        {"_id": "wallet"},
        {"$inc": {"balance": total}, "$set": {"salary_adjustment": 0}}
    )
    days_col.update_many({"status": "done"}, {"$set": {"status": "paid"}})
    return jsonify({"received": total}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
