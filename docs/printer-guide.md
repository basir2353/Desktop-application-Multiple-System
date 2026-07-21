# Printer Guide (Easy Steps)

How to set up printers, assign them to people, and change them on the POS screen.

---

## Quick overview

| What | Where | Who |
|------|--------|-----|
| Create printers & link Windows printers | **Printer** page → **Printer Profiles** | Admin / Manager |
| Kitchen / Bar print destinations | **Printer** page → **Sections** | Admin / Manager |
| Which menu goes to which kitchen | **Printer** page → **Categories** / **Items**, or **Menu** | Admin / Manager |
| Assign printers to many users | **Printer** page → **Assign Users** | Admin / Manager |
| Change **my** printer on POS | POS toolbar → **My printers** | Any cashier |
| Assign printer by **waiter name** | **Waiter** page → **Printer assignments** | Admin / Manager |

---

## Step 1 — Add a printer profile

1. Open **Printer** from the left menu.
2. Open the **Printer Profiles** tab.
3. Click **Add** (or create a new profile).
4. Fill in:
   - **Name** — easy name, e.g. `Counter 1 Receipt`, `Kitchen Epson`
   - **Type** — choose one:
     - **Receipt** — bills / invoices (POS Pay, Print invoice)
     - **Kitchen** — KOT / food tickets
     - **Bar** — drinks tickets
   - **System printer** — pick the real Windows printer (not Fax / PDF / OneNote)
   - **Counter** (optional) — e.g. `Counter 1`
5. Save.

**Tip:** One real USB/network printer = one profile. You can create several profiles if you have several machines.

---

## Step 2 — Link sections (Kitchen / Bar)

1. Stay on **Printer** → **Sections**.
2. Keep sections enabled (Kitchen, Bar, etc.).
3. For each section, assign a **printer profile** as primary (and backups if you want).

When an order is sent, food lines go to Kitchen section printers, drink lines go to Bar (depending on menu routing).

---

## Step 3 — Route menu to the right section

### By category (easiest)

1. **Printer** → **Categories**, **or** open **Menu** and set “Print to” on a category.
2. Example: category **Beverages** → **Bar**; category **Grill** → **Kitchen**.

### By item (optional override)

1. Edit a menu item.
2. Turn off “Use category’s printing” if needed.
3. Pick the section(s) for that dish only.

---

## Step 4 — Assign printers to people

### A) On POS (easiest for cashiers)

Each login can set **their own** printers without opening the Printer page.

1. Open **POS**.
2. Top toolbar → click **My printers**.
3. Choose:
   - **Receipt printer** — for Pay / Print invoice
   - **Kitchen printer** — personal kitchen preference (optional)
   - **Bar printer** — personal bar preference (optional)
4. Click **Done**.

If you leave Receipt as **Branch default**, the shared branch receipt printer is used.

**Change anytime:** open **My printers** again and pick another printer. It only affects the person who is logged in.

### B) By waiter name (Waiter module)

1. Open **Waiter**.
2. Open **Printer assignments**.
3. Under each **waiter name**, select a **Receipt** printer from the list.
4. That waiter’s bills print on the printer you chose.

### C) Assign many users at once (admin)

1. **Printer** → **Assign Users**.
2. Find the user (email / role).
3. Tick the printers they should use (Receipt + Kitchen + Bar as needed).
4. One printer can be shared by many users.

---

## How POS chooses a printer

### Bills / invoices (Pay, Print invoice)

1. Your personal **Receipt** printer from **My printers** (or Assign Users)
2. Else the **branch default** receipt printer
3. Else any receipt profile that is available

### Kitchen tickets (Order / Print order)

1. Section printers for that menu (Kitchen / Bar), preferring printers also assigned to you
2. Else your personal Kitchen / Bar printer
3. Else the branch default for that type

---

## Common tasks

### “I want a different receipt printer on this counter”

1. POS → **My printers**
2. Change **Receipt printer**
3. **Done**
4. Print a test invoice

### “Waiter Ali should print on patio printer”

1. Create a Receipt profile linked to the patio Windows printer
2. **Waiter** → **Printer assignments**
3. Next to **Ali**, select that profile

### “Drinks must go to bar printer”

1. Create a **Bar** profile linked to the bar Windows printer
2. **Sections** → assign that profile to **Bar**
3. Menu category **Beverages** → print to **Bar**

### “Print failed / wrong printer”

1. Check the Windows printer is online and selected (not Fax/PDF)
2. POS → **My printers** — confirm the correct profile is selected
3. **Printer** → **Printer Profiles** — confirm **System printer** is linked
4. Try **Print invoice** or **Print order** again

---

## Simple checklist (first-time setup)

1. [ ] Add **Receipt** profile → link Windows printer  
2. [ ] Add **Kitchen** profile → link kitchen Windows printer  
3. [ ] (Optional) Add **Bar** profile  
4. [ ] **Sections** → attach profiles to Kitchen / Bar  
5. [ ] Categories → Kitchen or Bar  
6. [ ] Each cashier: POS → **My printers** → pick Receipt  
7. [ ] Each waiter: Waiter → **Printer assignments** → pick by name  
8. [ ] Test: place order → kitchen ticket; Pay → receipt  

---

## Do / Don’t

| Do | Don’t |
|----|--------|
| Use real OS printers (Epson, Star, etc.) | Use Fax, Microsoft Print to PDF, OneNote |
| Give clear names (`Counter 1 Receipt`) | Reuse one vague name for everything |
| Let each cashier set **My printers** | Force everyone onto one PC’s default without assigning |
| Assign waiters **by name** | Type random station text that is not a real printer |

---

## Where settings are stored

Printer profiles, section routing, and user assignments are saved **on this computer** (per branch).  

If you install POPS on another PC, set up printers again on that PC (or copy the same Windows printer names and re-assign).

---

## Need help?

- **POS button:** **My printers** (top bar next to Paying out)  
- **Full admin screen:** **Printer** page  
- **Waiters by name:** **Waiter** → **Printer assignments**
