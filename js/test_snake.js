const canvas = document.getElementById('snakeCanvas');
const ctx = canvas.getContext('2d');

let screenW = document.documentElement.clientWidth;
let screenH = document.documentElement.clientHeight;
let defaultSize = 500;

const canvasSize = Math.min(screenW, screenH, defaultSize);
const boxSize = canvasSize / 20;
const snake = [];
let direction = 'right';
let food = {};
let can_control = true;

canvas.width = canvasSize;
canvas.height = canvasSize;

function drawSnakePart(x, y) {
    ctx.fillStyle = 'green';
    ctx.fillRect(x, y, boxSize, boxSize);
    ctx.strokeStyle = 'black';
    ctx.strokeRect(x, y, boxSize, boxSize);
}

function drawFood(x, y) {
    ctx.fillStyle = 'red';
    ctx.fillRect(x, y, boxSize, boxSize);
    ctx.strokeStyle = 'black';
    ctx.strokeRect(x, y, boxSize, boxSize);
}

function generateFood() {
    food = {
        x: Math.floor(Math.random() * (canvasSize / boxSize)) * boxSize,
        y: Math.floor(Math.random() * (canvasSize / boxSize)) * boxSize,
    };
}

function checkCollision(x, y, array) {
    // Check if the given position collides with the snake's body
    for (let i = 0; i < array.length; i++) {
        if (x === array[i].x && y === array[i].y) {
            return true;
        }
    }
    return false;
}

function draw() {
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Update snake position based on direction
    const headX = snake[0].x + (direction === 'right' ? boxSize : direction === 'left' ? -boxSize : 0);
    const headY = snake[0].y + (direction === 'down' ? boxSize : direction === 'up' ? -boxSize : 0);

    // Check if the snake hits the canvas boundaries or collides with its body
    if (
    headX < 0 ||
    headX >= canvasSize ||
    headY < 0 ||
    headY >= canvasSize ||
    checkCollision(headX, headY, snake)) {
        // Game over
        // alert('游戏结束！');
        snake.length = 0; // Clear the snake array
        direction = 'right'; // Reset direction
        can_control = true;
        snake.push({ x: boxSize * 2, y: boxSize }); // Reset snake position
        snake.push({ x: boxSize, y: boxSize });
        snake.push({ x: 0, y: boxSize });
        generateFood(); // Generate new food
        setTimeout(draw, 100);
        return;
    }

    // Check if the snake eats the food
    if (headX === food.x && headY === food.y) {
        generateFood();
    } else {
        // If not, remove the tail segment
        snake.pop();
    }

    // Add new head segment to the beginning
    const newHead = { x: headX, y: headY };
    snake.unshift(newHead);

    for (let i = 0; i < snake.length; i++) {
    const { x, y } = snake[i];
        drawSnakePart(x, y);
    }

    drawFood(food.x, food.y);

    setTimeout(draw, 100); // Control snake speed (100ms)
    can_control = true;
}

// Listen for arrow key presses to control the snake
document.addEventListener('keydown', (event) => {
    if (can_control === false) {
        return;
    }
    const key = event.key;
    if ((key === 'ArrowUp' || key === 'w') && direction !== 'down') {
        direction = 'up';
        can_control = false;
    } else if ((key === 'ArrowDown' || key === 's') && direction !== 'up') {
        direction = 'down';
        can_control = false;
    } else if ((key === 'ArrowLeft' || key === 'a') && direction !== 'right') {
        direction = 'left';
        can_control = false;
    } else if ((key === 'ArrowRight' || key === 'd') && direction !== 'left') {
        direction = 'right';
        can_control = false;
    }
});

// Initialize the snake with 3 parts
snake.push({ x: boxSize * 2, y: boxSize });
snake.push({ x: boxSize, y: boxSize });
snake.push({ x: 0, y: boxSize });

generateFood();
draw();
