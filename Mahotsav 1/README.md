# Mahotsav Event Management System

A full-stack web application for managing festival events with coordinator dashboard and participant registration.

## 🏗️ Architecture

- **Frontend**: React TypeScript with React Router
- **Backend**: Node.js with Express
- **Database**: MongoDB Atlas
- **Authentication**: JWT tokens

## 📁 Project Structure

```
Mahotsav/
├── frontend/          # React TypeScript application
│   ├── src/
│   │   ├── components/
│   │   │   ├── LoginPage.tsx/css
│   │   │   └── CoordinatorDashboard.tsx/css
│   │   ├── App.tsx
│   │   └── ...
│   └── package.json
├── backend/           # Node.js Express API
│   ├── models/        # MongoDB schemas
│   ├── routes/        # API endpoints
│   ├── middleware/    # Authentication & error handling
│   ├── server.js      # Main server file
│   └── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- MongoDB Atlas account (connection string provided)

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create default coordinator account:
   ```bash
   npm run seed
   ```

4. Start the server:
   ```bash
   npm run dev
   # or
   node server.js
   ```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

The frontend will run on `http://localhost:3000`

## 🔐 Default Login Credentials

After running the seed script, use these credentials to login:

- **Username**: `admin`
- **Password**: `admin123`
- **Email**: `admin@mahotsav.com`

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - Login coordinator
- `POST /api/auth/register` - Register new coordinator
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/logout` - Logout user

### Coordinator Dashboard
- `GET /api/coordinator/dashboard/stats` - Get dashboard statistics
- `GET /api/coordinator/events` - Get coordinator's events
- `POST /api/coordinator/events` - Create new event
- `GET /api/coordinator/events/:id/participants` - Get event participants
- `PUT /api/coordinator/participants/:id/status` - Update participant status

### Health Check
- `GET /api/health` - Server health status

## 🎯 Features

### Login Page
- ✅ Responsive design
- ✅ Form validation
- ✅ JWT authentication
- ✅ Error handling
- ✅ Loading states

### Coordinator Dashboard
- ✅ Real-time statistics
- ✅ Recent activities feed
- ✅ Quick action cards
- ✅ Responsive layout
- ✅ Secure logout
- ✅ Live clock

### Backend API
- ✅ MongoDB integration
- ✅ JWT authentication
- ✅ Input validation
- ✅ Error handling
- ✅ CORS configuration
- ✅ Rate limiting
- ✅ Security headers

## 🗄️ Database Models

### Coordinator
- Username, email, password (hashed)
- First name, last name, department
- Role (coordinator/admin)
- Active status, last login

### Event
- Title, description, category
- Date, registration dates
- Venue, participant limits
- Status, rules, prizes

### Participant
- Personal information
- Event registration
- Payment status
- Team members (for group events)

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Rate limiting
- CORS configuration
- Input validation
- Error handling middleware
- Security headers with Helmet

## 🚦 Environment Variables

Create `.env` file in backend directory:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
MONGODB_URI=mongodb+srv://mahotsavvignan2025_db_user:mYzQ87sgJ3vKbh0L@events.nghtwjg.mongodb.net/?appName=Events
JWT_SECRET=mahotsav_super_secret_key_2025_coordinator_dashboard
JWT_EXPIRES_IN=7d
DB_NAME=mahotsav_events
```

## 🧪 Testing the Application

1. Start both backend and frontend servers
2. Navigate to `http://localhost:3000`
3. Login with default credentials: `admin` / `admin123`
4. Explore the coordinator dashboard

## 📝 Development Notes

- Frontend uses localStorage for authentication state
- Backend connects to MongoDB Atlas
- JWT tokens expire in 7 days
- CORS is configured for frontend communication
- All API endpoints are prefixed with `/api`

## 🔄 Next Steps

- Add event creation/management functionality
- Implement participant registration
- Add file upload capabilities
- Create admin panel
- Add email notifications
- Implement payment integration
- Add reporting and analytics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues or questions, please contact the development team.