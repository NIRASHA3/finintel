"""
Unit tests for CategoryRecommender model.
"""

import pytest
from internal.ml.category_recommender import CategoryRecommender, MODEL_VERSION


def test_category_recommender_initialization():
    recommender = CategoryRecommender(use_xgboost=False)
    assert recommender._is_trained is True
    assert recommender.model_version == MODEL_VERSION
    assert len(recommender.categories) > 0


def test_category_recommender_prediction_software():
    recommender = CategoryRecommender(use_xgboost=False)
    result = recommender.predict("AWS Cloud Server Compute Hosting")

    assert result["predicted_category"] == "Software & Subscriptions"
    assert result["confidence_score"] > 0.0
    assert "explanation" in result
    assert result["model_version"] == MODEL_VERSION
    assert isinstance(result["top_features"], list)


def test_category_recommender_prediction_travel():
    recommender = CategoryRecommender(use_xgboost=False)
    result = recommender.predict("Delta Air Lines Passenger Flight Ticket")

    assert result["predicted_category"] == "Travel & Entertainment"
    assert result["confidence_score"] > 0.0


def test_category_recommender_empty_description():
    recommender = CategoryRecommender(use_xgboost=False)
    result = recommender.predict("")

    assert result["predicted_category"] == "Uncategorized"
    assert result["confidence_score"] == 0.0


def test_category_recommender_batch_predict():
    recommender = CategoryRecommender(use_xgboost=False)
    items = [
        {"id": "t1", "description": "Google Cloud Storage"},
        {"id": "t2", "description": "ConEd Electric Bill Rent"},
    ]
    results = recommender.predict_batch(items)

    assert len(results) == 2
    assert results[0]["transaction_id"] == "t1"
    assert results[0]["predicted_category"] == "Software & Subscriptions"
    assert results[1]["transaction_id"] == "t2"
    assert results[1]["predicted_category"] == "Utilities & Rent"
