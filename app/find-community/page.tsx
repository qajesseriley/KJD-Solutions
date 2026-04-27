"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Organization = {
  id: string;
  name: string;
  created_at: string;
};

export default function FindCommunityPage() {
  const [search, setSearch] = useState("");
  const [communities, setCommunities] = useState<Organization[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function searchCommunities(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const cleanSearch = search.trim();

    if (!cleanSearch) {
      setMessage("Enter a community name to search.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .ilike("name", `%${cleanSearch}%`)
      .order("name", { ascending: true });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setCommunities(data || []);

    if (!data || data.length === 0) {
      setMessage("No matching communities found.");
    }

    setLoading(false);
  }

  async function requestToJoin(organizationId: string) {
    setMessage("");

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setMessage("You must be logged in to request to join a community.");
      return;
    }

    const { error } = await supabase.from("join_requests").insert([
      {
        organization_id: organizationId,
        user_id: userData.user.id,
        status: "pending",
      },
    ]);

    if (error) {
      if (error.message.includes("duplicate")) {
        setMessage("You already requested to join this community.");
      } else {
        setMessage(error.message);
      }
      return;
    }

    setMessage("Join request sent. An admin can now approve you.");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#070b14",
        color: "white",
        padding: 32,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          maxWidth: 760,
          margin: "0 auto",
        }}
      >
        <h1 style={{ fontSize: 34, marginBottom: 8 }}>Find Your Community</h1>

        <p style={{ color: "#9ca3af", marginBottom: 24 }}>
          Search for your organization and request to join the team.
        </p>

        <form
          onSubmit={searchCommunities}
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Example: The Orchards MHC"
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 12,
              border: "1px solid #334155",
              background: "#020617",
              color: "white",
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0 18px",
              borderRadius: 12,
              border: "none",
              background: "#0284c7",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {message && (
          <div
            style={{
              background: "#111827",
              border: "1px solid #374151",
              padding: 14,
              borderRadius: 12,
              marginBottom: 20,
            }}
          >
            {message}
          </div>
        )}

        <div style={{ display: "grid", gap: 14 }}>
          {communities.map((community) => (
            <div
              key={community.id}
              style={{
                background: "#0f172a",
                border: "1px solid #1f2937",
                borderRadius: 16,
                padding: 18,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>{community.name}</h2>
                <p style={{ color: "#9ca3af", margin: "6px 0 0" }}>
                  Community ID: {community.id.slice(0, 8)}
                </p>
              </div>

              <button
                onClick={() => requestToJoin(community.id)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: "#16a34a",
                  color: "white",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Request to Join
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}