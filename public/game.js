const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const socket = io();

let myId = null;
let players = {};
let camera = { x: 0, y: 0 };

const GAME_WIDTH = 3000;
const GAME_HEIGHT = 600;
const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 600;
const GROUND_Y = 550;

// Input handling
const keys = {};

window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// Send input to server
setInterval(() => {
  socket.emit('input', {
    left: keys['ArrowLeft'] || keys['a'] || keys['A'],
    right: keys['ArrowRight'] || keys['d'] || keys['D'],
    jump: keys['ArrowUp'] || keys[' '] || keys['w'] || keys['W']
  });
}, 1000 / 60);

// Socket events
socket.on('init', (data) => {
  myId = data.id;
  players = data.players;
});

socket.on('newPlayer', (player) => {
  players[player.id] = player;
});

socket.on('update', (serverPlayers) => {
  players = serverPlayers;
  updateUI();
});

socket.on('playerDisconnected', (id) => {
  delete players[id];
});

socket.on('gameWon', (winner) => {
  if (winner.id === myId) {
    document.getElementById('winnerText').textContent = 'YOU WON!';
  } else {
    document.getElementById('winnerText').textContent = `${winner.name} Won!`;
  }
  document.getElementById('winner').classList.add('show');
});

socket.on('playerFinished', (data) => {
  console.log(`${data.name} finished in position ${data.position}`);
});

// Update UI
function updateUI() {
  document.getElementById('playerCount').textContent = `Players: ${Object.keys(players).length}`;
  
  if (myId && players[myId]) {
    const myPlayer = players[myId];
    const finishedPlayers = Object.values(players).filter(p => p.finished).length;
    const unfinishedPlayers = Object.values(players).filter(p => !p.finished);
    
    if (myPlayer.finished) {
      const myPosition = Object.values(players)
        .filter(p => p.finished)
        .sort((a, b) => a.finishTime - b.finishTime)
        .findIndex(p => p.id === myId) + 1;
      document.getElementById('position').textContent = `Finished: Position ${myPosition}`;
    } else {
      const position = unfinishedPlayers
        .sort((a, b) => b.x - a.x)
        .findIndex(p => p.id === myId) + 1;
      document.getElementById('position').textContent = `Position: ${position}/${unfinishedPlayers.length}`;
    }
  }
}

// Draw platforms
function drawLevel() {
  // Ground
  ctx.fillStyle = '#228B22';
  ctx.fillRect(-camera.x, GROUND_Y - camera.y, GAME_WIDTH, 50);
  
  // Platforms
  const platforms = [
    { x: 300, y: 450, w: 150, h: 20 },
    { x: 550, y: 380, w: 150, h: 20 },
    { x: 800, y: 320, w: 150, h: 20 },
    { x: 1050, y: 380, w: 150, h: 20 },
    { x: 1300, y: 450, w: 150, h: 20 },
    { x: 1550, y: 350, w: 150, h: 20 },
    { x: 1800, y: 280, w: 150, h: 20 },
    { x: 2050, y: 350, w: 150, h: 20 },
    { x: 2300, y: 420, w: 150, h: 20 },
    { x: 2550, y: 480, w: 150, h: 20 }
  ];
  
  ctx.fillStyle = '#8B4513';
  platforms.forEach(platform => {
    ctx.fillRect(
      platform.x - camera.x,
      platform.y - camera.y,
      platform.w,
      platform.h
    );
  });
  
  // Start line
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(50 - camera.x, 0 - camera.y, 5, GAME_HEIGHT);
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.fillText('START', 60 - camera.x, 30 - camera.y);
  
  // Finish line
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(GAME_WIDTH - 100 - camera.x, 0 - camera.y, 5, GAME_HEIGHT);
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.fillText('FINISH', GAME_WIDTH - 95 - camera.x, 30 - camera.y);
}

// Draw players
function drawPlayers() {
  Object.values(players).forEach(player => {
    ctx.fillStyle = player.color;
    ctx.fillRect(
      player.x - camera.x,
      player.y - camera.y,
      player.width,
      player.height
    );
    
    // Draw player name
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      player.name,
      player.x + player.width / 2 - camera.x,
      player.y - 5 - camera.y
    );
    
    // Highlight current player
    if (player.id === myId) {
      ctx.strokeStyle = 'yellow';
      ctx.lineWidth = 3;
      ctx.strokeRect(
        player.x - camera.x - 2,
        player.y - camera.y - 2,
        player.width + 4,
        player.height + 4
      );
    }
  });
}

// Game loop
function gameLoop() {
  // Update camera to follow player
  if (myId && players[myId]) {
    const player = players[myId];
    camera.x = player.x - VIEWPORT_WIDTH / 2;
    camera.y = 0;
    
    // Clamp camera
    camera.x = Math.max(0, Math.min(camera.x, GAME_WIDTH - VIEWPORT_WIDTH));
  }
  
  // Clear canvas
  ctx.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  
  // Draw sky gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEWPORT_HEIGHT);
  gradient.addColorStop(0, '#87CEEB');
  gradient.addColorStop(1, '#E0F6FF');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  
  // Draw clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  for (let i = 0; i < 10; i++) {
    const x = (i * 400 - camera.x * 0.5) % (VIEWPORT_WIDTH + 200) - 100;
    ctx.beginPath();
    ctx.arc(x, 80 + i * 30, 30, 0, Math.PI * 2);
    ctx.arc(x + 30, 80 + i * 30, 40, 0, Math.PI * 2);
    ctx.arc(x + 60, 80 + i * 30, 30, 0, Math.PI * 2);
    ctx.fill();
  }
  
  drawLevel();
  drawPlayers();
  
  requestAnimationFrame(gameLoop);
}

gameLoop();