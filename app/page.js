"use client";
import { useState } from "react";

const PRODUCTS = [
  "AFILTA 20 MG 4 FILM TABLET",
  "A-FERIN FORTE 30 TABLET",
  "ALPHAGAN-P GOZ DAMLASI",
  "OMRON M2 BASIC",
  "VICHY DERCOS SAMP",
];

export default function Page() {
  const [query, setQuery] = useState("");

  const results =
    query.length >= 3
      ? PRODUCTS.filter((p) =>
          p.toLowerCase().includes(query.toLowerCase())
        )
      : [];

  return (
    <div style={{ padding: 40, fontFamily: "Arial" }}>
      <h1>Eczane Sipariş Sistemi</h1>

      <input
        placeholder="İlaç adı yaz (min 3 harf)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          marginTop: 20,
          padding: 10,
          width: 300,
          fontSize: 16,
        }}
      />

      <div style={{ marginTop: 20 }}>
        {results.map((item, i) => (
          <div key={i}>{item}</div>
        ))}
      </div>
    </div>
  );
}
