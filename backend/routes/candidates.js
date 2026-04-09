const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Candidate = require('../models/Candidate');
const { protect, adminOnly } = require('../middleware/auth');

// @route  GET /api/candidates
// @desc   Get all active candidates
// @access Public
router.get('/', async (req, res) => {
  try {
    const candidates = await Candidate.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, count: candidates.length, candidates });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// @route  GET /api/candidates/all
// @desc   Get all candidates (admin, includes inactive)
// @access Admin
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ createdAt: -1 });
    res.json({ success: true, count: candidates.length, candidates });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// @route  POST /api/candidates
// @desc   Add a new candidate
// @access Admin
router.post('/', protect, adminOnly, [
  body('name').trim().notEmpty().withMessage('Candidate name is required'),
  body('party').trim().notEmpty().withMessage('Party name is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { name, party, symbol, bio } = req.body;

  try {
    const candidate = await Candidate.create({
      name, party,
      symbol: symbol || '🗳️',
      bio: bio || '',
      addedBy: req.user._id
    });

    res.status(201).json({ success: true, message: 'Candidate added successfully.', candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// @route  PUT /api/candidates/:id
// @desc   Update candidate
// @access Admin
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const candidate = await Candidate.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true
    });
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found.' });
    res.json({ success: true, message: 'Candidate updated.', candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// @route  DELETE /api/candidates/:id
// @desc   Deactivate (soft delete) a candidate
// @access Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const candidate = await Candidate.findByIdAndUpdate(
      req.params.id, { isActive: false }, { new: true }
    );
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found.' });
    res.json({ success: true, message: 'Candidate removed from election.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;