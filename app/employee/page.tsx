"use client";

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
  full_name?: string | null;
  email?: string | null;
  organizations?: Organization | Organization[] | null;
  profiles?: Profile | Profile[] | null;
};

type MaintenanceRequest = {
  id: string;
  organization_id: string;
  resident_name: string;
  resident_phone: string;
  address: string;
  description: string;
  status: string;
  created_at: string;
  assigned_to?: string | null;
  notes?: string | null;
  attachment_url?: string | null;
  category?: string | null;
};

const STATUS_OPTIONS = ["All", "New", "In Progress", "Completed"];

function getOrganization(org?: Organization | Organization[] | null) {
  return Array.isArray(org) ? org[0] || null : org || null;
}

function getProfile(profile?: Profile | Profile[] | null) {
  return Array.isArray(profile) ? profile[0] || null : profile || null;
}

export default function EmployeePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Member[]>([]);
  const [staffMembers, setStaffMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<MaintenanceRequest[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadEmployeeData();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel("employee-dashboard-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "maintenance_requests",
        },
        () => {
          loadEmployeeData(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (selectedOrganizationId) {
      loadOrganizationTasks(selectedOrganizationId);
      loadStaffMembers(selectedOrganizationId);
    }
  }, [selectedOrganizationId]);

  const activeMembership = useMemo(() => {
    return memberships.find(
      (member) => member.organization_id === selectedOrganizationId
    );
  }, [memberships, selectedOrganizationId]);

  const activeOrganization = getOrganization(activeMembership?.organizations);
  const userRole = activeMembership?.role || "Employee";

  const isOwnerOrAdmin = useMemo(() => {
    const role = String(userRole || "").toLowerCase();
    return role === "owner" || role === "admin";
  }, [userRole]);

  const residentRequestLink = useMemo(() => {
    if (!selectedOrganizationId) return "";
    if (typeof window === "undefined") return "";

    return `${window.location.origin}/?organization_id=${selectedOrganizationId}`;
  }, [selectedOrganizationId]);

  const qrCodeUrl = useMemo(() => {
    if (!residentRequestLink) return "";

    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
      residentRequestLink
    )}`;
  }, [residentRequestLink]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesStatus =
        statusFilter === "All" || task.status === statusFilter;

      const search = searchText.trim().toLowerCase();

      const matchesSearch =
        !search ||
        task.resident_name?.toLowerCase().includes(search) ||
        task.address?.toLowerCase().includes(search) ||
        task.description?.toLowerCase().includes(search) ||
        task.resident_phone?.toLowerCase().includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [tasks, statusFilter, searchText]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      new: tasks.filter((task) => task.status === "New").length,
      inProgress: tasks.filter((task) => task.status === "In Progress").length,
      completed: tasks.filter((task) => task.status === "Completed").length,
    };
  }, [tasks]);

  async function loadEmployeeData(showLoading = true) {
    if (showLoading) setLoading(true);
    setMessage("");

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setMessage("You must be logged in to view this page.");
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
      setMessage("You are not currently connected to a community.");
      setLoading(false);
      return;
    }

    const organizationToUse =
      selectedOrganizationId || foundMemberships[0].organization_id;

    setSelectedOrganizationId(organizationToUse);

    await loadOrganizationTasks(organizationToUse, userId, foundMemberships);
    await loadStaffMembers(organizationToUse);

    setLoading(false);
  }

  async function loadOrganizationTasks(
    organizationId: string,
    userId = currentUserId,
    memberList = memberships
  ) {
    if (!organizationId) return;

    const member = memberList.find(
      (item) => item.organization_id === organizationId
    );

    const role = String(member?.role || "").toLowerCase();
    const ownerAccess = role === "owner" || role === "admin";

    let query = supabase
      .from("maintenance_requests")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (!ownerAccess) {
      query = query.eq("assigned_to", userId);
    }

    const { data, error } = await query;

    if (error) {
      setMessage(error.message);
      return;
    }

    setTasks(data || []);
  }

  async function loadStaffMembers(organizationId: string) {
    if (!organizationId) return;

    const { data, error } = await supabase
      .from("organization_members")
      .select(
        `
        id,
        organization_id,
        user_id,
        role,
        profiles (
          full_name,
          email,
          phone,
          avatar_url
        )
      `
      )
      .eq("organization_id", organizationId);

    if (error) return;

    setStaffMembers((data || []) as Member[]);
  }

  async function updateMaintenanceRequest(
    id: string,
    updates: Partial<MaintenanceRequest>
  ) {
    const { error } = await supabase
      .from("maintenance_requests")
      .update(updates)
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Task updated.");
    loadEmployeeData(false);
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
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 40px;
            }
            .card {
              max-width: 480px;
              margin: 0 auto;
              border: 2px solid #111827;
              border-radius: 20px;
              padding: 30px;
            }
            img {
              width: 260px;
              height: 260px;
            }
            p {
              word-break: break-all;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Need Maintenance?</h1>
            <p>Scan this QR code to submit a maintenance request.</p>
            <img src="${qrCodeUrl}" />
            <p>${residentRequestLink}</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  function getStatusStyle(status: string): React.CSSProperties {
    if (status === "Completed") {
      return { ...badgeStyle, background: "#14532d", color: "#bbf7d0" };
    }

    if (status === "In Progress") {
      return { ...badgeStyle, background: "#1e3a8a", color: "#bfdbfe" };
    }

    return { ...badgeStyle, background: "#78350f", color: "#fde68a" };
  }

  function getAssignedName(userId?: string | null) {
    if (!userId) return "Unassigned";

    const found = staffMembers.find((member) => member.user_id === userId);
    const foundProfile = getProfile(found?.profiles);

    return (
      foundProfile?.full_name ||
      foundProfile?.email ||
      found?.full_name ||
      found?.email ||
      "Assigned"
    );
  }

  return (
    <main style={pageStyle}>
      <section style={containerStyle}>
        <header style={headerStyle}>
          <div style={profileBlockStyle}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" style={avatarStyle} />
            ) : (
              <div style={avatarFallbackStyle}>
                {(profile?.full_name || profile?.email || "E")
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}

            <div>
              <h1 style={{ margin: 0 }}>
                {profile?.full_name || profile?.email || "Employee Dashboard"}
              </h1>
              <p style={mutedTextStyle}>
                {userRole} {activeOrganization ? `• ${activeOrganization.name}` : ""}
              </p>
            </div>
          </div>

          {activeOrganization?.logo_url && (
            <img
              src={activeOrganization.logo_url}
              alt={activeOrganization.name}
              style={orgLogoStyle}
            />
          )}
        </header>

        {message && <div style={messageStyle}>{message}</div>}

        {memberships.length > 1 && (
          <section style={panelStyle}>
            <label style={labelStyle}>Switch Community</label>
            <select
              value={selectedOrganizationId}
              onChange={(e) => setSelectedOrganizationId(e.target.value)}
              style={selectStyle}
            >
              {memberships.map((member) => {
                const org = getOrganization(member.organizations);

                return (
                  <option
                    key={member.organization_id}
                    value={member.organization_id}
                  >
                    {org?.name || "Unnamed Community"} — {member.role}
                  </option>
                );
              })}
            </select>
          </section>
        )}

        <section style={statsGridStyle}>
          <div style={statCardStyle}>
            <span style={statNumberStyle}>{stats.total}</span>
            <span style={mutedTextStyle}>Total Requests</span>
          </div>

          <div style={statCardStyle}>
            <span style={statNumberStyle}>{stats.new}</span>
            <span style={mutedTextStyle}>New</span>
          </div>

          <div style={statCardStyle}>
            <span style={statNumberStyle}>{stats.inProgress}</span>
            <span style={mutedTextStyle}>In Progress</span>
          </div>

          <div style={statCardStyle}>
            <span style={statNumberStyle}>{stats.completed}</span>
            <span style={mutedTextStyle}>Completed</span>
          </div>
        </section>

        {isOwnerOrAdmin && (
          <section style={ownerToolsStyle}>
            <div style={sectionTitleRowStyle}>
              <div>
                <h2 style={{ margin: 0 }}>Owner Tools</h2>
                <p style={mutedTextStyle}>
                  Generate resident request links, QR codes, and manage assignments.
                </p>
              </div>
            </div>

            <div style={qrPanelStyle}>
              <img src={qrCodeUrl} alt="Resident request QR code" style={qrStyle} />

              <div style={{ flex: 1 }}>
                <strong>Resident Request Link</strong>
                <p style={linkBoxStyle}>{residentRequestLink}</p>

                <div style={buttonRowStyle}>
                  <button onClick={copyResidentLink} style={buttonStyle}>
                    Copy Link
                  </button>

                  <button onClick={printQrCode} style={secondaryButtonStyle}>
                    Print QR Code
                  </button>

                  <a
                    href={residentRequestLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={buttonStyle}
                  >
                    Open Form
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        <section style={panelStyle}>
          <div style={sectionTitleRowStyle}>
            <div>
              <h2 style={{ margin: 0 }}>
                {isOwnerOrAdmin ? "Community Requests" : "My Assigned Tasks"}
              </h2>
              <p style={mutedTextStyle}>
                {isOwnerOrAdmin
                  ? "View, filter, assign, and update all requests for this community."
                  : "View and update requests assigned to you."}
              </p>
            </div>
          </div>

          <div style={filtersStyle}>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search resident, address, phone, or request..."
              style={inputStyle}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={selectStyle}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p>Loading tasks...</p>
          ) : filteredTasks.length === 0 ? (
            <p>No matching requests.</p>
          ) : (
            filteredTasks.map((task) => (
              <div key={task.id} style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <div style={taskHeaderStyle}>
                    <div>
                      <strong>{task.resident_name}</strong>
                      <p style={mutedTextStyle}>{task.address}</p>
                    </div>

                    <span style={getStatusStyle(task.status || "New")}>
                      {task.status || "New"}
                    </span>
                  </div>

                  <p>{task.description}</p>

                  <div style={miniInfoGridStyle}>
                    <span>
                      <strong>Phone:</strong> {task.resident_phone || "N/A"}
                    </span>

                    <span>
                      <strong>Assigned:</strong> {getAssignedName(task.assigned_to)}
                    </span>

                    {task.category && (
                      <span>
                        <strong>Category:</strong> {task.category}
                      </span>
                    )}
                  </div>

                  <div>
                    <strong>Notes</strong>
                    <textarea
                      defaultValue={task.notes || ""}
                      onBlur={(e) =>
                        updateMaintenanceRequest(task.id, {
                          notes: e.target.value,
                        })
                      }
                      style={notesBoxStyle}
                    />
                  </div>
                </div>

                <div style={controlsStyle}>
                  <label style={smallLabelStyle}>Status</label>
                  <select
                    value={task.status || "New"}
                    onChange={(e) =>
                      updateMaintenanceRequest(task.id, {
                        status: e.target.value,
                      })
                    }
                    style={selectStyle}
                  >
                    <option value="New">New</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>

                  {isOwnerOrAdmin && (
                    <>
                      <label style={smallLabelStyle}>Assign To</label>
                      <select
                        value={task.assigned_to || ""}
                        onChange={(e) =>
                          updateMaintenanceRequest(task.id, {
                            assigned_to: e.target.value || null,
                          })
                        }
                        style={selectStyle}
                      >
                        <option value="">Unassigned</option>
                        {staffMembers.map((member) => {
                          const staffProfile = getProfile(member.profiles);

                          return (
                            <option key={member.user_id} value={member.user_id}>
                              {staffProfile?.full_name ||
                                staffProfile?.email ||
                                member.role}
                            </option>
                          );
                        })}
                      </select>
                    </>
                  )}

                  {task.attachment_url && (
                    <a
                      href={task.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={buttonStyle}
                    >
                      View Photo
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 20,
  color: "white",
  background:
    "radial-gradient(circle at top left, #1e3a8a 0, #070b14 34%, #020617 100%)",
  minHeight: "100vh",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
};

const headerStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid #334155",
  borderRadius: 18,
  padding: 18,
  marginBottom: 18,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 18,
};

const profileBlockStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const avatarStyle: React.CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid #38bdf8",
};

const avatarFallbackStyle: React.CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: "50%",
  background: "#0284c7",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: 24,
};

const orgLogoStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 14,
  objectFit: "cover",
  background: "#020617",
};

const panelStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.92)",
  padding: 18,
  borderRadius: 18,
  marginBottom: 18,
  border: "1px solid #334155",
};

const ownerToolsStyle: React.CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(14, 116, 144, .35), rgba(15, 23, 42, .95))",
  padding: 18,
  borderRadius: 18,
  marginBottom: 18,
  border: "1px solid #38bdf8",
};

const sectionTitleRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 14,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const statCardStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid #334155",
  borderRadius: 16,
  padding: 16,
};

const statNumberStyle: React.CSSProperties = {
  display: "block",
  fontSize: 28,
  fontWeight: "bold",
};

const qrPanelStyle: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  gap: 18,
  alignItems: "center",
  flexWrap: "wrap",
};

const qrStyle: React.CSSProperties = {
  width: 180,
  height: 180,
  background: "white",
  padding: 10,
  borderRadius: 12,
};

const linkBoxStyle: React.CSSProperties = {
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: 10,
  padding: 12,
  color: "#bfdbfe",
  wordBreak: "break-all",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const filtersStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 180px",
  gap: 12,
  marginBottom: 16,
};

const inputStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  background: "#020617",
  color: "white",
  border: "1px solid #334155",
};

const rowStyle: React.CSSProperties = {
  background: "#111827",
  padding: 15,
  marginBottom: 12,
  borderRadius: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  border: "1px solid #1f2937",
};

const taskHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const miniInfoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 8,
  color: "#cbd5e1",
  marginBottom: 12,
  fontSize: 13,
};

const controlsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minWidth: 190,
};

const selectStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  background: "#020617",
  color: "white",
  border: "1px solid #334155",
};

const notesBoxStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 80,
  marginTop: 6,
  padding: 10,
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#020617",
  color: "white",
};

const messageStyle: React.CSSProperties = {
  background: "#111827",
  padding: 12,
  borderRadius: 10,
  marginBottom: 15,
  border: "1px solid #374151",
};

const buttonStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  background: "#0284c7",
  color: "white",
  textDecoration: "none",
  textAlign: "center",
  fontWeight: "bold",
  border: "none",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  background: "#334155",
  color: "white",
  textDecoration: "none",
  textAlign: "center",
  fontWeight: "bold",
  border: "none",
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontWeight: "bold",
};

const smallLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#9ca3af",
};

const mutedTextStyle: React.CSSProperties = {
  color: "#9ca3af",
  margin: "4px 0",
};

const badgeStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: "bold",
  whiteSpace: "nowrap",
};