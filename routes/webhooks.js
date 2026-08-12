const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const ClaritySession = require('../models/ClaritySession');
const RecalibrationSession = require('../models/RecalibrationSession');
const { sendRegulationResetConfirmation } = require('../utils/email');

const router = express.Router();

// Stripe webhook secret from environment
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Raw body parser middleware for webhook verification
router.post('/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    if (!WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Legacy booking sessions: only sync the payment status; confirmation emails are
      // sent by the complete-booking endpoints once the buyer submits their details.
      if (session.metadata?.claritySessionId) {
        try {
          await ClaritySession.findByIdAndUpdate(session.metadata.claritySessionId, {
            stripeSessionId: session.id,
            stripePaymentStatus: 'paid',
            amount: session.amount_total,
          });
        } catch (err) {
          console.error('Error updating legacy clarity session from webhook:', err);
        }
      }

      if (session.metadata?.recalibrationSessionId) {
        try {
          await RecalibrationSession.findByIdAndUpdate(session.metadata.recalibrationSessionId, {
            stripeSessionId: session.id,
            stripePaymentStatus: 'paid',
            amount: session.amount_total,
          });
        } catch (err) {
          console.error('Error updating legacy recalibration session from webhook:', err);
        }
      }

      // Handle regulation reset course purchase
      if (session.metadata?.product === 'regulation-reset') {
        try {
          const email = session.customer_details?.email || session.customer_email;
          const name = session.customer_details?.name || 'Customer';
          
          if (email) {
            sendRegulationResetConfirmation({
              email,
              name,
              amount: session.amount_total,
              createdAt: new Date(session.created * 1000),
              sessionId: session.id,
            }).catch(err =>
              console.error('Failed to send regulation reset confirmation email:', err)
            );
          }
        } catch (err) {
          console.error('Error handling regulation reset webhook:', err);
        }
      }
    }

    // Handle payment_intent.payment_failed for error handling
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      console.error('Payment failed:', paymentIntent.id, paymentIntent.last_payment_error?.message);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

module.exports = router;
