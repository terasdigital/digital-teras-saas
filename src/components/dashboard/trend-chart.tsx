"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint } from "@/lib/db/queries/analytics";

/** Label sumbu-X singkat dari 'YYYY-MM-DD' → 'DD/MM'. */
function shortDay(day: string): string {
  const [, m, d] = day.split("-");
  return m && d ? `${d}/${m}` : day;
}

/**
 * Tren kunjungan harian — SATU seri, satu sumbu (bukan dual-axis).
 * Warna dari token tema (var(--primary)) → adaptif mode gelap.
 * Grid horizontal resesif, tooltip sebagai lapisan hover.
 */
export function TrendChart({ series }: { series: SeriesPoint[] }) {
  const data = series.map((s) => ({
    label: shortDay(s.day),
    visit: s.visit,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="visitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--popover, var(--background))",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            formatter={(value) => [String(value ?? 0), "Kunjungan"]}
          />
          <Area
            type="monotone"
            dataKey="visit"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#visitFill)"
            activeDot={{ r: 4, strokeWidth: 0, fill: "var(--primary)" }}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
