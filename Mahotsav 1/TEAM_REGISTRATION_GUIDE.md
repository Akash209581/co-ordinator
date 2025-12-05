# Team Registration System - User-Centric Workflow

This system implements a user-centric team registration workflow where you select a participant first, verify their event registration, and then form teams.

## Key Features

### 🎯 **User-Centric Workflow:**
1. **Select Participant** - Choose from dropdown of all participants
2. **Verify Event Registration** - Check if user is registered for team events
3. **Register for Events** - If not registered, add them to events first
4. **Form Teams** - Create teams only for events they're registered for
5. **Payment Validation** - Teams register only after all members pay
6. **Database Storage** - Saves to `test.eventsregistration` collection

## Workflow Steps

### Step 1: Select Participant
- Dropdown shows all participants with name and email
- Selecting participant loads their registration status
- Shows participant details (name, email, phone)

### Step 2: Check Event Registration Status
- ✅ **If Registered**: Shows team events they're registered for
- ⚠️ **If Not Registered**: Shows warning and "Register for Event" button
- Prevents team formation without event registration

### Step 3: Event Registration (if needed)
- Modal popup with available team events
- One-click registration for events
- Refreshes registration status automatically

### Step 4: Form Team
- "Form Team" button appears for registered events
- Selected participant becomes team leader automatically
- Creates team with unique name validation

### Step 5: Team Management
- Add/remove team members
- Track payment status for each member
- Register team only when all payments complete

## Setup Instructions

### 1. Add Routes to Server.js:
```javascript
app.use('/api/participants', require('./routes/participants'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/team-registration', require('./routes/teamRegistration'));
```

### 2. Use Component:
```jsx
<TeamRegistration onTeamCreated={handleTeamCreated} />
```

This system ensures that team formation is always based on valid individual event registrations, maintaining data consistency and preventing registration errors.