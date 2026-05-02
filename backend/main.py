from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from contextlib import asynccontextmanager
from ml_model import load_model, predict

# ── Globals ────────────────────────────────────────────────────────────────
clf = None
scaler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global clf, scaler
    clf, scaler = load_model()
    yield


app = FastAPI(title="CreditIQ API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ─────────────────────────────────────────────────────────────────
class LoanInput(BaseModel):
    income: float
    loan_amount: float
    employment_length: float
    existing_debt: float
    credit_history: str  # excellent | good | fair | poor
    num_existing_loans: int

    @field_validator("credit_history")
    @classmethod
    def validate_credit_history(cls, v: str) -> str:
        allowed = {"excellent", "good", "fair", "poor"}
        if v not in allowed:
            raise ValueError(f"credit_history must be one of {allowed}")
        return v

    @field_validator("income", "loan_amount", "employment_length", "existing_debt")
    @classmethod
    def must_be_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Value must be non-negative")
        return v


class Ratios(BaseModel):
    dti: float
    loan_to_income: float
    credit_utilization: float


class LoanResult(BaseModel):
    credit_score: int
    risk_level: str
    probability: float
    decision: str
    reasons: list[str]
    ratios: Ratios


# ── Core Scoring Logic ───────────────────────────────────────────────────────
def _score(data: LoanInput) -> LoanResult:
    ml = predict(
        clf, scaler,
        income=data.income,
        loan_amount=data.loan_amount,
        employment_length=data.employment_length,
        existing_debt=data.existing_debt,
        credit_history=data.credit_history,
        num_existing_loans=data.num_existing_loans,
    )

    prob = ml["prob_default"]
    dti = ml["dti"]
    lti = ml["lti"]
    credit_util = ml["credit_util"]

    # Credit score: 900 – prob×600 (clamped 300–900)
    credit_score = int(max(300, min(900, round(900 - prob * 600))))

    # Risk classification
    if credit_score > 750:
        risk_level = "Low"
    elif credit_score >= 600:
        risk_level = "Medium"
    else:
        risk_level = "High"

    # ── Hard-reject rule engine ──────────────────────────────────────────
    hard_reject: list[str] = []
    if data.income < 20_000:
        hard_reject.append(
            "Monthly income is below the minimum threshold of ₹20,000"
        )
    if dti > 0.60:
        hard_reject.append(
            f"Debt-to-income ratio ({dti:.1%}) exceeds the maximum of 60% — reduce existing debt first"
        )
    if lti > 5.0:
        hard_reject.append(
            f"Loan amount is {lti:.1f}× your monthly income — maximum allowed is 5×"
        )
    if data.num_existing_loans > 5:
        hard_reject.append(
            f"You have {data.num_existing_loans} active loans — maximum allowed is 5"
        )

    if hard_reject:
        return LoanResult(
            credit_score=credit_score,
            risk_level=risk_level,
            probability=round(prob, 4),
            decision="Rejected",
            reasons=hard_reject,
            ratios=Ratios(
                dti=round(dti, 4),
                loan_to_income=round(lti, 4),
                credit_utilization=round(credit_util, 4),
            ),
        )

    # ── Explainable AI — feature-importance-driven reasons ──────────────
    fi = ml["feature_importances"]
    reasons: list[str] = []

    # DTI
    if dti > 0.45:
        reasons.append(
            f"High debt-to-income ratio ({dti:.1%}) — major driver of elevated risk"
        )
    elif dti > 0.28:
        reasons.append(
            f"Moderate debt-to-income ratio ({dti:.1%}) — within acceptable limits but worth monitoring"
        )
    else:
        reasons.append(
            f"Healthy debt-to-income ratio ({dti:.1%}) — strong indicator of repayment capacity"
        )

    # Credit history (highest importance feature)
    history_labels = {
        "excellent": "Excellent credit history significantly lowers default probability",
        "good": "Good credit history supports a positive lending decision",
        "fair": "Fair credit history raises moderate concerns about repayment reliability",
        "poor": "Poor credit history is the strongest risk signal in your profile",
    }
    reasons.append(history_labels[data.credit_history])

    # Loan-to-income
    if lti > 2.5:
        reasons.append(
            f"Loan amount is {lti:.1f}× your monthly income — high relative exposure increases risk"
        )
    elif lti > 1.0:
        reasons.append(
            f"Loan-to-income ratio of {lti:.1f}× is within a manageable range"
        )
    else:
        reasons.append(
            f"Conservative loan size ({lti:.2f}× income) — low exposure risk"
        )

    # Employment stability
    if data.employment_length >= 5:
        reasons.append(
            f"Stable employment of {data.employment_length:.0f} years boosts creditworthiness"
        )
    elif data.employment_length >= 2:
        reasons.append(
            f"Employment of {data.employment_length:.0f} years is adequate but not strongly positive"
        )
    else:
        reasons.append(
            f"Short employment tenure ({data.employment_length:.0f} years) introduces income uncertainty"
        )

    # Existing loans
    if data.num_existing_loans >= 4:
        reasons.append(
            f"Multiple existing loans ({data.num_existing_loans}) increase overall debt burden"
        )
    elif data.num_existing_loans == 0:
        reasons.append("No existing loan obligations — clean financial slate")

    # Final decision
    if risk_level == "High":
        decision = "Rejected"
    else:
        decision = "Approved"

    return LoanResult(
        credit_score=credit_score,
        risk_level=risk_level,
        probability=round(prob, 4),
        decision=decision,
        reasons=reasons,
        ratios=Ratios(
            dti=round(dti, 4),
            loan_to_income=round(lti, 4),
            credit_utilization=round(credit_util, 4),
        ),
    )


# ── Routes ──────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": clf is not None}


@app.post("/api/apply-loan", response_model=LoanResult)
def apply_loan(data: LoanInput):
    try:
        return _score(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/simulate", response_model=LoanResult)
def simulate(data: LoanInput):
    try:
        return _score(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/admin/stats")
def admin_stats():
    """Placeholder — real stats are read from Firestore on the client."""
    return {"message": "Stats are aggregated client-side from Firestore"}
