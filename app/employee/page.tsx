"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Profile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
};

type Member = {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  organizations?: {
    id: string;
    name: string;
    logo_url: string | null;
  };
};

type JoinRequest = {
  id: string;
  organization_id: string;
  user_id: string;
  status: string;
  organizations?: {
    id: string;
    name: string;
    logo_url: string | null;
  };
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
};

export default function EmployeePage() {
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [selectedOwnerOrgId, setSelectedOwnerOrgId] = useState("");

  const [ownerMembers, setOwnerMembers] = useState<Member[]>([]);
  const [ownerJoinRequests, setOwnerJoinRequests] = useState<JoinRequest[]>([]);
  const [ownerMaintenanceRequests, setOwnerMaintenanceRequests] = useState<MaintenanceRequest[]>([]);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [ownerLoading, setOwnerLoading] = useState(false);

  useEffect(() => {
    loadEmployeeData();
  }, []);

  useEffect(() => {
    if (selectedOwnerOrgId) {
      loadOwnerControls(selectedOwnerOrgId);
    }
  }, [selectedOwnerOrgId]);

  async function loadEmployeeData() {
    setLoading(true);
    setMessage("");

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setUserLoggedIn(false);
      setMessage("You must be logged in to view this page.");
      setLoading(false);
      return;
    }

    setUserLoggedIn(true);
    const userId = userData.user.id;

    const profileResult = await supabase
      .from("profiles")
      .select("full_name, email, phone, avatar_url")
      .eq("id", userId)
      .single();

    if (!profileResult.error) {
      setProfile(profileResult.data);
    }

    const membershipsResult = await supabase
      .from("organization_members")
      .select(`
        id,
        organization_id,
        user_id,
        role,
        organizations (
          id,
          name,
          logo_url
        )
      `)
      .eq("user_id", userId);

    const joinRequestsResult = await supabase
      .from("join_requests")
      .select(`
        id,
        organization_id,
        user_id,
        status,
        organizations (
          id,
          name,
          logo_url
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (membershipsResult.error) {
      setMessage(membershipsResult.error.message);
    }

    if (joinRequestsResult.error) {
      setMessage(joinRequestsResult.error.message);
    }

    setMemberships((membershipsResult.data || []) as unknown as Member[]);
    setJoinRequests((joinRequestsResult.data || []) as unknown as JoinRequest[]);
    setLoading(false);
  }

  async function loadOwnerControls(orgId: string) {
    setOwnerLoading(true);
    setMessage("");

    const membersResult = await supabase
      .from("organization_members")
      .select(`
        id,
        organization_id,
        user_id,
        role,
        organizations (
          id,
          name,
          logo_url
        )
      `)
      .eq("organization_id", orgId);

    const joinRequestsResult = await supabase
      .from("join_requests")
      .select(`
        id,
        organization_id,
        user_id,
        status,
        organizations (
          id,
          name,
          logo_url
        )
      `)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    const maintenanceRequestsResult = await supabase
      .from("maintenance_requests")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (membersResult.error) setMessage(membersResult.error.message);
    if (joinRequestsResult.error) setMessage(joinRequestsResult.error.message);
    if (maintenanceRequestsResult.error) setMessage(maintenanceRequestsResult.error.message);

    setOwnerMembers((membersResult.data || []) as unknown as Member[]);
    setOwnerJoinRequests((joinRequestsResult.data || []) as unknown as JoinRequest[]);
    setOwnerMaintenanceRequests((maintenanceRequestsResult.data || []) as MaintenanceRequest[]);
    setOwnerLoading(false);
  }

  async function approveJoinRequest(id: string) {
    const { error } = await supabase.rpc("approve_join_request", {
      request_id: id,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Join request approved.");
    loadEmployeeData();

    if (selectedOwnerOrgId) {
      loadOwnerControls(selectedOwnerOrgId);
    }
  }

  async function denyJoinRequest(id: string) {
    const { error } = await supabase.rpc("deny_join_request", {
      request_id: id,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Join request denied.");
    loadEmployeeData();

    if (selectedOwnerOrgId) {
      loadOwnerControls(selectedOwnerOrgId);
    }
  }

  async function updateMaintenanceRequest(
    requestId: string,
    updates: Partial<MaintenanceRequest>
  ) {
    const { error } = await supabase
      .from("maintenance_requests")
      .update(updates)
      .eq("id", requestId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Maintenance request updated.");

    if (selectedOwnerOrgId) {
      loadOwnerControls(selectedOwnerOrgId);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const highestRole = getHighestRole(memberships);
  const displayName = profile?.full_name || profile?.email || "Employee";

  const selectedOwnerMembership = memberships.find(
    (member) => member.organization_id === selectedOwnerOrgId
  );

  return (
    <main style={pageStyle}>
      <section style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar profile={profile} />

            <div>
              <h1 style={{ fontSize: 34, marginBottom: 4 }}>
                Welcome, {displayName}
              </h1>

              <p style={{ color: "#9ca3af", margin: 0, fontSize: 14 }}>
                {highestRole ? titleCase(highestRole) : "No active community role"}
              </p>
            </div>
          </div>

          {userLoggedIn ? (
            <button onClick={signOut} style={topButtonStyle}>
              Sign Out
            </button>
          ) : (
            <Link href="/login" style={loginButtonStyle}>
              Go to Login
            </Link>
          )}
        </header>

        {message && <div style={messageStyle}>{message}</div>}

        {loading ? (
          <Panel title="Loading">
            <p style={{ color: "#9ca3af" }}>Loading your account...</p>
          </Panel>
        ) : !userLoggedIn ? (
          <Panel title="Login Required">
            <p style={{ color: "#9ca3af" }}>
              Please log in or create an account before continuing.
            </p>

            <Link href="/login" style={fullButtonStyle}>
              Go to Login
            </Link>
          </Panel>
        ) : (
          <>
            <section style={choiceGridStyle}>
              <ActionCard
                title="Create Managerial Account"
                description="Create a new community or organization and become the owner/admin for that workspace."
                buttonText="Create Community"
                href="/create-community"
                color="#0284c7"
              />

              <ActionCard
                title="Join Existing Community"
                description="Search for your organization and request to join the team as an employee."
                buttonText="Find / Join Community"
                href="/find-community"
                color="#16a34a"
              />
            </section>

            <div style={statsGridStyle}>
              <StatCard title="Approved Communities" value={memberships.length} />
              <StatCard
                title="Pending Requests"
                value={joinRequests.filter((r) => r.status === "pending").length}
              />
              <StatCard
                title="Denied Requests"
                value={joinRequests.filter((r) => r.status === "denied").length}
              />
            </div>

            {selectedOwnerMembership && (
              <Panel
                title={`Owner Controls: ${
                  selectedOwnerMembership.organizations?.name || "Community"
                }`}
              >
                <p style={{ color: "#9ca3af", marginTop: 0 }}>
                  Owner/admin tools for this community now live here inside the
                  employee page.
                </p>

                <div style={rowStyle}>
                  <div>
                    <strong>Community ID</strong>
                    <br />
                    <span style={{ color: "#9ca3af" }}>
                      {selectedOwnerMembership.organization_id}
                    </span>
                  </div>
                </div>

                {ownerLoading ? (
                  <p style={{ color: "#9ca3af" }}>Loading owner controls...</p>
                ) : (
                  <>
                    <div style={ownerGridStyle}>
                      <section style={miniPanelStyle}>
                        <h3 style={{ marginTop: 0 }}>Employees</h3>

                        {ownerMembers.length === 0 ? (
                          <Empty text="No employees in this community yet." />
                        ) : (
                          ownerMembers.map((member) => (
                            <div key={member.id} style={rowStyle}>
                              <div>
                                <strong>User:</strong> {member.user_id.slice(0, 8)}
                                <br />
                                <span style={{ color: "#9ca3af" }}>
                                  Role: {titleCase(member.role)}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </section>

                      <section style={miniPanelStyle}>
                        <h3 style={{ marginTop: 0 }}>Join Requests</h3>

                        {ownerJoinRequests.length === 0 ? (
                          <Empty text="No join requests for this community." />
                        ) : (
                          ownerJoinRequests.map((request) => (
                            <div key={request.id} style={rowStyle}>
                              <div>
                                <strong>User:</strong> {request.user_id.slice(0, 8)}
                                <br />
                                <span style={{ color: "#9ca3af" }}>
                                  Status: {request.status}
                                </span>
                              </div>

                              {request.status === "pending" && (
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button
                                    onClick={() => approveJoinRequest(request.id)}
                                    style={approveButtonStyle}
                                  >
                                    Approve
                                  </button>

                                  <button
                                    onClick={() => denyJoinRequest(request.id)}
                                    style={denyButtonStyle}
                                  >
                                    Deny
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </section>
                    </div>

                    <section style={miniPanelStyle}>
                      <h3 style={{ marginTop: 0 }}>Maintenance Requests</h3>

                      {ownerMaintenanceRequests.length === 0 ? (
                        <Empty text="No maintenance requests for this community yet." />
                      ) : (
                        ownerMaintenanceRequests.map((request) => (
                          <div key={request.id} style={rowStyle}>
                            <div>
                              <strong>{request.resident_name}</strong>
                              <br />
                              <span style={{ color: "#9ca3af" }}>
                                {request.address}
                              </span>
                              <br />
                              <span>{request.description}</span>
                              <br />
                              <span style={{ color: "#9ca3af" }}>
                                Status: {request.status}
                              </span>
                              <br />
                              <span style={{ color: "#9ca3af" }}>
                                Assigned To:{" "}
                                {request.assigned_to
                                  ? request.assigned_to.slice(0, 8)
                                  : "Unassigned"}
                              </span>

                              <div style={{ marginTop: 12 }}>
                                <strong>Notes</strong>
                                <textarea
                                  defaultValue={request.notes || ""}
                                  placeholder="Add internal notes..."
                                  onBlur={(e) =>
                                    updateMaintenanceRequest(request.id, {
                                      notes: e.target.value,
                                    })
                                  }
                                  style={notesBoxStyle}
                                />
                              </div>
                            </div>

                            <div style={requestControlsStyle}>
                              <select
                                value={request.status || "New"}
                                onChange={(e) =>
                                  updateMaintenanceRequest(request.id, {
                                    status: e.target.value,
                                  })
                                }
                                style={selectStyle}
                              >
                                <option value="New">New</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                              </select>

                              <select
                                value={request.assigned_to || ""}
                                onChange={(e) =>
                                  updateMaintenanceRequest(request.id, {
                                    assigned_to: e.target.value || null,
                                  })
                                }
                                style={selectStyle}
                              >
                                <option value="">Unassigned</option>
                                {ownerMembers.map((member) => (
                                  <option key={member.id} value={member.user_id}>
                                    {member.user_id.slice(0, 8)} —{" "}
                                    {titleCase(member.role)}
                                  </option>
                                ))}
                              </select>

                              {request.attachment_url && (
                                <a
                                  href={request.attachment_url}
                                  target="_blank"
                                  style={linkButtonStyle}
                                >
                                  View Photo
                                </a>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </section>
                  </>
                )}
              </Panel>
            )}

            <div style={twoColumnStyle}>
              <Panel title="Your Communities">
                {memberships.length === 0 ? (
                  <Empty text="You are not approved for any communities yet." />
                ) : (
                  memberships.map((member) => (
                    <div key={member.id} style={rowStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <CommunityLogo
                          logoUrl={member.organizations?.logo_url || null}
                          name={member.organizations?.name || "Community"}
                        />

                        <div>
                          <strong>
                            {member.organizations?.name || "Unknown Community"}
                          </strong>
                          <br />
                          <span style={{ color: "#9ca3af" }}>
                            Title: {titleCase(member.role)}
                          </span>
                        </div>
                      </div>

                      {isOwnerLevel(member.role) ? (
                        <button
                          onClick={() => setSelectedOwnerOrgId(member.organization_id)}
                          style={linkButtonStyle}
                        >
                          Owner Tools
                        </button>
                      ) : (
                        <Link
                          href={`/dashboard?community=${member.organization_id}`}
                          style={linkButtonStyle}
                        >
                          Open
                        </Link>
                      )}
                    </div>
                  ))
                )}
              </Panel>

              <Panel title="Join Requests">
                {joinRequests.length === 0 ? (
                  <Empty text="You have not requested to join any communities yet." />
                ) : (
                  joinRequests.map((request) => (
                    <div key={request.id} style={rowStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <CommunityLogo
                          logoUrl={request.organizations?.logo_url || null}
                          name={request.organizations?.name || "Community"}
                        />

                        <div>
                          <strong>
                            {request.organizations?.name || "Unknown Community"}
                          </strong>
                          <br />
                          <span style={{ color: "#9ca3af" }}>
                            Status: {request.status}
                          </span>
                        </div>
                      </div>

                      <StatusBadge status={request.status} />
                    </div>
                  ))
                )}
              </Panel>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function isOwnerLevel(role: string) {
  return role === "owner" || role === "admin" || role === "manager";
}

function Avatar({ profile }: { profile: Profile | null }) {
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt="Profile"
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          objectFit: "cover",
          border: "2px solid #38bdf8",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 72,
        height: 72,
        borderRadius: "50%",
        background: "#0f172a",
        border: "2px solid #38bdf8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 28,
        fontWeight: "bold",
      }}
    >
      {(profile?.full_name || profile?.email || "E").charAt(0).toUpperCase()}
    </div>
  );
}

function CommunityLogo({
  logoUrl,
  name,
}: {
  logoUrl: string | null;
  name: string;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          objectFit: "cover",
          border: "1px solid #334155",
          background: "#020617",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: "#020617",
        border: "1px solid #334155",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold",
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function getHighestRole(memberships: Member[]) {
  const order = ["owner", "admin", "manager", "employee"];

  for (const role of order) {
    if (memberships.some((m) => m.role === role)) {
      return role;
    }
  }

  return "";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ActionCard({
  title,
  description,
  buttonText,
  href,
  color,
}: {
  title: string;
  description: string;
  buttonText: string;
  href: string;
  color: string;
}) {
  return (
    <section style={actionCardStyle}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p style={{ color: "#9ca3af", lineHeight: 1.5 }}>{description}</p>

      <Link
        href={href}
        style={{
          display: "block",
          textAlign: "center",
          padding: 12,
          borderRadius: 12,
          background: color,
          color: "white",
          textDecoration: "none",
          fontWeight: "bold",
          marginTop: 18,
        }}
      >
        {buttonText}
      </Link>
    </section>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={panelStyle}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div style={{ display: "grid", gap: 12 }}>{children}</div>
    </section>
  );
}

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div style={statCardStyle}>
      <div style={{ color: "#9ca3af", fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 28, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ color: "#9ca3af" }}>{text}</p>;
}

function StatusBadge({ status }: { status: string }) {
  const background =
    status === "approved"
      ? "#166534"
      : status === "denied"
      ? "#7f1d1d"
      : "#854d0e";

  return <span style={badgeStyle(background)}>{status}</span>;
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#070b14",
  color: "white",
  padding: 32,
  fontFamily: "Arial, sans-serif",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 32,
  gap: 16,
};

const choiceGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 20,
  marginBottom: 24,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 16,
  marginBottom: 24,
};

const twoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
};

const ownerGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
};

const actionCardStyle: React.CSSProperties = {
  background: "#0f172a",
  borderRadius: 18,
  padding: 22,
  border: "1px solid #1f2937",
};

const panelStyle: React.CSSProperties = {
  background: "#0f172a",
  borderRadius: 18,
  padding: 20,
  border: "1px solid #1f2937",
  marginBottom: 24,
};

const miniPanelStyle: React.CSSProperties = {
  background: "#020617",
  borderRadius: 14,
  padding: 16,
  border: "1px solid #1f2937",
};

const statCardStyle: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1f2937",
  padding: 18,
  borderRadius: 14,
};

const messageStyle: React.CSSProperties = {
  background: "#111827",
  border: "1px solid #374151",
  padding: 14,
  borderRadius: 12,
  marginBottom: 20,
};

const rowStyle: React.CSSProperties = {
  background: "#111827",
  border: "1px solid #1f2937",
  padding: 14,
  borderRadius: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const requestControlsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minWidth: 180,
};

const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#020617",
  color: "white",
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
  resize: "vertical",
};

const topButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #334155",
  background: "#111827",
  color: "white",
  cursor: "pointer",
};

const loginButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #334155",
  background: "#0284c7",
  color: "white",
  textDecoration: "none",
  fontWeight: "bold",
};

const linkButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 10,
  background: "#0284c7",
  color: "white",
  textDecoration: "none",
  fontWeight: "bold",
  border: "none",
  cursor: "pointer",
};

const approveButtonStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  background: "#16a34a",
  color: "white",
  border: "none",
  cursor: "pointer",
  fontWeight: "bold",
};

const denyButtonStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  background: "#dc2626",
  color: "white",
  border: "none",
  cursor: "pointer",
  fontWeight: "bold",
};

const fullButtonStyle: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  padding: 12,
  borderRadius: 12,
  background: "#0284c7",
  color: "white",
  textDecoration: "none",
  fontWeight: "bold",
  marginTop: 8,
};

const badgeStyle = (background: string): React.CSSProperties => ({
  background,
  color: "white",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  textTransform: "uppercase",
  fontWeight: "bold",
});