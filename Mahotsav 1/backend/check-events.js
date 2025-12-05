require('dotenv').config();
const mongoose = require('mongoose');

async function checkEvents() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Check events in regular events collection
    const regularEvents = await db.collection('events').find({}).toArray();
    console.log(`Events in 'events' collection: ${regularEvents.length}`);
    
    // Check events in test.events collection
    const testEvents = await db.collection('test.events').find({}).toArray();
    console.log(`Events in 'test.events' collection: ${testEvents.length}`);
    
    if (regularEvents.length > 0 && testEvents.length === 0) {
      console.log('\nMigrating events from "events" to "test.events"...');
      
      if (regularEvents.length > 0) {
        await db.collection('test.events').insertMany(regularEvents);
        console.log(`✅ Migrated ${regularEvents.length} events to test.events collection`);
      }
    }
    
    if (testEvents.length > 0) {
      console.log('\nSample event from test.events:');
      console.log('Title:', testEvents[0].title);
      console.log('Category:', testEvents[0].category);
      console.log('Status:', testEvents[0].status);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkEvents();