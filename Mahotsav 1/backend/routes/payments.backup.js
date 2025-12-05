const express = require('express');
const router = express.Router();
const { body, validationResult, param } = require('express-validator');
const auth = require('../middleware/auth');
const Participant = require('../models/Participant');
const Event = require('../models/Event');
const Coordinator = require('../models/Coordinator');

// @route   GET /api/payments/participant/:id
// @desc    Get participant details by ID for payment processing
// @access  Private (Coordinators only)
router.get('/participant/:id', auth, param('id').notEmpty().withMessage('Participant ID is required'), async (req, res) => {
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

    // Check if coordinator has permission to process payment for this event
    const event = await Event.findById(participant.eventId._id);
    if (req.user.role !== 'admin' && 
        event.coordinator.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only process payments for your managed events'
      });
    }

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
        event: {
          title: participant.eventId.title,
          registrationFee: participant.eventId.registrationFee
        },
        registrationStatus: participant.registrationStatus,
        paymentStatus: participant.paymentStatus,
        paymentAmount: participant.paymentAmount,
        paidAmount: participant.paidAmount,
        paymentDate: participant.paymentDate,
        paymentMethod: participant.paymentMethod,
        processedBy: participant.processedBy,
        paymentNotes: participant.paymentNotes,
        teamMembers: participant.teamMembers
      }
    });

  } catch (error) {
    console.error('Error fetching participant:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching participant details'
    });
  }
});

// @route   POST /api/payments/process/:id
// @desc    Process payment for a participant
// @access  Private (Coordinators only)
router.post('/process/:id', auth, param('id').notEmpty().withMessage('Participant ID is required'), body('amount').isNumeric().withMessage('Amount must be a number').isFloat({ min: 0 }).withMessage('Amount must be positive'), body('method').isIn(['cash', 'card', 'upi', 'bank_transfer']).withMessage('Invalid payment method'), body('notes').optional().isLength({ max: 200 }).withMessage('Notes cannot exceed 200 characters'), async (req, res) => {
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

    // Check if coordinator has permission
    const event = await Event.findById(participant.eventId._id);
    if (req.user.role !== 'admin' && 
        event.coordinator.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only process payments for your managed events'
      });
    }

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
// @desc    Get all payments processed by the coordinator
// @access  Private (Coordinators only)
router.get('/my-payments', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    
    let query = { processedBy: req.user.id };
    
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

    // Calculate statistics
    const stats = await Participant.aggregate([
      { $match: { processedBy: req.user._id } },
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
        event: p.eventId.title,
        paymentStatus: p.paymentStatus,
        paymentAmount: p.paymentAmount,
        paidAmount: p.paidAmount,
        paymentDate: p.paymentDate,
        paymentMethod: p.paymentMethod,
        paymentNotes: p.paymentNotes
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
      eventQuery.coordinator = req.user.id;
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

module.exports = router;