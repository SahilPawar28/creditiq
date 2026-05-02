import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: number;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "info";
  children?: ReactNode;
}

const accentMap = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-foreground",
  info: "bg-info/10 text-info",
};

export function StatCard({ label, value, icon: Icon, trend, hint, accent = "primary", children }: Props) {
  const trendUp = (trend ?? 0) >= 0;
  return (
    <Card className="shadow-card border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", accentMap[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {typeof trend === "number" && (
          <div className={cn("mt-3 inline-flex items-center gap-1 text-xs font-medium", trendUp ? "text-success" : "text-destructive")}>
            {trendUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {trendUp ? "+" : ""}{trend}% vs last month
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
