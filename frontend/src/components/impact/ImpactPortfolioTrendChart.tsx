'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export type ImpactTrendPoint = {
  day: string
  cleanups: number
  weight: number
}

type Props = {
  data: ImpactTrendPoint[]
}

export function ImpactPortfolioTrendChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.2)" />
        <XAxis dataKey="day" stroke="rgba(200,200,200,0.6)" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" stroke="rgba(88,177,47,0.7)" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" stroke="rgba(250,255,0,0.7)" tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#111315',
            border: '1px solid rgba(88,177,47,0.25)',
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="weight"
          name="Weight (kg)"
          stroke="#58B12F"
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="cleanups"
          name="Cleanups"
          stroke="#FAFF00"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
