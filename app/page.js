"use client";
import { useState } from "react";

export default function Page() {
  const [query, setQuery] = useState("");

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

      {query.length >= 3 && (
        <div style={{ marginTop: 20 }}>
          Arama sonucu: <b>{query}</b>
        </div>
      )}
    </div>
  );
}
