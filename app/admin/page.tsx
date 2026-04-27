"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

type Organization = {
  id: string;
  name: string;
  created_at: string;
};

type Member = {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
};

type JoinRequest = {
  id: string;
  organization_id: string;
  user_id: string;
  status: string;
  created_at: string;
};

export default function AdminPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [newCommunityName, setNewCommunityName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
    setMessage("");

    const orgsResult = await supabase
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false });

    const membersResult = await supabase
      .from("organization_members")
      .select("*")
      .order("created_at", { ascending: false });

    const joinResult = await supabase
      .from("join_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (orgsResult.error) setMessage(orgsResult.error.message);
    if (membersResult.error) setMessage(membersResult.error.message);
    if (joinResult.error) setMessage(joinResult.error.message);

    setOrganizations(orgsResult.data || []);
    setMembers(membersResult.data || []);
    setJoinRequests(joinResult.data || []);

    if (!selectedOrgId && orgsResult.data && orgsResult.data.length > 0) {
      setSelectedOrgId(orgsResult.data[0].id);
    }
  }

  async function createCommunity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!newCommunityName.trim()) {
      setMessage("Enter a community name.");
      return;
    }

    const { error } = await supabase.rpc("create_organization", {
      org_name: newCommunityName.trim(),
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewCommunityName("");
    setMessage("Community created.");
    loadAdminData();
  }

  async function deleteCommunity(id: string) {
    const confirmDelete = confirm(
      "Are you sure you want to delete this community? This cannot be undone."
    );

    if (!confirmDelete) return;

    const { error } = await supabase.rpc("delete_organization", {
      org_id: id,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Community deleted.");

    if (selectedOrgId === id) {
      setSelectedOrgId("");
    }

    loadAdminData();
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
    loadAdminData();
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
    loadAdminData();
  }

  const selectedMembers = members.filter(
    (member) => member.organization_id === selectedOrgId
  );

  const selectedJoinRequests = joinRequests.filter(
    (request) => request.organization_id === selectedOrgId
  );

  return (
    <main style={pageStyle}>
      <div style={logoHeaderStyle}>
        <Image
          src="/kjd-logo.png"
          alt="KJD Solutions Logo"
          width={280}
          height={280}
          priority
          style={{
            width: "100%",
            maxWidth: 280,
            height: "auto",
            margin: "0 auto",
            display: "block",
          }}
        />

        <h1 style={{ fontSize: 36, marginTop: 12, marginBottom: 4 }}>
          Admin Control Center
        </h1>

        <p style={{ color: "#9ca3af", marginTop: 4 }}>
          Manage communities, employees, and join requests
        </p>
      </div>

      {message && <div style={messageStyle}>{message}</div>}

      <section style={gridStyle}>
        <aside style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Communities</h2>

          <form onSubmit={createCommunity}>
            <input
              value={newCommunityName}
              onChange={(e) => setNewCommunityName(e.target.value)}
              placeholder="New community name"
              style={inputStyle}
            />

            <button type="submit" style={buttonStyle}>
              Add Community
            </button>
          </form>

          <div style={{ marginTop: 20 }}>
            {organizations.length === 0 ? (
              <p style={{ color: "#9ca3af" }}>No communities yet.</p>
            ) : (
              organizations.map((org) => (
                <div key={org.id} style={rowStyle}>
                  <button
                    onClick={() => setSelectedOrgId(org.id)}
                    style={{
                      ...selectButtonStyle,
                      color: selectedOrgId === org.id ? "#38bdf8" : "white",
                      fontWeight: selectedOrgId === org.id ? "bold" : "normal",
                    }}
                  >
                    {org.name}
                  </button>

                  <button
                    onClick={() => deleteCommunity(org.id)}
                    style={deleteButtonStyle}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        <section>
          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Employees</h2>

            {selectedMembers.length === 0 ? (
              <p style={{ color: "#9ca3af" }}>
                No employees in this community.
              </p>
            ) : (
              selectedMembers.map((member) => (
                <div key={member.id} style={rowStyle}>
                  <div>
                    <strong>User:</strong> {member.user_id.slice(0, 8)}
                    <br />
                    <span style={{ color: "#9ca3af" }}>
                      Role: {member.role}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ ...panelStyle, marginTop: 20 }}>
            <h2 style={{ marginTop: 0 }}>Join Requests</h2>

            {selectedJoinRequests.length === 0 ? (
              <p style={{ color: "#9ca3af" }}>No join requests.</p>
            ) : (
              selectedJoinRequests.map((req) => (
                <div key={req.id} style={rowStyle}>
                  <div>
                    <strong>User:</strong> {req.user_id.slice(0, 8)}
                    <br />
                    <span style={{ color: "#9ca3af" }}>
                      Status: {req.status}
                    </span>
                  </div>

                  {req.status === "pending" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => approveJoinRequest(req.id)}
                        style={approveStyle}
                      >
                        Approve
                      </button>

                      <button
                        onClick={() => denyJoinRequest(req.id)}
                        style={denyStyle}
                      >
                        Deny
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#070b14",
  color: "white",
  padding: 30,
  fontFamily: "Arial, sans-serif",
};

const logoHeaderStyle: React.CSSProperties = {
  textAlign: "center",
  marginBottom: 26,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "320px 1fr",
  gap: 20,
};

const panelStyle: React.CSSProperties = {
  background: "#0f172a",
  padding: 20,
  borderRadius: 16,
  border: "1px solid #1f2937",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginBottom: 10,
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#020617",
  color: "white",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 10,
  background: "#0284c7",
  border: "none",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 10,
  marginTop: 10,
  borderRadius: 10,
  background: "#111827",
  gap: 10,
};

const selectButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  textAlign: "left",
};

const deleteButtonStyle: React.CSSProperties = {
  background: "#dc2626",
  border: "none",
  color: "white",
  padding: "6px 10px",
  borderRadius: 8,
  cursor: "pointer",
};

const approveStyle: React.CSSProperties = {
  background: "#16a34a",
  border: "none",
  color: "white",
  padding: "6px 10px",
  borderRadius: 8,
  cursor: "pointer",
};

const denyStyle: React.CSSProperties = {
  background: "#dc2626",
  border: "none",
  color: "white",
  padding: "6px 10px",
  borderRadius: 8,
  cursor: "pointer",
};

const messageStyle: React.CSSProperties = {
  background: "#111827",
  padding: 10,
  borderRadius: 10,
  marginBottom: 15,
  border: "1px solid #374151",
};