const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const GAME_WIDTH = 800;
const GAME_HEIGHT = 3000;
const GRAVITY = 0.5;
const JUMP_FORCE = -15; // Balanced jump height between -12 and -18
const MOVE_SPEED = 5;
const GROUND_Y = GAME_HEIGHT - 50;
const FINISH_Y = 50; // Finish line at the top

const players = {};
const playerColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#fd79a8'];
let colorIndex = 0;

// Platform types and data
const platforms = [
  // Normal platforms - Ground level and close to ground
  { id: 'normal1', x: 100, y: 2500, w: 150, h: 20, type: 'normal' },
  { id: 'normal2', x: 300, y: 2200, w: 150, h: 20, type: 'normal' },
  { id: 'normal3', x: 500, y: 1900, w: 150, h: 20, type: 'normal' },
  { id: 'normal4', x: 200, y: 1600, w: 150, h: 20, type: 'normal' },
  { id: 'normal5', x: 400, y: 1300, w: 150, h: 20, type: 'normal' },
  { id: 'normal6', x: 100, y: 1000, w: 150, h: 20, type: 'normal' },
  { id: 'normal7', x: 300, y: 700, w: 150, h: 20, type: 'normal' },
  { id: 'normal8', x: 500, y: 400, w: 150, h: 20, type: 'normal' },
  
  // Additional platforms closer to ground
  { id: 'normal9', x: 200, y: 2800, w: 150, h: 20, type: 'normal' },
  { id: 'normal10', x: 400, y: 2700, w: 150, h: 20, type: 'normal' },
  { id: 'normal11', x: 100, y: 2600, w: 150, h: 20, type: 'normal' },
  { id: 'normal12', x: 500, y: 2500, w: 150, h: 20, type: 'normal' },
  { id: 'normal13', x: 300, y: 2400, w: 150, h: 20, type: 'normal' },
  
  // Moving platforms
  { id: 'moving1', x: 200, y: 2400, w: 120, h: 20, type: 'moving', startX: 200, endX: 500, speed: 1 },
  { id: 'moving2', x: 300, y: 1800, w: 120, h: 20, type: 'moving', startX: 300, endX: 600, speed: 1.5 },
  { id: 'moving3', x: 100, y: 1200, w: 120, h: 20, type: 'moving', startX: 100, endX: 400, speed: 2 },
  { id: 'moving4', x: 400, y: 600, w: 120, h: 20, type: 'moving', startX: 400, endX: 700, speed: 1.2 },
  
  // Additional moving platforms near ground
  { id: 'moving5', x: 350, y: 2600, w: 120, h: 20, type: 'moving', startX: 350, endX: 650, speed: 1.3 },
  { id: 'moving6', x: 150, y: 2300, w: 120, h: 20, type: 'moving', startX: 150, endX: 450, speed: 1.8 },
  
  // Disappearing platforms
  { id: 'disappear1', x: 350, y: 2100, w: 100, h: 20, type: 'disappearing', visible: true, timer: 0 },
  { id: 'disappear2', x: 150, y: 1500, w: 100, h: 20, type: 'disappearing', visible: true, timer: 0 },
  { id: 'disappear3', x: 450, y: 900, w: 100, h: 20, type: 'disappearing', visible: true, timer: 0 },
  { id: 'disappear4', x: 250, y: 300, w: 100, h: 20, type: 'disappearing', visible: true, timer: 0 },
  
  // Additional disappearing platforms near ground
  { id: 'disappear5', x: 250, y: 2700, w: 100, h: 20, type: 'disappearing', visible: true, timer: 0 },
  { id: 'disappear6', x: 450, y: 2400, w: 100, h: 20, type: 'disappearing', visible: true, timer: 0 },
  
  // Final disappearing platform near finish line
  { id: 'disappear7', x: 350, y: 150, w: 100, h: 20, type: 'disappearing', visible: true, timer: 0 }
];

// Platform physics
function updatePlatforms() {
  platforms.forEach(platform => {
    if (platform.type === 'moving') {
      // Move platform back and forth
      platform.x += platform.speed;
      if (platform.x >= platform.endX || platform.x <= platform.startX) {
        platform.speed = -platform.speed;
      }
    } else if (platform.type === 'disappearing') {
      // Update disappearing platform timer
      platform.timer += 16; // Assuming 60fps
      if (platform.visible && platform.timer >= 2000) { // 2 seconds
        platform.visible = false;
        platform.timer = 0;
      } else if (!platform.visible && platform.timer >= 2000) { // 2 seconds invisible
        platform.visible = true;
        platform.timer = 0;
      }
    }
  });
}

// Platform collision detection
function checkPlatformCollision(player) {
  if (player.vy <= 0) return false; // Only check when falling
  
  const playerBottom = player.y + player.height;
  const playerLeft = player.x;
  const playerRight = player.x + player.width;
  
  for (const platform of platforms) {
    if (platform.type === 'disappearing' && !platform.visible) continue;
    
    const platformTop = platform.y;
    const platformBottom = platform.y + platform.h;
    const platformLeft = platform.x;
    const platformRight = platform.x + platform.w;
    
    // Check if player is falling onto platform
    if (playerBottom >= platformTop && playerBottom <= platformTop + 10 &&
        playerLeft < platformRight && playerRight > platformLeft) {
      player.y = platformTop - player.height;
      player.vy = 0;
      player.onGround = true;
      return true;
    }
  }
  return false;
}

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
     x: GAME_WIDTH / 2, // Start in the middle horizontally
     y: GROUND_Y - 30, // Start at the bottom
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
    gameState: gameState,
    platforms: platforms
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
  // Update platforms
  updatePlatforms();
  
  Object.values(players).forEach(player => {
    if (player.finished) return;
    
    // Apply gravity
    player.vy += GRAVITY;
    
    // Update position
    player.x += player.vx;
    player.y += player.vy;
    
    // Reset onGround flag
    player.onGround = false;
    
    // Ground collision
    if (player.y >= GROUND_Y - player.height) {
      player.y = GROUND_Y - player.height;
      player.vy = 0;
      player.onGround = true;
    }
    
    // Platform collision
    if (checkPlatformCollision(player)) {
      player.onGround = true;
    }
    
     // Boundary check
     if (player.x < 0) player.x = 0;
     if (player.x > GAME_WIDTH - player.width) player.x = GAME_WIDTH - player.width;
     
     // Check if reached finish line (at the top)
     if (player.y <= FINISH_Y && !player.finished) {
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
  io.emit('update', { players: players, platforms: platforms });
}, 1000 / 60); // 60 FPS

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});