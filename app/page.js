"use client";
import { useState } from "react";

const PRODUCTS = [
  {
    name: "AFILTA 20 MG",
    stock: 4,
    sales: [12, 10, 8],
    purchases: [6, 6, 6],
  },
  {
    name: "A-FERIN FORTE",
    stock: 20,
    sales: [5, 6, 4],
    purchases: [10, 8, 9],
  },
];

export default function Page() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  const results =
    query.length >= 3
      ? PRODUCTS.filter((p) =>
          p.name.toLowerCase().includes(query.toLowerCase())
        )
      : [];

  function calculate(product) {
    const avgSales =
      product.sales.reduce((a, b) => a + b, 0) / 3;

    const avgPurchase =
      product.purchases.reduce((a, b) => a + b, 0) / 3;

    const target = Math.max(avgSales * 1.1, avgPurchase);
    const order = Math.max(Math.ceil(target - product.stock), 0);

    return { avgSales, avgPurchase, target, order };
  }

  const result = selected ? calculate(selected) : null;

  return (
    <div style={{ padding: 40, fontFamily: "Arial" }}>
      <h1>Eczane Sipariş Sistemi</h1>

      <input
        placeholder="İlaç adı yaz (min 3 harf)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginTop: 20, padding: 10, width: 300 }}
      />

      <div style={{ marginTop: 20 }}>
        {results.map((item, i) => (
          <div
            key={i}
            onClick={() => setSelected(item)}
            style={{ cursor: "pointer", marginBottom: 5 }}
          >
            {item.name}
          </div>
        ))}
      </div>

      {selected && (
        <div style={{ marginTop: 30 }}>
          <h3>{selected.name}</h3>
          <p>Ortalama satış: {result.avgSales.toFixed(1)}</p>
          <p>Ortalama alış: {result.avgPurchase.toFixed(1)}</p>
          <p>Hedef stok: {result.target.toFixed(1)}</p>
          <p><b>Önerilen sipariş: {result.order}</b></p>
        </div>
      )}
    </div>
  );
}
