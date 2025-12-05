const mongoose = require('mongoose');
require('dotenv').config();

const Participant = require('./models/Participant');
const Coordinator = require('./models/Coordinator');

async function checkPayments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all coordinators
    const coordinators = await Coordinator.find();
    console.log('📋 Coordinators in database:');
    coordinators.forEach(coord => {
      console.log(`  - ${coord.name} (${coord.username}) - ID: ${coord._id}`);
    });

    // Get all participants with payment data
    const participants = await Participant.find({
      $or: [
        { processedBy: { $ne: null } },
        { paymentStatus: 'paid' },
        { paidAmount: { $gt: 0 } }
      ]
    }).populate('processedBy', 'name username');

    console.log(`\n💰 Found ${participants.length} participants with payment data:\n`);

    for (const p of participants) {
      console.log('==========================================');
      console.log('Participant ID:', p.participantId);
      console.log('Name:', p.name);
      console.log('EventId:', p.eventId ? p.eventId : 'NULL/MISSING ❌');
      console.log('Payment Status:', p.paymentStatus);
      console.log('Paid Amount:', p.paidAmount);
      console.log('Payment Date:', p.paymentDate);
      console.log('Processed By:', p.processedBy ? `${p.processedBy.name} (ID: ${p.processedBy._id})` : 'NOT SET');
      console.log('==========================================\n');
    }

    // Check participants with valid eventId AND processedBy
    const validPayments = await Participant.find({
      eventId: { $ne: null, $exists: true },
      processedBy: { $ne: null, $exists: true }
    });

    console.log(`\n✅ Participants with BOTH valid eventId AND processedBy: ${validPayments.length}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkPayments();
