'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { History } from 'lucide-react'

export default function WorkerHistoryPage() {
    return (
        <div className="p-4 space-y-4">
            <Card className="bg-amber-900/50 border-amber-800">
                <CardHeader>
                    <CardTitle className="text-amber-100 flex items-center gap-2">
                        <History className="w-5 h-5 text-amber-400" />
                        Collection History
                    </CardTitle>
                    <CardDescription className="text-amber-300/70">
                        View your past waste collection records
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12 text-amber-300/50 border-2 border-dashed border-amber-800/50 rounded-xl">
                        No history records found for your account.
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
