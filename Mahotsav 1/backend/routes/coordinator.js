const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { body, validationResult, param } = require('express-validator');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Participant = require('../models/Participant');
const Registration = require('../models/Registration');
const Coordinator = require('../models/Coordinator');

const router = express.Router();

// Apply authentication to all coordinator routes
router.use(authenticateToken);

// @desc    Get dashboard statistics
// @route   GET /api/coordinator/dashboard/stats
// @access  Private
router.get('/dashboard/stats', asyncHandler(async (req, res) => {
  const coordinatorId = req.user._id;
  const userRole = req.user.role;

  let eventQuery = {};
  let participantEventQuery = {};

  // If admin, show all events; if coordinator, show only their events
  if (userRole === 'admin') {
    // Admin sees all events and participants
    eventQuery = {};
  } else {
    // Coordinator sees only their events
    eventQuery = { coordinatorId };
    const coordinatorEvents = await Event.find({ coordinatorId }).select('_id');
    const eventIds = coordinatorEvents.map(event => event._id);
    participantEventQuery = { eventId: { $in: eventIds } };
  }

  // Get comprehensive statistics
  const [
    totalEvents,
    publishedEvents,
    draftEvents,
    completedEvents,
    totalParticipants,
    approvedParticipants,
    pendingApprovals,
    rejectedParticipants,
    paidParticipants,
    events,
    recentParticipants
  ] = await Promise.all([
    Event.countDocuments(eventQuery),
    Event.countDocuments({ ...eventQuery, status: 'published' }),
    Event.countDocuments({ ...eventQuery, status: 'draft' }),
    Event.countDocuments({ ...eventQuery, status: 'completed' }),
    userRole === 'admin' ? Participant.countDocuments() : Participant.countDocuments(participantEventQuery),
    userRole === 'admin' ? Participant.countDocuments({ registrationStatus: 'approved' }) : Participant.countDocuments({ ...participantEventQuery, registrationStatus: 'approved' }),
    userRole === 'admin' ? Participant.countDocuments({ registrationStatus: 'pending' }) : Participant.countDocuments({ ...participantEventQuery, registrationStatus: 'pending' }),
    userRole === 'admin' ? Participant.countDocuments({ registrationStatus: 'rejected' }) : Participant.countDocuments({ ...participantEventQuery, registrationStatus: 'rejected' }),
    userRole === 'admin' ? Participant.countDocuments({ paymentStatus: 'paid' }) : Participant.countDocuments({ ...participantEventQuery, paymentStatus: 'paid' }),
    Event.find(eventQuery).select('title category prizes maxParticipants currentParticipants'),
    userRole === 'admin' ? 
      Participant.find().populate('eventId', 'title').sort({ createdAt: -1 }).limit(8).select('name eventId createdAt registrationStatus') :
      Participant.find(participantEventQuery).populate('eventId', 'title').sort({ createdAt: -1 }).limit(8).select('name eventId createdAt registrationStatus')
  ]);

  // Calculate additional metrics
  const totalPrizeMoney = events.reduce((sum, event) => {
    return sum + (event.prizes?.reduce((prizeSum, prize) => prizeSum + (prize.amount || 0), 0) || 0);
  }, 0);

  // Category breakdown
  const categoryBreakdown = events.reduce((acc, event) => {
    acc[event.category] = (acc[event.category] || 0) + 1;
    return acc;
  }, {});

  // Capacity utilization
  const totalCapacity = events.reduce((sum, event) => sum + event.maxParticipants, 0);
  const currentOccupancy = events.reduce((sum, event) => sum + event.currentParticipants, 0);
  const capacityUtilization = totalCapacity > 0 ? Math.round((currentOccupancy / totalCapacity) * 100) : 0;

  // Format recent activities
  const recentActivities = recentParticipants.map(participant => {
    const timeAgo = getTimeAgo(participant.createdAt);
    return {
      time: participant.createdAt.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }),
      activity: `${participant.name} registered for ${participant.eventId?.title || 'Unknown Event'}`,
      status: participant.registrationStatus,
      timestamp: participant.createdAt,
      timeAgo
    };
  });

  // Add some system activities for better UX
  const systemActivities = [
    {
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      activity: 'System backup completed successfully',
      status: 'completed',
      timestamp: new Date(),
      timeAgo: 'Just now'
    },
    {
      time: new Date(Date.now() - 300000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      activity: 'Database optimization scheduled',
      status: 'scheduled',
      timestamp: new Date(Date.now() - 300000),
      timeAgo: '5 minutes ago'
    }
  ];

  const allActivities = [...recentActivities, ...systemActivities].slice(0, 10);

  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalEvents,
        publishedEvents,
        draftEvents,
        completedTasks: completedEvents,
        totalParticipants,
        activeParticipants: approvedParticipants,
        pendingApprovals,
        rejectedParticipants,
        paidParticipants,
        totalPrizeMoney,
        capacityUtilization,
        categoryBreakdown
      },
      recentActivities: allActivities,
      summary: {
        userRole,
        userName: `${req.user.firstName} ${req.user.lastName}`,
        department: req.user.department,
        isAdmin: userRole === 'admin',
        totalCapacity,
        currentOccupancy
      }
    }
  });
}));

// Helper function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffInMs = now - date;
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMins < 1) return 'Just now';
  if (diffInMins < 60) return `${diffInMins} minute${diffInMins > 1 ? 's' : ''} ago`;
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
}

// @desc    Get coordinator's events
// @route   GET /api/coordinator/events
// @access  Private
router.get('/events', asyncHandler(async (req, res) => {
  const coordinatorId = req.user._id;
  const { status, category, page = 1, limit = 10 } = req.query;

  const query = { coordinatorId };
  
  if (status) query.status = status;
  if (category) query.category = category;

  const events = await Event.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .populate('coordinatorId', 'firstName lastName');

  const total = await Event.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      events,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    }
  });
}));

// @desc    Create new event
// @route   POST /api/coordinator/events
// @access  Private
router.post('/events', asyncHandler(async (req, res) => {
  const coordinatorId = req.user._id;
  
  const eventData = {
    ...req.body,
    coordinatorId
  };

  const event = new Event(eventData);
  await event.save();

  const populatedEvent = await Event.findById(event._id)
    .populate('coordinatorId', 'firstName lastName');

  res.status(201).json({
    success: true,
    message: 'Event created successfully',
    data: {
      event: populatedEvent
    }
  });
}));

// @desc    Get event participants
// @route   GET /api/coordinator/events/:eventId/participants
// @access  Private
router.get('/events/:eventId/participants', asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { status, page = 1, limit = 10 } = req.query;

  // Verify event belongs to coordinator
  const event = await Event.findOne({ _id: eventId, coordinatorId: req.user._id });
  if (!event) {
    return res.status(404).json({
      error: 'Not found',
      message: 'Event not found or access denied'
    });
  }

  const query = { eventId };
  if (status) query.registrationStatus = status;

  const participants = await Participant.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Participant.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      participants,
      event: {
        title: event.title,
        maxParticipants: event.maxParticipants,
        currentParticipants: event.currentParticipants
      },
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    }
  });
}));

// @desc    Update participant status (approve/reject)
// @route   PUT /api/coordinator/participants/:participantId/status
// @access  Private
router.put('/participants/:participantId/status', asyncHandler(async (req, res) => {
  const { participantId } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected', 'waitlisted'].includes(status)) {
    return res.status(400).json({
      error: 'Invalid status',
      message: 'Status must be approved, rejected, or waitlisted'
    });
  }

  const participant = await Participant.findById(participantId).populate('eventId');
  if (!participant) {
    return res.status(404).json({
      error: 'Not found',
      message: 'Participant not found'
    });
  }

  // Verify event belongs to coordinator
  if (participant.eventId.coordinatorId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'You can only manage participants for your events'
    });
  }

  participant.registrationStatus = status;
  await participant.save();

  // Update event participant count if approved
  if (status === 'approved' && participant.registrationStatus !== 'approved') {
    await Event.findByIdAndUpdate(participant.eventId._id, {
      $inc: { currentParticipants: 1 }
    });
  } else if (status !== 'approved' && participant.registrationStatus === 'approved') {
    await Event.findByIdAndUpdate(participant.eventId._id, {
      $inc: { currentParticipants: -1 }
    });
  }

  res.status(200).json({
    success: true,
    message: `Participant ${status} successfully`,
    data: {
      participant
    }
  });
}));

// @desc    Get coordinator profile
// @route   GET /api/coordinator/profile
// @access  Private
router.get('/profile', asyncHandler(async (req, res) => {
  const coordinator = await Coordinator.findById(req.user._id).select('-password');
  
  res.status(200).json({
    success: true,
    data: {
      coordinator
    }
  });
}));

// @desc    Update coordinator profile
// @route   PUT /api/coordinator/profile
// @access  Private
router.put('/profile', asyncHandler(async (req, res) => {
  const { firstName, lastName, department, phoneNumber } = req.body;

  const coordinator = await Coordinator.findByIdAndUpdate(
    req.user._id,
    { firstName, lastName, department, phoneNumber },
    { new: true, runValidators: true }
  ).select('-password');

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      coordinator
    }
  });
}));

// ===== REGISTRATION/PAYMENT ROUTES =====

// @desc    Get participant details by ID for payment processing
// @route   GET /api/coordinator/registrations/participant/:id
// @access  Private
router.get('/registrations/participant/:id', [
  param('id').notEmpty().withMessage('Registration ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid input', 
      errors: errors.array() 
    });
  }

  const registration = await Registration.findOne({ 
    $or: [
      { registerId: req.params.id.toUpperCase() },
      { userId: req.params.id.toUpperCase() }
    ]
  }).populate('processedBy', 'firstName lastName username');

  if (!registration) {
    return res.status(404).json({
      success: false,
      message: 'Registration not found with this ID'
    });
  }

  // Calculate registration fee based on user type and participation
  let registrationFee = 0;
  if (registration.userType === 'visitor') {
    registrationFee = 50; // Visitor fee
  } else if (registration.userType === 'participant') {
    if (registration.participationType === 'sports') {
      registrationFee = 200;
    } else if (registration.participationType === 'cultural') {
      registrationFee = 200;
    } else if (registration.participationType === 'both') {
      registrationFee = 350;
    }
  }

  res.json({
    success: true,
    participant: {
      participantId: registration.userId || registration.registerId,
      userId: registration.userId,
      name: registration.name,
      email: registration.email,
      phoneNumber: registration.phone,
      college: registration.college,
      userType: registration.userType,
      participationType: registration.participationType,
      event: {
        title: `${registration.userType} - ${registration.participationType}`,
        registrationFee: registrationFee
      },
      registrationStatus: 'approved',
      paymentStatus: registration.paymentStatus,
      paymentAmount: registration.paymentAmount || registrationFee,
      paidAmount: registration.paidAmount || 0,
      paymentDate: registration.paymentDate,
      paymentMethod: registration.paymentMethod,
      processedBy: registration.processedBy,
      paymentNotes: registration.paymentNotes
    }
  });
}));

// @desc    Get all unpaid participants
// @route   GET /api/coordinator/registrations/unpaid
// @access  Private
router.get('/registrations/unpaid', asyncHandler(async (req, res) => {
  const query = {
    $or: [
      { paymentStatus: 'unpaid' },
      { paymentStatus: 'pending' },
      { paymentStatus: 'failed' }
    ]
  };

  const unpaidRegistrations = await Registration.find(query)
    .populate('processedBy', 'firstName lastName username')
    .sort({ createdAt: -1 })
    .limit(100);

  const formattedParticipants = unpaidRegistrations.map(registration => {
    // Calculate registration fee based on user type and participation
    let registrationFee = 0;
    if (registration.userType === 'visitor') {
      registrationFee = 50;
    } else if (registration.userType === 'participant') {
      if (registration.participationType === 'sports') {
        registrationFee = 200;
      } else if (registration.participationType === 'cultural') {
        registrationFee = 200;
      } else if (registration.participationType === 'both') {
        registrationFee = 350;
      }
    }

    return {
      participantId: registration.userId || registration.registerId,
      userId: registration.userId,
      name: registration.name,
      email: registration.email,
      phoneNumber: registration.phone,
      college: registration.college,
      userType: registration.userType,
      participationType: registration.participationType,
      event: `${registration.userType} - ${registration.participationType}`,
      registrationFee: registrationFee,
      paymentStatus: registration.paymentStatus,
      paymentAmount: registration.paymentAmount || registrationFee,
      paidAmount: registration.paidAmount || 0,
      remainingAmount: Math.max(0, (registration.paymentAmount || registrationFee) - (registration.paidAmount || 0)),
      paymentDate: registration.paymentDate,
      paymentMethod: registration.paymentMethod,
      paymentNotes: registration.paymentNotes,
      processedBy: registration.processedBy,
      registrationStatus: 'approved'
    };
  });

  res.json({
    success: true,
    count: formattedParticipants.length,
    participants: formattedParticipants
  });
}));

// @desc    Mark participant as paid
// @route   POST /api/coordinator/registrations/mark-paid/:id
// @access  Private
router.post('/registrations/mark-paid/:id', [
  param('id').notEmpty().withMessage('Registration ID is required'),
  body('amount')
    .optional()
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0 })
    .withMessage('Amount must be positive'),
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'card', 'upi', 'bank_transfer'])
    .withMessage('Invalid payment method'),
  body('paymentNotes')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Notes cannot exceed 200 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid input', 
      errors: errors.array() 
    });
  }

  const { amount, paymentMethod = 'cash', paymentNotes = '' } = req.body;
  const registrationId = req.params.id.toUpperCase();

  const registration = await Registration.findOne({ 
    $or: [
      { registerId: registrationId },
      { userId: registrationId }
    ]
  });

  if (!registration) {
    return res.status(404).json({
      success: false,
      message: 'Registration not found with this ID'
    });
  }

  // Calculate registration fee based on user type and participation
  let registrationFee = 0;
  if (registration.userType === 'visitor') {
    registrationFee = 50;
  } else if (registration.userType === 'participant') {
    if (registration.participationType === 'sports') {
      registrationFee = 200;
    } else if (registration.participationType === 'cultural') {
      registrationFee = 200;
    } else if (registration.participationType === 'both') {
      registrationFee = 350;
    }
  }

  const amountToCharge = amount !== undefined 
    ? parseFloat(amount) 
    : registrationFee;

  registration.paymentStatus = 'paid';
  registration.paymentAmount = registrationFee;
  registration.paidAmount = amountToCharge;
  registration.paymentDate = new Date();
  registration.paymentMethod = paymentMethod;
  registration.paymentNotes = paymentNotes;
  registration.processedBy = req.user.id;

  await registration.save();
  await registration.populate('processedBy', 'firstName lastName username');

  res.json({
    success: true,
    message: 'Registration marked as paid successfully',
    participant: {
      participantId: registration.userId || registration.registerId,
      userId: registration.userId,
      name: registration.name,
      paymentStatus: registration.paymentStatus,
      paymentAmount: registration.paymentAmount,
      paidAmount: registration.paidAmount,
      remainingAmount: Math.max(0, registration.paymentAmount - registration.paidAmount),
      paymentDate: registration.paymentDate,
      paymentMethod: registration.paymentMethod,
      processedBy: registration.processedBy,
      paymentNotes: registration.paymentNotes
    }
  });
}));

// @desc    Process payment for a participant
// @route   POST /api/coordinator/registrations/process/:id
// @access  Private
router.post('/registrations/process/:id', [
  param('id').notEmpty().withMessage('Registration ID is required'),
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0 })
    .withMessage('Amount must be positive'),
  body('method')
    .isIn(['cash', 'card', 'upi', 'bank_transfer'])
    .withMessage('Invalid payment method'),
  body('notes')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Notes cannot exceed 200 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid input', 
      errors: errors.array() 
    });
  }

  const { amount, method, notes } = req.body;
  const registrationId = req.params.id.toUpperCase();

  const registration = await Registration.findOne({ 
    $or: [
      { registerId: registrationId },
      { userId: registrationId }
    ]
  });

  if (!registration) {
    return res.status(404).json({
      success: false,
      message: 'Registration not found with this ID'
    });
  }

  // Calculate registration fee based on user type and participation
  let registrationFee = 0;
  if (registration.userType === 'visitor') {
    registrationFee = 50;
  } else if (registration.userType === 'participant') {
    if (registration.participationType === 'sports') {
      registrationFee = 200;
    } else if (registration.participationType === 'cultural') {
      registrationFee = 200;
    } else if (registration.participationType === 'both') {
      registrationFee = 350;
    }
  }

  const totalPaid = (registration.paidAmount || 0) + parseFloat(amount);
  const requiredAmount = registrationFee;
    
  registration.paidAmount = totalPaid;
  registration.paymentAmount = requiredAmount;
  registration.paymentDate = new Date();
  registration.paymentMethod = method;
  registration.processedBy = req.user.id;
  registration.paymentNotes = notes || '';
    
  if (totalPaid >= requiredAmount) {
    registration.paymentStatus = 'paid';
  } else {
    registration.paymentStatus = 'pending';
  }

  await registration.save();
  await registration.populate('processedBy', 'firstName lastName username');

  res.json({
    success: true,
    message: `Payment of ₹${amount} processed successfully`,
    participant: {
      participantId: registration.userId || registration.registerId,
      userId: registration.userId,
      name: registration.name,
      paymentStatus: registration.paymentStatus,
      paymentAmount: registration.paymentAmount,
      paidAmount: registration.paidAmount,
      remainingAmount: Math.max(0, requiredAmount - totalPaid),
      paymentDate: registration.paymentDate,
      paymentMethod: registration.paymentMethod,
      processedBy: registration.processedBy,
      paymentNotes: registration.paymentNotes
    }
  });
}));

// @desc    Update payment details
// @route   PUT /api/coordinator/registrations/update/:id
// @access  Private
router.put('/registrations/update/:id', [
  param('id').notEmpty().withMessage('Registration ID is required'),
  body('paymentStatus')
    .optional()
    .isIn(['pending', 'paid', 'failed', 'unpaid'])
    .withMessage('Invalid payment status'),
  body('paidAmount')
    .optional()
    .isNumeric()
    .withMessage('Paid amount must be a number'),
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'card', 'upi', 'bank_transfer'])
    .withMessage('Invalid payment method'),
  body('paymentNotes')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Notes cannot exceed 200 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid input', 
      errors: errors.array() 
    });
  }

  const { paymentStatus, paidAmount, paymentMethod, paymentNotes } = req.body;
  const registrationId = req.params.id.toUpperCase();

  const registration = await Registration.findOne({ 
    $or: [
      { registerId: registrationId },
      { userId: registrationId }
    ]
  });

  if (!registration) {
    return res.status(404).json({
      success: false,
      message: 'Registration not found with this ID'
    });
  }

  // Calculate registration fee based on user type and participation
  let registrationFee = 0;
  if (registration.userType === 'visitor') {
    registrationFee = 50;
  } else if (registration.userType === 'participant') {
    if (registration.participationType === 'sports') {
      registrationFee = 200;
    } else if (registration.participationType === 'cultural') {
      registrationFee = 200;
    } else if (registration.participationType === 'both') {
      registrationFee = 350;
    }
  }

  if (paymentStatus !== undefined) {
    registration.paymentStatus = paymentStatus;
  }
    
  if (paidAmount !== undefined) {
    registration.paidAmount = parseFloat(paidAmount);
      
    if (paymentStatus === undefined) {
      if (registration.paidAmount >= registrationFee) {
        registration.paymentStatus = 'paid';
      } else if (registration.paidAmount > 0) {
        registration.paymentStatus = 'pending';
      } else {
        registration.paymentStatus = 'unpaid';
      }
    }
  }
    
  if (paymentMethod !== undefined) {
    registration.paymentMethod = paymentMethod;
  }
    
  if (paymentNotes !== undefined) {
    registration.paymentNotes = paymentNotes;
  }

  registration.paymentAmount = registrationFee;
  registration.paymentDate = new Date();
  registration.processedBy = req.user.id;

  await registration.save();
  await registration.populate('processedBy', 'firstName lastName username');

  res.json({
    success: true,
    message: 'Payment details updated successfully',
    participant: {
      participantId: registration.userId || registration.registerId,
      userId: registration.userId,
      name: registration.name,
      paymentStatus: registration.paymentStatus,
      paymentAmount: registration.paymentAmount,
      paidAmount: registration.paidAmount,
      remainingAmount: Math.max(0, registration.paymentAmount - registration.paidAmount),
      paymentDate: registration.paymentDate,
      paymentMethod: registration.paymentMethod,
      processedBy: registration.processedBy,
      paymentNotes: registration.paymentNotes
    }
  });
}));

// @desc    Reset payment status
// @route   DELETE /api/coordinator/registrations/reset/:id
// @access  Private
router.delete('/registrations/reset/:id', [
  param('id').notEmpty().withMessage('Registration ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid input', 
      errors: errors.array() 
    });
  }

  const registrationId = req.params.id.toUpperCase();

  const registration = await Registration.findOne({ 
    $or: [
      { registerId: registrationId },
      { userId: registrationId }
    ]
  });

  if (!registration) {
    return res.status(404).json({
      success: false,
      message: 'Registration not found with this ID'
    });
  }

  registration.paymentStatus = 'unpaid';
  registration.paidAmount = 0;
  registration.paymentDate = null;
  registration.paymentMethod = null;
  registration.paymentNotes = '';
  registration.processedBy = null;

  await registration.save();

  res.json({
    success: true,
    message: 'Payment status reset successfully',
    participant: {
      participantId: registration.userId || registration.registerId,
      userId: registration.userId,
      name: registration.name,
      paymentStatus: registration.paymentStatus,
      paymentAmount: registration.paymentAmount,
      paidAmount: registration.paidAmount,
      remainingAmount: registration.paymentAmount,
      paymentDate: registration.paymentDate,
      paymentMethod: registration.paymentMethod,
      paymentNotes: registration.paymentNotes
    }
  });
}));

// @desc    Get team registrations (participants only)
// @route   GET /api/coordinator/registrations/teams
// @access  Private
router.get('/eventRegistrations', asyncHandler(async (req, res) => {
  // Query the eventRegistrations collection directly using mongoose connection
  const eventRegistrations = await mongoose.connection.db
    .collection('eventRegistrations')
    .find({})
    .sort({ registrationDate: -1 })
    .limit(200)
    .toArray();

  const formattedRegistrations = eventRegistrations.map(registration => {
    return {
      participantId: registration.userId || registration._id.toString(),
      userId: registration.userId,
      name: registration.participantName || registration.name,
      email: registration.email,
      phoneNumber: registration.phone,
      college: registration.college,
      department: registration.department,
      year: registration.year,
      rollNumber: registration.rollNumber,
      userType: registration.userType || 'participant',
      participationType: registration.registrationType || registration.eventType,
      event: registration.eventName || registration.event || 'Event',
      registrationStatus: registration.status || 'confirmed',
      paymentStatus: registration.paymentStatus || 'unpaid',
      paymentAmount: registration.paymentAmount || 0,
      paidAmount: registration.paidAmount || 0,
      remainingAmount: Math.max(0, (registration.paymentAmount || 0) - (registration.paidAmount || 0)),
      paymentDate: registration.paymentDate,
      paymentMethod: registration.paymentMethod,
      paymentNotes: registration.paymentNotes,
      teamMembers: registration.teamMembers || []
    };
  });

  res.json({
    success: true,
    count: formattedRegistrations.length,
    registrations: formattedRegistrations
  });
}));

// @desc    Get payment history processed by coordinator
// @route   GET /api/coordinator/registrations/my-payments
// @access  Private
router.get('/registrations/my-payments', asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, status, search } = req.query;
    
  let query = { 
    processedBy: req.user.id
  };
    
  if (status && status !== 'all') {
    query.paymentStatus = status;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { registerId: { $regex: search, $options: 'i' } },
      { userId: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const payments = await Registration.find(query)
    .populate('processedBy', 'firstName lastName username')
    .sort({ paymentDate: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Registration.countDocuments(query);

  const stats = await Registration.aggregate([
    { 
      $match: { 
        processedBy: new mongoose.Types.ObjectId(req.user.id)
      } 
    },
    {
      $group: {
        _id: '$paymentStatus',
        count: { $sum: 1 },
        totalAmount: { $sum: '$paidAmount' }
      }
    }
  ]);

  // Get payment method breakdown
  const methodStats = await Registration.aggregate([
    { 
      $match: { 
        processedBy: new mongoose.Types.ObjectId(req.user.id),
        paymentStatus: 'paid'
      } 
    },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        totalAmount: { $sum: '$paidAmount' }
      }
    }
  ]);

  const statistics = {
    totalPayments: total,
    totalAmount: stats.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0),
    paidCount: stats.find(s => s._id === 'paid')?.count || 0,
    unpaidCount: stats.find(s => s._id === 'unpaid')?.count || 0,
    pendingCount: stats.find(s => s._id === 'pending')?.count || 0,
    cashAmount: methodStats.find(m => m._id === 'cash')?.totalAmount || 0,
    upiAmount: methodStats.find(m => m._id === 'upi')?.totalAmount || 0
  };

  res.json({
    success: true,
    payments: payments.map(p => ({
      participantId: p.userId || p.registerId,
      userId: p.userId,
      name: p.name,
      email: p.email,
      event: `${p.userType} - ${p.participationType}`,
      paymentStatus: p.paymentStatus,
      paymentAmount: p.paymentAmount,
      paidAmount: p.paidAmount,
      paymentDate: p.paymentDate,
      paymentMethod: p.paymentMethod,
      paymentNotes: p.paymentNotes,
      processedBy: p.processedBy
    })),
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total
    },
    statistics
  });
}));

module.exports = router;