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
  const [currentUserId, setCurrentUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<MaintenanceRequest[]>([]);
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

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setUserLoggedIn(false);
      setLoading(false);
      return;
    }

    setUserLoggedIn(true);
    const userId = userData.user.id;
    setCurrentUserId(userId);

    const { data: tasks } = await supabase
      .from("maintenance_requests")
      .select("*")
      .eq("assigned_to", userId)
      .order("created_at", { ascending: false });

    setAssignedTasks(tasks || []);
    setLoading(false);
  }

  async function updateMaintenanceRequest(id: string, updates: any) {
    await supabase.from("maintenance_requests").update(updates).eq("id", id);
    loadEmployeeData();
  }

  return (
    <main style={pageStyle}>
      <section style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1>My Assigned Tasks</h1>

        {assignedTasks.length === 0 ? (
          <p>No assigned tasks</p>
        ) : (
          assignedTasks.map((task) => (
            <div key={task.id} style={rowStyle}>
              <div>
                <strong>{task.resident_name}</strong>
                <p>{task.description}</p>

                {/* ✅ UPDATED NOTES SECTION */}
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

              <select
                value={task.status}
                onChange={(e) =>
                  updateMaintenanceRequest(task.id, {
                    status: e.target.value,
                  })
                }
              >
                <option>New</option>
                <option>In Progress</option>
                <option>Completed</option>
              </select>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 20,
  color: "white",
  background: "#070b14",
  minHeight: "100vh",
};

const rowStyle: React.CSSProperties = {
  background: "#111827",
  padding: 15,
  marginBottom: 10,
  borderRadius: 10,
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