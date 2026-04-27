"use client";

import { useState, useMemo } from "react";
import * as XLSX from "xlsx";

/* ---------------- NORMALIZE ---------------- */

function normalize(text = "") {
  return text
    .toString()
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

/* ---------------- HELPERS ---------------- */

function getProductName(row) {
  return (
    row["Ürün Adı"] ||
    row["ÜRÜN ADI"] ||
    row["urun adi"] ||
    row["product"] ||
    ""
  );
}

function getSales(row) {
  return Number(
    row["Sat.Adet"] ||
    row["SAT.ADET"] ||
    row["Sat Adet"] ||
    row["adet"] ||
    0
  );
}

/* ---------------- APP ---------------- */

export default function Page() {
  const [ubsData, setUbsData] = useState([]);
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  /* -------- FILE UPLOAD -------- */

  async function handleUpload(e) {
    const fileArr = Array.from(e.target.files);

    for (let file of fileArr) {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      // 🔥 DEBUG
      console.log("ÜBS ilk satır:", rows[0]);
      console.log("Toplam satır:", rows.length);

      const name = file.name.toUpperCase();

      if (name.includes("ÜBS") || name.includes("UBS")) {
        setUbsData(prev => [...prev, ...rows]);
      }

      setFiles(prev => [...prev, file.name]);
    }
  }

  /* -------- PRODUCT LIST -------- */

  const products = useMemo(() => {
    let map = {};

    ubsData.forEach(row => {
      const name = getProductName(row);
      const qty = getSales(row);

      if (!name) return;

      const key = normalize(name);

      if (!map[key]) {
        map[key] = { name, values: [] };
      }

      map[key].values.push(qty);
    });

    const result = Object.values(map).map(p => {
      const avg =
        p.values.reduce((a, b) => a + b, 0) / p.values.length;

      return {
        name: p.name,
        normalized: normalize(p.name),
        avg: avg.toFixed(2),
        order: Math.ceil(avg * 1.1)
      };
    });

    // 🔥 DEBUG
    console.log("Ürün sayısı:", result.length);

    return result;
  }, [ubsData]);

  /* -------- SEARCH -------- */

  const results = useMemo(() => {
    if (!search) return [];

    return products.filter(p =>
      normalize(p.name).includes(normalize(search))
    );
  }, [search, products]);

  /* -------- UI -------- */

  return (
    <div style={{ padding: 20 }}>
      <h1>Eczane Sipariş Tool</h1>

      <input type="file" multiple onChange={handleUpload} />

      <h3>Yüklenen Dosyalar</h3>
      <ul>
        {files.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>

      <input
        placeholder="Ürün ara"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <ul>
        {results.map((r, i) => (
          <li key={i} onClick={() => setSelected(r)} style={{ cursor: "pointer" }}>
            {r.name}
          </li>
        ))}
      </ul>

      {selected && (
        <div style={{ marginTop: 20 }}>
          <h2>{selected.name}</h2>
          <p>Ortalama: {selected.avg}</p>
          <h3>Önerilen: {selected.order}</h3>
        </div>
      )}
    </div>
  );
}
