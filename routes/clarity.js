const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const ClaritySession = require('../models/ClaritySession');
const { sendClaritySessionConfirmation } = require('../utils/email');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const SITE_URL = process.env.SITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
const SESSION_PRICE = 30000; // $300 in cents

// POST /api/clarity/create-checkout - Create Stripe Checkout session for clarity session
router.post('/create-checkout', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, message } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    // Create a pending session record
    const sessionData = {
      firstName,
      lastName,
      email,
      phone: phone || '',
      message: message || '',
      stripeSessionId: `pending_${Date.now()}`,
      stripePaymentStatus: 'pending',
      amount: SESSION_PRICE,
    };

    // Store temporarily in session (we'll update with actual Stripe ID after creation)
    const tempSession = new ClaritySession(sessionData);
    await tempSession.save();

    // Create Stripe checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'MacAdam Clarity Mapping Session',
              description: '60-minute strategic clarity mapping session',
            },
            unit_amount: SESSION_PRICE,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${SITE_URL.replace(/\/$/, '')}/clarity-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL.replace(/\/$/, '')}/clarity-session?canceled=true`,
      customer_email: email,
      metadata: {
        claritySessionId: String(tempSession._id),
      },
    });

    // Update the session with the actual Stripe session ID
    tempSession.stripeSessionId = stripeSession.id;
    await tempSession.save();

    res.json({ url: stripeSession.url });
  } catch (err) {
    console.error('Clarity session checkout error:', err);
    res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
});

// GET /api/clarity/sessions - List all paid clarity sessions (admin only)
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await ClaritySession.find({ stripePaymentStatus: 'paid' })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ sessions });
  } catch (err) {
    console.error('List clarity sessions error:', err);
    res.status(500).json({ error: err.message || 'Failed to list sessions' });
  }
});

// GET /api/clarity/verify - Verify payment completion, update DB, send email
router.get('/verify', async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || '').trim();
    if (!sessionId) return res.status(400).json({ error: 'session_id is required' });

    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = stripeSession?.payment_status === 'paid';

    let claritySession = await ClaritySession.findOne({ stripeSessionId: sessionId });

    if (paid && claritySession && claritySession.stripePaymentStatus !== 'paid') {
      claritySession.stripePaymentStatus = 'paid';
      await claritySession.save();

      sendClaritySessionConfirmation(claritySession).catch(err =>
        console.error('Failed to send clarity confirmation email:', err)
      );
    }

    res.json({ paid, session: claritySession });
  } catch (err) {
    console.error('Verify clarity session error:', err);
    res.status(400).json({ error: 'Unable to verify payment' });
  }
});

// GET /api/clarity/session/:id - Get specific session details
router.get('/session/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await ClaritySession.findById(id).lean();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (err) {
    console.error('Get clarity session error:', err);
    res.status(500).json({ error: err.message || 'Failed to get session' });
  }
});
module.exports = router;