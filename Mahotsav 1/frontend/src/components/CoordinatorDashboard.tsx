import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TeamRegistrationNew from './TeamRegistrationNew';
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
  userId?: string;  // Primary ID from registrations collection
  name: string;
  email: string;
  phoneNumber: string;
  college: string;
  department?: string;
  year?: string;
  rollNumber?: string;
  userType?: string;
  participationType?: string;
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'payments' | 'search' | 'unpaid' | 'team'>('dashboard');
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
  const [showSearchSuggestions, setShowSearchSuggestions] = useState<boolean>(false);
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentProcessData>({
    amount: 0,
    method: 'cash',
    notes: ''
  });
  const [processingPayment, setProcessingPayment] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string>('');
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [totalPaymentsProcessed, setTotalPaymentsProcessed] = useState<number>(0);
  const [totalAmountCollected, setTotalAmountCollected] = useState<number>(0);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [upiAmount, setUpiAmount] = useState<number>(0);
  
  // Payment editing states
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    paymentStatus: string;
    paidAmount: string;
    paymentMethod: string;
    paymentNotes: string;
  }>({
    paymentStatus: '',
    paidAmount: '',
    paymentMethod: 'cash',
    paymentNotes: ''
  });
  const [updatingPayment, setUpdatingPayment] = useState<boolean>(false);
  
  // Unpaid participants states
  const [unpaidParticipants, setUnpaidParticipants] = useState<any[]>([]);
  const [loadingUnpaid, setLoadingUnpaid] = useState<boolean>(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [unpaidSearchQuery, setUnpaidSearchQuery] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [editingAmount, setEditingAmount] = useState<string | null>(null);
  const [editedAmounts, setEditedAmounts] = useState<{[key: string]: number}>({});
  const [participantTypes, setParticipantTypes] = useState<{[key: string]: string}>({});
  
  // Team registration states
  const [teamRegistrations, setTeamRegistrations] = useState<any[]>([]);
  const [loadingTeams, setLoadingTeams] = useState<boolean>(false);
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');
  const [showTeamCreation, setShowTeamCreation] = useState<boolean>(false);
  
  const navigate = useNavigate();

  // Helper function to get the ID (prefer userId over participantId)
  const getParticipantId = (participant: Participant): string => {
    return participant.userId || participant.participantId;
  };

  useEffect(() => {
    // Check authentication
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Get user data
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
      
      // Parse coordinator name if stored
      const storedCoordinator = localStorage.getItem('coordinatorData');
      if (storedCoordinator) {
        const parsed = JSON.parse(storedCoordinator);
        setCoordinatorName(`${parsed.firstName} ${parsed.lastName}`);
      }
    }

    // Fetch dashboard data
    fetchDashboardData();
    fetchPaymentHistory();
    fetchUnpaidParticipants(); // Load unpaid participants for search suggestions

    // Update time every second
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleString());
    };
    
    updateTime();
    const timeInterval = setInterval(updateTime, 1000);

    return () => clearInterval(timeInterval);
  }, [navigate]);

  useEffect(() => {
    if (activeTab === 'unpaid') {
      fetchUnpaidParticipants();
    }
    if (activeTab === 'team') {
      fetchTeamRegistrations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    // Close suggestions when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-input-container')) {
        setShowSuggestions(false);
        setShowSearchSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
  const fetchSearchSuggestions = (query: string) => {
    console.log('fetchSearchSuggestions called with:', query);
    console.log('unpaidParticipants length:', unpaidParticipants.length);
    
    if (!query || query.length < 2) {
      setSearchSuggestions([]);
      return;
    }

    // Use unpaid participants for suggestions
    const filtered = unpaidParticipants.filter(p => 
      (p.userId || p.participantId || '').toLowerCase().includes(query.toLowerCase()) ||
      (p.name || '').toLowerCase().includes(query.toLowerCase()) ||
      (p.phoneNumber || '').includes(query)
    ).slice(0, 8);
    
    console.log('Filtered suggestions:', filtered);
    setSearchSuggestions(filtered);
  };

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
      
      const response = await fetch(`http://localhost:5000/api/coordinator/registrations/participant/${formattedId}`, {
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

  const startEditPayment = (participant: any) => {
    const id = getParticipantId(participant);
    setEditingPayment(id);
    setEditData({
      paymentStatus: participant.paymentStatus,
      paidAmount: participant.paidAmount.toString(),
      paymentMethod: participant.paymentMethod || 'cash',
      paymentNotes: participant.paymentNotes || ''
    });
  };

  const cancelEditPayment = () => {
    setEditingPayment(null);
    setEditData({
      paymentStatus: '',
      paidAmount: '',
      paymentMethod: 'cash',
      paymentNotes: ''
    });
  };

  const updatePayment = async (participantId: string) => {
    if (!editData.paymentStatus && !editData.paidAmount && !editData.paymentMethod && !editData.paymentNotes) {
      alert('Please make at least one change to update the payment');
      return;
    }

    setUpdatingPayment(true);
    
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        alert('Authentication token not found. Please login again.');
        navigate('/login');
        return;
      }
         
      const updatePayload: any = {};
      
      if (editData.paymentStatus) updatePayload.paymentStatus = editData.paymentStatus;
      if (editData.paidAmount) updatePayload.paidAmount = parseFloat(editData.paidAmount);
      if (editData.paymentMethod) updatePayload.paymentMethod = editData.paymentMethod;
      if (editData.paymentNotes) updatePayload.paymentNotes = editData.paymentNotes;

      console.log('Updating payment with payload:', updatePayload);

      const response = await fetch(`http://localhost:5000/api/coordinator/registrations/update/${participantId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.message || `Error updating payment: ${response.status} ${response.statusText}`);
        setUpdatingPayment(false);
        return;
      }

      const data = await response.json();

      alert('Payment updated successfully!');
      
      // Refresh payment history
      await fetchPaymentHistory().catch(err => console.error('Error refreshing payment history:', err));
      
      // Refresh dashboard stats to update proceedings count
      await fetchDashboardData().catch(err => console.error('Error refreshing dashboard:', err));
      
      // Refresh unpaid participants list in case status changed affects it (only if on that tab)
      if (activeTab === 'unpaid') {
        await fetchUnpaidParticipants().catch(err => console.error('Error refreshing unpaid list:', err));
      }
      
      // If the updated participant is currently searched, update that too
      if (searchedParticipant && getParticipantId(searchedParticipant) === participantId) {
        setSearchedParticipant(prev => prev ? {
          ...prev,
          paymentStatus: data.participant.paymentStatus,
          paidAmount: data.participant.paidAmount,
          paymentDate: data.participant.paymentDate,
          paymentMethod: data.participant.paymentMethod,
          paymentNotes: data.participant.paymentNotes
        } : null);
      }

      // Close edit mode
      cancelEditPayment();

    } catch (error: any) {
      console.error('Error updating payment:', error);
      const errorMessage = error?.message || 'Network error while updating payment. Please check your connection and try again.';
      alert(errorMessage);
    } finally {
      setUpdatingPayment(false);
    }
  };

  const resetPayment = async (participantId: string) => {
    if (!window.confirm('Are you sure you want to reset this payment? This will clear all payment details.')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`http://localhost:5000/api/coordinator/registrations/reset/${participantId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || 'Error resetting payment');
        return;
      }

      alert('Payment reset successfully!');
      
      // Refresh payment history
      fetchPaymentHistory();
      
      // If the reset participant is currently searched, update that too
      if (searchedParticipant && getParticipantId(searchedParticipant) === participantId) {
        setSearchedParticipant(prev => prev ? {
          ...prev,
          paymentStatus: 'pending',
          paidAmount: 0,
          paymentDate: '',
          paymentMethod: '',
          paymentNotes: ''
        } : null);
      }

    } catch (error) {
      console.error('Error resetting payment:', error);
      alert('Network error while resetting payment');
    }
  };

  const fetchUnpaidParticipants = async () => {
    setLoadingUnpaid(true);
    try {
      const token = localStorage.getItem('authToken');
      
      const response = await fetch('http://localhost:5000/api/coordinator/registrations/unpaid', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUnpaidParticipants(data.participants || data.registrations || []);
      } else {
        console.error('Error fetching unpaid participants');
      }
    } catch (error) {
      console.error('Error fetching unpaid participants:', error);
    } finally {
      setLoadingUnpaid(false);
    }
  };

  const fetchTeamRegistrations = async () => {
    setLoadingTeams(true);
    try {
      const token = localStorage.getItem('authToken');
      
      const response = await fetch('http://localhost:5000/api/coordinator/eventRegistrations', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Team registrations API response:', data);
        console.log('Count:', data.count);
        console.log('Registrations array:', data.registrations);
        
        // The backend already filters for userType: "participant", so no need to filter again
        const participantTeams = data.registrations || [];
        console.log('Setting team registrations:', participantTeams.length, 'items');
        setTeamRegistrations(participantTeams);
      } else {
        console.error('Error fetching team registrations. Status:', response.status);
        const errorData = await response.text();
        console.error('Error response:', errorData);
      }
    } catch (error) {
      console.error('Error fetching team registrations:', error);
    } finally {
      setLoadingTeams(false);
    }
  };

  const markAsPaid = async (participantId: string, paymentMethod: string = 'cash', customAmount?: number) => {
    setMarkingPaid(participantId);
    
    try {
      const token = localStorage.getItem('authToken');
      
      const requestBody: any = {
        paymentMethod,
        paymentNotes: 'Marked as paid from unpaid participants list'
      };
      
      // Add custom amount if provided (include even if 0)
      if (customAmount !== undefined) {
        requestBody.amount = customAmount;
      }
      
      console.log('Marking as paid with data:', requestBody); // Debug log
      
      const response = await fetch(`http://localhost:5000/api/coordinator/registrations/mark-paid/${participantId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || 'Error marking as paid');
        return;
      }

      alert(`${data.participant.name} marked as paid successfully!`);
      
      // Refresh unpaid participants list
      await fetchUnpaidParticipants().catch(err => console.error('Error refreshing unpaid list:', err));
      
      // Refresh dashboard stats
      await fetchDashboardData().catch(err => console.error('Error refreshing dashboard:', err));
      
      // Refresh payment history
      await fetchPaymentHistory().catch(err => console.error('Error refreshing payment history:', err));

    } catch (error) {
      console.error('Error marking as paid:', error);
      alert('Network error while marking as paid');
    } finally {
      setMarkingPaid(null);
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
      const participantId = getParticipantId(searchedParticipant);
      
      const response = await fetch(`http://localhost:5000/api/coordinator/registrations/process/${participantId}`, {
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
      
      const response = await fetch('http://localhost:5000/api/coordinator/registrations/my-payments?limit=10', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentHistory(data.payments || []);
        
        // Set the total count to ONLY paid payments
        if (data.statistics && data.statistics.paidCount !== undefined) {
          setTotalPaymentsProcessed(data.statistics.paidCount);
        } else {
          // Fallback: count paid payments from the payment history
          const paidCount = (data.payments || []).filter((p: any) => p.paymentStatus === 'paid').length;
          setTotalPaymentsProcessed(paidCount);
        }
        
        // Calculate total amount collected from paid payments
        const paidPayments = (data.payments || []).filter((p: any) => p.paymentStatus === 'paid');
        
        if (data.statistics && data.statistics.totalAmount !== undefined) {
          setTotalAmountCollected(data.statistics.totalAmount);
        } else {
          // Fallback: calculate from payment history
          const totalAmount = paidPayments.reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0);
          setTotalAmountCollected(totalAmount);
        }
        
        // Calculate cash and UPI amounts separately
        const cashTotal = paidPayments
          .filter((p: any) => p.paymentMethod === 'cash')
          .reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0);
        
        const upiTotal = paidPayments
          .filter((p: any) => p.paymentMethod === 'upi')
          .reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0);
        
        setCashAmount(cashTotal);
        setUpiAmount(upiTotal);
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
          <h1>🎊 Mahotsav Coordinator</h1>
          <p>Welcome back, {coordinatorName || username}!</p>
        </div>
        <div className="header-right">
          <div className="current-time">{currentTime}</div>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
        <nav className="dashboard-nav">
          <button 
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button 
            className={`nav-tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            🔍 Payment Search
          </button>
          <button 
            className={`nav-tab ${activeTab === 'payments' ? 'active' : ''}`}
            onClick={() => setActiveTab('payments')}
          >
            💰 Payment History
          </button>
          <button 
            className={`nav-tab ${activeTab === 'unpaid' ? 'active' : ''}`}
            onClick={() => setActiveTab('unpaid')}
          >
            💳 Proceed to Pay
          </button>
          <button 
            className={`nav-tab ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            👥 Team Registration
          </button>
        </nav>      {/* Main Content */}
      <div className="dashboard-content">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <section className="dashboard-background-section">
            {/* Proceedings Counter */}
            <div className="proceedings-counter">
              <h3>Total Proceedings</h3>
              <div className="count">{totalPaymentsProcessed}</div>
              <div className="label">Payments Processed</div>
              
              <div className="amount-collected">
                <div className="amount-value">₹{totalAmountCollected.toLocaleString('en-IN')}</div>
                <div className="amount-label">Total Amount Collected</div>
              </div>
              
              <div className="payment-breakdown">
                <div className="breakdown-item cash">
                  <div className="breakdown-icon">💵</div>
                  <div className="breakdown-details">
                    <div className="breakdown-amount">₹{cashAmount.toLocaleString('en-IN')}</div>
                    <div className="breakdown-label">Cash</div>
                  </div>
                </div>
                <div className="breakdown-item upi">
                  <div className="breakdown-icon">📱</div>
                  <div className="breakdown-details">
                    <div className="breakdown-amount">₹{upiAmount.toLocaleString('en-IN')}</div>
                    <div className="breakdown-label">UPI</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Payment Search Tab */}
        {activeTab === 'search' && (
          <section className="payment-search-section">
            <div className="search-container">
              <h2>🔍 Participant Payment Search</h2>
              <p className="search-instructions">
                Enter participant ID (Format: MH25XXXXXX) to search and process payments
              </p>
              
              <div className="search-form">
                <div className="search-input-group">
                  <div className="search-input-container">
                    <input
                      type="text"
                      placeholder="Enter Participant ID (e.g., MH25000001)"
                      value={searchId}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        setSearchId(value);
                        if (value.length >= 2) {
                          fetchSearchSuggestions(value);
                          setShowSearchSuggestions(true);
                        } else {
                          setShowSearchSuggestions(false);
                        }
                      }}
                      onFocus={() => {
                        if (searchId.length >= 2) {
                          fetchSearchSuggestions(searchId);
                          setShowSearchSuggestions(true);
                        }
                      }}
                      className="search-input"
                      maxLength={10}
                    />
                    
                    {/* Search Suggestions Dropdown */}
                    {showSearchSuggestions && searchId && searchSuggestions.length > 0 && (
                      <div className="search-suggestions">
                        {searchSuggestions.map((participant, index) => (
                          <div
                            key={index}
                            className="suggestion-item"
                            onClick={() => {
                              const id = getParticipantId(participant);
                              setSearchId(id);
                              setShowSearchSuggestions(false);
                              // Auto-search after selection
                              setTimeout(() => searchParticipant(), 100);
                            }}
                          >
                            <div className="suggestion-id">{getParticipantId(participant)}</div>
                            <div className="suggestion-details">
                              <span className="suggestion-name">{participant.name}</span>
                              <span className="suggestion-separator">•</span>
                              <span className="suggestion-event">{participant.event}</span>
                            </div>
                            <div className="suggestion-amount">₹{(participant.remainingAmount || 0).toLocaleString('en-IN')}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={searchParticipant}
                    disabled={searchLoading}
                    className="search-btn"
                  >
                    {searchLoading ? '🔍 Searching...' : '🔍 Search'}
                  </button>
                  {searchedParticipant && (
                    <button onClick={clearSearch} className="clear-btn">
                      ❌ Clear
                    </button>
                  )}
                </div>

                {searchError && (
                  <div className="error-message">{searchError}</div>
                )}

                {paymentSuccess && (
                  <div className="success-message">{paymentSuccess}</div>
                )}
              </div>

              {/* Participant Details */}
              {searchedParticipant && (
                <div className="participant-details">
                  <h3>Participant Information</h3>
                  <div className="participant-info-grid">
                    <div className="info-card">
                      <strong>User ID:</strong> {getParticipantId(searchedParticipant)}
                    </div>
                    <div className="info-card">
                      <strong>Name:</strong> {searchedParticipant.name}
                    </div>
                    <div className="info-card">
                      <strong>Event:</strong> {searchedParticipant.event.title}
                    </div>
                    <div className="info-card">
                      <strong>College:</strong> {searchedParticipant.college}
                    </div>
                    {searchedParticipant.userType && (
                      <div className="info-card">
                        <strong>Type:</strong> {searchedParticipant.userType}
                      </div>
                    )}
                    {searchedParticipant.participationType && (
                      <div className="info-card">
                        <strong>Participation:</strong> {searchedParticipant.participationType}
                      </div>
                    )}
                    <div className="info-card">
                      <strong>Registration:</strong> 
                      <span className={`status-badge ${searchedParticipant.registrationStatus}`}>
                        {searchedParticipant.registrationStatus}
                      </span>
                    </div>
                  </div>

                  {/* Payment Information */}
                  <div className="payment-info">
                    <h4>Payment Details</h4>
                    <div className="payment-summary">
                      <div className="payment-row">
                        <span>Registration Fee:</span>
                        <strong>₹{(searchedParticipant.paymentAmount || 0).toLocaleString('en-IN')}</strong>
                      </div>
                      <div className="payment-row">
                        <span>Amount Paid:</span>
                        <strong>₹{(searchedParticipant.paidAmount || 0).toLocaleString('en-IN')}</strong>
                      </div>
                      <div className="payment-row remaining">
                        <span>Remaining:</span>
                        <strong>₹{Math.max(0, (searchedParticipant.paymentAmount || 0) - (searchedParticipant.paidAmount || 0)).toLocaleString('en-IN')}</strong>
                      </div>
                      <div className="payment-row">
                        <span>Status:</span>
                        <span className={`status-badge ${searchedParticipant.paymentStatus}`}>
                          {searchedParticipant.paymentStatus}
                        </span>
                      </div>
                    </div>

                    {/* Payment Processing Form */}
                    {searchedParticipant.registrationStatus === 'approved' && 
                     (searchedParticipant.paidAmount || 0) < (searchedParticipant.paymentAmount || 0) && (
                      <div className="payment-form">
                        <h4>Process Payment</h4>
                        <div className="form-row">
                          <label>Amount to Collect:</label>
                          <input
                            type="number"
                            min="1"
                            max={(searchedParticipant.paymentAmount || 0) - (searchedParticipant.paidAmount || 0)}
                            value={paymentData.amount}
                            onChange={(e) => setPaymentData(prev => ({
                              ...prev,
                              amount: parseFloat(e.target.value) || 0
                            }))}
                            className="payment-input"
                          />
                        </div>
                        <div className="form-row">
                          <label>Payment Method:</label>
                          <select
                            value={paymentData.method}
                            onChange={(e) => setPaymentData(prev => ({
                              ...prev,
                              method: e.target.value as 'cash' | 'upi'
                            }))}
                            className="payment-select"
                          >
                            <option value="cash">💵 Cash</option>
                            <option value="upi">📱 UPI</option>
                          </select>
                        </div>
                        <div className="form-row">
                          <label>Notes (Optional):</label>
                          <textarea
                            value={paymentData.notes}
                            onChange={(e) => setPaymentData(prev => ({
                              ...prev,
                              notes: e.target.value
                            }))}
                            placeholder="Any additional notes..."
                            className="payment-textarea"
                            maxLength={200}
                          />
                        </div>
                        <button
                          onClick={processPayment}
                          disabled={processingPayment || paymentData.amount <= 0}
                          className="process-payment-btn"
                        >
                          {processingPayment ? '💳 Processing...' : `💳 Collect ₹${paymentData.amount}`}
                        </button>
                      </div>
                    )}

                    {searchedParticipant.registrationStatus !== 'approved' && (
                      <div className="warning-message">
                        ⚠️ Cannot process payment. Participant registration is not approved.
                      </div>
                    )}

                    {searchedParticipant.paymentStatus === 'paid' && 
                     (searchedParticipant.paidAmount || 0) >= (searchedParticipant.paymentAmount || 0) && (
                      <div className="success-message">
                        ✅ Payment completed! Participant has paid in full.
                      </div>
                    )}

                    {/* Payment Update Section */}
                    {(searchedParticipant.paidAmount || 0) > 0 && (
                      <div className="payment-update-section">
                        <h4>🔧 Update Existing Payment</h4>
                        <p>Modify payment details or reset payment status</p>
                        
                        {editingPayment === getParticipantId(searchedParticipant) ? (
                          <div className="update-form">
                            <div className="form-row">
                              <label>Payment Status:</label>
                              <select
                                value={editData.paymentStatus}
                                onChange={(e) => setEditData(prev => ({...prev, paymentStatus: e.target.value}))}
                                className="payment-select"
                              >
                                <option value="pending">⏳ Pending</option>
                                <option value="paid">✅ Paid</option>
                                <option value="failed">❌ Failed</option>
                                <option value="refunded">🔄 Refunded</option>
                              </select>
                            </div>
                            
                            <div className="form-row">
                              <label>Paid Amount:</label>
                              <input
                                type="number"
                                min="0"
                                max={searchedParticipant.paymentAmount || 0}
                                value={editData.paidAmount}
                                onChange={(e) => setEditData(prev => ({...prev, paidAmount: e.target.value}))}
                                className="payment-input"
                                placeholder="Enter paid amount"
                              />
                            </div>
                            
                            <div className="form-row">
                              <label>Payment Method:</label>
                              <select
                                value={editData.paymentMethod}
                                onChange={(e) => setEditData(prev => ({...prev, paymentMethod: e.target.value}))}
                                className="payment-select"
                              >
                                <option value="cash">💵 Cash</option>
                                <option value="upi">📱 UPI</option>
                              </select>
                            </div>
                            
                            <div className="form-row">
                              <label>Payment Notes:</label>
                              <textarea
                                value={editData.paymentNotes}
                                onChange={(e) => setEditData(prev => ({...prev, paymentNotes: e.target.value}))}
                                placeholder="Update payment notes..."
                                className="payment-textarea"
                                maxLength={200}
                                rows={3}
                              />
                              <small>{editData.paymentNotes.length}/200 characters</small>
                            </div>
                            
                            <div className="update-actions">
                              <button
                                onClick={() => updatePayment(getParticipantId(searchedParticipant))}
                                disabled={updatingPayment}
                                className="save-update-btn"
                              >
                                {updatingPayment ? '⏳ Updating...' : '✅ Save Changes'}
                              </button>
                              <button
                                onClick={cancelEditPayment}
                                className="cancel-update-btn"
                              >
                                ❌ Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="update-actions">
                            <button
                              onClick={() => startEditPayment(searchedParticipant)}
                              className="edit-payment-btn"
                            >
                              ✏️ Edit Payment
                            </button>
                            <button
                              onClick={() => resetPayment(getParticipantId(searchedParticipant))}
                              className="reset-payment-btn"
                            >
                              🔄 Reset Payment
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Payment History Tab */}
        {activeTab === 'payments' && (
          <section className="payment-history-section">
            <div className="section-header">
              <div>
                <h2>💰 Payment History</h2>
                <p>Payments processed by you</p>
              </div>
              <button 
                onClick={fetchPaymentHistory}
                className="refresh-btn"
                disabled={isLoading}
              >
                🔄 Refresh
              </button>
            </div>
            
            {paymentHistory.length > 0 ? (
              <div className="payment-history-list">
                <div className="payment-history-header">
                  <span>User ID</span>
                  <span>Name</span>
                  <span>Event</span>
                  <span>Amount</span>
                  <span>Method</span>
                  <span>Date</span>
                  <span>Status</span>
                  <span>Processed By</span>
                  <span>Actions</span>
                </div>
                {paymentHistory.map((payment, index) => {
                  const paymentId = getParticipantId(payment);
                  return (
                  <div key={index} className="payment-history-row">
                    {editingPayment === paymentId ? (
                      <>
                        <span className="participant-id">{paymentId}</span>
                        <span>{payment.name}</span>
                        <span className="event-name">{payment.event}</span>
                        <span className="amount">
                          <input
                            type="number"
                            value={editData.paidAmount}
                            onChange={(e) => setEditData(prev => ({...prev, paidAmount: e.target.value}))}
                            className="edit-input small"
                            min="0"
                            step="0.01"
                            placeholder="Amount"
                          />
                        </span>
                        <span className="method">
                          <select
                            value={editData.paymentMethod}
                            onChange={(e) => setEditData(prev => ({...prev, paymentMethod: e.target.value}))}
                            className="edit-select"
                          >
                            <option value="cash">Cash</option>
                            <option value="upi">UPI</option>
                          </select>
                        </span>
                        <span className="date">
                          {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : '-'}
                        </span>
                        <span className="status">
                          <select
                            value={editData.paymentStatus}
                            onChange={(e) => setEditData(prev => ({...prev, paymentStatus: e.target.value}))}
                            className="edit-select"
                          >
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="failed">Failed</option>
                            <option value="refunded">Refunded</option>
                          </select>
                        </span>
                        <span className="processed-by">
                          {payment.processedBy?.name || payment.processedBy?.username || '-'}
                        </span>
                        <span className="actions">
                          <button
                            onClick={() => updatePayment(paymentId)}
                            disabled={updatingPayment}
                            className="btn-save"
                          >
                            {updatingPayment ? '⏳' : '✅'}
                          </button>
                          <button
                            onClick={cancelEditPayment}
                            className="btn-cancel"
                          >
                            ❌
                          </button>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="participant-id">{paymentId}</span>
                        <span>{payment.name}</span>
                        <span className="event-name">{payment.event}</span>
                        <span className="amount">₹{payment.paidAmount?.toLocaleString('en-IN')}</span>
                        <span className="method">{payment.paymentMethod}</span>
                        <span className="date">
                          {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : '-'}
                        </span>
                        <span className={`status-badge ${payment.paymentStatus}`}>
                          {payment.paymentStatus}
                        </span>
                        <span className="processed-by">
                          {payment.processedBy?.name || payment.processedBy?.username || '-'}
                        </span>
                        <span className="actions">
                          <button
                            onClick={() => startEditPayment(payment)}
                            className="btn-edit"
                            title="Edit Payment"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => resetPayment(paymentId)}
                            className="btn-reset"
                            title="Reset Payment"
                          >
                            🔄
                          </button>
                        </span>
                      </>
                    )}
                  </div>
                );
                })}
              </div>
            ) : (
              <div className="no-payments">
                <p>No payment history found.</p>
                <p>Payments you process will appear here.</p>
              </div>
            )}
            
            {/* Notes Edit Section */}
            {editingPayment && (
              <div className="edit-notes-section">
                <h3>Edit Payment Notes</h3>
                <textarea
                  value={editData.paymentNotes}
                  onChange={(e) => setEditData(prev => ({...prev, paymentNotes: e.target.value}))}
                  placeholder="Add payment notes or update existing notes..."
                  className="notes-textarea"
                  rows={3}
                  maxLength={200}
                />
                <div className="notes-info">
                  <span>{editData.paymentNotes.length}/200 characters</span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Unpaid Participants Tab */}
        {activeTab === 'unpaid' && (
          <section className="unpaid-participants-section">
            <h2>❌ Unpaid Participants</h2>
            <p>Mark participants as paid to update their payment status</p>
            
            {/* Search Bar */}
            <div className="unpaid-search-bar">
              <div className="search-input-container">
                <input
                  type="text"
                  placeholder="🔍 Search by ID, Name, Event, or Phone..."
                  value={unpaidSearchQuery}
                  onChange={(e) => {
                    setUnpaidSearchQuery(e.target.value);
                    setShowSuggestions(e.target.value.length > 0);
                  }}
                  onFocus={() => setShowSuggestions(unpaidSearchQuery.length > 0)}
                  className="unpaid-search-input"
                />
                
                {/* Autocomplete Suggestions */}
                {showSuggestions && unpaidSearchQuery && (
                  <div className="search-suggestions">
                    {unpaidParticipants
                      .filter(participant => {
                        const query = unpaidSearchQuery.toLowerCase();
                        return (
                          (participant.participantId || '').toLowerCase().includes(query) ||
                          (participant.name || '').toLowerCase().includes(query) ||
                          (participant.event || '').toLowerCase().includes(query) ||
                          (participant.phoneNumber || '').includes(query)
                        );
                      })
                      .slice(0, 8) // Show max 8 suggestions
                      .map((participant, index) => (
                        <div
                          key={index}
                          className="suggestion-item"
                          onClick={() => {
                            setUnpaidSearchQuery(participant.participantId);
                            setShowSuggestions(false);
                          }}
                        >
                          <div className="suggestion-id">{participant.participantId}</div>
                          <div className="suggestion-details">
                            <span className="suggestion-name">{participant.name}</span>
                            <span className="suggestion-separator">•</span>
                            <span className="suggestion-event">{participant.event}</span>
                          </div>
                          <div className="suggestion-amount">₹{(participant.remainingAmount || 0).toLocaleString('en-IN')}</div>
                        </div>
                      ))}
                    
                    {unpaidParticipants.filter(participant => {
                      const query = unpaidSearchQuery.toLowerCase();
                      return (
                        (participant.participantId || '').toLowerCase().includes(query) ||
                        (participant.name || '').toLowerCase().includes(query) ||
                        (participant.event || '').toLowerCase().includes(query) ||
                        (participant.phoneNumber || '').includes(query)
                      );
                    }).length === 0 && (
                      <div className="no-suggestions">
                        No matching participants found
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {unpaidSearchQuery && (
                <button
                  onClick={() => {
                    setUnpaidSearchQuery('');
                    setShowSuggestions(false);
                  }}
                  className="clear-search-btn"
                >
                  ✕ Clear
                </button>
              )}
            </div>
            
            {loadingUnpaid ? (
              <div className="loading-message">
                <p>⏳ Loading unpaid participants...</p>
              </div>
            ) : unpaidParticipants.length > 0 ? (
              <>
                <div className="unpaid-participants-list">
                  <div className="unpaid-header">
                    <span>User ID</span>
                    <span>Name</span>
                    <span>Type</span>
                    <span>Event</span>
                    <span>Phone</span>
                    <span>Amount Due</span>
                    <span>Status</span>
                    <span>Actions</span>
                  </div>
                  {unpaidParticipants
                    .filter(participant => {
                      // Apply search filter
                      if (!unpaidSearchQuery) return true;
                      
                      const query = unpaidSearchQuery.toLowerCase();
                      const participantId = getParticipantId(participant);
                      return (
                        (participantId || '').toLowerCase().includes(query) ||
                        (participant.name || '').toLowerCase().includes(query) ||
                        (participant.event || '').toLowerCase().includes(query) ||
                        (participant.phoneNumber || '').includes(query) ||
                        (participant.department || '').toLowerCase().includes(query)
                      );
                    })
                    .map((participant, index) => {
                      const participantId = getParticipantId(participant);
                      return (
                  <div key={index} className="unpaid-row">
                    <span className="participant-id">{participantId}</span>
                    <span className="participant-name">
                      <div>{participant.name}</div>
                      <small>{participant.department} - {participant.year}</small>
                    </span>
                    <span className="participant-type-column">
                      <select
                        value={participantTypes[participantId] || 'visitor'}
                        onChange={(e) => setParticipantTypes(prev => ({
                          ...prev,
                          [participantId]: e.target.value
                        }))}
                        className="participant-type-select"
                      >
                        <option value="visitor">👥 Visitor</option>
                        <option value="sports">⚽ Sports</option>
                        <option value="cultural">🎭 Cultural</option>
                      </select>
                    </span>
                    <span className="event-name">{participant.event}</span>
                    <span className="phone">{participant.phoneNumber}</span>
                    <span className="amount-due">
                      {editingAmount === participantId ? (
                        <div className="amount-edit-container">
                          <input
                            type="number"
                            min="0"
                            value={editedAmounts[participantId] ?? participant.remainingAmount}
                            onChange={(e) => setEditedAmounts(prev => ({
                              ...prev,
                              [participantId]: parseFloat(e.target.value) || 0
                            }))}
                            className="amount-edit-input"
                          />
                          <button
                            onClick={() => {
                              setEditingAmount(null);
                            }}
                            className="amount-save-btn"
                            title="Save amount"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => {
                              setEditingAmount(null);
                              setEditedAmounts(prev => {
                                const newAmounts = {...prev};
                                delete newAmounts[participantId];
                                return newAmounts;
                              });
                            }}
                            className="amount-cancel-btn"
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="amount-display-container">
                          <div className="amount">
                            ₹{((editedAmounts[participantId] ?? participant.remainingAmount) || 0).toLocaleString('en-IN')}
                          </div>
                          <small>of ₹{(participant.registrationFee || 0).toLocaleString('en-IN')}</small>
                          <button
                            onClick={() => setEditingAmount(participantId)}
                            className="amount-edit-btn"
                            title="Edit amount"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </span>
                    <span className={`status-badge ${participant.paymentStatus}`}>
                      {participant.paymentStatus}
                    </span>
                    <span className="actions">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            const amountToCharge = editedAmounts[participantId] ?? participant.remainingAmount;
                            markAsPaid(participantId, e.target.value, amountToCharge);
                            e.target.value = ''; // Reset select
                          }
                        }}
                        disabled={markingPaid === participantId}
                        className="payment-method-select"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          {markingPaid === participantId ? '⏳ Processing...' : '💰 Mark as Paid'}
                        </option>
                        <option value="cash">💵 Cash</option>
                        <option value="upi">📱 UPI</option>
                      </select>
                    </span>
                  </div>
                      );
                    })}
                </div>
                
                {/* Show message if no results found */}
                {unpaidParticipants.filter(participant => {
                  if (!unpaidSearchQuery) return true;
                  const query = unpaidSearchQuery.toLowerCase();
                  return (
                    (participant.participantId || '').toLowerCase().includes(query) ||
                    (participant.name || '').toLowerCase().includes(query) ||
                    (participant.event || '').toLowerCase().includes(query) ||
                    (participant.phoneNumber || '').includes(query) ||
                    (participant.department || '').toLowerCase().includes(query)
                  );
                }).length === 0 && unpaidSearchQuery && (
                  <div className="no-search-results">
                    <p>No participants found matching "{unpaidSearchQuery}"</p>
                    <button onClick={() => setUnpaidSearchQuery('')} className="clear-search-btn">
                      Clear Search
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="no-unpaid">
                <div className="success-state">
                  <h3>🎉 Great Job!</h3>
                  <p>All participants in your events have completed their payments!</p>
                  <p>There are no pending payments at this time.</p>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            {unpaidParticipants.length > 0 && (
              <div className="unpaid-stats">
                <div className="stat-card">
                  <span className="stat-number">{unpaidParticipants.length}</span>
                  <span className="stat-label">Unpaid Participants</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number">
                    ₹{unpaidParticipants.reduce((sum, p) => sum + (p.remainingAmount || 0), 0).toLocaleString('en-IN')}
                  </span>
                  <span className="stat-label">Total Outstanding</span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Team Registration Tab */}
        {activeTab === 'team' && (
          <section className="team-registration-section">
            <div className="team-header">
              <div>
                <h2>Team Registration</h2>
                <p>Manage team registrations for participants</p>
              </div>
              <div className="team-action-buttons">
                <button
                  onClick={() => setShowTeamCreation(!showTeamCreation)}
                  className={`btn ${showTeamCreation ? 'btn-secondary' : 'btn-primary'}`}
                >
                  {showTeamCreation ? 'View Existing Teams' : 'Create New Team'}
                </button>
              </div>
            </div>

            {showTeamCreation ? (
              <div className="team-creation-container">
                <TeamRegistrationNew 
                  onTeamCreated={() => {
                    console.log('Team created successfully');
                    setShowTeamCreation(false);
                    // Refresh the team registrations
                    fetchTeamRegistrations();
                  }}
                />
              </div>
            ) : (
              <div className="existing-teams-container">
                {/* Search Bar */}
                <div className="team-search-bar">
                  <input
                    type="text"
                    placeholder="Search by Name, Event, or Phone..."
                    value={teamSearchQuery}
                    onChange={(e) => setTeamSearchQuery(e.target.value)}
                    className="team-search-input"
                  />
                  {teamSearchQuery && (
                    <button
                      onClick={() => setTeamSearchQuery('')}
                      className="team-clear-btn"
                    >
                      Clear
                    </button>
                  )}
                </div>
            
            {loadingTeams ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading team registrations...</p>
              </div>
            ) : teamRegistrations.length > 0 ? (
              <>
                <div className="team-table-container">
                  <table className="team-table">
                    <thead>
                      <tr>
                        <th style={{ width: '130px' }}>User ID</th>
                        <th style={{ width: '200px' }}>Name</th>
                        <th style={{ width: '160px' }}>Event</th>
                        <th style={{ width: '140px' }}>Phone</th>
                        <th style={{ width: '120px' }}>User Type</th>
                        <th style={{ width: '280px' }}>Team Members</th>
                        <th style={{ width: '130px' }}>Registration</th>
                        <th style={{ width: '150px' }}>Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamRegistrations
                        .filter(team => {
                          if (!teamSearchQuery) return true;
                          const query = teamSearchQuery.toLowerCase();
                          return (
                            (team.userId || team.participantId || '').toLowerCase().includes(query) ||
                            (team.name || '').toLowerCase().includes(query) ||
                            (team.event || '').toLowerCase().includes(query) ||
                            (team.phoneNumber || '').includes(query)
                          );
                        })
                        .map((team, index) => {
                          const teamId = team.userId || team.participantId;
                          const teamMembersCount = team.teamMembers?.length || 0;
                          return (
                            <tr key={index}>
                              <td>
                                <span className="team-id">{teamId}</span>
                              </td>
                              <td>
                                <div className="team-name">{team.name}</div>
                                <div className="team-college">{team.college}</div>
                              </td>
                              <td>
                                <span>{team.event}</span>
                              </td>
                              <td>
                                <span className="team-phone">+91 {team.phoneNumber}</span>
                              </td>
                              <td>
                                <span className="user-type-badge">
                                  {team.userType}
                                </span>
                              </td>
                              <td className="team-members-cell">
                                {teamMembersCount > 0 ? (
                                  <div>
                                    <span className="team-member-count">
                                      {teamMembersCount} Member{teamMembersCount !== 1 ? 's' : ''}
                                    </span>
                                    {team.teamMembers && (
                                      <div className="team-member-list">
                                        {team.teamMembers.map((member: any, idx: number) => (
                                          <div key={idx} className="team-member-item">
                                            <span className="team-member-name">{member.name}</span>
                                            <span className="team-member-details">{member.department} - {member.year}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="no-team-members">No team members</span>
                                )}
                              </td>
                              <td>
                                <span className={`registration-status-badge ${team.registrationStatus}`}>
                                  {team.registrationStatus}
                                </span>
                              </td>
                              <td>
                                <div>
                                  <span className={`payment-status-badge ${team.paymentStatus}`}>
                                    {team.paymentStatus}
                                  </span>
                                  <div className="payment-amount">
                                    ₹{(team.paidAmount || 0).toLocaleString('en-IN')} / ₹{(team.paymentAmount || 0).toLocaleString('en-IN')}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                
                {/* No results message */}
                {teamRegistrations.filter(team => {
                  if (!teamSearchQuery) return true;
                  const query = teamSearchQuery.toLowerCase();
                  return (
                    (team.userId || team.participantId || '').toLowerCase().includes(query) ||
                    (team.name || '').toLowerCase().includes(query) ||
                    (team.event || '').toLowerCase().includes(query) ||
                    (team.phoneNumber || '').includes(query)
                  );
                }).length === 0 && teamSearchQuery && (
                  <div className="no-teams-found">
                    <p>No team registrations found matching "{teamSearchQuery}"</p>
                    <button 
                      onClick={() => setTeamSearchQuery('')} 
                      className="clear-search-btn"
                    >
                      Clear Search
                    </button>
                  </div>
                )}
                
                {/* Statistics */}
                <div className="team-stats">
                  <div className="team-stat-card blue">
                    <div className="team-stat-label">Total Registrations</div>
                    <div className="team-stat-value">{teamRegistrations.length}</div>
                    <div className="team-stat-subtitle">Team registrations</div>
                  </div>
                  <div className="team-stat-card green">
                    <div className="team-stat-label">Total Members</div>
                    <div className="team-stat-value">
                      {teamRegistrations.reduce((sum, t) => sum + (t.teamMembers?.length || 0), 0)}
                    </div>
                    <div className="team-stat-subtitle">Registered members</div>
                  </div>
                  <div className="team-stat-card purple">
                    <div className="team-stat-label">Paid Teams</div>
                    <div className="team-stat-value">
                      {teamRegistrations.filter(t => t.paymentStatus === 'paid').length}
                    </div>
                    <div className="team-stat-subtitle">Completed payments</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="no-team-registrations">
                <h3>No Team Registrations</h3>
                <p>No participants with team registrations found at this time.</p>
                <p>Team registrations will appear here once participants register.</p>
              </div>
            )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default CoordinatorDashboard;