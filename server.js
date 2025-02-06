const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const MONGO_URI = "mongodb+srv://nithiyan:NithiyanUkt18@mycluster.cjb8b.mongodb.net/?retryWrites=true&w=majority";

// Connect to MongoDB
mongoose.connect(MONGO_URI).then(() => console.log('MongoDB connected...')).catch(err => console.log(err));

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// User Schema
const userSchema = new mongoose.Schema({
    username: String,
    firstname: String,
    lastname: String,
    password: String,
    createdOn: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Group Message Schema
const groupMessageSchema = new mongoose.Schema({
    from_user: String,
    room: String,
    message: String,
    date_sent: { type: Date, default: Date.now }
});
const GroupMessage = mongoose.model('GroupMessage', groupMessageSchema);

// Private Message Schema
const privateMessageSchema = new mongoose.Schema({
    from_user: String,
    to_user: String,
    message: String,
    date_sent: { type: Date, default: Date.now }
});
const PrivateMessage = mongoose.model('PrivateMessage', privateMessageSchema);

// Routes
app.post('/signup', async (req, res) => {
    const { username, firstname, lastname, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, firstname, lastname, password: hashedPassword });
    newUser.save()
        .then(user => res.status(201).json(user))
        .catch(err => res.status(500).json({ error: err.message }));
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
        res.status(200).json(user);
    } else {
        res.status(400).json({ error: 'Invalid credentials' });
    }
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle joining room
    socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`User joined room: ${room}`);
    });

    // Handle leaving room
    socket.on('leaveRoom', (room) => {
        socket.leave(room);
        console.log(`User left room: ${room}`);
    });

    // Handle chat message
    socket.on('chatMessage', (msg) => {
        const newMessage = new GroupMessage(msg);
        newMessage.save();
        io.to(msg.room).emit('message', msg);
    });

    // Handle private message
    socket.on('privateMessage', (msg) => {
        const newMessage = new PrivateMessage(msg);
        newMessage.save();
        io.to(msg.to_user).emit('privateMessage', msg);
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
        if (data.room) {
            socket.to(data.room).broadcast.emit('typing', data);
            console.log(`User is typing in room: ${data.room}`);
        } else {
            console.log('Error: room is undefined');
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Start the server
server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
