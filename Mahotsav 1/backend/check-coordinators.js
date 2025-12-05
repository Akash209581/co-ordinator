require('dotenv').config();
const mongoose = require('mongoose');

async function checkCoordinators() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const coordinators = await db.collection('coordinators').find({}).toArray();
    
    console.log(`Total coordinators: ${coordinators.length}`);
    
    if (coordinators.length > 0) {
      console.log('\nSample coordinator:');
      console.log('Username:', coordinators[0].username);
      console.log('First Name:', coordinators[0].firstName);
      console.log('Role:', coordinators[0].role);
      console.log('Has Password:', !!coordinators[0].password);
    } else {
      console.log('No coordinators found! Creating a test coordinator...');
      
      // Create a test coordinator
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await db.collection('coordinators').insertOne({
        username: 'admin',
        firstName: 'Test',
        lastName: 'Administrator', 
        email: 'admin@test.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('✅ Created test coordinator: admin/admin123');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCoordinators();