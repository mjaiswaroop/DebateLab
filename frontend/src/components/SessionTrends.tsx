"use client";

import React from "react";
import { TrendPoint } from "@/types/debate";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface SessionTrendsProps {
  trend: TrendPoint[];
}

export const SessionTrends: React.FC<SessionTrendsProps> = ({ trend }) => {
  if (!trend || trend.length === 0) {
    return null;
  }

  const chartData = trend.map((t) => ({
    round: `Round ${t.turn_number}`,
    confidence: t.confidence ?? 0,
    argument: t.argument ?? 0,
    hesitation: t.hesitation ?? 0,
    fillers: t.filler_total ?? 0,
    wpm: t.wpm ?? 0,
  }));

  return (
    <div className="flex flex-col gap-4 p-6 rounded-3xl bg-[#0a0a0a] border border-neutral-800 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#fcdbe8]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">
            Multi-Round Trajectory &amp; Momentum
          </h3>
        </div>
        <span className="text-xs text-neutral-400 font-mono">
          Rhetorical evolution over rounds
        </span>
      </div>

      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" opacity={0.6} />
            <XAxis dataKey="round" stroke="#737373" fontSize={11} tickLine={false} />
            <YAxis domain={[0, 100]} stroke="#737373" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#171717",
                borderColor: "#404040",
                borderRadius: "16px",
                color: "#ffffff",
                fontSize: "12px",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              formatter={(value) => {
                const map: Record<string, string> = {
                  confidence: "Acoustic Confidence",
                  argument: "Argument Soundness",
                  hesitation: "Hesitation Index",
                  fillers: "Fillers Total",
                };
                return map[value] || value;
              }}
            />
            <Line
              type="monotone"
              dataKey="confidence"
              stroke="#fcdbe8"
              strokeWidth={3}
              dot={{ r: 4, fill: "#fcdbe8" }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="argument"
              stroke="#ffffff"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#ffffff" }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="hesitation"
              stroke="#fbbf24"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: "#fbbf24" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
