const express = require('express');
const { evaluate } = require('../services/submissionService');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();
const executionLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: 'You are running code very quickly. Please wait a moment before trying again.' });

// POST /api/run - sample tests only, nothing is stored
router.post('/run', executionLimiter, async (req, res) => {
  res.json(await evaluate(req.user.id, req.body, { mode: 'run' }));
});

// POST /api/submit - sample + hidden tests, analysed and stored
router.post('/submit', executionLimiter, async (req, res) => {
  res.status(201).json(await evaluate(req.user.id, req.body, { mode: 'submit' }));
});

module.exports = router;
