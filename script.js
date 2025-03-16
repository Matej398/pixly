// Canvas and context
const canvas = document.getElementById('pixel-canvas');
const ctx = canvas.getContext('2d');
const previewCanvas = document.getElementById('preview-canvas');
const previewCtx = previewCanvas.getContext('2d');
const gridSizeInput = document.getElementById('grid-size');
const grid16Btn = document.getElementById('grid-16');
const grid32Btn = document.getElementById('grid-32');
const grid64Btn = document.getElementById('grid-64');
const colorPicker = document.getElementById('color-picker');
const brushSizeSelect = document.getElementById('brush-size');
const pencilBtn = document.getElementById('pencil');
const fillBtn = document.getElementById('fill');
const eraserBtn = document.getElementById('eraser');
const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const saveProjectBtn = document.getElementById('save-project');
const loadProjectInput = document.getElementById('load-project');
const loadBtn = document.getElementById('load-btn');
const resetBtn = document.getElementById('reset-grid');
const exportPngBtn = document.getElementById('export-png');
const exportJpgBtn = document.getElementById('export-jpg');
const exportSvgBtn = document.getElementById('export-svg');

// State
let gridSize = parseInt(gridSizeInput.value);
let pixelSize = 20; // Visual size of each pixel
let zoomLevel = 1; // 1x, 2x, 4x
let brushSize = 1; // 1x1, 2x2, 3x3
let isDrawing = false;
let tool = 'pencil'; // pencil, fill, or eraser
let grid = []; // 2D array to store pixel colors
let hoverX = -1; // Track hover position
let hoverY = -1;
let history = []; // Undo stack
let redoStack = []; // Redo stack

// Initialize grid
function initGrid() {
    gridSize = Math.min(parseInt(gridSizeInput.value) || 16, 100); // Max 100
    canvas.width = gridSize * pixelSize * zoomLevel;
    canvas.height = gridSize * pixelSize * zoomLevel;
    grid = Array(gridSize).fill().map(() => Array(gridSize).fill('#ffffff'));
    history = [JSON.stringify(grid)];
    redoStack = [];
    drawGrid();
    updatePreview();
}

// Draw the grid on canvas
function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            ctx.fillStyle = grid[y][x];
            ctx.fillRect(x * pixelSize * zoomLevel, y * pixelSize * zoomLevel, pixelSize * zoomLevel, pixelSize * zoomLevel);
            ctx.strokeStyle = '#ddd';
            ctx.strokeRect(x * pixelSize * zoomLevel, y * pixelSize * zoomLevel, pixelSize * zoomLevel, pixelSize * zoomLevel);
        }
    }
    if (hoverX >= 0 && hoverY >= 0 && (tool === 'pencil' || tool === 'eraser' || tool === 'fill')) {
        const offset = Math.floor(brushSize / 2); // Center the hover
        const hoverXCentered = hoverX - offset;
        const hoverYCentered = hoverY - offset;
        ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
        ctx.fillRect(hoverXCentered * pixelSize * zoomLevel, hoverYCentered * pixelSize * zoomLevel, pixelSize * zoomLevel * brushSize, pixelSize * zoomLevel * brushSize);
    }
}

// Update preview canvas
function updatePreview() {
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    const scale = Math.min(100 / gridSize, 100 / gridSize);
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (grid[y][x] !== '#ffffff') {
                previewCtx.fillStyle = grid[y][x];
                previewCtx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
    }
}

// Draw without grid lines for export
function drawForExport(isTransparent) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (grid[y][x] !== '#ffffff') {
                ctx.fillStyle = grid[y][x];
                ctx.fillRect(x * pixelSize * zoomLevel, y * pixelSize * zoomLevel, pixelSize * zoomLevel, pixelSize * zoomLevel);
            } else if (!isTransparent) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x * pixelSize * zoomLevel, y * pixelSize * zoomLevel, pixelSize * zoomLevel, pixelSize * zoomLevel);
            }
        }
    }
}

// Flood fill algorithm
function floodFill(x, y, targetColor, replacementColor) {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;
    if (grid[y][x] !== targetColor || grid[y][x] === replacementColor) return;
    
    grid[y][x] = replacementColor;
    floodFill(x + 1, y, targetColor, replacementColor);
    floodFill(x - 1, y, targetColor, replacementColor);
    floodFill(x, y + 1, targetColor, replacementColor);
    floodFill(x, y - 1, targetColor, replacementColor);
}

// Apply brush (centered)
function applyBrush(x, y, color) {
    const offset = Math.floor(brushSize / 2); // Center the brush
    for (let dy = 0; dy < brushSize; dy++) {
        for (let dx = 0; dx < brushSize; dx++) {
            const newX = x + dx - offset;
            const newY = y + dy - offset;
            if (newX >= 0 && newX < gridSize && newY >= 0 && newY < gridSize) {
                grid[newY][newX] = color;
            }
        }
    }
}

// Mouse events
canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    draw(e);
});
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (pixelSize * zoomLevel));
    const y = Math.floor((e.clientY - rect.top) / (pixelSize * zoomLevel));
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        hoverX = x;
        hoverY = y;
        drawGrid();
        if (isDrawing) draw(e);
    } else {
        hoverX = -1;
        hoverY = -1;
        drawGrid();
    }
});
canvas.addEventListener('mouseup', () => {
    if (isDrawing) {
        history.push(JSON.stringify(grid));
        redoStack = [];
        updatePreview();
    }
    isDrawing = false;
});
canvas.addEventListener('mouseout', () => {
    isDrawing = false;
    hoverX = -1;
    hoverY = -1;
    drawGrid();
});

function draw(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (pixelSize * zoomLevel));
    const y = Math.floor((e.clientY - rect.top) / (pixelSize * zoomLevel));
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        if (tool === 'pencil') {
            applyBrush(x, y, colorPicker.value);
            drawGrid();
        } else if (tool === 'fill') {
            floodFill(x, y, grid[y][x], colorPicker.value);
            drawGrid();
        } else if (tool === 'eraser') {
            applyBrush(x, y, '#ffffff');
            drawGrid();
        }
    }
}

// Grid size with Enter
gridSizeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        initGrid();
    }
});

// Tool selection
pencilBtn.addEventListener('click', () => {
    tool = 'pencil';
    pencilBtn.classList.add('active');
    fillBtn.classList.remove('active');
    eraserBtn.classList.remove('active');
    drawGrid();
});
fillBtn.addEventListener('click', () => {
    tool = 'fill';
    fillBtn.classList.add('active');
    pencilBtn.classList.remove('active');
    eraserBtn.classList.remove('active');
    drawGrid();
});
eraserBtn.addEventListener('click', () => {
    tool = 'eraser';
    eraserBtn.classList.add('active');
    pencilBtn.classList.remove('active');
    fillBtn.classList.remove('active');
    drawGrid();
});

// Grid presets
grid16Btn.addEventListener('click', () => {
    gridSizeInput.value = 16;
    initGrid();
});
grid32Btn.addEventListener('click', () => {
    gridSizeInput.value = 32;
    initGrid();
});
grid64Btn.addEventListener('click', () => {
    gridSizeInput.value = 64;
    initGrid();
});

// Brush size
brushSizeSelect.addEventListener('change', () => {
    brushSize = parseInt(brushSizeSelect.value);
    drawGrid();
});

// Undo/Redo
undoBtn.addEventListener('click', () => {
    if (history.length > 1) {
        redoStack.push(history.pop());
        grid = JSON.parse(history[history.length - 1]);
        drawGrid();
        updatePreview();
    }
});
redoBtn.addEventListener('click', () => {
    if (redoStack.length > 0) {
        grid = JSON.parse(redoStack.pop());
        history.push(JSON.stringify(grid));
        drawGrid();
        updatePreview();
    }
});

// Zoom
zoomInBtn.addEventListener('click', () => {
    if (zoomLevel < 4) {
        zoomLevel *= 2;
        canvas.width = gridSize * pixelSize * zoomLevel;
        canvas.height = gridSize * pixelSize * zoomLevel;
        drawGrid();
        updatePreview();
    }
});
zoomOutBtn.addEventListener('click', () => {
    if (zoomLevel > 1) {
        zoomLevel /= 2;
        canvas.width = gridSize * pixelSize * zoomLevel;
        canvas.height = gridSize * pixelSize * zoomLevel;
        drawGrid();
        updatePreview();
    }
});

// Save/Load
saveProjectBtn.addEventListener('click', () => {
    const data = JSON.stringify({ gridSize, grid });
    const blob = new Blob([data], { type: 'application/json' });
    saveAs(blob, 'pixly-project.json');
});
loadBtn.addEventListener('click', () => loadProjectInput.click());
loadProjectInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = JSON.parse(event.target.result);
            gridSizeInput.value = data.gridSize;
            grid = data.grid;
            zoomLevel = 1; // Reset zoom
            canvas.width = gridSize * pixelSize * zoomLevel;
            canvas.height = gridSize * pixelSize * zoomLevel;
            history = [JSON.stringify(grid)];
            redoStack = [];
            drawGrid();
            updatePreview();
        };
        reader.readAsText(file);
    }
});

// Reset grid
resetBtn.addEventListener('click', initGrid);

// Export functions
exportPngBtn.addEventListener('click', () => {
    drawForExport(true);
    const dataUrl = canvas.toDataURL('image/png');
    saveAs(dataUrl, 'pixly-art.png');
    drawGrid();
});

exportJpgBtn.addEventListener('click', () => {
    drawForExport(false);
    const dataUrl = canvas.toDataURL('image/jpeg');
    saveAs(dataUrl, 'pixly-art.jpg');
    drawGrid();
});

exportSvgBtn.addEventListener('click', () => {
    let svg = `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">`;
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (grid[y][x] !== '#ffffff') {
                svg += `<rect x="${x * pixelSize * zoomLevel}" y="${y * pixelSize * zoomLevel}" width="${pixelSize * zoomLevel}" height="${pixelSize * zoomLevel}" fill="${grid[y][x]}"/>`;
            }
        }
    }
    svg += '</svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    saveAs(blob, 'pixly-art.svg');
});

// Start the app
initGrid();
pencilBtn.classList.add('active');