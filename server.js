const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const GAME_WIDTH = 3000;
const GAME_HEIGHT = 600;
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const MOVE_SPEED = 5;
const GROUND_Y = 550;

const players = {};
const playerColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#fd79a8'];
let colorIndex = 0;

// Game state
const gameState = {
  started: false,
  winner: null
};

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Assign player color
  const playerColor = playerColors[colorIndex % playerColors.length];
  colorIndex++;
  
  // Initialize new player
  players[socket.id] = {
    id: socket.id,
    x: 100,
    y: GROUND_Y - 30,
    vx: 0,
    vy: 0,
    width: 30,
    height: 30,
    color: playerColor,
    onGround: true,
    finished: false,
    finishTime: null,
    name: `Player${Object.keys(players).length}`
  };
  
  // Send game state to new player
  socket.emit('init', {
    id: socket.id,
    players: players,
    gameState: gameState
  });
  
  // Notify others about new player
  socket.broadcast.emit('newPlayer', players[socket.id]);
  
  // Handle player input
  socket.on('input', (input) => {
    const player = players[socket.id];
    if (!player || player.finished) return;
    
    player.vx = 0;
    
    if (input.left) player.vx = -MOVE_SPEED;
    if (input.right) player.vx = MOVE_SPEED;
    if (input.jump && player.onGround) {
      player.vy = JUMP_FORCE;
      player.onGround = false;
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
    
    // Reset game if no players
    if (Object.keys(players).length === 0) {
      gameState.started = false;
      gameState.winner = null;
    }
  });
});

// Game loop - runs on server
setInterval(() => {
  Object.values(players).forEach(player => {
    if (player.finished) return;
    
    // Apply gravity
    player.vy += GRAVITY;
    
    // Update position
    player.x += player.vx;
    player.y += player.vy;
    
    // Ground collision
    if (player.y >= GROUND_Y - player.height) {
      player.y = GROUND_Y - player.height;
      player.vy = 0;
      player.onGround = true;
    }
    
    // Boundary check
    if (player.x < 0) player.x = 0;
    if (player.x > GAME_WIDTH) player.x = GAME_WIDTH;
    
    // Check if reached finish line
    if (player.x >= GAME_WIDTH - 100 && !player.finished) {
      player.finished = true;
      player.finishTime = Date.now();
      
      // Check if first to finish
      if (!gameState.winner) {
        gameState.winner = {
          id: player.id,
          name: player.name,
          color: player.color
        };
        io.emit('gameWon', gameState.winner);
      }
      
      io.emit('playerFinished', {
        id: player.id,
        name: player.name,
        position: Object.values(players).filter(p => p.finished).length
      });
    }
  });
  
  // Broadcast game state to all clients
  io.emit('update', players);
}, 1000 / 60); // 60 FPS

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});