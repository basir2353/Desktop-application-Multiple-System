import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { lookupStoreProduct } from "../api/store";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { formatPkr, useStoreAccess } from "../hooks/useStore";

export function StorePriceCheckerPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  const productQuery = useQuery({
    queryKey: ["store", "lookup", branch?.code, activeQuery],
    enabled: Boolean(branch?.code && activeQuery),
    queryFn: () => lookupStoreProduct(branch!.code, activeQuery),
  });

  const handleScan = useCallback((code: string) => {
    setQuery(code);
    setActiveQuery(code);
  }, []);

  useBarcodeScanner(handleScan);

  const product = productQuery.data;

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-8 text-white">
      <p className="text-sm uppercase tracking-[0.25em] text-sky-300">Price checker</p>
      <h1 className="mt-2 text-4xl font-bold">{branch?.name ?? "Store"}</h1>
      <p className="mt-2 text-slate-400">Scan a barcode or search by name</p>

      <div className="mt-8 w-full max-w-xl">
        <input
          type="text"
          data-scan-target="true"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setActiveQuery(query.trim());
            }
          }}
          placeholder="Scan barcode here…"
          autoFocus
          className="w-full rounded-2xl border border-white/20 bg-white/10 px-6 py-5 text-center text-2xl font-medium outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
        />
      </div>

      {productQuery.isFetching ? (
        <p className="mt-12 text-lg text-slate-400">Looking up…</p>
      ) : product ? (
        <div className="mt-12 w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-lg text-slate-300">{product.name}</p>
          <p className="mt-1 text-sm text-slate-500">{product.sku}{product.barcode ? ` · ${product.barcode}` : ""}</p>
          <p className="mt-6 text-5xl font-bold text-sky-300">
            {product.isWeighed ? `${formatPkr(product.sellingPrice)} / kg` : formatPkr(product.sellingPrice)}
          </p>
          <p className="mt-4 text-sm text-emerald-400">
            {product.isWeighed ? `${(product.availableStock / 1000).toFixed(2)} kg in stock` : `${product.availableStock} in stock`}
          </p>
        </div>
      ) : activeQuery && productQuery.isError ? (
        <p className="mt-12 text-lg text-red-400">Product not found</p>
      ) : null}

      <p className="mt-12 max-w-md text-center text-xs text-slate-500">
        Open this page on a kiosk display. USB and Bluetooth barcode scanners work automatically.
      </p>
    </div>
  );
}
