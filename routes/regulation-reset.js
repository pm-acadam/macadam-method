const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const https = require('https');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const SITE_URL = process.env.SITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
const PRICE = 4700; // $47 in cents
const PDF_URL = process.env.REGULATION_RESET_PDF_URL || 'https://pub-66a3335a61d046f1bdf3f81c9e8d8bf0.r2.dev/course-pdfs/1772220522172-f7kjiag0ao5.pdf';
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;

// POST /api/regulation-reset/create-checkout
router.post('/create-checkout', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Regulation Reset™',
              description: 'Guided nervous system reset — video session + PDF framework. Lifetime access.',
            },
            unit_amount: PRICE,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${SITE_URL.replace(/\/$/, '')}/regulation-reset-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL.replace(/\/$/, '')}/regulation-reset?canceled=true`,
      metadata: {
        product: 'regulation-reset',
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Regulation reset checkout error:', err);
    res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
});

// GET /api/regulation-reset/verify?session_id=...
router.get('/verify', async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || '').trim();
    if (!sessionId) {
      return res.status(400).json({ error: 'session_id is required', paid: false });
    }

    // Validate session ID format (Stripe sessions start with cs_)
    if (!sessionId.startsWith('cs_')) {
      return res.status(400).json({ error: 'Invalid session_id format', paid: false });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    // Check session age - reject if older than 24 hours
    const sessionAge = Math.floor((Date.now() - session.created * 1000) / 1000 / 3600);
    if (sessionAge > 24) {
      return res.status(403).json({ 
        error: 'Session has expired (older than 24 hours)',
        paid: false 
      });
    }

    const paid = session?.payment_status === 'paid';

    res.json({
      paid,
      session: {
        name: session.customer_details?.name || null,
        email: session.customer_details?.email || session.customer_email || null,
        amount: session.amount_total,
      },
    });
  } catch (err) {
    console.error('Regulation reset verify error:', err);
    // Return 402 for payment-related issues, 500 for server errors
    const statusCode = err.type === 'StripeInvalidRequestError' ? 402 : 500;
    res.status(statusCode).json({ 
      error: 'Unable to verify payment',
      paid: false 
    });
  }
});

function downloadToBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        resp.resume();
        return resolve(downloadToBuffer(resp.headers.location));
      }
      if (resp.statusCode !== 200) {
        resp.resume();
        return reject(new Error('Failed to download PDF'));
      }
      const chunks = [];
      let total = 0;
      resp.on('data', (chunk) => {
        total += chunk.length;
        if (total > MAX_DOWNLOAD_BYTES) return reject(new Error('PDF too large'));
        chunks.push(chunk);
      });
      resp.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

// GET /api/regulation-reset/download?session_id=...
router.get('/download', async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || '').trim();
    if (!sessionId) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    // Validate PDF URL is configured
    if (!PDF_URL) {
      console.error('REGULATION_RESET_PDF_URL not configured');
      return res.status(500).json({ error: 'PDF not available' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed' });
    }

    if (session.metadata?.product !== 'regulation-reset') {
      return res.status(400).json({ error: 'Invalid session' });
    }

    // Check session age - can't download if older than 30 days
    const sessionAge = Math.floor((Date.now() - session.created * 1000) / 1000 / 86400);
    if (sessionAge > 30) {
      return res.status(403).json({ error: 'Download link has expired' });
    }

    const pdfBuffer = await downloadToBuffer(PDF_URL);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Regulation-Reset.pdf"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Regulation reset download error:', err);
    // Distinguish between different types of errors
    const statusCode = err.message?.includes('too large') ? 413 : 500;
    res.status(statusCode).json({ error: err.message || 'Download failed' });
  }
});

module.exports = router;
