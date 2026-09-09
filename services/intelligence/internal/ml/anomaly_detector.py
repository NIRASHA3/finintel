"""
Advisory Anomaly Detector Engine.

Multi-feature unsupervised anomaly detection using Isolation Forest (scikit-learn).
Extracts numerical, statistical, timing, and textual signals to flag anomalous
financial transactions. Adheres strictly to advisory boundary guidelines.
"""

import logging
import math
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

MODEL_VERSION = "v1.0.0-isolation-forest"


class AdvisoryAnomalyDetector:
    """
    Unsupervised multi-feature anomaly detector using Isolation Forest.
    """

    def __init__(self, contamination: float = 0.1, random_state: int = 42):
        self.contamination = contamination
        self.random_state = random_state
        self.scaler = StandardScaler()
        self.model = IsolationForest(
            contamination=self.contamination,
            random_state=self.random_state,
            n_estimators=100,
        )
        self.model_version = MODEL_VERSION

    def _extract_features(self, transactions: List[Dict[str, Any]]) -> np.ndarray:
        """
        Extract numerical feature vectors from raw transaction dictionaries.
        Features:
        0: log1p(abs(amount))
        1: amount z-score (deviation from batch mean)
        2: is_round_amount (1.0 if amount % 100 == 0 or % 1000 == 0, else 0.0)
        3: description length
        4: payee frequency count in batch
        """
        if not transactions:
            return np.empty((0, 5))

        amounts = [float(tx.get("amount", 0.0)) for tx in transactions]
        abs_amounts = [abs(a) for a in amounts]

        mean_amt = np.mean(abs_amounts) if abs_amounts else 1.0
        std_amt = np.std(abs_amounts) if abs_amounts and np.std(abs_amounts) > 1e-6 else 1.0

        # Payee frequency counting
        payee_counts: Dict[str, int] = {}
        for tx in transactions:
            p = (tx.get("payee") or tx.get("description") or "").strip().lower()
            payee_counts[p] = payee_counts.get(p, 0) + 1

        feature_matrix = []
        for tx in transactions:
            amt = float(tx.get("amount", 0.0))
            abs_amt = abs(amt)

            log_amt = math.log1p(abs_amt)
            z_score = (abs_amt - mean_amt) / std_amt

            # Round amount flag (e.g. $10,000, $50,000, $100,000)
            is_round = 1.0 if (abs_amt >= 100.0 and abs_amt % 100 == 0) else 0.0

            desc = tx.get("description", "")
            desc_len = float(len(desc))

            payee = (tx.get("payee") or desc).strip().lower()
            p_freq = float(payee_counts.get(payee, 1))

            feature_matrix.append([log_amt, z_score, is_round, desc_len, p_freq])

        return np.array(feature_matrix)

    def detect(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Detect anomalies across a batch of financial transactions.
        """
        if not transactions:
            return []

        # If batch size is small (e.g., < 4 items), fallback to heuristic scoring
        n_samples = len(transactions)
        X = self._extract_features(transactions)

        if n_samples >= 4:
            X_scaled = self.scaler.fit_transform(X)
            self.model.fit(X_scaled)
            scores = self.model.decision_function(X_scaled)  # Lower score = more anomalous
            preds = self.model.predict(X_scaled)  # -1 for anomaly, 1 for normal
        else:
            # Fallback heuristic scores for small batches
            scores = []
            preds = []
            amounts = [abs(float(tx.get("amount", 0.0))) for tx in transactions]
            mean_a = np.mean(amounts) if amounts else 0.0
            for a in amounts:
                if mean_a > 0 and a > 3.0 * mean_a and a >= 10000.0:
                    scores.append(-0.3)
                    preds.append(-1)
                else:
                    scores.append(0.2)
                    preds.append(1)
            scores = np.array(scores)
            preds = np.array(preds)

        results = []
        amounts = [abs(float(tx.get("amount", 0.0))) for tx in transactions]
        mean_amt = float(np.mean(amounts)) if amounts else 0.0

        for i, tx in enumerate(transactions):
            raw_score = float(scores[i])
            is_anomaly = bool(preds[i] == -1)
            amt = float(tx.get("amount", 0.0))
            abs_amt = abs(amt)
            tx_id = tx.get("id") or tx.get("transaction_id") or f"tx-{i}"
            desc = tx.get("description", "Unspecified transaction")

            # Determine severity & confidence
            reasons = []
            if abs_amt > 50000.0:
                reasons.append(f"High-value entry of ${abs_amt:,.2f}")
            if mean_amt > 0 and abs_amt > 3.0 * mean_amt:
                reasons.append(f"Amount is {abs_amt/mean_amt:.1f}x batch average (${mean_amt:,.2f})")
            if abs_amt >= 1000.0 and abs_amt % 1000 == 0:
                reasons.append("Large round-dollar figure")

            # Compute severity rating
            if raw_score < -0.15 or abs_amt >= 50000.0 or (mean_amt > 0 and abs_amt > 4.0 * mean_amt):
                severity = "HIGH"
                is_anomaly = True
                confidence = min(0.99, max(0.75, round(0.80 + abs(raw_score) * 0.4, 2)))
            elif raw_score < 0.0 or is_anomaly:
                severity = "MEDIUM"
                confidence = min(0.88, max(0.65, round(0.70 + abs(raw_score) * 0.3, 2)))
            else:
                severity = "LOW"
                confidence = min(0.95, max(0.80, round(0.85 + raw_score * 0.2, 2)))

            if not reasons:
                if is_anomaly:
                    reasons.append(f"Multi-feature Isolation Forest isolation score ({raw_score:.3f})")
                else:
                    reasons.append("Transaction conforms to expected historical statistical patterns.")

            explanation = f"Anomaly Assessment: {'; '.join(reasons)}."

            results.append({
                "transaction_id": tx_id,
                "description": desc,
                "amount": amt,
                "is_anomaly": is_anomaly,
                "anomaly_score": round(raw_score, 4),
                "severity": severity,
                "confidence_score": confidence,
                "explanation": explanation,
                "model_version": self.model_version,
            })

        return results
