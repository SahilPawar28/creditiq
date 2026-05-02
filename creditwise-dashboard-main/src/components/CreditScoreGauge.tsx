import { riskFromScore } from "@/lib/mock-data";

interface Props {
  score: number;
  size?: number;
}

export function CreditScoreGauge({ score, size = 220 }: Props) {
  const min = 300;
  const max = 850;
  const pct = Math.max(0, Math.min(1, (score - min) / (max - min)));
  const radius = size / 2 - 14;
  const circumference = Math.PI * radius;
  const dash = circumference * pct;
  const risk = riskFromScore(score);

  const color =
    risk === "Low" ? "var(--color-success)" : risk === "Medium" ? "var(--color-warning)" : "var(--color-destructive)";

  return (
    <div className="relative flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <path
          d={`M 14 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 14} ${size / 2}`}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d={`M 14 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 14} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 600ms ease, stroke 300ms ease" }}
        />
      </svg>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1 flex flex-col items-center">
        <span className="text-4xl font-bold tracking-tight tabular-nums">{score}</span>
        <span className="text-xs text-muted-foreground mt-1">out of {max}</span>
      </div>
    </div>
  );
}
