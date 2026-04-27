"use client";

import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";

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

/* ---------------- PDF ---------------- */

async function parsePDF(file) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    text += content.items.map(i => i.str).join(" ") + "\n";
  }

  return text;
}

function extractProducts(text) {
  return text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 5)
    .map(l => ({
      raw: l,
      normalized: normalize(l)
    }));
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
    0
  );
}

function parseMF(value) {
  if (!value) return null;
  const m = String(value).match(/(\d+)\s*\+\s*(\d+)/);
  if (!m) return null;
  return `${m[1]}+${m[2]}`;
}

/* ---------------- APP ---------------- */

export default function Page() {
  const [ubsData, setUbsData] = useState([]);
  const [ubaData, setUbaData] = useState([]);
  const [pdfProducts, setPdfProducts] = useState([]);
  const [files, setFiles] = useState([]);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  /* -------- FILE UPLOAD -------- */

  async function handleUpload(e) {
    const fileArr = Array.from(e.target.files);

    for (let file of fileArr) {
      const name = file.name.toUpperCase();

      // PDF
      if (name.includes("PDF")) {
        const text = await parsePDF(file);
        const products = extractProducts(text);

        setPdfProducts(products);
        setFiles(prev => [...prev, { name: file.name, type: "PDF" }]);
        continue;
      }

      // EXCEL
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      let type = "BİLİNMİYOR";

      if (name.includes("ÜBS") || name.includes("UBS")) {
        setUbsData(prev => [...prev, ...rows]);
        type = "ÜBS";
      } else if (name.includes("ÜBA") || name.includes("UBA")) {
        setUbaData(prev => [...prev, ...rows]);
        type = "ÜBA";
      }

      setFiles(prev => [...prev, { name: file.name, type }]);
    }
  }

  /* -------- MF MAP -------- */

  const mfMap = useMemo(() => {
    let map = {};

    ubaData.forEach(row => {
      const name = getProductName(row);
      const mf = parseMF(row["Alış"]);

      if (name && mf) {
        map[normalize(name)] = mf;
      }
    });

    return map;
  }, [ubaData]);

  /* -------- NAME MATCH -------- */

  function matchName(name) {
    const n = normalize(name);

    const found = pdfProducts.find(p =>
      p.normalized.includes(n)
    );

    return found ? found.raw : name;
  }

  /* -------- PRODUCTS -------- */

  const products = useMemo(() => {
    let map = {};

    ubsData.forEach(row => {
      let name = getProductName(row);
      const qty = getSales(row);

      if (!name) return;

      name = matchName(name);

      const key = normalize(name);

      if (!map[key]) {
        map[key] = { name, values: [] };
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
        order: Math.ceil(avg * 1.1),
        mf: mfMap[norm] || "-"
      };
    });
  }, [ubsData, mfMap, pdfProducts]);

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
      .map(p => ({ ...p, score: score(search, p) }))
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
          <li key={i}>{f.name} - {f.type}</li>
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
          <p>MF: {selected.mf}</p>
        </div>
      )}
    </div>
  );
}
