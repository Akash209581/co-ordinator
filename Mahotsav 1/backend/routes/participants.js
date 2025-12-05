const express = require('express');
const Participant = require('../models/Participant');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all participants
router.get('/', auth, async (req, res) => {
  try {
    const participants = await Participant.find({}).sort({ name: 1 });
    res.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// Get participant by ID
router.get('/:participantId', auth, async (req, res) => {
  try {
    const participant = await Participant.findById(req.params.participantId);
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    res.json(participant);
  } catch (error) {
    console.error('Error fetching participant:', error);
    res.status(500).json({ error: 'Failed to fetch participant' });
  }
});

// Create new participant
router.post('/', auth, async (req, res) => {
  try {
    const { name, email, phone, college, course, year } = req.body;
    
    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Name, email, and phone are required' });
    }
    
    // Check if participant already exists
    const existingParticipant = await Participant.findOne({ email });
    if (existingParticipant) {
      return res.status(400).json({ error: 'Participant with this email already exists' });
    }
    
    const participant = new Participant({
      name,
      email,
      phone,
      college,
      course,
      year
    });
    
    await participant.save();
    
    res.status(201).json({
      message: 'Participant created successfully',
      participant
    });
    
  } catch (error) {
    console.error('Error creating participant:', error);
    res.status(500).json({ error: 'Failed to create participant' });
  }
});

module.exports = router;