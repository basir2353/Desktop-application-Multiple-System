import { beforeEach, describe, expect, it } from "vitest";
import {
  findDeviceByImei,
  getBusinessReport,
  getCashBankBalances,
  getMobizoneDashboard,
  loadMobizoneDb,
  recordExpense,
  recordPurchase,
  recordSale,
  returnSale,
  searchByCnic,
  shopkeeperBalance,
  upsertBankAccount,
  upsertShopkeeper,
} from "../mobizoneStore";

const BRANCH = "MZ-TEST";

function installMemoryLocalStorage(): void {
  const map = new Map<string, string>();
  const store = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true });
}

beforeEach(() => {
  installMemoryLocalStorage();
});

describe("mobizoneStore", () => {
  it("records purchase into stock and finds by IMEI / CNIC", () => {
    upsertBankAccount(BRANCH, {
      bankName: "HBL",
      accountTitle: "Shop",
      openingBalancePkr: 0,
    });
    const banks = loadMobizoneDb(BRANCH).bankAccounts;
    const purchase = recordPurchase(BRANCH, {
      sellerName: "Ali Seller",
      sellerCnic: "35202-1234567-1",
      sellerPhone: "03001234567",
      imei: "359999999999999",
      brand: "Samsung",
      model: "A54",
      colour: "Black",
      storage: "128GB",
      condition: "used",
      purchasePricePkr: 50000,
      payment: {
        cashPkr: 20000,
        bankPkr: 30000,
        bank: { bankAccountId: banks[0]!.id, verified: true },
      },
    });

    expect(purchase.remainingPkr).toBe(0);
    const device = findDeviceByImei(BRANCH, "359999999999999");
    expect(device?.status).toBe("in_stock");
    expect(device?.brand).toBe("Samsung");
    expect(searchByCnic(BRANCH, "35202-1234567-1")?.name).toBe("Ali Seller");
  });

  it("sells with split payment, udhaar, warranty then return restocks", () => {
    upsertBankAccount(BRANCH, {
      bankName: "HBL",
      accountTitle: "Shop",
      openingBalancePkr: 0,
    });
    const bankId = loadMobizoneDb(BRANCH).bankAccounts[0]!.id;
    recordPurchase(BRANCH, {
      sellerName: "Seller",
      sellerCnic: "11111-1111111-1",
      imei: "350000000000001",
      brand: "Apple",
      model: "13",
      condition: "used",
      purchasePricePkr: 80000,
      payment: { cashPkr: 80000, bankPkr: 0 },
    });
    const device = findDeviceByImei(BRANCH, "350000000000001")!;
    const sale = recordSale(BRANCH, {
      deviceId: device.id,
      customerName: "Buyer",
      customerCnic: "22222-2222222-2",
      customerPhone: "03007654321",
      pricePkr: 95000,
      warrantyDays: 7,
      dueDate: "2026-12-01",
      payment: {
        cashPkr: 50000,
        bankPkr: 20000,
        bank: { bankAccountId: bankId, verified: true },
      },
    });

    expect(sale.remainingPkr).toBe(25000);
    expect(sale.profitPkr).toBe(15000);
    expect(sale.warrantyDays).toBe(7);
    expect(findDeviceByImei(BRANCH, "350000000000001")?.status).toBe("sold");
    expect(getMobizoneDashboard(BRANCH).cashBalancePkr).toBe(-30000);
    expect(getMobizoneDashboard(BRANCH).bankBalancePkr).toBe(20000);

    returnSale(BRANCH, sale.id, "Dead pixel");
    expect(findDeviceByImei(BRANCH, "350000000000001")?.status).toBe("in_stock");
    const returned = loadMobizoneDb(BRANCH).sales.find((s) => s.id === sale.id);
    expect(returned?.returnedAt).toBeTruthy();
    expect(returned?.remainingPkr).toBe(0);
    expect(getMobizoneDashboard(BRANCH).cashBalancePkr).toBe(-80000);
    expect(getMobizoneDashboard(BRANCH).bankBalancePkr).toBe(0);
  });

  it("rejects duplicate in-stock IMEI and sale of missing device", () => {
    recordPurchase(BRANCH, {
      sellerName: "A",
      imei: "358888888888888",
      brand: "Oppo",
      model: "A16",
      condition: "used",
      purchasePricePkr: 20000,
      payment: { cashPkr: 20000, bankPkr: 0 },
    });
    expect(() =>
      recordPurchase(BRANCH, {
        sellerName: "B",
        imei: "358888888888888",
        brand: "Oppo",
        model: "A16",
        condition: "used",
        purchasePricePkr: 21000,
        payment: { cashPkr: 21000, bankPkr: 0 },
      }),
    ).toThrow(/already in stock/i);
    expect(() =>
      recordSale(BRANCH, {
        deviceId: "00000000-0000-4000-8000-000000000099",
        customerName: "X",
        pricePkr: 1,
        payment: { cashPkr: 1, bankPkr: 0 },
      }),
    ).toThrow(/not available/i);
  });

  it("expenses reduce dashboard profit and business report", () => {
    recordPurchase(BRANCH, {
      sellerName: "S",
      imei: "351111111111111",
      brand: "Vivo",
      model: "Y20",
      condition: "used",
      purchasePricePkr: 10000,
      payment: { cashPkr: 10000, bankPkr: 0 },
    });
    const device = findDeviceByImei(BRANCH, "351111111111111")!;
    recordSale(BRANCH, {
      deviceId: device.id,
      customerName: "C",
      pricePkr: 15000,
      payment: { cashPkr: 15000, bankPkr: 0 },
    });
    recordExpense(BRANCH, { title: "Tea", amountPkr: 500, method: "cash" });

    const dash = getMobizoneDashboard(BRANCH);
    expect(dash.todayProfitPkr).toBe(4500);
    const today = new Date().toISOString().slice(0, 10);
    const report = getBusinessReport(BRANCH, today, today);
    expect(report.profitPkr).toBe(4500);
    expect(report.saleCount).toBe(1);
    expect(report.purchaseCount).toBe(1);
    expect(getCashBankBalances(loadMobizoneDb(BRANCH)).cash).toBe(4500);
  });

  it("normalizes CNIC duplicates and shopkeeper balance uses remainders only", () => {
    const sk = upsertShopkeeper(BRANCH, {
      shopNo: "12",
      name: "Shop One",
      phone: "03001112222",
    });
    recordPurchase(BRANCH, {
      sellerName: "Shop One",
      sellerCnic: "3520212345671",
      shopkeeperId: sk.id,
      imei: "357777777777777",
      brand: "Xiaomi",
      model: "Note",
      condition: "used",
      purchasePricePkr: 50000,
      payment: { cashPkr: 20000, bankPkr: 0 },
    });
    expect(searchByCnic(BRANCH, "35202-1234567-1")?.name).toBe("Shop One");
    expect(loadMobizoneDb(BRANCH).customers).toHaveLength(1);
    expect(shopkeeperBalance(BRANCH, sk.id)).toBe(30000);
  });
});
