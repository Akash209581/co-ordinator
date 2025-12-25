const mongoose = require('mongoose');
const TeamRegistration = require('./models/TeamRegistration');
require('dotenv').config();

async function checkTeams() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('Connected to MongoDB');
    
    // Get all teams
    const teams = await TeamRegistration.find({}).sort({ createdAt: -1 });
    
    console.log('\n=== ALL TEAMS IN DATABASE ===');
    console.log(`Total teams found: ${teams.length}\n`);
    
    teams.forEach((team, index) => {
      console.log(`Team ${index + 1}:`);
      console.log(`  Team ID: ${team.teamId}`);
      console.log(`  Team Name: ${team.teamName}`);
      console.log(`  Event Name: ${team.eventName}`);
      console.log(`  Team Leader: ${team.teamLeader.participantId} - ${team.teamLeader.name}`);
      console.log(`  Team Members:`);
      team.teamMembers.forEach((member, i) => {
        console.log(`    ${i + 1}. ${member.participantId} - ${member.name}`);
      });
      console.log(`  Status: ${team.status}`);
      console.log(`  Created: ${team.createdAt}`);
      console.log('---');
    });
    
    // Close connection
    await mongoose.connection.close();
    console.log('\nConnection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTeams();
