'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function WorkerDashboardPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/worker/routing')
  }, [router])

  return null
}
