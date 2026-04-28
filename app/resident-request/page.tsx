"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const CATEGORY_OPTIONS = [
  "Leave Unselected",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Appliance",
  "Roofing",
  "Grounds / Exterior",
  "Pest Control",
  "Safety Concern",
  "General Maintenance",
];

function ResidentRequestForm() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("org") || searchParams.get("organization_id") || "";

  const [residentName, setResidentName] = useState("");
  const [residentPhone, setResidentPhone] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState("Leave Unselected");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      !!orgId &&
      residentName.trim().length > 0 &&
      residentPhone.trim().length > 0 &&
      address.trim().length > 0 &&
      description.trim().length > 0 &&
      !submitting
    );
  }, [orgId, residentName, residentPhone, address, description, submitting]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!orgId) {
      setMessage("This request link is missing a community ID. Please scan the community QR code again.");
      return;
    }

    if (!residentName.trim() || !residentPhone.trim() || !address.trim() || !description.trim()) {
      setMessage("Please fill out your name, phone, address, and request details.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;

      if (photo) {
        const safeFileName = photo.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `${orgId}/${Date.now()}-${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("request-attachments")
          .upload(filePath, photo, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("request-attachments")
          .getPublicUrl(filePath);

        attachmentUrl = publicUrlData.publicUrl;
        attachmentName = photo.name;
      }

      const { error: insertError } = await supabase.from("maintenance_requests").insert([
        {
          organization_id: orgId,
          resident_name: residentName.trim(),
          resident_phone: residentPhone.trim(),
          address: address.trim(),
          category: category === "Leave Unselected" ? null : category,
          description: description.trim(),
          status: "New",
          priority: "Medium",
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        },
      ]);

      if (insertError) throw insertError;

      setSubmitted(true);
      setResidentName("");
      setResidentPhone("");
      setAddress("");
      setCategory("Leave Unselected");
      setDescription("");
      setPhoto(null);
      setMessage("Your maintenance request was submitted successfully.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong while submitting your request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1e293b_0%,_#0f172a_45%,_#020617_100%)] px-4 py-8 text-white">
      <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-xl font-bold text-amber-200">
            KJD
          </div>

          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Resident Maintenance Request
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Need Maintenance?
          </h1>

          <p className="mt-3 text-slate-300">
            Submit your request below. No account is required.
          </p>
        </div>

        {!orgId && (
          <div className="mb-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            Missing community ID. Please scan the QR code provided by your community.
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            {message}
          </div>
        )}

        {submitted ? (
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-6 text-center">
            <h2 className="text-2xl font-bold text-emerald-200">
              Request Submitted
            </h2>
            <p className="mt-3 text-slate-300">
              Your maintenance request has been received. Your community team will review it as soon as possible.
            </p>

            <button
              onClick={() => {
                setSubmitted(false);
                setMessage("");
              }}
              className="mt-6 rounded-2xl bg-sky-500 px-5 py-3 font-bold text-white transition hover:bg-sky-600"
            >
              Submit Another Request
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-amber-200">
                Your Name
              </label>
              <input
                value={residentName}
                onChange={(e) => setResidentName(e.target.value)}
                placeholder="Example: Jane Smith"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-amber-200">
                Phone Number
              </label>
              <input
                value={residentPhone}
                onChange={(e) => setResidentPhone(e.target.value)}
                placeholder="Best number to reach you"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-amber-200">
                Address / Lot Number
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Example: Lot 42 or 123 Main St."
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-amber-200">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
              >
                {CATEGORY_OPTIONS.map((item) => (
                  <option className="text-black" key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-amber-200">
                Maintenance Request Details
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what needs repaired or looked at..."
                className="min-h-32 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-amber-200">
                Photo Upload Optional
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-sky-500 file:px-4 file:py-2 file:font-semibold file:text-white"
              />

              {photo && (
                <p className="mt-2 text-sm text-slate-400">
                  Selected: {photo.name}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-2xl bg-amber-400 px-5 py-4 font-bold text-slate-950 shadow-lg transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Maintenance Request"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export default function ResidentRequestPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
          Loading maintenance request form...
        </main>
      }
    >
      <ResidentRequestForm />
    </Suspense>
  );
}
