"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PackagePlus, RefreshCw } from "lucide-react";
import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { money } from "@/lib/utils";
import { PageHeader, Panel, PanelHead, Stat, Tag, Btn, Input, Field, DropdownSelect } from "@/components/kit.launchpad";

const supabase = createClient();

type StockItem = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  location: string | null;
  stock: number;
  reorder_point: number;
  unit_cost: number;
  unit_price: number;
};

type StockMove = {
  id: string;
  inventory_item_id: string;
  movement_type: "inbound" | "outbound" | "adjustment";
  quantity: number;
  reference: string | null;
  occurred_at: string;
};

export default function InventoryPage() {
  const { organisation, session, profile } = useApp();
  const { flash } = useToast();
  const canManage = profile?.role === "admin" || profile?.role === "manager";
  const showCost = canManage;

  const [items, setItems] = useState<StockItem[]>([]);
  const [moves, setMoves] = useState<StockMove[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [stock, setStock] = useState("0");
  const [reorder, setReorder] = useState("0");
  const [cost, setCost] = useState("0");
  const [price, setPrice] = useState("0");
  const [moveItem, setMoveItem] = useState("");
  const [moveType, setMoveType] = useState("inbound");
  const [moveQty, setMoveQty] = useState("");
  const [moveRef, setMoveRef] = useState("");

  const load = useCallback(async () => {
    if (!organisation?.id) return;
    setLoading(true);
    const [itemRes, moveRes] = await Promise.all([
      supabase.from("crm_inventory_items").select("*").eq("organisation_id", organisation.id).eq("active", true).order("name"),
      supabase.from("crm_inventory_movements").select("id,inventory_item_id,movement_type,quantity,reference,occurred_at").eq("organisation_id", organisation.id).order("occurred_at", { ascending: false }).limit(20),
    ]);
    if (itemRes.error) flash(itemRes.error.message);
    if (moveRes.error) flash(moveRes.error.message);
    setItems((itemRes.data || []) as StockItem[]);
    setMoves((moveRes.data || []) as StockMove[]);
    setLoading(false);
  }, [organisation?.id, flash]);

  useEffect(() => { load(); }, [load]);

  const stockValue = useMemo(() => items.reduce((sum, item) => sum + Number(item.stock) * Number(item.unit_cost), 0), [items]);
  const belowReorder = useMemo(() => items.filter((item) => Number(item.stock) <= Number(item.reorder_point)).length, [items]);
  const recentMoves = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return moves.filter((m) => new Date(m.occurred_at).getTime() >= cutoff).length;
  }, [moves]);

  async function addItem(event: React.FormEvent) {
    event.preventDefault();
    if (!organisation?.id || !session?.user.id || !canManage) return;
    const { error } = await supabase.from("crm_inventory_items").insert({
      organisation_id: organisation.id,
      sku: sku.trim(),
      name: name.trim(),
      category: category.trim() || null,
      location: location.trim() || null,
      stock: Number(stock) || 0,
      reorder_point: Number(reorder) || 0,
      unit_cost: Number(cost) || 0,
      unit_price: Number(price) || 0,
      created_by: session.user.id,
    });
    if (error) { flash(error.message); return; }
    setSku(""); setName(""); setCategory(""); setLocation(""); setStock("0"); setReorder("0"); setCost("0"); setPrice("0");
    setShowAdd(false);
    await load();
    flash("Inventory item added");
  }

  async function addMovement(event: React.FormEvent) {
    event.preventDefault();
    if (!organisation?.id || !session?.user.id || !canManage || !moveItem) return;
    const item = items.find((row) => row.id === moveItem);
    if (!item) return;
    const entered = Number(moveQty);
    if (!Number.isFinite(entered) || entered === 0) { flash("Enter a non-zero quantity"); return; }
    const delta = moveType === "outbound" ? -Math.abs(entered) : moveType === "inbound" ? Math.abs(entered) : entered;
    const nextStock = Math.max(0, Number(item.stock) + delta);
    const { error: moveError } = await supabase.from("crm_inventory_movements").insert({
      organisation_id: organisation.id,
      inventory_item_id: item.id,
      movement_type: moveType,
      quantity: delta,
      reference: moveRef.trim() || null,
      performed_by: session.user.id,
    });
    if (moveError) { flash(moveError.message); return; }
    const { error: itemError } = await supabase.from("crm_inventory_items").update({ stock: nextStock, updated_at: new Date().toISOString() }).eq("id", item.id).eq("organisation_id", organisation.id);
    if (itemError) { flash(itemError.message); return; }
    setMoveQty(""); setMoveRef("");
    await load();
    flash("Inventory movement saved");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        variant="delivery"
        eyebrow="Delivery"
        title="Inventory"
        desc="Live stock levels and movements from Supabase."
        actions={
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Btn>
            {canManage && <Btn variant="primary" size="sm" onClick={() => setShowAdd((v) => !v)}><PackagePlus className="h-4 w-4" />Add item</Btn>}
          </div>
        }
      />

      {showAdd && (
        <Panel>
          <PanelHead title="Add inventory item" />
          <form onSubmit={addItem} className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="SKU"><Input value={sku} onChange={(e) => setSku(e.target.value)} required /></Field>
            <Field label="Item name"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Category"><Input value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
            <Field label="Location"><Input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
            <Field label="Opening stock"><Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} /></Field>
            <Field label="Reorder point"><Input type="number" value={reorder} onChange={(e) => setReorder(e.target.value)} /></Field>
            <Field label="Unit cost"><Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
            <Field label="Unit price"><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
            <div className="md:col-span-2 xl:col-span-4 flex justify-end"><Btn type="submit" variant="primary">Save item</Btn></div>
          </form>
        </Panel>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="SKUs tracked" value={String(items.length)} delta="Live items" />
        <Stat label="Below reorder point" value={String(belowReorder)} delta="Needs action" positive={belowReorder === 0} />
        {showCost && <Stat label="Stock value" value={money(stockValue)} delta="At live unit cost" />}
        <Stat label="Movements (7d)" value={String(recentMoves)} delta="Live movement log" />
      </div>

      {canManage && items.length > 0 && (
        <Panel>
          <PanelHead title="Record stock movement" />
          <form onSubmit={addMovement} className="grid gap-3 p-4 md:grid-cols-4">
            <DropdownSelect value={moveItem} onChange={setMoveItem} ariaLabel="Inventory item" placeholder="Select item" options={[{ value: "", label: "Select item" }, ...items.map((i) => ({ value: i.id, label: `${i.sku} — ${i.name}` }))]} />
            <DropdownSelect value={moveType} onChange={setMoveType} ariaLabel="Movement type" placeholder="Choose movement" options={[{ value: "inbound", label: "Inbound" }, { value: "outbound", label: "Outbound" }, { value: "adjustment", label: "Adjustment (+/-)" }]} />
            <Input type="number" step="0.01" value={moveQty} onChange={(e) => setMoveQty(e.target.value)} placeholder="Quantity" required />
            <Input value={moveRef} onChange={(e) => setMoveRef(e.target.value)} placeholder="Reference (optional)" />
            <div className="md:col-span-4 flex justify-end"><Btn type="submit" variant="primary">Save movement</Btn></div>
          </form>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead title="Stock on hand" hint="Live inventory levels" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead><tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left">SKU</th><th className="px-4 py-2.5 text-left">Item</th><th className="px-4 py-2.5 text-left">Location</th><th className="px-4 py-2.5 text-right">On hand</th><th className="px-4 py-2.5 text-right">Reorder</th>{showCost && <th className="px-4 py-2.5 text-right">Cost</th>}<th className="px-4 py-2.5 text-right">Price</th><th className="px-4 py-2.5 text-left">Status</th>
              </tr></thead>
              <tbody>
                {items.length === 0 ? <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No live inventory items yet.</td></tr> : items.map((item) => {
                  const state = Number(item.stock) === 0 ? "danger" : Number(item.stock) <= Number(item.reorder_point) ? "warning" : "success";
                  return <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                    <td className="px-4 py-3"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.category || "—"}</p></td>
                    <td className="px-4 py-3 text-muted-foreground">{item.location || "—"}</td>
                    <td className="px-4 py-3 text-right num">{item.stock}</td>
                    <td className="px-4 py-3 text-right num text-muted-foreground">{item.reorder_point}</td>
                    {showCost && <td className="px-4 py-3 text-right num">{money(Number(item.unit_cost))}</td>}
                    <td className="px-4 py-3 text-right num">{money(Number(item.unit_price))}</td>
                    <td className="px-4 py-3"><Tag tone={state}>{state === "danger" ? "Out" : state === "warning" ? "Reorder" : "In stock"}</Tag></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Recent movements" hint="Live stock changes" />
          <div className="divide-y divide-border">
            {moves.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No stock movements yet.</div> : moves.slice(0, 10).map((move) => {
              const item = items.find((row) => row.id === move.inventory_item_id);
              return <div key={move.id} className="px-4 py-3 text-xs">
                <div className="flex items-center justify-between gap-2"><span className="font-medium">{item?.name || "Inventory item"}</span><Tag tone={move.movement_type === "inbound" ? "success" : move.movement_type === "outbound" ? "danger" : "info"}>{move.movement_type}</Tag></div>
                <div className="mt-1 flex justify-between text-muted-foreground"><span>{move.reference || "No reference"}</span><span className="num">{move.quantity > 0 ? "+" : ""}{move.quantity}</span></div>
              </div>;
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
