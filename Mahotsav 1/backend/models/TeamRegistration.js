const mongoose = require('mongoose');

const teamRegistrationSchema = new mongoose.Schema({
  teamName: {
    type: String,
    required: true,
    trim: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  eventName: {
    type: String,
    required: true
  },
  teamLeader: {
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Participant',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phoneNumber: {
      type: String,
      required: true
    }
  },
  teamMembers: [{
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Participant',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phoneNumber: {
      type: String,
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending'
    },
    paymentId: {
      type: String
    }
  }],
  maxTeamSize: {
    type: Number,
    required: true,
    default: 4
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['forming', 'complete', 'registered'],
    default: 'forming'
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  paymentComplete: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'test.teams'
});

// Index for efficient queries
teamRegistrationSchema.index({ eventId: 1, teamName: 1 }, { unique: true });
teamRegistrationSchema.index({ 'teamLeader.participantId': 1 });
teamRegistrationSchema.index({ 'teamMembers.participantId': 1 });

// Middleware to check if all members have paid before allowing registration
teamRegistrationSchema.pre('save', function(next) {
  if (this.status === 'registered') {
    const allPaid = this.teamMembers.every(member => member.paymentStatus === 'paid');
    if (!allPaid) {
      return next(new Error('All team members must complete payment before registration'));
    }
    this.paymentComplete = true;
  }
  next();
});

// Method to add team member
teamRegistrationSchema.methods.addTeamMember = function(memberData) {
  if (this.teamMembers.length >= this.maxTeamSize) {
    throw new Error('Team is already full');
  }
  
  // Check if participant is already in the team
  const existingMember = this.teamMembers.find(
    member => member.participantId.toString() === memberData.participantId.toString()
  );
  
  if (existingMember) {
    throw new Error('Participant is already a team member');
  }
  
  this.teamMembers.push(memberData);
  return this.save();
};

// Method to remove team member
teamRegistrationSchema.methods.removeTeamMember = function(participantId) {
  this.teamMembers = this.teamMembers.filter(
    member => member.participantId.toString() !== participantId.toString()
  );
  return this.save();
};

// Method to update member payment status
teamRegistrationSchema.methods.updateMemberPayment = function(participantId, paymentStatus, paymentId = null) {
  const member = this.teamMembers.find(
    member => member.participantId.toString() === participantId.toString()
  );
  
  if (!member) {
    throw new Error('Team member not found');
  }
  
  member.paymentStatus = paymentStatus;
  if (paymentId) {
    member.paymentId = paymentId;
  }
  
  // Update paid amount
  const paidMembers = this.teamMembers.filter(member => member.paymentStatus === 'paid').length;
  this.paidAmount = paidMembers * (this.totalAmount / this.maxTeamSize);
  
  // Check if all payments are complete
  const allPaid = this.teamMembers.every(member => member.paymentStatus === 'paid');
  if (allPaid && this.teamMembers.length === this.maxTeamSize) {
    this.status = 'complete';
    this.paymentComplete = true;
  }
  
  return this.save();
};

module.exports = mongoose.model('TeamRegistration', teamRegistrationSchema);