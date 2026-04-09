const express = require('express');
const router = express.Router();
const Voter = require('../models/Voter');
const Vote = require('../models/Vote');
const { protect, adminOnly } = require('../middleware/auth');

// @route  GET /api/admin/voters
// @desc   Get all voters
// @access Admin
router.get('/voters', protect, adminOnly, async (req, res) => {
  try {
    const voters = await Voter.find({ role: 'voter' })
      .select('-password -otp -otpExpiry')
      .populate('votedFor', 'name party')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: voters.length, voters });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// @route  GET /api/admin/stats
// @desc   Get dashboard stats
// @access Admin
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const totalVoters = await Voter.countDocuments({ role: 'voter' });
    const votedCount = await Voter.countDocuments({ hasVoted: true });
    const verifiedCount = await Voter.countDocuments({ isVerified: true, role: 'voter' });
    const totalVotes = await Vote.countDocuments();

    res.json({
      success: true,
      stats: {
        totalVoters,
        votedCount,
        pendingCount: totalVoters - votedCount,
        verifiedCount,
        totalVotes,
        turnout: totalVoters > 0 ? ((votedCount / totalVoters) * 100).toFixed(1) : '0.0'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// @route  GET /api/admin/votes
// @desc   Get all votes (without revealing who voted for whom publicly)
// @access Admin
router.get('/votes', protect, adminOnly, async (req, res) => {
  try {
    const votes = await Vote.find()
      .populate('voter', 'name email')
      .populate('candidate', 'name party')
      .sort({ timestamp: -1 });

    res.json({ success: true, count: votes.length, votes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// @route  DELETE /api/admin/voters/:id
// @desc   Delete a voter account
// @access Admin
router.delete('/voters/:id', protect, adminOnly, async (req, res) => {
  try {
    const voter = await Voter.findById(req.params.id);
    if (!voter) return res.status(404).json({ success: false, message: 'Voter not found.' });
    if (voter.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot delete admin.' });
    await voter.deleteOne();
    res.json({ success: true, message: 'Voter account deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;