const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const RecalibrationSession = require('../models/RecalibrationSession');
const { sendRecalibrationConfirmation } = require('../utils/email');
const { validateBookingDetails, validateCheckoutSessionId } = require('../utils/validation');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const SITE_URL = process.env.SITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
const PRIVATE_SESSION_PRICE = 50000;
const PRIVATE_SESSION_PRODUCT = 'private-work';
const MAX_SESSION_AGE_SECONDS = 30 * 24 * 60 * 60;

async function getPaidPrivateSession(sessionId) {
  const checkedId = validateCheckoutSessionId(sessionId);
  if (!checkedId.valid) {
    const error = new Error(checkedId.error);
    error.statusCode = 400;
    throw error;
  }

  const session = await stripe.checkout.sessions.retrieve(checkedId.sessionId);
  const age = Math.floor(Date.now() / 1000) - session.created;

  if (age > MAX_SESSION_AGE_SECONDS) {
    const error = new Error('Payment session has expired.');
    error.statusCode = 403;
    throw error;
  }

  if (
    session.payment_status !== 'paid' ||
    session.metadata?.product !== PRIVATE_SESSION_PRODUCT ||
    session.amount_total !== PRIVATE_SESSION_PRICE ||
    session.currency !== 'usd'
  ) {
    const error = new Error('Payment could not be verified.');
    error.statusCode = 402;
    throw error;
  }

  return session;
}

function formatBooking(booking) {
  return {
    firstName: booking.firstName,
    lastName: booking.lastName,
    email: booking.email,
    phone: booking.phone || '',
    message: booking.message || '',
    amount: booking.amount,
    createdAt: booking.createdAt,
  };
}

// POST /api/private-work/create-checkout - Payment must happen before details are collected
router.post('/create-checkout', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Private Regulation Session',
              description: 'A tailored 60–90 minute strategic nervous system regulation session',
            },
            unit_amount: PRIVATE_SESSION_PRICE,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${SITE_URL.replace(/\/$/, '')}/private-work-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL.replace(/\/$/, '')}/private-work?canceled=true`,
      metadata: {
        product: PRIVATE_SESSION_PRODUCT,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Private work checkout error:', err);
    res.status(500).json({ error: 'Unable to start checkout.' });
  }
});

// GET /api/private-work/verify - Verify payment before displaying the details form
router.get('/verify', async (req, res) => {
  try {
    await getPaidPrivateSession(req.query.session_id);
    res.json({ paid: true });
  } catch (err) {
    console.error('Verify private work payment error:', err);
    const statusCode = err.statusCode || (err.type === 'StripeInvalidRequestError' ? 402 : 500);
    res.status(statusCode).json({ error: 'Unable to verify payment.', paid: false });
  }
});

// POST /api/private-work/complete-booking - Save details only for a verified paid session
router.post('/complete-booking', async (req, res) => {
  try {
    const validation = validateBookingDetails(req.body);
    if (!validation.valid) {
      return res.status(422).json({
        error: 'Please correct the highlighted fields.',
        fields: validation.errors,
      });
    }

    const stripeSession = await getPaidPrivateSession(req.body.session_id);
    const existing = await RecalibrationSession.findOne({ stripeSessionId: stripeSession.id });
    if (existing) {
      return res.json({ success: true, alreadyCompleted: true, booking: formatBooking(existing) });
    }

    const booking = await RecalibrationSession.create({
      ...validation.values,
      sessionType: 'private-work',
      stripeSessionId: stripeSession.id,
      stripePaymentStatus: 'paid',
      amount: stripeSession.amount_total,
    });

    sendRecalibrationConfirmation(booking).catch((err) =>
      console.error('Failed to send private work confirmation email:', err)
    );

    res.status(201).json({ success: true, booking: formatBooking(booking) });
  } catch (err) {
    if (err?.code === 11000) {
      const existing = await RecalibrationSession.findOne({ stripeSessionId: req.body.session_id });
      if (existing) {
        return res.json({ success: true, alreadyCompleted: true, booking: formatBooking(existing) });
      }
    }
    console.error('Complete private work booking error:', err);
    const statusCode = err.statusCode || (err.type === 'StripeInvalidRequestError' ? 402 : 500);
    res.status(statusCode).json({ error: statusCode >= 500 ? 'Unable to complete booking.' : err.message });
  }
});

module.exports = router;
