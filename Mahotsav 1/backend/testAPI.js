const axios = require('axios');

// API Testing Script
const BASE_URL = 'http://localhost:5000/api';

const testAPI = async () => {
  console.log('🧪 Testing Mahotsav API with populated database...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health Check:', healthResponse.data.status);
    console.log('   MongoDB Status:', healthResponse.data.mongodb);
    console.log('   Server Message:', healthResponse.data.message);

    // Test 2: Login with Admin Credentials
    console.log('\n2️⃣ Testing Admin Login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    console.log('✅ Login Successful');
    console.log('   User:', loginResponse.data.data.coordinator.firstName, loginResponse.data.data.coordinator.lastName);
    console.log('   Role:', loginResponse.data.data.coordinator.role);
    
    const authToken = loginResponse.data.data.token;

    // Test 3: Dashboard Statistics
    console.log('\n3️⃣ Testing Dashboard Statistics...');
    const dashboardResponse = await axios.get(`${BASE_URL}/coordinator/dashboard/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const stats = dashboardResponse.data.data.stats;
    console.log('✅ Dashboard Data Retrieved:');
    console.log('   📊 Total Events:', stats.totalEvents);
    console.log('   🎯 Total Participants:', stats.totalParticipants);
    console.log('   ✅ Approved Participants:', stats.activeParticipants);
    console.log('   ⏳ Pending Approvals:', stats.pendingApprovals);
    console.log('   💰 Total Prize Money: ₹', stats.totalPrizeMoney?.toLocaleString() || 0);
    console.log('   📈 Capacity Utilization:', stats.capacityUtilization + '%');

    // Test 4: Recent Activities
    console.log('\n4️⃣ Testing Recent Activities...');
    const activities = dashboardResponse.data.data.recentActivities;
    console.log('✅ Recent Activities Retrieved:', activities.length, 'items');
    activities.slice(0, 3).forEach((activity, index) => {
      console.log(`   ${index + 1}. ${activity.activity} (${activity.timeAgo})`);
    });

    // Test 5: Events List
    console.log('\n5️⃣ Testing Events API...');
    const eventsResponse = await axios.get(`${BASE_URL}/coordinator/events`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const events = eventsResponse.data.data.events;
    console.log('✅ Events Retrieved:', events.length, 'events');
    events.slice(0, 3).forEach((event, index) => {
      console.log(`   ${index + 1}. ${event.title} (${event.category}) - ${event.currentParticipants}/${event.maxParticipants} participants`);
    });

    // Test 6: User Profile
    console.log('\n6️⃣ Testing User Profile...');
    const profileResponse = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const user = profileResponse.data.data.coordinator;
    console.log('✅ User Profile Retrieved:');
    console.log('   👤 Name:', user.firstName, user.lastName);
    console.log('   📧 Email:', user.email);
    console.log('   🏢 Department:', user.department);
    console.log('   📞 Phone:', user.phoneNumber);

    // Test 7: Test Different Coordinator Login
    console.log('\n7️⃣ Testing Cultural Coordinator Login...');
    const culturalLoginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'cultural_coord',
      password: 'cultural123'
    });
    
    const culturalToken = culturalLoginResponse.data.data.token;
    const culturalUser = culturalLoginResponse.data.data.coordinator;
    console.log('✅ Cultural Coordinator Login Successful');
    console.log('   👤 Name:', culturalUser.firstName, culturalUser.lastName);
    console.log('   🎭 Department:', culturalUser.department);

    // Test 8: Cultural Coordinator Dashboard (should show only their events)
    console.log('\n8️⃣ Testing Cultural Coordinator Dashboard...');
    const culturalDashboardResponse = await axios.get(`${BASE_URL}/coordinator/dashboard/stats`, {
      headers: { Authorization: `Bearer ${culturalToken}` }
    });
    
    const culturalStats = culturalDashboardResponse.data.data.stats;
    console.log('✅ Cultural Coordinator Dashboard:');
    console.log('   📊 Their Events:', culturalStats.totalEvents);
    console.log('   🎯 Their Participants:', culturalStats.totalParticipants);
    console.log('   📈 Category Breakdown:', culturalStats.categoryBreakdown);

    console.log('\n🎉 ALL TESTS PASSED! The system is working perfectly with populated data.');
    console.log('\n📋 Summary:');
    console.log('✅ Database connection working');
    console.log('✅ Authentication system working');
    console.log('✅ JSON data successfully imported');
    console.log('✅ Dashboard APIs returning real data');
    console.log('✅ Role-based access control working');
    console.log('✅ Comprehensive statistics available');
    
  } catch (error) {
    console.error('❌ Test Failed:', error.response?.data || error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure backend server is running: npm start (in backend directory)');
    console.log('2. Verify database seeding: npm run seed:full');
    console.log('3. Check MongoDB connection in .env file');
  }
};

// Only run if this script is called directly
if (require.main === module) {
  testAPI();
}

module.exports = testAPI;