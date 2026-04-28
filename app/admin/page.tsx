"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const APP_URL = "https://kjd-solutions.vercel.app";

type Organization = {
id: string;
name: string;
};

type Member = {
id: string;
organization_id: string;
user_id: string;
role: string;
};

type JoinRequest = {
id: string;
organization_id: string;
user_id: string;
status: string;
};

type MaintenanceRequest = {
id: string;
organization_id: string;
resident_name: string;
address: string;
description: string;
status: string;
attachment_url?: string;
};

export default function AdminPage() {
const [organizations, setOrganizations] = useState<Organization[]>([]);
const [members, setMembers] = useState<Member[]>([]);
const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
const [selectedOrgId, setSelectedOrgId] = useState("");
const [message, setMessage] = useState("");

useEffect(() => {
loadData();
}, []);

async function loadData() {
const orgs = await supabase.from("organizations").select("*");
const mems = await supabase.from("organization_members").select("*");
const joins = await supabase.from("join_requests").select("*");
const reqs = await supabase.from("maintenance_requests").select("*");

```
if (orgs.error) setMessage(orgs.error.message);
if (mems.error) setMessage(mems.error.message);
if (joins.error) setMessage(joins.error.message);
if (reqs.error) setMessage(reqs.error.message);

setOrganizations(orgs.data || []);
setMembers(mems.data || []);
setJoinRequests(joins.data || []);
setRequests(reqs.data || []);

if (!selectedOrgId && orgs.data?.length) {
  setSelectedOrgId(orgs.data[0].id);
}
```

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

async function approveJoin(id: string) {
await supabase.rpc("approve_join_request", { request_id: id });
loadData();
}

async function denyJoin(id: string) {
await supabase.rpc("deny_join_request", { request_id: id });
loadData();
}

async function removeMember(id: string) {
if (!confirm("Remove this member?")) return;
await supabase.rpc("remove_org_member", { member_id: id });
loadData();
}

async function changeRole(id: string, role: string) {
await supabase.rpc("update_org_member_role", {
member_id: id,
new_role: role,
});
loadData();
}

async function deleteRequest(id: string) {
if (!confirm("Delete this request? This cannot be undone.")) return;

```
const { error } = await supabase
  .from("maintenance_requests")
  .delete()
  .eq("id", id);

if (error) setMessage(error.message);

loadData();
```

}

function copyLink(orgId: string) {
const link = `${APP_URL}/?organization_id=${orgId}`;
navigator.clipboard.writeText(link);
setMessage("Link copied.");
}

return (
<main style={{ display: "grid", gridTemplateColumns: "280px 1fr", minHeight: "100vh", background: "#070b14", color: "white" }}>

```
  {/* LEFT PANEL */}
  <aside style={{ padding: 20, borderRight: "1px solid #1f2937" }}>
    <h2>Communities</h2>

    {organizations.map((org) => (
      <div key={org.id} style={{ marginBottom: 15 }}>
        <button onClick={() => setSelectedOrgId(org.id)}>
          {org.name}
        </button>

        <br />

        <button onClick={() => copyLink(org.id)}>
          Copy Link
        </button>
      </div>
    ))}
  </aside>

  {/* RIGHT PANEL */}
  <section style={{ padding: 20 }}>
    {message && <div>{message}</div>}

    {/* MEMBERS */}
    <h2>Members</h2>
    {selectedMembers.map((m) => (
      <div key={m.id} style={{ marginBottom: 10 }}>
        {m.user_id} ({m.role})

        {m.role !== "owner" && (
          <>
            <select
              value={m.role}
              onChange={(e) => changeRole(m.id, e.target.value)}
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
            </select>

            <button onClick={() => removeMember(m.id)}>Remove</button>
          </>
        )}
      </div>
    ))}

    {/* JOIN REQUESTS */}
    <h2>Join Requests</h2>
    {selectedJoinRequests.map((r) => (
      <div key={r.id}>
        {r.user_id}
        {r.status === "pending" && (
          <>
            <button onClick={() => approveJoin(r.id)}>Approve</button>
            <button onClick={() => denyJoin(r.id)}>Deny</button>
          </>
        )}
      </div>
    ))}

    {/* REQUESTS */}
    <h2>Maintenance Requests</h2>
    {selectedRequests.map((r) => (
      <div key={r.id} style={{ marginBottom: 15 }}>
        <strong>{r.resident_name}</strong>
        <br />
        {r.address}
        <br />
        {r.description}
        <br />
        {r.status}

        <br />

        <button onClick={() => deleteRequest(r.id)}>
          Delete Request
        </button>

        {r.attachment_url && (
          <a href={r.attachment_url} target="_blank">
            View Photo
          </a>
        )}
      </div>
    ))}
  </section>
</main>
```

);
}
