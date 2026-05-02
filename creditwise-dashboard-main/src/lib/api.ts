const API_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

export interface LoanInput {
  income: number;
  loan_amount: number;
  employment_length: number;
  existing_debt: number;
  credit_history: string;
  num_existing_loans: number;
}

export interface LoanResult {
  credit_score: number;
  risk_level: string;
  probability: number;
  decision: string;
  reasons: string[];
  ratios: {
    dti: number;
    loan_to_income: number;
    credit_utilization: number;
  };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "Unknown error");
    throw new Error(`API error ${res.status}: ${msg}`);
  }
  return res.json() as Promise<T>;
}

export const applyLoan = (input: LoanInput) =>
  post<LoanResult>("/api/apply-loan", input);

export const simulateLoan = (input: LoanInput) =>
  post<LoanResult>("/api/simulate", input);
