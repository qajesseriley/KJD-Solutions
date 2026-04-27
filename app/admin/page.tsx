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

type MaintenanceRequest = {
  id: string;
  organization_id: string;
  resident_name: string;
  resident_phone: string;
  address: string;
  description: string;
  status: string;
  created_at: string;
  attachment_url?: string;
};

export default function AdminPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);

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
      .select("*");

    const joinResult = await supabase
      .from("join_requests")
      .select("*");

    const requestResult = await supabase
      .from("maintenance_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (orgsResult.error) setMessage(orgsResult.error.message);
    if (membersResult.error) setMessage(membersResult.error.message);
    if (joinResult.error) setMessage(joinResult.error.message);
    if (requestResult.error) setMessage(requestResult.error.message);

    setOrganizations(orgsResult.data || []);
    setMembers(membersResult.data || []);
    setJoinRequests(joinResult.data || []);
    setRequests(requestResult.data || []);

    if (!selectedOrgId && orgsResult.data?.length) {
      setSelectedOrgId(orgsResult.data[0].id);
    }
  }

  const selectedMembers = members.filter(
    (m) => m.organization_id === selectedOrgId
  );

  const selectedJoinRequests = joinRequests.filter(
    (r) => r.organization_id === selectedOrgId
  );

  const selectedRequests = requests.filter(
    (r) => r.organization_id === selectedOrgId
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
        />
        <h1>Admin Control Center</h1>
      </div>

      {message && <div style={messageStyle}>{message}</div>}

      <section style={gridStyle}>
        <aside style={panelStyle}>
          <h2>Communities</h2>

          {organizations.map((org) => (
            <div key={org.id} style={rowStyle}>
              <button onClick={() => setSelectedOrgId(org.id)}>
                <div>{org.name}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                  ID: {org.id}
                </div>
              </button>
            </div>
          ))}
        </aside>

        <section>
          {/* EMPLOYEES */}
          <div style={panelStyle}>
            <h2>Employees</h2>
            {selectedMembers.map((m) => (
              <div key={m.id}>{m.user_id}</div>
            ))}
          </div>

          {/* JOIN REQUESTS */}
          <div style={{ ...panelStyle, marginTop: 20 }}>
            <h2>Join Requests</h2>
            {selectedJoinRequests.map((r) => (
              <div key={r.id}>{r.user_id}</div>
            ))}
          </div>

          {/* 🚀 NEW SECTION */}
          <div style={{ ...panelStyle, marginTop: 20 }}>
            <h2>Maintenance Requests</h2>

            {selectedRequests.length === 0 ? (
              <p>No requests yet.</p>
            ) : (
              selectedRequests.map((req) => (
                <div key={req.id} style={rowStyle}>
                  <div>
                    <strong>{req.resident_name}</strong>
                    <br />
                    {req.address}
                    <br />
                    <small>{req.description}</small>
                    <br />
                    <span style={{ color: "#9ca3af" }}>
                      Status: {req.status}
                    </span>
                  </div>

                  {req.attachment_url && (
                    <a href={req.attachment_url} target="_blank">
                      View Photo
                    </a>
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

/* styles unchanged */
const pageStyle = { minHeight: "100vh", background: "#070b14", color: "white", padding: 30 };
const logoHeaderStyle = { textAlign: "center", marginBottom: 26 };
const gridStyle = { display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 };
const panelStyle = { background: "#0f172a", padding: 20, borderRadius: 16 };
const rowStyle = { display: "flex", justifyContent: "space-between", padding: 10 };
const messageStyle = { background: "#111827", padding: 10, borderRadius: 10 };