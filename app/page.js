import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, XCircle, Calculator, Search } from "lucide-react";

// ECZANE AY BAŞI SİPARİŞ TOOL - DEMO MVP
// Mantık:
// 1) ÜBS dosyaları satış datasıdır ve sipariş hesabında kullanılır.
// 2) Envanter dosyası güncel stok datasıdır.
// 3) Son 3 aktif ÜBS dosyasının ortalaması alınır.
// 4) Sipariş = max(0, ceil(ortalama satış * 1.1 - mevcut stok))
//
// Beklenen CSV kolonları:
// ÜBS CSV: urun_adi,satilan_adet
// Envanter CSV: urun_adi,stok
//
// Dosya adı formatı önerisi:
// 2026-01_UBS.csv
// 2026-02_UBS.csv
// 2026-03_UBS.csv
// 2026-04_ENVANTER.csv

function parseFileMeta(fileName) {
  const normalized = fileName.toUpperCase();
  const dateMatch = normalized.match(/(20\d{2})[-_\. ]?(0[1-9]|1[0-2])/);

  let type = "BILINMIYOR";
  if (normalized.includes("UBS") || normalized.includes("ÜBS")) type = "UBS";
  if (normalized.includes("UBA") || normalized.includes("ÜBA")) type = "UBA";
  if (normalized.includes("ENVANTER") || normalized.includes("STOK")) type = "ENVANTER";

  return {
    name: fileName,
    type,
    month: dateMatch ? `${dateMatch[1]}-${dateMatch[2]}` : "TARİH YOK",
    active: type === "UBS" || type === "ENVANTER",
    rows: [],
  };
}

function parseCSV(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replaceAll(" ", "_"));

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    return row;
  });
}

function safeNumber(value) {
  if (value === undefined || value === null) return 0;
  return Number(String(value).replace(",", ".")) || 0;
}

export default function EczaneSiparisToolDemo() {
  const [sources, setSources] = useState([]);
  const [search, setSearch] = useState("");
  const [buffer, setBuffer] = useState(1.1);

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    const parsedFiles = await Promise.all(
      files.map(async (file) => {
        const text = await file.text();
        const meta = parseFileMeta(file.name);
        return {
          ...meta,
          rows: parseCSV(text),
        };
      })
    );

    setSources((prev) => [...prev, ...parsedFiles]);
  }

  function toggleActive(index) {
    setSources((prev) =>
      prev.map((source, i) =>
        i === index ? { ...source, active: !source.active } : source
      )
    );
  }

  function selectLastThreeUBS() {
    const ubsSorted = sources
      .map((source, index) => ({ ...source, originalIndex: index }))
      .filter((source) => source.type === "UBS" && source.month !== "TARİH YOK")
      .sort((a, b) => a.month.localeCompare(b.month));

    const lastThreeIndexes = new Set(
      ubsSorted.slice(-3).map((source) => source.originalIndex)
    );

    setSources((prev) =>
      prev.map((source, index) => {
        if (source.type === "UBS") {
          return { ...source, active: lastThreeIndexes.has(index) };
        }
        return source;
      })
    );
  }

  const orderRows = useMemo(() => {
    const activeUBS = sources
      .filter((source) => source.active && source.type === "UBS")
      .sort((a, b) => a.month.localeCompare(b.month));

    const activeInventory = sources.find(
      (source) => source.active && source.type === "ENVANTER"
    );

    const salesMap = new Map();
    const stockMap = new Map();

    activeUBS.forEach((source) => {
      source.rows.forEach((row) => {
        const productName = row.urun_adi || row["ürün_adı"] || row.urun || row.product;
        const soldQty = safeNumber(
          row.satilan_adet || row["satılan_adet"] || row.satis || row["satış"]
        );

        if (!productName) return;

        const key = productName.trim().toUpperCase();
        if (!salesMap.has(key)) {
          salesMap.set(key, { productName, monthlySales: {} });
        }
        salesMap.get(key).monthlySales[source.month] =
          (salesMap.get(key).monthlySales[source.month] || 0) + soldQty;
      });
    });

    if (activeInventory) {
      activeInventory.rows.forEach((row) => {
        const productName = row.urun_adi || row["ürün_adı"] || row.urun || row.product;
        const stockQty = safeNumber(row.stok || row.miktar || row.stock);
        if (!productName) return;
        stockMap.set(productName.trim().toUpperCase(), stockQty);
      });
    }

    return Array.from(salesMap.values())
      .map((item) => {
        const months = activeUBS.map((source) => source.month);
        const totalSales = months.reduce(
          (sum, month) => sum + safeNumber(item.monthlySales[month]),
          0
        );
        const averageSales = months.length ? totalSales / months.length : 0;
        const stock = stockMap.get(item.productName.trim().toUpperCase()) || 0;
        const suggestedOrder = Math.max(
          0,
          Math.ceil(averageSales * safeNumber(buffer) - stock)
        );

        return {
          productName: item.productName,
          months,
          totalSales,
          averageSales,
          stock,
          suggestedOrder,
        };
      })
      .filter((row) =>
        row.productName.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => b.suggestedOrder - a.suggestedOrder);
  }, [sources, search, buffer]);

  const totalSuggested = orderRows.reduce(
    (sum, row) => sum + row.suggestedOrder,
    0
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Eczane Ay Başı Sipariş Tool</h1>
            <p className="mt-2 text-sm text-slate-600">
              ÜBS satış ortalamasına göre sipariş önerisi üretir. ÜBA şimdilik hesaplamaya dahil edilmez.
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-sm">
            <Upload className="h-4 w-4" />
            CSV yükle
            <input type="file" multiple accept=".csv" className="hidden" onChange={handleUpload} />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <div className="text-sm text-slate-500">Kaynak dosya</div>
              <div className="mt-1 text-2xl font-bold">{sources.length}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <div className="text-sm text-slate-500">Aktif ÜBS</div>
              <div className="mt-1 text-2xl font-bold">
                {sources.filter((s) => s.active && s.type === "UBS").length}
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <div className="text-sm text-slate-500">Ürün satırı</div>
              <div className="mt-1 text-2xl font-bold">{orderRows.length}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <div className="text-sm text-slate-500">Toplam önerilen kutu</div>
              <div className="mt-1 text-2xl font-bold">{totalSuggested}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Kaynak Listesi</h2>
                <p className="text-sm text-slate-500">Dosyaları aktif/pasif yapabilir, son 3 ÜBS dosyasını otomatik seçebilirsin.</p>
              </div>
              <Button onClick={selectLastThreeUBS} className="rounded-xl">
                Son 3 ÜBS'yi seç
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-3">Dosya</th>
                    <th>Tip</th>
                    <th>Ay</th>
                    <th>Satır</th>
                    <th>Durum</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source, index) => (
                    <tr key={`${source.name}-${index}`} className="border-b last:border-0">
                      <td className="py-3 font-medium">{source.name}</td>
                      <td><Badge variant="outline">{source.type}</Badge></td>
                      <td>{source.month}</td>
                      <td>{source.rows.length}</td>
                      <td>
                        {source.active ? (
                          <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="h-4 w-4" /> Aktif</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400"><XCircle className="h-4 w-4" /> Pasif</span>
                        )}
                      </td>
                      <td>
                        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => toggleActive(index)}>
                          {source.active ? "Pasifleştir" : "Aktifleştir"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {sources.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-500">
                        Henüz dosya yüklenmedi. Örnek: 2026-03_UBS.csv ve 2026-04_ENVANTER.csv
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold"><Calculator className="h-5 w-5" /> Sipariş Önerisi</h2>
                <p className="text-sm text-slate-500">Formül: Ortalama ÜBS satış × buffer − güncel stok</p>
              </div>
              <div className="flex flex-col gap-2 md:flex-row">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    className="rounded-xl pl-9"
                    placeholder="Ürün ara"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Input
                  className="w-28 rounded-xl"
                  type="number"
                  step="0.05"
                  value={buffer}
                  onChange={(e) => setBuffer(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-3">Ürün</th>
                    <th>Toplam Satış</th>
                    <th>Aylık Ortalama</th>
                    <th>Stok</th>
                    <th>Önerilen Sipariş</th>
                  </tr>
                </thead>
                <tbody>
                  {orderRows.map((row) => (
                    <tr key={row.productName} className="border-b last:border-0">
                      <td className="py-3 font-medium">{row.productName}</td>
                      <td>{row.totalSales}</td>
                      <td>{row.averageSales.toFixed(2)}</td>
                      <td>{row.stock}</td>
                      <td className="text-lg font-bold">{row.suggestedOrder}</td>
                    </tr>
                  ))}
                  {orderRows.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-500">
                        Sipariş hesaplamak için en az 1 aktif ÜBS dosyası yükle.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
