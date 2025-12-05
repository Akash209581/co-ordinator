const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  participantId: {
    type: String,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Participant name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  college: {
    type: String,
    required: [true, 'College name is required'],
    trim: true
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true
  },
  year: {
    type: String,
    required: [true, 'Academic year is required'],
    enum: ['1st', '2nd', '3rd', '4th', 'PG']
  },
  rollNumber: {
    type: String,
    required: [true, 'Roll number is required'],
    trim: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event is required']
  },
  registrationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'waitlisted'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentAmount: {
    type: Number,
    default: 0
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  paymentDate: {
    type: Date,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer'],
    default: 'cash'
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coordinator',
    default: null
  },
  paymentNotes: {
    type: String,
    maxlength: [200, 'Payment notes cannot exceed 200 characters']
  },
  paymentId: {
    type: String,
    default: null
  },
  additionalInfo: {
    type: String,
    maxlength: [500, 'Additional info cannot exceed 500 characters']
  },
  teamMembers: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true
    },
    rollNumber: {
      type: String,
      required: true,
      trim: true
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Generate unique participant ID
participantSchema.pre('save', async function(next) {
  if (!this.participantId) {
    const year = new Date().getFullYear().toString().slice(-2); // Last 2 digits of year
    const prefix = 'MH' + year;
    
    // Find the last participant ID for this year
    const lastParticipant = await this.constructor.findOne(
      { participantId: { $regex: `^${prefix}` } },
      {},
      { sort: { participantId: -1 } }
    );
    
    let nextNumber = 1;
    if (lastParticipant) {
      const lastNumber = parseInt(lastParticipant.participantId.slice(4));
      nextNumber = lastNumber + 1;
    }
    
    // Format: MH26XXXXXX (6 digits with leading zeros)
    this.participantId = prefix + nextNumber.toString().padStart(6, '0');
  }
  next();
});

// Virtual for formatted payment amount
participantSchema.virtual('formattedPaymentAmount').get(function() {
  return this.paymentAmount ? `₹${this.paymentAmount.toLocaleString('en-IN')}` : '₹0';
});

// Index for better query performance
participantSchema.index({ eventId: 1, registrationStatus: 1 });
participantSchema.index({ email: 1 });
participantSchema.index({ participantId: 1 });
participantSchema.index({ paymentStatus: 1 });
participantSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('Participant', participantSchema, 'test.participants');