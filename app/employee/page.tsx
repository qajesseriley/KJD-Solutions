"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
};

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
};

type Member = {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  organizations?: Organization | Organization[] | null;
  profiles?: Profile | Profile[] | null;
};

type JoinRequest = {
  id: string;
  organization_id: string;
  user_id: string;
  status: string;
  created_at: string;
};

type RequestRow = {
  id: string;
  organization_id: string | null;
  resident_name: string | null;
  resident_phone: string | null;
  address: string | null;
  description: string | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
  assigned_to: string | null;
  notes?: string | null;
  postponed_reason: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  priority: string | null;
  due_date: string | null;
  category: string | null;
};

type NoteRow = {
  id: string;
  request_id: string;
  staff_id: string | null;
  note: string;
  created_at: string;
};

type StatusFilter = "All" | "New" | "In Progress" | "Completed" | "Postponed";
type PriorityFilter = "All" | "Low" | "Medium" | "High" | "Emergency";
type DueFilter = "All" | "Overdue" | "Today" | "This Week";

type TabKey = "requests" | "manager" | "qr";

function getOrganization(org?: Organization | Organization[] | null) {
  return Array.isArray(org) ? org[0] || null : org || null;
}

function getProfile(profile?: Profile | Profile[] | null) {
  return Array.isArray(profile) ? profile[0] || null : profile || null;
}

function memberName(member?: Member | null) {
  if (!member) return "Unknown";
  const profile = getProfile(member.profiles);
  return (
    member.full_name ||
    profile?.full_name ||
    member.email ||
    profile?.email ||
    member.user_id?.slice(0, 8) ||
    "Unknown"
  );
}

function memberEmail(member?: Member | null) {
  if (!member) return "No email";
  const profile = getProfile(member.profiles);
  return member.email || profile?.email || "No email";
}

export default function EmployeePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Member[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);

  const [currentUserId, setCurrentUserId] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [communityName, setCommunityName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("All");
  const [dueFilter, setDueFilter] = useState<DueFilter>("All");
  const [assignedFilter, setAssignedFilter] = useState("All");
  const [photoOnly, setPhotoOnly] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestRow | null>(null);
  const [postponeReason, setPostponeReason] = useState("");
  const [newNote, setNewNote] = useState("");
  const [dueDateInput, setDueDateInput] = useState("");
  const [priorityInput, setPriorityInput] = useState("Medium");
  const [activeTab, setActiveTab] = useState<TabKey>("requests");

  const activeMembership = useMemo(() => {
    return memberships.find((member) => member.organization_id === selectedOrganizationId) || null;
  }, [memberships, selectedOrganizationId]);

  const activeOrganization = getOrganization(activeMembership?.organizations);
  const orgName = communityName || activeOrganization?.name || "Community";
  const orgLogoUrl = activeOrganization?.logo_url || null;
  const userRole = activeMembership?.role || "Employee";
  const role = String(userRole || "").toLowerCase();
  const isOwner = role === "owner";
  const canManageWork = ["owner", "admin", "manager"].includes(role);

  const residentRequestLink = useMemo(() => {
    if (!selectedOrganizationId || typeof window === "undefined") return "";
    return `${window.location.origin}/?org=${selectedOrganizationId}`;
  }, [selectedOrganizationId]);

  const qrCodeUrl = useMemo(() => {
    if (!residentRequestLink) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
      residentRequestLink
    )}`;
  }, [residentRequestLink]);

  useEffect(() => {
    loadPortal();
  }, []);

  useEffect(() => {
    if (!selectedOrganizationId) return;

    loadOrganizationData(selectedOrganizationId, false);

    const requestChannel = supabase
      .channel(`employee-portal-requests-${selectedOrganizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "maintenance_requests",
          filter: `organization_id=eq.${selectedOrganizationId}`,
        },
        () => loadRequests(selectedOrganizationId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(requestChannel);
    };
  }, [selectedOrganizationId]);

  useEffect(() => {
    if (!selectedRequest) return;

    setPostponeReason(selectedRequest.postponed_reason || "");
    setDueDateInput(
      selectedRequest.due_date ? new Date(selectedRequest.due_date).toISOString().slice(0, 16) : ""
    );
    setPriorityInput(selectedRequest.priority || "Medium");
    fetchNotes(selectedRequest.id);

    const notesChannel = supabase
      .channel(`employee-portal-notes-${selectedRequest.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "request_notes" }, (payload) => {
        const row = payload.new as { request_id?: string } | null;
        if (row?.request_id === selectedRequest.id) fetchNotes(selectedRequest.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(notesChannel);
    };
  }, [selectedRequest?.id]);

  async function loadPortal() {
    setLoading(true);
    setMessage("");

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setMessage("You must be logged in to view the employee portal.");
      setLoading(false);
      return;
    }

    const userId = userData.user.id;
    setCurrentUserId(userId);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, email, phone, avatar_url")
      .eq("id", userId)
      .single();

    setProfile(profileData || null);

    const { data: membershipData, error: membershipError } = await supabase
      .from("organization_members")
      .select(
        `
        id,
        organization_id,
        user_id,
        role,
        created_at,
        organizations (
          id,
          name,
          logo_url
        )
      `
      )
      .eq("user_id", userId);

    if (membershipError) {
      setMessage(membershipError.message);
      setLoading(false);
      return;
    }

    const foundMemberships = (membershipData || []) as Member[];
    setMemberships(foundMemberships);

    if (foundMemberships.length === 0) {
      setLoading(false);
      return;
    }

    const orgId = selectedOrganizationId || foundMemberships[0].organization_id;
    setSelectedOrganizationId(orgId);
    await loadOrganizationData(orgId, true);
    setLoading(false);
  }

  async function loadOrganizationData(orgId: string, showLoading = false) {
    if (!orgId) return;
    if (showLoading) setLoading(true);

    await Promise.all([loadRequests(orgId), loadMembers(orgId), loadJoinRequests(orgId), loadOrgInfo(orgId)]);

    if (showLoading) setLoading(false);
  }

  async function loadOrgInfo(orgId: string) {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, logo_url")
      .eq("id", orgId)
      .single();

    if (data) {
      setCommunityName(data.name || "");
      setMemberships((previous) =>
        previous.map((member) =>
          member.organization_id === orgId
            ? { ...member, organizations: { id: orgId, name: data.name, logo_url: data.logo_url } }
            : member
        )
      );
    }
  }

  async function loadRequests(orgId = selectedOrganizationId) {
    if (!orgId) return;

    let query = supabase
      .from("maintenance_requests")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (!canManageWork && currentUserId) {
      query = query.eq("assigned_to", currentUserId);
    }

    const { data, error } = await query;

    if (error) {
      setMessage(error.message);
      setRequests([]);
      return;
    }

    const rows = ((data || []) as RequestRow[]).map((row) => ({
      ...row,
      status: row.status || "New",
      priority: row.priority || "Medium",
    }));

    setRequests((previousRows) => {
      if (previousRows.length > 0 && rows.length > previousRows.length) {
        const previousIds = new Set(previousRows.map((request) => request.id));
        const newest = rows.find((request) => !previousIds.has(request.id)) || rows[0];
        notifyNewRequest(getTitle(newest.description));
      }
      return rows;
    });

    setSelectedRequest((current) => {
      if (!current) return current;
      return rows.find((request) => request.id === current.id) || null;
    });
  }

  async function loadMembers(orgId = selectedOrganizationId) {
    if (!orgId) return;

    const rpcResult = await supabase.rpc("get_managed_org_members", { org_id: orgId });

    if (!rpcResult.error && rpcResult.data) {
      setMembers((rpcResult.data || []) as Member[]);
      return;
    }

    const { data, error } = await supabase
      .from("organization_members")
      .select(
        `
        id,
        organization_id,
        user_id,
        role,
        created_at,
        profiles (
          full_name,
          email,
          phone,
          avatar_url
        )
      `
      )
      .eq("organization_id", orgId);

    if (error) {
      setMembers([]);
      return;
    }

    setMembers((data || []) as Member[]);
  }

  async function loadJoinRequests(orgId = selectedOrganizationId) {
    if (!orgId || !isOwner) return;

    const { data, error } = await supabase
      .from("join_requests")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      setJoinRequests([]);
      return;
    }

    setJoinRequests((data || []) as JoinRequest[]);
  }

  function notifyNewRequest(title: string) {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    new Notification("New Maintenance Request", { body: title });
  }

  function getTitle(description: string | null) {
    if (!description) return "Untitled Request";
    return description.split("\n")[0] || "Untitled Request";
  }

  function getDetails(description: string | null) {
    if (!description) return "No additional details provided.";
    const parts = description.split("\n").filter(Boolean);
    if (parts.length <= 1) return description;
    return parts.slice(1).join("\n");
  }

  function getAssignedName(userId: string | null) {
    if (!userId) return "Unassigned";
    const found = members.find((person) => person.user_id === userId);
    return memberName(found) || userId;
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString();
  }

  function formatDueDate(dateString: string | null) {
    if (!dateString) return "No due date";
    return new Date(dateString).toLocaleString();
  }

  function isOverdue(dateString: string | null) {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  }

  const filteredRequests = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const endOfWeek = new Date();
    endOfWeek.setDate(now.getDate() + 7);
    endOfWeek.setHours(23, 59, 59, 999);

    return requests.filter((req) => {
      const statusMatches = statusFilter === "All" ? true : (req.status || "New") === statusFilter;
      const priorityMatches = priorityFilter === "All" ? true : (req.priority || "Medium") === priorityFilter;
      const assignedMatches =
        assignedFilter === "All"
          ? true
          : assignedFilter === "Unassigned"
            ? !req.assigned_to
            : req.assigned_to === assignedFilter;
      const photoMatches = photoOnly ? !!req.attachment_url : true;

      const due = req.due_date ? new Date(req.due_date) : null;
      const dueMatches =
        dueFilter === "All"
          ? true
          : dueFilter === "Overdue"
            ? !!due && due < now
            : dueFilter === "Today"
              ? !!due && due <= endOfToday && due >= startOfToday
              : dueFilter === "This Week"
                ? !!due && due <= endOfWeek && due >= new Date()
                : true;

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
        .join(" ")
        .toLowerCase();

      return statusMatches && priorityMatches && assignedMatches && photoMatches && dueMatches && text.includes(search.toLowerCase());
    });
  }, [requests, search, statusFilter, priorityFilter, assignedFilter, photoOnly, dueFilter, members]);

  const counts = useMemo(() => {
    return {
      total: requests.length,
      newCount: requests.filter((r) => (r.status || "New") === "New").length,
      inProgress: requests.filter((r) => r.status === "In Progress").length,
      completed: requests.filter((r) => r.status === "Completed").length,
      postponed: requests.filter((r) => r.status === "Postponed").length,
    };
  }, [requests]);

  const residentHistory = useMemo(() => {
    if (!selectedRequest) return [];

    return requests.filter((req) => {
      if (req.id === selectedRequest.id) return false;
      return req.resident_name && req.address && req.resident_name === selectedRequest.resident_name && req.address === selectedRequest.address;
    });
  }, [requests, selectedRequest]);

  async function updateRequest(id: string, updates: Partial<RequestRow>) {
    setUpdatingId(id);

    const { error } = await supabase
      .from("maintenance_requests")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Request updated.");
      await loadRequests();
    }

    setUpdatingId(null);
  }

  async function updateStatus(id: string, status: "New" | "In Progress" | "Completed" | "Postponed", reason?: string) {
    const payload: Partial<RequestRow> & Record<string, string | null> = {
      status,
      postponed_reason: status === "Postponed" ? reason || "" : null,
    };

    if (status === "In Progress") payload.started_at = new Date().toISOString();
    if (status === "Completed") payload.completed_at = new Date().toISOString();

    await updateRequest(id, payload as Partial<RequestRow>);
  }

  async function assignMember(requestId: string, userId: string) {
    await updateRequest(requestId, {
      assigned_to: userId || null,
      status: userId ? "In Progress" : "New",
    });
  }

  async function updatePriority(requestId: string, priority: string) {
    await updateRequest(requestId, { priority });
  }

  async function updateDueDate(requestId: string, dueDate: string) {
    await updateRequest(requestId, {
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
    });
  }

  async function uploadAttachment(requestId: string, file: File) {
    setUpdatingId(requestId);

    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${requestId}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage.from("request-attachments").upload(filePath, file, { upsert: true });

    if (uploadError) {
      setMessage(uploadError.message);
      setUpdatingId(null);
      return;
    }

    const { data } = supabase.storage.from("request-attachments").getPublicUrl(filePath);

    await updateRequest(requestId, {
      attachment_url: data.publicUrl,
      attachment_name: file.name,
    });

    setUpdatingId(null);
  }

  async function fetchNotes(requestId: string) {
    setNotesLoading(true);

    const { data, error } = await supabase
      .from("request_notes")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setNotes([]);
      setNotesLoading(false);
      return;
    }

    setNotes((data || []) as NoteRow[]);
    setNotesLoading(false);
  }

  async function addNote() {
    if (!selectedRequest || !newNote.trim()) return;

    const { error } = await supabase.from("request_notes").insert([
      {
        request_id: selectedRequest.id,
        staff_id: currentUserId || selectedRequest.assigned_to || null,
        note: newNote.trim(),
      },
    ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewNote("");
    await fetchNotes(selectedRequest.id);
  }

  async function updateCommunitySettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedOrganizationId) {
      setMessage("No community selected.");
      return;
    }

    if (!communityName.trim()) {
      setMessage("Community name cannot be blank.");
      return;
    }

    setSavingSettings(true);
    setMessage("");

    try {
      let logoUrl = orgLogoUrl;

      if (logoFile) {
        const safeFileName = logoFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `${selectedOrganizationId}/${Date.now()}-${safeFileName}`;

        const { error: uploadError } = await supabase.storage.from("organization-logos").upload(filePath, logoFile, {
          cacheControl: "3600",
          upsert: true,
        });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from("organization-logos").getPublicUrl(filePath);
        logoUrl = publicUrlData.publicUrl;
      }

      const { error: updateError } = await supabase
        .from("organizations")
        .update({
          name: communityName.trim(),
          search_name: communityName.trim().toLowerCase(),
          logo_url: logoUrl,
        })
        .eq("id", selectedOrganizationId);

      if (updateError) throw updateError;

      setLogoFile(null);
      setMessage("Community settings updated.");
      await loadPortal();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function removeMember(memberId: string) {
    const ok = confirm("Remove this member from the community?");
    if (!ok) return;

    const { error } = await supabase.rpc("remove_org_member", { member_id: memberId });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Member removed.");
    await loadMembers();
  }

  async function changeRole(memberId: string, newRole: string) {
    const { error } = await supabase.rpc("update_org_member_role", {
      member_id: memberId,
      new_role: newRole,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Role updated.");
    await loadMembers();
  }

  async function approveJoinRequest(id: string) {
    const { error } = await supabase.rpc("approve_join_request", { request_id: id });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Join request approved.");
    await Promise.all([loadJoinRequests(), loadMembers()]);
  }

  async function denyJoinRequest(id: string) {
    const { error } = await supabase.rpc("deny_join_request", { request_id: id });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Join request denied.");
    await loadJoinRequests();
  }

  async function copyResidentLink() {
    if (!residentRequestLink) return;
    await navigator.clipboard.writeText(residentRequestLink);
    setMessage("Resident request link copied.");
  }

  function printQrCode() {
    if (!qrCodeUrl || !residentRequestLink) return;

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      setMessage("Popup blocked. Please allow popups to print the QR code.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Resident Maintenance QR Code</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
            .card { max-width: 480px; margin: 0 auto; border: 2px solid #111827; border-radius: 20px; padding: 30px; }
            img { width: 260px; height: 260px; }
            p { word-break: break-all; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Need Maintenance?</h1>
            <p>Scan this QR code to submit a maintenance request.</p>
            <img src="${qrCodeUrl}" />
            <p>${residentRequestLink}</p>
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  function statusBadge(status: string | null) {
    switch (status) {
      case "Completed":
        return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
      case "In Progress":
        return "bg-amber-500/15 text-amber-300 border border-amber-500/30";
      case "Postponed":
        return "bg-slate-500/20 text-slate-200 border border-slate-400/30";
      default:
        return "bg-sky-500/15 text-sky-300 border border-sky-500/30";
    }
  }

  function priorityBadge(priority: string | null) {
    switch (priority) {
      case "Emergency":
        return "bg-red-500/20 text-red-300 border border-red-500/40";
      case "High":
        return "bg-orange-500/20 text-orange-300 border border-orange-500/40";
      case "Low":
        return "bg-slate-500/20 text-slate-200 border border-slate-400/30";
      default:
        return "bg-violet-500/20 text-violet-300 border border-violet-500/30";
    }
  }

  function categoryBadge(category: string | null) {
    switch (category) {
      case "Plumbing":
        return "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30";
      case "Electrical":
        return "bg-yellow-400/20 text-yellow-200 border border-yellow-400/30";
      case "HVAC":
        return "bg-sky-500/20 text-sky-300 border border-sky-500/30";
      case "Appliance":
        return "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30";
      case "Roofing":
        return "bg-stone-500/20 text-stone-200 border border-stone-400/30";
      case "Grounds / Exterior":
        return "bg-green-500/20 text-green-300 border border-green-500/30";
      case "Pest Control":
        return "bg-lime-500/20 text-lime-300 border border-lime-500/30";
      case "Safety Concern":
        return "bg-red-500/20 text-red-300 border border-red-500/40";
      case "General Maintenance":
        return "bg-slate-500/20 text-slate-200 border border-slate-400/30";
      default:
        return "bg-white/10 text-slate-200 border border-white/10";
    }
  }

  function priorityCardGlow(priority: string | null, dueDate: string | null) {
    if (isOverdue(dueDate)) return "shadow-[0_0_0_1px_rgba(239,68,68,0.3),0_0_35px_rgba(239,68,68,0.15)]";
    if (priority === "Emergency") return "shadow-[0_0_0_1px_rgba(239,68,68,0.35),0_0_35px_rgba(239,68,68,0.14)]";
    if (priority === "High") return "shadow-[0_0_0_1px_rgba(249,115,22,0.35),0_0_30px_rgba(249,115,22,0.12)]";
    return "shadow-xl";
  }

  function cardAccent(status: string | null, priority: string | null, dueDate: string | null) {
    if (isOverdue(dueDate) || priority === "Emergency") return "border-l-4 border-l-red-400";
    if (status === "Completed") return "border-l-4 border-l-emerald-400";
    if (status === "In Progress") return "border-l-4 border-l-amber-400";
    if (status === "Postponed") return "border-l-4 border-l-slate-400";
    return "border-l-4 border-l-sky-400";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <GlassPanel>Loading employee portal...</GlassPanel>
      </main>
    );
  }

  if (memberships.length === 0) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1e293b_0%,_#0f172a_45%,_#020617_100%)] text-white">
        <div className="flex min-h-screen items-center justify-center px-4 py-10">
          <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-amber-400/30 bg-amber-400/10 text-3xl font-bold text-amber-200">
              KJD
            </div>

            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              New Employee Account
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white">
              Welcome to KJD Solutions
            </h1>

            <p className="mx-auto mt-3 max-w-md text-slate-300">
              You are not connected to a community yet. Join an existing community
              or create a new one to continue.
            </p>

            {message && (
              <div className="mt-5 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                {message}
              </div>
            )}

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <a
                href="/find-community"
                className="rounded-2xl bg-sky-500 px-4 py-4 font-bold text-white shadow-lg transition hover:bg-sky-600"
              >
                Join Existing Community
              </a>

              <a
                href="/create-community"
                className="rounded-2xl bg-amber-400 px-4 py-4 font-bold text-slate-950 shadow-lg transition hover:bg-amber-300"
              >
                Create New Community
              </a>
            </div>

            <p className="mt-6 text-xs text-slate-500">
              After joining or creating a community, return to the employee portal.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1e293b_0%,_#0f172a_45%,_#020617_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="h-16 w-16 rounded-full border-2 border-sky-300 object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-sky-300 bg-sky-700 text-2xl font-bold">
                {(profile?.full_name || profile?.email || "E").charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Employee Portal</div>
              <h1 className="text-3xl font-bold tracking-tight text-white">{profile?.full_name || profile?.email || "Employee"}</h1>
              <p className="text-slate-300">
                {userRole} • {orgName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {orgLogoUrl ? (
              <img src={orgLogoUrl} alt={`${orgName} logo`} className="h-16 w-16 rounded-2xl border border-white/10 bg-black/20 object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-2xl font-bold text-amber-200">
                {orgName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </header>

        {message && <div className="mb-6 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{message}</div>}

        {memberships.length > 1 && (
          <GlassPanel className="mb-6">
            <label className="mb-2 block text-sm font-semibold text-amber-200">Switch Community</label>
            <select
              value={selectedOrganizationId}
              onChange={(e) => setSelectedOrganizationId(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
            >
              {memberships.map((member) => {
                const org = getOrganization(member.organizations);
                return (
                  <option className="text-black" key={member.organization_id} value={member.organization_id}>
                    {org?.name || "Unnamed Community"} — {member.role}
                  </option>
                );
              })}
            </select>
          </GlassPanel>
        )}

        <nav className="mb-6 flex flex-wrap gap-3">
          <TabButton active={activeTab === "requests"} onClick={() => setActiveTab("requests")}>Work Orders</TabButton>
          {canManageWork && <TabButton active={activeTab === "qr"} onClick={() => setActiveTab("qr")}>Resident Link / QR</TabButton>}
          {isOwner && <TabButton active={activeTab === "manager"} onClick={() => setActiveTab("manager")}>Owner Management</TabButton>}
        </nav>

        {activeTab === "requests" && (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryCard label="Total Requests" value={counts.total} />
              <SummaryCard label="New" value={counts.newCount} />
              <SummaryCard label="In Progress" value={counts.inProgress} />
              <SummaryCard label="Completed" value={counts.completed} />
              <SummaryCard label="Postponed" value={counts.postponed} />
            </div>

            <GlassPanel className="mb-6">
              <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white placeholder:text-slate-400 outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20 xl:col-span-2"
                />

                <FilterSelect value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} options={["All", "New", "In Progress", "Completed", "Postponed"]} label="Status" />
                <FilterSelect value={priorityFilter} onChange={(value) => setPriorityFilter(value as PriorityFilter)} options={["All", "Low", "Medium", "High", "Emergency"]} label="Priority" />

                <select
                  value={assignedFilter}
                  onChange={(e) => setAssignedFilter(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  <option className="text-black" value="All">All Assignments</option>
                  <option className="text-black" value="Unassigned">Unassigned</option>
                  {members.map((person) => (
                    <option className="text-black" key={person.user_id} value={person.user_id}>{memberName(person)}</option>
                  ))}
                </select>

                <FilterSelect value={dueFilter} onChange={(value) => setDueFilter(value as DueFilter)} options={["All", "Overdue", "Today", "This Week"]} label="Due Date" />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200">
                  <input type="checkbox" checked={photoOnly} onChange={(e) => setPhotoOnly(e.target.checked)} className="h-4 w-4" />
                  Has Photo Only
                </label>

                <button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("All");
                    setPriorityFilter("All");
                    setDueFilter("All");
                    setAssignedFilter("All");
                    setPhotoOnly(false);
                  }}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 font-medium text-slate-200 transition hover:bg-white/15"
                >
                  Clear Filters
                </button>
              </div>
            </GlassPanel>

            <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <section className="space-y-4">
                {filteredRequests.length === 0 ? (
                  <GlassPanel>No requests found.</GlassPanel>
                ) : (
                  filteredRequests.map((req) => {
                    const active = selectedRequest?.id === req.id;

                    return (
                      <div
                        key={req.id}
                        onClick={() => setSelectedRequest(req)}
                        className={`cursor-pointer rounded-3xl border bg-white/5 p-5 text-left backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/[0.07] ${
                          active ? "border-amber-300/40 ring-2 ring-amber-300/20" : "border-white/10"
                        } ${cardAccent(req.status, req.priority, req.due_date)} ${priorityCardGlow(req.priority, req.due_date)}`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex min-w-0 flex-1 gap-4">
                            {req.attachment_url ? (
                              <img src={req.attachment_url} alt={req.attachment_name || "Request image"} className="h-24 w-24 rounded-2xl border border-white/10 object-cover" />
                            ) : (
                              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-xs text-slate-500">No Photo</div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <h2 className="text-xl font-semibold text-white">{getTitle(req.description)}</h2>
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(req.status)}`}>{req.status || "New"}</span>
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${priorityBadge(req.priority)}`}>{req.priority || "Medium"}</span>
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${categoryBadge(req.category)}`}>{req.category || "Leave Unselected"}</span>
                                {isOverdue(req.due_date) && <span className="inline-flex rounded-full border border-red-500/40 bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-200">Overdue</span>}
                              </div>

                              <p className="text-sm text-slate-400">Submitted {formatDate(req.created_at)}</p>

                              <div className="mt-3 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                                <InfoTile label="Resident" value={req.resident_name} />
                                <InfoTile label="Address" value={req.address} />
                                <InfoTile label="Phone" value={req.resident_phone} />
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">Assigned: {getAssignedName(req.assigned_to)}</span>
                                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">Due: {formatDueDate(req.due_date)}</span>
                              </div>

                              <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-300">{getDetails(req.description)}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                            {(req.status || "New") === "New" && (
                              <button onClick={() => updateStatus(req.id, "In Progress")} className="rounded-2xl bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-300">Start</button>
                            )}
                            {(req.status || "New") !== "Completed" && (
                              <button onClick={() => updateStatus(req.id, "Completed")} className="rounded-2xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600">Complete</button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </section>

              <aside className="h-fit rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl xl:sticky xl:top-8">
                {selectedRequest ? (
                  <RequestDetails
                    selectedRequest={selectedRequest}
                    members={members}
                    notes={notes}
                    notesLoading={notesLoading}
                    updatingId={updatingId}
                    canManageWork={canManageWork}
                    postponeReason={postponeReason}
                    setPostponeReason={setPostponeReason}
                    newNote={newNote}
                    setNewNote={setNewNote}
                    dueDateInput={dueDateInput}
                    setDueDateInput={setDueDateInput}
                    priorityInput={priorityInput}
                    setPriorityInput={setPriorityInput}
                    getTitle={getTitle}
                    getDetails={getDetails}
                    getAssignedName={getAssignedName}
                    formatDate={formatDate}
                    formatDueDate={formatDueDate}
                    statusBadge={statusBadge}
                    priorityBadge={priorityBadge}
                    categoryBadge={categoryBadge}
                    updateStatus={updateStatus}
                    assignMember={assignMember}
                    updatePriority={updatePriority}
                    updateDueDate={updateDueDate}
                    uploadAttachment={uploadAttachment}
                    addNote={addNote}
                    residentHistory={residentHistory}
                  />
                ) : (
                  <div>
                    <h3 className="text-2xl font-bold text-white">Select a request</h3>
                    <p className="mt-2 text-sm text-slate-400">Click a work order to view details, notes, assignment, priority, due date, history, and attachments.</p>
                  </div>
                )}
              </aside>
            </div>
          </>
        )}

        {activeTab === "qr" && canManageWork && (
          <GlassPanel>
            <div className="mb-5">
              <h2 className="text-2xl font-bold">Resident Request Link / QR Code</h2>
              <p className="mt-1 text-slate-300">Use this link and QR code for residents to submit maintenance requests directly into this community.</p>
            </div>

            <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
              {qrCodeUrl && <img src={qrCodeUrl} alt="Resident request QR code" className="h-72 w-72 rounded-3xl border border-white/10 bg-white p-4" />}

              <div className="flex-1">
                <div className="mb-2 text-sm font-semibold text-amber-200">Resident Request Link</div>
                <p className="mb-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200 break-all">{residentRequestLink}</p>

                <div className="flex flex-wrap gap-3">
                  <button onClick={copyResidentLink} className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-600">Copy Link</button>
                  <button onClick={printQrCode} className="rounded-2xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-300">Print QR Code</button>
                  <a href={residentRequestLink} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15">Open Form</a>
                </div>
              </div>
            </div>
          </GlassPanel>
        )}

        {activeTab === "manager" && isOwner && (
          <div className="grid gap-6 lg:grid-cols-2">
            <GlassPanel>
              <h2 className="mb-4 text-2xl font-bold">Community Settings</h2>
              <form onSubmit={updateCommunitySettings}>
                <label className="mb-2 block text-sm font-semibold text-amber-200">Community Name</label>
                <input value={communityName} onChange={(e) => setCommunityName(e.target.value)} className="mb-4 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />

                <label className="mb-2 block text-sm font-semibold text-amber-200">Community Logo</label>
                <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="mb-4 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />

                {logoFile && <p className="mb-4 text-sm text-slate-400">Selected: {logoFile.name}</p>}

                <button type="submit" disabled={savingSettings} className="w-full rounded-2xl bg-sky-500 px-4 py-3 font-bold text-white hover:bg-sky-600 disabled:opacity-60">
                  {savingSettings ? "Saving..." : "Save Community Settings"}
                </button>
              </form>
            </GlassPanel>

            <GlassPanel>
              <h2 className="mb-4 text-2xl font-bold">Join Requests</h2>
              {joinRequests.length === 0 ? (
                <p className="text-slate-400">No join requests.</p>
              ) : (
                <div className="grid gap-3">
                  {joinRequests.map((request) => (
                    <div key={request.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-semibold">User: {request.user_id.slice(0, 8)}</div>
                        <div className="text-sm text-slate-400">Status: {request.status}</div>
                      </div>

                      {request.status === "pending" && (
                        <div className="flex gap-2">
                          <button onClick={() => approveJoinRequest(request.id)} className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600">Approve</button>
                          <button onClick={() => denyJoinRequest(request.id)} className="rounded-xl bg-rose-500 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-600">Deny</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </GlassPanel>

            <GlassPanel className="lg:col-span-2">
              <h2 className="mb-4 text-2xl font-bold">Members</h2>
              {members.length === 0 ? (
                <p className="text-slate-400">No members found.</p>
              ) : (
                <div className="grid gap-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <MemberAvatar member={member} />
                        <div>
                          <div className="font-semibold">{memberName(member)}</div>
                          <div className="text-sm text-slate-400">{memberEmail(member)} • {member.role}</div>
                        </div>
                      </div>

                      {String(member.role).toLowerCase() !== "owner" ? (
                        <div className="flex flex-wrap gap-2">
                          <select value={member.role} onChange={(e) => changeRole(member.id, e.target.value)} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none">
                            <option className="text-black" value="admin">Admin</option>
                            <option className="text-black" value="manager">Manager</option>
                            <option className="text-black" value="employee">Employee</option>
                          </select>

                          <button onClick={() => removeMember(member.id)} className="rounded-xl bg-rose-500 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-600">Remove</button>
                        </div>
                      ) : (
                        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">Owner protected</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </GlassPanel>
          </div>
        )}
      </div>
    </main>
  );
}

function RequestDetails(props: {
  selectedRequest: RequestRow;
  members: Member[];
  notes: NoteRow[];
  notesLoading: boolean;
  updatingId: string | null;
  canManageWork: boolean;
  postponeReason: string;
  setPostponeReason: (value: string) => void;
  newNote: string;
  setNewNote: (value: string) => void;
  dueDateInput: string;
  setDueDateInput: (value: string) => void;
  priorityInput: string;
  setPriorityInput: (value: string) => void;
  getTitle: (description: string | null) => string;
  getDetails: (description: string | null) => string;
  getAssignedName: (userId: string | null) => string;
  formatDate: (dateString: string | null) => string;
  formatDueDate: (dateString: string | null) => string;
  statusBadge: (status: string | null) => string;
  priorityBadge: (priority: string | null) => string;
  categoryBadge: (category: string | null) => string;
  updateStatus: (id: string, status: "New" | "In Progress" | "Completed" | "Postponed", reason?: string) => Promise<void>;
  assignMember: (requestId: string, userId: string) => Promise<void>;
  updatePriority: (requestId: string, priority: string) => Promise<void>;
  updateDueDate: (requestId: string, dueDate: string) => Promise<void>;
  uploadAttachment: (requestId: string, file: File) => Promise<void>;
  addNote: () => Promise<void>;
  residentHistory: RequestRow[];
}) {
  const r = props.selectedRequest;

  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold text-white">{props.getTitle(r.description)}</h3>
          <p className="mt-1 text-sm text-slate-400">Submitted {props.formatDate(r.created_at)}</p>
          <p className="mt-1 text-sm text-slate-500">Last updated {props.formatDate(r.updated_at)}</p>
        </div>

        <div className="flex flex-col gap-2">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${props.statusBadge(r.status)}`}>{r.status || "New"}</span>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${props.priorityBadge(r.priority)}`}>{r.priority || "Medium"}</span>
        </div>
      </div>

      <div className="mb-5 grid gap-3">
        <InfoTile label="Resident" value={r.resident_name} />
        <InfoTile label="Address" value={r.address} />
        <InfoTile label="Phone" value={r.resident_phone} />
        <InfoTile label="Assigned" value={props.getAssignedName(r.assigned_to)} />
        <InfoTile label="Due Date" value={props.formatDueDate(r.due_date)} />
        <div className="rounded-2xl bg-black/20 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</div>
          <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${props.categoryBadge(r.category)}`}>{r.category || "Leave Unselected"}</span>
        </div>
      </div>

      <div className="mb-5 rounded-2xl bg-black/20 p-4">
        <div className="mb-2 text-sm font-semibold text-amber-200">Details</div>
        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{props.getDetails(r.description)}</p>
      </div>

      {r.attachment_url && (
        <div className="mb-5 rounded-2xl bg-black/20 p-4">
          <div className="mb-3 text-sm font-semibold text-amber-200">Resident Photo</div>
          <img src={r.attachment_url} alt={r.attachment_name || "Resident uploaded photo"} className="w-full rounded-2xl border border-white/10 object-cover" />
          <a href={r.attachment_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-amber-200 underline">Open full image</a>
        </div>
      )}

      <div className="mb-5 grid gap-4">
        {props.canManageWork && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-amber-200">Assign to Staff</label>
            <select value={r.assigned_to || ""} onChange={(e) => props.assignMember(r.id, e.target.value)} disabled={props.updatingId === r.id} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none">
              <option className="text-black" value="">Unassigned</option>
              {props.members.map((person) => (
                <option className="text-black" key={person.user_id} value={person.user_id}>{memberName(person)}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-semibold text-amber-200">Status</label>
          <div className="grid grid-cols-2 gap-2">
            {(["New", "In Progress", "Completed"] as const).map((status) => (
              <button key={status} onClick={() => props.updateStatus(r.id, status)} disabled={props.updatingId === r.id} className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60">{status}</button>
            ))}
            <button onClick={() => props.updateStatus(r.id, "Postponed", props.postponeReason)} disabled={props.updatingId === r.id} className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60">Postpone</button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-amber-200">Postpone Reason</label>
          <textarea value={props.postponeReason} onChange={(e) => props.setPostponeReason(e.target.value)} className="min-h-20 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Why is this postponed?" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-amber-200">Priority</label>
            <select value={props.priorityInput} onChange={(e) => props.setPriorityInput(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none">
              {['Low', 'Medium', 'High', 'Emergency'].map((item) => <option className="text-black" key={item} value={item}>{item}</option>)}
            </select>
            <button onClick={() => props.updatePriority(r.id, props.priorityInput)} className="mt-2 w-full rounded-2xl bg-violet-500 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-600">Save Priority</button>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-amber-200">Due Date</label>
            <input type="datetime-local" value={props.dueDateInput} onChange={(e) => props.setDueDateInput(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
            <button onClick={() => props.updateDueDate(r.id, props.dueDateInput)} className="mt-2 w-full rounded-2xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-600">Save Due Date</button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-amber-200">Upload / Replace Attachment</label>
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && props.uploadAttachment(r.id, e.target.files[0])} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
        </div>
      </div>

      <div className="mb-5 rounded-2xl bg-black/20 p-4">
        <div className="mb-3 text-sm font-semibold text-amber-200">Internal Notes</div>
        <textarea value={props.newNote} onChange={(e) => props.setNewNote(e.target.value)} className="mb-3 min-h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Add an internal note..." />
        <button onClick={props.addNote} className="mb-4 rounded-2xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300">Add Note</button>

        {props.notesLoading ? (
          <p className="text-sm text-slate-400">Loading notes...</p>
        ) : props.notes.length === 0 ? (
          <p className="text-sm text-slate-400">No notes yet.</p>
        ) : (
          <div className="grid gap-3">
            {props.notes.map((note) => (
              <div key={note.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="whitespace-pre-wrap text-sm text-slate-200">{note.note}</p>
                <p className="mt-2 text-xs text-slate-500">{props.formatDate(note.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-black/20 p-4">
        <div className="mb-3 text-sm font-semibold text-amber-200">Resident History</div>
        {props.residentHistory.length === 0 ? (
          <p className="text-sm text-slate-400">No previous requests for this resident/address.</p>
        ) : (
          <div className="grid gap-2">
            {props.residentHistory.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                <div className="font-semibold text-white">{props.getTitle(item.description)}</div>
                <div>{item.status || "New"} • {props.formatDate(item.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{label}</div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl bg-black/20 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm text-slate-200">{value || "—"}</div>
    </div>
  );
}

function GlassPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl ${className}`}>{children}</section>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
        active ? "bg-amber-400 text-slate-950" : "border border-white/10 bg-white/10 text-white hover:bg-white/15"
      }`}
    >
      {children}
    </button>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[]; label: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none">
      {options.map((option) => (
        <option className="text-black" key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}

function MemberAvatar({ member }: { member: Member }) {
  const profile = getProfile(member.profiles);
  const avatar = member.avatar_url || profile?.avatar_url;
  const name = memberName(member);

  if (avatar) {
    return <img src={avatar} alt="Profile" className="h-12 w-12 rounded-full border border-sky-300 object-cover" />;
  }

  return <div className="flex h-12 w-12 items-center justify-center rounded-full border border-sky-300 bg-slate-950 font-bold">{name.charAt(0).toUpperCase()}</div>;
}
