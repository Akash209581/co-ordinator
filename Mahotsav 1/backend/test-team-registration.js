// Test file for Team Registration functionality
const mongoose = require('mongoose');
const TeamRegistration = require('./models/TeamRegistration');
const Event = require('./models/Event');

// Connect to test database
mongoose.connect('mongodb://localhost:27017/mahotsav_test');

async function testTeamRegistration() {
  try {
    console.log('Starting Team Registration Tests...');
    
    // Clear existing test data
    await TeamRegistration.deleteMany({});
    console.log('✓ Cleared existing team registrations');
    
    // Test 1: Create a team event
    const testEvent = new Event({
      name: 'Basketball Tournament',
      description: 'Inter-college basketball tournament',
      category: 'Sports',
      type: 'team',
      maxTeamSize: 5,
      minTeamSize: 3,
      date: new Date('2025-12-15'),
      time: '10:00 AM',
      venue: 'Sports Complex',
      coordinatorId: new mongoose.Types.ObjectId(),
      registrationFee: 500,
      registrationDeadline: new Date('2025-12-10')
    });
    
    await testEvent.save();
    console.log('✓ Created test team event:', testEvent.name);
    
    // Test 2: Create a team registration
    const teamRegistration = new TeamRegistration({
      teamName: 'Thunder Bolts',
      eventId: testEvent._id,
      eventName: testEvent.name,
      teamLeader: {
        participantId: new mongoose.Types.ObjectId(),
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890'
      },
      maxTeamSize: testEvent.maxTeamSize,
      totalAmount: testEvent.registrationFee * testEvent.maxTeamSize
    });
    
    await teamRegistration.save();
    console.log('✓ Created team registration:', teamRegistration.teamName);
    
    // Test 3: Add team members
    await teamRegistration.addTeamMember({
      participantId: new mongoose.Types.ObjectId(),
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '1234567891',
      paymentStatus: 'pending'
    });
    
    console.log('✓ Added team member. Current team size:', teamRegistration.teamMembers.length);
    
    // Test 4: Update payment status
    for (let member of teamRegistration.teamMembers) {
      await teamRegistration.updateMemberPayment(member.participantId, 'paid', `payment_${Date.now()}`);
    }
    
    console.log('✓ Updated payment status for all members');
    console.log('✓ Team status:', teamRegistration.status);
    
    // Test 5: Register team
    teamRegistration.status = 'registered';
    await teamRegistration.save();
    console.log('✓ Team registered successfully');
    
    console.log('\n=== All Tests Completed Successfully! ===');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    mongoose.connection.close();
  }
}

// Run the tests
testTeamRegistration();