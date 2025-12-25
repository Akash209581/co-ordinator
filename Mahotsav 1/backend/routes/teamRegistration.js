const express = require('express');
const TeamRegistration = require('../models/TeamRegistration');
const Event = require('../models/Event');
const Participant = require('../models/Participant');
const Registration = require('../models/Registration');
const auth = require('../middleware/auth');
const router = express.Router();

// In-memory cache for payment status (vector search optimization)
const paymentStatusCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clear expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of paymentStatusCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      paymentStatusCache.delete(key);
    }
  }
}, 60 * 1000); // Run every minute

// Create a new team for an event
router.post('/create-team', auth, async (req, res) => {
  try {
    console.log('Create team request received:', {
      body: JSON.stringify(req.body, null, 2),
      user: req.user?._id
    });
    
    const { teamName, eventId, eventName, teamLeaderData, teamMembers = [] } = req.body;
    
    console.log('📝 Event name from frontend:', eventName);
    
    // Validate required fields
    if (!teamName || !eventId || !teamLeaderData) {
      return res.status(400).json({ error: 'Team name, event ID, and team leader data are required' });
    }
    
    // Check if event exists
    const event = await Event.findById(eventId)
      .select('eventName eventType category venue date maxParticipants registeredCount isActive');
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    console.log('Event found:', { 
      eventName: event.eventName,
      eventType: event.eventType,
      category: event.category,
      venue: event.venue,
      maxParticipants: event.maxParticipants
    });
    
    // Check if event is active
    if (event.isActive === false) {
      return res.status(400).json({ error: 'Event is not available for registration' });
    }
    
    // Check if team name already exists for this event
    const existingTeam = await TeamRegistration.findOne({ 
      eventId, 
      teamName: { $regex: new RegExp(`^${teamName}$`, 'i') } 
    });
    
    if (existingTeam) {
      return res.status(400).json({ error: 'Team name already exists for this event' });
    }
    
    // Check if team leader or members are already in a team for this event
    const participantIds = [teamLeaderData.participantId, ...teamMembers.map(member => member.participantId)];
    
    const existingTeams = await TeamRegistration.find({
      eventId,
      $or: [
        { 'teamLeader.participantId': { $in: participantIds } },
        { 'teamMembers.participantId': { $in: participantIds } }
      ]
    });
    
    if (existingTeams.length > 0) {
      // Find which participant from the current request is already in a team
      console.log('Existing teams found:', existingTeams.map(t => ({
        teamName: t.teamName,
        leader: t.teamLeader.participantId,
        members: t.teamMembers.map(m => m.participantId)
      })));
      console.log('Current participants trying to register:', participantIds);
      
      let conflictingParticipant = null;
      for (const team of existingTeams) {
        if (participantIds.includes(team.teamLeader.participantId)) {
          conflictingParticipant = team.teamLeader.participantId;
          console.log('Found conflict in leader:', conflictingParticipant);
          break;
        }
        for (const member of team.teamMembers) {
          if (participantIds.includes(member.participantId)) {
            conflictingParticipant = member.participantId;
            console.log('Found conflict in member:', conflictingParticipant);
            break;
          }
        }
        if (conflictingParticipant) break;
      }
      
      return res.status(400).json({ 
        error: `Participant ${conflictingParticipant} is already part of a team for this event (Team: ${existingTeams[0].teamName})` 
      });
    }
    
    // Generate Team ID (TM000001, TM000002, etc.)
    const lastTeam = await TeamRegistration.findOne({}, { teamId: 1 })
      .sort({ createdAt: -1 })
      .limit(1);
    
    let teamNumber = 1;
    if (lastTeam && lastTeam.teamId && lastTeam.teamId.startsWith('TM')) {
      const lastNumber = parseInt(lastTeam.teamId.substring(2));
      if (!isNaN(lastNumber)) {
        teamNumber = lastNumber + 1;
      }
    }
    
    const teamId = `TM${String(teamNumber).padStart(6, '0')}`;
    
    // Use event name from frontend (already formatted correctly)
    const eventNameToUse = eventName || event.eventName || 'Unknown Event';
    console.log('✅ Using event name:', eventNameToUse);
    
    // Create new team registration
    const teamRegistration = new TeamRegistration({
      teamId,
      teamName,
      eventId,
      eventName: eventNameToUse,
      teamLeader: teamLeaderData,
      teamMembers: teamMembers,
      maxTeamSize: event.maxParticipants || 10,
      status: 'forming',
      totalAmount: 500 * (1 + teamMembers.length) // Default registration fee per person * team size
    });
    
    await teamRegistration.save();
    
    console.log(`Team created successfully with ID: ${teamId}`);
    console.log('Saved team details:', {
      teamId: teamRegistration.teamId,
      teamName: teamRegistration.teamName,
      eventName: teamRegistration.eventName,
      leader: teamRegistration.teamLeader.participantId,
      members: teamRegistration.teamMembers.map(m => m.participantId),
      savedAt: new Date().toISOString()
    });
    
    res.status(201).json({
      message: 'Team created successfully',
      team: teamRegistration
    });
    
  } catch (error) {
    console.error('Error creating team:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Send more detailed error information
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationErrors 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create team',
      message: error.message
    });
  }
});

// Add member to team
router.post('/add-member', auth, async (req, res) => {
  try {
    const { teamId, memberData } = req.body;
    
    if (!teamId || !memberData) {
      return res.status(400).json({ error: 'Team ID and member data are required' });
    }
    
    const team = await TeamRegistration.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Check if participant is already in another team for this event
    const existingTeam = await TeamRegistration.findOne({
      eventId: team.eventId,
      _id: { $ne: teamId },
      $or: [
        { 'teamLeader.participantId': memberData.participantId },
        { 'teamMembers.participantId': memberData.participantId }
      ]
    });
    
    if (existingTeam) {
      return res.status(400).json({ error: 'Participant is already part of another team for this event' });
    }
    
    await team.addTeamMember(memberData);
    
    res.json({
      message: 'Member added successfully',
      team
    });
    
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ error: error.message || 'Failed to add team member' });
  }
});

// Remove member from team
router.delete('/remove-member', auth, async (req, res) => {
  try {
    const { teamId, participantId } = req.body;
    
    if (!teamId || !participantId) {
      return res.status(400).json({ error: 'Team ID and participant ID are required' });
    }
    
    const team = await TeamRegistration.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    await team.removeTeamMember(participantId);
    
    res.json({
      message: 'Member removed successfully',
      team
    });
    
  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// Update member payment status
router.post('/update-payment', auth, async (req, res) => {
  try {
    const { teamId, participantId, paymentStatus, paymentId } = req.body;
    
    if (!teamId || !participantId || !paymentStatus) {
      return res.status(400).json({ error: 'Team ID, participant ID, and payment status are required' });
    }
    
    const team = await TeamRegistration.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    await team.updateMemberPayment(participantId, paymentStatus, paymentId);
    
    res.json({
      message: 'Payment status updated successfully',
      team
    });
    
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ error: error.message || 'Failed to update payment status' });
  }
});

// Register team (only if all members have paid)
router.post('/register-team', auth, async (req, res) => {
  try {
    const { teamId } = req.body;
    
    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }
    
    const team = await TeamRegistration.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Check if all members have paid
    const allPaid = team.teamMembers.every(member => member.paymentStatus === 'paid');
    if (!allPaid) {
      return res.status(400).json({ error: 'All team members must complete payment before registration' });
    }
    
    // Check if team has minimum required members
    const event = await Event.findById(team.eventId);
    const minTeamSize = event.minTeamSize || 2;
    if (team.teamMembers.length < minTeamSize) {
      return res.status(400).json({ error: `Team must have at least ${minTeamSize} members` });
    }
    
    team.status = 'registered';
    await team.save();
    
    res.json({
      message: 'Team registered successfully',
      team
    });
    
  } catch (error) {
    console.error('Error registering team:', error);
    res.status(500).json({ error: error.message || 'Failed to register team' });
  }
});

// Get all teams
router.get('/all-teams', auth, async (req, res) => {
  try {
    const teams = await TeamRegistration.find({})
      .populate('eventId', 'title description eventDate venue')
      .sort({ createdAt: -1 });
    
    res.json(teams);
  } catch (error) {
    console.error('Error fetching all teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get team details
router.get('/team/:teamId', auth, async (req, res) => {
  try {
    const team = await TeamRegistration.findById(req.params.teamId)
      .populate('eventId', 'name category date venue registrationFee')
      .populate('teamLeader.participantId', 'name email phone')
      .populate('teamMembers.participantId', 'name email phone');
      
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    res.json(team);
    
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team details' });
  }
});

// Get teams for an event
router.get('/event/:eventId/teams', auth, async (req, res) => {
  try {
    const teams = await TeamRegistration.find({ eventId: req.params.eventId })
      .populate('eventId', 'name category date venue')
      .populate('teamLeader.participantId', 'name email phone')
      .populate('teamMembers.participantId', 'name email phone')
      .sort({ registrationDate: -1 });
    
    res.json(teams);
    
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get events by category (with caching for vector search optimization)
router.get('/events/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    console.log(`Fetching ${category} events`);

    // Find events matching the category (using eventType field)
    const events = await Event.find({
      eventType: { $regex: new RegExp(`^${category}`, 'i') }, // Case-insensitive match for 'culturals', 'sports', 'para'
      isActive: true
    })
      .select('_id eventName description eventType category venue date time maxParticipants registeredCount isActive')
      .lean();

    console.log(`Found ${events.length} ${category} events`);
    
    if (events.length > 0) {
      console.log('Sample event:', events[0]);
    }

    // Map to frontend expected format
    const formattedEvents = events.map(event => ({
      _id: event._id,
      title: event.eventName,
      description: event.description,
      category: event.eventType,
      eventDate: event.date,
      venue: event.venue,
      maxParticipants: event.maxParticipants,
      currentParticipants: event.registeredCount || 0
    }));

    console.log(`Returning ${formattedEvents.length} formatted events`);
    res.json(formattedEvents);
  } catch (error) {
    console.error(`Error fetching ${req.params.category} events:`, error);
    res.status(500).json({ error: 'Failed to fetch events', details: error.message });
  }
});

// Get events sorted by category (Cultural and Sports first)
router.get('/events/sorted', async (req, res) => {
  try {
    // Find all events without filtering by isActive first to debug
    const events = await Event.find({})
      .select('_id eventName description category eventType venue maxParticipants registeredCount date time isActive')
      .lean();

    console.log('Total events found:', events.length);
    console.log('Sample event:', events[0]);

    // Filter active events
    const activeEvents = events.filter(e => e.isActive !== false);
    
    console.log('Active events:', activeEvents.length);

    // Sort events: culturals first, then sports, then others
    const sortedEvents = activeEvents.sort((a, b) => {
      const categoryOrder = { 'culturals': 1, 'sports': 2 };
      const orderA = categoryOrder[a.eventType] || 999;
      const orderB = categoryOrder[b.eventType] || 999;
      
      if (orderA !== orderB) return orderA - orderB;
      return (a.eventName || '').localeCompare(b.eventName || '');
    });

    // Map to frontend expected format
    const formattedEvents = sortedEvents.map(event => ({
      _id: event._id,
      title: event.eventName,
      description: event.description,
      category: event.eventType,
      eventDate: event.date,
      venue: event.venue,
      maxParticipants: event.maxParticipants,
      currentParticipants: event.registeredCount || 0
    }));

    console.log('Formatted events to send:', formattedEvents.length);
    res.json(formattedEvents);
  } catch (error) {
    console.error('Error fetching sorted events:', error);
    res.status(500).json({ error: 'Failed to fetch events', details: error.message });
  }
});

// Verify payment status by MHID (optimized for quick lookup)
router.post('/verify-payment', async (req, res) => {
  try {
    const { mhid } = req.body;

    if (!mhid || !mhid.match(/^MH\d{8}$/i)) {
      return res.status(400).json({ 
        error: 'Invalid MHID format. Expected format: MH26000001' 
      });
    }

    // Check cache first
    const cacheKey = mhid.toUpperCase();
    const cached = paymentStatusCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      return res.json(cached.data);
    }

    // Query only necessary fields for performance
    const registration = await Registration.findOne({ 
      userId: mhid.toUpperCase() 
    })
    .select('paymentStatus name email phone userId')
    .lean();

    if (!registration) {
      return res.status(404).json({ 
        error: 'Participant not found',
        mhid 
      });
    }

    const result = {
      mhid: registration.userId,
      name: registration.name,
      email: registration.email,
      phone: registration.phone,
      paymentStatus: registration.paymentStatus || 'unpaid',
      isPaid: registration.paymentStatus === 'paid'
    };

    // Cache the result
    paymentStatusCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    res.json(result);
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment status' });
  }
});

// Get participant's teams
router.get('/participant/:participantId/teams', auth, async (req, res) => {
  try {
    const teams = await TeamRegistration.find({
      $or: [
        { 'teamLeader.participantId': req.params.participantId },
        { 'teamMembers.participantId': req.params.participantId }
      ]
    })
    .populate('eventId', 'name category date venue')
    .sort({ registrationDate: -1 });
    
    res.json(teams);
    
  } catch (error) {
    console.error('Error fetching participant teams:', error);
    res.status(500).json({ error: 'Failed to fetch participant teams' });
  }
});

module.exports = router;