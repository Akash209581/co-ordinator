const mongoose = require('mongoose');
require('dotenv').config();

async function inspectDatabase() {
  try {
    console.log('\n🔍 Connecting to MongoDB...\n');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const connection = mongoose.connection;
    console.log('✅ Connected to MongoDB Atlas');
    console.log('📊 Database Name:', connection.db.databaseName);
    console.log('🌐 Connection String:', process.env.MONGODB_URI.replace(/:[^:@]+@/, ':****@'));
    console.log('\n' + '='.repeat(80));
    
    // List all collections
    console.log('\n📁 COLLECTIONS IN DATABASE:');
    const collections = await connection.db.listCollections().toArray();
    console.log(`Found ${collections.length} collections:\n`);
    
    for (const coll of collections) {
      const collectionName = coll.name;
      const count = await connection.db.collection(collectionName).countDocuments();
      console.log(`  📦 ${collectionName} - ${count} documents`);
    }
    
    console.log('\n' + '='.repeat(80));
    
    // Check teams/teamregistrations collection specifically
    console.log('\n🎯 TEAMS DATA LOCATION:');
    
    const teamsCollections = collections.filter(c => 
      c.name.toLowerCase().includes('team')
    );
    
    if (teamsCollections.length === 0) {
      console.log('❌ No teams collection found!');
      console.log('💡 This means teams are NOT being saved to the database yet.');
    } else {
      for (const teamColl of teamsCollections) {
        const collName = teamColl.name;
        const count = await connection.db.collection(collName).countDocuments();
        console.log(`\n✅ Found collection: "${collName}"`);
        console.log(`📊 Total teams: ${count}`);
        
        if (count > 0) {
          console.log(`\n🔍 Teams in "${collName}":\n`);
          const teams = await connection.db.collection(collName).find({}).toArray();
          
          teams.forEach((team, index) => {
            console.log(`\n  Team ${index + 1}:`);
            console.log(`    🆔 MongoDB _id: ${team._id}`);
            console.log(`    🎫 Team ID: ${team.teamId || 'N/A'}`);
            console.log(`    📝 Team Name: ${team.teamName || 'N/A'}`);
            console.log(`    🎪 Event Name: ${team.eventName || 'N/A'}`);
            console.log(`    👑 Team Leader: ${team.teamLeader?.participantId || 'N/A'} - ${team.teamLeader?.name || 'N/A'}`);
            console.log(`    👥 Team Members: ${team.teamMembers?.length || 0}`);
            if (team.teamMembers && team.teamMembers.length > 0) {
              team.teamMembers.forEach((member, i) => {
                console.log(`       ${i + 1}. ${member.participantId} - ${member.name}`);
              });
            }
            console.log(`    📅 Created: ${team.createdAt}`);
            console.log(`    ---`);
          });
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📍 HOW TO VIEW IN MONGODB ATLAS:');
    console.log('1. Go to: https://cloud.mongodb.com/');
    console.log('2. Login with your account');
    console.log('3. Click on your cluster: "Events"');
    console.log('4. Click "Browse Collections"');
    console.log(`5. Select database: "${connection.db.databaseName}"`);
    console.log('6. Look for collections containing "team" in the name');
    console.log('\n' + '='.repeat(80));
    
    await mongoose.connection.close();
    console.log('\n✅ Connection closed\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Common issues:');
    console.error('   - IP address not whitelisted in MongoDB Atlas');
    console.error('   - Incorrect connection string');
    console.error('   - Network connectivity issues');
    process.exit(1);
  }
}

inspectDatabase();
