"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { label } from "@/lib/utils";
import type { Organisation } from "@/lib/types";

const supabase = createClient();

export default function ProfilePage() {
  const router = useRouter();
  const { session, profile } = useApp();
  const { flash } = useToast();
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);

  const [form, setForm] = useState({
    display_name: "",
    phone: "",
    job_title: "",
    department: "",
    employee_id: "",
    start_date: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || "",
        phone: profile.phone || "",
        job_title: profile.job_title || "",
        department: profile.department || "",
        employee_id: profile.employee_id || "",
        start_date: profile.start_date || "",
        address: profile.address || "",
        emergency_contact_name: profile.emergency_contact_name || "",
        emergency_contact_phone: profile.emergency_contact_phone || "",
      });

      if (profile.organisation_id) {
        supabase
          .from("organisations")
          .select("*")
          .eq("id", profile.organisation_id)
          .single()
          .then(({ data }) => {
            if (data) setOrganisation(data as Organisation);
          });
      }

      if (profile.role !== "admin" && session) {
        supabase
          .from("invite_requests")
          .select("status")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setInviteStatus(data.status);
          });
      }
    }
  }, [profile, session]);

  const saveProfile = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const patch = {
      display_name: form.display_name.trim(),
      phone: form.phone.trim(),
      job_title: form.job_title.trim(),
      department: form.department.trim(),
      employee_id: form.employee_id.trim(),
      start_date: form.start_date || null,
      address: form.address.trim(),
      emergency_contact_name: form.emergency_contact_name.trim(),
      emergency_contact_phone: form.emergency_contact_phone.trim(),
    };

    const { error } = await supabase.from("profiles").update(patch).eq("user_id", session.user.id);
    if (error) { flash(error.message); return; }

    if (inviteStatus === null && profile?.organisation_id && profile.role !== "admin") {
      const { error: inviteError } = await supabase.from("invite_requests").upsert({
        user_id: session.user.id,
        organisation_id: profile.organisation_id,
        status: "pending",
      }, { onConflict: "user_id,organisation_id" });
      if (!inviteError) setInviteStatus("pending");
    }

    flash("Profile saved. Your invite request has been sent to the admin.");
  }, [session, form, inviteStatus, profile, supabase, flash]);

  const isApproved = profile?.role === "admin" || inviteStatus === "approved";
  const displayRole = isApproved ? (profile?.role || "viewer") : "user";
  const displayStatus = isApproved ? (profile?.status || "active") : "uninvited";

  return (
    <div className="board-scroll overflow-auto min-h-0">
      <section className="overview p-[16px_18px] overflow-auto grid gap-[14px] content-start animate-[fadeInUp_0.3s_ease_both]">
        {inviteStatus === "pending" && (
          <div className="border border-[#fde68a] bg-[#fffbeb] text-crm-amber rounded-[var(--radius,8px)] p-[10px_12px] text-[13px] flex items-center gap-2">
            <span>&#9203;</span>
            <span>
              Your request to join <strong>{organisation?.name || "your organisation"}</strong> is pending approval from the admin.
              You'll get access once they approve your invite.
            </span>
          </div>
        )}
        {inviteStatus === "approved" && (
          <div className="border border-[#bbf7d0] bg-[#f0fdf4] text-crm-green rounded-[var(--radius,8px)] p-[10px_12px] text-[13px] flex items-center gap-2">
            <span>&#10003;</span>
            <span>
              You're now a member of <strong>{organisation?.name || "your organisation"}</strong>.
            </span>
          </div>
        )}
        {!inviteStatus && !profile?.organisation_id && (
          <div className="border border-[#d9e0e8] bg-crm-panel-strong rounded-[var(--radius,8px)] p-[10px_12px] text-[13px] flex items-center gap-2 flex-wrap">
            <span>&#9432;</span>
            <span className="flex-1">
              You haven't joined an organisation yet.
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/onboarding/setup")}
                className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[32px] rounded-[6px] px-3 text-[12px] whitespace-nowrap hover:brightness-105"
              >
                Set up your company
              </button>
              <button
                onClick={() => router.push("/organisations")}
                className="min-h-[32px] rounded-[6px] px-3 text-[12px] whitespace-nowrap"
              >
                Browse organisations
              </button>
            </div>
          </div>
        )}

        <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 content-start">
          <h2 className="m-0 text-[15px]">Account</h2>
          <div className="grid gap-[7px] text-[12px]">
            <div className="grid grid-cols-[minmax(80px,130px)_minmax(0,1fr)] gap-[10px] border border-crm-line rounded-[7px] p-[8px_10px] items-center">
              <strong className="text-crm-muted text-[12px]">Email</strong>
              <span>{profile?.email || ""}</span>
            </div>
            <div className="grid grid-cols-[minmax(80px,130px)_minmax(0,1fr)] gap-[10px] border border-crm-line rounded-[7px] p-[8px_10px] items-center">
              <strong className="text-crm-muted text-[12px]">Organisation</strong>
              <span>{organisation?.name || "—"}</span>
            </div>
            <div className="grid grid-cols-[minmax(80px,130px)_minmax(0,1fr)] gap-[10px] border border-crm-line rounded-[7px] p-[8px_10px] items-center">
              <strong className="text-crm-muted text-[12px]">Role</strong>
              <span className="inline-flex items-center h-[20px] rounded-[10px] px-2 text-[11px] font-bold uppercase tracking-[.02em] bg-[rgba(15,118,110,.12)] text-crm-accent-strong w-fit">
                {label(displayRole)}
              </span>
            </div>
            <div className="grid grid-cols-[minmax(80px,130px)_minmax(0,1fr)] gap-[10px] border border-crm-line rounded-[7px] p-[8px_10px] items-center">
              <strong className="text-crm-muted text-[12px]">Status</strong>
              <span>{label(displayStatus)}</span>
            </div>
          </div>
        </div>

        <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 content-start">
          <h2 className="m-0 text-[15px]">HR details</h2>
          <form onSubmit={saveProfile} className="grid gap-3">
            <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
              Display name
              <input name="display_name" value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
            </label>
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-[10px]">
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Phone
                <input name="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </label>
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Job title
                <input name="job_title" value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))} />
              </label>
            </div>
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-[10px]">
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Department
                <input name="department" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
              </label>
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Employee ID
                <input name="employee_id" value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} />
              </label>
            </div>
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-[10px]">
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Start date
                <input name="start_date" type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              </label>
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Address
                <input name="address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </label>
            </div>
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-[10px]">
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Emergency contact name
                <input name="emergency_contact_name" value={form.emergency_contact_name} onChange={(e) => setForm((f) => ({ ...f, emergency_contact_name: e.target.value }))} />
              </label>
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Emergency contact phone
                <input name="emergency_contact_phone" value={form.emergency_contact_phone} onChange={(e) => setForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))} />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="submit"
                className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[34px] rounded-[6px] px-3">
                Save profile
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
