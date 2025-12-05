const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const Coordinator = require('./models/Coordinator');
const Event = require('./models/Event');
const Participant = require('./models/Participant');
require('dotenv').config();

// Enhanced seeding script with comprehensive sample data
const seedDatabase = async () => {
  try {
    console.log('🚀 Starting comprehensive database seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    // Read sample data from JSON file (with payment information)
    const dataPath = path.join(__dirname, 'data', 'paymentSampleData.json');
    const jsonData = await fs.readFile(dataPath, 'utf8');
    const sampleData = JSON.parse(jsonData);

    console.log('📄 Sample data loaded successfully');

    // Clear existing data (optional - comment out in production)
    console.log('🧹 Clearing existing data...');
    await Coordinator.deleteMany({});
    await Event.deleteMany({});
    await Participant.deleteMany({});
    console.log('✅ Existing data cleared');

    // Seed Coordinators
    console.log('👥 Seeding coordinators...');
    const coordinators = [];
    for (const coordData of sampleData.coordinators) {
      const coordinator = new Coordinator(coordData);
      await coordinator.save();
      coordinators.push(coordinator);
      console.log(`   ✓ Created coordinator: ${coordinator.firstName} ${coordinator.lastName} (${coordinator.username})`);
    }

    // Seed Events with coordinator references
    console.log('🎪 Seeding events...');
    const events = [];
    for (let i = 0; i < sampleData.events.length; i++) {
      const eventData = sampleData.events[i];
      
      // Assign coordinator based on event category
      let assignedCoordinator;
      switch (eventData.category) {
        case 'cultural':
        case 'art':
        case 'music':
          assignedCoordinator = coordinators.find(c => c.username === 'cultural_coord');
          break;
        case 'technical':
          assignedCoordinator = coordinators.find(c => c.username === 'tech_coord');
          break;
        case 'sports':
          assignedCoordinator = coordinators.find(c => c.username === 'sports_coord');
          break;
        case 'literary':
          assignedCoordinator = coordinators.find(c => c.username === 'literary_coord');
          break;
        default:
          assignedCoordinator = coordinators.find(c => c.username === 'admin');
      }

      const event = new Event({
        ...eventData,
        coordinatorId: assignedCoordinator._id
      });
      
      await event.save();
      events.push(event);
      console.log(`   ✓ Created event: ${event.title} (${event.category})`);
    }

    // Seed Participants with event references
    console.log('🎯 Seeding participants...');
    for (let i = 0; i < sampleData.participants.length; i++) {
      const participantData = sampleData.participants[i];
      
      // Assign participant to corresponding event based on index/type
      let assignedEvent;
      switch (i) {
        case 0: // Dance participant
          assignedEvent = events.find(e => e.title.includes('Dance'));
          break;
        case 1: // Hackathon participant
          assignedEvent = events.find(e => e.title.includes('Hackathon'));
          break;
        case 2: // Cricket participant
          assignedEvent = events.find(e => e.title.includes('Cricket'));
          break;
        case 3: // Poetry participant
          assignedEvent = events.find(e => e.title.includes('Poetry'));
          break;
        case 4: // Art participant
          assignedEvent = events.find(e => e.title.includes('Art'));
          break;
        case 5: // Music participant
          assignedEvent = events.find(e => e.title.includes('Battle'));
          break;
        default:
          assignedEvent = events[0]; // Default to first event
      }

      const participant = new Participant({
        ...participantData,
        eventId: assignedEvent._id
      });
      
      await participant.save();
      console.log(`   ✓ Created participant: ${participant.name} for ${assignedEvent.title}`);
    }

    // Create additional random participants for better statistics
    console.log('📈 Creating additional participants for realistic data...');
    const names = [
      'Aditi Sharma', 'Rohit Verma', 'Sneha Patel', 'Karan Singh', 'Meera Joshi',
      'Aryan Kumar', 'Pooja Reddy', 'Nikhil Gupta', 'Riya Agarwal', 'Sanjay Rao',
      'Deepika Nair', 'Varun Malhotra', 'Anjali Iyer', 'Harsh Pandey', 'Shreya Das'
    ];
    
    const departments = ['CSE', 'ECE', 'ME', 'CE', 'EEE', 'IT', 'BT', 'CH'];
    const years = ['1st', '2nd', '3rd', '4th'];
    const colleges = ['Vignan University', 'GITAM University', 'Andhra University'];

    for (let i = 0; i < 30; i++) {
      const randomEvent = events[Math.floor(Math.random() * events.length)];
      const randomName = names[Math.floor(Math.random() * names.length)];
      const randomDept = departments[Math.floor(Math.random() * departments.length)];
      const randomYear = years[Math.floor(Math.random() * years.length)];
      const randomCollege = colleges[Math.floor(Math.random() * colleges.length)];
      
      const participant = new Participant({
        name: `${randomName} ${i + 100}`,
        email: `student${i + 100}@university.edu`,
        phoneNumber: `+91-98765${String(41000 + i).padStart(5, '0')}`,
        college: randomCollege,
        department: randomDept,
        year: randomYear,
        rollNumber: `${randomYear === '1st' ? '22' : randomYear === '2nd' ? '21' : randomYear === '3rd' ? '20' : '19'}${randomDept}${String(i + 100).padStart(3, '0')}`,
        eventId: randomEvent._id,
        registrationStatus: Math.random() > 0.2 ? 'approved' : Math.random() > 0.5 ? 'pending' : 'rejected',
        paymentStatus: Math.random() > 0.3 ? 'paid' : 'pending',
        additionalInfo: `Random participant ${i + 1} for testing purposes`
      });
      
      await participant.save();
      
      // Update event participant count
      await Event.findByIdAndUpdate(randomEvent._id, {
        $inc: { currentParticipants: participant.registrationStatus === 'approved' ? 1 : 0 }
      });
    }

    console.log('✅ Additional participants created');

    // Generate final statistics
    const finalStats = {
      coordinators: await Coordinator.countDocuments(),
      events: await Event.countDocuments(),
      participants: await Participant.countDocuments(),
      approvedParticipants: await Participant.countDocuments({ registrationStatus: 'approved' }),
      pendingParticipants: await Participant.countDocuments({ registrationStatus: 'pending' }),
      paidParticipants: await Participant.countDocuments({ paymentStatus: 'paid' })
    };

    console.log('\n📊 DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('=' * 50);
    console.log(`👥 Coordinators: ${finalStats.coordinators}`);
    console.log(`🎪 Events: ${finalStats.events}`);
    console.log(`🎯 Total Participants: ${finalStats.participants}`);
    console.log(`✅ Approved Participants: ${finalStats.approvedParticipants}`);
    console.log(`⏳ Pending Participants: ${finalStats.pendingParticipants}`);
    console.log(`💰 Paid Participants: ${finalStats.paidParticipants}`);
    console.log('=' * 50);

    console.log('\n🔐 LOGIN CREDENTIALS:');
    console.log('Admin: admin / admin123');
    console.log('Cultural Coordinator: cultural_coord / cultural123');
    console.log('Tech Coordinator: tech_coord / tech123');
    console.log('Sports Coordinator: sports_coord / sports123');
    console.log('Literary Coordinator: literary_coord / literary123');

    console.log('\n🌐 Next Steps:');
    console.log('1. Start backend server: npm start');
    console.log('2. Start frontend server: npm start (in frontend directory)');
    console.log('3. Visit http://localhost:3000');
    console.log('4. Login with any coordinator credentials');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Handle script arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🌱 Database Seeding Script

Usage: npm run seed:full

This script will:
- Clear existing data (coordinators, events, participants)
- Import comprehensive sample data from JSON file
- Create realistic test data for development
- Display final statistics and login credentials

Options:
  --help, -h    Show this help message

Environment Variables Required:
  MONGODB_URI   MongoDB connection string
  
Example:
  npm run seed:full
  `);
  process.exit(0);
}

seedDatabase();