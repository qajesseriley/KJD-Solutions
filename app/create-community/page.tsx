"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CreateCommunityPage() {
  const [communityName, setCommunityName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleCreateCommunity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const cleanName = communityName.trim();

      if (!cleanName) {
        throw new Error("Please enter a community name.");
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        throw new Error("You must be logged in to create a community.");
      }

      const { data: newOrgId, error: orgError } = await supabase.rpc(
        "create_organization",
        {
          org_name: cleanName,
        }
      );

      if (orgError) {
        throw orgError;
      }

      let logoUrl: string | null = null;

      if (logoFile && newOrgId) {
        const safeFileName = logoFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `${newOrgId}/${Date.now()}-${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("organization-logos")
          .upload(filePath, logoFile, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from("organization-logos")
          .getPublicUrl(filePath);

        logoUrl = publicUrlData.publicUrl;

        const { error: updateError } = await supabase
          .from("organizations")
          .update({ logo_url: logoUrl })
          .eq("id", newOrgId);

        if (updateError) {
          throw updateError;
        }
      }

      setMessage("Community created successfully. Redirecting...");
      setCommunityName("");
      setLogoFile(null);

      setTimeout(() => {
        window.location.href = "/employee";
      }, 800);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <h1 style={{ fontSize: 32, marginTop: 0 }}>Create Community</h1>

        <p style={{ color: "#9ca3af", lineHeight: 1.5 }}>
          Create a private community workspace. You will automatically become
          the owner / primary account holder. You may also upload a community
          logo.
        </p>

        <form onSubmit={handleCreateCommunity}>
          <label style={labelStyle}>Community Name</label>

          <input
            value={communityName}
            onChange={(e) => setCommunityName(e.target.value)}
            placeholder="Example: The Orchards MHC"
            required
            style={inputStyle}
          />

          <label style={labelStyle}>Community Logo Optional</label>

          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
            style={fileInputStyle}
          />

          {logoFile && (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>
              Selected: {logoFile.name}
            </p>
          )}

          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? "Creating..." : "Create Community"}
          </button>
        </form>

        {message && <div style={messageStyle}>{message}</div>}

        <button
          onClick={() => (window.location.href = "/employee")}
          style={secondaryButtonStyle}
        >
          Back to Employee Portal
        </button>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#070b14",
  color: "white",
  padding: 32,
  fontFamily: "Arial, sans-serif",
};

const cardStyle: React.CSSProperties = {
  maxWidth: 540,
  margin: "80px auto",
  background: "#0f172a",
  border: "1px solid #1f2937",
  borderRadius: 20,
  padding: 28,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  marginTop: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 13,
  borderRadius: 12,
  border: "1px solid #334155",
  background: "#020617",
  color: "white",
  marginBottom: 12,
};

const fileInputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #334155",
  background: "#020617",
  color: "white",
  marginBottom: 12,
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: 13,
  borderRadius: 12,
  border: "none",
  background: "#0284c7",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: 10,
};

const secondaryButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 14,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #334155",
  background: "transparent",
  color: "white",
  cursor: "pointer",
};

const messageStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 12,
  borderRadius: 12,
  background: "#111827",
  border: "1px solid #374151",
};