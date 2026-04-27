"use client";

import Image from "next/image";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone,
            },
          },
        });

        if (error) throw error;

        setMessage("Account created. You can now sign in.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // ✅ ONLY CHANGE MADE HERE
        window.location.href = "/dashboard";
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #10233a 0%, #05070b 55%, #000000 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 460,
          background: "rgba(10, 15, 25, 0.94)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 25px 80px rgba(0,0,0,0.65)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Image
            src="/kjd-logo.png"
            alt="KJD Solutions Logo"
            width={240}
            height={240}
            priority
            style={{
              width: "100%",
              maxWidth: 240,
              height: "auto",
              margin: "0 auto",
              display: "block",
            }}
          />

          <h1 style={{ color: "white", marginBottom: 6 }}>
            {mode === "login" ? "Employee Login" : "Create Account"}
          </h1>

          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
            KJD Solutions Maintenance Portal
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
                required
                style={inputStyle}
              />

              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone Number"
                style={inputStyle}
              />
            </>
          )}

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            required
            style={inputStyle}
          />

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            required
            style={inputStyle}
          />

          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading
              ? "Processing..."
              : mode === "login"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>

        {message && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 12,
              background: "#111827",
              color: "white",
              border: "1px solid #374151",
            }}
          >
            {message}
          </div>
        )}

        <button
          onClick={() => {
            setMessage("");
            setMode(mode === "login" ? "signup" : "login");
          }}
          style={{
            marginTop: 18,
            width: "100%",
            background: "transparent",
            border: "none",
            color: "#38bdf8",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {mode === "login"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 13,
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
};