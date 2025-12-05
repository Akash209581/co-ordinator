import React, { useState, useEffect } from 'react';
import './TeamRegistration.css';

// Interfaces
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
}

interface Participant {
  _id: string;
  name: string;
  email: string;
  phoneNumber: string;
  participantId?: string;
}

interface TeamMember {
  participantId: string;
  name: string;
  email: string;
  phoneNumber: string;
}

interface TeamForm {
  teamName: string;
  eventId: string;
  captain: TeamMember;
  members: TeamMember[];
}

const TeamRegistrationNew: React.FC<{ onTeamCreated?: () => void }> = ({ onTeamCreated }) => {
  // UI State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentStep, setCurrentStep] = useState<'teamName' | 'event' | 'captain' | 'members' | 'review'>('teamName');
  
  // Form Data
  const [teamForm, setTeamForm] = useState<TeamForm>({
    teamName: '',
    eventId: '',
    captain: { participantId: '', name: '', email: '', phoneNumber: '' },
    members: []
  });
  
  // Available Data
  const [events, setEvents] = useState<Event[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Participant[]>([]);

  // Fetch Events on component mount
  useEffect(() => {
    fetchEvents();
    fetchParticipants();
    fetchAllTeams();
  }, []);

  const fetchEvents = async () => {
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
        const responseData = await response.json();
        // Handle the nested response structure from coordinator API
        if (responseData.success && responseData.data && responseData.data.events) {
          setEvents(responseData.data.events);
        } else {
          setEvents(responseData || []); // Fallback for direct array response
        }
      } else {
        setError('Failed to fetch events');
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      setError('Network error. Please try again.');
    }
  };

  const fetchParticipants = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch('/api/participants', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setParticipants(data);
        setSearchResults(data); // Initialize search results
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const fetchAllTeams = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch('/api/team-registration/all-teams', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAllTeams(data);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  // Search users by ID or name
  const handleUserSearch = (query: string) => {
    setUserSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(participants);
      return;
    }

    const filtered = participants.filter(p => 
      p._id.includes(query) || 
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.email.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(filtered);
  };

  // Add member to team
  const addMember = (participant: Participant) => {
    // Check if already captain
    if (teamForm.captain.participantId === participant._id) {
      setError('This person is already the team captain');
      return;
    }

    // Check if already a member
    if (teamForm.members.some(m => m.participantId === participant._id)) {
      setError('This person is already a team member');
      return;
    }

    const newMember: TeamMember = {
      participantId: participant._id,
      name: participant.name,
      email: participant.email,
      phoneNumber: participant.phoneNumber
    };

    setTeamForm(prev => ({
      ...prev,
      members: [...prev.members, newMember]
    }));
    setUserSearchQuery('');
    setSearchResults(participants);
  };

  // Remove member from team
  const removeMember = (participantId: string) => {
    setTeamForm(prev => ({
      ...prev,
      members: prev.members.filter(m => m.participantId !== participantId)
    }));
  };

  // Set captain
  const setCaptain = (participant: Participant) => {
    // Remove from members if already added
    setTeamForm(prev => ({
      ...prev,
      captain: {
        participantId: participant._id,
        name: participant.name,
        email: participant.email,
        phoneNumber: participant.phoneNumber
      },
      members: prev.members.filter(m => m.participantId !== participant._id)
    }));
  };

  // Submit team creation
  const handleFormTeam = async () => {
    if (!teamForm.teamName.trim()) {
      setError('Please enter a team name');
      return;
    }

    if (!teamForm.eventId) {
      setError('Please select an event');
      return;
    }

    if (!teamForm.captain.participantId) {
      setError('Please select a team captain');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('Authentication required. Please login again.');
        return;
      }

      const teamData = {
        teamName: teamForm.teamName,
        eventId: teamForm.eventId,
        teamLeaderData: teamForm.captain,
        teamMembers: teamForm.members,
        maxTeamSize: 10, // Default max team size
        status: 'forming'
      };

      const response = await fetch('/api/team-registration/create-team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(teamData)
      });

      if (response.ok) {
        const newTeam = await response.json();
        setSuccess(`Team "${teamForm.teamName}" created successfully!`);
        
        // Reset form
        setTeamForm({
          teamName: '',
          eventId: '',
          captain: { participantId: '', name: '', email: '', phoneNumber: '' },
          members: []
        });
        setShowCreateForm(false);
        setCurrentStep('teamName');
        
        // Refresh teams list
        fetchAllTeams();
        
        if (onTeamCreated) {
          onTeamCreated();
        }
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to create team');
      }
    } catch (error) {
      console.error('Error creating team:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setTeamForm({
      teamName: '',
      eventId: '',
      captain: { participantId: '', name: '', email: '', phoneNumber: '' },
      members: []
    });
    setShowCreateForm(false);
    setCurrentStep('teamName');
    setError('');
    setSuccess('');
    setUserSearchQuery('');
    setSearchResults(participants);
  };

  // Get selected event details
  const selectedEvent = events.find(e => e._id === teamForm.eventId);

  return (
    <div className="team-registration">
      <div className="team-registration-header">
        <h2>Team Registration</h2>
        <p>Create and manage team registrations for events</p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="alert success-alert">
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="alert error-alert">
          {error}
        </div>
      )}

      {/* Main Actions */}
      {!showCreateForm ? (
        <div className="main-actions">
          <button 
            className="btn-primary create-team-btn"
            onClick={() => setShowCreateForm(true)}
          >
            Create Team
          </button>
          
          <button 
            className="btn-secondary"
            onClick={() => setShowCreateForm(false)}
          >
            View Existing Teams
          </button>
        </div>
      ) : (
        /* Team Creation Form */
        <div className="team-creation-form">
          <div className="form-header">
            <h3>Create New Team</h3>
            <button className="btn-cancel" onClick={resetForm}>
              Cancel
            </button>
          </div>

          {/* Step 1: Team Name */}
          {currentStep === 'teamName' && (
            <div className="form-step">
              <h4>Step 1: Enter Team Name</h4>
              <div className="input-group">
                <label>Team Name:</label>
                <input
                  type="text"
                  value={teamForm.teamName}
                  onChange={(e) => setTeamForm(prev => ({ ...prev, teamName: e.target.value }))}
                  placeholder="Enter your team name"
                  className="form-input"
                />
              </div>
              <button 
                className="btn-primary"
                onClick={() => setCurrentStep('event')}
                disabled={!teamForm.teamName.trim()}
              >
                Next: Select Event
              </button>
            </div>
          )}

          {/* Step 2: Event Selection */}
          {currentStep === 'event' && (
            <div className="form-step">
              <h4>Step 2: Select Event</h4>
              <div className="input-group">
                <label>Choose Event:</label>
                <select
                  value={teamForm.eventId}
                  onChange={(e) => setTeamForm(prev => ({ ...prev, eventId: e.target.value }))}
                  className="form-select"
                >
                  <option value="">Select an event...</option>
                  {events.map(event => (
                    <option key={event._id} value={event._id}>
                      {event.title} - {event.category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="step-navigation">
                <button 
                  className="btn-secondary"
                  onClick={() => setCurrentStep('teamName')}
                >
                  Back
                </button>
                <button 
                  className="btn-primary"
                  onClick={() => setCurrentStep('captain')}
                  disabled={!teamForm.eventId}
                >
                  Next: Select Captain
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Captain Selection */}
          {currentStep === 'captain' && (
            <div className="form-step">
              <h4>Step 3: Select Team Captain</h4>
              
              {teamForm.captain.participantId ? (
                <div className="selected-captain">
                  <h5>Selected Captain:</h5>
                  <div className="captain-info">
                    <p><strong>Name:</strong> {teamForm.captain.name}</p>
                    <p><strong>Email:</strong> {teamForm.captain.email}</p>
                    <p><strong>Phone:</strong> {teamForm.captain.phoneNumber}</p>
                    <p><strong>Participant ID:</strong> {teamForm.captain.participantId}</p>
                    <button 
                      className="btn-secondary"
                      onClick={() => setTeamForm(prev => ({ ...prev, captain: { participantId: '', name: '', email: '', phoneNumber: '' } }))}
                    >
                      Change Captain
                    </button>
                  </div>
                </div>
              ) : (
                <div className="captain-selection">
                  <div className="input-group">
                    <label>Search for Captain (by Participant ID, Name, or Email):</label>
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => handleUserSearch(e.target.value)}
                      placeholder="Enter Participant ID, name, or email..."
                      className="form-input"
                    />
                  </div>
                  
                  {searchResults.length > 0 && (
                    <div className="search-results">
                      <h6>Search Results:</h6>
                      <div className="participants-list">
                        {searchResults.slice(0, 5).map(participant => (
                          <div key={participant._id} className="participant-item">
                            <div className="participant-info">
                              <strong>{participant.name}</strong>
                              <p>ID: {participant._id}</p>
                              <p>Email: {participant.email}</p>
                            </div>
                            <button
                              className="btn-primary btn-sm"
                              onClick={() => setCaptain(participant)}
                            >
                              Select as Captain
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="step-navigation">
                <button 
                  className="btn-secondary"
                  onClick={() => setCurrentStep('event')}
                >
                  Back
                </button>
                <button 
                  className="btn-primary"
                  onClick={() => setCurrentStep('members')}
                  disabled={!teamForm.captain.participantId}
                >
                  Next: Add Members
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Members Selection */}
          {currentStep === 'members' && (
            <div className="form-step">
              <h4>Step 4: Add Team Members</h4>
              
              {/* Current Members */}
              {teamForm.members.length > 0 && (
                <div className="current-members">
                  <h5>Team Members ({teamForm.members.length}):</h5>
                  <div className="members-list">
                    {teamForm.members.map(member => (
                      <div key={member.participantId} className="member-item">
                        <div className="member-info">
                          <strong>{member.name}</strong>
                          <p>ID: {member.participantId}</p>
                          <p>Email: {member.email}</p>
                        </div>
                        <button
                          className="btn-danger btn-sm"
                          onClick={() => removeMember(member.participantId)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Add New Member */}
              <div className="add-member">
                <div className="input-group">
                  <label>Search for Team Members (by Participant ID, Name, or Email):</label>
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => handleUserSearch(e.target.value)}
                    placeholder="Enter Participant ID, name, or email..."
                    className="form-input"
                  />
                </div>
                
                {searchResults.length > 0 && userSearchQuery && (
                  <div className="search-results">
                    <h6>Search Results:</h6>
                    <div className="participants-list">
                      {searchResults.slice(0, 5).map(participant => (
                        <div key={participant._id} className="participant-item">
                          <div className="participant-info">
                            <strong>{participant.name}</strong>
                            <p>ID: {participant._id}</p>
                            <p>Email: {participant.email}</p>
                          </div>
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => addMember(participant)}
                            disabled={teamForm.captain.participantId === participant._id || 
                                     teamForm.members.some(m => m.participantId === participant._id)}
                          >
                            {teamForm.captain.participantId === participant._id ? 'Captain' : 
                             teamForm.members.some(m => m.participantId === participant._id) ? 'Added' : 'Add Member'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="step-navigation">
                <button 
                  className="btn-secondary"
                  onClick={() => setCurrentStep('captain')}
                >
                  Back
                </button>
                <button 
                  className="btn-primary"
                  onClick={() => setCurrentStep('review')}
                >
                  Next: Review Team
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Review and Submit */}
          {currentStep === 'review' && (
            <div className="form-step">
              <h4>Step 5: Review Team Details</h4>
              
              <div className="team-review">
                <div className="review-section">
                  <h5>Team Information:</h5>
                  <p><strong>Team Name:</strong> {teamForm.teamName}</p>
                  <p><strong>Event:</strong> {selectedEvent?.title} ({selectedEvent?.category})</p>
                  <p><strong>Total Members:</strong> {teamForm.members.length + 1} (including captain)</p>
                </div>
                
                <div className="review-section">
                  <h5>Team Captain:</h5>
                  <div className="captain-info">
                    <p><strong>Name:</strong> {teamForm.captain.name}</p>
                    <p><strong>Email:</strong> {teamForm.captain.email}</p>
                    <p><strong>Participant ID:</strong> {teamForm.captain.participantId}</p>
                  </div>
                </div>
                
                {teamForm.members.length > 0 && (
                  <div className="review-section">
                    <h5>Team Members:</h5>
                    <div className="members-review">
                      {teamForm.members.map((member, index) => (
                        <div key={member.participantId} className="member-review">
                          <p><strong>Member {index + 1}:</strong> {member.name} ({member.participantId})</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="step-navigation">
                <button 
                  className="btn-secondary"
                  onClick={() => setCurrentStep('members')}
                >
                  Back
                </button>
                <button 
                  className="btn-success form-team-btn"
                  onClick={handleFormTeam}
                  disabled={loading}
                >
                  {loading ? 'Creating Team...' : 'Form Team'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Existing Teams List */}
      {!showCreateForm && allTeams.length > 0 && (
        <div className="existing-teams">
          <h3>Existing Teams ({allTeams.length})</h3>
          <div className="teams-grid">
            {allTeams.map(team => (
              <div key={team._id} className="team-card">
                <h4>{team.teamName}</h4>
                <p><strong>Event:</strong> {team.eventName || 'Unknown Event'}</p>
                <p><strong>Captain:</strong> {team.teamLeader?.name || 'Unknown'}</p>
                <p><strong>Members:</strong> {team.teamMembers?.length || 0}</p>
                <p><strong>Status:</strong> {team.status}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamRegistrationNew;