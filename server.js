const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const players = {};

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Initialize player state
    player[socket.id] = {
        x: Math.random() * 800,
        y: Math.random() * 600,
        score: 0    
    };

    // Send current platers to the new player
    socket.emit('currentPlayers', players);

    // Notify existing players of the new player
    socket.broadcast.emit('newPlayer', { id: socket.id, ...players[socket.id] });

    // Handle player movement
    socket.on('playerMovement', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            // Broadcast the movement to all players
            socket.broadcast.emit('playerMoved', { id: socket.id, x: data.x, y: data.y });
                }
    });

    // Handle player disconnection
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete players[socket.id];
        // Notify all players of the disconnection
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});