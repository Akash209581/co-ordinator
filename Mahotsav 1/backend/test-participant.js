const mongoose = require('mongoose');
require('dotenv').config();

const Participant = require('./models/Participant');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    
    // Get first 5 participants to check their structure
    const participants = await Participant.find().limit(5);
    
    console.log(`\nFound ${participants.length} participants:\n`);
    
    for (const p of participants) {
      console.log('==========================================');
      console.log('Participant ID:', p.participantId);
      console.log('Name:', p.name);
      console.log('Email:', p.email);
      console.log('EventId:', p.eventId);
      console.log('EventId Type:', typeof p.eventId);
      console.log('EventId exists?', p.eventId ? 'YES' : 'NO');
      console.log('Payment Status:', p.paymentStatus);
      console.log('Payment Amount:', p.paymentAmount);
      console.log('Paid Amount:', p.paidAmount);
      
      // Try to populate eventId
      if (p.eventId) {
        await p.populate('eventId');
        console.log('Event Title:', p.eventId?.title || 'FAILED TO POPULATE');
      }
      console.log('==========================================\n');
    }
    
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
