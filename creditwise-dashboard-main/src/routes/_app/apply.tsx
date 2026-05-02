import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { applyLoan } from "@/lib/api";
import { saveApplication } from "@/lib/firestore";

export const Route = createFileRoute("/_app/apply")({
  component: ApplyPage,
});

const INITIAL_FORM = {
  income: "",
  employmentLength: "",
  loanAmount: "",
  existingDebt: "",
  creditHistory: "good",
  existingLoans: "0",
};

function ApplyPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const income = parseFloat(form.income);
    const loanAmount = parseFloat(form.loanAmount);
    const employmentLength = parseFloat(form.employmentLength);
    const existingDebt = parseFloat(form.existingDebt);
    const numExistingLoans = parseInt(form.existingLoans, 10);

    if ([income, loanAmount, employmentLength, existingDebt].some(isNaN)) {
      toast.error("Please fill all numeric fields correctly");
      return;
    }

    setLoading(true);
    try {
      // 1. Call ML backend
      const result = await applyLoan({
        income,
        loan_amount: loanAmount,
        employment_length: employmentLength,
        existing_debt: existingDebt,
        credit_history: form.creditHistory,
        num_existing_loans: numExistingLoans,
      });

      // 2. Save to Firestore
      const appId = await saveApplication({
        userId: user!.uid,
        userEmail: user!.email ?? "",
        fullName: profile?.name ?? user!.displayName ?? "Unknown",
        income,
        loanAmount,
        employmentLength,
        existingDebt,
        creditHistory: form.creditHistory,
        numExistingLoans,
        creditScore: result.credit_score,
        riskLevel: result.risk_level,
        defaultProbability: result.probability,
        decision: result.decision,
        reasons: result.reasons,
        dti: result.ratios.dti,
        loanToIncome: result.ratios.loan_to_income,
        creditUtilization: result.ratios.credit_utilization,
      });

      toast.success("Application submitted — see your result below.");
      navigate({ to: "/result", search: { id: appId } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      if (msg.includes("fetch") || msg.includes("Failed")) {
        toast.error("Could not reach the scoring server. Please try again.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Apply for a Loan"
        description="Our AI will evaluate your application using a Random Forest model trained on real financial data."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-card border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Application Details</CardTitle>
            <CardDescription>All amounts in INR (₹). All fields are required.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field
                label="Monthly Income (₹)"
                placeholder="e.g. 50000"
                type="number"
                value={form.income}
                onChange={(v) => update("income", v)}
                min="0"
              />
              <Field
                label="Employment Length (years)"
                placeholder="e.g. 4"
                type="number"
                value={form.employmentLength}
                onChange={(v) => update("employmentLength", v)}
                min="0"
                step="0.5"
              />
              <Field
                label="Loan Amount (₹)"
                placeholder="e.g. 500000"
                type="number"
                value={form.loanAmount}
                onChange={(v) => update("loanAmount", v)}
                min="0"
              />
              <Field
                label="Existing Monthly Debt (₹)"
                placeholder="e.g. 10000"
                type="number"
                value={form.existingDebt}
                onChange={(v) => update("existingDebt", v)}
                min="0"
              />

              <div className="space-y-2">
                <Label>Credit History</Label>
                <Select value={form.creditHistory} onValueChange={(v) => update("creditHistory", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent — no missed payments</SelectItem>
                    <SelectItem value="good">Good — occasional delays</SelectItem>
                    <SelectItem value="fair">Fair — some defaults</SelectItem>
                    <SelectItem value="poor">Poor — frequent defaults</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Field
                label="Number of Existing Loans"
                placeholder="e.g. 1"
                type="number"
                value={form.existingLoans}
                onChange={(v) => update("existingLoans", v)}
                min="0"
                max="20"
              />

              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForm(INITIAL_FORM)}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-primary text-primary-foreground shadow-soft hover:opacity-90 min-w-[180px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Evaluating with AI…
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/60 h-fit">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">How it works</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Your data is sent to our <strong className="text-foreground">Random Forest ML model</strong>.</p>
            <p>2. The model predicts your <strong className="text-foreground">probability of default</strong>.</p>
            <p>3. A <strong className="text-foreground">rule engine</strong> applies hard financial constraints.</p>
            <p>4. An <strong className="text-foreground">explainable AI</strong> report tells you exactly why.</p>
            <p>5. The decision is <strong className="text-foreground">saved to your profile</strong> securely.</p>
            <p className="pt-2 text-xs">Soft check only — does not affect your bureau score.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Field({
  label, placeholder, value, onChange, type = "text", min, max, step,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        required
      />
    </div>
  );
}
