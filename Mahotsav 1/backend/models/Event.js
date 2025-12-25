const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    required: [true, 'Event category is required'],
    enum: ['cultural', 'technical', 'sports', 'literary', 'art', 'music', 'dance', 'drama', 'other']
  },
  eventDate: {
    type: Date,
    required: [true, 'Event date is required']
  },
  registrationStartDate: {
    type: Date,
    required: [true, 'Registration start date is required']
  },
  registrationEndDate: {
    type: Date,
    required: [true, 'Registration end date is required']
  },
  venue: {
    type: String,
    required: [true, 'Venue is required'],
    trim: true
  },
  maxParticipants: {
    type: Number,
    required: [true, 'Maximum participants limit is required'],
    min: [1, 'At least 1 participant is required']
  },
  currentParticipants: {
    type: Number,
    default: 0
  },
  coordinatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coordinator',
    required: [true, 'Coordinator is required']
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'ongoing', 'completed', 'cancelled'],
    default: 'draft'
  },
  rules: [{
    type: String,
    trim: true
  }],
  prizes: [{
    position: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    description: String
  }],
  requirements: [{
    type: String,
    trim: true
  }],
  contactInfo: {
    email: String,
    phone: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better query performance
eventSchema.index({ eventDate: 1, status: 1 });
eventSchema.index({ category: 1, status: 1 });
eventSchema.index({ coordinatorId: 1 });

module.exports = mongoose.model('Event', eventSchema, 'events');