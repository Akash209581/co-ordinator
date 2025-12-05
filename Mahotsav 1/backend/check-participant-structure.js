require('dotenv').config();
const mongoose = require('mongoose');

async function checkParticipant() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const participant = await db.collection('test.participants').findOne({});
    
    console.log('Sample participant structure:');
    if (participant) {
      console.log('Fields:', Object.keys(participant));
      console.log('Name:', participant.name);
      console.log('Email:', participant.email);
      console.log('Phone field:', participant.phoneNumber || participant.phone);
      console.log('ID:', participant._id);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkParticipant();