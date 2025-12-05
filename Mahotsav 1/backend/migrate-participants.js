require('dotenv').config();
const mongoose = require('mongoose');

async function migrateParticipants() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Check participants in regular participants collection
    const regularParticipants = await db.collection('participants').find({}).toArray();
    console.log(`Participants in 'participants' collection: ${regularParticipants.length}`);
    
    // Check participants in test.participants collection
    const testParticipants = await db.collection('test.participants').find({}).toArray();
    console.log(`Participants in 'test.participants' collection: ${testParticipants.length}`);
    
    if (regularParticipants.length > 0 && testParticipants.length === 0) {
      console.log('\nMigrating participants from "participants" to "test.participants"...');
      
      if (regularParticipants.length > 0) {
        await db.collection('test.participants').insertMany(regularParticipants);
        console.log(`✅ Migrated ${regularParticipants.length} participants to test.participants collection`);
      }
    }
    
    if (testParticipants.length > 0) {
      console.log('\nSample participant from test.participants:');
      console.log('Name:', testParticipants[0].name);
      console.log('Email:', testParticipants[0].email);
      console.log('ID:', testParticipants[0]._id);
      console.log('Participant ID field:', testParticipants[0].participantId);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

migrateParticipants();