"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useCallback, useState } from "react";
import { label, money } from "@/lib/utils";
import { SERVICE_UNITS } from "@/lib/types";
import type { CrmService } from "@/lib/types";

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
      <div className="board-scroll overflow-auto min-h-0">
        <section className="overview p-[16px_18px]">
          <div className="text-crm-muted border border-dashed border-crm-line rounded-[var(--radius,8px)] p-4">
            Only admins can access the pricing calculator.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="board-scroll overflow-auto min-h-0">
      <section className="overview p-[16px_18px] overflow-auto grid gap-[14px] content-start animate-[fadeInUp_0.3s_ease_both]">
        <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 content-start">
          <h2 className="m-0 text-[15px]">{editing ? "Edit service" : "Add a service"}</h2>
          <form onSubmit={saveService} className="grid gap-3">
            <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
              Service name
              <input name="name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Website build" required />
            </label>
            <div className="grid grid-cols-2 gap-[10px]">
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Unit price (USD)
                <input name="unit_price" type="number" min="0" step="1" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} required />
              </label>
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Billed
                <select value={formUnit} onChange={(e) => setFormUnit(e.target.value)}>
                  {SERVICE_UNITS.map((u) => <option key={u} value={u}>{label(u)}</option>)}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              {editing && <button type="button" onClick={cancelEdit}>Cancel</button>}
              <button type="submit"
                className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[34px] rounded-[6px] px-3">
                {editing ? "Save changes" : "Add service"}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 content-start">
          <h2 className="m-0 text-[15px]">Service catalog ({services.length})</h2>
          <div className="grid gap-2">
            <div className="grid grid-cols-[minmax(0,1fr)_100px_100px_auto] gap-[10px] items-center border border-crm-line rounded-[7px] p-[9px_10px] text-[12px] bg-crm-panel-strong text-crm-muted font-bold">
              <span>Service</span><span>Billed</span><span>Price</span><span></span>
            </div>
            {services.length === 0 ? (
              <div className="text-crm-muted border border-dashed border-crm-line rounded-[var(--radius,8px)] p-4">No services yet. Add your first service above.</div>
            ) : services.map((svc) => (
              <div key={svc.id} className="grid grid-cols-[minmax(0,1fr)_100px_100px_auto] gap-[10px] items-center border border-crm-line rounded-[7px] p-[9px_10px] text-[12px]">
                <strong className="text-[13px]">{svc.name}</strong>
                <span className="text-crm-muted">{label(svc.unit_label)}</span>
                <span className="text-crm-muted">{money(svc.unit_price)}</span>
                <div className="flex gap-[6px] justify-end">
                  <button onClick={() => editService(svc)} className="text-[12px] min-h-auto py-1 px-2">Edit</button>
                  <button onClick={() => deleteService(svc.id)} className="w-[28px] min-h-[28px] text-crm-rose">&times;</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 content-start">
          <h2 className="m-0 text-[15px]">Quote calculator</h2>
          <div className="calc-grid grid gap-2">
            {services.length === 0 ? (
              <div className="text-crm-muted border border-dashed border-crm-line rounded-[var(--radius,8px)] p-4">
                Add services to the catalog to start calculating a quote.
              </div>
            ) : services.map((svc) => (
              <div key={svc.id} className="grid grid-cols-[minmax(0,1fr)_130px_80px_100px] max-md:grid-cols-1 gap-[10px] items-center border border-crm-line rounded-[7px] p-[8px_10px] text-[12px]">
                <strong className="text-[13px]">{svc.name}</strong>
                <span className="text-crm-muted">{money(svc.unit_price)} / {label(svc.unit_label)}</span>
                <input type="number" min="0" step="1" value={calcQty[svc.id] || 0}
                  onChange={(e) => setCalcQty((prev) => ({ ...prev, [svc.id]: Math.max(0, Number(e.target.value) || 0) }))}
                  className="h-[32px] px-2" aria-label={"Quantity for " + svc.name} />
                <span className="font-bold text-crm-text text-right">{money((calcQty[svc.id] || 0) * Number(svc.unit_price))}</span>
              </div>
            ))}
          </div>
          <div className="calc-summary grid gap-[10px] mt-1">
            <div className="grid grid-cols-2 gap-[10px]">
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Discount %
                <input type="number" min="0" max="100" step="1" value={calcDiscount} onChange={(e) => setCalcDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
              </label>
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Tax %
                <input type="number" min="0" max="100" step="1" value={calcTax} onChange={(e) => setCalcTax(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
              </label>
            </div>
            <div className="flex justify-between items-center text-[13px] border border-crm-line rounded-[7px] p-[8px_10px]">
              <span>Subtotal</span><strong>{money(totals.subtotal)}</strong>
            </div>
            <div className="flex justify-between items-center text-[13px] border border-crm-line rounded-[7px] p-[8px_10px]">
              <span>Discount</span><strong>-{money(totals.discountAmount)}</strong>
            </div>
            <div className="flex justify-between items-center text-[13px] border border-crm-line rounded-[7px] p-[8px_10px]">
              <span>Tax</span><strong>+{money(totals.taxAmount)}</strong>
            </div>
            <div className="flex justify-between items-center text-[15px] font-extrabold border border-crm-line rounded-[7px] p-[8px_10px] bg-crm-panel-strong">
              <span>Total</span><strong>{money(totals.total)}</strong>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setCalcQty({}); setCalcDiscount(0); setCalcTax(0); }}>Reset calculator</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
