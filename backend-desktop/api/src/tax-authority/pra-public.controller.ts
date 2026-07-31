import { Controller, Get, Header, HttpCode, HttpStatus, Query } from "@nestjs/common";
import { TaxAuthorityService } from "./tax-authority.service";

/**
 * Public (no JWT) PRA invoice lookup for receipt QR scans.
 * Official e.pra eims.xhtml ignores ?InvoiceNo= — this page auto-searches and shows results.
 */
@Controller()
export class PraPublicController {
  constructor(private readonly tax: TaxAuthorityService) {}

  @Get("v1/pra/public-verify")
  @Header("Content-Type", "text/html; charset=utf-8")
  @Header("Cache-Control", "no-store")
  async publicVerify(@Query("InvoiceNo") invoiceNo?: string, @Query("invoiceNo") invoiceNoAlt?: string) {
    const inv = String(invoiceNo || invoiceNoAlt || "").trim();
    return this.tax.renderPublicPraVerifyHtml(inv);
  }

  /**
   * FPRA slip QR only — opens a normal https page with only "Not Found".
   * 200 so phones show our page (not browser error chrome). No invoice/PRA data.
   */
  @Get("v1/pra/not-found")
  @HttpCode(HttpStatus.OK)
  @Header("Content-Type", "text/html; charset=utf-8")
  @Header("Cache-Control", "no-store")
  notFound(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Not Found</title>
  <style>
    html,body{height:100%;margin:0}
    body{display:flex;align-items:center;justify-content:center;
      font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#111}
    h1{margin:0;font-size:28px;font-weight:700}
  </style>
</head>
<body><h1>Not Found</h1></body>
</html>`;
  }
}
