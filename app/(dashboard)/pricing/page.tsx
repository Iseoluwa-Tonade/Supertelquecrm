"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useCallback, useState } from "react";
import { label, money } from "@/lib/utils";
import { SERVICE_UNITS } from "@/lib/types";
import type { CrmService } from "@/lib/types";
import { Panel, PanelHead, PageHeader, Tag, Btn, Input, Field, DropdownSelect } from "@/components/kit.launchpad";

const supabase = createClient();

export default function PricingPage() {
  const { session, profile, services, editingServiceId, setEditingServiceId, loadServices } = useApp();
  const { flash } = useToast();
  const [calcQty, setCalcQty] = useState<Record<string, number>>({});
  const [calcDiscount, setCalcDiscount] = useState(0);
  const [calcTax, setCalcTax] = useState(0);

  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formUnit, setFormUnit] = useState("flat");

  const isAdmin = profile?.role === "admin";
  const editing = editingServiceId ? services.find((s) => s.id === editingServiceId) : null;

  const saveService = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!formName.trim()) { flash("Enter a service name"); return; }
    const payload = { name: formName.trim(), unit_label: formUnit, unit_price: Number(formPrice) || 0 };

    if (editingServiceId) {
      const { error } = await supabase.from("crm_services").update(payload).eq("id", editingServiceId);
      if (error) { flash(error.message); return; }
      setEditingServiceId(null);
    } else {
      const { error } = await supabase.from("crm_services").insert(payload);
      if (error) { flash(error.message); return; }
    }
    await loadServices();
    setFormName(""); setFormPrice(""); setFormUnit("flat");
    flash(editingServiceId ? "Service updated" : "Service added");
  }, [isAdmin, formName, formPrice, formUnit, editingServiceId, supabase, setEditingServiceId, loadServices, flash]);

  const deleteService = useCallback(async (id: string) => {
    if (!confirm("Delete this service?")) return;
    const { error } = await supabase.from("crm_services").delete().eq("id", id);
    if (error) { flash(error.message); return; }
    await loadServices();
    setCalcQty((prev) => { const n = { ...prev }; delete n[id]; return n; });
    flash("Service deleted");
  }, [supabase, loadServices, flash]);

  function computeTotals() {
    const subtotal = services.reduce((sum, s) => {
      const qty = Number(calcQty[s.id]) || 0;
      return sum + qty * Number(s.unit_price || 0);
    }, 0);
    const discountAmount = subtotal * (Number(calcDiscount) || 0) / 100;
    const taxable = subtotal - discountAmount;
    const taxAmount = taxable * (Number(calcTax) || 0) / 100;
    return { subtotal, discountAmount, taxAmount, total: taxable + taxAmount };
  }

  function editService(svc: CrmService) {
    setEditingServiceId(svc.id);
    setFormName(svc.name);
    setFormPrice(String(svc.unit_price));
    setFormUnit(svc.unit_label);
  }

  function cancelEdit() {
    setEditingServiceId(null);
    setFormName(""); setFormPrice(""); setFormUnit("flat");
  }

  const totals = computeTotals();

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader variant="revenue" eyebrow="Revenue" title="Pricing" />
        <Panel className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Only admins can access the pricing calculator.</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader variant="revenue"
        eyebrow="Revenue"
        title="Pricing"
        desc="Manage your service catalog and calculate quotes on the fly."
      />

      <Panel>
        <PanelHead title={editing ? "Edit service" : "Add a service"} />
        <form onSubmit={saveService} className="space-y-3 p-4">
          <Field label="Service name">
            <Input name="name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Website build" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit price (USD)">
              <Input name="unit_price" type="number" min="0" step="1" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} required />
            </Field>
            <Field label="Billed">
              <DropdownSelect
                value={formUnit}
                onChange={setFormUnit}
                ariaLabel="Billed unit"
                placeholder="Choose a unit"
                options={SERVICE_UNITS.map((u) => ({ value: u, label: label(u) }))}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            {editing && <Btn type="button" onClick={cancelEdit}>Cancel</Btn>}
            <Btn type="submit" variant="primary">{editing ? "Save changes" : "Add service"}</Btn>
          </div>
        </form>
      </Panel>

      <Panel>
        <PanelHead title={`Service catalog (${services.length})`} />
        <div className="divide-y divide-border">
          {services.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No services yet. Add your first service above.</div>
          ) : services.map((svc) => (
            <div key={svc.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="flex-1 font-medium text-foreground">{svc.name}</span>
              <span className="text-muted-foreground">{label(svc.unit_label)}</span>
              <span className="num w-20 text-right text-foreground">{money(svc.unit_price)}</span>
              <div className="flex gap-1">
                <Btn size="sm" onClick={() => editService(svc)}>Edit</Btn>
                <Btn size="sm" variant="danger" onClick={() => deleteService(svc.id)}>&times;</Btn>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHead title="Quote calculator" />
        <div className="space-y-3 p-4">
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add services to the catalog to start calculating a quote.</p>
          ) : (
            <>
              <div className="divide-y divide-border rounded-lg border border-border">
                {services.map((svc) => (
                  <div key={svc.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="flex-1 font-medium text-foreground">{svc.name}</span>
                    <span className="text-xs text-muted-foreground">{money(svc.unit_price)} / {label(svc.unit_label)}</span>
                    <input type="number" min="0" step="1" value={calcQty[svc.id] || 0}
                      onChange={(e) => setCalcQty((prev) => ({ ...prev, [svc.id]: Math.max(0, Number(e.target.value) || 0) }))}
                      className="h-8 w-20 rounded-md border border-border bg-input px-2 text-sm text-foreground outline-none focus:border-primary/60" aria-label={"Quantity for " + svc.name} />
                    <span className="num w-24 text-right font-bold text-foreground">{money((calcQty[svc.id] || 0) * Number(svc.unit_price))}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Discount %">
                  <Input type="number" min="0" max="100" step="1" value={calcDiscount} onChange={(e) => setCalcDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
                </Field>
                <Field label="Tax %">
                  <Input type="number" min="0" max="100" step="1" value={calcTax} onChange={(e) => setCalcTax(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
                </Field>
              </div>

              <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Subtotal</span><span className="num font-medium">{money(totals.subtotal)}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Discount</span><span className="num font-medium text-destructive">-{money(totals.discountAmount)}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Tax</span><span className="num font-medium">+{money(totals.taxAmount)}</span></div>
                <div className="flex items-center justify-between border-t border-border pt-1 text-base font-bold text-foreground"><span>Total</span><span className="num">{money(totals.total)}</span></div>
              </div>

              <div className="flex justify-end">
                <Btn size="sm" onClick={() => { setCalcQty({}); setCalcDiscount(0); setCalcTax(0); }}>Reset calculator</Btn>
              </div>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
