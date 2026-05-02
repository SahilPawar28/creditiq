import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { CreditScoreGauge } from "@/components/CreditScoreGauge";
import { CheckCircle2, XCircle, AlertTriangle, RotateCcw, SlidersHorizontal } from "lucide-react";
import { riskFromScore, riskColorClass } from "@/lib/mock-data";
import { getApplicationById, ApplicationDoc, formatINR, tsToDate } from "@/lib/firestore";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_app/result")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: (s.id as string) ?? "",
  }),
  component: ResultPage,
});

function ResultPage() {
  const { id } = Route.useSearch();
  const [app, setApp] = useState<ApplicationDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("No application ID provided.");
      setLoading(false);
      return;
    }
    getApplicationById(id)
      .then(setApp)
      .catch(() => setError("Could not load application. It may have been deleted."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <>
        <PageHeader title="Decision Result" description="Loading your result…" />
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (error || !app) {
    return (
      <>
        <PageHeader title="Result Not Found" description="" />
        <Card className="shadow-card border-border/60 p-8 text-center">
          <p className="text-muted-foreground mb-4">{error ?? "Unknown error."}</p>
          <Button asChild variant="outline">
            <Link to="/apply">
              <RotateCcw className="h-4 w-4 mr-2" />
              New Application
            </Link>
          </Button>
        </Card>
      </>
    );
  }

  const approved = app.decision === "Approved";
  const risk = riskFromScore(app.creditScore);
  const dtiPct = +(app.dti * 100).toFixed(1);
  const utilPct = +(app.creditUtilization * 100).toFixed(1);
  const paymentScore = Math.max(20, Math.min(98, Math.round(100 - app.defaultProbability * 100)));

  return (
    <>
      <PageHeader
        title="Decision Result"
        description={`Application submitted on ${tsToDate(app.createdAt)}`}
      />

      {/* Main decision card */}
      <Card
        className={`shadow-elevated border-2 ${
          approved ? "border-success/40" : "border-destructive/40"
        } overflow-hidden relative`}
      >
        <div
          className={`absolute inset-0 ${
            approved ? "bg-gradient-success" : "bg-gradient-danger"
          } opacity-[0.06] pointer-events-none`}
        />
        <CardContent className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Decision badge */}
          <div className="md:col-span-1 flex flex-col items-center text-center">
            <div
              className={`h-16 w-16 rounded-full flex items-center justify-center shadow-elevated ${
                approved
                  ? "bg-success text-success-foreground"
                  : "bg-destructive text-destructive-foreground"
              }`}
            >
              {approved ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
            </div>
            <h2 className="text-2xl font-bold mt-3">{app.decision}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {approved
                ? `Loan of ${formatINR(app.loanAmount)} pre-approved`
                : "This application could not be approved"}
            </p>
          </div>

          {/* Gauge */}
          <div className="md:col-span-1 flex flex-col items-center">
            <CreditScoreGauge score={app.creditScore} />
            <Badge variant="outline" className={`${riskColorClass(risk)} mt-2`}>
              {risk} Risk
            </Badge>
          </div>

          {/* Stats */}
          <div className="md:col-span-1 space-y-3">
            <Stat label="Default Probability" value={`${(app.defaultProbability * 100).toFixed(1)}%`} />
            <Stat label="Debt-to-Income" value={`${dtiPct}%`} />
            <Stat label="Payment Score" value={`${paymentScore}/100`} />
            <Stat label="Credit Utilization" value={`${utilPct}%`} />
            <Stat label="Loan-to-Income" value={`${(app.loanToIncome).toFixed(2)}×`} />
          </div>
        </CardContent>
      </Card>

      {/* Explainable AI */}
      <Card className="shadow-card border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Explainable AI — Why this decision?</CardTitle>
          <CardDescription>
            Top factors from our Random Forest model, ranked by impact on your score.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {app.reasons.map((reason, i) => {
            const tone = detectTone(reason);
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                <div
                  className={`mt-0.5 h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
                    tone === "good"
                      ? "bg-success/15 text-success"
                      : tone === "warn"
                        ? "bg-warning/20 text-warning-foreground"
                        : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {tone === "good" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : tone === "warn" ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                </div>
                <p className="text-sm">{reason}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Input summary */}
      <Card className="shadow-card border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Application Summary</CardTitle>
          <CardDescription>What you submitted</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <SummaryItem label="Monthly Income" value={formatINR(app.income)} />
          <SummaryItem label="Loan Amount" value={formatINR(app.loanAmount)} />
          <SummaryItem label="Existing Debt" value={formatINR(app.existingDebt)} />
          <SummaryItem label="Employment" value={`${app.employmentLength} yrs`} />
          <SummaryItem label="Credit History" value={capitalize(app.creditHistory)} />
          <SummaryItem label="Existing Loans" value={String(app.numExistingLoans)} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" asChild>
          <Link to="/apply">
            <RotateCcw className="h-4 w-4 mr-2" />
            Re-apply
          </Link>
        </Button>
        <Button asChild className="bg-gradient-primary text-primary-foreground shadow-soft hover:opacity-90">
          <Link to="/simulation">
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Try simulation
          </Link>
        </Button>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/60 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-base font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/40">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function detectTone(reason: string): "good" | "warn" | "bad" {
  const lower = reason.toLowerCase();
  const badWords = ["high", "poor", "short", "too many", "exceeds", "below", "frequent", "major", "risk", "does not"];
  const goodWords = ["healthy", "excellent", "stable", "conservative", "strong", "clean", "no existing", "boosts", "lowers", "good"];
  if (goodWords.some((w) => lower.includes(w))) return "good";
  if (badWords.some((w) => lower.includes(w))) return "bad";
  return "warn";
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
