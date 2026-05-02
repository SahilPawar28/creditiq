import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { riskColorClass, statusColorClass } from "@/lib/mock-data";
import { getUserApplications, ApplicationDoc, formatINR, tsToDate } from "@/lib/firestore";
import { useEffect, useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/applications")({
  component: AppsPage,
});

function AppsPage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<ApplicationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    getUserApplications(user.uid)
      .then(setApps)
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, [user]);

  const rows = useMemo(() => {
    return apps.filter((a) => {
      if (statusFilter !== "all" && a.decision !== statusFilter) return false;
      if (q && !a.id.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [apps, q, statusFilter]);

  const exportCSV = () => {
    const headers = ["ID", "Amount (₹)", "Risk", "Decision", "Score", "DTI", "Date"];
    const csvRows = rows.map((a) => [
      a.id,
      a.loanAmount,
      a.riskLevel,
      a.decision,
      a.creditScore,
      (a.dti * 100).toFixed(1) + "%",
      tsToDate(a.createdAt),
    ]);
    const csv = [headers, ...csvRows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "creditiq-applications.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="My Applications"
        description="Track every loan application you've submitted."
        actions={
          <Button variant="outline" onClick={exportCSV} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        }
      />

      <Card className="shadow-card border-border/60">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Decisions</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application ID</TableHead>
                  <TableHead>Loan Amount</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>DTI</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(8)].map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      {apps.length === 0 ? (
                        <span>
                          No applications yet.{" "}
                          <Link to="/apply" className="text-primary hover:underline">
                            Apply now
                          </Link>
                        </span>
                      ) : (
                        "No applications match your filters."
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((a) => (
                    <TableRow key={a.id} className="hover:bg-muted/40">
                      <TableCell className="font-mono text-xs">{a.id.slice(0, 10)}…</TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        {formatINR(a.loanAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={riskColorClass(a.riskLevel as "Low" | "Medium" | "High")}
                        >
                          {a.riskLevel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusColorClass(
                            a.decision as "Approved" | "Rejected" | "Pending",
                          )}
                        >
                          {a.decision}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums font-medium">{a.creditScore}</TableCell>
                      <TableCell className="tabular-nums">
                        {(a.dti * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tsToDate(a.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to="/result" search={{ id: a.id }}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && rows.length > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              Showing {rows.length} of {apps.length} applications
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
