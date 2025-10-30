💬 Real-Time Chat Application

A full-stack real-time chat app built with React (frontend) and Node.js + Socket.io (backend).
This app allows users to join chat rooms, send and receive messages instantly, see who’s online, and display typing indicators — all in real-time.

🚀 Features

Real-time messaging using Socket.IO

Join chat rooms by unique room ID or name

Show active users in each room

Typing indicators

Multiple users chat simultaneously

Responsive and clean UI built with Tailwind CSS

Backend API endpoints for rooms and health check

🧩 Tech Stack

Frontend: React + Vite + TailwindCSS + Socket.io-client
Backend: Node.js + Express + Socket.io + CORS

📁 Folder Structure

real-time-chat-app/
├── frontend/ (React App)
│ ├── src/
│ ├── package.json
│ └── vite.config.js
│
├── backend/ (Node.js + Socket.io Server)
│ ├── index.js
│ ├── package.json
│ └── ...
│
└── README.md

⚙️ Setup Instructions
1. Clone the Repository

git clone https://github.com/
<your-username>/real-time-chat-app.git
cd real-time-chat-app

2. Setup Backend

cd backend
npm install
npm start

Server will start at http://localhost:4000

3. Setup Frontend

Open a new terminal:
cd frontend
npm install
npm run dev

Frontend runs at http://localhost:5173

🌐 Environment Variables (Optional for Deployment)

Create a .env file in your frontend folder:
VITE_SERVER_URL=https://your-backend-domain.com

🧠 API Endpoints

Method | Endpoint | Description
GET | /api/health | Check backend server health
GET | /api/rooms | Get list of active chat rooms

📸 Preview

(Add screenshots or demo GIFs here)

🧑‍💻 Author

Name: Chirag Pandhare
Tech: React, Node.js, Socket.io
GitHub: https://github.com/chiragpandhare

🛡️ License

This project is licensed under the MIT License © 2025 Chirag Pandhare