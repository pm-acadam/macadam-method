const express = require('express');

const router = express.Router();

// Public inquiry forms are temporarily disabled. Keep the endpoint stable so clients receive a safe generic error.
router.post('/', (req, res) => {
  res.status(503).json({ error: 'Something went wrong. Please try again later.' });
});

module.exports = router;
