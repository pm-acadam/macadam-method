const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'The MacAdam Company <patriciamacadam@themacadamco.com>';
const PATRICIA_EMAIL = 'patriciamacadam@themacadamco.com';

async function sendClaritySessionConfirmation(session) {
  const { firstName, lastName, email, phone, message, amount, createdAt } = session;

  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const receiptHtml = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333;">
        <h1 style="font-size: 28px; margin: 0 0 10px 0; font-family: 'Times New Roman', serif;">The MacAdam Company</h1>
        <p style="margin: 0; color: #666; font-size: 14px;">Payment Receipt</p>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 0 0 8px 0;">Transaction Details</h3>
        <p style="margin: 4px 0; font-size: 14px;">
          <span style="color: #666;">Date:</span> ${formattedDate}
        </p>
        <p style="margin: 4px 0; font-size: 14px;">
          <span style="color: #666;">Session Type:</span> MacAdam Clarity Mapping Session
        </p>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 0 0 8px 0;">Customer Information</h3>
        <p style="margin: 4px 0; font-size: 14px;">
          <span style="color: #666;">Name:</span> ${firstName} ${lastName}
        </p>
        <p style="margin: 4px 0; font-size: 14px;">
          <span style="color: #666;">Email:</span> ${email}
        </p>
        ${phone ? `<p style="margin: 4px 0; font-size: 14px;"><span style="color: #666;">Phone:</span> ${phone}</p>` : ''}
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 0 0 8px 0;">Session Details</h3>
        ${message ? `<p style="margin: 4px 0; font-size: 14px;"><span style="color: #666;">Message:</span> ${message}</p>` : ''}
      </div>

      <div style="text-align: center; padding: 20px; background: #f9f9f9; border-radius: 8px; margin: 30px 0;">
        <p style="color: #666; font-size: 14px; margin: 0 0 5px 0;">Total Paid</p>
        <p style="font-size: 24px; font-weight: bold; margin: 0;">$${(amount / 100).toFixed(2)}</p>
      </div>

      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
        <p>Thank you for booking your Clarity Mapping Session!</p>
        <p>We look forward to helping you gain strategic clarity.</p>
      </div>
    </div>
  `;

  // Notification email for Patricia
  const adminHtml = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333;">
        <h1 style="font-size: 28px; margin: 0 0 10px 0; font-family: 'Times New Roman', serif;">New Clarity Session Booking</h1>
        <p style="margin: 0; color: #666; font-size: 14px;">A new clarity mapping session has been booked and paid.</p>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 0 0 8px 0;">Customer</h3>
        <p style="margin: 4px 0; font-size: 14px;"><strong>${firstName} ${lastName}</strong></p>
        <p style="margin: 4px 0; font-size: 14px;">Email: <a href="mailto:${email}">${email}</a></p>
        ${phone ? `<p style="margin: 4px 0; font-size: 14px;">Phone: ${phone}</p>` : ''}
      </div>

      ${message ? `
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 0 0 8px 0;">Their Message</h3>
        <p style="margin: 4px 0; font-size: 14px; background: #f9f9f9; padding: 12px; border-radius: 6px;">${message}</p>
      </div>
      ` : ''}

      <div style="text-align: center; padding: 16px; background: #000; border-radius: 8px; margin: 20px 0;">
        <p style="color: #fff; font-size: 18px; font-weight: bold; margin: 0;">$${(amount / 100).toFixed(2)} paid</p>
        <p style="color: #aaa; font-size: 12px; margin: 4px 0 0 0;">${formattedDate}</p>
      </div>
    </div>
  `;

  try {
    // Send receipt to customer
    const customerResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Confirmation: MacAdam Clarity Mapping Session',
      html: receiptHtml,
    });

    if (customerResult.error) {
      console.error('Error sending customer email:', customerResult.error);
    } else {
      console.log('Customer email sent:', customerResult.data.id);
    }

    // Send notification to Patricia
    const adminResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: PATRICIA_EMAIL,
      subject: `New Booking: ${firstName} ${lastName} — Clarity Session ($${(amount / 100).toFixed(2)})`,
      html: adminHtml,
    });

    if (adminResult.error) {
      console.error('Error sending admin notification:', adminResult.error);
    } else {
      console.log('Admin notification sent:', adminResult.data.id);
    }

    return { success: !customerResult.error, messageId: customerResult.data?.id };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

async function sendRegulationResetConfirmation({ email, name, amount, createdAt, sessionId }) {
  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const receiptHtml = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333;">
        <h1 style="font-size: 28px; margin: 0 0 10px 0; font-family: 'Times New Roman', serif;">The MacAdam Company</h1>
        <p style="margin: 0; color: #666; font-size: 14px;">Payment Receipt</p>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 0 0 8px 0;">Transaction Details</h3>
        <p style="margin: 4px 0; font-size: 14px;">
          <span style="color: #666;">Date:</span> ${formattedDate}
        </p>
        <p style="margin: 4px 0; font-size: 14px;">
          <span style="color: #666;">Product:</span> Regulation Reset™
        </p>
        <p style="margin: 4px 0; font-size: 14px;">
          <span style="color: #666;">Transaction ID:</span> ${sessionId}
        </p>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 0 0 8px 0;">Customer Information</h3>
        <p style="margin: 4px 0; font-size: 14px;">
          <span style="color: #666;">Name:</span> ${name}
        </p>
        <p style="margin: 4px 0; font-size: 14px;">
          <span style="color: #666;">Email:</span> ${email}
        </p>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 0 0 8px 0;">What's Included</h3>
        <p style="margin: 4px 0; font-size: 14px;">• Guided regulation session (~45 min video)</p>
        <p style="margin: 4px 0; font-size: 14px;">• Practical framework you can reuse</p>
        <p style="margin: 4px 0; font-size: 14px;">• Repeatable reset tool</p>
        <p style="margin: 4px 0; font-size: 14px;">• Downloadable PDF reference guide</p>
      </div>

      <div style="text-align: center; padding: 20px; background: #f9f9f9; border-radius: 8px; margin: 30px 0;">
        <p style="color: #666; font-size: 14px; margin: 0 0 5px 0;">Total Paid</p>
        <p style="font-size: 24px; font-weight: bold; margin: 0;">$${(amount / 100).toFixed(2)}</p>
      </div>

      <div style="text-align: center; padding: 16px; background: #333; border-radius: 8px; margin: 20px 0;">
        <p style="color: #fff; font-size: 14px; margin: 0;">Your PDF has been included with your download. If you need to re-download, contact us.</p>
      </div>

      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
        <p>Thank you for purchasing Regulation Reset™!</p>
        <p>You now have lifetime access to this resource.</p>
      </div>
    </div>
  `;

  // Notification email for Patricia
  const adminHtml = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333;">
        <h1 style="font-size: 28px; margin: 0 0 10px 0; font-family: 'Times New Roman', serif;">New Regulation Reset™ Purchase</h1>
        <p style="margin: 0; color: #666; font-size: 14px;">Someone just purchased Regulation Reset™.</p>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 0 0 8px 0;">Customer</h3>
        <p style="margin: 4px 0; font-size: 14px;"><strong>${name}</strong></p>
        <p style="margin: 4px 0; font-size: 14px;">Email: <a href="mailto:${email}">${email}</a></p>
      </div>

      <div style="text-align: center; padding: 16px; background: #000; border-radius: 8px; margin: 20px 0;">
        <p style="color: #fff; font-size: 18px; font-weight: bold; margin: 0;">$${(amount / 100).toFixed(2)} paid</p>
        <p style="color: #aaa; font-size: 12px; margin: 4px 0 0 0;">${formattedDate} · Transaction: ${sessionId}</p>
      </div>
    </div>
  `;

  try {
    // Send receipt to customer
    const customerResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Receipt: Regulation Reset™ — The MacAdam Company',
      html: receiptHtml,
    });

    if (customerResult.error) {
      console.error('Error sending customer email:', customerResult.error);
    } else {
      console.log('Customer email sent:', customerResult.data.id);
    }

    // Send notification to Patricia
    const adminResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: PATRICIA_EMAIL,
      subject: `New Purchase: ${name} — Regulation Reset™ ($${(amount / 100).toFixed(2)})`,
      html: adminHtml,
    });

    if (adminResult.error) {
      console.error('Error sending admin notification:', adminResult.error);
    } else {
      console.log('Admin notification sent:', adminResult.data.id);
    }

    return { success: !customerResult.error, messageId: customerResult.data?.id };
  } catch (error) {
    console.error('Error sending regulation reset email:', error);
    return { success: false, error: error.message };
  }
}

const SOURCE_LABELS = {
  'contact': 'Contact Form',
  'private-work': 'Private Session Request',
  'for-law-firms': 'Law Firm / Organization Inquiry',
};

async function sendInquiryNotification({ source, name, email, message }) {
  const label = SOURCE_LABELS[source] || 'Website Inquiry';
  const now = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const adminHtml = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333;">
        <h1 style="font-size: 28px; margin: 0 0 10px 0; font-family: 'Times New Roman', serif;">New Inquiry</h1>
        <p style="margin: 0; color: #666; font-size: 14px;">${label}</p>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 0 0 8px 0;">From</h3>
        <p style="margin: 4px 0; font-size: 14px;"><strong>${name}</strong></p>
        <p style="margin: 4px 0; font-size: 14px;">Email: <a href="mailto:${email}">${email}</a></p>
        <p style="margin: 4px 0; font-size: 14px; color: #666;">Received: ${now}</p>
      </div>

      ${message ? `
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 0 0 8px 0;">Message</h3>
        <div style="font-size: 14px; background: #f9f9f9; padding: 16px; border-radius: 6px; white-space: pre-wrap;">${message}</div>
      </div>
      ` : ''}

      <div style="text-align: center; margin-top: 30px;">
        <a href="mailto:${email}" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; font-size: 14px; border-radius: 4px;">Reply to ${name}</a>
      </div>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: PATRICIA_EMAIL,
      subject: `New ${label}: ${name}`,
      html: adminHtml,
    });

    if (error) {
      console.error('Error sending inquiry notification:', error);
      return { success: false, error: error.message };
    }

    console.log('Inquiry notification sent:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending inquiry notification:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendClaritySessionConfirmation,
  sendRegulationResetConfirmation,
  sendInquiryNotification,
};
