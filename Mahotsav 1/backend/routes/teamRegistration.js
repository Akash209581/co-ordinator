const express = require('express');
const TeamRegistration = require('../models/TeamRegistration');
const Event = require('../models/Event');
const Participant = require('../models/Participant');
const auth = require('../middleware/auth');
const router = express.Router();

// Create a new team for an event
router.post('/create-team', auth, async (req, res) => {
  try {
    console.log('Create team request received:', {
      body: JSON.stringify(req.body, null, 2),
      user: req.user?._id
    });
    
    const { teamName, eventId, teamLeaderData, teamMembers = [] } = req.body;
    
    // Validate required fields
    if (!teamName || !eventId || !teamLeaderData) {
      return res.status(400).json({ error: 'Team name, event ID, and team leader data are required' });
    }
    
    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Check if event is published and active
    if (event.status !== 'published' && event.status !== 'ongoing') {
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
    
    // Check if team leader is already in a team for this event
    const participantIds = [teamLeaderData.participantId, ...teamMembers.map(member => member.participantId)];
    
    const existingTeams = await TeamRegistration.find({
      eventId,
      $or: [
        { 'teamLeader.participantId': { $in: participantIds } },
        { 'teamMembers.participantId': { $in: participantIds } }
      ]
    });
    
    if (existingTeams.length > 0) {
      const conflictingParticipant = existingTeams[0].teamLeader.participantId;
      return res.status(400).json({ error: `Participant ${conflictingParticipant} is already part of a team for this event` });
    }
    
    // Create new team registration
    const teamRegistration = new TeamRegistration({
      teamName,
      eventId,
      eventName: event.title, // Use title instead of name
      teamLeader: teamLeaderData,
      teamMembers: teamMembers, // Add team members
      maxTeamSize: 10, // Default team size
      status: 'forming',
      totalAmount: 500 * (1 + teamMembers.length) // Default registration fee per person * team size
    });
    
    await teamRegistration.save();
    
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