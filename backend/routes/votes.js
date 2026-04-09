const express = require('express');
const router = express.Router();
const Vote = require('../models/Vote');
const Voter = require('../models/Voter');
const Candidate = require('../models/Candidate');
const { protect, mustBeVerified } = require('../middleware/auth');

// @route  POST /api/votes/cast
// @desc   Cast a vote
// @access Private + Verified
router.post('/cast', protect, mustBeVerified, async (req, res) => {
  const { candidateId } = req.body;

  if (!candidateId) {
    return res.status(400).json({ success: false, message: 'Candidate ID is required.' });
  }

  try {
    // Re-check hasVoted from DB (not just token) for maximum security
    const voter = await Voter.findById(req.user._id);
    if (voter.hasVoted) {
      return res.status(403).json({
        success: false,
        message: 'You have already cast your vote. Each voter can only vote once.'
      });
    }

    // Verify candidate exists and is active
    const candidate = await Candidate.findById(candidateId);
    if (!candidate || !candidate.isActive) {
      return res.status(404).json({ success: false, message: 'Candidate not found or inactive.' });
    }

    // Record vote — unique constraint on voter will prevent duplicates at DB level too
    await Vote.create({
      voter: voter._id,
      candidate: candidateId,
      ipAddress: req.ip
    });

    // Increment candidate vote count atomically
    await Candidate.findByIdAndUpdate(candidateId, { $inc: { votes: 1 } });

    // Mark voter as voted
    await Voter.findByIdAndUpdate(voter._id, { hasVoted: true, votedFor: candidateId });

    res.json({
      success: true,
      message: `Your vote for ${candidate.name} has been recorded successfully.`
    });

  } catch (error) {
    // Handle duplicate key error (double vote at DB level)
    if (error.code === 11000) {
      return res.status(403).json({ success: false, message: 'Duplicate vote detected and blocked.' });
    }
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error while casting vote.' });
  }
});

// @route  GET /api/votes/results
// @desc   Get election results
// @access Public
router.get('/results', async (req, res) => {
  try {
    const candidates = await Candidate.find({ isActive: true }).sort({ votes: -1 });
    const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
    const totalVoters = await Voter.countDocuments({ role: 'voter' });
    const votedCount = await Voter.countDocuments({ hasVoted: true });

    const results = candidates.map((c, index) => ({
      rank: index + 1,
      id: c._id,
      name: c.name,
      party: c.party,
      symbol: c.symbol,
      bio: c.bio,
      votes: c.votes,
      percentage: totalVotes > 0 ? ((c.votes / totalVotes) * 100).toFixed(1) : '0.0'
    }));

    res.json({
      success: true,
      results,
      stats: {
        totalVotes,
        totalVoters,
        votedCount,
        turnout: totalVoters > 0 ? ((votedCount / totalVoters) * 100).toFixed(1) : '0.0',
        winner: results[0] || null
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error fetching results.' });
  }
});

module.exports = router;