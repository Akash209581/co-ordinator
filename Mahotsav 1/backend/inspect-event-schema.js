const mongoose = require('mongoose');
require('dotenv').config();

async function inspectEventSchema() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected\n');
    
    const db = mongoose.connection.db;
    const eventsCollection = db.collection('events');
    
    // Get one event to see its actual structure
    const sampleEvent = await eventsCollection.findOne({});
    
    console.log('📋 Actual Event Document Structure:');
    console.log(JSON.stringify(sampleEvent, null, 2));
    
    console.log('\n📊 Field Names in Event:');
    if (sampleEvent) {
      Object.keys(sampleEvent).forEach(key => {
        console.log(`  - ${key}: ${typeof sampleEvent[key]}`);
      });
    }
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

inspectEventSchema();
