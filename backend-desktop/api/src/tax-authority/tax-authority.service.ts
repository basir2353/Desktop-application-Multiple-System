import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { ZodError } from "zod";
import {
  fbrConnectSchema,
  praConnectSchema,
  sendTaxInvoiceSchema,
  type FbrConnectInput,
  type PraConnectInput,
  type TaxAuthorityStatus,
  type TaxConnectResult,
  type TaxInvoice,
  type TaxInvoiceSourceType,
} from "@platform/contracts";
import {
  popsBills,
  popsBranches,
  pharmacySales,
  storeSales,
  organizations,
  taxAuthorityInvoices,
  taxAuthorityProfiles,
  type PlatformPgDb,
} from "@platform/database-pg";
import { DRIZZLE } from "../drizzle/drizzle.tokens";
import {
  buildBillPraSourceLines,
  parsePraSourceLines,
  withAllocatedStoreLineTaxes,
  type PraSourceLine,
} from "./pra-invoice-lines";

type ProfileRow = typeof taxAuthorityProfiles.$inferSelect;

const FBR_POST_SANDBOX = "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb";
const FBR_POST_PRODUCTION = "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata";
const FBR_VALIDATE_SANDBOX = "https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb";
const FBR_TOKEN_URL = process.env.FBR_TOKEN_URL?.trim() || "";
const PRA_TOKEN_URL = process.env.PRA_TOKEN_URL?.trim() || "";
const PRA_INVOICE_URL = process.env.PRA_INVOICE_URL?.trim() || "";

function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return "****";
  return `${"*".repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`;
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

@Injectable()
export class TaxAuthorityService {
  private readonly logger = new Logger(TaxAuthorityService.name);

  constructor(@Inject(DRIZZLE) private readonly db: PlatformPgDb) {}

  async getFeatures(organizationId: string): Promise<{ fbrEnabled: boolean; praEnabled: boolean }> {
    const rows = await this.db
      .select({
        fbrEnabled: organizations.fbrEnabled,
        praEnabled: organizations.praEnabled,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    const row = rows[0];
    return {
      fbrEnabled: Boolean(row?.fbrEnabled),
      praEnabled: Boolean(row?.praEnabled),
    };
  }

  /** Org Admin / Incharge: toggle PRA (and optionally FBR) for this business. */
  async setFeatures(
    organizationId: string,
    patch: { praEnabled?: boolean; fbrEnabled?: boolean },
  ): Promise<{ fbrEnabled: boolean; praEnabled: boolean }> {
    if (patch.praEnabled === undefined && patch.fbrEnabled === undefined) {
      throw new BadRequestException("Provide praEnabled and/or fbrEnabled");
    }
    const update: Partial<{ praEnabled: boolean; fbrEnabled: boolean }> = {};
    if (typeof patch.praEnabled === "boolean") update.praEnabled = patch.praEnabled;
    if (typeof patch.fbrEnabled === "boolean") update.fbrEnabled = patch.fbrEnabled;

    const updated = await this.db
      .update(organizations)
      .set(update)
      .where(eq(organizations.id, organizationId))
      .returning({
        fbrEnabled: organizations.fbrEnabled,
        praEnabled: organizations.praEnabled,
      });
    const row = updated[0];
    if (!row) throw new NotFoundException("Organization not found");
    this.logger.log(
      `Tax features updated for org ${organizationId}: FBR=${row.fbrEnabled} PRA=${row.praEnabled}`,
    );
    return {
      fbrEnabled: Boolean(row.fbrEnabled),
      praEnabled: Boolean(row.praEnabled),
    };
  }

  async getStatus(organizationId: string, branchCode: string): Promise<TaxAuthorityStatus> {
    const features = await this.getFeatures(organizationId);
    const branch = await this.resolveBranch(organizationId, branchCode);
    const profile = await this.getProfile(organizationId, branch.id);

    if (!profile) {
      return {
        branchCode: branch.code,
        fbrEnabled: features.fbrEnabled,
        praEnabled: features.praEnabled,
        company: {
          companyName: "",
          ntn: "",
          strn: "",
          businessType: "",
          province: "",
          branchName: branch.name,
          branchCode: branch.code,
        },
        fbr: {
          status: "disconnected",
          environment: "sandbox",
          clientId: null,
          clientSecretMasked: null,
          posId: null,
          terminalId: null,
          connectedAt: null,
          tokenExpiresAt: null,
          lastError: null,
        },
        pra: {
          status: "disconnected",
          environment: "sandbox",
          registrationNumber: null,
          username: null,
          passwordMasked: null,
          praBranchCode: null,
          connectedAt: null,
          tokenExpiresAt: null,
          lastError: null,
        },
      };
    }

    return {
      branchCode: branch.code,
      fbrEnabled: features.fbrEnabled,
      praEnabled: features.praEnabled,
      company: {
        companyName: profile.companyName,
        ntn: profile.ntn,
        strn: profile.strn,
        businessType: profile.businessType,
        province: profile.province,
        branchName: profile.branchName || branch.name,
        branchCode: profile.branchCode || branch.code,
      },
      fbr: {
        status: this.normalizeStatus(profile.fbrStatus, profile.fbrTokenExpiresAt),
        environment: profile.fbrEnvironment === "production" ? "production" : "sandbox",
        clientId: profile.fbrClientId,
        clientSecretMasked: maskSecret(profile.fbrClientSecret),
        posId: profile.fbrPosId,
        terminalId: profile.fbrTerminalId,
        connectedAt: iso(profile.fbrConnectedAt),
        tokenExpiresAt: iso(profile.fbrTokenExpiresAt),
        lastError: profile.fbrLastError,
      },
      pra: {
        status: this.normalizeStatus(profile.praStatus, profile.praTokenExpiresAt),
        environment: profile.praEnvironment === "production" ? "production" : "sandbox",
        registrationNumber: profile.praRegistrationNumber,
        username: profile.praUsername,
        passwordMasked: maskSecret(profile.praPassword),
        praBranchCode: profile.praBranchCode,
        connectedAt: iso(profile.praConnectedAt),
        tokenExpiresAt: iso(profile.praTokenExpiresAt),
        lastError: profile.praLastError,
      },
    };
  }

  async connectFbr(organizationId: string, body: unknown): Promise<TaxConnectResult> {
    const input = this.parseOrThrow(fbrConnectSchema, body);
    this.assertRequiredConnectFields(input.company, input.clientSecret, input.posId, input.terminalId);

    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const now = new Date();

    let accessToken = input.clientSecret.trim();
    let expiresAt = new Date(now.getTime() + 5 * 365 * 24 * 60 * 60 * 1000);

    try {
      const oauth = await this.fetchFbrOauthToken(input);
      if (oauth) {
        accessToken = oauth.accessToken;
        expiresAt = oauth.expiresAt;
      } else {
        await this.pingFbrToken(accessToken, input.environment);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.upsertProfile(organizationId, branch, input, null, {
        fbrStatus: "error",
        fbrLastError: message,
        fbrAccessToken: null,
        fbrTokenExpiresAt: null,
        fbrConnectedAt: null,
      });
      throw new BadRequestException(message);
    }

    const profile = await this.upsertProfile(organizationId, branch, input, null, {
      fbrClientId: input.clientId || null,
      fbrClientSecret: input.clientSecret,
      fbrPosId: input.posId,
      fbrTerminalId: input.terminalId,
      fbrEnvironment: input.environment,
      fbrStatus: "connected",
      fbrAccessToken: accessToken,
      fbrTokenExpiresAt: expiresAt,
      fbrConnectedAt: now,
      fbrLastError: null,
    });

    return {
      authority: "fbr",
      status: "connected",
      connectedAt: iso(profile.fbrConnectedAt)!,
      tokenExpiresAt: iso(profile.fbrTokenExpiresAt),
      message: "Connected Successfully",
    };
  }

  async connectPra(organizationId: string, body: unknown): Promise<TaxConnectResult> {
    const input = this.parseOrThrow(praConnectSchema, body);
    this.assertRequiredConnectFields(
      input.company,
      input.password,
      input.registrationNumber,
      input.praBranchCode,
    );

    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const now = new Date();

    let accessToken = input.password.trim();
    let expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    try {
      const oauth = await this.fetchPraOauthToken(input);
      if (oauth) {
        accessToken = oauth.accessToken;
        expiresAt = oauth.expiresAt;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.upsertProfile(organizationId, branch, null, input, {
        praStatus: "error",
        praLastError: message,
        praAccessToken: null,
        praTokenExpiresAt: null,
        praConnectedAt: null,
      });
      throw new BadRequestException(message);
    }

    const profile = await this.upsertProfile(organizationId, branch, null, input, {
      praRegistrationNumber: input.registrationNumber,
      praUsername: input.username || null,
      praPassword: input.password,
      praBranchCode: input.praBranchCode,
      praEnvironment: input.environment,
      praStatus: "connected",
      praAccessToken: accessToken,
      praTokenExpiresAt: expiresAt,
      praConnectedAt: now,
      praLastError: null,
    });

    return {
      authority: "pra",
      status: "connected",
      connectedAt: iso(profile.praConnectedAt)!,
      tokenExpiresAt: iso(profile.praTokenExpiresAt),
      message: "Connected Successfully",
    };
  }

  async refreshFbrToken(organizationId: string, branchCode: string): Promise<TaxConnectResult> {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const profile = await this.requireProfile(organizationId, branch.id);
    if (!profile.fbrClientSecret) {
      throw new BadRequestException("FBR is not configured. Please complete all required fields.");
    }

    const input: FbrConnectInput = {
      branchCode: branch.code,
      company: {
        companyName: profile.companyName,
        ntn: profile.ntn,
        strn: profile.strn,
        businessType: profile.businessType,
        province: profile.province,
        branchName: profile.branchName,
        branchCode: profile.branchCode,
      },
      clientId: profile.fbrClientId ?? "",
      clientSecret: profile.fbrClientSecret,
      posId: profile.fbrPosId ?? "",
      terminalId: profile.fbrTerminalId ?? "",
      environment: profile.fbrEnvironment === "production" ? "production" : "sandbox",
    };

    return this.connectFbr(organizationId, input);
  }

  async refreshPraToken(organizationId: string, branchCode: string): Promise<TaxConnectResult> {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const profile = await this.requireProfile(organizationId, branch.id);
    if (!profile.praPassword || !profile.praRegistrationNumber) {
      throw new BadRequestException("PRA is not configured. Please complete all required fields.");
    }

    const input: PraConnectInput = {
      branchCode: branch.code,
      company: {
        companyName: profile.companyName,
        ntn: profile.ntn,
        strn: profile.strn,
        businessType: profile.businessType,
        province: profile.province,
        branchName: profile.branchName,
        branchCode: profile.branchCode,
      },
      registrationNumber: profile.praRegistrationNumber,
      username: profile.praUsername ?? "",
      password: profile.praPassword,
      praBranchCode: profile.praBranchCode ?? branch.code,
      environment: profile.praEnvironment === "production" ? "production" : "sandbox",
    };

    return this.connectPra(organizationId, input);
  }

  async listInvoices(organizationId: string, branchCode: string, authority?: "fbr" | "pra") {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(taxAuthorityInvoices)
      .where(
        and(
          eq(taxAuthorityInvoices.organizationId, organizationId),
          eq(taxAuthorityInvoices.branchId, branch.id),
          ...(authority ? [eq(taxAuthorityInvoices.authority, authority)] : []),
        ),
      )
      .orderBy(desc(taxAuthorityInvoices.createdAt))
      .limit(100);

    return rows.map((r) => this.mapInvoice(r));
  }

  async sendInvoice(organizationId: string, authority: "fbr" | "pra", body: unknown) {
    const input = this.parseOrThrow(sendTaxInvoiceSchema, body);
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const profile = await this.requireProfile(organizationId, branch.id);

    const source = await this.loadSourceDocument(organizationId, branch.id, input.sourceType, input.sourceId);
    const existing = await this.findInvoice(organizationId, authority, input.sourceType, input.sourceId);
    if (existing && existing.status === "verified" && !input.force) {
      return { invoice: this.mapInvoice(existing), message: "Invoice already submitted" };
    }

    const token = await this.ensureToken(organizationId, branch.code, authority, profile);
    const payload = this.buildInvoicePayload(authority, profile, source);
    const now = new Date();

    let row = existing;
    if (!row) {
      const [created] = await this.db
        .insert(taxAuthorityInvoices)
        .values({
          organizationId,
          branchId: branch.id,
          authority,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          sourceRef: source.ref,
          status: "submitting",
          taxableAmountPkr: source.taxableAmountPkr,
          taxAmountPkr: source.taxAmountPkr,
          requestJson: JSON.stringify(payload),
          attemptCount: 1,
          lastAttemptAt: now,
          updatedAt: now,
        })
        .returning();
      row = created!;
    } else {
      const [updated] = await this.db
        .update(taxAuthorityInvoices)
        .set({
          status: "submitting",
          requestJson: JSON.stringify(payload),
          attemptCount: row.attemptCount + 1,
          lastAttemptAt: now,
          lastError: null,
          updatedAt: now,
        })
        .where(eq(taxAuthorityInvoices.id, row.id))
        .returning();
      row = updated!;
    }

    try {
      const result = await this.postInvoice(authority, profile, token, payload);
      const [saved] = await this.db
        .update(taxAuthorityInvoices)
        .set({
          status: "verified",
          responseJson: JSON.stringify(result.raw),
          authorityInvoiceNumber: result.invoiceNumber,
          qrPayload: result.qrPayload,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(taxAuthorityInvoices.id, row.id))
        .returning();
      return { invoice: this.mapInvoice(saved!), message: "Invoice submitted successfully" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.db
        .update(taxAuthorityInvoices)
        .set({
          status: "failed",
          lastError: message,
          updatedAt: new Date(),
        })
        .where(eq(taxAuthorityInvoices.id, row.id));
      throw new BadRequestException(message || "Invoice submission failed");
    }
  }

  /**
<<<<<<< Updated upstream
   * Issue a Fake or Real PRA fiscal invoice for a sale/bill.
   * Fake: local unique numbers + QR (not sent to PRA). Real: e-IMS via sendInvoice.
   */
  async issuePraInvoice(
    organizationId: string,
    body: unknown,
  ): Promise<IssuePraInvoiceResult> {
    const input = this.parseOrThrow(issuePraInvoiceSchema, body) as IssuePraInvoiceInput;
    await this.assertPraModeEnabled(organizationId, input.mode);

    if (input.mode === "real") {
      const sent = await this.sendInvoice(organizationId, "pra", {
        branchCode: input.branchCode,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        force: input.force,
      });
      const fiscal = await this.buildFiscalFromInvoice(
        organizationId,
        input.branchCode,
        input.sourceType,
        input.sourceId,
        "real",
        sent.invoice,
      );
      return {
        invoice: sent.invoice,
        fiscal,
        message: sent.message,
      };
    }

    // —— FPRA ——
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const profile = await this.getProfile(organizationId, branch.id);
    const source = await this.loadSourceDocument(
      organizationId,
      branch.id,
      input.sourceType,
      input.sourceId,
    );

    const existing = await this.findInvoice(
      organizationId,
      "pra",
      input.sourceType,
      input.sourceId,
      "fake",
    );
    if (existing && existing.status === "submitted" && !input.force) {
      const fiscal = await this.buildFiscalFromInvoice(
        organizationId,
        input.branchCode,
        input.sourceType,
        input.sourceId,
        "fake",
        this.mapInvoice(existing),
      );
      return {
        invoice: this.mapInvoice(existing),
        fiscal,
        message: "FPRA invoice already issued",
      };
    }

    const now = new Date();
    // Sequential FPRA invoice # — natural digits (e.g. 35929), no leading zeros.
    const invoiceNumber = await this.allocateFakePraInvoiceNumber(organizationId);
    const orderKey =
      source.ref.replace(/[^A-Za-z0-9-]/g, "").slice(0, 24) || String(Date.now()).slice(-8);
    const invoiceId = `FISC-${orderKey}-${Date.now().toString(36).toUpperCase()}`;
    const usin = this.buildPraUsin(input.sourceId, source.ref);
    const dateStr = now.toISOString().slice(0, 10);
    const qrPayload = `PRA|${invoiceNumber}|${orderKey}|${invoiceId}|${source.totalPkr}|${dateStr}`;

const responsePayload = {
      mode: "fake",
      invoiceNumber,
      invoiceId,
      usin,
      qrPayload,
      issuedAt: now.toISOString(),
    };

    let row = existing;
    if (!row) {
      const [created] = await this.db
        .insert(taxAuthorityInvoices)
        .values({
          organizationId,
          branchId: branch.id,
          authority: "pra",
          invoiceMode: "fake",
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          sourceRef: source.ref,
          status: "submitted",
          taxableAmountPkr: source.taxableAmountPkr,
          taxAmountPkr: source.taxAmountPkr,
          requestJson: JSON.stringify({ mode: "fake", sourceRef: source.ref }),
          responseJson: JSON.stringify(responsePayload),
          authorityInvoiceNumber: invoiceNumber,
          qrPayload,
          attemptCount: 1,
          lastAttemptAt: now,
          updatedAt: now,
        })
        .returning();
      row = created!;
    } else {
      const [updated] = await this.db
        .update(taxAuthorityInvoices)
        .set({
          status: "submitted",
          invoiceMode: "fake",
          responseJson: JSON.stringify(responsePayload),
          authorityInvoiceNumber: invoiceNumber,
          qrPayload,
          attemptCount: row.attemptCount + 1,
          lastAttemptAt: now,
          lastError: null,
          updatedAt: now,
        })
        .where(eq(taxAuthorityInvoices.id, row.id))
        .returning();
      row = updated!;
    }

    if (input.sourceType === "bill") {
      await this.updateBillPraFields(organizationId, input.sourceId, {
        praMode: "fake",
        praInvoiceNumber: invoiceNumber,
        praInvoiceId: invoiceId,
        praQrPayload: qrPayload,
        praIssuedAt: now,
      });
    }

    const invoice = this.mapInvoice(row);
    const fiscal: PraFiscalInvoice = {
      mode: "fake",
      invoiceNumber,
      invoiceId,
      qrPayload,
      usin,
      issuedAt: now.toISOString(),
      sellerName: profile?.companyName ?? "",
      ntn: profile?.ntn ?? "",
      strn: profile?.strn ?? "",
      branchCode: profile?.praBranchCode || branch.code,
      sourceRef: source.ref,
      taxableAmountPkr: source.taxableAmountPkr,
      taxAmountPkr: source.taxAmountPkr,
      totalAmountPkr: source.totalPkr,
      lines: source.lines.map((line) => ({
        label: line.description,
        qty: Math.max(1, Math.round(line.qty)),
        unitPrice:
          line.qty > 0 ? Math.round(line.amount / line.qty) : Math.round(line.amount),
      })),
    };

    return {
      invoice,
      fiscal,
      message: "FPRA invoice issued",
    };
  }

  /**
   * Build PRAL PostData for the POS client. Shop IP is usually whitelisted; Railway often is not.
   */
  async preparePraClientPost(
    organizationId: string,
    body: unknown,
  ): Promise<PreparePraClientPostResult> {
    await this.assertPraModeEnabled(organizationId, "real");
    const input = this.parseOrThrow(
      preparePraClientPostSchema,
      body,
    ) as PreparePraClientPostInput;
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const profile = await this.requireProfile(organizationId, branch.id);
    if (profile.praStatus !== "connected" && profile.praStatus !== "expired") {
      throw new BadRequestException(
        "Real PRA is not connected. Please connect your PRA account before uploading invoices.",
      );
    }

    const existing = await this.findInvoice(
      organizationId,
      "pra",
      input.sourceType,
      input.sourceId,
      "real",
    );
    if (
      existing &&
      (existing.status === "verified" || existing.status === "submitted") &&
      !input.force
    ) {
      const invoice = this.mapInvoice(existing);
      const fiscal = await this.buildFiscalFromInvoice(
        organizationId,
        input.branchCode,
        input.sourceType,
        input.sourceId,
        "real",
        invoice,
      );
      return {
        invoiceDbId: existing.id,
        postUrl: "",
        bearerToken: "",
        payload: {},
        alreadySubmitted: true,
        fiscal,
        invoice,
        message: "Invoice Already Submitted",
      };
    }

    const token = await this.ensureToken(organizationId, branch.code, "pra", profile);
    const source = await this.loadSourceDocument(
      organizationId,
      branch.id,
      input.sourceType,
      input.sourceId,
    );
    const payload = this.buildInvoicePayload("pra", profile, source);
    const env = profile.praEnvironment === "production" ? "production" : "sandbox";
    const { invoiceUrl } = resolvePraUrls(env);
    if (!invoiceUrl) {
      throw new BadRequestException("PRA invoice URL is not configured on the server.");
    }

    const now = new Date();
    let row = existing;
    if (!row) {
      const [created] = await this.db
        .insert(taxAuthorityInvoices)
        .values({
          organizationId,
          branchId: branch.id,
          authority: "pra",
          invoiceMode: "real",
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          sourceRef: source.ref,
          status: "submitting",
          taxableAmountPkr: source.taxableAmountPkr,
          taxAmountPkr: source.taxAmountPkr,
          requestJson: JSON.stringify(payload),
          attemptCount: 1,
          lastAttemptAt: now,
          updatedAt: now,
        })
        .returning();
      row = created!;
    } else {
      const [updated] = await this.db
        .update(taxAuthorityInvoices)
        .set({
          status: "submitting",
          invoiceMode: "real",
          requestJson: JSON.stringify(payload),
          attemptCount: row.attemptCount + 1,
          lastAttemptAt: now,
          lastError: null,
          updatedAt: now,
        })
        .where(eq(taxAuthorityInvoices.id, row.id))
        .returning();
      row = updated!;
    }

    return {
      invoiceDbId: row.id,
      postUrl: invoiceUrl,
      bearerToken: token,
      payload: payload as Record<string, unknown>,
      alreadySubmitted: false,
      message: "Post this payload to PRA from the POS machine, then confirm.",
    };
  }

  /** Persist fiscal # after the POS client successfully called PRA PostData. */
  async confirmPraClientPost(
    organizationId: string,
    body: unknown,
  ): Promise<IssuePraInvoiceResult> {
    await this.assertPraModeEnabled(organizationId, "real");
    const input = this.parseOrThrow(
      confirmPraClientPostSchema,
      body,
    ) as ConfirmPraClientPostInput;
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    const profile = await this.requireProfile(organizationId, branch.id);

    const [row] = await this.db
      .select()
      .from(taxAuthorityInvoices)
      .where(
        and(
          eq(taxAuthorityInvoices.id, input.invoiceDbId),
          eq(taxAuthorityInvoices.organizationId, organizationId),
          eq(taxAuthorityInvoices.branchId, branch.id),
          eq(taxAuthorityInvoices.authority, "pra"),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("PRA invoice draft not found");

    const invoiceNumber = input.invoiceNumber.trim();
    if (!invoiceNumber || /^not available$/i.test(invoiceNumber)) {
      throw new BadRequestException("PRA did not return InvoiceNumber");
    }
    const qrPayload = invoiceNumber;
    const raw: Record<string, unknown> =
      input.raw && typeof input.raw === "object"
        ? (input.raw as Record<string, unknown>)
        : { InvoiceNumber: invoiceNumber, Code: "100" };

    const invoiceId =
      typeof raw.invoiceId === "string" && raw.invoiceId
        ? raw.invoiceId
        : `FISC-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const usin = this.buildPraUsin(row.sourceId, row.sourceRef || row.sourceId);

    const [saved] = await this.db
      .update(taxAuthorityInvoices)
      .set({
        status: "verified",
        invoiceMode: "real",
        responseJson: JSON.stringify({
          ...raw,
          invoiceId,
          invoiceNumber,
          usin,
          issuedAt: new Date().toISOString(),
        }),
        authorityInvoiceNumber: invoiceNumber,
        qrPayload,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(taxAuthorityInvoices.id, row.id),
          eq(taxAuthorityInvoices.organizationId, organizationId),
          eq(taxAuthorityInvoices.branchId, branch.id),
        ),
      )
      .returning();

    await this.db
      .update(taxAuthorityProfiles)
      .set({
        praLastInvoiceSentAt: new Date(),
        praLastError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(taxAuthorityProfiles.id, profile.id),
          eq(taxAuthorityProfiles.organizationId, organizationId),
          eq(taxAuthorityProfiles.branchId, branch.id),
        ),
      );

    await this.writeActivityLog({
      organizationId,
      branchId: branch.id,
      event: "submit_invoice",
      invoiceNumber: row.sourceRef,
      praInvoiceNumber: invoiceNumber,
      status: "submitted",
      retryCount: row.attemptCount,
      dedupeByInvoice: true,
    });

    if (row.sourceType === "bill") {
      await this.updateBillPraFields(organizationId, row.sourceId, {
        praMode: "real",
        praInvoiceNumber: invoiceNumber,
        praInvoiceId: invoiceId,
        praQrPayload: qrPayload,
        praIssuedAt: new Date(),
      });
    }

    const invoice = this.mapInvoice(saved!);
    const fiscal = await this.buildFiscalFromInvoice(
      organizationId,
      input.branchCode,
      row.sourceType as TaxInvoiceSourceType,
      row.sourceId,
      "real",
      invoice,
    );
    return {
      invoice,
      fiscal,
      message: "Invoice submitted successfully (client relay)",
    };
  }

  /**
   * Return Fake/Real PRA fiscal details for a source from bill columns or latest invoice.
   */
  async getFiscalForSource(
    organizationId: string,
    branchCode: string,
    sourceType: TaxInvoiceSourceType,
    sourceId: string,
  ): Promise<PraFiscalInvoice | null> {
    const branch = await this.resolveBranch(organizationId, branchCode);

    if (sourceType === "bill") {
      const [bill] = await this.db
        .select()
        .from(popsBills)
        .where(
          and(
            eq(popsBills.id, sourceId),
            eq(popsBills.organizationId, organizationId),
            eq(popsBills.branchId, branch.id),
          ),
        )
        .limit(1);
      if (bill?.praInvoiceNumber && (bill.praMode === "fake" || bill.praMode === "real")) {
        const profile = await this.getProfile(organizationId, branch.id);
        const { lines, taxableAmountPkr } = buildBillPraSourceLines({
          linesJson: bill.linesJson,
          subtotalPkr: bill.subtotalPkr,
          discountPkr: bill.discountPkr,
          servicePkr: bill.servicePkr,
          deliveryChargePkr: bill.deliveryChargePkr,
          taxPkr: bill.taxPkr,
        });
        return {
          mode: bill.praMode,
          invoiceNumber: bill.praInvoiceNumber,
          invoiceId: bill.praInvoiceId ?? bill.praInvoiceNumber,
          qrPayload: bill.praQrPayload ?? bill.praInvoiceNumber,
          usin: this.buildPraUsin(bill.id, bill.billRef),
          issuedAt: bill.praIssuedAt?.toISOString() ?? bill.createdAt.toISOString(),
          sellerName: profile?.companyName ?? "",
          ntn: profile?.ntn ?? "",
          strn: profile?.strn ?? "",
          branchCode: profile?.praBranchCode || branch.code,
          sourceRef: bill.billRef,
          taxableAmountPkr,
          taxAmountPkr: bill.taxPkr,
          totalAmountPkr: bill.totalPkr,
          lines: lines.map((line) => ({
            label: line.description,
            qty: Math.max(1, Math.round(line.qty)),
            unitPrice:
              line.qty > 0 ? Math.round(line.amount / line.qty) : Math.round(line.amount),
          })),
        };
      }
    }

    const [latest] = await this.db
      .select()
      .from(taxAuthorityInvoices)
      .where(
        and(
          eq(taxAuthorityInvoices.organizationId, organizationId),
          eq(taxAuthorityInvoices.branchId, branch.id),
          eq(taxAuthorityInvoices.authority, "pra"),
          eq(taxAuthorityInvoices.sourceType, sourceType),
          eq(taxAuthorityInvoices.sourceId, sourceId),
        ),
      )
      .orderBy(desc(taxAuthorityInvoices.createdAt))
      .limit(1);

    if (!latest?.authorityInvoiceNumber) return null;
    return this.buildFiscalFromInvoice(
      organizationId,
      branchCode,
      sourceType,
      sourceId,
      latest.invoiceMode === "fake" ? "fake" : "real",
      this.mapInvoice(latest),
    );
  }

  /**
=======
>>>>>>> Stashed changes
   * Fire-and-forget enqueue after a sale is completed.
   * Never throws to the caller — failures are logged and queued as failed/queued rows.
   */
  async enqueueFromSale(params: {
    organizationId: string;
    branchId: string;
    branchCode: string;
    sourceType: TaxInvoiceSourceType;
    sourceId: string;
    sourceRef: string;
    taxableAmountPkr: number;
    taxAmountPkr: number;
  }): Promise<void> {
    try {
      const profile = await this.getProfile(params.organizationId, params.branchId);
      if (!profile) return;

      const authorities: Array<"fbr" | "pra"> = [];
      if (profile.fbrStatus === "connected" || profile.fbrStatus === "expired") authorities.push("fbr");
      if (profile.praStatus === "connected" || profile.praStatus === "expired") authorities.push("pra");
      if (authorities.length === 0) return;

      for (const authority of authorities) {
        const existing = await this.findInvoice(
          params.organizationId,
          authority,
          params.sourceType,
          params.sourceId,
        );
        if (existing) continue;

        await this.db.insert(taxAuthorityInvoices).values({
          organizationId: params.organizationId,
          branchId: params.branchId,
          authority,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          sourceRef: params.sourceRef,
          status: "queued",
          taxableAmountPkr: params.taxableAmountPkr,
          taxAmountPkr: params.taxAmountPkr,
        });

        // Best-effort immediate send; leave queued/failed for retry UI if it fails.
        void this.sendInvoice(params.organizationId, authority, {
          branchCode: params.branchCode,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          force: false,
        }).catch((err) => {
          this.logger.warn(
            `Auto-submit ${authority} invoice for ${params.sourceRef} failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
      }
    } catch (err) {
      this.logger.warn(
        `enqueueFromSale failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private parseOrThrow<T>(schema: { parse: (v: unknown) => T }, body: unknown): T {
    try {
      return schema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        const first = err.issues[0]?.message;
        throw new BadRequestException(first || "Please complete all required fields.");
      }
      throw err;
    }
  }

  private assertRequiredConnectFields(
    company: FbrConnectInput["company"] | PraConnectInput["company"],
    ...secrets: string[]
  ): void {
    if (
      !company.companyName?.trim() ||
      !company.ntn?.trim() ||
      !company.strn?.trim() ||
      !company.businessType?.trim() ||
      !company.province?.trim() ||
      !company.branchName?.trim() ||
      !company.branchCode?.trim() ||
      secrets.some((s) => !s?.trim())
    ) {
      throw new BadRequestException("Please complete all required fields.");
    }
  }

  private normalizeStatus(
    status: string,
    expiresAt: Date | null,
  ): TaxAuthorityStatus["fbr"]["status"] {
    if (status === "connected" && expiresAt && expiresAt.getTime() < Date.now()) return "expired";
    if (status === "connected" || status === "error" || status === "expired" || status === "disconnected") {
      return status;
    }
    return "disconnected";
  }

  private async resolveBranch(organizationId: string, branchCode: string) {
    const code = branchCode.trim();
    if (!code) throw new BadRequestException("Branch is required.");
    const [branch] = await this.db
      .select()
      .from(popsBranches)
      .where(and(eq(popsBranches.organizationId, organizationId), eq(popsBranches.code, code)))
      .limit(1);
    if (!branch) throw new NotFoundException(`Branch not found: ${code}`);
    return branch;
  }

  private async getProfile(organizationId: string, branchId: string) {
    const [row] = await this.db
      .select()
      .from(taxAuthorityProfiles)
      .where(
        and(
          eq(taxAuthorityProfiles.organizationId, organizationId),
          eq(taxAuthorityProfiles.branchId, branchId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async requireProfile(organizationId: string, branchId: string) {
    const profile = await this.getProfile(organizationId, branchId);
    if (!profile) {
      throw new BadRequestException("Please complete all required fields.");
    }
    return profile;
  }

  private async upsertProfile(
    organizationId: string,
    branch: typeof popsBranches.$inferSelect,
    fbr: FbrConnectInput | null,
    pra: PraConnectInput | null,
    patch: Partial<ProfileRow>,
  ): Promise<ProfileRow> {
    const company = fbr?.company ?? pra?.company;
    const existing = await this.getProfile(organizationId, branch.id);
    const now = new Date();

    if (!existing) {
      const [created] = await this.db
        .insert(taxAuthorityProfiles)
        .values({
          organizationId,
          branchId: branch.id,
          companyName: company?.companyName ?? "",
          ntn: company?.ntn ?? "",
          strn: company?.strn ?? "",
          businessType: company?.businessType ?? "",
          province: company?.province ?? "",
          branchName: company?.branchName ?? branch.name,
          branchCode: company?.branchCode ?? branch.code,
          ...patch,
          updatedAt: now,
        })
        .returning();
      return created!;
    }

    const [updated] = await this.db
      .update(taxAuthorityProfiles)
      .set({
        ...(company
          ? {
              companyName: company.companyName,
              ntn: company.ntn,
              strn: company.strn,
              businessType: company.businessType,
              province: company.province,
              branchName: company.branchName,
              branchCode: company.branchCode,
            }
          : {}),
        ...patch,
        updatedAt: now,
      })
      .where(eq(taxAuthorityProfiles.id, existing.id))
      .returning();
    return updated!;
  }

  private async fetchFbrOauthToken(
    input: FbrConnectInput,
  ): Promise<{ accessToken: string; expiresAt: Date } | null> {
    if (!FBR_TOKEN_URL || !input.clientId?.trim()) return null;

    const res = await fetch(FBR_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: input.clientId,
        client_secret: input.clientSecret,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`FBR authentication failed (${res.status}): ${text || res.statusText}`);
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new Error("FBR authentication failed: no access_token returned");
    const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
    return {
      accessToken: json.access_token,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  private async pingFbrToken(token: string, environment: "sandbox" | "production"): Promise<void> {
    // Lightweight connectivity check against validate endpoint with an empty-ish probe.
    // Sandbox may reject payload but 401 clearly means bad token.
    const url = environment === "production" ? FBR_POST_PRODUCTION : FBR_VALIDATE_SANDBOX;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error("FBR authentication failed. Check Client Secret / security token.");
      }
      // Other statuses (400 validation, 200, 404) still prove the token was accepted at gateway level
      // or the endpoint is reachable; credentials are stored either way after field validation.
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Network timeout — allow sandbox connect so merchants can save credentials offline.
        if (environment === "sandbox") return;
        throw new Error("Could not reach FBR. Check network / IP whitelist and try again.");
      }
      if (err instanceof Error && /authentication failed/i.test(err.message)) throw err;
      if (environment === "sandbox") return;
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchPraOauthToken(
    input: PraConnectInput,
  ): Promise<{ accessToken: string; expiresAt: Date } | null> {
    if (!PRA_TOKEN_URL) return null;

    const res = await fetch(PRA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registrationNumber: input.registrationNumber,
        username: input.username,
        password: input.password,
        branchCode: input.praBranchCode,
        environment: input.environment,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`PRA authentication failed (${res.status}): ${text || res.statusText}`);
    }
    const json = (await res.json()) as { access_token?: string; token?: string; expires_in?: number };
    const accessToken = json.access_token ?? json.token;
    if (!accessToken) throw new Error("PRA authentication failed: no token returned");
    const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
    return {
      accessToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  private async ensureToken(
    organizationId: string,
    branchCode: string,
    authority: "fbr" | "pra",
    profile: ProfileRow,
  ): Promise<string> {
    const expiresAt = authority === "fbr" ? profile.fbrTokenExpiresAt : profile.praTokenExpiresAt;
    const token = authority === "fbr" ? profile.fbrAccessToken : profile.praAccessToken;
    const expired = !expiresAt || expiresAt.getTime() <= Date.now() + 60_000;

    if (token && !expired) return token;

    if (authority === "fbr") {
      const refreshed = await this.refreshFbrToken(organizationId, branchCode);
      const latest = await this.requireProfile(
        organizationId,
        (await this.resolveBranch(organizationId, branchCode)).id,
      );
      if (!latest.fbrAccessToken) throw new BadRequestException(refreshed.message);
      return latest.fbrAccessToken;
    }

    const refreshed = await this.refreshPraToken(organizationId, branchCode);
    const latest = await this.requireProfile(
      organizationId,
      (await this.resolveBranch(organizationId, branchCode)).id,
    );
    if (!latest.praAccessToken) throw new BadRequestException(refreshed.message);
    return latest.praAccessToken;
  }

  private async findInvoice(
    organizationId: string,
    authority: "fbr" | "pra",
    sourceType: string,
    sourceId: string,
  ) {
    const [row] = await this.db
      .select()
      .from(taxAuthorityInvoices)
      .where(
        and(
          eq(taxAuthorityInvoices.organizationId, organizationId),
          eq(taxAuthorityInvoices.authority, authority),
          eq(taxAuthorityInvoices.sourceType, sourceType),
          eq(taxAuthorityInvoices.sourceId, sourceId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async loadSourceDocument(
    organizationId: string,
    branchId: string,
    sourceType: TaxInvoiceSourceType,
    sourceId: string,
  ) {
    if (sourceType === "bill") {
      const [row] = await this.db
        .select()
        .from(popsBills)
        .where(
          and(
            eq(popsBills.id, sourceId),
            eq(popsBills.organizationId, organizationId),
            eq(popsBills.branchId, branchId),
          ),
        )
        .limit(1);
      if (!row) throw new NotFoundException("Bill not found");
      const { lines, taxableAmountPkr } = buildBillPraSourceLines({
        linesJson: row.linesJson,
        subtotalPkr: row.subtotalPkr,
        discountPkr: row.discountPkr,
        servicePkr: row.servicePkr,
        deliveryChargePkr: row.deliveryChargePkr,
        taxPkr: row.taxPkr,
      });
      return {
        ref: row.billRef,
        date: row.createdAt,
        taxableAmountPkr,
        taxAmountPkr: row.taxPkr,
        totalPkr: row.totalPkr,
        lines,
      };
    }

    if (sourceType === "store_sale") {
      const [row] = await this.db
        .select()
        .from(storeSales)
        .where(
          and(
            eq(storeSales.id, sourceId),
            eq(storeSales.organizationId, organizationId),
            eq(storeSales.branchId, branchId),
          ),
        )
        .limit(1);
      if (!row) throw new NotFoundException("Store sale not found");
      return {
        ref: row.invoiceNumber,
        date: row.createdAt,
        taxableAmountPkr: Math.max(0, row.subtotalPkr - row.discountPkr - row.promotionDiscountPkr),
        taxAmountPkr: row.taxPkr,
        totalPkr: row.totalPkr,
<<<<<<< Updated upstream
        lines: withAllocatedStoreLineTaxes(
          saleLines.map((l) => {
            const qty = l.isWeighed === "yes" ? Math.max(0.001, l.qty / 1000) : Math.max(1, l.qty);
            return {
              description: productName(l.productId, l.displayName),
              qty,
              amount: l.lineTotalPkr,
              tax: 0,
            };
          }),
          row.taxPkr,
        ),
=======
        lines: [],
>>>>>>> Stashed changes
      };
    }

    const [row] = await this.db
      .select()
      .from(pharmacySales)
      .where(
        and(
          eq(pharmacySales.id, sourceId),
          eq(pharmacySales.organizationId, organizationId),
          eq(pharmacySales.branchId, branchId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Pharmacy sale not found");
    return {
      ref: row.invoiceNumber,
      date: row.createdAt,
      taxableAmountPkr: Math.max(0, row.subtotalPkr - row.discountPkr),
      taxAmountPkr: row.taxPkr,
      totalPkr: row.totalPkr,
      lines: [],
    };
  }

<<<<<<< Updated upstream
  /**
   * Next FPRA invoice number for this org — real-looking alphanumeric
   * (e.g. 197476FGYI32391068). Atomic UPDATE so concurrent Pays don't collide.
   */
  private async allocateFakePraInvoiceNumber(organizationId: string): Promise<string> {
    const [row] = await this.db
      .update(organizations)
      .set({
        praFakeInvoiceSeq: sql`${organizations.praFakeInvoiceSeq} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning({ seq: organizations.praFakeInvoiceSeq });
    const seq = Math.max(1, Number(row?.seq ?? 1));
    return this.formatFakePraInvoiceNumber(organizationId, seq);
  }

  /** 6 digits + 4 letters + 8 digits — matches real PRA-style invoice ids. */
  private formatFakePraInvoiceNumber(_organizationId: string, seq: number): string {
    const prefix = String(197475 + seq).padStart(6, "0").slice(-6);
    const letters = this.fakePraLetterBlock(seq);
    const suffix = String(10_000_000 + ((seq * 7919 + 3_239_106) % 89_999_999)).slice(-8);
    return `${prefix}${letters}${suffix}`;
  }

  private fakePraLetterBlock(seq: number): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    let h = Math.imul(seq, 2654435761) >>> 0;
    let out = "";
    for (let i = 0; i < 4; i++) {
      out += alphabet[(h + i * 17) % alphabet.length]!;
      h = (Math.imul(h, 33) + i) >>> 0;
    }
    return out;
  }

  /** PRA PostData USIN — unique per source UUID so billRef collisions across orgs/branches don't clash. */
  private buildPraUsin(sourceId: string, sourceRef: string): string {
    const idPart = sourceId.replace(/-/g, "").slice(0, 8);
    const refPart = sourceRef.replace(/[^A-Za-z0-9]/g, "").slice(-28);
    const body = refPart ? `${idPart}-${refPart}` : idPart;
    return body.slice(0, 50) || `USIN${Date.now()}`.slice(0, 50);
  }

  private parseLines(raw: string | null): PraSourceLine[] {
    return parsePraSourceLines(raw);
=======
  private parseLines(raw: string | null): Array<{ description: string; qty: number; amount: number; tax: number }> {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.map((line) => {
        const row = line as Record<string, unknown>;
        return {
          description: String(row.name ?? row.description ?? "Item"),
          qty: Number(row.qty ?? 1),
          amount: Number(row.unitPrice ?? row.amount ?? 0) * Number(row.qty ?? 1),
          tax: Number(row.tax ?? 0),
        };
      });
    } catch {
      return [];
    }
>>>>>>> Stashed changes
  }

  private buildInvoicePayload(
    authority: "fbr" | "pra",
    profile: ProfileRow,
    source: {
      ref: string;
      date: Date;
      taxableAmountPkr: number;
      taxAmountPkr: number;
      totalPkr: number;
      lines: PraSourceLine[];
    },
  ) {
    const invoiceDate = source.date.toISOString().slice(0, 10);
    const taxRatePct =
      source.taxableAmountPkr > 0
        ? Math.round((source.taxAmountPkr / source.taxableAmountPkr) * 10000) / 100
        : 0;
    const items =
      source.lines.length > 0
        ? source.lines.map((line) => ({
            hsCode: "0000.0000",
            productDescription: line.description,
            rate: `${Math.round(taxRatePct)}%`,
            uoM: "Numbers, pieces, units",
            quantity: line.qty,
            totalValues: 0,
            valueSalesExcludingST: line.amount,
            fixedNotifiedValueOrRetailPrice: 0,
            salesTaxApplicable: line.tax,
            salesTaxWithheldAtSource: 0,
            extraTax: 0,
            furtherTax: 0,
            sroScheduleNo: "",
            fedPayable: 0,
            discount: 0,
            saleType: "Goods at standard rate (default)",
            sroItemSerialNo: "",
          }))
        : [
            {
              hsCode: "0000.0000",
              productDescription: source.ref,
              rate: `${Math.round(taxRatePct)}%`,
              uoM: "Numbers, pieces, units",
              quantity: 1,
              totalValues: 0,
              valueSalesExcludingST: source.taxableAmountPkr,
              fixedNotifiedValueOrRetailPrice: 0,
              salesTaxApplicable: source.taxAmountPkr,
              salesTaxWithheldAtSource: 0,
              extraTax: 0,
              furtherTax: 0,
              sroScheduleNo: "",
              fedPayable: 0,
              discount: 0,
              saleType: "Goods at standard rate (default)",
              sroItemSerialNo: "",
            },
          ];

    if (authority === "fbr") {
      return {
        invoiceType: "Sale Invoice",
        invoiceDate,
        sellerNTNCNIC: profile.ntn.replace(/-/g, ""),
        sellerBusinessName: profile.companyName,
        sellerProvince: profile.province,
        sellerAddress: profile.branchName || profile.province,
        buyerNTNCNIC: "",
        buyerBusinessName: "Walking Customer",
        buyerProvince: profile.province,
        buyerAddress: profile.province,
        buyerRegistrationType: "Unregistered",
        invoiceRefNo: source.ref,
        ...(profile.fbrEnvironment === "sandbox" ? { scenarioId: "SN001" } : {}),
        posId: profile.fbrPosId,
        terminalId: profile.fbrTerminalId,
        items,
      };
    }

    return {
<<<<<<< Updated upstream
      InvoiceNumber: "",
      POSID: Number(profile.praRegistrationNumber) || 0,
      USIN: this.buildPraUsin(source.id, source.ref),
      DateTime: invoiceDate.includes("T")
        ? invoiceDate.replace("T", " ").slice(0, 19)
        : invoiceDate,
      BuyerPNTN: "",
      BuyerCNIC: "",
      BuyerName: "Walking Customer",
      BuyerPhoneNumber: "",
      TotalBillAmount: source.totalPkr,
      TotalQuantity: Math.max(
        1,
        source.lines.reduce((sum, l) => sum + (l.qty || 0), 0) || 1,
      ),
      TotalSaleValue: source.taxableAmountPkr,
      TotalTaxCharged: source.taxAmountPkr,
      Discount: 0,
      FurtherTax: 0,
      PaymentMode: 1,
      RefUSIN: null,
      InvoiceType: 1,
      Items:
        source.lines.length > 0
          ? source.lines.map((line, idx) => {
              const qty = Math.max(1, line.qty || 1);
              // Amounts from POS are tax-exclusive; TaxCharged is allocated ST.
              const saleValue = Math.max(0, Math.round(line.amount));
              const lineTax = Math.max(0, Math.round(line.tax || 0));
              const taxRate =
                saleValue > 0 ? Math.round((lineTax / saleValue) * 10000) / 100 : taxRatePct;
              return {
                ItemCode: `IT_${idx + 1}`,
                ItemName: (line.description || `Item ${idx + 1}`).slice(0, 100),
                Quantity: qty,
                PCTCode: "98012000",
                TaxRate: taxRate,
                SaleValue: saleValue,
                TotalAmount: saleValue + lineTax,
                TaxCharged: lineTax,
                Discount: 0,
                FurtherTax: 0,
                InvoiceType: 1,
                RefUSIN: null,
              };
            })
          : [
              {
                ItemCode: "IT_1",
                ItemName: source.ref,
                Quantity: 1,
                PCTCode: "98012000",
                TaxRate: taxRatePct,
                SaleValue: source.taxableAmountPkr,
                TotalAmount: source.taxableAmountPkr + source.taxAmountPkr,
                TaxCharged: source.taxAmountPkr,
                Discount: 0,
                FurtherTax: 0,
                InvoiceType: 1,
                RefUSIN: null,
              },
            ],
=======
      registrationNumber: profile.praRegistrationNumber,
      branchCode: profile.praBranchCode,
      invoiceRef: source.ref,
      invoiceDate,
      sellerNTN: profile.ntn,
      sellerSTRN: profile.strn,
      sellerName: profile.companyName,
      province: profile.province,
      taxableAmount: source.taxableAmountPkr,
      taxAmount: source.taxAmountPkr,
      totalAmount: source.totalPkr,
      items,
>>>>>>> Stashed changes
    };
  }

  private async postInvoice(
    authority: "fbr" | "pra",
    profile: ProfileRow,
    token: string,
    payload: Record<string, unknown>,
  ): Promise<{ invoiceNumber: string; qrPayload: string; raw: unknown }> {
    if (authority === "fbr") {
      const url =
        profile.fbrEnvironment === "production" ? FBR_POST_PRODUCTION : FBR_POST_SANDBOX;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const raw = await res.json().catch(async () => ({ message: await res.text() }));
      if (!res.ok) {
        const message =
          typeof raw === "object" && raw && "message" in raw
            ? String((raw as { message: unknown }).message)
            : `FBR submit failed (${res.status})`;
        throw new Error(message);
      }
      const invoiceNumber =
        typeof raw === "object" && raw && "invoiceNumber" in raw
          ? String((raw as { invoiceNumber: unknown }).invoiceNumber)
          : `FBR-${Date.now()}`;
      return {
        invoiceNumber,
        qrPayload: invoiceNumber,
        raw,
      };
    }

    if (PRA_INVOICE_URL) {
      const res = await fetch(PRA_INVOICE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const raw = await res.json().catch(async () => ({ message: await res.text() }));
      if (!res.ok) {
        throw new Error(
          typeof raw === "object" && raw && "message" in raw
            ? String((raw as { message: unknown }).message)
            : `PRA submit failed (${res.status})`,
        );
      }
      const invoiceNumber =
        typeof raw === "object" && raw && "invoiceNumber" in raw
          ? String((raw as { invoiceNumber: unknown }).invoiceNumber)
          : `PRA-${Date.now()}`;
      return { invoiceNumber, qrPayload: invoiceNumber, raw };
    }

    // PRA endpoint not configured — accept sandbox submissions locally so the workflow works.
    if (profile.praEnvironment === "sandbox") {
      const invoiceNumber = `PRA-SB-${Date.now()}`;
      return {
        invoiceNumber,
        qrPayload: invoiceNumber,
        raw: { invoiceNumber, mode: "sandbox-local", payload },
      };
    }
    throw new Error("PRA invoice URL is not configured on the server (PRA_INVOICE_URL).");
  }

  private mapInvoice(row: typeof taxAuthorityInvoices.$inferSelect): TaxInvoice {
    return {
      id: row.id,
      authority: row.authority === "pra" ? "pra" : "fbr",
      sourceType:
        row.sourceType === "store_sale"
          ? "store_sale"
          : row.sourceType === "pharmacy_sale"
            ? "pharmacy_sale"
            : "bill",
      sourceRef: row.sourceRef,
      status:
        row.status === "verified" ||
        row.status === "submitted" ||
        row.status === "failed" ||
        row.status === "submitting" ||
        row.status === "queued"
          ? row.status
          : "queued",
      taxableAmountPkr: row.taxableAmountPkr,
      taxAmountPkr: row.taxAmountPkr,
      authorityInvoiceNumber: row.authorityInvoiceNumber,
      qrPayload: row.qrPayload,
      lastError: row.lastError,
      attemptCount: row.attemptCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
