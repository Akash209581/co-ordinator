const mongoose = require('mongoose');
const Participant = require('./models/Participant');
const Event = require('./models/Event');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mahotsavvignan2025_db_user:mYzQ87sgJ3vKbh0L@events.nghtwjg.mongodb.net/?appName=Events';

// Sample data for generating participants
const firstNames = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Karan', 'Pooja', 'Rohan', 'Divya', 'Arjun', 'Kavya', 'Aditya', 'Meera', 'Sanjay', 'Nisha', 'Rajesh', 'Swati', 'Manish', 'Riya'];
const lastNames = ['Kumar', 'Sharma', 'Patel', 'Reddy', 'Singh', 'Verma', 'Gupta', 'Rao', 'Nair', 'Joshi', 'Desai', 'Mehta', 'Iyer', 'Chopra', 'Malhotra', 'Bansal', 'Agarwal', 'Pillai', 'Das', 'Bose'];
const departments = ['CSE', 'ECE', 'MECH', 'CIVIL', 'EEE', 'IT', 'CSIT', 'AI&DS', 'CSE(AI&ML)'];
const colleges = ['Vignan University', 'JNTU Kakinada', 'Andhra University', 'NIT Warangal', 'VIT Vellore'];
const years = ['1st', '2nd', '3rd', '4th', 'PG'];

async function seedUnpaidParticipants() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    // Get all events to randomly assign participants
    let events = await Event.find();
    
    // If no events exist, create a few sample events
    if (events.length === 0) {
      console.log('📝 No events found. Creating sample events...');
      
      const sampleEvents = [
        {
          eventId: 'EVT001',
          title: 'Dance Competition',
          description: 'Classical and Modern Dance Competition',
          category: 'cultural',
          registrationFee: 200,
          maxParticipants: 100,
          venue: 'Main Auditorium',
          eventDate: new Date('2025-12-15')
        },
        {
          eventId: 'EVT002',
          title: 'Coding Marathon',
          description: '24-hour Coding Competition',
          category: 'technical',
          registrationFee: 150,
          maxParticipants: 50,
          venue: 'Computer Lab',
          eventDate: new Date('2025-12-16')
        },
        {
          eventId: 'EVT003',
          title: 'Cricket Tournament',
          description: 'Inter-College Cricket Tournament',
          category: 'sports',
          registrationFee: 500,
          maxParticipants: 150,
          venue: 'Cricket Ground',
          eventDate: new Date('2025-12-17')
        },
        {
          eventId: 'EVT004',
          title: 'Debate Competition',
          description: 'English Debate Competition',
          category: 'literary',
          registrationFee: 100,
          maxParticipants: 40,
          venue: 'Seminar Hall',
          eventDate: new Date('2025-12-18')
        },
        {
          eventId: 'EVT005',
          title: 'Photography Contest',
          description: 'Theme-based Photography Contest',
          category: 'cultural',
          registrationFee: 150,
          maxParticipants: 60,
          venue: 'Exhibition Hall',
          eventDate: new Date('2025-12-19')
        }
      ];

      events = await Event.insertMany(sampleEvents);
      console.log(`✅ Created ${events.length} sample events`);
    }

    console.log(`Found ${events.length} events in database`);

    // Get the highest existing participant ID number
    const lastParticipant = await Participant.findOne().sort({ participantId: -1 });
    let participantCounter = 1;
    
    if (lastParticipant && lastParticipant.participantId) {
      const match = lastParticipant.participantId.match(/MAH(\d+)/);
      if (match) {
        participantCounter = parseInt(match[1]) + 1;
      }
    }

    const participants = [];

    for (let i = 0; i < 20; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[i % lastNames.length];
      const name = `${firstName} ${lastName}`;
      const department = departments[i % departments.length];
      const college = colleges[i % colleges.length];
      const year = years[i % years.length];
      const randomEvent = events[i % events.length];
      
      // Generate participant ID
      const participantId = `MAH${String(participantCounter).padStart(4, '0')}`;
      participantCounter++;

      const participant = {
        participantId: participantId,
        name: name,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
        phoneNumber: `9${String(Math.floor(Math.random() * 900000000) + 100000000)}`,
        college: college,
        department: department,
        year: year,
        rollNumber: `${year.charAt(0)}${department}${String(Math.floor(Math.random() * 900) + 100)}`,
        eventId: randomEvent._id,
        registrationStatus: 'approved', // Approved but not paid
        paymentStatus: 'pending', // Unpaid
        paymentAmount: randomEvent.registrationFee,
        paidAmount: 0,
        teamMembers: []
      };

      participants.push(participant);
    }

    // Insert all participants
    const result = await Participant.insertMany(participants);
    
    console.log('\n✅ Successfully created 20 unpaid participants:');
    console.log('================================================');
    result.forEach((p, index) => {
      console.log(`${index + 1}. ${p.participantId} - ${p.name} - ${p.eventId ? 'Event Assigned' : 'No Event'} - Payment: ${p.paymentStatus}`);
    });
    console.log('================================================');
    console.log(`\n📊 Total participants created: ${result.length}`);
    console.log('💰 All participants are marked as UNPAID (pending payment)');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding unpaid participants:', error);
    process.exit(1);
  }
}

// Run the seed function
seedUnpaidParticipants();
