"use client";

import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import { money, label } from "@/lib/utils";
import { PageHeader, Panel, PanelHead, Stat, Tag, Btn } from "@/components/kit.launchpad";
import { PackagePlus } from "lucide-react";

type StockItem = {
  sku: string;
  name: string;
  category: string;
  location: string;
  stock: number;
  reorder: number;
  cost: number;
  price: number;
};

type StockMove = {
  id: string;
  date: string;
  sku: string;
  type: "Inbound" | "Outbound" | "Adjustment";
  qty: number;
  ref: string;
  person: string;
};

const INVENTORY_DATA: StockItem[] = [
  { sku: "SKU-001", name: "Widget Pro", category: "Components", location: "Warehouse A", stock: 240, reorder: 100, cost: 12.5, price: 29.99 },
  { sku: "SKU-002", name: "Bolt M8 x 30mm", category: "Hardware", location: "Warehouse A", stock: 18, reorder: 200, cost: 0.8, price: 2.5 },
  { sku: "SKU-003", name: "Sensor Array v3", category: "Electronics", location: "Warehouse B", stock: 0, reorder: 50, cost: 45.0, price: 120.0 },
  { sku: "SKU-004", name: "Control Panel 2000", category: "Electronics", location: "Warehouse B", stock: 12, reorder: 15, cost: 210.0, price: 499.0 },
  { sku: "SKU-005", name: "Sealing Ring Kit", category: "Components", location: "Warehouse A", stock: 520, reorder: 300, cost: 3.2, price: 8.99 },
];

const STOCK_MOVES: StockMove[] = [
  { id: "M-001", date: "2026-07-28", sku: "SKU-002", type: "Outbound", qty: -24, ref: "Order #1042", person: "Chidi Okonkwo" },
  { id: "M-002", date: "2026-07-27", sku: "SKU-001", type: "Inbound", qty: 120, ref: "Purchase #882", person: "Warehouse Team" },
  { id: "M-003", date: "2026-07-26", sku: "SKU-004", type: "Outbound", qty: -3, ref: "Order #1039", person: "Chidi Okonkwo" },
  { id: "M-004", date: "2026-07-25", sku: "SKU-003", type: "Adjustment", qty: 0, ref: "Inventory audit", person: "Amara Okafor" },
];

export default function InventoryPage() {
  const { profile } = useApp();
  const showCost = profile?.role === "admin" || profile?.role === "manager";

  const stockValue = INVENTORY_DATA.reduce((s, i) => s + i.stock * i.cost, 0);
  const belowReorder = INVENTORY_DATA.filter((i) => i.stock <= i.reorder).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Delivery"
        title="Inventory"
        desc="Stock levels, movements and reorder tracking."
        actions={<Btn variant="primary" size="sm"><PackagePlus className="h-4 w-4" /> Receive stock</Btn>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="SKUs tracked" value={String(INVENTORY_DATA.length)} delta="Active items" spark={[4, 5, 5, 5, 5, 5]} />
        <Stat label="Below reorder point" value={String(belowReorder)} delta="Needs action" spark={[2, 2, 3, 2, 3, 2]} positive={belowReorder === 0} />
        {showCost && <Stat label="Stock value" value={money(stockValue)} delta="At cost" spark={[3, 3, 4, 4, 4, 4]} />}
        <Stat label="Movements (7d)" value={String(STOCK_MOVES.length)} delta="Recent activity" spark={[2, 3, 4, 3, 4, 4]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead title="Stock on hand" hint="Current inventory levels" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">SKU</th>
                  <th className="px-4 py-2.5 text-left font-medium">Item</th>
                  <th className="px-4 py-2.5 text-left font-medium">Location</th>
                  <th className="px-4 py-2.5 text-right font-medium">On hand</th>
                  <th className="px-4 py-2.5 text-right font-medium">Reorder</th>
                  {showCost && <th className="px-4 py-2.5 text-right font-medium">Cost</th>}
                  <th className="px-4 py-2.5 text-right font-medium">Price</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {INVENTORY_DATA.map((i) => {
                  const status = i.stock === 0 ? "danger" : i.stock <= i.reorder ? "warning" : "success";
                  const statusLabel = i.stock === 0 ? "Out of stock" : i.stock <= i.reorder ? "Reorder" : "In stock";
                  return (
                    <tr key={i.sku} className="border-b border-border last:border-0 hover:bg-surface-raised transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{i.sku}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{i.name}</p>
                        <p className="text-xs text-muted-foreground">{i.category}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{i.location}</td>
                      <td className="px-4 py-3 text-right"><span className="num text-foreground">{i.stock}</span></td>
                      <td className="px-4 py-3 text-right"><span className="num text-muted-foreground">{i.reorder}</span></td>
                      {showCost && <td className="px-4 py-3 text-right"><span className="num text-muted-foreground">{money(i.cost)}</span></td>}
                      <td className="px-4 py-3 text-right"><span className="num text-foreground">{money(i.price)}</span></td>
                      <td className="px-4 py-3"><Tag tone={status}>{statusLabel}</Tag></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!showCost && <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Cost column only visible to admins and managers.</div>}
        </Panel>

        <Panel>
          <PanelHead title="Recent movements" hint="Stock changes" />
          <div className="divide-y divide-border">
            {STOCK_MOVES.map((m) => (
              <div key={m.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-foreground">{m.sku}</span>
                  <Tag tone={m.type === "Inbound" ? "success" : m.type === "Outbound" ? "danger" : "info"}>{m.type}</Tag>
                </div>
                <p className="text-xs text-muted-foreground">{m.ref} · {m.person}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{m.date}</span>
                  <span className={`num font-medium ${m.qty > 0 ? "text-success" : m.qty < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {m.qty > 0 ? `+${m.qty}` : m.qty}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
