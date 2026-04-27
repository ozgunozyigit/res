"use client";

import { useState, useMemo } from "react";

/* ---------------- NORMALIZE ---------------- */

function normalize(text = "") {
  return text
    .toUpperCase()
    .replace(/0/g, "O")
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(text) {
  return normalize(text).replace(/\s/g, "");
}

/* ---------------- LEVENSHTEIN ---------------- */

function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
    }
  }
  return matrix[b.length][a.length];
}

/* ---------------- CSV ---------------- */

function parseCSV(text) {
  const lines = text.split("\n").filter(Boolean);
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

  return lines.slice(1).map(line => {
    const values = line.split(",");
    let row = {};
    headers.forEach((h, i) => (row[h] = values[i]));
    return row;
  });
}

/* ---------------- MF ---------------- */

function parseMF(value) {
  if (!value) return null;
  const m = value.match(/(\d+)\s*\+\s*(\d+)/);
  if (!m) return null;

  return {
    text: `${m[1]}+${m[2]}`
  };
}

/* ---------------- APP ---------------- */

export default function Page() {
  const [ubsData, setUbsData] = useState([]);
  const [ubaData, setUbaData] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  /* -------- FILE UPLOAD -------- */

  async function handleUpload(e) {
    const files = Array.from(e.target.files);

    for (let file of files) {
      const text = await file.text();
      const rows = parseCSV(text);

      if (file.name.toUpperCase().includes("UBS")) {
        setUbsData(prev => [...prev, ...rows]);
      }

      if (file.name.toUpperCase().includes("UBA")) {
        setUbaData(prev => [...prev, ...rows]);
      }
    }
  }

  /* -------- MF MAP -------- */

  const mfMap = useMemo(() => {
    let map = {};

    ubaData.forEach(row => {
      const name = row["ürün adı"] || row["urun adi"] || row.product;
      const mf = parseMF(row["top.alış"] || row.alış);

      if (name && mf) {
        map[normalize(name)] = mf.text;
      }
    });

    return map;
  }, [ubaData]);

  /* -------- PRODUCT LIST -------- */

  const products = useMemo(() => {
    let map = {};

    ubsData.forEach(row => {
      const name = row["ürün adı"] || row["urun adi"] || row.product;
      const qty = Number(row["satılan adet"] || row.satis) || 0;

      if (!name) return;

      const key = normalize(name);

      if (!map[key]) {
        map[key] = {
          name,
          values: []
        };
      }

      map[key].values.push(qty);
    });

    return Object.values(map).map(p => {
      const avg =
        p.values.reduce((a, b) => a + b, 0) / p.values.length;

      return {
        name: p.name,
        normalized: normalize(p.name),
        avg: avg.toFixed(2),
        order: Math.ceil(avg * 1.1),
        mf: mfMap[normalize(p.name)] || "-"
      };
    });
  }, [ubsData, mfMap]);

  /* -------- SEARCH -------- */

  function score(input, product) {
    const a = normalize(input);
    const b = product.normalized;

    const ac = compact(input);
    const bc = compact(product.name);

    let s = 0;

    if (bc.includes(ac)) s += 200;
    if (b.includes(a)) s += 100;

    const dist = levenshtein(ac, bc);
    if (dist <= 2) s += 150;
    else if (dist <= 4) s += 80;

    return s;
  }

  const results = useMemo(() => {
    if (!search) return [];

    return products
      .map(p => ({
        ...p,
        score: score(search, p)
      }))
      .filter(p => p.score > 50)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [search, products]);

  /* -------- UI -------- */

  return (
    <div style={{ padding: 20 }}>
      <h1>Eczane Sipariş Tool</h1>

      <input type="file" multiple onChange={handleUpload} />

      <div style={{ marginTop: 20 }}>
        <input
          placeholder="Ürün ara (ör: afrin)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <ul>
        {results.map((r, i) => (
          <li
            key={i}
            style={{ cursor: "pointer" }}
            onClick={() => setSelected(r)}
          >
            {r.name}
          </li>
        ))}
      </ul>

      {selected && (
        <div style={{ marginTop: 20, border: "1px solid #ccc", padding: 10 }}>
          <h2>{selected.name}</h2>

          <p>Ortalama: {selected.avg}</p>

          <h3 style={{ color: "green" }}>
            Önerilen Sipariş: {selected.order}
          </h3>

          <p>MF: {selected.mf}</p>

          <button
            onClick={() =>
              navigator.clipboard.writeText(selected.order.toString())
            }
          >
            Kopyala
          </button>
        </div>
      )}
    </div>
  );
}
