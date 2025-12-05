const mongoose = require('mongoose');
const Coordinator = require('./models/Coordinator');
require('dotenv').config();

const seedCoordinator = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    // Check if coordinator already exists
    const existingCoordinator = await Coordinator.findOne({ username: 'admin' });
    
    if (existingCoordinator) {
      console.log('❌ Default coordinator already exists');
      process.exit(0);
    }

    // Create default coordinator
    const defaultCoordinator = new Coordinator({
      username: 'admin',
      email: 'admin@mahotsav.com',
      password: 'admin123',
      firstName: 'System',
      lastName: 'Administrator',
      department: 'IT',
      role: 'admin',
      phoneNumber: '+91-9876543210',
      isActive: true
    });

    await defaultCoordinator.save();

    console.log('✅ Default coordinator created successfully');
    console.log('📋 Login Credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   Email: admin@mahotsav.com');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding coordinator:', error);
    process.exit(1);
  }
};

seedCoordinator();