'use client'

import { useState, useEffect } from 'react'
import {
    Settings,
    Shield,
    Bell,
    Database,
    Globe,
    Lock,
    Smartphone,
    Cpu,
    RefreshCw,
} from 'lucide-react'

const SETTINGS_GROUPS = [
    {
        title: 'System Intelligence',
        icon: Cpu,
        items: [
            { id: 'ai_detection', label: 'AI Waste Analysis', description: 'Enable Groq Vision for waste category detection', default: true },
            { id: 'ml_forecast', label: 'ML Demand Forecasting', description: 'Predict waste hotspots using historical data', default: true },
        ]
    },
    {
        title: 'Operations',
        icon: Smartphone,
        items: [
            { id: 'realtime_gps', label: 'Real-time GPS Tracking', description: 'Stream worker locations via Supabase Realtime', default: true },
            { id: 'offline_sync', label: 'Offline Mode Support', description: 'Allow workers to collect data without internet', default: false },
        ]
    },
    {
        title: 'Marketplace',
        icon: Globe,
        items: [
            { id: 'construction_reuse', label: 'Construction Reuse Portal', description: 'Enable listing and trading of debris items', default: true },
            { id: 'green_credits', label: 'Green Credit System', description: 'Award credits for verified collections', default: true },
        ]
    }
]

export default function AdminSettingsPage() {
    const [config, setConfig] = useState<Record<string, boolean>>({})
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        // Mock initial load
        const initialConfig: Record<string, boolean> = {}
        SETTINGS_GROUPS.forEach(group => {
            group.items.forEach(item => {
                initialConfig[item.id] = item.default
            })
        })
        setConfig(initialConfig)
    }, [])

    const toggle = (id: string) => {
        setConfig(prev => ({ ...prev, [id]: !prev[id] }))
    }

    const handleSave = () => {
        setSaving(true)
        setTimeout(() => {
            setSaving(false)
        }, 1000)
    }

    return (
        <div className="p-6 max-w-4xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Settings className="w-6 h-6 text-emerald-500" />
                        Global Settings
                    </h1>
                    <p className="text-zinc-400 text-sm mt-1">Configure system-wide parameters and platform features</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                    {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                    Save Configuration
                </button>
            </div>

            <div className="space-y-6">
                {SETTINGS_GROUPS.map((group) => {
                    const Icon = group.icon
                    return (
                        <div key={group.title} className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden">
                            <div className="px-6 py-4 bg-zinc-900/30 border-b border-zinc-900 flex items-center gap-3">
                                <Icon className="w-5 h-5 text-zinc-400" />
                                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">{group.title}</h2>
                            </div>
                            <div className="divide-y divide-zinc-900">
                                {group.items.map((item) => (
                                    <div key={item.id} className="p-6 flex items-center justify-between hover:bg-zinc-900/20 transition-colors">
                                        <div className="flex-1 pr-8">
                                            <p className="text-sm font-medium text-white mb-1">{item.label}</p>
                                            <p className="text-xs text-zinc-500 leading-relaxed">{item.description}</p>
                                        </div>
                                        <button
                                            onClick={() => toggle(item.id)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors border-2 border-transparent ${config[item.id] ? 'bg-emerald-500' : 'bg-zinc-800'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config[item.id] ? 'translate-x-5' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}

                {/* Danger Zone */}
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Shield className="w-5 h-5 text-rose-500" />
                        <h2 className="text-sm font-semibold text-rose-500 uppercase tracking-wider">Danger Zone</h2>
                    </div>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium text-zinc-300">System Reset</p>
                            <p className="text-xs text-zinc-500 mt-1">Permanently purge all transaction logs and archival data</p>
                        </div>
                        <button className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-sm font-medium rounded-lg border border-rose-500/20 transition-colors">
                            Purge Database
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
