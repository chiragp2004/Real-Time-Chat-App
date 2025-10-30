const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173", // Vite default
      "http://localhost:3000",
      "http://localhost:4000",
      "http://127.0.0.1:5173"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Store room data and online users
const rooms = new Map();
const userSockets = new Map();
const messageLimiter = new Map();

// Constants
const MAX_USERNAME_LENGTH = 20;
const MIN_USERNAME_LENGTH = 2;
const MAX_ROOM_LENGTH = 20;
const MIN_ROOM_LENGTH = 2;
const MAX_MESSAGE_LENGTH = 500;
const MESSAGE_RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 5000;

// Validation helpers
const validateUsername = (username) => {
  if (!username || typeof username !== "string") return false;
  const trimmed = username.trim();
  return trimmed.length >= MIN_USERNAME_LENGTH && trimmed.length <= MAX_USERNAME_LENGTH;
};

const validateRoom = (room) => {
  if (!room || typeof room !== "string") return false;
  const trimmed = room.trim();
  return trimmed.length >= MIN_ROOM_LENGTH && trimmed.length <= MAX_ROOM_LENGTH;
};

const validateMessage = (message) => {
  if (!message || typeof message !== "string") return false;
  return message.trim().length > 0 && message.length <= MAX_MESSAGE_LENGTH;
};

const checkRateLimit = (socketId) => {
  const now = Date.now();
  const userLimit = messageLimiter.get(socketId) || [];
  const recentMessages = userLimit.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (recentMessages.length >= MESSAGE_RATE_LIMIT) {
    return false;
  }
  
  recentMessages.push(now);
  messageLimiter.set(socketId, recentMessages);
  return true;
};

const getRoomUsers = (room) => {
  const users = rooms.get(room) || [];
  return users;
};

const userExistsInRoom = (room, username) => {
  const users = getRoomUsers(room);
  return users.some(u => u.username.toLowerCase() === username.toLowerCase());
};

const addUserToRoom = (room, username, socketId) => {
  if (!rooms.has(room)) {
    rooms.set(room, []);
  }
  const users = rooms.get(room);
  if (!users.find(u => u.socketId === socketId)) {
    users.push({
      username: username.trim(),
      socketId,
      joinedAt: new Date()
    });
  }
  userSockets.set(socketId, { room: room.trim(), username: username.trim() });
};

const removeUserFromRoom = (socketId) => {
  const userData = userSockets.get(socketId);
  if (userData) {
    const { room, username } = userData;
    if (rooms.has(room)) {
      const users = rooms.get(room).filter(u => u.socketId !== socketId);
      if (users.length === 0) {
        rooms.delete(room);
      } else {
        rooms.set(room, users);
      }
    }
    userSockets.delete(socketId);
    messageLimiter.delete(socketId);
    return { room, username };
  }
  return null;
};

// Connection handling
io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);
  console.log("🔍 Transport:", socket.conn.transport.name);
  console.log("👥 Total connected:", io.engine.clientsCount);

  socket.on("join_room", (data) => {
    try {
      const { room, username } = data;

      if (!validateUsername(username)) {
        socket.emit("error", "Invalid username. Use 2-20 characters.");
        return;
      }

      if (!validateRoom(room)) {
        socket.emit("error", "Invalid room ID. Use 2-20 characters.");
        return;
      }

      if (userExistsInRoom(room, username)) {
        socket.emit("error", "Username already taken in this room.");
        return;
      }

      socket.join(room);
      addUserToRoom(room, username, socket.id);

      console.log(`👤 ${username} joined room: ${room}`);

      const roomUsers = getRoomUsers(room);
      socket.emit("room_users", roomUsers.map(u => ({ username: u.username })));

      io.to(room).emit("user_list_update", roomUsers.map(u => ({ username: u.username })));

      const joinMessage = {
        type: "system",
        message: `${username} joined the room`,
        timestamp: Date.now()
      };
      socket.to(room).emit("receive_message", joinMessage);

    } catch (err) {
      console.error("Join room error:", err);
      socket.emit("error", "Failed to join room");
    }
  });

  socket.on("send_message", (data) => {
    try {
      if (!checkRateLimit(socket.id)) {
        socket.emit("error", "Too many messages. Please slow down.");
        return;
      }

      const { room, author, message } = data;

      if (!validateRoom(room)) {
        socket.emit("error", "Invalid room");
        return;
      }

      if (!validateUsername(author)) {
        socket.emit("error", "Invalid username");
        return;
      }

      if (!validateMessage(message)) {
        socket.emit("error", "Invalid message");
        return;
      }

      const userData = userSockets.get(socket.id);
      if (!userData || userData.room !== room || userData.username !== author) {
        socket.emit("error", "Unauthorized message");
        return;
      }

      console.log("📩 Message from", author, ":", message.substring(0, 50));

      const messageData = {
        type: "user",
        room,
        author,
        message: message.trim(),
        timestamp: Date.now(),
        id: `${socket.id}-${Date.now()}`
      };

      io.to(room).emit("receive_message", messageData);

    } catch (err) {
      console.error("Send message error:", err);
      socket.emit("error", "Failed to send message");
    }
  });

  socket.on("typing", (data) => {
    try {
      const { room, username, isTyping } = data;

      if (!validateRoom(room) || !validateUsername(username)) {
        return;
      }

      const userData = userSockets.get(socket.id);
      if (!userData || userData.room !== room) {
        return;
      }

      socket.to(room).emit("user_typing", {
        username,
        isTyping
      });

    } catch (err) {
      console.error("Typing error:", err);
    }
  });

  socket.on("leave_room", () => {
    try {
      const userData = userSockets.get(socket.id);
      if (userData) {
        const { room, username } = userData;
        socket.leave(room);

        removeUserFromRoom(socket.id);

        const leaveMessage = {
          type: "system",
          message: `${username} left the room`,
          timestamp: Date.now()
        };
        io.to(room).emit("receive_message", leaveMessage);

        const roomUsers = getRoomUsers(room);
        io.to(room).emit("user_list_update", roomUsers.map(u => ({ username: u.username })));

        console.log(`👋 ${username} left room: ${room}`);
      }
    } catch (err) {
      console.error("Leave room error:", err);
    }
  });

  socket.on("disconnect", () => {
    try {
      console.log("❌ User disconnected:", socket.id);

      const userData = removeUserFromRoom(socket.id);
      if (userData) {
        const { room, username } = userData;

        const leaveMessage = {
          type: "system",
          message: `${username} left the room`,
          timestamp: Date.now()
        };
        io.to(room).emit("receive_message", leaveMessage);

        const roomUsers = getRoomUsers(room);
        if (roomUsers.length > 0) {
          io.to(room).emit("user_list_update", roomUsers.map(u => ({ username: u.username })));
        }

        console.log(`👋 ${username} disconnected from room: ${room}`);
      }
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  });

  socket.on("connect_error", (error) => {
    console.error("❌ Connection error:", error);
  });
});

// REST API endpoints
app.get("/api/rooms", (req, res) => {
  try {
    const roomData = Array.from(rooms.entries()).map(([room, users]) => ({
      room,
      userCount: users.length,
      users: users.map(u => u.username)
    }));
    res.json(roomData);
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size,
    activeUsers: userSockets.size
  });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  console.log(`📋 Rooms: http://localhost:${PORT}/api/rooms`);
  console.log(`✅ CORS enabled for: http://localhost:5173`);
});