import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { FileText, CheckCircle2, Gauge, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserApplications, ApplicationDoc, tsToDate } from "@/lib/firestore";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_app/analytics")({
  component: Analytics,
});

const RISK_COLORS: Record<string, string> = {
  Low: "var(--color-success)",
  Medium: "var(--color-warning)",
  High: "var(--color-destructive)",
};

function Analytics() {
  const { user } = useAuth();
  const [apps, setApps] = useState<ApplicationDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserApplications(user.uid)
      .then(setApps)
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <>
        <PageHeader title="Analytics" description="Loading your analytics…" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </>
    );
  }

  // Derived stats
  const total = apps.length;
  const approved = apps.filter((a) => a.decision === "Approved").length;
  const approvalRate = total > 0 ? ((approved / total) * 100).toFixed(1) : "—";
  const avgScore =
    total > 0
      ? Math.round(apps.reduce((s, a) => s + a.creditScore, 0) / total)
      : null;

  // Score trend (chronological, max 12)
  const scoreTrend = [...apps]
    .reverse()
    .slice(0, 12)
    .map((a, i) => ({
      label: `#${i + 1}`,
      score: a.creditScore,
      date: tsToDate(a.createdAt),
    }));

  // Risk distribution
  const riskCounts: Record<string, number> = { Low: 0, Medium: 0, High: 0 };
  apps.forEach((a) => {
    riskCounts[a.riskLevel] = (riskCounts[a.riskLevel] ?? 0) + 1;
  });
  const riskDistribution = Object.entries(riskCounts).map(([name, value]) => ({
    name,
    value,
  }));

  // Monthly approvals (last 6 months)
  const monthlyMap: Record<string, { approved: number; rejected: number }> = {};
  apps.forEach((a) => {
    const month = a.createdAt.toDate().toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
    });
    if (!monthlyMap[month]) monthlyMap[month] = { approved: 0, rejected: 0 };
    if (a.decision === "Approved") monthlyMap[month].approved++;
    else monthlyMap[month].rejected++;
  });
  const monthlyApprovals = Object.entries(monthlyMap)
    .slice(-6)
    .map(([month, vals]) => ({ month, ...vals }));

  // DTI buckets
  const dtiBuckets = [
    { label: "< 20%", count: apps.filter((a) => a.dti < 0.20).length },
    { label: "20–36%", count: apps.filter((a) => a.dti >= 0.20 && a.dti < 0.36).length },
    { label: "36–50%", count: apps.filter((a) => a.dti >= 0.36 && a.dti < 0.50).length },
    { label: "> 50%", count: apps.filter((a) => a.dti >= 0.50).length },
  ];

  return (
    <>
      <PageHeader title="Analytics" description="Insights derived from your real application data." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Applications" value={String(total)} icon={FileText} accent="primary" />
        <StatCard label="Approval Rate" value={`${approvalRate}%`} icon={CheckCircle2} accent="success" />
        <StatCard label="Avg Credit Score" value={avgScore !== null ? String(avgScore) : "—"} icon={Gauge} accent="info" />
        <StatCard label="Approved Count" value={String(approved)} icon={TrendingUp} accent="warning" />
      </div>

      {total === 0 ? (
        <Card className="shadow-card border-border/60 p-10 text-center text-muted-foreground">
          No application data yet. Submit your first loan application to see analytics.
        </Card>
      ) : (
        <>
          {scoreTrend.length > 1 && (
            <Card className="shadow-card border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Credit Score Trend</CardTitle>
                <CardDescription>Across your applications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={scoreTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
                      <YAxis domain={[300, 900]} stroke="var(--color-muted-foreground)" fontSize={12} />
                      <Tooltip
                        contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                        formatter={(v: number) => [v, "Score"]}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="var(--color-primary)"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "var(--color-primary)" }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-card border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Risk Distribution</CardTitle>
                <CardDescription>Low / Medium / High breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskDistribution}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        {riskDistribution.map((entry) => (
                          <Cell key={entry.name} fill={RISK_COLORS[entry.name] ?? "#888"} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-border/60">
              <CardHeader>
                <CardTitle className="text-base">DTI Distribution</CardTitle>
                <CardDescription>Debt-to-income buckets</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dtiBuckets}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                      <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                      <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {monthlyApprovals.length > 0 && (
              <Card className="shadow-card border-border/60 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Approval History</CardTitle>
                  <CardDescription>Approved vs rejected per month</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyApprovals}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                        <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                        <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                        <Legend />
                        <Bar dataKey="approved" stackId="a" fill="var(--color-success)" />
                        <Bar dataKey="rejected" stackId="a" fill="var(--color-destructive)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </>
  );
}
