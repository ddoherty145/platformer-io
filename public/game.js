const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const socket = io();

let myId = null;
let players = {};
let platforms = [];
let camera = { x: 0, y: 0 };

const GAME_WIDTH = 800;
const GAME_HEIGHT = 3000;
const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 600;
const GROUND_Y = GAME_HEIGHT - 50;
const FINISH_Y = 50;

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
  platforms = data.platforms;
});

socket.on('newPlayer', (player) => {
  players[player.id] = player;
});

socket.on('update', (data) => {
  players = data.players;
  platforms = data.platforms;
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
        .sort((a, b) => a.y - b.y) // Sort by Y position (lower Y = higher up)
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
  
  // Draw platforms
  platforms.forEach(platform => {
    if (platform.type === 'disappearing' && !platform.visible) return;
    
    let platformColor = '#8B4513'; // Default brown
    
    if (platform.type === 'moving') {
      platformColor = '#FF6B35'; // Orange for moving platforms
    } else if (platform.type === 'disappearing') {
      // Fade out when about to disappear
      const fadeTime = platform.timer / 2000;
      const alpha = platform.visible ? (fadeTime > 0.8 ? 1 - (fadeTime - 0.8) / 0.2 : 1) : 0;
      platformColor = `rgba(255, 107, 53, ${alpha})`;
    }
    
    ctx.fillStyle = platformColor;
    ctx.fillRect(
      platform.x - camera.x,
      platform.y - camera.y,
      platform.w,
      platform.h
    );
    
    // Add visual indicators
    if (platform.type === 'moving') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(
        platform.x - camera.x,
        platform.y - camera.y,
        platform.w,
        5
      );
    } else if (platform.type === 'disappearing') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillRect(
        platform.x - camera.x,
        platform.y - camera.y,
        platform.w,
        3
      );
    }
  });
  
  // Start line (at bottom)
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(0 - camera.x, GROUND_Y - camera.y, GAME_WIDTH, 5);
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('START', GAME_WIDTH/2 - camera.x, GROUND_Y - 10 - camera.y);
  
  // Finish line (at top)
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0 - camera.x, FINISH_Y - camera.y, GAME_WIDTH, 5);
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('FINISH', GAME_WIDTH/2 - camera.x, FINISH_Y + 25 - camera.y);
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
    camera.y = player.y - VIEWPORT_HEIGHT / 2;
    
    // Clamp camera
    camera.x = Math.max(0, Math.min(camera.x, GAME_WIDTH - VIEWPORT_WIDTH));
    camera.y = Math.max(0, Math.min(camera.y, GAME_HEIGHT - VIEWPORT_HEIGHT));
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