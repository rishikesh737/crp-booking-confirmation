/* ============================================================
   Resort booking tool — front-end logic
   Plain JavaScript, no libraries.

   WHAT THIS FILE DOES:
   1. Checks the form is filled in correctly (inline error messages).
   2. Sends the booking to the Google Sheet backend.
   3. On success, shows the WhatsApp message previews and the
      "Send to Guest" / "Send to Owner" buttons.

   SET UP (only needed once, or if things change):
   - Fill in APPS_SCRIPT_URL below with the Web App URL from the
     Google Apps Script deployment (see apps-script/Code.gs header).
   - Fill in OWNER_PHONE with the owner's WhatsApp number.
   ============================================================ */

// ================== CONFIG — EDIT THESE LINES ======================

// The resort's name. Appears in the page title, the header, and the
// guest's WhatsApp confirmation message.
var RESORT_NAME = 'Your Resort Name';

// The Google Apps Script Web App URL. Looks like:
// https://script.google.com/macros/s/AKfycb.../exec
// Leave the placeholder in place to run in TEST MODE (see onSubmit):
// the whole flow can be tried locally without any backend.
var APPS_SCRIPT_URL = 'PASTE_YOUR_APPS_SCRIPT_URL_HERE';

// Owner's WhatsApp number: country code + number, digits only.
// Example for India: '919876543210'. No +, spaces, or dashes.
var OWNER_PHONE = '919876543210';

// Fixed contact details that appear in the guest message
// (change here if the address or contact numbers ever change).
var RESORT_ADDRESS = 'PASTE_RESORT_ADDRESS_HERE';
var RESORT_CONTACT = '+91 90000 00000 / +91 90000 00001';

// ====================================================================


// Runs once when the page loads.
document.addEventListener('DOMContentLoaded', function () {
  // Branding comes from the CONFIG block at the top, so everything
  // the owner might ever rename lives in exactly one place.
  document.title = RESORT_NAME + ' — New Booking';
  document.getElementById('resort-name').textContent = RESORT_NAME;

  // Remember the receptionist's name between visits (saved on this
  // device only) so she doesn't retype it for every booking.
  var savedName = localStorage.getItem('receptionist_name');
  if (savedName) {
    document.getElementById('receptionist_name').value = savedName;
  }

  document.getElementById('booking-form')
    .addEventListener('submit', onSubmit);
  document.getElementById('new-booking-btn')
    .addEventListener('click', resetForNewBooking);

  // Phone field: as she types (or pastes), drop anything that isn't a
  // digit — spaces, dashes, a leading +91 — so the field only ever
  // holds the bare 10-digit number.
  document.getElementById('guest_phone')
    .addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '');
    });
});

/**
 * What happens when "Generate Confirmation" is pressed.
 *
 * THE FLOW, STEP BY STEP:
 * 1. VALIDATION — validateBooking() checks every required field
 *    (guest name, phone, both dates, package, headcount, your name),
 *    plus the phone format (10–15 digits, country code included),
 *    and that check-out is not before check-in. Anything wrong shows
 *    a red message under that field, and NOTHING is sent anywhere.
 * 2. SAVE — the booking is POSTed to the Google Apps Script URL
 *    (APPS_SCRIPT_URL, set at the top of this file), which appends
 *    it to the Google Sheet and replies with the booking ID.
 * 3a. SUCCESS — the form is hidden and the confirmation panel takes
 *     its place, showing a preview of both WhatsApp messages and the
 *     "Send to Guest" / "Send to Owner" buttons.
 * 3b. FAILURE — a red "Could not save the booking" box appears, the
 *     form stays exactly as filled in, and the button can simply be
 *     pressed again (usually it's just the internet connection).
 *
 * WHY THE BODY IS SENT AS text/plain, NOT JSON:
 * Apps Script would reject a "preflight" check that a JSON
 * Content-Type header triggers. Sending the JSON text with a plain
 * text/plain header keeps the request "simple" so the browser posts
 * it straight through — the Apps Script code parses the text itself.
 *
 * WHY APPS_SCRIPT_URL AND OWNER_PHONE ARE CONSTANTS AT THE TOP:
 * They are the only two things that differ between setups. Keeping
 * them at the very top, clearly labelled, means whoever maintains
 * this never has to hunt through the logic to re-point the tool.
 */
function onSubmit(event) {
  // Stop the browser's default form submit (which would reload
  // the page and lose everything).
  event.preventDefault();

  hideAllErrors();

  // --- 1. Collect the form values -----------------------------
  var booking = {
    guest_name:       getValue('guest_name'),
    guest_phone:      getValue('guest_phone'),
    check_in_date:    getValue('check_in_date'),
    check_out_date:   getValue('check_out_date'),
    package_type:     getValue('package_type'),
    headcount:        getValue('headcount'),
    rooms_needed:     getValue('rooms_needed'),   // may be ''
    notes:            getValue('notes'),          // may be ''
    receptionist_name: getValue('receptionist_name')
  };

  // --- 2. Validate ----------------------------------------------
  if (!validateBooking(booking)) {
    return; // errors are shown inline; nothing was sent anywhere
  }

  // --- 3. Save to the Google Sheet ------------------------------

  // TEST MODE: while APPS_SCRIPT_URL at the top of this file is still
  // the placeholder, there is no backend to save to yet. Instead of
  // failing, we show the confirmation panel with a TEST booking ID so
  // the whole flow (validation, previews, WhatsApp buttons) can be
  // tried out locally. This switches itself OFF automatically as soon
  // as a real URL is pasted in — nothing to remember to change.
  if (APPS_SCRIPT_URL.indexOf('PASTE_YOUR') !== -1) {
    showConfirmation(booking, 'TEST-MODE (not saved to any sheet)');
    return;
  }

  setSaving(true);

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    // No custom headers: they would trigger a CORS pre-flight the
    // Apps Script endpoint can't answer. Plain 'text/plain' body
    // keeps the request "simple" while still sending JSON text.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(booking)
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Server responded with status ' + response.status);
      }
      return response.json();
    })
    .then(function (result) {
      if (result.success !== true) {
        throw new Error(result.error || 'The backend rejected the booking.');
      }
      setSaving(false);
      showConfirmation(booking, result.booking_id);
    })
    .catch(function (err) {
      // Network failure, or the backend reported an error.
      // The form stays filled in — she can simply press the button
      // again once the problem (usually connectivity) is fixed.
      setSaving(false);
      showError(null, 'Details: ' + err.message);
    });
}

/**
 * Checks every required field; shows red inline messages next to
 * anything missing or wrong. Returns true only if everything passes.
 */
function validateBooking(booking) {
  var ok = true;

  ok = checkRequired('guest_name', 'Please enter the guest name.') && ok;
  ok = checkRequired('guest_phone', 'Please enter the guest phone number.') && ok;
  ok = checkRequired('check_in_date', 'Please pick a check-in date.') && ok;
  ok = checkRequired('check_out_date', 'Please pick a check-out date.') && ok;
  ok = checkRequired('package_type', 'Please choose a package type.') && ok;
  ok = checkRequired('headcount', 'Please enter the number of guests.') && ok;
  ok = checkRequired('receptionist_name', 'Please enter your name.') && ok;

  // Phone: exactly 10 digits (Indian mobile). The receptionist types
  // only the local number — the "91" country code is added
  // automatically below, so it is never typed twice.
  if (booking.guest_phone) {
    var digits = booking.guest_phone.replace(/\D/g, ''); // strip pasted spaces, dashes, stray characters
    if (!/^(\d{10})$/.test(digits)) {
      showFieldError('guest_phone',
        'Enter exactly 10 digits — e.g. 98765 43210 (no country code needed).');
      ok = false;
    } else {
      // Store the full international form ("91" + 10 digits) that
      // WhatsApp links and the Sheet both expect.
      booking.guest_phone = '91' + digits;
    }
  }

  // Check-out must be on or after check-in.
  if (booking.check_in_date && booking.check_out_date &&
      booking.check_out_date < booking.check_in_date) {
    showFieldError('check_out_date',
      'Check-out cannot be before check-in.');
    ok = false;
  }

  // Headcount: a whole number, 1 or more.
  if (booking.headcount && (isNaN(Number(booking.headcount)) ||
      Number(booking.headcount) < 1)) {
    showFieldError('headcount', 'Enter a number of guests (1 or more).');
    ok = false;
  }

  return ok;
}

/**
 * Small helper used by validateBooking for the seven required
 * fields: if the field with this id is empty, it shows the given
 * red message under it and returns false; otherwise true.
 */
function checkRequired(id, message) {
  if (!getValue(id)) {
    showFieldError(id, message);
    return false;
  }
  return true;
}

/* ---------- Message templates ---------- */

/**
 * The confirmation message sent to the GUEST.
 * (Multi-line strings are built by joining lines so the template
 * is easy to read and edit.)
 */
function buildGuestMessage(booking) {
  return [
    'Hi ' + booking.guest_name + ', your booking at ' + RESORT_NAME + ' is confirmed!',
    '',
    'Check-in: ' + booking.check_in_date,
    'Check-out: ' + booking.check_out_date,
    'Package: ' + booking.package_type,
    'Guests: ' + booking.headcount,
    '',
    'Address: ' + RESORT_ADDRESS,
    'Contact: ' + RESORT_CONTACT,
    '',
    'We look forward to hosting you!'
  ].join('\n');
}

/**
 * The notification message sent to the OWNER (same booking,
 * phrased as a notification, includes rooms/notes/taken-by).
 */
function buildOwnerMessage(booking) {
  return [
    'New booking confirmed:',
    '',
    'Guest: ' + booking.guest_name + ' (' + booking.guest_phone + ')',
    'Check-in: ' + booking.check_in_date,
    'Check-out: ' + booking.check_out_date,
    'Package: ' + booking.package_type,
    'Guests: ' + booking.headcount,
    'Rooms: ' + (booking.rooms_needed || '-'),
    'Notes: ' + (booking.notes || '-'),
    'Taken by: ' + booking.receptionist_name
  ].join('\n');
}

/**
 * Builds a wa.me click-to-chat link. WhatsApp opens with the
 * message already typed in; the user just presses send.
 *
 * encodeURIComponent is essential — it safely encodes the line
 * breaks and any special characters in the message.
 */
function buildWhatsAppLink(phone, message) {
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
}

/* ---------- Confirmation panel ---------- */

/**
 * Called after the booking saves successfully: fills the previews,
 * wires up the two WhatsApp buttons, and swaps form → panel.
 */
function showConfirmation(booking, bookingId) {
  var guestMessage = buildGuestMessage(booking);
  var ownerMessage = buildOwnerMessage(booking);

  document.getElementById('booking-id-text').textContent = bookingId;
  document.getElementById('guest-message-preview').textContent = guestMessage;
  document.getElementById('owner-message-preview').textContent = ownerMessage;

  document.getElementById('send-guest-btn').href =
    buildWhatsAppLink(booking.guest_phone, guestMessage);
  document.getElementById('send-owner-btn').href =
    buildWhatsAppLink(OWNER_PHONE, ownerMessage);

  // Remember who took the booking, to pre-fill next time.
  localStorage.setItem('receptionist_name', booking.receptionist_name);

  document.getElementById('booking-form').hidden = true;
  document.getElementById('confirmation-panel').hidden = false;
  window.scrollTo(0, 0); // show the confirmation from the top
}

/**
 * "New booking" button: hide the panel, clear the form (except the
 * receptionist's name, which stays for the next call).
 */
function resetForNewBooking() {
  var form = document.getElementById('booking-form');
  form.reset(); // clears fields; required ones show placeholder again

  // form.reset() also clears the name — put it back.
  var savedName = localStorage.getItem('receptionist_name');
  if (savedName) {
    document.getElementById('receptionist_name').value = savedName;
  }

  document.getElementById('confirmation-panel').hidden = true;
  form.hidden = false;
  window.scrollTo(0, 0);
}

/* ---------- Small helpers ---------- */

/** Current value of a form field by its id ('' if empty). */
function getValue(id) {
  return (document.getElementById(id).value || '').trim();
}

/** Shows the red message under one field and marks the input. */
function showFieldError(id, message) {
  var input = document.getElementById(id);
  var errorEl = document.getElementById(id + '-error');
  input.classList.add('invalid');
  errorEl.textContent = message;
  errorEl.hidden = false;
}

/** Clears every inline error and red highlight. */
function hideAllErrors() {
  var errors = document.querySelectorAll('.error');
  for (var i = 0; i < errors.length; i++) {
    errors[i].hidden = true;
    errors[i].textContent = '';
  }
  var inputs = document.querySelectorAll('.invalid');
  for (var j = 0; j < inputs.length; j++) {
    inputs[j].classList.remove('invalid');
  }
  document.getElementById('error-box').hidden = true;
}

/** Shows the red "couldn't save" box. fieldId may be null for a
    general (non-field) error. */
function showError(fieldId, detail) {
  if (fieldId) {
    // currently only used generically, kept for future field errors
  }
  document.getElementById('error-detail').textContent = detail || '';
  document.getElementById('error-box').hidden = false;
}

/**
 * Toggles "saving" state: disables the submit button so the same
 * booking can't be sent twice, shows the saving message.
 */
function setSaving(saving) {
  document.getElementById('submit-btn').disabled = saving;
  document.getElementById('saving-msg').hidden = !saving;
}
