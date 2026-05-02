// Shared types and pure helper functions — no mock user data
export type RiskLevel = "Low" | "Medium" | "High";
export type AppStatus = "Approved" | "Rejected" | "Pending";

export function riskFromScore(score: number): RiskLevel {
  if (score > 750) return "Low";
  if (score >= 600) return "Medium";
  return "High";
}

export function riskColorClass(risk: RiskLevel) {
  if (risk === "Low") return "bg-success/10 text-success border-success/20";
  if (risk === "Medium") return "bg-warning/15 text-warning-foreground border-warning/30";
  return "bg-destructive/10 text-destructive border-destructive/20";
}

export function statusColorClass(status: AppStatus) {
  if (status === "Approved") return "bg-success/10 text-success border-success/20";
  if (status === "Pending") return "bg-info/10 text-info border-info/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
}
