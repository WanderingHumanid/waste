'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  User,
  Loader2,
  Shield,
  Truck,
  MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type UserRole = 'citizen' | 'worker' | 'admin'

interface UserRow {
  id: string
  role: UserRole
  full_name: string | null
  phone: string | null
  green_credits: number
  created_at: string
  preferred_language: string
  assignment: { ward_number: number | null; district: string | null } | null
}

const ROLE_BADGE: Record<UserRole, string> = {
  citizen: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  worker: 'bg-sky-50 text-sky-700 border-sky-200',
  admin: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const ROLE_ICON: Record<UserRole, React.ElementType> = {
  citizen: User,
  worker: Truck,
  admin: Shield,
}

const KERALA_DISTRICTS = [
  'Ernakulam', 'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha',
  'Kottayam', 'Idukki', 'Thrissur', 'Palakkad', 'Malappuram',
  'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod',
]

export default function AdminUsersPage() {
  const searchParams = useSearchParams()
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>(searchParams.get('filter') === 'workers' ? 'worker' : searchParams.get('filter') === 'citizens' ? 'citizen' : 'all')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Role change dialog
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; user: UserRow | null }>({ open: false, user: null })
  const [newRole, setNewRole] = useState<UserRole>('worker')

  // Ward assignment dialog
  const [wardDialog, setWardDialog] = useState<{ open: boolean; user: UserRow | null }>({ open: false, user: null })
  const [wardNumber, setWardNumber] = useState<string>('')
  const [wardDistrict, setWardDistrict] = useState<string>('Ernakulam')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search,
        role: roleFilter,
      })
      const res = await fetch(`/api/admin/users?${params}`)
      const data = await res.json()
      if (data.success) {
        setUsers(data.users)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      }
    } catch (e) {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter])

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300)
    return () => clearTimeout(t)
  }, [fetchUsers])

  const handleRoleChange = async () => {
    if (!roleDialog.user) return
    setActionLoading('role')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: roleDialog.user.id, action: 'set_role', newRole }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setRoleDialog({ open: false, user: null })
        fetchUsers()
      } else {
        toast.error(data.error || 'Failed to update role')
      }
    } catch {
      toast.error('Request failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleWardAssign = async () => {
    if (!wardDialog.user || !wardNumber) return
    setActionLoading('ward')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: wardDialog.user.id,
          action: 'assign_ward',
          wardNumber: parseInt(wardNumber),
          district: wardDistrict,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setWardDialog({ open: false, user: null })
        fetchUsers()
      } else {
        toast.error(data.error || 'Failed to assign ward')
      }
    } catch {
      toast.error('Request failed')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">User Management</h2>
          <p className="text-sm text-zinc-500">{total} total users across all districts</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white border-zinc-200 shadow-none">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <Input
              placeholder="Search by name or phone..."
              className="pl-8 h-9 text-sm bg-zinc-50 border-zinc-200"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1) }}>
            <SelectTrigger className="h-9 w-36 text-sm border-zinc-200 bg-zinc-50">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="citizen">Citizens</SelectItem>
              <SelectItem value="worker">Workers</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-white border-zinc-200 shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/60">
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-3 w-[30%]">User</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Role</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Ward / Assignment</th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Credits</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Joined</th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-300 mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm text-zinc-400">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user, i) => {
                  const RoleIcon = ROLE_ICON[user.role]
                  return (
                    <tr
                      key={user.id}
                      className={cn(
                        'border-b border-zinc-50 hover:bg-zinc-50/80 transition-colors',
                        i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'
                      )}
                    >
                      {/* User */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0">
                            <RoleIcon className="w-3.5 h-3.5 text-zinc-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-800 truncate">
                              {user.full_name || 'Unnamed User'}
                            </p>
                            <p className="text-[11px] text-zinc-400 font-mono truncate">
                              {user.phone || user.id.slice(0, 12) + '…'}
                            </p>
                          </div>
                        </div>
                      </td>
                      {/* Role */}
                      <td className="px-4 py-3.5">
                        <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium', ROLE_BADGE[user.role])}>
                          {user.role}
                        </span>
                      </td>
                      {/* Ward */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {user.assignment?.ward_number ? (
                          <div className="flex items-center gap-1 text-xs text-zinc-600">
                            <MapPin className="w-3 h-3 text-amber-500" />
                            Ward {user.assignment.ward_number}
                            {user.assignment.district && (
                              <span className="text-zinc-400">· {user.assignment.district}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-300">—</span>
                        )}
                      </td>
                      {/* Credits */}
                      <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                        <span className="text-sm font-medium text-emerald-600">{user.green_credits}</span>
                        <span className="text-[11px] text-zinc-400 ml-0.5">pts</span>
                      </td>
                      {/* Joined */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <span className="text-xs text-zinc-400">
                          {new Date(user.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: '2-digit',
                          })}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {user.role === 'citizen' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 border-zinc-200 hover:border-sky-300 hover:text-sky-700 hover:bg-sky-50"
                              onClick={() => {
                                setRoleDialog({ open: true, user })
                                setNewRole('worker')
                              }}
                            >
                              <ArrowUpRight className="w-3 h-3 mr-1" />
                              Promote
                            </Button>
                          )}
                          {user.role === 'worker' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 border-zinc-200 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50"
                              onClick={() => {
                                setWardDialog({ open: true, user })
                                setWardNumber(user.assignment?.ward_number?.toString() || '')
                                setWardDistrict(user.assignment?.district || 'Ernakulam')
                              }}
                            >
                              <MapPin className="w-3 h-3 mr-1" />
                              Assign
                            </Button>
                          )}
                          {user.role === 'worker' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50"
                              onClick={() => {
                                setRoleDialog({ open: true, user })
                                setNewRole('citizen')
                              }}
                            >
                              Demote
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100">
            <p className="text-xs text-zinc-400">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
            </p>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0 border-zinc-200"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = i + Math.max(1, page - 2)
                if (p > totalPages) return null
                return (
                  <Button
                    key={p}
                    size="sm"
                    variant={p === page ? 'default' : 'outline'}
                    className={cn(
                      'h-7 w-7 p-0 text-xs',
                      p === page
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'border-zinc-200 text-zinc-600'
                    )}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                )
              })}
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0 border-zinc-200"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Role Change Dialog */}
      <Dialog open={roleDialog.open} onOpenChange={(o) => setRoleDialog({ open: o, user: roleDialog.user })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Change User Role</DialogTitle>
            <DialogDescription className="text-sm">
              Update role for{' '}
              <span className="font-medium text-zinc-700">
                {roleDialog.user?.full_name || 'this user'}
              </span>
              . This immediately changes their portal access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 border border-zinc-200">
              <span className="text-xs text-zinc-500">Current:</span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', ROLE_BADGE[roleDialog.user?.role || 'citizen'])}>
                {roleDialog.user?.role}
              </span>
              <span className="text-zinc-300">→</span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', ROLE_BADGE[newRole])}>
                {newRole}
              </span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-600">New role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="citizen">Citizen</SelectItem>
                  <SelectItem value="worker">Worker — grants portal access</SelectItem>
                  <SelectItem value="admin">Admin — full access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setRoleDialog({ open: false, user: null })}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-zinc-900 hover:bg-zinc-800 text-white"
              disabled={actionLoading === 'role'}
              onClick={handleRoleChange}
            >
              {actionLoading === 'role' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ward Assignment Dialog */}
      <Dialog open={wardDialog.open} onOpenChange={(o) => setWardDialog({ open: o, user: wardDialog.user })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Assign Worker to Ward</DialogTitle>
            <DialogDescription className="text-sm">
              Set ward and district routing for{' '}
              <span className="font-medium text-zinc-700">
                {wardDialog.user?.full_name || 'this worker'}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-600">Ward Number (1–19)</Label>
              <Input
                type="number"
                min={1}
                max={19}
                placeholder="e.g. 5"
                className="h-9 text-sm"
                value={wardNumber}
                onChange={(e) => setWardNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-600">District</Label>
              <Select value={wardDistrict} onValueChange={setWardDistrict}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {KERALA_DISTRICTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setWardDialog({ open: false, user: null })}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-zinc-900 hover:bg-zinc-800 text-white"
              disabled={actionLoading === 'ward' || !wardNumber}
              onClick={handleWardAssign}
            >
              {actionLoading === 'ward' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
