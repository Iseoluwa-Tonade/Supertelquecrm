"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { label } from "@/lib/utils";
import { COMPANY_TYPES, FEATURE_LABELS, NAV_VIEWS } from "@/lib/types";
import type { Organisation } from "@/lib/types";
import { Panel, PanelHead, PageHeader, Tag, Btn, Input, Field } from "@/components/kit.launchpad";

const supabase = createClient();

export default function ProfilePage() {
  const router = useRouter();
  const { session, profile, organisation: ctxOrg, refreshData } = useApp();
  const { flash } = useToast();
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);

  const isAdmin = profile?.role === "admin";
  const signupChoice = typeof window !== "undefined" ? sessionStorage.getItem("signup_choice") : null;
  const [profileSaved, setProfileSaved] = useState(!!profile?.display_name);

  const [orgForm, setOrgForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    website: "",
    company_type: "agency",
  });
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([]);

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
            if (data) {
              const org = data as Organisation;
              setOrganisation(org);
              if (isAdmin) {
                setOrgForm({
                  name: org.name || "",
                  email: org.email || "",
                  phone: org.phone || "",
                  address: org.address || "",
                  website: org.website || "",
                  company_type: org.company_type || "agency",
                });
                setEnabledFeatures(org.enabled_features || []);
              }
            }
          });
      }

      if (!isAdmin && session) {
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
  }, [profile, session, isAdmin]);

  useEffect(() => {
    if (orgForm.company_type && enabledFeatures.length === 0) {
      const ct = COMPANY_TYPES.find((t) => t.id === orgForm.company_type);
      if (ct) setEnabledFeatures(ct.defaultFeatures);
    }
  }, [orgForm.company_type]);

  function toggleFeature(id: string) {
    setEnabledFeatures((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

  const saveOrgSettings = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !profile?.organisation_id) return;
    if (enabledFeatures.length === 0) {
      flash("Select at least one feature");
      return;
    }
    const { error } = await supabase
      .from("organisations")
      .update({
        name: orgForm.name.trim(),
        email: orgForm.email.trim(),
        phone: orgForm.phone.trim(),
        address: orgForm.address.trim(),
        website: orgForm.website.trim(),
        company_type: orgForm.company_type,
        enabled_features: enabledFeatures,
      })
      .eq("id", profile.organisation_id);
    if (error) { flash(error.message); return; }
    await refreshData();
    flash("Organisation settings saved");
  }, [session, profile, orgForm, enabledFeatures, supabase, flash, refreshData]);

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

    setProfileSaved(true);

    if (inviteStatus === null && profile?.organisation_id && !isAdmin) {
      const { error: inviteError } = await supabase.from("invite_requests").upsert({
        user_id: session.user.id,
        organisation_id: profile.organisation_id,
        status: "pending",
      }, { onConflict: "user_id,organisation_id" });
      if (!inviteError) setInviteStatus("pending");
    }

    flash(isAdmin ? "Profile saved" : "Profile saved. Your invite request has been sent to the admin.");
  }, [session, form, inviteStatus, profile, isAdmin, supabase, flash]);

  const displayRole = isAdmin ? (profile?.role || "admin") : (inviteStatus === "approved" ? (profile?.role || "viewer") : "user");
  const displayStatus = isAdmin ? (profile?.status || "active") : (inviteStatus === "approved" ? (profile?.status || "active") : "uninvited");
  const selectedType = COMPANY_TYPES.find((t) => t.id === orgForm.company_type);

  return (
    <div className="space-y-6">
      <PageHeader variant="account"
        eyebrow="Account"
        title="My profile"
        desc={isAdmin ? "Manage your organisation and personal settings." : "View and edit your personal details."}
      />

      {inviteStatus === "pending" && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning flex items-center gap-2">
          <span>&#9203;</span>
          <span>Your request to join <strong>{organisation?.name || "your organisation"}</strong> is pending approval from the admin.</span>
        </div>
      )}
      {inviteStatus === "approved" && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success flex items-center gap-2">
          <span>&#10003;</span>
          <span>You're now a member of <strong>{organisation?.name || "your organisation"}</strong>.</span>
        </div>
      )}
      {!inviteStatus && !profile?.organisation_id && (
        <div className="rounded-lg border border-border bg-surface p-3 text-sm flex items-center gap-2 flex-wrap">
          <span>&#9432;</span>
          <span className="flex-1">You haven't joined an organisation yet.</span>
          {signupChoice === "org" ? (
            <Btn size="sm" variant="primary" disabled={!profileSaved} onClick={() => router.push("/onboarding/setup")}>Set up your company</Btn>
          ) : signupChoice === "team" ? (
            <Btn size="sm" variant="primary" disabled={!profileSaved} onClick={() => router.push("/organisations")}>Browse organisations</Btn>
          ) : (
            <>
              <Btn size="sm" variant="primary" disabled={!profileSaved} onClick={() => router.push("/onboarding/setup")}>Set up your company</Btn>
              <Btn size="sm" variant="primary" disabled={!profileSaved} onClick={() => router.push("/organisations")}>Browse organisations</Btn>
            </>
          )}
        </div>
      )}

      <Panel>
        <PanelHead title="Account" />
        <div className="space-y-1 p-4 text-sm">
          {[
            ["Email", profile?.email],
            ["Organisation", organisation?.name || "—"],
            ["Role", <Tag key="role" tone="primary">{label(displayRole)}</Tag>],
            ["Status", label(displayStatus)],
          ].map(([k, v]) => (
            <div key={k as string} className="grid grid-cols-[120px_1fr] gap-2 rounded-lg border border-border bg-surface p-2 items-center">
              <span className="text-muted-foreground">{k as string}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </Panel>

      {isAdmin ? (
        <>
          <Panel>
            <PanelHead title="Organisation settings" />
            <form onSubmit={saveOrgSettings} className="space-y-3 p-4">
              <Field label="Company name">
                <Input value={orgForm.name} onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))} required />
              </Field>
              <Field label="Company email">
                <Input type="email" value={orgForm.email} onChange={(e) => setOrgForm((f) => ({ ...f, email: e.target.value }))} />
              </Field>
              <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3">
                <Field label="Phone">
                  <Input value={orgForm.phone} onChange={(e) => setOrgForm((f) => ({ ...f, phone: e.target.value }))} />
                </Field>
                <Field label="Website">
                  <Input value={orgForm.website} onChange={(e) => setOrgForm((f) => ({ ...f, website: e.target.value }))} />
                </Field>
              </div>
              <Field label="Address">
                <Input value={orgForm.address} onChange={(e) => setOrgForm((f) => ({ ...f, address: e.target.value }))} />
              </Field>

              <hr className="border-border" />

              <Field label="Company type">
                <select value={orgForm.company_type} onChange={(e) => setOrgForm((f) => ({ ...f, company_type: e.target.value }))} className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
                  {COMPANY_TYPES.map((ct) => (
                    <option key={ct.id} value={ct.id}>{ct.label}</option>
                  ))}
                </select>
                {selectedType && <span className="block mt-1 text-xs text-muted-foreground">{selectedType.description}</span>}
              </Field>

              <hr className="border-border" />

              <Field label="Enabled CRM features">
                <span className="block text-xs text-muted-foreground font-normal">Toggle pages your company needs. Disabled features are hidden from the sidebar.</span>
              </Field>
              <div className="grid grid-cols-2 max-md:grid-cols-1 gap-2">
                {NAV_VIEWS.filter((v) => v.id !== "profile").map((view) => (
                  <label key={view.id} className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm cursor-pointer transition-colors ${
                    enabledFeatures.includes(view.id) ? "border-primary bg-primary/5" : "border-border bg-surface"
                  }`}>
                    <input type="checkbox" checked={enabledFeatures.includes(view.id)} onChange={() => toggleFeature(view.id)} className="h-4 w-4 shrink-0" />
                    <span>{FEATURE_LABELS[view.id] || view.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">My Profile is always available.</p>

              <div className="flex justify-end">
                <Btn type="submit" variant="primary">Save organisation settings</Btn>
              </div>
            </form>
          </Panel>

          <Panel>
            <PanelHead title="Your profile" />
            <form onSubmit={saveProfile} className="space-y-3 p-4">
              <Field label="Display name">
                <Input name="display_name" value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
              </Field>
              <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3">
                <Field label="Phone">
                  <Input name="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </Field>
                <Field label="Job title">
                  <Input name="job_title" value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))} />
                </Field>
              </div>
              <div className="flex justify-end">
                <Btn type="submit" variant="primary">Save profile</Btn>
              </div>
            </form>
          </Panel>
        </>
      ) : (
        <Panel>
          <PanelHead title="HR details" />
          <form onSubmit={saveProfile} className="space-y-3 p-4">
            <Field label="Display name">
              <Input name="display_name" value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3">
              <Field label="Phone">
                <Input name="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </Field>
              <Field label="Job title">
                <Input name="job_title" value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3">
              <Field label="Department">
                <Input name="department" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
              </Field>
              <Field label="Employee ID">
                <Input name="employee_id" value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3">
              <Field label="Start date">
                <Input name="start_date" type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              </Field>
              <Field label="Address">
                <Input name="address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3">
              <Field label="Emergency contact name">
                <Input name="emergency_contact_name" value={form.emergency_contact_name} onChange={(e) => setForm((f) => ({ ...f, emergency_contact_name: e.target.value }))} />
              </Field>
              <Field label="Emergency contact phone">
                <Input name="emergency_contact_phone" value={form.emergency_contact_phone} onChange={(e) => setForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Btn type="submit" variant="primary">Save profile</Btn>
            </div>
          </form>
        </Panel>
      )}
    </div>
  );
}
