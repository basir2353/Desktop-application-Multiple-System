export function printTradeFlowSlip(title: string, lines: Array<[string, string]>): void {
  const win = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
  if (!win) return;
  const rows = lines.map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join("");
  win.document.write(`<!doctype html><html><body style="font-family:Arial;padding:24px"><h1>${title}</h1>${rows}</body></html>`);
  win.document.close();
  win.print();
}
