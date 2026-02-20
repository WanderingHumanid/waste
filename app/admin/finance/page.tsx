'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Wallet } from 'lucide-react'

export default function AdminFinancePage() {
  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-zinc-900">Financial Reports</h2>
        <p className="text-sm text-zinc-500">Revenue, fee collection, and green credits</p>
      </div>
      <Card className="bg-white border-zinc-200 shadow-none">
        <CardContent className="py-16 text-center">
          <Wallet className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-500">Financial reports coming soon</p>
          <p className="text-xs text-zinc-400 mt-1">Collection fees, UPI payments, and credit ledger</p>
        </CardContent>
      </Card>
    </div>
  )
}
