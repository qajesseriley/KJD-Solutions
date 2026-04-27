'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type RequestRow = {
  id: string
  description: string | null
  status: string | null
  created_at: string
  updated_at: string | null
  postponed_reason: string | null
  attachment_url: string | null
  attachment_name: string | null
  assigned_to: string | null
  resident_name: string | null
  address: string | null
  resident_phone: string | null
  priority: string | null
  due_date: string | null
  category: string | null
  organization_id: string | null
}

type StaffRow = {
  id: string
  name: string
  email: string | null
  role: string | null
  organization_id: string | null
}

type NoteRow = {
  id: string
  request_id: string
  staff_id: string | null
  note: string
  created_at: string
}

type OrgInfo = {
  name: string
  logo_url: string | null
}

type StatusFilter = 'All' | 'New' | 'In Progress' | 'Completed' | 'Postponed'
type PriorityFilter = 'All' | 'Low' | 'Medium' | 'High' | 'Emergency'
type DueFilter = 'All' | 'Overdue' | 'Today' | 'This Week'

export default function DashboardPage() {
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notesLoading, setNotesLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All')
  const [dueFilter, setDueFilter] = useState<DueFilter>('All')
  const [assignedFilter, setAssignedFilter] = useState('All')
  const [photoOnly, setPhotoOnly] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<RequestRow | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [postponeReason, setPostponeReason] = useState('')
  const [newNote, setNewNote] = useState('')
  const [dueDateInput, setDueDateInput] = useState('')
  const [priorityInput, setPriorityInput] = useState('Medium')

  async function getOrganization() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Not logged in')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (error || !data?.organization_id) {
      setError('No organization found for this user')
      setLoading(false)
      return
    }

    setOrganizationId(data.organization_id)
  }

  function getTitle(description: string | null) {
    if (!description) return 'Untitled Request'
    return description.split('\n')[0] || 'Untitled Request'
  }

  function getDetails(description: string | null) {
    if (!description) return 'No additional details provided.'
    const parts = description.split('\n').filter(Boolean)
    if (parts.length <= 1) return description
    return parts.slice(1).join('\n')
  }

  function getAssignedName(userId: string | null) {
    if (!userId) return 'Unassigned'
    const found = staff.find((person) => person.id === userId)
    return found?.name || userId
  }

  function notifyNewRequest(title: string) {
    if (!("Notification" in window)) return
    if (Notification.permission !== "granted") return

    new Notification("New Maintenance Request", {
      body: title,
    })
  }

  async function fetchRequests(orgId = organizationId) {
    if (!orgId) return

    const { data, error } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      setRequests([])
      return
    }

    const rows = (data as RequestRow[]) || []

    setRequests((previousRows) => {
      if (previousRows.length > 0 && rows.length > previousRows.length) {
        const previousIds = new Set(previousRows.map((request) => request.id))
        const newest = rows.find((request) => !previousIds.has(request.id)) || rows[0]
        notifyNewRequest(getTitle(newest.description))
      }

      return rows
    })

    setSelectedRequest((current) => {
      if (!current) return current
      const refreshed = rows.find((r) => r.id === current.id)
      if (!refreshed) return null
      return refreshed
    })
  }

  async function fetchStaff(orgId = organizationId) {
    if (!orgId) return

    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('organization_id', orgId)
      .order('name', { ascending: true })

    if (error) {
      setStaff([])
      return
    }

    setStaff((data as StaffRow[]) || [])
  }

  async function fetchOrgInfo(orgId = organizationId) {
    if (!orgId) return

    const { data } = await supabase
      .from('organizations')
      .select('name, logo_url')
      .eq('id', orgId)
      .single()

    if (data) setOrgInfo(data as OrgInfo)
  }

  async function fetchNotes(requestId: string) {
    setNotesLoading(true)

    const { data, error } = await supabase
      .from('request_notes')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })

    if (error) {
      alert(error.message)
      setNotes([])
      setNotesLoading(false)
      return
    }

    setNotes((data as NoteRow[]) || [])
    setNotesLoading(false)
  }

  useEffect(() => {
    getOrganization()
  }, [])

  useEffect(() => {
    if (!organizationId) return

    async function load() {
      setLoading(true)
      setError('')
      await Promise.all([
        fetchRequests(organizationId),
        fetchStaff(organizationId),
        fetchOrgInfo(organizationId),
      ])
      setLoading(false)
    }

    load()

    const requestChannel = supabase
      .channel(`dashboard-live-maintenance-requests-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maintenance_requests',
          filter: `organization_id=eq.${organizationId}`,
        },
        async () => {
          await fetchRequests(organizationId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(requestChannel)
    }
  }, [organizationId])

  useEffect(() => {
    if (!selectedRequest) return

    const notesChannel = supabase
      .channel(`dashboard-live-notes-${selectedRequest.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'request_notes' },
        async (payload) => {
          if (
            payload.new &&
            typeof payload.new === 'object' &&
            'request_id' in payload.new &&
            payload.new.request_id === selectedRequest.id
          ) {
            await fetchNotes(selectedRequest.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(notesChannel)
    }
  }, [selectedRequest?.id])

  useEffect(() => {
    if (selectedRequest) {
      setPostponeReason(selectedRequest.postponed_reason || '')
      setDueDateInput(
        selectedRequest.due_date
          ? new Date(selectedRequest.due_date).toISOString().slice(0, 16)
          : ''
      )
      setPriorityInput(selectedRequest.priority || 'Medium')
      fetchNotes(selectedRequest.id)
    } else {
      setNotes([])
      setPostponeReason('')
      setDueDateInput('')
      setPriorityInput('Medium')
    }
  }, [selectedRequest?.id])

  const filteredRequests = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)

    const endOfWeek = new Date()
    endOfWeek.setDate(now.getDate() + 7)
    endOfWeek.setHours(23, 59, 59, 999)

    return requests.filter((req) => {
      const statusMatches =
        statusFilter === 'All' ? true : (req.status || 'New') === statusFilter

      const priorityMatches =
        priorityFilter === 'All'
          ? true
          : (req.priority || 'Medium') === priorityFilter

      const assignedMatches =
        assignedFilter === 'All'
          ? true
          : assignedFilter === 'Unassigned'
            ? !req.assigned_to
            : req.assigned_to === assignedFilter

      const photoMatches = photoOnly ? !!req.attachment_url : true

      const due = req.due_date ? new Date(req.due_date) : null
      const dueMatches =
        dueFilter === 'All'
          ? true
          : dueFilter === 'Overdue'
            ? !!due && due < now
            : dueFilter === 'Today'
              ? !!due && due <= endOfToday && due >= startOfToday
              : dueFilter === 'This Week'
                ? !!due && due <= endOfWeek && due >= new Date()
                : true

      const text = [
        getTitle(req.description),
        getDetails(req.description),
        req.resident_name,
        req.address,
        req.resident_phone,
        getAssignedName(req.assigned_to),
        req.status,
        req.priority,
        req.category,
      ]
        .join(' ')
        .toLowerCase()

      const searchMatches = text.includes(search.toLowerCase())

      return (
        statusMatches &&
        priorityMatches &&
        assignedMatches &&
        photoMatches &&
        dueMatches &&
        searchMatches
      )
    })
  }, [requests, search, statusFilter, priorityFilter, assignedFilter, photoOnly, dueFilter, staff])

  const counts = useMemo(() => {
    return {
      total: requests.length,
      newCount: requests.filter((r) => (r.status || 'New') === 'New').length,
      inProgress: requests.filter((r) => r.status === 'In Progress').length,
      completed: requests.filter((r) => r.status === 'Completed').length,
      postponed: requests.filter((r) => r.status === 'Postponed').length,
    }
  }, [requests])

  const residentHistory = useMemo(() => {
    if (!selectedRequest) return []

    return requests.filter((req) => {
      if (req.id === selectedRequest.id) return false

      return (
        req.resident_name &&
        req.address &&
        req.resident_name === selectedRequest.resident_name &&
        req.address === selectedRequest.address
      )
    })
  }, [requests, selectedRequest])

  function formatDate(dateString: string | null) {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleString()
  }

  function formatDueDate(dateString: string | null) {
    if (!dateString) return 'No due date'
    return new Date(dateString).toLocaleString()
  }

  function isOverdue(dateString: string | null) {
    if (!dateString) return false
    return new Date(dateString) < new Date()
  }

  function statusBadge(status: string | null) {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
      case 'In Progress':
        return 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
      case 'Postponed':
        return 'bg-slate-500/20 text-slate-200 border border-slate-400/30'
      default:
        return 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
    }
  }

  function priorityBadge(priority: string | null) {
    switch (priority) {
      case 'Emergency':
        return 'bg-red-500/20 text-red-300 border border-red-500/40'
      case 'High':
        return 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
      case 'Low':
        return 'bg-slate-500/20 text-slate-200 border border-slate-400/30'
      default:
        return 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
    }
  }

  function categoryBadge(category: string | null) {
    switch (category) {
      case 'Plumbing':
        return 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
      case 'Electrical':
        return 'bg-yellow-400/20 text-yellow-200 border border-yellow-400/30'
      case 'HVAC':
        return 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
      case 'Appliance':
        return 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
      case 'Roofing':
        return 'bg-stone-500/20 text-stone-200 border border-stone-400/30'
      case 'Grounds / Exterior':
        return 'bg-green-500/20 text-green-300 border border-green-500/30'
      case 'Pest Control':
        return 'bg-lime-500/20 text-lime-300 border border-lime-500/30'
      case 'Safety Concern':
        return 'bg-red-500/20 text-red-300 border border-red-500/40'
      case 'General Maintenance':
        return 'bg-slate-500/20 text-slate-200 border border-slate-400/30'
      default:
        return 'bg-white/10 text-slate-200 border border-white/10'
    }
  }

  function priorityCardGlow(priority: string | null, dueDate: string | null) {
    if (isOverdue(dueDate)) {
      return 'shadow-[0_0_0_1px_rgba(239,68,68,0.3),0_0_35px_rgba(239,68,68,0.15)]'
    }

    switch (priority) {
      case 'Emergency':
        return 'shadow-[0_0_0_1px_rgba(239,68,68,0.35),0_0_35px_rgba(239,68,68,0.14)]'
      case 'High':
        return 'shadow-[0_0_0_1px_rgba(249,115,22,0.35),0_0_30px_rgba(249,115,22,0.12)]'
      default:
        return 'shadow-xl'
    }
  }

  function cardAccent(status: string | null, priority: string | null, dueDate: string | null) {
    if (isOverdue(dueDate) || priority === 'Emergency') {
      return 'border-l-4 border-l-red-400'
    }

    switch (status) {
      case 'Completed':
        return 'border-l-4 border-l-emerald-400'
      case 'In Progress':
        return 'border-l-4 border-l-amber-400'
      case 'Postponed':
        return 'border-l-4 border-l-slate-400'
      default:
        return 'border-l-4 border-l-sky-400'
    }
  }

  async function updateStatus(
    id: string,
    status: 'New' | 'In Progress' | 'Completed' | 'Postponed',
    reason?: string
  ) {
    setUpdatingId(id)

    const payload: any = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'Postponed') {
      payload.postponed_reason = reason || ''
    } else {
      payload.postponed_reason = null
    }

    if (status === 'In Progress') {
      payload.started_at = new Date().toISOString()
    }

    if (status === 'Completed') {
      payload.completed_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('maintenance_requests')
      .update(payload)
      .eq('id', id)

    if (error) {
      alert(error.message)
    }

    await fetchRequests()
    setUpdatingId(null)
  }

  async function assignStaff(requestId: string, staffId: string) {
    setUpdatingId(requestId)

    const { error } = await supabase
      .from('maintenance_requests')
      .update({
        assigned_to: staffId || null,
        status: staffId ? 'In Progress' : 'New',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (error) {
      alert(error.message)
    }

    await fetchRequests()
    setUpdatingId(null)
  }

  async function updatePriority(requestId: string, priority: string) {
    setUpdatingId(requestId)

    const { error } = await supabase
      .from('maintenance_requests')
      .update({
        priority,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (error) {
      alert(error.message)
    }

    await fetchRequests()
    setUpdatingId(null)
  }

  async function updateDueDate(requestId: string, dueDate: string) {
    setUpdatingId(requestId)

    const value = dueDate ? new Date(dueDate).toISOString() : null

    const { error } = await supabase
      .from('maintenance_requests')
      .update({
        due_date: value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (error) {
      alert(error.message)
    }

    await fetchRequests()
    setUpdatingId(null)
  }

  async function uploadAttachment(requestId: string, file: File) {
    setUpdatingId(requestId)

    const fileExt = file.name.split('.').pop() || 'jpg'
    const filePath = `${requestId}/${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('request-attachments')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      alert(uploadError.message)
      setUpdatingId(null)
      return
    }

    const { data } = supabase.storage
      .from('request-attachments')
      .getPublicUrl(filePath)

    const { error: updateError } = await supabase
      .from('maintenance_requests')
      .update({
        attachment_url: data.publicUrl,
        attachment_name: file.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (updateError) {
      alert(updateError.message)
    }

    await fetchRequests()
    setUpdatingId(null)
  }

  async function addNote() {
    if (!selectedRequest || !newNote.trim()) return

    const { error } = await supabase.from('request_notes').insert([
      {
        request_id: selectedRequest.id,
        staff_id: selectedRequest.assigned_to || null,
        note: newNote.trim(),
      },
    ])

    if (error) {
      alert(error.message)
      return
    }

    setNewNote('')
    await fetchNotes(selectedRequest.id)
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1e293b_0%,_#0f172a_45%,_#020617_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {orgInfo && (
          <div className="mb-6 flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl">
            {orgInfo.logo_url ? (
              <img
                src={orgInfo.logo_url}
                alt={`${orgInfo.name} logo`}
                className="h-14 w-14 rounded-2xl border border-white/10 bg-black/20 object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-xl font-bold text-amber-200">
                {orgInfo.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Organization
              </div>
              <div className="text-2xl font-bold text-white">{orgInfo.name}</div>
            </div>
          </div>
        )}

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-200 shadow-sm">
              Premium Maintenance Dashboard
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white">
              Community Work Orders
            </h1>
            <p className="mt-2 text-slate-300">
              Track requests, assign staff, manage priority, schedule work, review resident history, and scan categories fast.
            </p>
          </div>

          <button
            onClick={() => fetchRequests()}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
          >
            Refresh Dashboard
          </button>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Total Requests" value={counts.total} />
          <SummaryCard label="New" value={counts.newCount} />
          <SummaryCard label="In Progress" value={counts.inProgress} />
          <SummaryCard label="Completed" value={counts.completed} />
          <SummaryCard label="Postponed" value={counts.postponed} />
        </div>

        <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl">
          <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <input
              type="text"
              placeholder="Search requests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white placeholder:text-slate-400 outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20 xl:col-span-2"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
            >
              <option className="text-black" value="All">All Statuses</option>
              <option className="text-black" value="New">New</option>
              <option className="text-black" value="In Progress">In Progress</option>
              <option className="text-black" value="Completed">Completed</option>
              <option className="text-black" value="Postponed">Postponed</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
            >
              <option className="text-black" value="All">All Priorities</option>
              <option className="text-black" value="Low">Low</option>
              <option className="text-black" value="Medium">Medium</option>
              <option className="text-black" value="High">High</option>
              <option className="text-black" value="Emergency">Emergency</option>
            </select>

            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
            >
              <option className="text-black" value="All">All Assignments</option>
              <option className="text-black" value="Unassigned">Unassigned</option>
              {staff.map((person) => (
                <option className="text-black" key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>

            <select
              value={dueFilter}
              onChange={(e) => setDueFilter(e.target.value as DueFilter)}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
            >
              <option className="text-black" value="All">All Due Dates</option>
              <option className="text-black" value="Overdue">Overdue</option>
              <option className="text-black" value="Today">Due Today</option>
              <option className="text-black" value="This Week">Due This Week</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={photoOnly}
                onChange={(e) => setPhotoOnly(e.target.checked)}
                className="h-4 w-4"
              />
              Has Photo Only
            </label>

            <button
              onClick={() => {
                setSearch('')
                setStatusFilter('All')
                setPriorityFilter('All')
                setDueFilter('All')
                setAssignedFilter('All')
                setPhotoOnly(false)
              }}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 font-medium text-slate-200 transition hover:bg-white/15"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="space-y-4">
            {loading ? (
              <GlassPanel>Loading requests...</GlassPanel>
            ) : filteredRequests.length === 0 ? (
              <GlassPanel>No requests found.</GlassPanel>
            ) : (
              filteredRequests.map((req) => {
                const active = selectedRequest?.id === req.id

                return (
                  <div
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className={`cursor-pointer rounded-3xl border bg-white/5 p-5 text-left backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/[0.07] ${
                      active
                        ? 'border-amber-300/40 ring-2 ring-amber-300/20'
                        : 'border-white/10'
                    } ${cardAccent(req.status, req.priority, req.due_date)} ${priorityCardGlow(
                      req.priority,
                      req.due_date
                    )}`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 flex-1 gap-4">
                        {req.attachment_url ? (
                          <img
                            src={req.attachment_url}
                            alt={req.attachment_name || 'Request image'}
                            className="h-24 w-24 rounded-2xl border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-xs text-slate-500">
                            No Photo
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-semibold text-white">
                              {getTitle(req.description)}
                            </h2>

                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(req.status)}`}>
                              {req.status || 'New'}
                            </span>

                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${priorityBadge(req.priority)}`}>
                              {req.priority || 'Medium'}
                            </span>

                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${categoryBadge(req.category)}`}>
                              {req.category || 'Leave Unselected'}
                            </span>

                            {isOverdue(req.due_date) && (
                              <span className="inline-flex rounded-full border border-red-500/40 bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-200">
                                Overdue
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-slate-400">
                            Submitted {formatDate(req.created_at)}
                          </p>

                          <div className="mt-3 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                            <InfoTile label="Resident" value={req.resident_name} />
                            <InfoTile label="Address" value={req.address} />
                            <InfoTile label="Phone" value={req.resident_phone} />
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                              Assigned: {getAssignedName(req.assigned_to)}
                            </span>
                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                              Due: {formatDueDate(req.due_date)}
                            </span>
                          </div>

                          <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-300">
                            {getDetails(req.description)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                        {(req.status || 'New') === 'New' && (
                          <button
                            onClick={() => updateStatus(req.id, 'In Progress')}
                            className="rounded-2xl bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-300"
                          >
                            Start
                          </button>
                        )}

                        {(req.status || 'New') !== 'Completed' && (
                          <button
                            onClick={() => updateStatus(req.id, 'Completed')}
                            className="rounded-2xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </section>

          <aside className="h-fit rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl xl:sticky xl:top-8">
            {selectedRequest ? (
              <>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-bold text-white">
                      {getTitle(selectedRequest.description)}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Submitted {formatDate(selectedRequest.created_at)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Last updated {formatDate(selectedRequest.updated_at)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(selectedRequest.status)}`}>
                      {selectedRequest.status || 'New'}
                    </span>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${priorityBadge(selectedRequest.priority)}`}>
                      {selectedRequest.priority || 'Medium'}
                    </span>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${categoryBadge(selectedRequest.category)}`}>
                      {selectedRequest.category || 'Leave Unselected'}
                    </span>
                  </div>
                </div>

                <div className="mb-5 grid gap-3">
                  <InfoTile label="Resident" value={selectedRequest.resident_name} />
                  <InfoTile label="Address" value={selectedRequest.address} />
                  <InfoTile label="Phone" value={selectedRequest.resident_phone} />
                  <InfoTile label="Assigned Staff" value={getAssignedName(selectedRequest.assigned_to)} />
                  <InfoTile label="Due Date" value={formatDueDate(selectedRequest.due_date)} />

                  <div className="rounded-2xl bg-black/20 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Category
                    </div>
                    <div className="mt-2">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${categoryBadge(selectedRequest.category)}`}>
                        {selectedRequest.category || 'Leave Unselected'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mb-5 rounded-2xl bg-black/20 p-4">
                  <div className="mb-2 text-sm font-semibold text-amber-200">Details</div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                    {getDetails(selectedRequest.description)}
                  </p>
                </div>

                {selectedRequest.attachment_url && (
                  <div className="mb-5 rounded-2xl bg-black/20 p-4">
                    <div className="mb-3 text-sm font-semibold text-amber-200">
                      Resident Photo
                    </div>

                    <img
                      src={selectedRequest.attachment_url}
                      alt={selectedRequest.attachment_name || 'Resident uploaded photo'}
                      className="w-full rounded-2xl border border-white/10 object-cover"
                    />

                    <a
                      href={selectedRequest.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-block text-sm font-medium text-amber-200 underline"
                    >
                      Open full image
                    </a>
                  </div>
                )}

                <div className="mb-5">
                  <label className="mb-2 block text-sm font-semibold text-amber-200">
                    Assign to Staff
                  </label>
                  <select
                    value={selectedRequest.assigned_to || ''}
                    onChange={(e) => assignStaff(selectedRequest.id, e.target.value)}
                    disabled={updatingId === selectedRequest.id}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
                  >
                    <option className="text-black" value="">
                      Unassigned
                    </option>
                    {staff.map((person) => (
                      <option className="text-black" key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-amber-200">
                      Priority
                    </label>
                    <select
                      value={priorityInput}
                      onChange={(e) => setPriorityInput(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
                    >
                      <option className="text-black" value="Low">Low</option>
                      <option className="text-black" value="Medium">Medium</option>
                      <option className="text-black" value="High">High</option>
                      <option className="text-black" value="Emergency">Emergency</option>
                    </select>

                    <button
                      onClick={() => updatePriority(selectedRequest.id, priorityInput)}
                      className="mt-3 w-full rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-600"
                    >
                      Save Priority
                    </button>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-amber-200">
                      Due Date / Schedule
                    </label>
                    <input
                      type="datetime-local"
                      value={dueDateInput}
                      onChange={(e) => setDueDateInput(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
                    />

                    <button
                      onClick={() => updateDueDate(selectedRequest.id, dueDateInput)}
                      className="mt-3 w-full rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-600"
                    >
                      Save Due Date
                    </button>
                  </div>
                </div>

                <div className="mb-5">
                  <label className="mb-2 block text-sm font-semibold text-amber-200">
                    Upload Attachment
                  </label>
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) uploadAttachment(selectedRequest.id, file)
                    }}
                    className="block w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-amber-400 file:px-4 file:py-2 file:font-semibold file:text-slate-900 hover:file:bg-amber-300"
                  />
                </div>

                <div className="mb-5">
                  <div className="mb-2 text-sm font-semibold text-amber-200">
                    Internal Notes
                  </div>

                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                    placeholder="Leave a note about the issue, resident, or work completed..."
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
                  />

                  <button
                    onClick={addNote}
                    className="mt-3 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-amber-300"
                  >
                    Add Note
                  </button>

                  <div className="mt-4 space-y-3">
                    {notesLoading ? (
                      <div className="rounded-2xl bg-black/20 px-4 py-3 text-sm text-slate-400">
                        Loading notes...
                      </div>
                    ) : notes.length === 0 ? (
                      <div className="rounded-2xl bg-black/20 px-4 py-3 text-sm text-slate-400">
                        No notes yet.
                      </div>
                    ) : (
                      notes.map((note) => (
                        <div key={note.id} className="rounded-2xl bg-black/20 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-amber-200">
                              {getAssignedName(selectedRequest.assigned_to)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatDate(note.created_at)}
                            </div>
                          </div>

                          <div className="mt-2 text-sm leading-6 text-slate-200">
                            {note.note}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mb-5">
                  <div className="mb-2 text-sm font-semibold text-amber-200">
                    Resident History
                  </div>

                  <div className="space-y-3">
                    {residentHistory.length === 0 ? (
                      <div className="rounded-2xl bg-black/20 px-4 py-3 text-sm text-slate-400">
                        No previous requests found for this resident.
                      </div>
                    ) : (
                      residentHistory.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setSelectedRequest(item)}
                          className="w-full rounded-2xl bg-black/20 px-4 py-3 text-left transition hover:bg-black/30"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-100">
                              {getTitle(item.description)}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(item.status)}`}>
                                {item.status || 'New'}
                              </span>
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${categoryBadge(item.category)}`}>
                                {item.category || 'Leave Unselected'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatDate(item.created_at)}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="mb-5">
                  <div className="mb-2 text-sm font-semibold text-amber-200">
                    Postpone Reason
                  </div>
                  <textarea
                    value={postponeReason}
                    onChange={(e) => setPostponeReason(e.target.value)}
                    rows={3}
                    placeholder="Add a reason if this request is postponed..."
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
                  />
                  {selectedRequest.postponed_reason && (
                    <p className="mt-2 text-sm text-slate-400">
                      Current reason: {selectedRequest.postponed_reason}
                    </p>
                  )}
                </div>

                <div>
                  <div className="mb-3 text-sm font-semibold text-amber-200">
                    Update Status
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <StatusButton
                      label="Mark New"
                      onClick={() => updateStatus(selectedRequest.id, 'New')}
                      disabled={updatingId === selectedRequest.id}
                      styles="bg-sky-500 text-white hover:bg-sky-600"
                    />
                    <StatusButton
                      label="In Progress"
                      onClick={() => updateStatus(selectedRequest.id, 'In Progress')}
                      disabled={updatingId === selectedRequest.id}
                      styles="bg-amber-400 text-slate-900 hover:bg-amber-300"
                    />
                    <StatusButton
                      label="Completed"
                      onClick={() => updateStatus(selectedRequest.id, 'Completed')}
                      disabled={updatingId === selectedRequest.id}
                      styles="bg-emerald-500 text-white hover:bg-emerald-600"
                    />
                    <StatusButton
                      label="Postponed"
                      onClick={() => updateStatus(selectedRequest.id, 'Postponed', postponeReason)}
                      disabled={updatingId === selectedRequest.id}
                      styles="bg-slate-500 text-white hover:bg-slate-400"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[500px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-center text-slate-400">
                Select a request to view full details, assign staff, schedule work, review resident history, and update status.
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-xl">
      <div className="text-sm font-medium text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
    </div>
  )
}

function InfoTile({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  return (
    <div className="rounded-2xl bg-black/20 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-200">{value || '—'}</div>
    </div>
  )
}

function GlassPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-slate-400 shadow-xl backdrop-blur-xl">
      {children}
    </div>
  )
}

function StatusButton({
  label,
  onClick,
  disabled,
  styles,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  styles: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {disabled ? 'Updating...' : label}
    </button>
  )
}