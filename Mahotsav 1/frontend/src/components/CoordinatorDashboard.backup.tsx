import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './CoordinatorDashboard.css';

interface DashboardStats {
  totalEvents: number;
  activeParticipants: number;
  pendingApprovals: number;
  completedTasks: number;
  totalPayments?: number;
  totalAmount?: number;
  paidCount?: number;
  pendingCount?: number;
  collectionRate?: number;
}

interface ActivityItem {
  time: string;
  activity: string;
  status?: string;
  timestamp?: string;
}

interface Participant {
  participantId: string;
  name: string;
  email: string;
  phoneNumber: string;
  college: string;
  department: string;
  year: string;
  rollNumber: string;
  event: {
    title: string;
    registrationFee: number;
  };
  registrationStatus: string;
  paymentStatus: string;
  paymentAmount: number;
  paidAmount: number;
  paymentDate?: string;
  paymentMethod?: string;
  processedBy?: any;
  paymentNotes?: string;
  teamMembers?: any[];
}

interface PaymentProcessData {
  amount: number;
  method: 'cash' | 'card' | 'upi' | 'bank_transfer';
  notes: string;
}

const CoordinatorDashboard: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [coordinatorName, setCoordinatorName] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'payments' | 'search'>('dashboard');
  const [stats, setStats] = useState<DashboardStats>({
    totalEvents: 0,
    activeParticipants: 0,
    pendingApprovals: 0,
    completedTasks: 0
  });
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Payment management states
  const [searchId, setSearchId] = useState<string>('');
  const [searchedParticipant, setSearchedParticipant] = useState<Participant | null>(null);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>('');
  const [paymentData, setPaymentData] = useState<PaymentProcessData>({
    amount: 0,
    method: 'cash',
    notes: ''
  });
  const [processingPayment, setProcessingPayment] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string>('');
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Get user data
    const storedUsername = localStorage.getItem('username') || 'Coordinator';
    const coordinatorData = localStorage.getItem('coordinatorData');
    
    setUsername(storedUsername);
    
    if (coordinatorData) {
      const parsed = JSON.parse(coordinatorData);
      setCoordinatorName(`${parsed.firstName} ${parsed.lastName}`);
    }

    // Fetch dashboard data
    fetchDashboardData();
    fetchPaymentHistory();

    // Update time every second
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleString());
    };
    
    updateTime();
    const timeInterval = setInterval(updateTime, 1000);

    return () => clearInterval(timeInterval);
  }, [navigate]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('http://localhost:5000/api/coordinator/dashboard/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          localStorage.clear();
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      setStats(data.data.stats);
      setRecentActivities(data.data.recentActivities || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Set default values on error
      setRecentActivities([
        { time: '10:30 AM', activity: 'Welcome to Mahotsav Dashboard!' },
        { time: '10:00 AM', activity: 'System initialized successfully' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Payment Management Functions
  const searchParticipant = async () => {
    if (!searchId.trim()) {
      setSearchError('Please enter a participant ID');
      return;
    }

    setSearchLoading(true);
    setSearchError('');
    setSearchedParticipant(null);
    setPaymentSuccess('');

    try {
      const token = localStorage.getItem('authToken');
      const formattedId = searchId.toUpperCase().trim();
      
      const response = await fetch(`http://localhost:5000/api/payments/participant/${formattedId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        setSearchError(data.message || 'Failed to search participant');
        return;
      }

      setSearchedParticipant(data.participant);
      // Set default payment amount to remaining amount
      const remaining = data.participant.paymentAmount - data.participant.paidAmount;
      setPaymentData(prev => ({
        ...prev,
        amount: Math.max(0, remaining)
      }));

    } catch (error) {
      console.error('Error searching participant:', error);
      setSearchError('Network error while searching participant');
    } finally {
      setSearchLoading(false);
    }
  };

  const processPayment = async () => {
    if (!searchedParticipant) return;

    if (paymentData.amount <= 0) {
      setSearchError('Please enter a valid payment amount');
      return;
    }

    setProcessingPayment(true);
    setSearchError('');
    setPaymentSuccess('');

    try {
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`http://localhost:5000/api/payments/process/${searchedParticipant.participantId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentData)
      });

      const data = await response.json();

      if (!response.ok) {
        setSearchError(data.message || 'Failed to process payment');
        return;
      }

      setPaymentSuccess(`Payment of ₹${paymentData.amount} processed successfully!`);
      
      // Update the participant data
      setSearchedParticipant(prev => prev ? {
        ...prev,
        paymentStatus: data.participant.paymentStatus,
        paidAmount: data.participant.paidAmount,
        paymentDate: data.participant.paymentDate,
        paymentMethod: data.participant.paymentMethod,
        paymentNotes: data.participant.paymentNotes
      } : null);

      // Reset payment form
      setPaymentData({
        amount: Math.max(0, data.participant.remainingAmount || 0),
        method: 'cash',
        notes: ''
      });

      // Refresh dashboard stats
      fetchDashboardData();
      fetchPaymentHistory();

    } catch (error) {
      console.error('Error processing payment:', error);
      setSearchError('Network error while processing payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      const response = await fetch('http://localhost:5000/api/payments/my-payments?limit=10', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentHistory(data.payments || []);
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
    }
  };

  const clearSearch = () => {
    setSearchId('');
    setSearchedParticipant(null);
    setSearchError('');
    setPaymentSuccess('');
    setPaymentData({
      amount: 0,
      method: 'cash',
      notes: ''
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    localStorage.removeItem('authToken');
    navigate('/login');
  };

  const quickActions = [
    { title: 'Manage Events', description: 'Create and manage festival events', icon: '🎭' },
    { title: 'Participant Registration', description: 'Handle participant registrations', icon: '👥' },
    { title: 'Resource Management', description: 'Manage venue and equipment', icon: '🏢' },
    { title: 'Reports & Analytics', description: 'View performance analytics', icon: '📊' },
    { title: 'Communication', description: 'Send notifications and updates', icon: '📢' },
    { title: 'Settings', description: 'Configure system settings', icon: '⚙️' }
  ];



  if (isLoading) {
    return (
      <div className="dashboard-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Coordinator Dashboard</h1>
          <p>Welcome back, {coordinatorName || username}!</p>
        </div>
        <div className="header-right">
          <div className="current-time">{currentTime}</div>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      {/* Stats Cards */}
      <section className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🎪</div>
            <div className="stat-content">
              <div className="stat-number">{stats.totalEvents}</div>
              <div className="stat-label">Total Events</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <div className="stat-number">{stats.activeParticipants}</div>
              <div className="stat-label">Active Participants</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-content">
              <div className="stat-number">{stats.pendingApprovals}</div>
              <div className="stat-label">Pending Approvals</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <div className="stat-number">{stats.completedTasks}</div>
              <div className="stat-label">Completed Tasks</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="dashboard-content">
        {/* Quick Actions */}
        <section className="quick-actions-section">
          <h2>Quick Actions</h2>
          <div className="quick-actions-grid">
            {quickActions.map((action, index) => (
              <div key={index} className="action-card" onClick={() => console.log(`Clicked: ${action.title}`)}>
                <div className="action-icon">{action.icon}</div>
                <div className="action-content">
                  <h3>{action.title}</h3>
                  <p>{action.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Activities */}
        <section className="activities-section">
          <h2>Recent Activities</h2>
          <div className="activities-list">
            {recentActivities.map((activity, index) => (
              <div key={index} className="activity-item">
                <div className="activity-time">{activity.time}</div>
                <div className="activity-description">{activity.activity}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CoordinatorDashboard;