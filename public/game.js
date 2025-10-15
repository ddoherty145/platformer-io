const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

const socket = io();
let myId = null;
const players = {};

// Handle current players
socket.on('currentPlayers', (serverPlayers) => {
  Object.keys(serverPlayers).forEach(id => {
    players[id] = serverPlayers[id];
  });
  myId = socket.id;
});

// Handle new player
socket.on('newPlayer', (data) => {
  players[data.id] = data;
});

// Handle player movement
socket.on('playerMoved', (data) => {
  if (players[data.id]) {
    players[data.id].x = data.x;
    players[data.id].y = data.y;
  }
});

// Handle player disconnect
socket.on('playerDisconnected', (id) => {
  delete players[id];
});

// Mouse movement
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  socket.emit('playerMovement', { x, y });
  if (players[myId]) {
    players[myId].x = x;
    players[myId].y = y;
  }
});

// Game loop
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw all players
  Object.keys(players).forEach(id => {
    const player = players[id];
    ctx.fillStyle = id === myId ? '#00ff00' : '#0000ff';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
    ctx.fill();
  });
  
  requestAnimationFrame(gameLoop);
}

gameLoop();