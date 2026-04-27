"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type OrgInfo = {
  name: string;
  logo_url: string | null;
};

type Member = {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
};

type JoinRequest = {
  id: string;
  organization_id: string;
  user_id: string;
  status: string;
  created_at: string;
};

export default function OrgAdminPage() {
  const [communityId, setCommunityId] = useState("");
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [communityName, setCommunityName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("community");

    if (!id) {
      setMessage("No community selected.");
      setLoading(false);
      return;
    }

    setCommunityId(id);
    loadOrgAdminData(id);
  }, []);

  async function loadOrgAdminData(orgId: string) {
    setLoading(true);
    setMessage("");

    const orgResult = await supabase
      .from("organizations")
      .select("name, logo_url")
      .eq("id", orgId)
      .single();

    const membersResult = await supabase.rpc("get_managed_org_members", {
      org_id: orgId,
    });

    const joinResult = await supabase
      .from("join_requests")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (!orgResult.error && orgResult.data) {
      setOrgInfo(orgResult.data);
      setCommunityName(orgResult.data.name);
    }

    if (membersResult.error) setMessage(membersResult.error.message);
    if (joinResult.error) setMessage(joinResult.error.message);

    setMembers((membersResult.data || []) as Member[]);
    setJoinRequests((joinResult.data || []) as JoinRequest[]);
    setLoading(false);
  }

  async function updateCommunitySettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!communityId) {
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
      let logoUrl = orgInfo?.logo_url || null;

      if (logoFile) {
        const safeFileName = logoFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `${communityId}/${Date.now()}-${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("organization-logos")
          .upload(filePath, logoFile, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("organization-logos")
          .getPublicUrl(filePath);

        logoUrl = publicUrlData.publicUrl;
      }

      const { error: updateError } = await supabase
        .from("organizations")
        .update({
          name: communityName.trim(),
          search_name: communityName.trim().toLowerCase(),
          logo_url: logoUrl,
        })
        .eq("id", communityId);

      if (updateError) throw updateError;

      setLogoFile(null);
      setMessage("Community settings updated.");
      await loadOrgAdminData(communityId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function removeMember(memberId: string) {
    const ok = confirm("Remove this member from the community?");
    if (!ok) return;

    const { error } = await supabase.rpc("remove_org_member", {
      member_id: memberId,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Member removed.");
    loadOrgAdminData(communityId);
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
    loadOrgAdminData(communityId);
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
    loadOrgAdminData(communityId);
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
    loadOrgAdminData(communityId);
  }

  return (
    <main style={pageStyle}>
      <section style={{ maxWidth: 1100, margin: "0 auto" }}>
        <button
          onClick={() => (window.location.href = "/dashboard")}
          style={{ ...backButtonStyle, marginBottom: 10 }}
        >
          📊 Go to Dashboard
        </button>

        <button
          onClick={() => (window.location.href = "/employee")}
          style={backButtonStyle}
        >
          ← Back to Employee Portal
        </button>

        <header style={orgHeaderStyle}>
          <CommunityLogo
            logoUrl={orgInfo?.logo_url || null}
            name={orgInfo?.name || "Organization"}
          />

          <div>
            <h1 style={{ fontSize: 34, margin: 0 }}>
              {orgInfo?.name || "Organization"}
            </h1>

            <p style={{ color: "#9ca3af", margin: "4px 0 0" }}>
              Organization Admin Panel
            </p>
          </div>
        </header>

        {message && <div style={messageStyle}>{message}</div>}

        {loading ? (
          <Panel title="Loading">
            <p style={{ color: "#9ca3af" }}>Loading organization...</p>
          </Panel>
        ) : (
          <div style={mainGridStyle}>
            <Panel title="Community Settings">
              <form onSubmit={updateCommunitySettings}>
                <label style={labelStyle}>Community Name</label>
                <input
                  value={communityName}
                  onChange={(e) => setCommunityName(e.target.value)}
                  style={inputStyle}
                />

                <label style={labelStyle}>Community Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  style={inputStyle}
                />

                {logoFile && (
                  <p style={{ color: "#9ca3af", fontSize: 13 }}>
                    Selected: {logoFile.name}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={savingSettings}
                  style={saveButtonStyle}
                >
                  {savingSettings ? "Saving..." : "Save Community Settings"}
                </button>
              </form>
            </Panel>

            <Panel title="Employees">
              {members.length === 0 ? (
                <p style={{ color: "#9ca3af" }}>No members found.</p>
              ) : (
                members.map((member) => (
                  <div key={member.id} style={rowStyle}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <Avatar member={member} />

                      <div>
                        <strong>
                          {member.full_name ||
                            member.email ||
                            member.user_id.slice(0, 8)}
                        </strong>
                        <br />
                        <span style={{ color: "#9ca3af" }}>
                          {member.email || "No email"} • {member.role}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      {member.role !== "owner" && (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </Panel>

            <Panel title="Join Requests">
              {joinRequests.length === 0 ? (
                <p style={{ color: "#9ca3af" }}>No join requests.</p>
              ) : (
                joinRequests.map((request) => (
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
                          style={dangerButtonStyle}
                        >
                          Deny
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </Panel>
          </div>
        )}
      </section>
    </main>
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
          width: 68,
          height: 68,
          borderRadius: 14,
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
        width: 68,
        height: 68,
        borderRadius: 14,
        background: "#020617",
        border: "1px solid #334155",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 28,
        fontWeight: "bold",
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function Avatar({ member }: { member: Member }) {
  if (member.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt="Profile"
        style={{
          width: 46,
          height: 46,
          borderRadius: "50%",
          objectFit: "cover",
          border: "1px solid #38bdf8",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 46,
        height: 46,
        borderRadius: "50%",
        background: "#020617",
        border: "1px solid #38bdf8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold",
      }}
    >
      {(member.full_name || member.email || "U").charAt(0).toUpperCase()}
    </div>
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

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#070b14",
  color: "white",
  padding: 32,
  fontFamily: "Arial, sans-serif",
};

const orgHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  marginBottom: 26,
  background: "#0f172a",
  border: "1px solid #1f2937",
  borderRadius: 18,
  padding: 18,
};

const mainGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 24,
};

const panelStyle: React.CSSProperties = {
  background: "#0f172a",
  borderRadius: 18,
  padding: 20,
  border: "1px solid #1f2937",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "#e5e7eb",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#020617",
  color: "white",
  marginBottom: 14,
};

const saveButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "none",
  background: "#0284c7",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
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

const selectStyle: React.CSSProperties = {
  padding: 8,
  borderRadius: 8,
  background: "#020617",
  color: "white",
  border: "1px solid #334155",
};

const approveButtonStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "none",
  background: "#16a34a",
  color: "white",
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "none",
  background: "#dc2626",
  color: "white",
  cursor: "pointer",
};

const backButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #334155",
  background: "#111827",
  color: "white",
  cursor: "pointer",
  marginBottom: 20,
};

const messageStyle: React.CSSProperties = {
  background: "#111827",
  border: "1px solid #374151",
  padding: 14,
  borderRadius: 12,
  marginBottom: 20,
};