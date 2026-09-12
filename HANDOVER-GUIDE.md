# Resort Booking Tool: Handover Guide

This guide is for whoever looks after the booking tool after handover.
No coding knowledge is needed — every change is a matter of editing one
file in one place and republishing.

---

## 1. What the tool does (in one minute)

The receptionist opens the website, fills in the booking details the guest
gives on the phone, and presses **Generate Confirmation**. The tool:

1. Saves the booking to a Google Sheet (your master record of all bookings).
2. Shows two ready-made WhatsApp messages — one for the guest, one for you.
3. She taps **Send to Guest**, then **Send to Owner**. WhatsApp opens with
   the message already typed — she just presses the send arrow.

---

## 2. How to see all bookings

1. Open the bookings Google Sheet (bookmark it — you'll use it often).
2. Every booking is one row, newest at the bottom. The columns are named at
   the top: guest name, phone, check-in, check-out, package, guests, rooms,
   notes, who took the booking, and status.
3. Each booking has an ID like `BK-20260315-001` — the date is the booking
   date, and the number is which booking of the day it was.

You can search, filter, or print the Sheet like any spreadsheet. You can
also edit rows (e.g. correct a typo) — the website only *adds* new rows,
it never changes or deletes existing ones.

---

## 3. If the owner's WhatsApp number changes

The owner's number is saved in one file:

1. Find the file called `script.js` (on the website's files, e.g. in the
   GitHub repo or the folder you drag onto Netlify).
2. Near the top, find the line that looks like:

   ```
   var OWNER_PHONE = '919876543210';
   ```

3. Replace the number with the new one — **country code first, digits
   only, no + or spaces** (Indian numbers start with 91).
4. Republish the site (see section 4).

The guest's number is never stored there — it comes from the form each time.

---

## 4. If any text needs changing (address, contact numbers, package names)

The site's files live in the GitHub repo (or the folder you last dragged
onto Netlify). Which file to edit depends on what you're changing:

| What you're changing | File to edit | Where |
|---|---|---|
| Address / contact numbers in the guest message | `script.js` | Lines near the top: `RESORT_ADDRESS` and `RESORT_CONTACT` |
| Package names in the dropdown | `index.html` | The `<option>` lines under "Package type" — **also** update `apps-script/Code.gs`'s comment header if you rename them, and keep the Google Sheet's notes consistent |
| Wording of the WhatsApp messages | `script.js` | The `buildGuestMessage` / `buildOwnerMessage` sections |
| Headings, buttons, labels | `index.html` | Find the text and edit it — it's plain English in the file |
| Colors, sizes | `style.css` | The comments in the file say which part is which |

After editing, republish:

- **If connected to GitHub (Vercel):** the site updates automatically a
  minute or two after you save the change in GitHub.
- **If drag-and-drop (Netlify):** go to your site in Netlify →
  **Deploys** → drag the updated folder onto the page.

Then refresh the site in the browser (maybe twice, or clear the browser's
cache) and check the change shows up.

---

## 5. If the Google Apps Script stops working

The most common cause: **Google needs re-authorization**. Google sometimes
resets permissions after security reviews. Fix:

1. Open the bookings Google Sheet.
2. Go to **Extensions → Apps Script**.
3. In the function dropdown (top toolbar, next to "Run"), choose
   **setUpSheet**, then click **Run**.
4. If Google shows an "authorization required" popup: click
   **Review permissions** → choose your Google account → **Advanced** →
   **Go to project (unsafe)** → **Allow**.
5. If it still fails, do a fresh deployment:
   **Deploy → Manage deployments → ✏ (edit) → Version: "New version" →
   Deploy**. The website keeps working — the address of the script
   doesn't change.
6. Test by submitting a booking from the website and checking it appears
   in the Sheet.

**If a booking says "Could not save" on the website:** it is almost always
the internet connection, not the tool. The form stays filled in — once
online, press **Generate Confirmation** again. (If the booking actually
did save despite the error — check the Sheet before retrying — delete the
duplicate row.)

---

## 6. Quick troubleshooting

**"The WhatsApp message isn't sending"**
- WhatsApp opens but the message is blank? Check the guest's phone number
  was entered with country code, digits only (e.g. 919876543210).
- Nothing opens at all? The phone may be blocking pop-ups/new tabs — allow
  them for this site. WhatsApp must be installed (or use WhatsApp Web on a
  computer).
- The text *will* look strange in the link itself (symbols like %20) — that's
  normal encoding; WhatsApp shows it correctly.

**"The form isn't saving to the Sheet"**
- See section 5 first (re-authorization).
- Check the internet connection.
- Still failing? In the Google Sheet: **Extensions → Apps Script →
  Executions** (left sidebar) — the most recent run shows an error message
  you can screenshot for support.

**"I made a mistake in a saved booking"**
- Just fix it directly in the Google Sheet. The Sheet is the record of truth.

**"The receptionist's name disappeared"**
- It's remembered per device (and cleared if browser data is cleared). She
  just types it once with the next booking and it sticks again.

---

## 7. Important cautions

- **Never share the Apps Script URL** (it starts with
  `script.google.com/macros/...`). Anyone with it could add rows to your
  Sheet. The website uses it internally — you never need to send it to anyone.
- **Keep the GitHub repo private** for the same reason (the URL is inside
  the files).
- The **Sheet is the master record**. If a booking matters, double-check
  it's in the Sheet — the WhatsApp message is just a notification.

---

## 8. Ideas for later (not needed now)

- A calendar view of booked dates, to spot double-bookings easily.
- Automatic warning when dates overlap an existing booking.
- A simple password on the site if more staff start using it.
