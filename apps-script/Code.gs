/**
 * ============================================================
 *  RESORT BOOKING CONFIRMATION TOOL (BACKEND)
 * ============================================================
 *
 * WHAT THIS FILE IS:
 * A Google Apps Script that runs "inside" your Google Sheet and acts as a
 * tiny, free backend. The booking form on the website sends the booking
 * details here, and this script writes them as a new row in the sheet.
 *
 * HOW TO USE IT (you only do this once, or when it changes):
 * 1. Open the Google Sheet that holds the bookings.
 * 2. In the menu: Extensions → Apps Script.
 * 3. Delete whatever is in the editor and paste this entire file in.
 * 4. Click Deploy → New deployment → type: "Web app".
 *      - Execute as:  Me (your account)
 *      - Who has access: Anyone with the link
 * 5. Copy the Web App URL it gives you — the website needs it
 *    (it goes in the script.js file on the website, see CONFIG there).
 * 6. If you edit this file later: Deploy → Manage deployments →
 *    edit (pencil icon) → Version: "New version" → Deploy.
 *
 * WHY "Anyone with the link" IS OKAY HERE:
 * There is no login system, so the link acts as the password. It lets
 * people add bookings if they have the URL. The URL is only known to
 * the website and to you — never post it publicly.
 *
 * IF IT EVER STOPS WORKING:
 * Google sometimes asks you to re-authorize the script after it detects
 * changes. Open this script in the editor and run `setUpSheet` once —
 * Google will show an authorization prompt; click through it
 * (Review permissions → choose your account → Advanced → Go to project
 * (unsafe) → Allow). Then re-test from the website.
 */

/**
 * doPost runs automatically when the website sends data.
 *
 * It expects a POST request whose body is JSON like:
 *   {
 *     "guest_name": "Rajesh Sharma",
 *     "guest_phone": "919876543210",
 *     ... and the other booking fields ...
 *   }
 *
 * It replies with JSON:
 *   { "success": true, "booking_id": "BK-20260315-001" }
 * or, if something went wrong:
 *   { "success": false, "error": "a description of the problem" }
 */
function doPost(e) {
  try {
    // --- 1. Read the data the website sent -------------------------
    // e.postData.contents is the raw JSON text of the request.
    var booking = JSON.parse(e.postData.contents);

    // --- 2. Find (or create) the sheet and its header row ---------
    var sheet = setUpSheet();

    // --- 3. Check that the important boxes were filled in ---------
    // These match the "required" fields on the website's form.
    var required = ['guest_name', 'guest_phone', 'check_in_date',
                    'check_out_date', 'package_type', 'headcount',
                    'receptionist_name'];
    for (var i = 0; i < required.length; i++) {
      var field = required[i];
      if (booking[field] === undefined || booking[field] === null ||
          String(booking[field]).trim() === '') {
        return jsonReply_({ success: false,
                            error: 'Missing field: ' + field });
      }
    }

    // --- 4. Generate the values the website can't know ------------
    // booking_id: built from today's date, plus a count of how many
    // bookings were already made today (001, 002, ...). Example:
    // BK-20260315-001  = first booking on 15 March 2026.
    var now = new Date();
    var datePart = Utilities.formatDate(now,
                      Session.getScriptTimeZone(), 'yyyyMMdd');
    var todayCount = countBookingsToday_(sheet, datePart);
    var bookingId = 'BK-' + datePart + '-' +
                    padNumber_(todayCount + 1, 3);

    // created_at: readable date + time, e.g. "2026-03-15 14:32"
    var createdAt = Utilities.formatDate(now,
                      Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');

    // --- 5. Add the new row, columns in the exact fixed order ------
    // IMPORTANT: if you ever add a column to the sheet, add it here
    // in the same position so the sheet and this script stay in sync.
    sheet.appendRow([
      bookingId,                                   // booking_id
      createdAt,                                   // created_at
      String(booking.guest_name).trim(),           // guest_name
      String(booking.guest_phone).trim(),          // guest_phone
      String(booking.check_in_date).trim(),        // check_in_date
      String(booking.check_out_date).trim(),       // check_out_date
      String(booking.package_type).trim(),         // package_type
      booking.headcount,                           // headcount
      booking.rooms_needed === undefined ||
        booking.rooms_needed === null ||
        booking.rooms_needed === ''
        ? '' : booking.rooms_needed,               // rooms_needed (optional)
      booking.notes ? String(booking.notes).trim() : '', // notes (optional)
      String(booking.receptionist_name).trim(),    // receptionist_name
      'Confirmed'                                  // status
    ]);

    // --- 6. Tell the website it worked, and give back the ID ------
    return jsonReply_({ success: true, booking_id: bookingId });

  } catch (err) {
    // Something unexpected broke — pass the reason back to the website
    // so it can show an error instead of silently failing.
    return jsonReply_({ success: false, error: String(err) });
  }
}

/**
 * Makes sure a tab named "Bookings" exists with the correct header row.
 *
 * The website never calls this directly, but you can (and sometimes
 * should) run it once by hand: open this script in the editor, choose
 * "setUpSheet" in the function dropdown, click Run. It creates the
 * sheet + headers if they're missing, and does nothing if they exist.
 */
function setUpSheet() {
  var NAME = 'Bookings';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(NAME);

  if (!sheet) {
    // First time: create the tab and the header row.
    sheet = ss.insertSheet(NAME);
    sheet.appendRow([
      'booking_id', 'created_at', 'guest_name', 'guest_phone',
      'check_in_date', 'check_out_date', 'package_type', 'headcount',
      'rooms_needed', 'notes', 'receptionist_name', 'status'
    ]);
    // Bold the header row and freeze it so it stays visible when scrolling.
    var header = sheet.getRange(1, 1, 1, 12);
    header.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ------------------------------------------------------------
// Helpers below — the main logic above is all you normally touch.
// ------------------------------------------------------------

/**
 * Counts how many booking rows were created today, so today's
 * bookings can be numbered 001, 002, 003, ...
 * (Reads the booking_id column, which starts with BK-<today's date>.)
 */
function countBookingsToday_(sheet, datePart) {
  var prefix = 'BK-' + datePart;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0; // only the header row, no bookings yet
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var count = 0;
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).indexOf(prefix) === 0) count++;
  }
  return count;
}

/** Turns 7 into "007" so booking IDs are always the same width. */
function padNumber_(num, width) {
  var s = String(num);
  while (s.length < width) s = '0' + s;
  return s;
}

/**
 * Wraps a JavaScript object as a JSON response the website can read.
 * (Apps Script replies with a weird format by default — this fixes
 * the content type so the browser's fetch() understands it.)
 */
function jsonReply_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
