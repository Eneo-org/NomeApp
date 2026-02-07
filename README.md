gi# Trento Partecipa

A full-stack web application for participatory budgeting and citizen initiatives, enabling democratic participation in local government decision-making.

🌐 **Live Demo:** [trentopartecipa.me](https://trentopartecipa.me)

---

## 📋 Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Database Setup](#database-setup)
  - [Environment Configuration](#environment-configuration)
  - [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## 🎯 About

Trento Partecipa is a platform designed to facilitate citizen engagement in local governance through:
- **Participatory Budgeting**: Citizens can vote on budget allocation proposals
- **Citizen Initiatives**: Community members can submit and track proposals for local improvements
- **Administrative Dashboard**: Tools for moderators to manage submissions and track progress

---

## ✨ Features

- 📊 Interactive participatory budgeting with real-time voting
- 💡 Citizen initiative submission and tracking
- 👥 User authentication with Google OAuth integration
- 🔔 Email notifications for status updates
- 📱 Responsive design for mobile and desktop
- 🛡️ Role-based access control (Citizen, Moderator, Admin)
- 📈 Administrative dashboard with analytics
- 🗄️ Archive system for past budgets and initiatives

---

## 🛠️ Tech Stack

**Frontend:**
- Vue.js 3 with Composition API
- Vite for build tooling
- Vue Router for navigation
- Pinia for state management
- Axios for HTTP requests

**Backend:**
- Node.js with Express
- MySQL database
- JWT authentication
- Nodemailer for email notifications
- Node-cron for scheduled tasks
- Multer for file uploads

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:
- **Node.js** (v20.19.0 or higher / v22.12.0 or higher)
- **npm** (comes with Node.js)
- **MySQL** (8.0 or higher)
- A MySQL client (MySQL Workbench, DBeaver, phpMyAdmin, etc.)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd NomeApp
   ```

2. **Install root dependencies:**
   ```bash
   npm install
   ```

3. **Install client dependencies:**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Install server dependencies:**
   ```bash
   cd server/backend
   npm install
   cd ../..
   ```

### Database Setup

1. **Create a new MySQL database:**
   - Open your MySQL client (Workbench, DBeaver, phpMyAdmin, etc.)
   - Create a new empty schema/database named `NomeApp` (or any name you prefer)
   
2. **Import the database schema:**
   - Navigate to the newly created schema
   - Run the SQL script located at `/server/DatabaseRelazionale/creazioneDB.sql`
   
   > ⚠️ **Important:** The SQL script creates all tables (`UTENTE`, `BILANCIO_PARTECIPATIVO`, `INIZIATIVA`, etc.) but does **not** create the database itself. Make sure you have selected your schema before executing the script.

### Environment Configuration

Create a `.env` file in the `server/backend` directory with the following configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=NomeApp

# Server Configuration
PORT=3000
NODE_ENV=development

# Authentication (optional for local development)
# JWT_SECRET=your_jwt_secret
# GOOGLE_CLIENT_ID=your_google_client_id
```

> ⚠️ **Security Note:** Never commit the `.env` file to version control. Make sure it's listed in `.gitignore`.

### Running the Application

You'll need to run both the client and server in separate terminal windows.

**Terminal 1 - Start the Backend:**
```bash
cd server/backend
npm run dev
```
The server will start on `http://localhost:3000`

**Terminal 2 - Start the Frontend:**
```bash
cd client
npm run dev
```
The client will start on `http://localhost:5173` (or the next available port)

You should see output similar to:
```
Server running on port 3000...
🔌 Connected to database: NomeApp (Mode: dev)
```

---

## 📁 Project Structure

```
NomeApp/
├── client/                 # Vue.js frontend application
│   ├── src/
│   │   ├── components/    # Reusable Vue components
│   │   ├── views/         # Page components
│   │   ├── stores/        # Pinia state management
│   │   ├── router/        # Vue Router configuration
│   │   └── composables/   # Composable functions
│   └── package.json
│
├── server/
│   └── backend/           # Express.js backend application
│       ├── src/
│       │   ├── controllers/  # Request handlers
│       │   ├── routes/       # API route definitions
│       │   ├── middleware/   # Express middleware
│       │   ├── services/     # Business logic
│       │   ├── validators/   # Input validation
│       │   └── config/       # Configuration files
│       ├── __tests__/        # Test files
│       └── package.json
│
└── deliverable/           # Project documentation
```

---

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run backend tests only
cd server/backend
npm test
```

---

## 🌐 Deployment

The application is currently deployed at [trentopartecipa.me](https://trentopartecipa.me).

For production deployment:
- Frontend is built with `npm run build` in the client directory
- Backend requires MySQL database and proper environment variables
- SSL is configured for secure connections
- The database uses DigitalOcean Managed Databases (port 25060)

---

## 👥 Contributing

This project is part of an academic coursework. If you're a team member:

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit your changes: `git commit -m 'Add some feature'`
3. Push to the branch: `git push origin feature/your-feature`
4. Open a Pull Request

> ⚠️ **Important:** Be careful not to commit local configuration files (`.env`, `db.js` with passwords) to avoid overwriting other team members' settings.

---

## 📝 License

This project is developed for educational purposes.

---

## 📧 Contact

For questions or support, please contact the development team.

