"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function ResidentRequestForm() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("org") || searchParams.get("organization_id");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!orgId) {
      setMessage("Invalid request link. Please scan the QR code again.");
      return;
    }

    setLoading(true);
    setMessage("");

    let imageUrl = null;

    if (photo) {
      const fileName = `${orgId}/${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

      const { error: uploadError } = await supabase.storage
        .from("request-attachments")
        .upload(fileName, photo);

      if (uploadError) {
        setMessage(uploadError.message);
        setLoading(false);
        return;
      }

      const { data } = supabase.storage
        .from("request-attachments")
        .getPublicUrl(fileName);

      imageUrl = data.publicUrl;
    }

    const { error } = await supabase.from("maintenance_requests").insert([
      {
        organization_id: orgId,
        resident_name: name,
        resident_phone: phone,
        address,
        description,
        status: "New",
        priority: "Medium",
        attachment_url: imageUrl,
      },
    ]);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Request submitted successfully.");
      setName("");
      setPhone("");
      setAddress("");
      setDescription("");
      setPhoto(null);
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-lg bg-slate-800 p-6 rounded-xl space-y-4">
        <h1 className="text-2xl font-bold">Maintenance Request</h1>

        {message && <div className="text-sm text-yellow-300">{message}</div>}

        <input placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-3 rounded bg-slate-700" />
        <input placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-3 rounded bg-slate-700" />
        <input placeholder="Address / Lot Number" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full p-3 rounded bg-slate-700" />
        <textarea placeholder="Describe the issue" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-3 rounded bg-slate-700" />

        <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />

        <button type="submit" disabled={loading} className="w-full bg-blue-500 p-3 rounded font-bold">
          {loading ? "Submitting..." : "Submit Request"}
        </button>
      </form>
    </main>
  );
}

export default function ResidentRequestPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading...</main>}>
      <ResidentRequestForm />
    </Suspense>
  );
}