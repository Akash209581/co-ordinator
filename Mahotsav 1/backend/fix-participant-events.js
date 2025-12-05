const mongoose = require('mongoose');
require('dotenv').config();

const Participant = require('./models/Participant');
const Event = require('./models/Event');

async function fixParticipantEvents() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all participants without eventId
    const participantsWithoutEvent = await Participant.find({ 
      $or: [
        { eventId: null },
        { eventId: { $exists: false } }
      ]
    });

    console.log(`\n📊 Found ${participantsWithoutEvent.length} participants without events`);

    if (participantsWithoutEvent.length === 0) {
      console.log('✅ All participants have events assigned!');
      await mongoose.connection.close();
      return;
    }

    // Get all available events
    const events = await Event.find();
    console.log(`\n📋 Available events in database:`);
    events.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.title} (ID: ${event._id})`);
    });

    if (events.length === 0) {
      console.log('\n❌ No events found! Please create events first.');
      await mongoose.connection.close();
      return;
    }

    // You can manually assign a default event here
    // For example, assign the first event to all participants without events:
    console.log('\n⚠️  To fix this issue, you need to:');
    console.log('1. Run this script with manual assignment, OR');
    console.log('2. Manually update participants in MongoDB Compass/Atlas');
    console.log('\nParticipants without events:');
    
    participantsWithoutEvent.slice(0, 10).forEach(p => {
      console.log(`  - ${p.participantId}: ${p.name} (${p.email})`);
    });

    if (participantsWithoutEvent.length > 10) {
      console.log(`  ... and ${participantsWithoutEvent.length - 10} more`);
    }

    // Uncomment the following lines to assign the first event to all participants:
    /*
    const defaultEvent = events[0];
    console.log(`\n🔧 Assigning all participants to event: ${defaultEvent.title}`);
    
    for (const participant of participantsWithoutEvent) {
      participant.eventId = defaultEvent._id;
      participant.paymentAmount = defaultEvent.registrationFee;
      await participant.save();
      console.log(`  ✅ Updated ${participant.participantId}`);
    }
    
    console.log(`\n✅ Successfully assigned ${participantsWithoutEvent.length} participants to ${defaultEvent.title}`);
    */

    await mongoose.connection.close();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixParticipantEvents();
