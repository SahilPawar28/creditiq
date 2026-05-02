import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { CreditScoreGauge } from "@/components/CreditScoreGauge";
import { useMemo, useState, useEffect, useRef } from "react";
import { riskFromScore, riskColorClass } from "@/lib/mock-data";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";
import { simulateLoan, LoanResult } from "@/lib/api";
import { formatINR } from "@/lib/firestore";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/simulation")({
  component: Simulation,
});

const HISTORY_RISK: Record<string, number> = {
  excellent: 0.05,
  good: 0.15,
  fair: 0.35,
  poor: 0.60,
};

// Local scoring mirrors backend logic for instant slider feedback
function localScore(income: number, loan: number, debt: number, history: string, emp: number) {
  const dti = debt / Math.max(income, 1);
  const lti = loan / Math.max(income, 1);
  const histRisk = HISTORY_RISK[history] ?? 0.15;
  const empNorm = Math.min(emp / 35, 1);
  const prob = Math.min(
    Math.max(dti * 0.30 + lti * 0.25 + histRisk * 0.25 + (1 - empNorm) * 0.10, 0.02),
    0.95,
  );
  return Math.max(300, Math.min(900, Math.round(900 - prob * 600)));
}

function Simulation() {
  const [income, setIncome] = useState(50_000);
  const [loan, setLoan] = useState(2_00_000);
  const [debt, setDebt] = useState(10_000);
  const [history, setHistory] = useState("good");
  const [emp, setEmp] = useState(3);
  const [numLoans, setNumLoans] = useState(1);

  const [aiResult, setAiResult] = useState<LoanResult | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Instant local score for smooth UX
  const score = useMemo(
    () => localScore(income, loan, debt, history, emp),
    [income, loan, debt, history, emp],
  );
  const risk = riskFromScore(score);
  const approved = score >= 600;

  // Auto-fetch AI result after 800ms of no changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchAiResult();
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [income, loan, debt, history, emp, numLoans]);

  const fetchAiResult = async () => {
    setLoadingAi(true);
    try {
      const result = await simulateLoan({
        income,
        loan_amount: loan,
        employment_length: emp,
        existing_debt: debt,
        credit_history: history,
        num_existing_loans: numLoans,
      });
      setAiResult(result);
    } catch {
      // Silently fail — local score still shows
      toast.error("Could not reach AI server — showing estimated score");
    } finally {
      setLoadingAi(false);
    }
  };

  const displayScore = aiResult ? aiResult.credit_score : score;
  const displayRisk = aiResult ? (aiResult.risk_level as "Low" | "Medium" | "High") : risk;
  const displayApproved = aiResult ? aiResult.decision === "Approved" : approved;

  const projection = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const factor = 1 + i * 0.015;
      const s = localScore(income * factor, loan, debt * (1 - i * 0.02), history, emp);
      return { month: `M${i + 1}`, score: s };
    });
  }, [income, loan, debt, history, emp]);

  return (
    <>
      <PageHeader
        title="Loan Simulation"
        description="Adjust inputs to see AI risk assessment update in real time."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-card border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Simulation Inputs</CardTitle>
            <CardDescription>Tune your financial scenario</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <SliderField
              label="Monthly Income"
              value={income}
              min={15_000}
              max={5_00_000}
              step={1_000}
              onChange={setIncome}
              format={formatINR}
            />
            <SliderField
              label="Loan Amount"
              value={loan}
              min={10_000}
              max={50_00_000}
              step={10_000}
              onChange={setLoan}
              format={formatINR}
            />
            <SliderField
              label="Existing Monthly Debt"
              value={debt}
              min={0}
              max={2_00_000}
              step={1_000}
              onChange={setDebt}
              format={formatINR}
            />
            <SliderField
              label="Employment (years)"
              value={emp}
              min={0}
              max={35}
              step={1}
              onChange={setEmp}
              format={(v) => `${v} yrs`}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Credit History</Label>
                <Select value={history} onValueChange={setHistory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Existing Loans</Label>
                <Select value={String(numLoans)} onValueChange={(v) => setNumLoans(+v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/60 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-primary opacity-[0.04] pointer-events-none" />
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Live Result</CardTitle>
              <CardDescription>
                {loadingAi ? "Fetching AI score…" : aiResult ? "AI model result" : "Estimated"}
              </CardDescription>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={fetchAiResult}
              disabled={loadingAi}
              title="Refresh AI score"
            >
              {loadingAi ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <CreditScoreGauge score={displayScore} size={200} />
            <Badge variant="outline" className={riskColorClass(displayRisk)}>
              {displayRisk} Risk
            </Badge>
            <div
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold ${
                displayApproved
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {displayApproved ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              {displayApproved ? "Likely Approved" : "Likely Rejected"}
            </div>

            {aiResult && (
              <div className="w-full text-xs space-y-1.5 pt-2 border-t border-border/60">
                <p className="font-medium text-foreground mb-1">AI Insights</p>
                {aiResult.reasons.slice(0, 3).map((r, i) => (
                  <p key={i} className="text-muted-foreground">• {r}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card border-border/60">
        <CardHeader>
          <CardTitle className="text-base">12-Month Score Projection</CardTitle>
          <CardDescription>Assuming gradual income growth (+1.5%/mo) and debt paydown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projection}>
                <defs>
                  <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis domain={[300, 900]} stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="var(--color-primary)"
                  strokeWidth={3}
                  fill="url(#scoreFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function SliderField({
  label, value, min, max, step, onChange, format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-lg font-bold tabular-nums">{format(value)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
      <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
