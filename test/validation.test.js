const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateBookingDetails, validateCheckoutSessionId } = require('../utils/validation');
const { sanitizeHtml } = require('../utils/sanitize');

test('accepts valid booking details and normalizes email', () => {
  const result = validateBookingDetails({
    firstName: '  Ada ',
    lastName: "O'Connor",
    email: '  ADA@EXAMPLE.COM ',
    phone: '+1 (555) 123-4567',
    message: 'I need support navigating a difficult transition.',
  });
  assert.equal(result.valid, true);
  assert.equal(result.values.email, 'ada@example.com');
  assert.equal(result.values.firstName, 'Ada');
});

test('rejects booking details missing required fields', () => {
  const result = validateBookingDetails({ firstName: '', lastName: '', email: '', message: '' });
  assert.equal(result.valid, false);
  for (const field of ['firstName', 'lastName', 'email', 'message']) {
    assert.ok(result.errors[field], `expected an error for ${field}`);
  }
});

test('rejects malformed email, script names, and short messages', () => {
  const result = validateBookingDetails({
    firstName: '<script>',
    lastName: 'Smith',
    email: 'not-an-email',
    phone: 'x',
    message: 'short',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.firstName);
  assert.ok(result.errors.email);
  assert.ok(result.errors.phone);
  assert.ok(result.errors.message);
});

test('validates Stripe checkout session IDs strictly', () => {
  assert.equal(validateCheckoutSessionId('cs_test_abc123').valid, true);
  assert.equal(validateCheckoutSessionId('cs_live_abc').valid, true);
  assert.equal(validateCheckoutSessionId('').valid, false);
  assert.equal(validateCheckoutSessionId('not-a-session').valid, false);
  assert.equal(validateCheckoutSessionId('cs_test_'.repeat(40)).valid, false);
});

test('sanitizeHtml strips scripts and event handlers', () => {
  const dirty = '<p onclick="alert(1)">Hello <script>alert(2)</script><img src=x onerror=alert(3)></p>';
  const clean = sanitizeHtml(dirty);
  assert.ok(!clean.includes('<script'));
  assert.ok(!clean.includes('onclick'));
  assert.ok(!clean.includes('onerror'));
  assert.ok(clean.includes('Hello'));
});

test('sanitizeHtml preserves safe embeds and drops unknown iframe sources', () => {
  const withEmbed = sanitizeHtml(
    '<iframe src="https://www.youtube.com/embed/abc123" allowfullscreen></iframe>' +
      '<iframe src="https://evil.example.com/x"></iframe>'
  );
  assert.ok(withEmbed.includes('youtube.com/embed/abc123'));
  assert.ok(!withEmbed.includes('evil.example.com'));
});
