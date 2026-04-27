"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  const [assignedTasks, setAssignedTasks] = useState<MaintenanceRequest[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadEmployeeData();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel("employee-assigned-tasks-live")
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

  async function loadEmployeeData(showLoading = true) {
    if (showLoading) setLoading(true);
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setMessage("You must be logged in to view this page.");
      setLoading(false);
      return;
    }

    const userId = userData.user.id;
    setCurrentUserId(userId);

    const { data, error } = await supabase
      .from("maintenance_requests")
      .select("*")
      .eq("assigned_to", userId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setAssignedTasks(data || []);
    setLoading(false);
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

  return (
    <main style={pageStyle}>
      <section style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1>My Assigned Tasks</h1>

        {message && <div style={messageStyle}>{message}</div>}

        {loading ? (
          <p>Loading tasks...</p>
        ) : assignedTasks.length === 0 ? (
          <p>No assigned tasks</p>
        ) : (
          assignedTasks.map((task) => (
            <div key={task.id} style={rowStyle}>
              <div>
                <strong>{task.resident_name}</strong>
                <p style={{ color: "#9ca3af" }}>{task.address}</p>
                <p>{task.description}</p>

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

                {task.attachment_url && (
                  <a href={task.attachment_url} target="_blank" style={buttonStyle}>
                    View Photo
                  </a>
                )}
              </div>
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
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
};

const controlsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  minWidth: 180,
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
};