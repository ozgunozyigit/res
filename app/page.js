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

/* ---------------- CSV PARSER ---------------- */

function parseCSV(text) {
  let delimiter = ",";

  if (text.includes(";")) delimiter = ";";
  if (text.includes("\t")) delimiter = "\t";

  const lines = text.split("\n").filter(Boolean);

  const headers = lines[0]
    .split(delimiter)
    .map(h => h.trim().toLowerCase());

  return lines.slice(1).map(line => {
    const values = line.split(delimiter);
    let row = {};
    headers.forEach((h, i) => (row[h] = values[i]));
    return row;
  });
}

/* ---------------- HELPERS ---------------- */

function getProductName(row) {
  return (
    row["ürün adı"] ||
    row["urun adi"] ||
    row["ürün"] ||
    row["urun"] ||
    row["product"] ||
    ""
  );
}

function getSales(row) {
  return Number(
    row["sat.adet"] ||
    row["sat adet"] ||
    row["sat.adet "] ||
    row["satılan adet"] ||
    row["satilan adet"] ||
    row["satis"] ||
    row["adet"] ||
    0
  );
}

function getStock(row) {
  return Number(
    row["stok mik."] ||
    row["stok"] ||
    row["miktar"] ||
    row["stock"] ||
    0
  );
}

function parseMF(value) {
  if (!value) return null;
  const m = value.match(/(\d+)\s*\+\s*(\d+)/);
  if (!m) return null;
  return `${m[1]}+${m[2]}`;
}

/* ---------------- APP ---------------- */

export default function Page() {
  const [ubsData, setUbsData] = useState([]);
  const [ubaData, setUbaData] = useState([]);
  const [stockData, setStockData] = useState([]);
  const [files, setFiles] = useState([]);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  /* -------- FILE UPLOAD -------- */

  async function handleUpload(e) {
    const fileArr = Array.from(e.target.files);

    for (let file of fileArr) {
      const text = await file.text();
      const rows = parseCSV(text);

      const name = file.name.toUpperCase();

      let type = "BİLİNMİYOR";

      if (name.includes("UBS") || name.includes("ÜBS")) {
        setUbsData(prev => [...prev, ...rows]);
        type = "ÜBS";
      } else if (name.includes("UBA") || name.includes("ÜBA")) {
        setUbaData(prev => [...prev, ...rows]);
        type = "ÜBA";
      } else if (name.includes("ENVANTER") || name.includes("STOK")) {
        setStockData(prev => [...prev, ...rows]);
        type = "ENVANTER";
      }

      setFiles(prev => [...prev, { name: file.name, type }]);
    }
  }

  /* -------- MF MAP -------- */

  const mfMap = useMemo(() => {
    let map = {};

    ubaData.forEach(row => {
      const name = getProductName(row);
      const mf = parseMF(row["alış"] || row["alis"]);

      if (name && mf) {
        map[normalize(name)] = mf;
      }
    });

    return map;
  }, [ubaData]);

  /* -------- STOCK MAP -------- */

  const stockMap = useMemo(() => {
    let map = {};

    stockData.forEach(row => {
      const name = getProductName(row);
      const stock = getStock(row);

      if (name) {
        map[normalize(name)] = stock;
      }
    });

    return map;
  }, [stockData]);

  /* -------- PRODUCT LIST -------- */

  const products = useMemo(() => {
    let map = {};

    ubsData.forEach(row => {
      const name = getProductName(row);
      const qty = getSales(row);

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

      const norm = normalize(p.name);

      return {
        name: p.name,
        normalized: norm,
        avg: avg.toFixed(2),
        stock: stockMap[norm] || 0,
        order: Math.max(0, Math.ceil(avg * 1.1 - (stockMap[norm] || 0))),
        mf: mfMap[norm] || "-"
      };
    });
  }, [ubsData, stockMap, mfMap]);

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

      <h3>Yüklenen Dosyalar</h3>
      <ul>
        {files.map((f, i) => (
          <li key={i}>
            {f.name} - {f.type}
          </li>
        ))}
      </ul>

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
          <p>Stok: {selected.stock}</p>

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
