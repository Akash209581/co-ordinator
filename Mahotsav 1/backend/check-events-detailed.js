const mongoose = require('mongoose');
const Event = require('./models/Event');
require('dotenv').config();

async function checkEvents() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
    console.log('');
    
    // Check all events
    console.log('='.repeat(80));
    console.log('📊 ALL EVENTS IN DATABASE:');
    console.log('='.repeat(80));
    
    const allEvents = await Event.find({})
      .select('_id title category venue eventDate maxParticipants currentParticipants')
      .lean();
    
    console.log(`\nTotal events: ${allEvents.length}\n`);
    
    if (allEvents.length === 0) {
      console.log('❌ No events found in database!');
      console.log('💡 You may need to seed events first.');
    } else {
      allEvents.forEach((event, index) => {
        console.log(`Event ${index + 1}:`);
        console.log(`  ID: ${event._id}`);
        console.log(`  Title: ${event.title}`);
        console.log(`  Category: ${event.category}`);
        console.log(`  Venue: ${event.venue}`);
        console.log(`  Date: ${event.eventDate}`);
        console.log(`  Max Participants: ${event.maxParticipants}`);
        console.log(`  Current Participants: ${event.currentParticipants || 0}`);
        console.log('---');
      });
    }
    
    // Check cultural events specifically
    console.log('\n' + '='.repeat(80));
    console.log('🎭 CULTURAL EVENTS:');
    console.log('='.repeat(80));
    
    const culturalEvents = await Event.find({
      category: { $regex: new RegExp('^cultural$', 'i') }
    })
      .select('_id title category venue eventDate')
      .lean();
    
    console.log(`\nFound ${culturalEvents.length} cultural events:\n`);
    
    if (culturalEvents.length === 0) {
      console.log('❌ No cultural events found!');
      console.log('💡 Check if events have category="cultural" (case-sensitive)');
      console.log('\nAvailable categories in database:');
      const categories = [...new Set(allEvents.map(e => e.category))];
      categories.forEach(cat => console.log(`  - ${cat}`));
    } else {
      culturalEvents.forEach((event, index) => {
        console.log(`${index + 1}. ${event.title}`);
        console.log(`   ID: ${event._id}`);
        console.log(`   Category: ${event.category}`);
        console.log(`   Venue: ${event.venue}`);
        console.log('');
      });
    }
    
    // Check sports events
    console.log('='.repeat(80));
    console.log('⚽ SPORTS EVENTS:');
    console.log('='.repeat(80));
    
    const sportsEvents = await Event.find({
      category: { $regex: new RegExp('^sports$', 'i') }
    })
      .select('_id title category')
      .lean();
    
    console.log(`\nFound ${sportsEvents.length} sports events\n`);
    
    await mongoose.connection.close();
    console.log('✅ Connection closed\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkEvents();
