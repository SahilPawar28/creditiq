import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Users, FileCheck2, Activity, TrendingUp } from "lucide-react";
import { riskColorClass, statusColorClass } from "@/lib/mock-data";
import { getAllApplications, ApplicationDoc, formatINR, tsToDate } from "@/lib/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPanel,
});

const RISK_COLORS: Record<string, string> = {
  Low: "var(--color-success)",
  Medium: "var(--color-warning)",
  High: "var(--color-destructive)",
};

function AdminPanel() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState<ApplicationDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile && profile.role !== "admin") {
      toast.error("Access denied — admin only");
      navigate({ to: "/" });
      return;
    }
    getAllApplications()
      .then(setApps)
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, [profile, navigate]);

  if (loading) {
    return (
      <>
        <PageHeader title="Admin Panel" description="Loading…" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </>
    );
  }

  // Aggregate stats
  const total = apps.length;
  const approved = apps.filter((a) => a.decision === "Approved").length;
  const rejected = total - approved;
  const approvalRate = total > 0 ? ((approved / total) * 100).toFixed(1) : "0";

  // Unique users
  const uniqueUsers = new Set(apps.map((a) => a.userId)).size;

  // Risk distribution
  const riskCounts: Record<string, number> = { Low: 0, Medium: 0, High: 0 };
  apps.forEach((a) => { riskCounts[a.riskLevel] = (riskCounts[a.riskLevel] ?? 0) + 1; });
  const riskDistribution = Object.entries(riskCounts).map(([name, value]) => ({ name, value }));

  // Monthly approvals (last 6 months)
  const monthlyMap: Record<string, { approved: number; rejected: number }> = {};
  apps.forEach((a) => {
    const month = a.createdAt.toDate().toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    if (!monthlyMap[month]) monthlyMap[month] = { approved: 0, rejected: 0 };
    if (a.decision === "Approved") monthlyMap[month].approved++;
    else monthlyMap[month].rejected++;
  });
  const monthlyApprovals = Object.entries(monthlyMap).slice(-6).map(([month, v]) => ({ month, ...v }));

  return (
    <>
      <PageHeader title="Admin Panel" description="System-wide overview of all users and applications." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={String(uniqueUsers)} icon={Users} accent="primary" />
        <StatCard label="Total Applications" value={String(total)} icon={Activity} accent="info" />
        <StatCard label="Approved" value={String(approved)} icon={FileCheck2} accent="success" />
        <StatCard label="Approval Rate" value={`${approvalRate}%`} icon={TrendingUp} accent="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2 shadow-card border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Risk Distribution</CardTitle>
            <CardDescription>Across all {total} applications</CardDescription>
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

        <Card className="lg:col-span-3 shadow-card border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Monthly Approvals</CardTitle>
            <CardDescription>Approved vs Rejected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyApprovals}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="approved" fill="var(--color-success)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="rejected" fill="var(--color-destructive)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4 text-center">
        {[
          { label: "Approved", value: approved, color: "text-success" },
          { label: "Rejected", value: rejected, color: "text-destructive" },
          { label: "Approval Rate", value: `${approvalRate}%`, color: "text-primary" },
        ].map((s) => (
          <Card key={s.label} className="shadow-card border-border/60 py-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card className="shadow-card border-border/60">
        <CardHeader>
          <CardTitle className="text-base">All Applications</CardTitle>
          <CardDescription>Most recent {Math.min(apps.length, 50)} entries</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Income</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Date</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.slice(0, 50).map((a) => (
                <TableRow key={a.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono text-xs">{a.id.slice(0, 8)}…</TableCell>
                  <TableCell className="max-w-[120px] truncate" title={a.userEmail}>
                    {a.fullName}
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatINR(a.loanAmount)}</TableCell>
                  <TableCell className="tabular-nums">{formatINR(a.income)}/mo</TableCell>
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
                  <TableCell className="tabular-nums font-medium">{a.creditScore}</TableCell>
                  <TableCell className="text-muted-foreground">{tsToDate(a.createdAt)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/result" search={{ id: a.id }}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {apps.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No applications yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
