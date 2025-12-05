const mongoose = require('mongoose');
require('dotenv').config();

const migrateTeams = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    const db = mongoose.connection.db;
    
    // Check if eventsregistration collection exists and has data
    const eventsRegistrationExists = await db.listCollections({name: 'eventsregistration'}).hasNext();
    
    if (eventsRegistrationExists) {
      const eventsRegistration = await db.collection('eventsregistration').find({}).toArray();
      
      if (eventsRegistration.length > 0) {
        console.log(`🔄 Found ${eventsRegistration.length} teams in eventsregistration collection`);
        
        // Copy data to team collection
        await db.collection('team').insertMany(eventsRegistration);
        console.log(`✅ Migrated ${eventsRegistration.length} teams to 'team' collection`);
        
        // Optionally remove old collection (commented out for safety)
        // await db.collection('eventsregistration').drop();
        // console.log('🗑️ Removed old eventsregistration collection');
      } else {
        console.log('ℹ️ No teams found in eventsregistration collection');
      }
    } else {
      console.log('ℹ️ No eventsregistration collection found');
    }

    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
};

migrateTeams();