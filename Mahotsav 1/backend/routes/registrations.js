const express = require('express');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const Participant = require('../models/Participant');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all participants
router.get('/participants', auth, async (req, res) => {
  try {
    const participants = await Participant.find({}).sort({ name: 1 });
    res.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// Get registrations for a specific participant
router.get('/participant/:participantId', auth, async (req, res) => {
  try {
    const { participantId } = req.params;
    
    const registrations = await Registration.find({ participantId })
      .populate('eventId', 'name category type date venue registrationFee')
      .sort({ registrationDate: -1 });
    
    res.json(registrations);
  } catch (error) {
    console.error('Error fetching participant registrations:', error);
    res.status(500).json({ error: 'Failed to fetch participant registrations' });
  }
});

// Register participant for an event
router.post('/', auth, async (req, res) => {
  try {
    const { participantId, eventId } = req.body;
    
    if (!participantId || !eventId) {
      return res.status(400).json({ error: 'Participant ID and Event ID are required' });
    }
    
    // Check if participant exists
    const participant = await Participant.findById(participantId);
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    
    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Check if already registered
    const existingRegistration = await Registration.findOne({ 
      participantId, 
      eventId 
    });
    
    if (existingRegistration) {
      return res.status(400).json({ error: 'Participant is already registered for this event' });
    }
    
    // Create new registration
    const registration = new Registration({
      participantId,
      eventId,
      paymentStatus: 'pending',
      registrationDate: new Date()
    });
    
    await registration.save();
    
    // Populate the registration data for response
    const populatedRegistration = await Registration.findById(registration._id)
      .populate('eventId', 'name category type date venue registrationFee')
      .populate('participantId', 'name email phone');
    
    res.status(201).json({
      message: 'Participant registered successfully',
      registration: populatedRegistration
    });
    
  } catch (error) {
    console.error('Error registering participant:', error);
    res.status(500).json({ error: 'Failed to register participant' });
  }
});

// Update registration payment status
router.patch('/:registrationId/payment', auth, async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { paymentStatus, paymentId } = req.body;
    
    if (!paymentStatus) {
      return res.status(400).json({ error: 'Payment status is required' });
    }
    
    const registration = await Registration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    
    registration.paymentStatus = paymentStatus;
    if (paymentId) {
      registration.paymentId = paymentId;
    }
    
    await registration.save();
    
    const populatedRegistration = await Registration.findById(registration._id)
      .populate('eventId', 'name category type date venue registrationFee')
      .populate('participantId', 'name email phone');
    
    res.json({
      message: 'Payment status updated successfully',
      registration: populatedRegistration
    });
    
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

// Get all registrations for an event
router.get('/event/:eventId', auth, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const registrations = await Registration.find({ eventId })
      .populate('participantId', 'name email phone')
      .sort({ registrationDate: -1 });
    
    res.json(registrations);
  } catch (error) {
    console.error('Error fetching event registrations:', error);
    res.status(500).json({ error: 'Failed to fetch event registrations' });
  }
});

// Delete registration
router.delete('/:registrationId', auth, async (req, res) => {
  try {
    const { registrationId } = req.params;
    
    const registration = await Registration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    
    await Registration.findByIdAndDelete(registrationId);
    
    res.json({ message: 'Registration deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting registration:', error);
    res.status(500).json({ error: 'Failed to delete registration' });
  }
});

module.exports = router;