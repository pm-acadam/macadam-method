const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const RecalibrationSession = require('../models/RecalibrationSession');
const { sendRecalibrationConfirmation } = require('../utils/email');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const SITE_URL = process.env.SITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
const SESSION_PRICE = 50000; // $500 in cents

// POST /api/recalibration/create-checkout - Create Stripe Checkout session for deep clarity session
router.post('/create-checkout', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, message } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    // Create a pending session record first
    const tempSession = new RecalibrationSession({
      firstName,
      lastName,
      email,
      phone: phone || '',
      message: message || '',
      stripeSessionId: null,
      stripePaymentStatus: 'pending',
      amount: SESSION_PRICE,
    });
    await tempSession.save();

    // Create Stripe checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Clarity Session',
              description: '90-minute strategic clarity and deep dive session with Patricia',
            },
            unit_amount: SESSION_PRICE,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${SITE_URL.replace(/\/$/, '')}/recalibration-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL.replace(/\/$/, '')}/clarity-session-deep?canceled=true`,
      customer_email: email,
      metadata: {
        recalibrationSessionId: String(tempSession._id),
      },
    });

    // Update with Stripe session ID
    tempSession.stripeSessionId = stripeSession.id;
    await tempSession.save();

    res.json({ url: stripeSession.url });
  } catch (err) {
    console.error('Recalibration session checkout error:', err);
    res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
});

// GET /api/recalibration/verify - Verify payment completion
router.get('/verify', async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || '').trim();
    if (!sessionId) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    if (!sessionId.startsWith('cs_')) {
      return res.status(400).json({ error: 'Invalid session_id format' });
    }

    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    
    // Check session age - reject if older than 24 hours
    const sessionAge = Math.floor((Date.now() - stripeSession.created * 1000) / 1000 / 3600);
    if (sessionAge > 24) {
      return res.status(403).json({ 
        error: 'Session has expired (older than 24 hours)',
        paid: false 
      });
    }

    const paid = stripeSession?.payment_status === 'paid';
    let recalibrationSession = await RecalibrationSession.findOne({ stripeSessionId: sessionId });

    if (!recalibrationSession) {
      return res.status(404).json({ 
        error: 'Session record not found',
        paid: false 
      });
    }

    // Webhook handles both the update and email confirmation
    // This endpoint is just for client-side verification, no duplicate email

    res.json({ paid, session: recalibrationSession });
  } catch (err) {
    console.error('Verify recalibration session error:', err);
    const statusCode = err.type === 'StripeInvalidRequestError' ? 402 : 500;
    res.status(statusCode).json({ 
      error: 'Unable to verify payment',
      paid: false 
    });
  }
});

// GET /api/recalibration/session/:id - Get specific session details
router.get('/session/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await RecalibrationSession.findById(id).lean();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (err) {
    console.error('Get recalibration session error:', err);
    res.status(500).json({ error: err.message || 'Failed to get session' });
  }
});

module.exports = router;
