const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' -]{1,79}$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9()\s.-]{7,25}$/;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasUnsafeControlCharacters(value) {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
}

function validateBookingDetails(input) {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const firstName = cleanString(body.firstName);
  const lastName = cleanString(body.lastName);
  const email = cleanString(body.email).toLowerCase();
  const phone = cleanString(body.phone);
  const message = cleanString(body.message);
  const errors = {};

  if (!firstName) {
    errors.firstName = 'First name is required.';
  } else if (firstName.length > 80 || !NAME_PATTERN.test(firstName)) {
    errors.firstName = 'Enter a valid first name using letters, spaces, hyphens, or apostrophes.';
  }

  if (!lastName) {
    errors.lastName = 'Last name is required.';
  } else if (lastName.length > 80 || !NAME_PATTERN.test(lastName)) {
    errors.lastName = 'Enter a valid last name using letters, spaces, hyphens, or apostrophes.';
  }

  if (!email) {
    errors.email = 'Email is required.';
  } else if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (phone && (phone.length > 25 || !PHONE_PATTERN.test(phone) || phone.replace(/\D/g, '').length < 7)) {
    errors.phone = 'Enter a valid phone number or leave this field blank.';
  }

  if (!message) {
    errors.message = 'Please tell us what you would like support with.';
  } else if (message.length < 10 || message.length > 2000 || hasUnsafeControlCharacters(message)) {
    errors.message = 'Message must be between 10 and 2,000 characters.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    values: { firstName, lastName, email, phone, message },
  };
}

function validateCheckoutSessionId(value) {
  const sessionId = cleanString(value);
  if (!/^cs_[A-Za-z0-9_]{1,252}$/.test(sessionId)) {
    return { valid: false, sessionId: '', error: 'A valid payment session is required.' };
  }
  return { valid: true, sessionId };
}

module.exports = {
  validateBookingDetails,
  validateCheckoutSessionId,
};
