import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { CreditScoreGauge } from "@/components/CreditScoreGauge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { DollarSign, CreditCard, Wallet, Percent, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getRecentApplications, ApplicationDoc, formatINR, tsToDate } from "@/lib/firestore";
import { riskFromScore, riskColorClass, statusColorClass } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Dashboard() {
  const { user, profile } = useAuth();
  const [apps, setApps] = useState<ApplicationDoc[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);

  useEffect(() => {
    if (!user) return;
    getRecentApplications(user.uid, 5)
      .then(setApps)
      .catch(() => setApps([]))
      .finally(() => setLoadingApps(false));
  }, [user]);

  // Derive stats from real applications
  const latestScore = apps[0]?.creditScore ?? null;
  const latestIncome = apps[0]?.income ?? null;
  const latestDebt = apps[0]?.existingDebt ?? null;
  const dti = latestIncome && latestDebt ? +((latestDebt / latestIncome) * 100).toFixed(1) : null;
  const creditUtil = latestIncome && latestDebt
    ? +((latestDebt / (latestDebt + latestIncome)) * 100).toFixed(1)
    : null;
  const risk = latestScore ? riskFromScore(latestScore) : null;

  // Build trend from apps (oldest first)
  const riskTrend = [...apps].reverse().map((a, i) => ({
    month: `App ${i + 1}`,
    score: a.creditScore,
  }));

  const incomeVsDebt = [...apps].reverse().map((a, i) => ({
    month: `App ${i + 1}`,
    income: Math.round(a.income / 1000),
    debt: Math.round(a.existingDebt / 1000),
  }));

  const displayName = profile?.name?.split(" ")[0] ?? user?.displayName?.split(" ")[0] ?? "there";

  return (
    <>
      <PageHeader
        title={`Welcome back, ${displayName}`}
        description="Here's an overview of your financial profile and recent activity."
        actions={
          <Button asChild className="bg-gradient-primary text-primary-foreground shadow-soft hover:opacity-90">
            <Link to="/apply">
              New Application <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {latestScore ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 shadow-card border-border/60 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-primary opacity-[0.04] pointer-events-none" />
            <CardHeader>
              <CardTitle className="text-base">Latest Credit Score</CardTitle>
              <CardDescription>From your most recent application</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center pb-6">
              <CreditScoreGauge score={latestScore} />
              {risk && (
                <Badge variant="outline" className={`mt-2 ${riskColorClass(risk)}`}>
                  {risk} Risk
                </Badge>
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            <StatCard
              label="Last Monthly Income"
              value={latestIncome ? formatINR(latestIncome) : "—"}
              icon={DollarSign}
              accent="success"
            />
            <StatCard
              label="Last Existing Debt"
              value={latestDebt ? formatINR(latestDebt) : "—"}
              icon={Wallet}
              accent="warning"
            />
            <StatCard
              label="Debt-to-Income"
              value={dti !== null ? `${dti}%` : "—"}
              icon={Percent}
              accent="info"
              hint="Healthy is < 36%"
            />
            <StatCard
              label="Credit Utilization"
              value={creditUtil !== null ? `${creditUtil}%` : "—"}
              icon={CreditCard}
              accent="primary"
              hint="Optimal is < 30%"
            />
          </div>
        </div>
      ) : (
        <Card className="shadow-card border-border/60 p-8 text-center">
          <p className="text-muted-foreground mb-4">No applications yet. Apply for a loan to see your credit score.</p>
          <Button asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            <Link to="/apply">Apply Now <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </Card>
      )}

      {riskTrend.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Income vs Debt (₹K)</CardTitle>
              <CardDescription>Across your applications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incomeVsDebt}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="income" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="debt" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Credit Score Trend</CardTitle>
              <CardDescription>Across your applications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={riskTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis domain={[300, 900]} stroke="var(--color-muted-foreground)" fontSize={12} />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4, fill: "var(--color-primary)" }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="shadow-card border-border/60">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Recent Applications</CardTitle>
            <CardDescription>Your latest loan requests</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/applications">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loadingApps ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : apps.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">No applications yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-semibold tabular-nums">{formatINR(a.loanAmount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={riskColorClass(a.riskLevel as "Low" | "Medium" | "High")}>
                        {a.riskLevel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColorClass(a.decision as "Approved" | "Rejected" | "Pending")}>
                        {a.decision}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{a.creditScore}</TableCell>
                    <TableCell className="text-muted-foreground">{tsToDate(a.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
