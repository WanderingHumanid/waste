'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Wallet, TrendingUp } from 'lucide-react'

export default function WorkerEarningsPage() {
    return (
        <div className="p-4 space-y-4">
            <Card className="bg-amber-900/50 border-amber-800">
                <CardHeader>
                    <CardTitle className="text-amber-100 flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-amber-400" />
                        Earnings Dashboard
                    </CardTitle>
                    <CardDescription className="text-amber-300/70">
                        Track your daily and monthly collection fees
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="p-4 rounded-xl bg-amber-800/20 border border-amber-800/50">
                            <p className="text-sm font-medium text-amber-300/70 mb-1">Total Earnings</p>
                            <h3 className="text-3xl font-bold text-amber-100">₹0</h3>
                        </div>
                        <div className="p-4 rounded-xl bg-amber-800/20 border border-amber-800/50">
                            <p className="text-sm font-medium text-amber-300/70 mb-1">Pending Fees</p>
                            <h3 className="text-3xl font-bold text-amber-100">₹0</h3>
                        </div>
                    </div>
                    <div className="text-center py-8 text-amber-300/50 border-2 border-dashed border-amber-800/50 rounded-xl">
                        Complete collections to start earning!
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
