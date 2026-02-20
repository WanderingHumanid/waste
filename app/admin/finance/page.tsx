'use client'

import { useState, useEffect } from 'react'
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Target,
  Download,
  Calendar,
  IndianRupee,
  RefreshCw
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts'

interface FinanceData {
  summary: {
    totalRevenue: number
    pendingRevenue: number
    totalCredits: number
    collectionRate: number
  }
  recentPayments: any[]
  trends: any[]
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

export default function AdminFinancePage() {
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/finance')
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading || !data) {
    return (
      <div className="p-6 h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-zinc-500 text-sm font-medium">Crunching financial data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <IndianRupee className="w-6 h-6 text-emerald-500" />
            Financial Dashboard
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Revenue tracking, fee collection, and green credit ledger
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Calendar className="w-4 h-4" />
            Last 30 Days
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `₹${data.summary.totalRevenue.toLocaleString()}`, trend: '+12.5%', color: 'emerald', icon: Wallet },
          { label: 'Pending Fees', value: `₹${data.summary.pendingRevenue.toLocaleString()}`, trend: '-2.4%', color: 'rose', icon: CreditCard },
          { label: 'Green Credits', value: data.summary.totalCredits.toLocaleString(), trend: '+450', color: 'blue', icon: TrendingUp },
          { label: 'Collection Rate', value: `${data.summary.collectionRate.toFixed(1)}%`, trend: '+5.2%', color: 'amber', icon: Target },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity`}>
              <kpi.icon className={`w-full h-full text-${kpi.color}-500`} />
            </div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-1">{kpi.label}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-xl font-bold text-white">{kpi.value}</h3>
              <div className={`flex items-center gap-1 text-[10px] font-bold ${kpi.trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                {kpi.trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpi.trend}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-900 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Revenue Forecast vs Actual</h3>
            <button className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-widest flex items-center gap-1">
              View Detailed Report <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trends}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                <XAxis
                  dataKey="stat_date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#71717a', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Area type="monotone" dataKey="collection_fees" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-8">Operational Expenses</h3>
          <div className="space-y-6">
            {[
              { label: 'Worker Wages', amount: '₹1.2L', pct: 65, color: 'bg-emerald-500' },
              { label: 'Vehicle Fuel', amount: '₹42K', pct: 22, color: 'bg-blue-500' },
              { label: 'Maintenance', amount: '₹18K', pct: 10, color: 'bg-amber-500' },
              { label: 'Administrative', amount: '₹5K', pct: 3, color: 'bg-rose-500' },
            ].map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">{item.label}</span>
                  <span className="text-white font-medium">{item.amount}</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 pt-6 border-t border-zinc-900">
            <button className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors group">
              <span className="text-xs font-medium">Download Fiscal PDF</span>
              <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
