import React, { useState, useEffect, useCallback } from 'react';
import './TeamRegistration.css';

interface Event {
  _id: string;
  title: string;
  description: string;
  category: string;
  eventDate: string;
  venue: string;
  maxParticipants: number;
  currentParticipants: number;
  coordinatorId: string;
  status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
  rules?: string[];
  prizes?: Array<{
    position: string;
    amount: number;
    description?: string;
  }>;
  requirements?: string[];
  contactInfo?: {
    email?: string;
    phone?: string;
  };
}

interface Participant {
  _id: string;
  name: string;
  email: string;
  phone: string;
  registeredEvents: string[]; // Array of event IDs
}

interface Registration {
  _id: string;
  participantId: string;
  eventId: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  registrationDate: string;
}

interface TeamMember {
  participantId: string;
  name: string;
  email: string;
  phone: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  paymentId?: string;
}

interface Team {
  _id: string;
  teamName: string;
  eventId: string;
  eventName: string;
  teamLeader: TeamMember;
  teamMembers: TeamMember[];
  maxTeamSize: number;
  status: 'forming' | 'complete' | 'registered';
  totalAmount: number;
  paidAmount: number;
  paymentComplete: boolean;
}

interface TeamRegistrationProps {
  onTeamCreated?: (team: Team) => void;
}

const TeamRegistration: React.FC<TeamRegistrationProps> = ({ onTeamCreated }) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [userRegisteredEvents, setUserRegisteredEvents] = useState<Event[]>([]);
  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamName, setTeamName] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [showEventRegistration, setShowEventRegistration] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [availableParticipants, setAvailableParticipants] = useState<Participant[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<Participant | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);

  const fetchParticipants = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('Authentication required. Please login again.');
        return;
      }
      
      const response = await fetch('/api/participants', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setParticipants(data);
      } else if (response.status === 401) {
        setError('Session expired. Please login again.');
        // Optionally redirect to login
      } else {
        setError('Failed to fetch participants');
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
      setError('Network error. Please try again.');
    }
  }, []);

  const fetchTeamEvents = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('Authentication required. Please login again.');
        return;
      }
      
      const response = await fetch('/api/coordinator/events', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        const allEvents = result.data?.events || [];
        // For now, include all published events that can have teams
        const availableEvents = allEvents.filter((event: Event) => 
          event.status === 'published' || event.status === 'ongoing'
        );
        setEvents(availableEvents);
        setAvailableEvents(availableEvents);
      } else if (response.status === 401) {
        setError('Session expired. Please login again.');
      } else {
        setError('Failed to fetch events');
      }
    } catch (error) {
      console.error('Error fetching team events:', error);
      setError('Network error. Please try again.');
    }
  }, []);

  const fetchUserRegistrations = useCallback(async () => {
    if (!selectedParticipant) return;
    
    try {
      const response = await fetch(`/api/registrations/participant/${selectedParticipant._id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const registrations = await response.json();
        const registeredEventIds = registrations.map((reg: Registration) => reg.eventId);
        const registeredEvents = events.filter(event => registeredEventIds.includes(event._id));
        setUserRegisteredEvents(registeredEvents);
      }
    } catch (error) {
      console.error('Error fetching user registrations:', error);
    }
  }, [selectedParticipant, events]);

  const fetchParticipantTeams = useCallback(async () => {
    if (!selectedParticipant) return;
    
    try {
      const response = await fetch(`/api/team-registration/participant/${selectedParticipant._id}/teams`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
      }
    } catch (error) {
      console.error('Error fetching participant teams:', error);
    }
  }, [selectedParticipant]);

  const fetchAllTeams = useCallback(async () => {
    try {
      const response = await fetch('/api/team-registration/all-teams', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Store all teams in local state for persistence
        setTeams(data);
      }
    } catch (error) {
      console.error('Error fetching all teams:', error);
    }
  }, []);

  const fetchAvailableParticipants = useCallback(async (eventId: string) => {
    try {
      const response = await fetch(`/api/participants`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const allParticipants = await response.json();
        
        // Filter out participants already in teams for this event
        const teamsForEvent = teams.filter(team => team.eventId === eventId);
        const participantsInTeams = new Set();
        
        teamsForEvent.forEach(team => {
          participantsInTeams.add(team.teamLeader.participantId);
          team.teamMembers.forEach(member => {
            participantsInTeams.add(member.participantId);
          });
        });
        
        const available = allParticipants.filter((p: Participant) => 
          !participantsInTeams.has(p._id)
        );
        
        setAvailableParticipants(available);
      }
    } catch (error) {
      console.error('Error fetching available participants:', error);
    }
  }, [teams]);

  const registerUserForEvent = async (eventId: string) => {
    if (!selectedParticipant) return;
    
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/registrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          participantId: selectedParticipant._id,
          eventId: eventId
        })
      });

      if (response.ok) {
        await fetchUserRegistrations(); // Refresh user registrations
        setShowEventRegistration(false);
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to register for event');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createTeam = async () => {
    if (!selectedEvent || !teamName || !selectedParticipant) {
      setError('Please select an event, enter team name, and ensure participant is selected');
      return;
    }

    // Check if user is registered for the selected event
    const isRegistered = userRegisteredEvents.some(event => event._id === selectedEvent._id);
    if (!isRegistered) {
      setError('Selected participant must be registered for this event first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/team-registration/create-team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          teamName,
          eventId: selectedEvent._id,
          teamLeaderData: {
            participantId: selectedParticipant._id,
            name: selectedParticipant.name,
            email: selectedParticipant.email,
            phone: selectedParticipant.phone
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newTeam = data.team;
        setTeams(prevTeams => [...prevTeams, newTeam]);
        setCurrentTeam(newTeam);
        setTeamName('');
        setIsCreatingTeam(false);
        setError('');
        setShowAddMember(true); // Show add member option after team creation
        await fetchAvailableParticipants(selectedEvent._id);
        
        if (onTeamCreated) {
          onTeamCreated(newTeam);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create team');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addTeamMember = async () => {
    if (!currentTeam || !selectedTeamMember) {
      setError('Please select a participant to add');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/team-registration/add-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          teamId: currentTeam._id,
          memberData: {
            participantId: selectedTeamMember._id,
            name: selectedTeamMember.name,
            email: selectedTeamMember.email,
            phone: selectedTeamMember.phone,
            paymentStatus: 'pending'
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const updatedTeam = data.team;
        
        // Update teams state
        setTeams(prevTeams => 
          prevTeams.map(team => 
            team._id === updatedTeam._id ? updatedTeam : team
          )
        );
        
        setCurrentTeam(updatedTeam);
        setSelectedTeamMember(null);
        await fetchAvailableParticipants(currentTeam.eventId);
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add team member');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updatePaymentStatus = async (teamId: string, paymentStatus: string, paymentId?: string) => {
    try {
      const response = await fetch('/api/team-registration/update-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          teamId,
          participantId: selectedParticipant!._id,
          paymentStatus,
          paymentId
        })
      });

      if (response.ok) {
        const data = await response.json();
        const updatedTeam = data.team;
        
        // Update teams state with persistence
        setTeams(prevTeams => 
          prevTeams.map(team => 
            team._id === teamId ? updatedTeam : team
          )
        );
        
        // Update current team if it's the one being updated
        if (currentTeam && currentTeam._id === teamId) {
          setCurrentTeam(updatedTeam);
        }
        
        // Refresh participant teams to ensure data consistency
        fetchParticipantTeams();
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
      setError('Failed to update payment status');
    }
  };

  const registerTeam = async (teamId: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/team-registration/register-team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ teamId })
      });

      if (response.ok) {
        const data = await response.json();
        setTeams(teams.map(team => team._id === teamId ? data.team : team));
        alert('Team registered successfully!');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to register team');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPaymentStatus = (team: Team) => {
    if (!selectedParticipant) return 'pending';
    const memberInTeam = team.teamMembers.find(member => member.participantId === selectedParticipant._id) ||
                       (team.teamLeader.participantId === selectedParticipant._id ? team.teamLeader : null);
    return memberInTeam?.paymentStatus || 'pending';
  };

  const isTeamLeader = (team: Team) => {
    if (!selectedParticipant) return false;
    return team.teamLeader.participantId === selectedParticipant._id;
  };

  const canRegisterTeam = (team: Team) => {
    return isTeamLeader(team) && 
           team.teamMembers.every(member => member.paymentStatus === 'paid') &&
           team.teamMembers.length >= 2; // Minimum 2 members for a team
  };

  // useEffect hooks after all function declarations
  useEffect(() => {
    fetchParticipants();
    fetchTeamEvents();
    fetchAllTeams(); // Load all teams on component mount for persistence
  }, [fetchParticipants, fetchTeamEvents, fetchAllTeams]);

  useEffect(() => {
    if (selectedParticipant) {
      fetchUserRegistrations();
      fetchParticipantTeams();
    }
  }, [selectedParticipant, fetchUserRegistrations, fetchParticipantTeams]);

  return (
    <div className="team-registration">
      <h2>Team Registration Management</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="participant-selection-section">
        <h3>Step 1: Select Participant</h3>
        <div className="participant-selector">
          <select 
            value={selectedParticipant?._id || ''}
            onChange={(e) => {
              const participant = participants.find(p => p._id === e.target.value);
              setSelectedParticipant(participant || null);
              setSelectedEvent(null);
              setIsCreatingTeam(false);
            }}
          >
            <option value="">Select a participant...</option>
            {participants.map(participant => (
              <option key={participant._id} value={participant._id}>
                {participant.name} - {participant.email}
              </option>
            ))}
          </select>
        </div>
        
        {selectedParticipant && (
          <div className="selected-participant-info">
            <h4>Selected Participant:</h4>
            <p><strong>Name:</strong> {selectedParticipant.name}</p>
            <p><strong>Email:</strong> {selectedParticipant.email}</p>
            <p><strong>Phone:</strong> {selectedParticipant.phone}</p>
          </div>
        )}
      </div>

      {selectedParticipant && (
        <div className="events-section">
          <h3>Step 2: Check Event Registration Status</h3>
          
          {userRegisteredEvents.length > 0 ? (
            <>
              <h4>Participant is registered for these team events:</h4>
              <div className="events-grid">
                {userRegisteredEvents.map(event => (
                  <div 
                    key={event._id} 
                    className={`event-card registered ${selectedEvent?._id === event._id ? 'selected' : ''}`}
                    onClick={() => setSelectedEvent(event)}
                  >
                    <h4>{event.title} ✓</h4>
                    <p>{event.description}</p>
                    <div className="event-details">
                      <span>Category: {event.category}</span>
                      <span>Max Participants: {event.maxParticipants}</span>
                      <span>Current: {event.currentParticipants}</span>
                      <span>Date: {new Date(event.eventDate).toLocaleDateString()}</span>
                      <span>Venue: {event.venue}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="no-registrations">
              <h4>⚠️ This participant is not registered for any team events</h4>
              <p>Please register them for an event first before creating a team.</p>
              <button 
                onClick={() => setShowEventRegistration(true)}
                className="register-event-btn"
              >
                Register for Event
              </button>
            </div>
          )}
          
          {showEventRegistration && (
            <div className="event-registration-modal">
              <div className="modal-content">
                <h4>Register Participant for Event</h4>
                <div className="available-events">
                  {availableEvents.map(event => (
                    <div key={event._id} className="event-option">
                      <h5>{event.title}</h5>
                      <p>{event.description}</p>
                      <p>Category: {event.category}</p>
                      <button 
                        onClick={() => registerUserForEvent(event._id)}
                        disabled={loading}
                        className="register-btn"
                      >
                        {loading ? 'Registering...' : 'Register'}
                      </button>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setShowEventRegistration(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedEvent && selectedParticipant && userRegisteredEvents.length > 0 && (
        <div className="team-actions-section">
          <h3>Step 3: Form Team for {selectedEvent.title}</h3>
          
          <div className="action-buttons">
            <button 
              onClick={() => setIsCreatingTeam(!isCreatingTeam)}
              className="create-team-btn"
            >
              {isCreatingTeam ? 'Cancel' : 'Form Team'}
            </button>
          </div>

          {isCreatingTeam && (
            <div className="create-team-form">
              <h4>Create New Team for {selectedParticipant.name}</h4>
              <p>Team Leader: {selectedParticipant.name}</p>
              <input
                type="text"
                placeholder="Team Name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
              <button 
                onClick={createTeam} 
                disabled={loading}
                className="submit-btn"
              >
                {loading ? 'Creating Team...' : 'Create Team'}
              </button>
            </div>
          )}

          {showAddMember && currentTeam && (
            <div className="add-member-section">
              <h4>Add Members to {currentTeam.teamName}</h4>
              <div className="member-selection">
                <select 
                  value={selectedTeamMember?._id || ''}
                  onChange={(e) => {
                    const participant = availableParticipants.find(p => p._id === e.target.value);
                    setSelectedTeamMember(participant || null);
                  }}
                >
                  <option value="">Select participant to add...</option>
                  {availableParticipants.map(participant => (
                    <option key={participant._id} value={participant._id}>
                      {participant.name} - {participant.email}
                    </option>
                  ))}
                </select>
                <button 
                  onClick={addTeamMember}
                  disabled={loading || !selectedTeamMember}
                  className="add-member-btn"
                >
                  {loading ? 'Adding...' : 'Add Member'}
                </button>
              </div>
              <button 
                onClick={() => setShowAddMember(false)}
                className="cancel-btn"
              >
                Done Adding Members
              </button>
            </div>
          )}
        </div>
      )}

      {selectedParticipant && (
        <div className="participant-teams-section">
          <h3>Teams Overview</h3>
          {teams.length === 0 ? (
            <p>No teams found. Create a team to get started.</p>
          ) : (
            <div className="teams-grid">
              {teams.map(team => (
                <div key={team._id} className="team-card">
                  <h4>{team.teamName}</h4>
                  <p>Event: {team.eventName}</p>
                  <p>Status: <span className={`status ${team.status}`}>{team.status}</span></p>
                  <p>Members: {team.teamMembers.length + 1}/{team.maxTeamSize}</p>
                  <p>Total Amount: ₹{team.totalAmount}</p>
                  <p>Paid Amount: ₹{team.paidAmount}</p>
                  
                  <div className="team-members">
                    <h5>Team Leader:</h5>
                    <div className={`member ${team.teamLeader.participantId === selectedParticipant._id ? 'current-user' : ''}`}>
                      <span>{team.teamLeader.name}</span>
                      <span className={`payment-status ${getPaymentStatus(team)}`}>
                        {getPaymentStatus(team)}
                      </span>
                    </div>
                    
                    <h5>Members:</h5>
                    {team.teamMembers.length === 0 ? (
                      <p className="no-members">No additional members yet</p>
                    ) : (
                      team.teamMembers.map((member, index) => (
                        <div key={index} className={`member ${member.participantId === selectedParticipant._id ? 'current-user' : ''}`}>
                          <span>{member.name}</span>
                          <span className={`payment-status ${member.paymentStatus}`}>
                            {member.paymentStatus}
                          </span>
                          {member.paymentStatus === 'pending' && (
                            <button 
                              onClick={() => updatePaymentStatus(team._id, 'paid', `payment_${Date.now()}`)}
                              className="pay-btn-small"
                            >
                              Mark Paid
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="team-actions">
                    {isTeamLeader(team) && team.teamMembers.length < team.maxTeamSize - 1 && (
                      <button 
                        onClick={() => {
                          setCurrentTeam(team);
                          setShowAddMember(true);
                          fetchAvailableParticipants(team.eventId);
                        }}
                        className="add-member-btn"
                      >
                        Add Members
                      </button>
                    )}
                    
                    {getPaymentStatus(team) === 'pending' && (
                      <button 
                        onClick={() => updatePaymentStatus(team._id, 'paid', `payment_${Date.now()}`)}
                        className="pay-btn"
                      >
                        Mark as Paid
                      </button>
                    )}
                    
                    {canRegisterTeam(team) && team.status !== 'registered' && (
                      <button 
                        onClick={() => registerTeam(team._id)}
                        disabled={loading}
                        className="register-btn"
                      >
                        Register Team
                      </button>
                    )}
                    
                    {team.status === 'registered' && (
                      <span className="registered-badge">✓ Registered</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeamRegistration;