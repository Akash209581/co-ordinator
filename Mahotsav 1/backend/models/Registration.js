const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  registerId: {
    type: String,
    unique: true
  },
  userId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  college: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  year: {
    type: String,
    trim: true
  },
  rollNumber: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other']
  },
  userType: {
    type: String,
    enum: ['visitor', 'participant'],
    default: 'visitor'
  },
  participationType: {
    type: String,
    enum: ['none', 'sports', 'cultural', 'both'],
    default: 'none'
  },
  teamMembers: [{
    name: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    department: {
      type: String,
      trim: true
    },
    year: {
      type: String,
      trim: true
    },
    rollNumber: {
      type: String,
      trim: true
    }
  }],
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'pending', 'failed'],
    default: 'unpaid'
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
    enum: ['cash', 'upi', 'card', 'bank_transfer'],
    default: null
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
  transactionId: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'registrations'
});

// Generate unique registration ID
registrationSchema.pre('save', async function(next) {
  if (!this.registerId) {
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = 'REG' + year;
    
    const lastRegistration = await this.constructor.findOne(
      { registerId: { $regex: `^${prefix}` } },
      {},
      { sort: { registerId: -1 } }
    );
    
    let nextNumber = 1;
    if (lastRegistration) {
      const lastNumber = parseInt(lastRegistration.registerId.slice(5));
      nextNumber = lastNumber + 1;
    }
    
    this.registerId = prefix + nextNumber.toString().padStart(6, '0');
  }
  next();
});

// Index for better query performance
registrationSchema.index({ email: 1 });
registrationSchema.index({ registerId: 1 });
registrationSchema.index({ userId: 1 });
registrationSchema.index({ paymentStatus: 1 });
registrationSchema.index({ userType: 1 });
registrationSchema.index({ participationType: 1 });
registrationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Registration', registrationSchema);
