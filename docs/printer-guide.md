# Printer Guide (Easy)

Simple steps to set up printers in POPS and print from POS.

---

## What you will use

| Step | Screen | What it does |
|------|--------|----------------|
| 1 | **Printer → All Printers** | Add every real printer |
| 2 | **Printer → Printer by Section** | Put printers into Kitchen / Bar / Receipt, and assign people |
| 3 | **Printer → Print Settings** | Paper size (58/80mm), margins, compact money — fixes cut-off receipts |
| 4 | **Printer → Categories** | Send each menu group to the right section |
| 5 | **POS → My printers** | Each cashier picks their own receipt printer |
| 6 | **Waiter → Printer assignments** | Assign a receipt printer by waiter name |

---

## First-time setup (do this once)

### Step 1 — Add printers

1. Open **Printer**.
2. Open the **All Printers** tab.
3. Type a clear name (example: `Kitchen Epson`, `Counter 1 Receipt`).
4. Choose type:
   - **Receipt** = bills / Pay / Print invoice  
   - **Kitchen** = food tickets (KOT)  
   - **Bar** = drink tickets  
5. Link a **Windows printer** (USB, network, or **Print to PDF** / XPS if you want file saves).
6. Click **Add profile**.

**Tip:** Physical printers are best for the kitchen counter. PDF/XPS are fine for Auto save-to-file testing or offices without a thermal printer.

You can add the name first and link the Windows printer later if needed.

---

### Step 2 — Printer by Section

1. Open **Printer by Section**.
2. Use ready sections (Kitchen, Bar, …) or click **Add section**.
3. Click a section (example: **Kitchen**).
4. Under **Assigned printers**:
   - Click **+** to add a printer  
   - First printer = **Primary**  
   - Use **↑ ↓** to change order  
5. Under **Assigned users / waiters**:
   - Add cashiers or waiters who should use this section  

**Result:** each section has its own printers and its own people.

You can also:
- **Edit** section name / icon / color  
- **Disable** a section  
- **Delete** a custom section (system sections stay)

---

### Step 3 — Print Settings (paper size)

If the right side of the receipt is cut off (Amount / Total missing):

1. Open **Printer → Print Settings**.
2. Set **Default paper size** to match the roll (**58mm** or **80mm**).
3. Keep **Side margin** low (0–2 mm).
4. Leave **Compact money** on.
5. On each printer profile (All Printers), set the same **Paper size**.
6. Click **Send test print** and confirm amounts are fully visible.

Physical printers print a **clear stacked receipt** (item name, then full amount) so nothing is cut off.

---

### Step 4 — Menu → section

1. Open **Categories** (or **Items** for one dish only).
2. Example:
   - Grill / Mains → **Kitchen**  
   - Beverages → **Bar**  

When staff press **Order**, tickets go to the correct section printer.

---

### Step 5 — Cashier on POS

1. Open **POS**.
2. Top bar → **My printers**.
3. Pick:
   - **Receipt printer** (for Pay / invoice)  
   - Kitchen / Bar (optional)  
4. Click **Done**.

Each login keeps its own printers. Change anytime from **My printers**.

---

### Step 6 — Waiters (by name)

1. Open **Waiter**.
2. Open **Printer assignments**.
3. Under each waiter **name**, choose a receipt printer.

Or assign waiters inside **Printer by Section** on the Waiter / Cashier section.

---

## Daily use

| Action | What prints | Where it goes |
|--------|-------------|---------------|
| **Order** / **Print order** | Kitchen ticket | Section printers (Kitchen / Bar) |
| **Pay** / **Print invoice** | Bill | Your **My printers** receipt (or branch default) |

---

## Common jobs

### Change receipt printer on this counter

1. POS → **My printers**  
2. Change **Receipt printer**  
3. **Done**  
4. Test with **Print invoice**

### Waiter Ali uses patio printer

1. **All Printers** → add Receipt profile linked to patio printer  
2. **Waiter → Printer assignments** → Ali → select that printer  

### Drinks print at the bar

1. **All Printers** → Bar type + bar Windows printer  
2. **Printer by Section** → **Bar** → add that printer  
3. **Categories** → Beverages → **Bar**

### Add profile button did nothing / error

Check the message at the top of the Printer page.

- Link any Windows printer (Epson, network, **Microsoft Print to PDF**, XPS, …).
- Or leave OS printer empty, add the profile, then link later.

PDF/XPS Auto may show a Windows “Save as” dialog — that is normal.

---

## Checklist

- [ ] Printers added under **All Printers** (USB/network and/or PDF/XPS)  
- [ ] Each linked to a Windows printer for Auto  
- [ ] Paper size set under **Print Settings** + each profile  
- [ ] **Kitchen** section has kitchen printer(s)  
- [ ] **Bar** section has bar printer (if needed)  
- [ ] Categories point to Kitchen / Bar  
- [ ] Cashiers set **My printers** on POS  
- [ ] Waiters assigned by name  
- [ ] Test: **Order** → kitchen ticket; **Pay** → receipt (no cut-off)  

---

## Do / Don’t

| Do | Don’t |
|----|--------|
| Link any Windows printer you need (Epson, network, PDF, XPS) | Leave every profile unlinked if you want silent Auto |
| Use clear names (`Counter 1 Receipt`, `PDF Receipt`) | Use one unclear name for everything |
| Manage with **Printer by Section** | Rely only on legacy assignment |
| Let each cashier use **My printers** | Share one wrong default for everyone |

---

## Advanced (usually hide)

At the bottom of the Printer page:

**Advanced → Show legacy assignment**

This opens the old user / category / item name list.  
**New shops should ignore this.** Prefer All Printers + Printer by Section.

Click **Hide legacy assignment** to close it again.

---

## How printing is chosen (short)

**Bill / invoice**

1. Your **My printers** receipt  
2. Else branch default receipt  
3. Else first online **OS-linked** receipt profile (Auto)  
4. Else any receipt profile  

**Kitchen / Bar ticket**

1. Section printers (if you are assigned to that section, those printers are used)  
2. Else your personal Kitchen / Bar printer  
3. Else branch default for that type  

**Auto vs manual**

- **Auto (linked OS printer):** prints silently to that device (PDF/XPS may ask where to save).  
- **If Auto fails:** Windows print dialog opens (same path as manual).  
- **Not linked:** Windows print dialog — pick the printer yourself.  

---

## Notes

- Settings are saved **on this PC**, per branch.  
- A new PC needs the same setup again (or the same Windows printer names + re-assign).  
- Full English steps: this file (`docs/printer-guide.md`).

---

## Quick links in the app

- **Printer** page → All Printers / Printer by Section / Categories  
- **POS** → **My printers**  
- **Waiter** → **Printer assignments**  
- **Advanced** → Show legacy assignment (optional)
