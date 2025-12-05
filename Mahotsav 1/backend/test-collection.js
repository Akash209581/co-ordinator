const mongoose = require('mongoose');
require('dotenv').config();

const testTeamCollection = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    const db = mongoose.connection.db;
    
    // List all collections to verify 'team' collection exists
    const collections = await db.listCollections().toArray();
    console.log('📋 Available collections:');
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
    // Check current teams in 'team' collection
    const teamCollection = db.collection('team');
    const teamCount = await teamCollection.countDocuments();
    console.log(`\n🏆 Teams in 'team' collection: ${teamCount}`);
    
    if (teamCount > 0) {
      const teams = await teamCollection.find({}).toArray();
      teams.forEach((team, index) => {
        console.log(`   ${index + 1}. ${team.teamName} - ${team.eventName} (${team.status})`);
      });
    }

    console.log('✅ Collection test completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing collection:', error);
    process.exit(1);
  }
};

testTeamCollection();