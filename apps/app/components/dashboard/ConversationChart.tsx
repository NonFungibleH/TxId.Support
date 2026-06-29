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
import { useTheme } from "next-themes"

interface ChartDay {
  date: string   // "Mon 24"
  conversations: number
}

interface ConversationChartProps {
  data: ChartDay[]
}

export function ConversationChart({ data }: ConversationChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme !== "light"

  const c = {
    grid:          isDark ? "#27272a" : "#e5e7eb",
    tick:          isDark ? "#71717a" : "#9ca3af",
    tooltipBg:     isDark ? "#18181b" : "#ffffff",
    tooltipBorder: isDark ? "#27272a" : "#e5e7eb",
    tooltipLabel:  isDark ? "#a1a1aa" : "#6b7280",
    tooltipItem:   isDark ? "#818cf8" : "#6366f1",
  }

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
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: c.tick, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: c.tick, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: c.tooltipBg,
            border: `1px solid ${c.tooltipBorder}`,
            borderRadius: "8px",
            fontSize: "12px",
          }}
          labelStyle={{ color: c.tooltipLabel }}
          itemStyle={{ color: c.tooltipItem }}
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
