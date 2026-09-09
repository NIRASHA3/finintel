"""
Category Recommender Engine.

Suggests Chart-of-Accounts categories based on transaction descriptions using
TF-IDF feature extraction combined with an ensemble classifier (XGBoost / RandomForest).
Adheres strictly to advisory boundary guidelines.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier

logger = logging.getLogger(__name__)

# Try importing XGBoost; fallback to RandomForest if unavailable
try:
    import xgboost as xgb
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

MODEL_VERSION = "v1.0.0-tfidf-ensemble"

DEFAULT_TRAINING_CORPUS: List[Tuple[str, str]] = [
    # Software & Subscriptions
    ("AWS Cloud Infrastructure Web Hosting", "Software & Subscriptions"),
    ("Google Cloud Hosting Platform Compute", "Software & Subscriptions"),
    ("Google Cloud Platform Server Compute", "Software & Subscriptions"),
    ("Cloud Server Compute Hosting", "Software & Subscriptions"),
    ("GitHub Enterprise Organization Seat License", "Software & Subscriptions"),
    ("Slack Monthly Workspace Pro Subscription", "Software & Subscriptions"),
    ("Zoom Video Conferencing Enterprise", "Software & Subscriptions"),
    ("Figma Team Subscription Design", "Software & Subscriptions"),
    ("Microsoft 365 Business Premium License", "Software & Subscriptions"),
    ("Datadog Monitoring & APM Subscription", "Software & Subscriptions"),
    ("JetBrains All Products Pack License", "Software & Subscriptions"),
    ("OpenAI API Platform Billing", "Software & Subscriptions"),

    # Utilities & Rent
    ("ConEd Electric Utilities Power Bill Rent", "Utilities & Rent"),
    ("Commercial Real Estate Office Rent Payment", "Utilities & Rent"),
    ("Spectrum Fiber Internet Service Utility", "Utilities & Rent"),
    ("City Water and Sewer Utility Bill", "Utilities & Rent"),
    ("National Grid Natural Gas Heating Utility", "Utilities & Rent"),
    ("WeWork Workspace Desk Desk Rent", "Utilities & Rent"),

    # Travel & Entertainment
    ("Delta Air Lines Flight Ticket NYC to SFO", "Travel & Entertainment"),
    ("United Airlines Flight Ticket Passenger", "Travel & Entertainment"),
    ("Marriott Hotel Room Night Lodging", "Travel & Entertainment"),
    ("Uber Transport Airport Taxi Ride", "Travel & Entertainment"),
    ("Uber Business Travel Airport Taxi", "Travel & Entertainment"),
    ("Lyft Transport Airport Taxi Ride", "Travel & Entertainment"),
    ("Team Dinner Client Catering Restaurant", "Travel & Entertainment"),
    ("Airbnb Corporate Lodging Accommodations", "Travel & Entertainment"),

    # Professional Services
    ("Legal Counsel Retainer Legal Fees", "Professional Services"),
    ("Deloitte Accounting Advisory Services", "Professional Services"),
    ("McKinsey Management Consulting", "Professional Services"),
    ("Cooley LLP Legal Retainer Contract", "Professional Services"),
    ("CPA Tax Preparation & Compliance Fee", "Professional Services"),

    # Payroll & Wages
    ("Gusto Payroll Direct Deposit Wages", "Payroll & Wages"),
    ("Rippling Employee Salary Disbursement", "Payroll & Wages"),
    ("ADP Monthly Staff Salary Disbursement", "Payroll & Wages"),
    ("Deel Contractor Salary International Payroll", "Payroll & Wages"),
    ("Justworks Employee Health Benefits Insurance", "Payroll & Wages"),

    # Marketing & Advertising
    ("Google Ads Campaign Pay Per Click", "Marketing & Advertising"),
    ("Facebook Meta Ads Sponsor Post", "Marketing & Advertising"),
    ("LinkedIn Talent & Sponsored Content", "Marketing & Advertising"),
    ("HubSpot Marketing Automation Platform", "Marketing & Advertising"),
    ("SEO Agency Monthly Content Retainer", "Marketing & Advertising"),
    ("Billboard Media Outdoor Advertising", "Marketing & Advertising"),

    # Hardware & Equipment
    ("Apple Store MacBook Pro M3 Laptop", "Hardware & Equipment"),
    ("Dell Enterprise Rack Server Storage", "Hardware & Equipment"),
    ("B&H Photo Video Studio Camera Equipment", "Hardware & Equipment"),
    ("CDW Corporate Networking Router Switch", "Hardware & Equipment"),
    ("Logitech Wireless Mouse Keyboard Bundle", "Hardware & Equipment"),

    # Office Supplies
    ("Staples Paper Pens Stationery Supplies", "Office Supplies"),
    ("Amazon Office Chair Ergonomic Desk", "Office Supplies"),
    ("Uline Packaging Boxes Supplies", "Office Supplies"),
    ("Coffee Breakroom Snacks Drinks Supply", "Office Supplies"),

    # Revenue & Sales
    ("Stripe Payout Client Subscription Payment", "Revenue & Sales"),
    ("Wire Transfer Customer Invoice Payment", "Revenue & Sales"),
    ("Shopify Merchant Store Direct Deposit", "Revenue & Sales"),
    ("Client Retainer Income Wire Transfer", "Revenue & Sales"),

    # Bank & Merchant Fees
    ("Bank Wire Processing Service Charge Fee", "Bank & Merchant Fees"),
    ("Stripe Merchant Account Processing Fee", "Bank & Merchant Fees"),
    ("Chase Overdraft Monthly Maintenance Fee", "Bank & Merchant Fees"),
    ("International Currency Exchange FX Fee", "Bank & Merchant Fees"),
]


class CategoryRecommender:
    """
    ML model suggesting Chart-of-Accounts categories based on transaction descriptions.
    """

    def __init__(self, use_xgboost: bool = True):
        self.use_xgboost = use_xgboost and HAS_XGBOOST
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1, lowercase=True, sublinear_tf=True)
        self.classifier = None
        self.categories: List[str] = []
        self.category_to_id: Dict[str, int] = {}
        self.id_to_category: Dict[int, str] = {}
        self.model_version = MODEL_VERSION
        self._is_trained = False

        # Train on baseline default corpus immediately
        self.train(DEFAULT_TRAINING_CORPUS)

    def train(self, corpus: List[Tuple[str, str]]) -> None:
        """
        Train the TF-IDF vectorizer and classifier on text descriptions & category labels.
        """
        descriptions = [item[0] for item in corpus]
        labels = [item[1] for item in corpus]

        # Fit vectorizer
        X_vec = self.vectorizer.fit_transform(descriptions)

        # Categorical encoding
        unique_labels = sorted(list(set(labels)))
        self.categories = unique_labels
        self.category_to_id = {cat: idx for idx, cat in enumerate(unique_labels)}
        self.id_to_category = {idx: cat for idx, cat in enumerate(unique_labels)}

        y = np.array([self.category_to_id[label] for label in labels])

        # Train model
        if self.use_xgboost and HAS_XGBOOST:
            try:
                self.classifier = xgb.XGBClassifier(
                    n_estimators=100,
                    max_depth=6,
                    learning_rate=0.1,
                    eval_metric="mlogloss",
                    random_state=42,
                )
                self.classifier.fit(X_vec, y)
            except Exception as e:
                logger.warning(f"XGBoost training failed, falling back to RandomForest: {e}")
                self.classifier = RandomForestClassifier(n_estimators=100, max_depth=None, random_state=42)
                self.classifier.fit(X_vec, y)
        else:
            self.classifier = RandomForestClassifier(n_estimators=100, max_depth=None, random_state=42)
            self.classifier.fit(X_vec, y)

        self._is_trained = True

    def predict(self, description: str, amount: float = 0.0) -> Dict[str, Any]:
        """
        Predict category for a single transaction description.
        Returns advisory response dictionary.
        """
        if not self._is_trained or self.classifier is None:
            raise RuntimeError("CategoryRecommender model is not trained.")

        cleaned_desc = description.strip()
        if not cleaned_desc:
            return {
                "predicted_category": "Uncategorized",
                "confidence_score": 0.0,
                "explanation": "Empty transaction description provided.",
                "model_version": self.model_version,
                "top_features": [],
            }

        X_val = self.vectorizer.transform([cleaned_desc])
        probs = self.classifier.predict_proba(X_val)[0]
        best_idx = int(np.argmax(probs))
        confidence = float(probs[best_idx])
        predicted_category = self.id_to_category[best_idx]

        # Extract active matching TF-IDF tokens for explanation
        feature_names = self.vectorizer.get_feature_names_out()
        nonzero_indices = X_val.nonzero()[1]
        matching_tokens = [feature_names[i] for i in nonzero_indices]

        explanation = (
            f"Suggested '{predicted_category}' based on matched keywords: {', '.join(matching_tokens[:5])}"
            if matching_tokens
            else f"Suggested '{predicted_category}' based on general text similarity."
        )

        # Scale confidence slightly if low matches
        if confidence < 0.15:
            predicted_category = "Uncategorized"
            explanation = "Low model confidence score (< 15%); flagged as Uncategorized for manual review."

        return {
            "predicted_category": predicted_category,
            "confidence_score": round(confidence, 4),
            "explanation": explanation,
            "model_version": self.model_version,
            "top_features": matching_tokens[:5],
        }

    def predict_batch(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Predict categories for a batch of transaction dictionaries.
        """
        results = []
        for item in items:
            desc = item.get("description", "")
            amt = float(item.get("amount", 0.0))
            pred = self.predict(desc, amt)
            pred["transaction_id"] = item.get("transaction_id") or item.get("id")
            results.append(pred)
        return results
