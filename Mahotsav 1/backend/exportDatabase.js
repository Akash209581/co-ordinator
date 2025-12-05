const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const Coordinator = require('./models/Coordinator');
const Event = require('./models/Event');
const Participant = require('./models/Participant');
require('dotenv').config();

// Database Export Utility
const exportDatabase = async () => {
  try {
    console.log('📤 Starting database export to JSON...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    // Fetch all data from collections
    console.log('📊 Fetching data from collections...');
    
    const [coordinators, events, participants] = await Promise.all([
      Coordinator.find({}).select('-password').lean(),
      Event.find({}).populate('coordinatorId', 'firstName lastName username').lean(),
      Participant.find({}).populate('eventId', 'title category').lean()
    ]);

    // Calculate statistics
    const stats = {
      totalCoordinators: coordinators.length,
      totalEvents: events.length,
      totalParticipants: participants.length,
      approvedParticipants: participants.filter(p => p.registrationStatus === 'approved').length,
      pendingParticipants: participants.filter(p => p.registrationStatus === 'pending').length,
      rejectedParticipants: participants.filter(p => p.registrationStatus === 'rejected').length,
      paidParticipants: participants.filter(p => p.paymentStatus === 'paid').length,
      publishedEvents: events.filter(e => e.status === 'published').length,
      draftEvents: events.filter(e => e.status === 'draft').length,
      completedEvents: events.filter(e => e.status === 'completed').length
    };

    // Calculate financial data
    const totalPrizeMoney = events.reduce((sum, event) => {
      return sum + (event.prizes?.reduce((prizeSum, prize) => prizeSum + (prize.amount || 0), 0) || 0);
    }, 0);

    // Category breakdown
    const categoryStats = events.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {});

    // Department breakdown from participants
    const departmentStats = participants.reduce((acc, participant) => {
      acc[participant.department] = (acc[participant.department] || 0) + 1;
      return acc;
    }, {});

    // Create comprehensive export object
    const exportData = {
      exportInfo: {
        exportDate: new Date().toISOString(),
        databaseName: 'mahotsav_events',
        collections: ['coordinators', 'events', 'participants'],
        totalRecords: coordinators.length + events.length + participants.length,
        source: 'MongoDB Atlas Live Database'
      },
      statistics: {
        ...stats,
        totalPrizeMoney,
        categoryBreakdown: categoryStats,
        departmentBreakdown: departmentStats
      },
      coordinators: coordinators.map(coord => ({
        id: coord._id,
        username: coord.username,
        email: coord.email,
        firstName: coord.firstName,
        lastName: coord.lastName,
        department: coord.department,
        role: coord.role,
        phoneNumber: coord.phoneNumber,
        isActive: coord.isActive,
        lastLogin: coord.lastLogin,
        createdAt: coord.createdAt,
        updatedAt: coord.updatedAt
      })),
      events: events.map(event => ({
        id: event._id,
        title: event.title,
        description: event.description,
        category: event.category,
        eventDate: event.eventDate,
        registrationStartDate: event.registrationStartDate,
        registrationEndDate: event.registrationEndDate,
        venue: event.venue,
        maxParticipants: event.maxParticipants,
        currentParticipants: event.currentParticipants,
        coordinator: event.coordinatorId ? {
          id: event.coordinatorId._id,
          name: `${event.coordinatorId.firstName} ${event.coordinatorId.lastName}`,
          username: event.coordinatorId.username
        } : null,
        status: event.status,
        rules: event.rules,
        prizes: event.prizes,
        requirements: event.requirements,
        contactInfo: event.contactInfo,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt
      })),
      participants: participants.map(participant => ({
        id: participant._id,
        name: participant.name,
        email: participant.email,
        phoneNumber: participant.phoneNumber,
        college: participant.college,
        department: participant.department,
        year: participant.year,
        rollNumber: participant.rollNumber,
        event: participant.eventId ? {
          id: participant.eventId._id,
          title: participant.eventId.title,
          category: participant.eventId.category
        } : null,
        registrationStatus: participant.registrationStatus,
        paymentStatus: participant.paymentStatus,
        paymentId: participant.paymentId,
        additionalInfo: participant.additionalInfo,
        teamMembers: participant.teamMembers,
        submittedAt: participant.submittedAt,
        createdAt: participant.createdAt,
        updatedAt: participant.updatedAt
      }))
    };

    // Save to multiple formats
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    
    // Full export
    const fullExportPath = path.join(__dirname, 'exports', `full-export-${timestamp}.json`);
    await fs.mkdir(path.dirname(fullExportPath), { recursive: true });
    await fs.writeFile(fullExportPath, JSON.stringify(exportData, null, 2));
    console.log(`✅ Full export saved: ${fullExportPath}`);

    // Statistics only
    const statsExportPath = path.join(__dirname, 'exports', `statistics-${timestamp}.json`);
    await fs.writeFile(statsExportPath, JSON.stringify({
      exportDate: exportData.exportInfo.exportDate,
      statistics: exportData.statistics,
      summary: {
        totalUsers: coordinators.length,
        totalEvents: events.length,
        totalParticipants: participants.length,
        revenue: `₹${totalPrizeMoney.toLocaleString()}`,
        topCategory: Object.keys(categoryStats).reduce((a, b) => categoryStats[a] > categoryStats[b] ? a : b),
        systemHealth: 'Operational'
      }
    }, null, 2));
    console.log(`✅ Statistics export saved: ${statsExportPath}`);

    // Events summary
    const eventsExportPath = path.join(__dirname, 'exports', `events-summary-${timestamp}.json`);
    await fs.writeFile(eventsExportPath, JSON.stringify({
      exportDate: exportData.exportInfo.exportDate,
      events: exportData.events.map(event => ({
        title: event.title,
        category: event.category,
        coordinator: event.coordinator?.name,
        participants: `${event.currentParticipants}/${event.maxParticipants}`,
        status: event.status,
        eventDate: event.eventDate,
        venue: event.venue,
        prizeMoney: event.prizes?.reduce((sum, prize) => sum + prize.amount, 0) || 0
      }))
    }, null, 2));
    console.log(`✅ Events summary saved: ${eventsExportPath}`);

    // Display summary
    console.log('\n📊 EXPORT SUMMARY:');
    console.log('=' * 50);
    console.log(`📅 Export Date: ${new Date().toLocaleString()}`);
    console.log(`👥 Coordinators: ${stats.totalCoordinators}`);
    console.log(`🎪 Events: ${stats.totalEvents} (${stats.publishedEvents} published)`);
    console.log(`🎯 Participants: ${stats.totalParticipants}`);
    console.log(`✅ Approved: ${stats.approvedParticipants}`);
    console.log(`⏳ Pending: ${stats.pendingParticipants}`);
    console.log(`❌ Rejected: ${stats.rejectedParticipants}`);
    console.log(`💰 Total Prize Money: ₹${totalPrizeMoney.toLocaleString()}`);
    console.log('=' * 50);

    console.log('\n📁 Files Generated:');
    console.log(`📄 Full Export: exports/full-export-${timestamp}.json`);
    console.log(`📊 Statistics: exports/statistics-${timestamp}.json`);
    console.log(`🎪 Events Summary: exports/events-summary-${timestamp}.json`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
};

// Handle script arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
📤 Database Export Utility

Usage: npm run export

This script will:
- Connect to MongoDB Atlas
- Export all collections to JSON files
- Generate statistics and summaries
- Save files in exports/ directory

Files generated:
- full-export-[date].json     Complete database dump
- statistics-[date].json      Key metrics and stats
- events-summary-[date].json  Events overview

Options:
  --help, -h    Show this help message

Example:
  npm run export
  `);
  process.exit(0);
}

exportDatabase();