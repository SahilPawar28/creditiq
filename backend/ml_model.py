import os
import pickle
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

HISTORY_MAP = {"excellent": 0, "good": 1, "fair": 2, "poor": 3}
HISTORY_RISK = [0.05, 0.15, 0.35, 0.60]
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")


def _generate_training_data(n: int = 8000):
    """Generate synthetic Indian financial data for model training."""
    rng = np.random.default_rng(42)

    # Monthly income in INR (₹15k – ₹5L)
    income = rng.lognormal(mean=11.2, sigma=0.65, size=n).clip(15_000, 500_000)
    # Loan amount (₹50k – ₹50L)
    loan_amount = rng.lognormal(mean=12.5, sigma=0.70, size=n).clip(50_000, 5_000_000)
    # Employment in years
    employment = rng.exponential(scale=6, size=n).clip(0, 35)
    # Existing monthly debt obligation
    existing_debt = (rng.lognormal(mean=10.0, sigma=0.80, size=n)).clip(0, income * 0.8)
    # Credit history: 0=excellent, 1=good, 2=fair, 3=poor
    credit_history = rng.choice([0, 1, 2, 3], size=n, p=[0.20, 0.42, 0.25, 0.13])
    # Number of existing loans
    num_loans = rng.integers(0, 9, size=n)

    # Engineered features
    dti = existing_debt / income
    lti = loan_amount / income
    credit_util = existing_debt / (existing_debt + income)
    emp_norm = employment / 35.0
    history_risk = np.array(HISTORY_RISK)[credit_history]

    # Ground-truth default probability (mirrors scoring logic)
    default_prob = (
        dti * 0.30
        + lti * 0.25
        + history_risk * 0.25
        + (1 - emp_norm) * 0.10
        + (num_loans / 10.0) * 0.10
    )
    default_prob = np.clip(default_prob, 0.0, 1.0)
    labels = rng.binomial(1, default_prob)

    features = np.column_stack([
        income, loan_amount, employment, existing_debt,
        credit_history, num_loans, dti, lti, credit_util, emp_norm,
    ])
    return features, labels


def _train_and_save() -> tuple:
    print("Training ML model on synthetic data…")
    X, y = _generate_training_data()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    clf = RandomForestClassifier(
        n_estimators=150,
        max_depth=12,
        min_samples_split=10,
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X_train_s, y_train)
    acc = clf.score(X_test_s, y_test)
    print(f"Model accuracy: {acc:.3f}")

    with open(MODEL_PATH, "wb") as f:
        pickle.dump({"clf": clf, "scaler": scaler}, f)

    return clf, scaler


def load_model() -> tuple:
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            data = pickle.load(f)
        return data["clf"], data["scaler"]
    return _train_and_save()


FEATURE_NAMES = [
    "income", "loan_amount", "employment_length", "existing_debt",
    "credit_history_encoded", "num_existing_loans",
    "dti", "loan_to_income", "credit_utilization", "employment_normalized",
]


def predict(
    clf: RandomForestClassifier,
    scaler: StandardScaler,
    income: float,
    loan_amount: float,
    employment_length: float,
    existing_debt: float,
    credit_history: str,
    num_existing_loans: int,
) -> dict:
    history_enc = HISTORY_MAP.get(credit_history, 1)
    dti = existing_debt / max(income, 1)
    lti = loan_amount / max(income, 1)
    credit_util = existing_debt / max(existing_debt + income, 1)
    emp_norm = min(employment_length / 35.0, 1.0)

    features = np.array([[
        income, loan_amount, employment_length, existing_debt,
        history_enc, num_existing_loans, dti, lti, credit_util, emp_norm,
    ]])
    features_scaled = scaler.transform(features)
    prob_default = float(clf.predict_proba(features_scaled)[0][1])

    # Feature importances for explainability
    importances = clf.feature_importances_

    return {
        "prob_default": prob_default,
        "feature_importances": dict(zip(FEATURE_NAMES, importances.tolist())),
        "dti": dti,
        "lti": lti,
        "credit_util": credit_util,
        "history_enc": history_enc,
    }
