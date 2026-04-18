"""
NeoFraud Sentinel — Training Script
Isolation Forest sur creditcard.csv (Kaggle)
Features adaptées à la structure de transactions NeoFraud
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
import os
import json

# ─────────────────────────────────────────
# 1. CHARGEMENT DES DONNÉES
# ─────────────────────────────────────────
print("📂 Chargement du dataset...")
df = pd.read_csv("data/creditcard.csv")
print(f"   ✓ {len(df)} transactions chargées — {df['Class'].sum()} fraudes réelles ({df['Class'].mean()*100:.3f}%)")

# ─────────────────────────────────────────
# 2. FEATURE ENGINEERING
#    Mapping vers les features de NeoFraud :
#    - Amount  → montant transaction (direct)
#    - Time    → heure de la journée (0–23)
#    - V1–V28  → features PCA anonymisées (on garde les plus discriminantes)
# ─────────────────────────────────────────
print("\n🔧 Feature engineering...")

# Heure normalisée sur 24h (Time est en secondes depuis la 1ère transaction)
df['hour'] = (df['Time'] % 86400) / 3600  # 0.0 à 24.0

# Features les plus corrélées à la fraude selon la littérature sur ce dataset
TOP_FEATURES = ['V4', 'V11', 'V12', 'V14', 'V17', 'V3', 'V7', 'V10', 'V16', 'V2']

# Features finales utilisées par le modèle
FEATURES = ['Amount', 'hour'] + TOP_FEATURES
print(f"   ✓ Features sélectionnées : {FEATURES}")

X = df[FEATURES].copy()
y = df['Class'].values  # 0 = normal, 1 = fraude (pour évaluation uniquement)

# ─────────────────────────────────────────
# 3. NORMALISATION
# ─────────────────────────────────────────
print("\n⚖️  Normalisation des données...")
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
print("   ✓ StandardScaler appliqué")

# ─────────────────────────────────────────
# 4. ENTRAÎNEMENT — ISOLATION FOREST
#    contamination = proportion estimée de fraudes
# ─────────────────────────────────────────
print("\n🌲 Entraînement de l'Isolation Forest...")
contamination = round(float(df['Class'].mean()), 4)

model = IsolationForest(
    n_estimators=200,
    contamination=contamination,
    max_samples='auto',
    random_state=42,
    n_jobs=-1
)
model.fit(X_scaled)
print(f"   ✓ Modèle entraîné (contamination={contamination}, n_estimators=200)")

# ─────────────────────────────────────────
# 5. ÉVALUATION RAPIDE
# ─────────────────────────────────────────
print("\n📊 Évaluation...")
scores = model.decision_function(X_scaled)  # Plus bas = plus anormal
predictions = model.predict(X_scaled)        # -1 = anomalie, 1 = normal

# Convertir en 0/1 pour comparer avec les vrais labels
pred_binary = np.where(predictions == -1, 1, 0)

from sklearn.metrics import classification_report, roc_auc_score
print(classification_report(y, pred_binary, target_names=['Normal', 'Fraude']))

auc = roc_auc_score(y, -scores)  # On inverse car score bas = anomalie
print(f"   ✓ AUC-ROC : {auc:.4f}")

# ─────────────────────────────────────────
# 6. SAUVEGARDE
# ─────────────────────────────────────────
print("\n💾 Sauvegarde du modèle...")
os.makedirs("model", exist_ok=True)

joblib.dump(model, "model/isolation_forest.joblib")
joblib.dump(scaler, "model/scaler.joblib")

# Sauvegarde des métadonnées (features utilisées, seuils, etc.)
metadata = {
    "features": FEATURES,
    "contamination": contamination,
    "n_estimators": 200,
    "auc_roc": round(auc, 4),
    "score_min": float(scores.min()),
    "score_max": float(scores.max()),
    "score_mean": float(scores.mean())
}
with open("model/metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)

print("   ✓ model/isolation_forest.joblib")
print("   ✓ model/scaler.joblib")
print("   ✓ model/metadata.json")
print(f"\n✅ Entraînement terminé ! AUC-ROC = {auc:.4f}")