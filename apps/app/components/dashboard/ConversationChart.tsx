"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface ChartDay {
  date: string   // "Mon 24"
  conversations: number
}

interface ConversationChartProps {
  data: ChartDay[]
}

export function ConversationChart({ data }: ConversationChartProps) {
  if (data.every((d) => d.conversations === 0)) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No conversations yet — embed the widget to get started.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "#a1a1aa" }}
          itemStyle={{ color: "#818cf8" }}
          cursor={{ stroke: "#6366f1", strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="conversations"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#convGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "#6366f1" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
