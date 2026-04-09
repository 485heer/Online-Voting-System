const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Voter = require('../models/Voter');
const { protect } = require('../middleware/auth');

// Helper: generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
};

// Helper: send token response
const sendToken = (user, statusCode, res) => {
  const token = generateToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      aadhaar: user.aadhaar,
      hasVoted: user.hasVoted,
      isVerified: user.isVerified,
      role: user.role
    }
  });
};

// @route  POST /api/auth/register
// @desc   Register new voter (step 1 — send OTP)
// @access Public
router.post('/register', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('aadhaar').notEmpty().withMessage('Voter ID / Aadhaar is required'),
  body('phone').notEmpty().withMessage('Phone number is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { name, email, password, aadhaar, phone } = req.body;

  try {
    // Check for duplicate email
    const existingEmail = await Voter.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'This email is already registered.' });
    }

    // Check for duplicate Aadhaar
    const existingAadhaar = await Voter.findOne({ aadhaar });
    if (existingAadhaar) {
      return res.status(400).json({ success: false, message: 'This Voter ID / Aadhaar is already registered.' });
    }

    // Create voter (unverified)
    const voter = await Voter.create({ name, email, password, aadhaar, phone, isVerified: false });

    // Generate OTP
    const otp = voter.generateOTP();
    await voter.save();

    // In production: send OTP via SMS/email
    // For demo: return OTP in response
    console.log(`📱 OTP for ${email}: ${otp}`);

    res.status(201).json({
      success: true,
      message: `OTP sent to ${phone}. Valid for 10 minutes.`,
      voterId: voter._id,
      // Remove in production — only for demo/development
      otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// @route  POST /api/auth/verify-otp
// @desc   Verify OTP and activate account
// @access Public
router.post('/verify-otp', async (req, res) => {
  const { voterId, otp } = req.body;

  if (!voterId || !otp) {
    return res.status(400).json({ success: false, message: 'Voter ID and OTP are required.' });
  }

  try {
    const voter = await Voter.findById(voterId).select('+password');
    if (!voter) {
      return res.status(404).json({ success: false, message: 'Voter not found.' });
    }

    if (voter.isVerified) {
      return res.status(400).json({ success: false, message: 'Account is already verified.' });
    }

    if (!voter.otp || voter.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    if (voter.otpExpiry < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please register again.' });
    }

    // Mark verified and clear OTP
    voter.isVerified = true;
    voter.otp = null;
    voter.otpExpiry = null;
    await voter.save();

    sendToken(voter, 200, res);

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error during OTP verification.' });
  }
});

// @route  POST /api/auth/login
// @desc   Voter login
// @access Public
router.post('/login', [
  body('email').isEmail().withMessage('Enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { email, password } = req.body;

  try {
    const voter = await Voter.findOne({ email }).select('+password');

    if (!voter) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await voter.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    sendToken(voter, 200, res);

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// @route  GET /api/auth/me
// @desc   Get current logged-in user
// @access Private
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;