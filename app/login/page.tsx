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
        const { data, error } = await supabase.auth.signUp({
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

        if (!data.session) {
          setMessage(
            "Account created. Please check your email and confirm your account before signing in."
          );
        } else {
          setMessage("Account created and signed in.");
          window.location.href = "/dashboard";
        }

        setMode("login");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (!data.session) {
          setMessage("Login failed. Please confirm your email first.");
          return;
        }

        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      let msg = err?.message || "Something went wrong.";

      // 🔥 Cleaner error messages
      if (msg.includes("Invalid login credentials")) {
        msg = "Invalid email or password.";
      }

      if (msg.includes("Email not confirmed")) {
        msg = "Please confirm your email before logging in.";
      }

      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Image
            src="/kjd-logo.png"
            alt="KJD Solutions Logo"
            width={240}
            height={240}
            priority
            style={{ maxWidth: 240, width: "100%", height: "auto" }}
          />

          <h1 style={{ color: "white" }}>
            {mode === "login" ? "Employee Login" : "Create Account"}
          </h1>
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

        {message && <div style={messageStyle}>{message}</div>}

        <button
          onClick={() => {
            setMessage("");
            setMode(mode === "login" ? "signup" : "login");
          }}
          style={switchStyle}
        >
          {mode === "login"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}

/* styles */
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top, #10233a 0%, #05070b 55%, #000000 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  background: "rgba(10, 15, 25, 0.94)",
  borderRadius: 24,
  padding: 32,
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

const messageStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 12,
  borderRadius: 12,
  background: "#111827",
  color: "white",
};

const switchStyle: React.CSSProperties = {
  marginTop: 18,
  width: "100%",
  background: "transparent",
  border: "none",
  color: "#38bdf8",
  cursor: "pointer",
};