"use client";

import React, { useMemo, useState } from "react";

function parseFileMeta(fileName) {
  const normalized = fileName.toUpperCase();
  const dateMatch = normalized.match(/(20\d{2})[-_\. ]?(0[1-9]|1[0-2])/);

  let type = "BILINMIYOR";
  if (normalized.includes("UBS") || normalized.includes("ÜBS")) type = "UBS";
  if (normalized.includes("ENVANTER") || normalized.includes("STOK")) type = "ENVANTER";

  return {
    name: fileName,
    type,
    month: dateMatch ? `${dateMatch[1]}-${dateMatch[2]}` : "TARİH YOK",
    active: true,
    rows: [],
  };
}

function parseCSV(text) {
  const lines = text.split("\n").filter(Boolean);
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

  return lines.slice(1).map(line => {
    const values = line.split(",");
    let row = {};
    headers.forEach((h, i) => row[h] = values[i]);
    return row;
  });
}

export default function Page() {
  const [sources, setSources] = useState([]);
  const [buffer, setBuffer] = useState(1.1);

  async function handleUpload(e) {
    const files = Array.from(e.target.files);

    const parsed = await Promise.all(
      files.map(async (file) => {
        const text = await file.text();
        return {
          ...parseFileMeta(file.name),
          rows: parseCSV(text),
        };
      })
    );

    setSources(prev => [...prev, ...parsed]);
  }

  const results = useMemo(() => {
    const ubs = sources.filter(s => s.active && s.type === "UBS");

    let salesMap = {};

    ubs.forEach(file => {
      file.rows.forEach(row => {
        const name = row.urun_adi || row.product;
        const qty = Number(row.satilan_adet) || 0;

        if (!name) return;

        if (!salesMap[name]) salesMap[name] = [];
        salesMap[name].push(qty);
      });
    });

    return Object.entries(salesMap).map(([name, arr]) => {
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      const order = Math.max(0, Math.ceil(avg * buffer));

      return {
        name,
        avg: avg.toFixed(2),
        order,
      };
    });

  }, [sources, buffer]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Eczane Sipariş Tool</h1>

      <input type="file" multiple onChange={handleUpload} />

      <div style={{ marginTop: 20 }}>
        Buffer:
        <input
          type="number"
          step="0.1"
          value={buffer}
          onChange={(e) => setBuffer(e.target.value)}
        />
      </div>

      <h2>Sonuç</h2>

      <table border="1" cellPadding="5">
        <thead>
          <tr>
            <th>Ürün</th>
            <th>Ortalama</th>
            <th>Sipariş</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i}>
              <td>{r.name}</td>
              <td>{r.avg}</td>
              <td>{r.order}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
