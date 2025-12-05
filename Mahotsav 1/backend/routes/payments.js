const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, param } = require('express-validator');
const { authenticateToken: auth } = require('../middleware/auth');
const Participant = require('../models/Participant');
const Event = require('../models/Event');
const Coordinator = require('../models/Coordinator');

// @route   GET /api/payments/participant/:id
// @desc    Get participant details by ID for payment processing
// @access  Private (Coordinators only)
router.get('/participant/:id', [
  auth,
  param('id').notEmpty().withMessage('Participant ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid input', 
        errors: errors.array() 
      });
    }

    const participant = await Participant.findOne({ 
      participantId: req.params.id.toUpperCase() 
    }).populate('eventId', 'title registrationFee coordinator')
      .populate('processedBy', 'name username');

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found with this ID'
      });
    }

    // Allow any coordinator to search and view participant details
    // Removed permission check for centralized payment processing

    // Handle missing eventId gracefully
    const eventInfo = participant.eventId ? {
      title: participant.eventId.title,
      registrationFee: participant.eventId.registrationFee
    } : {
      title: 'Event Not Assigned',
      registrationFee: participant.paymentAmount || 0
    };

    res.json({
      success: true,
      participant: {
        participantId: participant.participantId,
        name: participant.name,
        email: participant.email,
        phoneNumber: participant.phoneNumber,
        college: participant.college,
        department: participant.department,
        year: participant.year,
        rollNumber: participant.rollNumber,
        event: eventInfo,
        registrationStatus: participant.registrationStatus,
        paymentStatus: participant.paymentStatus,
        paymentAmount: participant.paymentAmount || eventInfo.registrationFee,
        paidAmount: participant.paidAmount || 0,
        paymentDate: participant.paymentDate,
        paymentMethod: participant.paymentMethod,
        processedBy: participant.processedBy,
        paymentNotes: participant.paymentNotes,
        teamMembers: participant.teamMembers || []
      }
    });

  } catch (error) {
    console.error('Error fetching participant:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching participant details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/payments/process/:id
// @desc    Process payment for a participant
// @access  Private (Coordinators only)
router.post('/process/:id', [
  auth,
  param('id').notEmpty().withMessage('Participant ID is required'),
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
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid input', 
        errors: errors.array() 
      });
    }

    const { amount, method, notes } = req.body;
    const participantId = req.params.id.toUpperCase();

    const participant = await Participant.findOne({ 
      participantId 
    }).populate('eventId', 'title registrationFee coordinator');

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found with this ID'
      });
    }

    // Check if eventId exists
    if (!participant.eventId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot process payment: Participant has no event assigned. Please assign an event first.'
      });
    }

    // Allow any coordinator to process payments
    // Removed permission check for centralized payment processing

    // Check if participant is approved for registration
    if (participant.registrationStatus !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot process payment. Participant registration is not approved.'
      });
    }

    // Check if payment is already completed
    if (participant.paymentStatus === 'paid' && 
        participant.paidAmount >= participant.eventId.registrationFee) {
      return res.status(400).json({
        success: false,
        message: 'Payment already completed for this participant'
      });
    }

    // Update payment information
    const totalPaid = (participant.paidAmount || 0) + parseFloat(amount);
    const requiredAmount = participant.eventId.registrationFee;
    
    participant.paidAmount = totalPaid;
    participant.paymentAmount = requiredAmount;
    participant.paymentDate = new Date();
    participant.paymentMethod = method;
    participant.processedBy = req.user.id;
    participant.paymentNotes = notes || '';
    
    // Update payment status based on amount paid
    if (totalPaid >= requiredAmount) {
      participant.paymentStatus = 'paid';
    } else {
      participant.paymentStatus = 'pending'; // Partial payment
    }

    await participant.save();

    // Populate the updated participant for response
    await participant.populate('processedBy', 'name username');

    res.json({
      success: true,
      message: `Payment of ₹${amount} processed successfully`,
      participant: {
        participantId: participant.participantId,
        name: participant.name,
        paymentStatus: participant.paymentStatus,
        paymentAmount: participant.paymentAmount,
        paidAmount: participant.paidAmount,
        remainingAmount: Math.max(0, requiredAmount - totalPaid),
        paymentDate: participant.paymentDate,
        paymentMethod: participant.paymentMethod,
        processedBy: participant.processedBy,
        paymentNotes: participant.paymentNotes
      }
    });

  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing payment'
    });
  }
});

// @route   GET /api/payments/my-payments
// @desc    Get payments processed by the logged-in coordinator
// @access  Private (Coordinators only)
router.get('/my-payments', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    
    // Build base query - show only payments processed by this coordinator
    // AND only participants with valid eventId
    let query = { 
      processedBy: req.user.id,
      eventId: { $ne: null, $exists: true }
    };
    
    // Add status filter
    if (status && status !== 'all') {
      query.paymentStatus = status;
    }

    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { participantId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const payments = await Participant.find(query)
      .populate('eventId', 'title registrationFee')
      .populate('processedBy', 'name username')
      .sort({ paymentDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Participant.countDocuments(query);

    // Calculate statistics (only for participants with valid eventId)
    const stats = await Participant.aggregate([
      { 
        $match: { 
          processedBy: new mongoose.Types.ObjectId(req.user.id),
          eventId: { $ne: null, $exists: true }
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

    const statistics = {
      totalPayments: total,
      totalAmount: stats.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0),
      paidCount: stats.find(s => s._id === 'paid')?.count || 0,
      pendingCount: stats.find(s => s._id === 'pending')?.count || 0
    };

    res.json({
      success: true,
      payments: payments.map(p => ({
        participantId: p.participantId,
        name: p.name,
        email: p.email,
        event: p.eventId ? p.eventId.title : 'No Event',
        paymentStatus: p.paymentStatus,
        paymentAmount: p.paymentAmount,
        paidAmount: p.paidAmount,
        paymentDate: p.paymentDate,
        paymentMethod: p.paymentMethod,
        paymentNotes: p.paymentNotes,
        processedBy: p.processedBy // Add processedBy field
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      },
      statistics
    });

  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payments'
    });
  }
});

// @route   GET /api/payments/statistics
// @desc    Get payment statistics for coordinator's events
// @access  Private (Coordinators only)
router.get('/statistics', auth, async (req, res) => {
  try {
    let eventQuery = {};
    
    // If not admin, only show statistics for coordinator's events
    if (req.user.role !== 'admin') {
      eventQuery.coordinatorId = req.user.id;
    }

    const events = await Event.find(eventQuery).select('_id');
    const eventIds = events.map(e => e._id);

    const stats = await Participant.aggregate([
      { $match: { eventId: { $in: eventIds } } },
      {
        $group: {
          _id: null,
          totalParticipants: { $sum: 1 },
          totalPaymentAmount: { $sum: '$paymentAmount' },
          totalPaidAmount: { $sum: '$paidAmount' },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] }
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'failed'] }, 1, 0] }
          }
        }
      }
    ]);

    const statistics = stats[0] || {
      totalParticipants: 0,
      totalPaymentAmount: 0,
      totalPaidAmount: 0,
      paidCount: 0,
      pendingCount: 0,
      failedCount: 0
    };

    // Get recent payments
    const recentPayments = await Participant.find({
      eventId: { $in: eventIds },
      paymentStatus: 'paid',
      paymentDate: { $exists: true }
    })
      .populate('eventId', 'title')
      .sort({ paymentDate: -1 })
      .limit(5)
      .select('participantId name paidAmount paymentDate eventId');

    res.json({
      success: true,
      statistics: {
        ...statistics,
        collectionRate: statistics.totalParticipants > 0 
          ? ((statistics.paidCount / statistics.totalParticipants) * 100).toFixed(1)
          : 0
      },
      recentPayments: recentPayments.map(p => ({
        participantId: p.participantId,
        name: p.name,
        event: p.eventId.title,
        amount: p.paidAmount,
        date: p.paymentDate
      }))
    });

  } catch (error) {
    console.error('Error fetching payment statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching statistics'
    });
  }
});

// @route   PUT /api/payments/update/:id
// @desc    Update payment details for a participant
// @access  Private (Coordinators only)
router.put('/update/:id', [
  auth,
  param('id').notEmpty().withMessage('Participant ID is required'),
  body('paymentStatus')
    .optional()
    .isIn(['pending', 'paid', 'failed', 'refunded'])
    .withMessage('Invalid payment status'),
  body('paidAmount')
    .optional()
    .isNumeric()
    .withMessage('Paid amount must be a number')
    .isFloat({ min: 0 })
    .withMessage('Paid amount must be positive'),
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'card', 'upi', 'bank_transfer'])
    .withMessage('Invalid payment method'),
  body('paymentNotes')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Notes cannot exceed 200 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid input', 
        errors: errors.array() 
      });
    }

    const { paymentStatus, paidAmount, paymentMethod, paymentNotes } = req.body;
    const participantId = req.params.id.toUpperCase();

    const participant = await Participant.findOne({ 
      participantId 
    }).populate('eventId', 'title registrationFee coordinatorId');

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found with this ID'
      });
    }

    // Check if eventId exists
    if (!participant.eventId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update payment: Participant has no event assigned. Please assign an event first.'
      });
    }

    // Allow any coordinator to update payments
    // Removed permission check for centralized payment processing

    // Update only provided fields
    if (paymentStatus !== undefined) {
      participant.paymentStatus = paymentStatus;
    }
    
    if (paidAmount !== undefined) {
      participant.paidAmount = parseFloat(paidAmount);
      
      // Auto-update payment status based on amount ONLY if status not explicitly provided
      if (paymentStatus === undefined) {
        const requiredAmount = participant.eventId.registrationFee;
        if (participant.paidAmount >= requiredAmount) {
          participant.paymentStatus = 'paid';
        } else if (participant.paidAmount > 0) {
          participant.paymentStatus = 'pending'; // Partial payment
        } else {
          participant.paymentStatus = 'pending'; // No payment
        }
      }
    }
    
    if (paymentMethod !== undefined) {
      participant.paymentMethod = paymentMethod;
    }
    
    if (paymentNotes !== undefined) {
      participant.paymentNotes = paymentNotes;
    }

    // Update payment amount and date
    participant.paymentAmount = participant.eventId.registrationFee;
    participant.paymentDate = new Date();
    participant.processedBy = req.user.id;

    await participant.save();

    // Populate the updated participant for response
    await participant.populate('processedBy', 'name username');

    res.json({
      success: true,
      message: 'Payment details updated successfully',
      participant: {
        participantId: participant.participantId,
        name: participant.name,
        paymentStatus: participant.paymentStatus,
        paymentAmount: participant.paymentAmount,
        paidAmount: participant.paidAmount,
        remainingAmount: Math.max(0, participant.paymentAmount - participant.paidAmount),
        paymentDate: participant.paymentDate,
        paymentMethod: participant.paymentMethod,
        processedBy: participant.processedBy,
        paymentNotes: participant.paymentNotes
      }
    });

  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating payment'
    });
  }
});

// @route   GET /api/payments/unpaid
// @desc    Get all unpaid participants for coordinator's events
// @access  Private (Coordinators only)
router.get('/unpaid', auth, async (req, res) => {
  try {
    // Show all unpaid participants to all coordinators
    // This allows any coordinator to process payments for any participant
    const query = {
      // Only get participants with valid eventId
      eventId: { $ne: null, $exists: true },
      // Find unpaid participants across all events
      $or: [
        { paymentStatus: 'pending' },
        { paymentStatus: 'failed' },
        { $expr: { $lt: ['$paidAmount', '$paymentAmount'] } }
      ]
    };

    const unpaidParticipants = await Participant.find(query)
      .populate('eventId', 'title registrationFee coordinatorId')
      .populate('processedBy', 'name username')
      .sort({ createdAt: -1 })
      .limit(50);

    // Double-check: filter out any participants where eventId failed to populate
    const validParticipants = unpaidParticipants.filter(p => p.eventId != null);

    const formattedParticipants = validParticipants.map(participant => ({
      participantId: participant.participantId,
      name: participant.name,
      email: participant.email,
      phoneNumber: participant.phoneNumber,
      college: participant.college,
      department: participant.department,
      year: participant.year,
      event: participant.eventId.title,
      eventId: participant.eventId._id,
      registrationFee: participant.eventId.registrationFee,
      paymentStatus: participant.paymentStatus,
      paymentAmount: participant.paymentAmount || participant.eventId.registrationFee,
      paidAmount: participant.paidAmount || 0,
      remainingAmount: Math.max(0, (participant.paymentAmount || participant.eventId.registrationFee) - (participant.paidAmount || 0)),
      paymentDate: participant.paymentDate,
      paymentMethod: participant.paymentMethod,
      paymentNotes: participant.paymentNotes,
      processedBy: participant.processedBy,
      registrationStatus: participant.registrationStatus
    }));

    res.json({
      success: true,
      count: formattedParticipants.length,
      participants: formattedParticipants
    });

  } catch (error) {
    console.error('Error fetching unpaid participants:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching unpaid participants'
    });
  }
});

// @route   POST /api/payments/mark-paid/:id
// @desc    Mark participant as paid (quick payment)
// @access  Private (Coordinators only)
router.post('/mark-paid/:id', [
  auth,
  param('id').notEmpty().withMessage('Participant ID is required'),
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
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid input', 
        errors: errors.array() 
      });
    }

    const { amount, paymentMethod = 'cash', paymentNotes = '' } = req.body;
    const participantId = req.params.id.toUpperCase();

    const participant = await Participant.findOne({ 
      participantId 
    }).populate('eventId', 'title registrationFee coordinatorId');

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found with this ID'
      });
    }

    // Check if eventId exists
    if (!participant.eventId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot mark as paid: Participant has no event assigned. Please assign an event first.'
      });
    }

    // Allow any coordinator to mark payments (removed permission check)
    // This enables centralized payment processing team

    // Determine the amount to charge
    const amountToCharge = amount !== undefined 
      ? parseFloat(amount) 
      : participant.eventId.registrationFee;

    // Mark as paid with specified amount (or full amount if not specified)
    participant.paymentStatus = 'paid';
    participant.paymentAmount = participant.eventId.registrationFee;
    participant.paidAmount = amountToCharge;
    participant.paymentDate = new Date();
    participant.paymentMethod = paymentMethod;
    participant.paymentNotes = paymentNotes;
    participant.processedBy = req.user.id;

    await participant.save();

    // Populate the updated participant for response
    await participant.populate('processedBy', 'name username');

    res.json({
      success: true,
      message: 'Participant marked as paid successfully',
      participant: {
        participantId: participant.participantId,
        name: participant.name,
        paymentStatus: participant.paymentStatus,
        paymentAmount: participant.paymentAmount,
        paidAmount: participant.paidAmount,
        remainingAmount: Math.max(0, participant.paymentAmount - participant.paidAmount),
        paymentDate: participant.paymentDate,
        paymentMethod: participant.paymentMethod,
        processedBy: participant.processedBy,
        paymentNotes: participant.paymentNotes
      }
    });

  } catch (error) {
    console.error('Error marking participant as paid:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking as paid'
    });
  }
});

// @route   DELETE /api/payments/reset/:id
// @desc    Reset payment status for a participant
// @access  Private (Coordinators only)
router.delete('/reset/:id', [
  auth,
  param('id').notEmpty().withMessage('Participant ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid input', 
        errors: errors.array() 
      });
    }

    const participantId = req.params.id.toUpperCase();

    const participant = await Participant.findOne({ 
      participantId 
    }).populate('eventId', 'title registrationFee coordinatorId');

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found with this ID'
      });
    }

    // Allow any coordinator to reset payments
    // Removed permission check for centralized payment processing

    // Reset payment details
    participant.paymentStatus = 'pending';
    participant.paidAmount = 0;
    participant.paymentDate = null;
    participant.paymentMethod = null;
    participant.paymentNotes = '';
    participant.processedBy = null;

    await participant.save();

    res.json({
      success: true,
      message: 'Payment status reset successfully',
      participant: {
        participantId: participant.participantId,
        name: participant.name,
        paymentStatus: participant.paymentStatus,
        paymentAmount: participant.paymentAmount,
        paidAmount: participant.paidAmount,
        remainingAmount: participant.paymentAmount,
        paymentDate: participant.paymentDate,
        paymentMethod: participant.paymentMethod,
        paymentNotes: participant.paymentNotes
      }
    });

  } catch (error) {
    console.error('Error resetting payment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resetting payment'
    });
  }
});

module.exports = router;