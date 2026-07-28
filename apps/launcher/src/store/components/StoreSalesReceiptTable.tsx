import type { CartLine } from "../lib/storePosSync";
import {
  cartLineAvailLabel,
  cartLineBoxNo,
  cartLineCost,
  cartLineDisplayName,
  cartLineMargin,
  cartLineMarginPct,
  cartLineMarkupPct,
  cartLineOriginalPrice,
  cartLineQtyLabel,
  cartLineRegularPrice,
  cartLineTotal,
  cartLineUnitPrice,
} from "../lib/storePosSync";
import { POS_COLUMNS, type PosColumnId } from "../lib/posColumns";
import { formatPkr } from "../hooks/useStore";

type Props = {
  cart: CartLine[];
  selectedLineId: string | null;
  columnVisible: Record<PosColumnId, boolean>;
  onSelect: (productId: string) => void;
  onQtyDelta: (productId: string, delta: number) => void;
  onQtySet: (productId: string, qty: number) => void;
  onPriceSet: (productId: string, price: number) => void;
  onEdit: () => void;
  onPriceDiscount: () => void;
  onRemove: (productId: string) => void;
  onReturnItem?: (productId: string) => void;
};

export function StoreSalesReceiptTable({
  cart,
  selectedLineId,
  columnVisible,
  onSelect,
  onQtyDelta,
  onQtySet,
  onPriceSet,
  onEdit,
  onPriceDiscount,
  onRemove,
  onReturnItem,
}: Props): JSX.Element {
  const visibleCols = POS_COLUMNS.filter((c) => columnVisible[c.id]);

  if (cart.length === 0) {
    return (
      <div className="flex min-h-[12rem] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-950/40">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No items on this receipt</p>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          Scan a barcode or search an item above — it is added here automatically with qty 1.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 shadow-sm dark:border-slate-800 md:block">
        <table className="w-full min-w-[960px] border-collapse text-left text-[11px]">
          <thead className="bg-amber-50 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-amber-950/25 dark:text-slate-300">
            <tr>
              {visibleCols.map((col) => (
                <th
                  key={col.id}
                  className={`whitespace-nowrap border-b border-amber-200/80 px-2 py-2.5 dark:border-amber-900/40 ${col.mobileHide ? "hidden xl:table-cell" : ""}`}
                >
                  {col.label}
                </th>
              ))}
              <th className="border-b border-amber-200/80 px-2 py-2.5 dark:border-amber-900/40" />
            </tr>
          </thead>
          <tbody>
            {cart.map((line, index) => {
              const selected = selectedLineId === line.product.id;
              const unit = cartLineUnitPrice(line);
              const cost = cartLineCost(line);
              const ext = cartLineTotal(line);
              return (
                <tr
                  key={line.product.id}
                  onClick={() => onSelect(line.product.id)}
                  className={`cursor-pointer border-b border-slate-100 dark:border-slate-800 ${
                    selected
                      ? "bg-amber-100/90 dark:bg-amber-950/35"
                      : index % 2 === 0
                        ? "bg-white hover:bg-sky-50/70 dark:bg-transparent dark:hover:bg-slate-900/50"
                        : "bg-slate-50/80 hover:bg-sky-50/70 dark:bg-slate-900/25 dark:hover:bg-slate-900/50"
                  }`}
                >
                  {visibleCols.map((col) => {
                    const hide = col.mobileHide ? "hidden xl:table-cell" : "";
                    switch (col.id) {
                      case "itemNo":
                        return (
                          <td key={col.id} className={`px-2 py-2 tabular-nums ${hide}`}>
                            {index + 1}
                          </td>
                        );
                      case "boxNo":
                        return (
                          <td key={col.id} className={`px-2 py-2 ${hide}`}>
                            {cartLineBoxNo(line)}
                          </td>
                        );
                      case "itemName":
                        return (
                          <td key={col.id} className={`min-w-[140px] px-2 py-2 ${hide}`}>
                            <div className="font-medium text-slate-900 dark:text-white">
                              {cartLineDisplayName(line)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {line.product.sku}
                              {line.product.barcode ? ` · ${line.product.barcode}` : ""}
                            </div>
                          </td>
                        );
                      case "qty":
                        return (
                          <td key={col.id} className={`px-2 py-2 ${hide}`} onClick={(e) => e.stopPropagation()}>
                            {line.product.isWeighed ? (
                              <span className="tabular-nums">{cartLineQtyLabel(line)}</span>
                            ) : (
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  className="h-6 w-6 rounded border border-slate-200 dark:border-slate-700"
                                  onClick={() => onQtyDelta(line.product.id, -1)}
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  value={line.qty}
                                  onChange={(e) =>
                                    onQtySet(line.product.id, Math.max(1, Math.round(Number(e.target.value) || 1)))
                                  }
                                  className="w-12 rounded border border-slate-200 px-1 py-0.5 text-center dark:border-slate-700 dark:bg-slate-950"
                                />
                                <button
                                  type="button"
                                  className="h-6 w-6 rounded border border-slate-200 dark:border-slate-700"
                                  onClick={() => onQtyDelta(line.product.id, 1)}
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      case "price":
                        return (
                          <td key={col.id} className={`px-2 py-2 ${hide}`} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              min={0}
                              value={unit}
                              onChange={(e) =>
                                onPriceSet(line.product.id, Math.max(0, Math.round(Number(e.target.value) || 0)))
                              }
                              className="w-20 rounded border border-slate-200 px-1.5 py-0.5 tabular-nums dark:border-slate-700 dark:bg-slate-950"
                            />
                          </td>
                        );
                      case "extPrice":
                        return (
                          <td key={col.id} className={`px-2 py-2 font-semibold tabular-nums ${hide}`}>
                            {formatPkr(ext)}
                          </td>
                        );
                      case "availQty":
                        return (
                          <td
                            key={col.id}
                            className={`px-2 py-2 tabular-nums ${
                              line.product.availableStock <= 0 ? "text-red-600" : ""
                            } ${hide}`}
                          >
                            {cartLineAvailLabel(line)}
                          </td>
                        );
                      case "cost":
                        return (
                          <td key={col.id} className={`px-2 py-2 tabular-nums text-slate-500 ${hide}`}>
                            {formatPkr(cost)}
                          </td>
                        );
                      case "margin":
                        return (
                          <td key={col.id} className={`px-2 py-2 tabular-nums ${hide}`}>
                            {formatPkr(cartLineMargin(line))}
                          </td>
                        );
                      case "marginPct":
                        return (
                          <td key={col.id} className={`px-2 py-2 tabular-nums ${hide}`}>
                            {cartLineMarginPct(line)}%
                          </td>
                        );
                      case "markupPct":
                        return (
                          <td key={col.id} className={`px-2 py-2 tabular-nums ${hide}`}>
                            {cartLineMarkupPct(line)}%
                          </td>
                        );
                      case "originalPrice":
                        return (
                          <td key={col.id} className={`px-2 py-2 tabular-nums text-slate-500 ${hide}`}>
                            {formatPkr(cartLineOriginalPrice(line))}
                          </td>
                        );
                      case "regularPrice":
                        return (
                          <td key={col.id} className={`px-2 py-2 tabular-nums text-slate-500 ${hide}`}>
                            {formatPkr(cartLineRegularPrice(line))}
                          </td>
                        );
                      default:
                        return null;
                    }
                  })}
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-red-600 hover:underline"
                      onClick={() => onRemove(line.product.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2 md:hidden">
        {cart.map((line, index) => {
          const selected = selectedLineId === line.product.id;
          const unit = cartLineUnitPrice(line);
          return (
            <li
              key={line.product.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(line.product.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(line.product.id);
                }
              }}
              className={`rounded-xl border p-3 ${
                selected
                  ? "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30"
                  : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    #{index + 1}
                    {columnVisible.boxNo ? ` · Box ${cartLineBoxNo(line)}` : ""}
                  </p>
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {cartLineDisplayName(line)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Avail {cartLineAvailLabel(line)} · Cost {formatPkr(cartLineCost(line))}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                  {formatPkr(cartLineTotal(line))}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {!line.product.isWeighed ? (
                  <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                    <button type="button" className="h-7 w-7" onClick={() => onQtyDelta(line.product.id, -1)}>
                      −
                    </button>
                    <span className="min-w-[1.5rem] text-center text-xs font-semibold">{line.qty}</span>
                    <button type="button" className="h-7 w-7" onClick={() => onQtyDelta(line.product.id, 1)}>
                      +
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-semibold">{cartLineQtyLabel(line)}</span>
                )}
                <span className="text-xs text-slate-500">@ {formatPkr(unit)}</span>
                <span className="text-xs text-slate-500">
                  M {cartLineMarginPct(line)}% · MU {cartLineMarkupPct(line)}%
                </span>
                <button
                  type="button"
                  className="ml-auto text-xs font-semibold text-red-600"
                  onClick={() => onRemove(line.product.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {selectedLineId ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-800 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-500"
          >
            Edit
          </button>
          {onReturnItem ? (
            <button
              type="button"
              onClick={() => onReturnItem(selectedLineId)}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-500"
            >
              Return Item
            </button>
          ) : null}
          <button
            type="button"
            onClick={onPriceDiscount}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-500"
          >
            Qty/Price/Discount
          </button>
          <button
            type="button"
            onClick={() => onQtyDelta(selectedLineId, 1)}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-sm hover:bg-amber-400"
          >
            Qty+
          </button>
          <button
            type="button"
            onClick={() => onQtyDelta(selectedLineId, -1)}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-sm hover:bg-amber-400"
          >
            Qty−
          </button>
          <button
            type="button"
            onClick={() => onRemove(selectedLineId)}
            className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-950 dark:text-rose-300"
          >
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}
