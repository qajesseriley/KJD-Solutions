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
          setMessage("Account created. Please check your email and confirm your account before signing in.");
        } else {
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
        <div style={logoWrapStyle}>
          <Image
            src="/kjd-logo.png"
            alt="KJD Solutions Logo"
            width={210}
            height={210}
            priority
            style={logoStyle}
          />

          <h1 style={titleStyle}>
            {mode === "login" ? "Employee Login" : "Create Account"}
          </h1>

          <p style={subtitleStyle}>KJD Solutions Maintenance Portal</p>
        </div>

        <form onSubmit={handleSubmit} style={formStyle}>
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

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top, #10233a 0%, #05070b 55%, #000000 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  fontFamily: "Arial, sans-serif",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  background: "rgba(10, 15, 25, 0.96)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 24,
  padding: "34px 34px 30px",
  boxShadow: "0 25px 80px rgba(0,0,0,0.65)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const logoWrapStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "center",
  marginBottom: 22,
};

const logoStyle: React.CSSProperties = {
  width: 210,
  height: 210,
  objectFit: "contain",
  display: "block",
  margin: "0 auto 10px",
};

const titleStyle: React.CSSProperties = {
  color: "white",
  fontSize: 22,
  margin: "0 0 6px",
  textAlign: "center",
};

const subtitleStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.65)",
  fontSize: 14,
  margin: 0,
  textAlign: "center",
};

const formStyle: React.CSSProperties = {
  width: "100%",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 15,
  borderRadius: 14,
  border: "1px solid #334155",
  background: "#020617",
  color: "white",
  marginBottom: 14,
  fontSize: 16,
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: 15,
  borderRadius: 14,
  border: "none",
  background: "#0284c7",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: 16,
};

const messageStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: 16,
  padding: 12,
  borderRadius: 12,
  background: "#111827",
  color: "white",
  border: "1px solid #374151",
  textAlign: "center",
};

const switchStyle: React.CSSProperties = {
  marginTop: 20,
  width: "100%",
  background: "transparent",
  border: "none",
  color: "#38bdf8",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: 15,
};