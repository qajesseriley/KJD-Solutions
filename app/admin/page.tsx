"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const APP_URL = "https://kjd-solutions.vercel.app";

type Organization = {
  id: string;
  name: string;
  created_at?: string | null;
};

type Member = {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at?: string | null;
};

type JoinRequest = {
  id: string;
  organization_id: string;
  user_id: string;
  status: string;
  created_at?: string | null;
};

type MaintenanceRequest = {
  id: string;
  organization_id: string;
  resident_name: string | null;
  resident_phone?: string | null;
  address: string | null;
  description: string | null;
  status: string | null;
  created_at?: string | null;
  attachment_url?: string | null;
};

export default function AdminPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const [orgs, mems, joins, reqs] = await Promise.all([
      supabase.from("organizations").select("*").order("created_at", { ascending: false }),
      supabase.from("organization_members").select("*"),
      supabase.from("join_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("maintenance_requests").select("*").order("created_at", { ascending: false }),
    ]);

    if (orgs.error) setMessage(orgs.error.message);
    if (mems.error) setMessage(mems.error.message);
    if (joins.error) setMessage(joins.error.message);
    if (reqs.error) setMessage(reqs.error.message);

    const orgRows = (orgs.data || []) as Organization[];

    setOrganizations(orgRows);
    setMembers((mems.data || []) as Member[]);
    setJoinRequests((joins.data || []) as JoinRequest[]);
    setRequests((reqs.data || []) as MaintenanceRequest[]);

    if (!selectedOrgId && orgRows.length > 0) {
      setSelectedOrgId(orgRows[0].id);
    }

    setLoading(false);
  }

  const selectedOrganization = useMemo(() => {
    return organizations.find((org) => org.id === selectedOrgId) || null;
  }, [organizations, selectedOrgId]);

  const selectedMembers = useMemo(() => {
    return members.filter((member) => member.organization_id === selectedOrgId);
  }, [members, selectedOrgId]);

  const selectedJoinRequests = useMemo(() => {
    return joinRequests.filter((request) => request.organization_id === selectedOrgId);
  }, [joinRequests, selectedOrgId]);

  const selectedRequests = useMemo(() => {
    return requests.filter((request) => request.organization_id === selectedOrgId);
  }, [requests, selectedOrgId]);

  const pendingJoinCount = selectedJoinRequests.filter(
    (request) => request.status === "pending"
  ).length;

  async function approveJoin(id: string) {
    const { error } = await supabase.rpc("approve_join_request", { request_id: id });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Join request approved.");
    await loadData();
  }

  async function denyJoin(id: string) {
    const { error } = await supabase.rpc("deny_join_request", { request_id: id });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Join request denied.");
    await loadData();
  }

  async function removeMember(id: string) {
    if (!confirm("Remove this member from the community?")) return;

    const { error } = await supabase.rpc("remove_org_member", { member_id: id });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Member removed.");
    await loadData();
  }

  async function changeRole(id: string, role: string) {
    const { error } = await supabase.rpc("update_org_member_role", {
      member_id: id,
      new_role: role,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Role updated.");
    await loadData();
  }

  async function deleteRequest(id: string) {
    if (!confirm("Delete this request? This cannot be undone.")) return;

    const { error } = await supabase
      .from("maintenance_requests")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Request deleted.");
    await loadData();
  }

  function copyLink(orgId: string) {
    const link = `${APP_URL}/?organization_id=${orgId}`;
    navigator.clipboard.writeText(link);
    setMessage("Resident request link copied.");
  }

  return (
    <main style={pageStyle}>
      <aside style={sidebarStyle}>
        <div style={brandBoxStyle}>
          <h1 style={{ margin: 0 }}>KJD Admin</h1>
          <p style={mutedTextStyle}>Internal control center</p>
        </div>

        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Communities</h2>

          {organizations.length === 0 ? (
            <p style={mutedTextStyle}>No communities found.</p>
          ) : (
            organizations.map((org) => {
              const isActive = org.id === selectedOrgId;

              return (
                <button
                  key={org.id}
                  onClick={() => setSelectedOrgId(org.id)}
                  style={{
                    ...communityButtonStyle,
                    borderColor: isActive ? "#38bdf8" : "#1f2937",
                    background: isActive ? "rgba(14, 116, 144, 0.35)" : "#111827",
                  }}
                >
                  <strong>{org.name}</strong>
                  <span style={smallMutedTextStyle}>{org.id}</span>
                </button>
              );
            })
          )}
        </section>
      </aside>

      <section style={contentStyle}>
        <header style={headerStyle}>
          <div>
            <h1 style={{ margin: 0 }}>
              {selectedOrganization?.name || "Select a Community"}
            </h1>
            <p style={mutedTextStyle}>
              Manage members, join requests, and maintenance records.
            </p>
          </div>

          <div style={buttonRowStyle}>
            {selectedOrgId && (
              <button onClick={() => copyLink(selectedOrgId)} style={primaryButtonStyle}>
                Copy Resident Link
              </button>
            )}

            <button onClick={loadData} style={secondaryButtonStyle}>
              Refresh
            </button>
          </div>
        </header>

        {message && <div style={messageStyle}>{message}</div>}

        <section style={statsGridStyle}>
          <StatCard label="Communities" value={organizations.length} />
          <StatCard label="Members" value={selectedMembers.length} />
          <StatCard label="Pending Joins" value={pendingJoinCount} />
          <StatCard label="Requests" value={selectedRequests.length} />
        </section>

        {loading ? (
          <section style={panelStyle}>
            <p>Loading admin data...</p>
          </section>
        ) : (
          <>
            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>Members</h2>

              {selectedMembers.length === 0 ? (
                <p style={mutedTextStyle}>No members found for this community.</p>
              ) : (
                selectedMembers.map((member) => (
                  <div key={member.id} style={rowStyle}>
                    <div>
                      <strong>{member.user_id}</strong>
                      <p style={mutedTextStyle}>Role: {member.role}</p>
                    </div>

                    {member.role === "owner" ? (
                      <span style={ownerPillStyle}>Protected Owner</span>
                    ) : (
                      <div style={buttonRowStyle}>
                        <select
                          value={member.role}
                          onChange={(e) => changeRole(member.id, e.target.value)}
                          style={selectStyle}
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="employee">Employee</option>
                        </select>

                        <button
                          onClick={() => removeMember(member.id)}
                          style={dangerButtonStyle}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>

            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>Join Requests</h2>

              {selectedJoinRequests.length === 0 ? (
                <p style={mutedTextStyle}>No join requests for this community.</p>
              ) : (
                selectedJoinRequests.map((request) => (
                  <div key={request.id} style={rowStyle}>
                    <div>
                      <strong>{request.user_id}</strong>
                      <p style={mutedTextStyle}>Status: {request.status}</p>
                    </div>

                    {request.status === "pending" && (
                      <div style={buttonRowStyle}>
                        <button
                          onClick={() => approveJoin(request.id)}
                          style={approveButtonStyle}
                        >
                          Approve
                        </button>

                        <button
                          onClick={() => denyJoin(request.id)}
                          style={dangerButtonStyle}
                        >
                          Deny
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>

            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>Maintenance Requests</h2>

              {selectedRequests.length === 0 ? (
                <p style={mutedTextStyle}>No requests for this community.</p>
              ) : (
                selectedRequests.map((request) => (
                  <div key={request.id} style={rowStyle}>
                    <div style={{ flex: 1 }}>
                      <strong>{request.resident_name || "Unnamed Resident"}</strong>
                      <p style={mutedTextStyle}>{request.address || "No address"}</p>
                      <p style={{ margin: "8px 0" }}>
                        {request.description || "No description"}
                      </p>
                      <span style={statusPillStyle}>{request.status || "New"}</span>
                    </div>

                    <div style={buttonColumnStyle}>
                      {request.attachment_url && (
                        <a
                          href={request.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          style={secondaryButtonStyle}
                        >
                          View Photo
                        </a>
                      )}

                      <button
                        onClick={() => deleteRequest(request.id)}
                        style={dangerButtonStyle}
                      >
                        Delete Request
                      </button>
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={statCardStyle}>
      <span style={statNumberStyle}>{value}</span>
      <span style={mutedTextStyle}>{label}</span>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "320px 1fr",
  minHeight: "100vh",
  background: "#070b14",
  color: "white",
  fontFamily: "Arial, sans-serif",
};

const sidebarStyle: React.CSSProperties = {
  padding: 20,
  borderRight: "1px solid #1f2937",
  background: "#020617",
};

const contentStyle: React.CSSProperties = {
  padding: 28,
};

const brandBoxStyle: React.CSSProperties = {
  marginBottom: 20,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 20,
  background: "#0f172a",
  border: "1px solid #1f2937",
  borderRadius: 18,
  padding: 20,
};

const panelStyle: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1f2937",
  borderRadius: 18,
  padding: 20,
  marginBottom: 20,
};

const sectionTitleStyle: React.CSSProperties = {
  marginTop: 0,
};

const communityButtonStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #1f2937",
  borderRadius: 14,
  color: "white",
  padding: 14,
  marginBottom: 10,
  textAlign: "left",
  cursor: "pointer",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  border: "1px solid #1f2937",
  background: "#111827",
  borderRadius: 14,
  padding: 14,
  marginBottom: 12,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 14,
  marginBottom: 20,
};

const statCardStyle: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1f2937",
  borderRadius: 16,
  padding: 18,
};

const statNumberStyle: React.CSSProperties = {
  display: "block",
  fontSize: 30,
  fontWeight: "bold",
};

const mutedTextStyle: React.CSSProperties = {
  color: "#9ca3af",
  margin: "4px 0 0",
};

const smallMutedTextStyle: React.CSSProperties = {
  display: "block",
  color: "#9ca3af",
  fontSize: 12,
  marginTop: 6,
  wordBreak: "break-all",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const buttonColumnStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#0284c7",
  border: "none",
  color: "white",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: "bold",
  textDecoration: "none",
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "#1f2937",
  border: "1px solid #334155",
  color: "white",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
  textDecoration: "none",
};

const approveButtonStyle: React.CSSProperties = {
  background: "#16a34a",
  border: "none",
  color: "white",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: "bold",
};

const dangerButtonStyle: React.CSSProperties = {
  background: "#dc2626",
  border: "none",
  color: "white",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: "bold",
};

const selectStyle: React.CSSProperties = {
  background: "#020617",
  color: "white",
  border: "1px solid #334155",
  borderRadius: 10,
  padding: "10px 12px",
};

const messageStyle: React.CSSProperties = {
  background: "#111827",
  border: "1px solid #334155",
  borderRadius: 12,
  padding: 12,
  marginBottom: 18,
};

const ownerPillStyle: React.CSSProperties = {
  background: "#78350f",
  color: "#fde68a",
  borderRadius: 999,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: "bold",
};

const statusPillStyle: React.CSSProperties = {
  display: "inline-block",
  background: "#1e3a8a",
  color: "#bfdbfe",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 13,
  fontWeight: "bold",
};
