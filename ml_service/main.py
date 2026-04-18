"""
NeoFraud Sentinel — FastAPI ML Microservice
Endpoint /predict : reçoit une transaction, retourne risk_score + SHAP
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import joblib
import numpy as np
import json
import os

# ─────────────────────────────────────────
# CHARGEMENT DU MODÈLE AU DÉMARRAGE
# ─────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model", "isolation_forest.joblib")
SCALER_PATH = os.path.join(BASE_DIR, "model", "scaler.joblib")
META_PATH = os.path.join(BASE_DIR, "model", "metadata.json")

model = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)

with open(META_PATH) as f:
    metadata = json.load(f)

FEATURES = metadata["features"]
SCORE_MIN = metadata["score_min"]
SCORE_MAX = metadata["score_max"]

print(f"✅ Modèle chargé — AUC-ROC entraînement : {metadata['auc_roc']}")

# ─────────────────────────────────────────
# APP FASTAPI
# ─────────────────────────────────────────
app = FastAPI(
    title="NeoFraud Sentinel — ML Service",
    description="Microservice de détection de fraude bancaire (Isolation Forest)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────
class TransactionInput(BaseModel):
    amount: float
    hour: Optional[float] = 12.0   # heure de la journée (0-24)
    # Features graph optionnelles (si Neo4j GDS disponible)
    v4: Optional[float] = 0.0
    v11: Optional[float] = 0.0
    v12: Optional[float] = 0.0
    v14: Optional[float] = 0.0
    v17: Optional[float] = 0.0
    v3: Optional[float] = 0.0
    v7: Optional[float] = 0.0
    v10: Optional[float] = 0.0
    v16: Optional[float] = 0.0
    v2: Optional[float] = 0.0
    # Metadata (non utilisées dans le modèle, pour le logging)
    txId: Optional[str] = None
    userId: Optional[str] = None

class PredictionOutput(BaseModel):
    txId: Optional[str]
    risk_score: float          # 0.0 à 1.0
    risk_percent: int          # 0 à 100
    is_anomaly: bool
    severity: str              # LOW / MEDIUM / HIGH / CRITICAL
    shap_explanation: dict     # top features qui ont influencé le score

# ─────────────────────────────────────────
# UTILITAIRES
# ─────────────────────────────────────────
def normalize_score(raw_score: float) -> float:
    """Convertit le score brut Isolation Forest en probabilité 0-1.
    Score bas (très négatif) = anomalie → risk élevé"""
    normalized = (raw_score - SCORE_MAX) / (SCORE_MIN - SCORE_MAX)
    return float(np.clip(normalized, 0.0, 1.0))

def get_severity(risk_score: float) -> str:
    if risk_score >= 0.75:
        return "CRITICAL"
    elif risk_score >= 0.50:
        return "HIGH"
    elif risk_score >= 0.25:
        return "MEDIUM"
    else:
        return "LOW"

def get_shap_explanation(feature_values: list) -> dict:
    """Calcul SHAP simplifié — retourne l'influence de chaque feature"""
    try:
        import shap
        explainer = shap.TreeExplainer(model)
        scaled = scaler.transform([feature_values])
        shap_values = explainer.shap_values(scaled)[0]
        explanation = {}
        for feat, val in zip(FEATURES, shap_values):
            explanation[feat] = round(float(val), 4)
        # Trier par impact absolu décroissant
        explanation = dict(sorted(explanation.items(), key=lambda x: abs(x[1]), reverse=True))
        return explanation
    except Exception:
        # SHAP optionnel — retourne vide si erreur
        return {}

# ─────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": "IsolationForest",
        "auc_roc": metadata["auc_roc"],
        "features": FEATURES
    }

@app.post("/predict", response_model=PredictionOutput)
def predict(tx: TransactionInput):
    try:
        # Construire le vecteur de features dans le même ordre que l'entraînement
        feature_values = [
            tx.amount,
            tx.hour,
            tx.v4, tx.v11, tx.v12, tx.v14, tx.v17,
            tx.v3, tx.v7, tx.v10, tx.v16, tx.v2
        ]

        # Normalisation + prédiction
        scaled = scaler.transform([feature_values])
        raw_score = model.decision_function(scaled)[0]
        prediction = model.predict(scaled)[0]  # -1 = anomalie, 1 = normal

        risk_score = normalize_score(raw_score)
        is_anomaly = prediction == -1
        severity = get_severity(risk_score)
        shap_explanation = get_shap_explanation(feature_values)

        return PredictionOutput(
            txId=tx.txId,
            risk_score=round(risk_score, 4),
            risk_percent=int(risk_score * 100),
            is_anomaly=is_anomaly,
            severity=severity,
            shap_explanation=shap_explanation
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))