const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, '') || '';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// PDFs for course materials
const ALLOWED_PDF_TYPES = ['application/pdf'];
const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB

function getExt(mimetype) {
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
  return map[mimetype] || 'jpg';
}

function uploadToFolder(folder) {
  return async (buffer, mimetype) => {
    if (!ALLOWED_TYPES.includes(mimetype)) {
      throw new Error('Invalid file type. Use JPEG, PNG, GIF, or WebP.');
    }
    if (buffer.length > MAX_SIZE) {
      throw new Error('File too large. Max 5MB.');
    }
    const ext = getExt(mimetype);
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      })
    );
    return `${PUBLIC_URL}/${key}`;
  };
}

function uploadPdfToFolder(folder) {
  return async (buffer, mimetype) => {
    if (!ALLOWED_PDF_TYPES.includes(mimetype)) {
      throw new Error('Invalid file type. Only PDF is allowed.');
    }
    if (buffer.length > MAX_PDF_SIZE) {
      throw new Error('File too large. Max 20MB.');
    }
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      })
    );
    return `${PUBLIC_URL}/${key}`;
  };
}

const uploadThumbnail = uploadToFolder('thumbnails');
const uploadTestimonialImage = uploadToFolder('testimonials');
const uploadCoursePdf = uploadPdfToFolder('course-pdfs');

module.exports = {
  uploadThumbnail,
  uploadTestimonialImage,
  uploadCoursePdf,
  ALLOWED_TYPES,
  MAX_SIZE,
  ALLOWED_PDF_TYPES,
  MAX_PDF_SIZE,
};
