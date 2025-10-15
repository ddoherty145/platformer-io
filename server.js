const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const players = {};

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Initialize player state
    players[socket.id] = {
        x: Math.random() * 800,
        y: Math.random() * 600,
        score: 0    
    };

    // Send current players to the new player
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

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const MAX_PORT_RETRIES = 10;

function startServer(port, attempt = 0) {
    http.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });

    http.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
            if (attempt < MAX_PORT_RETRIES) {
                const nextPort = port + 1;
                console.warn(`Port ${port} in use, retrying on ${nextPort} (attempt ${attempt + 1}/${MAX_PORT_RETRIES})`);
                // Remove current error listener before retrying to avoid multiple bindings
                http.removeAllListeners('error');
                startServer(nextPort, attempt + 1);
            } else {
                console.error(`Failed to bind after ${MAX_PORT_RETRIES} attempts starting at ${DEFAULT_PORT}. Exiting.`);
                process.exit(1);
            }
        } else {
            throw err;
        }
    });
}

startServer(DEFAULT_PORT);