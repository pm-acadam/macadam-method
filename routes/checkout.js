const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Course = require('../models/Course');
const https = require('https');
const http = require('http');

const router = express.Router();

const SITE_URL = process.env.SITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024; // 25MB safety cap

// POST /api/checkout/create-session - Create Stripe Checkout session for a course
router.post('/create-session', async (req, res) => {
  try {
    const { courseSlug } = req.body;

    if (!courseSlug || typeof courseSlug !== 'string') {
      return res.status(400).json({ error: 'Course slug is required' });
    }

    const course = await Course.findOne({
      slug: courseSlug.trim(),
      status: 'published',
    }).lean();

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const price = typeof course.price === 'number' ? course.price : 0;
    if (price <= 0) {
      return res.status(400).json({ error: 'This course is not available for purchase' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: course.title,
              description: course.description || 'PDF course',
              images: course.thumbnail ? [course.thumbnail] : undefined,
            },
            unit_amount: Math.round(price * 100), // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${SITE_URL.replace(/\/$/, '')}/courses/${course.slug}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL.replace(/\/$/, '')}/courses/${course.slug}?canceled=true`,
      metadata: {
        courseSlug: course.slug,
        courseId: String(course._id),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err);
    res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
});

function downloadToBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https://') ? https : http;
    const req = lib.get(url, (resp) => {
      if (resp.statusCode && resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
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
        if (total > MAX_DOWNLOAD_BYTES) {
          req.destroy();
          return reject(new Error('PDF too large to download'));
        }
        chunks.push(chunk);
      });
      resp.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
  });
}

// GET /api/checkout/verify?session_id=... - Verify Stripe payment actually completed
router.get('/verify', async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || '').trim();
    if (!sessionId) return res.status(400).json({ error: 'session_id is required' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session?.payment_status === 'paid';
    const courseSlug = session?.metadata?.courseSlug || '';

    res.json({ paid, courseSlug });
  } catch (err) {
    console.error('Verify checkout session error:', err);
    res.status(400).json({ error: 'Unable to verify payment' });
  }
});

// GET /api/checkout/payments - List all successful payments (admin only)
router.get('/payments', async (req, res) => {
  try {
    // List all checkout sessions with payment status = 'paid'
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
      status: 'complete',
    });

    const payments = sessions.data.filter(s => s.payment_status === 'paid').map(session => ({
      id: session.id,
      amount_total: session.amount_total,
      currency: session.currency,
      payment_status: session.payment_status,
      created: session.created,
      customer_email: session.customer_email,
      customer_details: session.customer_details,
      metadata: session.metadata,
      courseSlug: session.metadata?.courseSlug,
      courseId: session.metadata?.courseId,
    }));

    res.json({ payments });
  } catch (err) {
    console.error('List payments error:', err);
    res.status(500).json({ error: err.message || 'Failed to list payments' });
  }
});

// GET /api/checkout/receipt/:sessionId - Get receipt details for a specific payment
router.get('/receipt/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Get the course details if available
    let courseTitle = 'Course';
    if (session.metadata?.courseSlug) {
      const course = await Course.findOne({ slug: session.metadata.courseSlug }).lean();
      if (course) {
        courseTitle = course.title;
      }
    }

    const receipt = {
      id: session.id,
      amount_total: session.amount_total,
      currency: session.currency,
      payment_status: session.payment_status,
      created: session.created,
      customer_email: session.customer_email,
      customer_details: session.customer_details,
      metadata: session.metadata,
      courseTitle,
      payment_method_details: session.payment_method_details,
    };

    res.json(receipt);
  } catch (err) {
    console.error('Get receipt error:', err);
    res.status(500).json({ error: err.message || 'Failed to get receipt' });
  }
});

// GET /api/checkout/download?session_id=... - Verify payment then download PDF (attachment)
router.get('/download', async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || '').trim();
    if (!sessionId) return res.status(400).json({ error: 'session_id is required' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed' });
    }

    const courseSlug = session?.metadata?.courseSlug;
    if (!courseSlug) return res.status(400).json({ error: 'Invalid session metadata' });

    const course = await Course.findOne({ slug: courseSlug, status: 'published' }).lean();
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (!course.pdfUrl) return res.status(400).json({ error: 'Course PDF not available' });

    const pdfBuffer = await downloadToBuffer(course.pdfUrl);

    const safeName = String(course.slug || 'course').replace(/[^a-z0-9_-]/gi, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Download course PDF error:', err);
    res.status(400).json({ error: err.message || 'Download failed' });
  }
});

module.exports = router;
