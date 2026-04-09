// Run: node seed.js
// Seeds demo voters, admin, and candidates into MongoDB

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const Voter = require('./models/Voter');
const Candidate = require('./models/Candidate');
const Vote = require('./models/Vote');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Voter.deleteMany({});
    await Candidate.deleteMany({});
    await Vote.deleteMany({});
    console.log('🗑  Cleared existing data');

    // Create admin
    const admin = await Voter.create({
      name: 'System Admin',
      email: 'admin@demo.com',
      password: 'admin123',
      aadhaar: 'ADMIN-0000-0000',
      phone: '+91 00000 00000',
      role: 'admin',
      isVerified: true
    });
    console.log('👤 Admin created:', admin.email);

    // Create sample voters
    const voters = await Voter.insertMany([
      {
        name: 'Rahul Sharma',
        email: 'voter1@demo.com',
        password: await bcrypt.hash('pass123', 12),
        aadhaar: '1234-5678-9012',
        phone: '+91 98765 11111',
        isVerified: true,
        hasVoted: false
      },
      {
        name: 'Priya Patel',
        email: 'voter2@demo.com',
        password: await bcrypt.hash('pass123', 12),
        aadhaar: '2345-6789-0123',
        phone: '+91 98765 22222',
        isVerified: true,
        hasVoted: false
      },
      {
        name: 'Amit Kumar',
        email: 'voter3@demo.com',
        password: await bcrypt.hash('pass123', 12),
        aadhaar: '3456-7890-1234',
        phone: '+91 98765 33333',
        isVerified: true,
        hasVoted: false
      }
    ]);
    console.log(`👥 ${voters.length} voters created`);

    // Create candidates
    const candidates = await Candidate.insertMany([
      { name: 'Arun Kumar', party: 'National Progressive Party', symbol: '🌿', bio: 'Focused on economic development and infrastructure.', votes: 0 },
      { name: 'Sneha Reddy', party: "United People's Front", symbol: '⭐', bio: 'Champion of education and healthcare reform.', votes: 0 },
      { name: 'Vikram Mehta', party: 'Democratic Alliance', symbol: '🔵', bio: 'Technology and innovation for a better tomorrow.', votes: 0 },
      { name: 'Lakshmi Nair', party: 'Green Future Party', symbol: '🌱', bio: 'Environmental protection and sustainable growth.', votes: 0 }
    ]);
    console.log(`🏛  ${candidates.length} candidates created`);

    console.log('\n✅ Database seeded successfully!\n');
    console.log('Demo login credentials:');
    console.log('  Admin:   admin@demo.com  / admin123');
    console.log('  Voter 1: voter1@demo.com / pass123');
    console.log('  Voter 2: voter2@demo.com / pass123');
    console.log('  Voter 3: voter3@demo.com / pass123\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  }
};

seed();