import React, { useState, useEffect, useRef } from "react";
import { Send, Users, LogOut, Circle, AlertCircle } from "lucide-react";
import io from "socket.io-client";

function App() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [room, setRoom] = useState("");
  const [joined, setJoined] = useState(false);
  const [username, setUsername] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState("");
  const [isTypingOther, setIsTypingOther] = useState(false);
  const [isLocalTyping, setIsLocalTyping] = useState(false);
  
  const chatBoxRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const socketRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    const socket = io(import.meta.env.VITE_SERVER_URL || "http://localhost:4000", {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setError("");
      console.log("✅ Connected to server");
    });

    socket.on("connect_error", (error) => {
      setError(`Connection error: ${error.message}`);
      console.error("Connection error:", error);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("❌ Disconnected from server");
    });

    socket.on("receive_message", (data) => {
      setChat((prev) => [...prev, data]);
    });

    socket.on("user_list_update", (users) => {
      setOnlineUsers(users);
    });

    socket.on("room_users", (users) => {
      setOnlineUsers(users);
    });

    socket.on("user_typing", (data) => {
      if (data.username !== username) {
        setIsTypingOther(data.isTyping);
      }
    });

    socket.on("error", (errorMsg) => {
      setError(errorMsg);
    });

    // Cleanup function
    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("disconnect");
      socket.off("receive_message");
      socket.off("user_list_update");
      socket.off("room_users");
      socket.off("user_typing");
      socket.off("error");
      socket.disconnect();
    };
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    if (chatBoxRef.current) {
      setTimeout(() => {
        chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
      }, 0);
    }
  }, [chat]);

  // Focus input when joined
  useEffect(() => {
    if (joined && inputRef.current) {
      inputRef.current.focus();
    }
  }, [joined]);

  const validateInputs = () => {
    const trimmedUsername = username.trim();
    const trimmedRoom = room.trim();

    if (!trimmedUsername) {
      setError("Username is required");
      return false;
    }
    if (trimmedUsername.length < 2 || trimmedUsername.length > 20) {
      setError("Username must be between 2-20 characters");
      return false;
    }
    if (!trimmedRoom) {
      setError("Room ID is required");
      return false;
    }
    if (trimmedRoom.length < 2 || trimmedRoom.length > 20) {
      setError("Room ID must be between 2-20 characters");
      return false;
    }
    return true;
  };

  const joinRoom = () => {
    setError("");
    if (!validateInputs()) return;

    try {
      socketRef.current.emit("join_room", {
        room: room.trim(),
        username: username.trim()
      });
      setJoined(true);
      setChat([]); // Clear chat for new room
    } catch (err) {
      setError("Failed to join room. Please try again.");
      console.error("Join error:", err);
    }
  };

  const sendMessage = () => {
    if (message.trim() === "") return;

    try {
      const msgData = {
        room,
        author: username,
        message: message.trim(),
        timestamp: Date.now()
      };

      socketRef.current.emit("send_message", msgData);
      setMessage("");
      setIsLocalTyping(false);

      // Stop typing indicator
      socketRef.current.emit("typing", { room, username, isTyping: false });
    } catch (err) {
      setError("Failed to send message");
      console.error("Send error:", err);
    }
  };

  const leaveRoom = () => {
    try {
      socketRef.current.emit("leave_room");
      setJoined(false);
      setRoom("");
      setChat([]);
      setOnlineUsers([]);
      setError("");
      setIsLocalTyping(false);
    } catch (err) {
      setError("Error leaving room");
      console.error("Leave error:", err);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTyping = (e) => {
    const newMessage = e.target.value;
    setMessage(newMessage);

    if (newMessage.trim() && !isLocalTyping) {
      socketRef.current.emit("typing", { room, username, isTyping: true });
      setIsLocalTyping(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current.emit("typing", { room, username, isTyping: false });
      setIsLocalTyping(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        {!joined ? (
          <div className="p-8 md:p-12">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Join Chat Room</h2>
              <p className="text-gray-600">Connect and chat in real-time</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-2 items-start max-w-md mx-auto">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            )}

            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  placeholder="Enter your name (2-20 chars)..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && joinRoom()}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none transition-colors"
                  maxLength={20}
                  disabled={!isConnected}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room ID
                </label>
                <input
                  type="text"
                  placeholder="Enter room code (2-20 chars)..."
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && joinRoom()}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none transition-colors"
                  maxLength={20}
                  disabled={!isConnected}
                />
              </div>

              {!isConnected && (
                <p className="text-center text-amber-600 text-sm">
                  Connecting to server...
                </p>
              )}

              <button
                onClick={joinRoom}
                disabled={!username.trim() || !room.trim() || !isConnected}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                Join Room
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-[600px]">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Room: {room}</h3>
                <div className="flex items-center gap-2 text-sm opacity-90">
                  <Circle className={`w-2 h-2 ${isConnected ? 'fill-green-400' : 'fill-yellow-400'}`} />
                  <span>{isConnected ? 'Connected' : 'Reconnecting...'}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">{onlineUsers.length}</span>
                </div>
                <button
                  onClick={leaveRoom}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Leave</span>
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div
              ref={chatBoxRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50"
            >
              {chat.length === 0 && (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p className="text-center">
                    <p className="text-lg mb-1">No messages yet</p>
                    <p className="text-sm">Start the conversation!</p>
                  </p>
                </div>
              )}

              {chat.map((msg) => (
                <div key={msg.timestamp ? `${msg.author}-${msg.timestamp}` : Math.random()}>
                  {msg.type === "system" ? (
                    <div className="flex justify-center">
                      <div className="bg-gray-300 text-gray-700 px-4 py-1 rounded-full text-sm">
                        {msg.message}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`flex ${
                        msg.author === username ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-xs md:max-w-md lg:max-w-lg ${
                          msg.author === username
                            ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                            : "bg-white text-gray-800 border border-gray-200"
                        } rounded-2xl px-4 py-3 shadow-md`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">
                            {msg.author === username ? "You" : msg.author}
                          </span>
                          <span
                            className={`text-xs ${
                              msg.author === username
                                ? "text-indigo-100"
                                : "text-gray-500"
                            }`}
                          >
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>
                        <p className="break-words">{msg.message}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isTypingOther && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-md">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-gray-200 p-4">
              {error && (
                <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={message}
                  placeholder="Type a message..."
                  onChange={handleTyping}
                  onKeyPress={handleKeyPress}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none transition-colors"
                  maxLength={500}
                  disabled={!isConnected}
                />
                <button
                  onClick={sendMessage}
                  disabled={!message.trim() || !isConnected}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;