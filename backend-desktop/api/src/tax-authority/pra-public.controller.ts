import { Controller, Get, Header, Query } from "@nestjs/common";
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
}
