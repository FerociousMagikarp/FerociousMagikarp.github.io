(function() {
    // ============ 常量与配置 ============
    const RESOURCE_DIR = '/resources/xiangqi';
    const BOARD_TEXTURE_PATH = `${RESOURCE_DIR}/board.jpg`;
    const PIECES_FONT_PATH = `${RESOURCE_DIR}/pieces.ttf`;
    const FONT_FAMILY = 'XiangQiPieces';

    // 棋盘几何参数
    const COLS = 9;
    const ROWS = 10;
    const CELL_SIZE = 65;
    const MARGIN_X = 45;
    const MARGIN_Y = 45;
    const PIECE_RADIUS = 29;
    const LINE_WIDTH = 1.8;
    const BORDER_LINE_WIDTH = 2.5;

    const CANVAS_WIDTH = MARGIN_X * 2 + (COLS - 1) * CELL_SIZE;
    const CANVAS_HEIGHT = MARGIN_Y * 2 + (ROWS - 1) * CELL_SIZE;

    const DEFAULT_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR';

    const PIECE_CHARS_RED = {
        'K': '帥', 'A': '仕', 'B': '相', 'N': '馬', 'R': '車', 'C': '炮', 'P': '兵'
    };
    const PIECE_CHARS_BLACK = {
        'k': '將', 'a': '士', 'b': '象', 'n': '馬', 'r': '車', 'c': '砲', 'p': '卒'
    };

    const CANNON_MARK_POSITIONS = [
        { col: 1, row: 2 }, { col: 7, row: 2 },
        { col: 1, row: 7 }, { col: 7, row: 7 }
    ];
    const PAWN_MARK_POSITIONS = [
        { col: 0, row: 3 }, { col: 2, row: 3 }, { col: 4, row: 3 }, { col: 6, row: 3 }, { col: 8, row: 3 },
        { col: 0, row: 6 }, { col: 2, row: 6 }, { col: 4, row: 6 }, { col: 6, row: 6 }, { col: 8, row: 6 }
    ];

    // ============ DOM 元素 ============
    const canvas = document.getElementById('boardCanvas');
    const ctx = canvas.getContext('2d');
    const gameIdInput = document.getElementById('gameIdInput');
    const gameSelect = document.getElementById('gameSelect');
    const movesListEl = document.getElementById('movesList');

    // ============ 状态 ============
    let boardTexture = null;
    let fontLoaded = false;
    let currentFen = DEFAULT_FEN;
    let boardState = [];
    let resourcesReady = false;
    let allGames = [];
    let gamesLoaded = false;
    let moveTreeRoot = null;        // 变招树根节点
    let currentPath = [];           // 当前显示的路径（节点数组）
    let initialBoardState = null;   // 初始棋盘状态副本
    let currentStepIndex = 0;

    // ============ 坐标转换 ============
    function colToX(col) { return MARGIN_X + col * CELL_SIZE; }
    function rowToY(row) { return MARGIN_Y + row * CELL_SIZE; }
    function xToCol(x) { return Math.round((x - MARGIN_X) / CELL_SIZE); }
    function yToRow(y) { return Math.round((y - MARGIN_Y) / CELL_SIZE); }

    // ============ 资源加载 ============
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`无法加载图片: ${src}`));
            img.src = src;
        });
    }

    function loadFont(src) {
        return new Promise((resolve, reject) => {
            const fontFace = new FontFace(FONT_FAMILY, `url("${src}")`);
            fontFace.load().then((loadedFont) => {
                document.fonts.add(loadedFont);
                resolve(loadedFont);
            }).catch((err) => {
                console.warn('字体加载失败，使用系统字体:', err);
                resolve(null);
            });
        });
    }

    async function initResources() {
        try {
            const [textureResult, fontResult] = await Promise.allSettled([
                loadImage(BOARD_TEXTURE_PATH),
                loadFont(PIECES_FONT_PATH)
            ]);

            if (textureResult.status === 'fulfilled') {
                boardTexture = textureResult.value;
            } else {
                console.warn('棋盘纹理加载失败，使用纯色背景:', textureResult.reason);
                boardTexture = null;
            }

            if (fontResult.status === 'fulfilled' && fontResult.value !== null) {
                fontLoaded = true;
            } else {
                fontLoaded = false;
                console.warn('棋子字体不可用，使用系统字体');
            }

            resourcesReady = true;
            parseFen(currentFen);
            drawBoard();
        } catch (err) {
            console.error('资源加载错误:', err);
            resourcesReady = true;
            parseFen(currentFen);
            drawBoard();
        }
    }

    async function loadGameData() {
        try {
            const response = await fetch(`${RESOURCE_DIR}/shiqingyaqu.json`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            allGames = await response.json();
            gamesLoaded = true;
            populateGameSelect();
            // 默认加载第一个局面
            if (allGames.length > 0) {
                switchToGame(allGames[0].id);
            }
        } catch (err) {
            console.error('加载 shiqingyaqu.json 失败:', err);
            // 降级：保留原有的前10个选项（无则忽略）
        }
    }

    function parseMovesString(movesStr) {
        const moves = [];
        if (!movesStr || movesStr.length % 4 !== 0) {
            console.warn('Moves字符串长度错误:', movesStr);
            return moves;
        }
        for (let i = 0; i < movesStr.length; i += 4) {
            const fromCol = parseInt(movesStr[i], 10);
            const fromRow = parseInt(movesStr[i+1], 10);
            const toCol = parseInt(movesStr[i+2], 10);
            const toRow = parseInt(movesStr[i+3], 10);
            moves.push({ fromCol, fromRow, toCol, toRow });
        }
        return moves;
    }

    function populateGameSelect() {
        gameSelect.innerHTML = ''; // 清空
        allGames.forEach(game => {
            const option = document.createElement('option');
            option.value = game.id;
            option.textContent = `${String(game.id).padStart(3, '0')} - ${game.name}`;
            gameSelect.appendChild(option);
        });
        // 默认选中第一个
        if (allGames.length > 0) {
            gameSelect.selectedIndex = 0;
        }
    }

    // ============ FEN 解析 ============
    function parseFen(fen) {
        const rows = fen.trim().split('/');
        if (rows.length !== ROWS) {
            console.warn(`FEN行数不正确: ${rows.length}，应为${ROWS}，使用默认FEN`);
            fen = DEFAULT_FEN;
            rows = fen.trim().split('/');
        }
        currentFen = fen;
        boardState = [];
        for (let r = 0; r < ROWS; r++) {
            const rowStr = rows[r];
            const row = [];
            let col = 0;
            for (let i = 0; i < rowStr.length; i++) {
                const ch = rowStr[i];
                if (/\d/.test(ch)) {
                    const emptyCount = parseInt(ch, 10);
                    for (let j = 0; j < emptyCount; j++) {
                        row.push(null);
                        col++;
                    }
                } else {
                    row.push(ch);
                    col++;
                }
            }
            while (row.length < COLS) row.push(null);
            if (row.length > COLS) row.length = COLS;
            boardState.push(row);
        }
    }

    // 克隆棋盘状态
    function cloneBoardState(state) {
        return state.map(row => row.slice());
    }

    // 在棋盘状态上应用一步走法（返回新状态）
    function applyMoveToState(state, move) {
        const newState = cloneBoardState(state);
        const piece = newState[move.fromRow][move.fromCol];
        if (!piece) {
            console.warn('起始位置无棋子', move);
            return newState;
        }
        newState[move.toRow][move.toCol] = piece;
        newState[move.fromRow][move.fromCol] = null;
        return newState;
    }

    // 将棋盘状态转换为 FEN 字符串（用于同步 currentFen）
    function boardStateToFen(state) {
        let fenRows = [];
        for (let r = 0; r < ROWS; r++) {
            let emptyCount = 0;
            let rowStr = '';
            for (let c = 0; c < COLS; c++) {
                const piece = state[r][c];
                if (piece) {
                    if (emptyCount > 0) {
                        rowStr += emptyCount;
                        emptyCount = 0;
                    }
                    rowStr += piece;
                } else {
                    emptyCount++;
                }
            }
            if (emptyCount > 0) rowStr += emptyCount;
            fenRows.push(rowStr);
        }
        return fenRows.join('/');
    }

    function applyCurrentStepToBoard() {
        if (!initialBoardState || !currentPath.length) return;
        let state = cloneBoardState(initialBoardState);
        for (let i = 1; i <= currentStepIndex; i++) {
            state = applyMoveToState(state, currentPath[i].move);
        }
        boardState = state;
        currentFen = boardStateToFen(state);
        if (resourcesReady) drawBoard();
    }

    // 根据路径数组更新棋盘显示
    function applyPathToBoard(path) {
        if (!initialBoardState) return;
        let state = cloneBoardState(initialBoardState);
        for (let i = 1; i < path.length; i++) {
            state = applyMoveToState(state, path[i].move);
        }
        boardState = state;
        currentFen = boardStateToFen(state);
        if (resourcesReady) drawBoard();
    }

    // 获取某节点对应的棋盘状态（从初始局面沿父链走到该节点）
    function getBoardStateAtNode(node) {
        if (!initialBoardState) return null;
        let state = cloneBoardState(initialBoardState);
        let moves = [];
        let cur = node;
        while (cur && cur.move) {
            moves.unshift(cur.move);
            cur = cur.parent;
        }
        for (const move of moves) {
            state = applyMoveToState(state, move);
        }
        return state;
    }

    function getPieceChar(pieceCode) {
        if (!pieceCode) return null;
        if (pieceCode === pieceCode.toUpperCase()) return PIECE_CHARS_RED[pieceCode] || pieceCode;
        return PIECE_CHARS_BLACK[pieceCode] || pieceCode;
    }

    function isRedPiece(pieceCode) {
        return pieceCode === pieceCode.toUpperCase();
    }

    function moveToNotation(stateBeforeMove, move, isRedTurn) {
        const pieceChar = stateBeforeMove[move.fromRow][move.fromCol];
        if (!pieceChar) return '?';
        const isRed = pieceChar === pieceChar.toUpperCase();
        const pieceType = pieceChar.toUpperCase();

        const pieceNamesRed = { 'K': '帅', 'A': '仕', 'B': '相', 'N': '马', 'R': '车', 'C': '炮', 'P': '兵' };
        const pieceNamesBlack = { 'K': '将', 'A': '士', 'B': '象', 'N': '马', 'R': '车', 'C': '砲', 'P': '卒' };
        const pieceName = isRed ? pieceNamesRed[pieceType] : pieceNamesBlack[pieceType];

        const fromLineNum = isRed ? (9 - move.fromCol) : (move.fromCol + 1);
        const toLineNum = isRed ? (9 - move.toCol) : (move.toCol + 1);
        const numToChinese = ['零','一','二','三','四','五','六','七','八','九'];
        const fromLineStr = isRed ? numToChinese[fromLineNum] : String(fromLineNum);
        const toLineStr = isRed ? numToChinese[toLineNum] : String(toLineNum);

        // 公共动作与目标数字计算
        let action = '';
        let numStr = '';

        if (move.fromCol === move.toCol) {
            // 直线进退
            let isForward;
            if (isRed) {
                isForward = move.toRow < move.fromRow;
            } else {
                isForward = move.toRow > move.fromRow;
            }
            action = isForward ? '进' : '退';
            if (['R','C','K','P'].includes(pieceType)) {
                const steps = Math.abs(move.toRow - move.fromRow);
                numStr = isRed ? numToChinese[steps] : String(steps);
            } else {
                numStr = toLineStr; // 马、相、士
            }
        } else if (move.fromRow === move.toRow) {
            action = '平';
            numStr = toLineStr;
        } else {
            // 斜走（马、相、士）
            let isForward;
            if (isRed) {
                isForward = move.toRow < move.fromRow;
            } else {
                isForward = move.toRow > move.fromRow;
            }
            action = isForward ? '进' : '退';
            numStr = toLineStr;
        }

        // 兵/卒特殊处理
        if (pieceType === 'P') {
            return getPawnNotation(stateBeforeMove, move, isRed, pieceName, fromLineStr, toLineStr, action, numStr, numToChinese);
        }

        // 其他棋子：只有车、马、炮需要同列同种棋子前缀（士象不需要）
        let prefix = '';
        if (['R', 'N', 'C'].includes(pieceType)) {
            const samePieces = [];
            for (let r = 0; r < ROWS; r++) {
                if (r === move.fromRow) continue;
                const p = stateBeforeMove[r][move.fromCol];
                if (p && p.toUpperCase() === pieceType && (p === p.toUpperCase()) === isRed) {
                    samePieces.push({ row: r });
                }
            }
            if (samePieces.length > 0) {
                // 车马炮最多两个，只分前后
                const total = samePieces.length + 1;
                const sortedRows = [move.fromRow, ...samePieces.map(p => p.row)].sort((a,b) => {
                    return isRed ? (a - b) : (b - a);
                });
                const rank = sortedRows.indexOf(move.fromRow) + 1;
                if (total === 2) {
                    prefix = rank === 1 ? '前' : '后';
                }
                // 理论上不会出现 total > 2，忽略
            }
        }

        let notation;
        if (prefix) {
            notation = prefix + pieceName + action + numStr;
        } else {
            notation = pieceName + fromLineStr + action + numStr;
        }
        return notation;
    }

    // 兵/卒记谱辅助函数
    function getPawnNotation(stateBeforeMove, move, isRed, pieceName, fromLineStr, toLineStr, action, numStr, numToChinese) {
        // 收集所有同方兵/卒位置
        const pawnPositions = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = stateBeforeMove[r][c];
                if (p && p.toUpperCase() === 'P' && (p === p.toUpperCase()) === isRed) {
                    pawnPositions.push({ row: r, col: c });
                }
            }
        }

        // 统计每列的兵/卒数量
        const colCounts = {};
        pawnPositions.forEach(pos => {
            colCounts[pos.col] = (colCounts[pos.col] || 0) + 1;
        });

        // 判断是否出现多列叠兵（至少两列各有至少两个兵/卒）
        const multiColumnStacked = Object.values(colCounts).filter(count => count >= 2).length >= 2;

        // 当前列兵/卒数量
        const currentColCount = colCounts[move.fromCol] || 0;

        // 多列叠兵且当前列也有多个兵/卒 → 省略棋子名称
        if (multiColumnStacked && currentColCount >= 2) {
            const rowsInCol = pawnPositions.filter(p => p.col === move.fromCol).map(p => p.row);
            rowsInCol.sort((a, b) => isRed ? (a - b) : (b - a));
            const rank = rowsInCol.indexOf(move.fromRow) + 1;
            const prefix = getPawnPrefix(rank, currentColCount, numToChinese);
            return `${prefix}${fromLineStr}${action}${numStr}`;
        }

        // 单列叠兵（非多列叠兵，但当前列有多个）
        if (currentColCount >= 2) {
            const rowsInCol = pawnPositions.filter(p => p.col === move.fromCol).map(p => p.row);
            rowsInCol.sort((a, b) => isRed ? (a - b) : (b - a));
            const rank = rowsInCol.indexOf(move.fromRow) + 1;
            const prefix = getPawnPrefix(rank, currentColCount, numToChinese);
            return `${prefix}${pieceName}${action}${numStr}`;
        }

        // 无叠兵，正常记谱
        return `${pieceName}${fromLineStr}${action}${numStr}`;
    }

    // 兵/卒前缀生成（前、中、后、二、三、四……）
    function getPawnPrefix(rank, total, numToChinese) {
        if (total === 2) {
            return rank === 1 ? '前' : '后';
        } else if (total === 3) {
            return rank === 1 ? '前' : (rank === 2 ? '中' : '后');
        } else if (total >= 4) {
            if (rank === 1) return '前';
            return numToChinese[rank]; // rank=2 → 二，rank=3 → 三，以此类推
        }
        return '';
    }

    // ============ 棋盘绘制 ============
    function drawBoard() {
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        if (boardTexture) {
            ctx.drawImage(boardTexture, 0, 0, w, h);
        } else {
            const bgGradient = ctx.createLinearGradient(0, 0, w, h);
            bgGradient.addColorStop(0, '#d4b896');
            bgGradient.addColorStop(0.5, '#c8aa82');
            bgGradient.addColorStop(1, '#d4b896');
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, w, h);
        }

        const lineColor = '#3d2b1a';
        const markColor = '#3d2b1a';
        const leftX = colToX(0);
        const rightX = colToX(COLS - 1);
        const topY = rowToY(0);
        const bottomY = rowToY(ROWS - 1);
        const riverTopY = rowToY(4);
        const riverBottomY = rowToY(5);

        // 外边框
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = BORDER_LINE_WIDTH;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeRect(leftX, topY, rightX - leftX, bottomY - topY);

        // 横线
        ctx.lineWidth = LINE_WIDTH;
        for (let r = 0; r < ROWS; r++) {
            const y = rowToY(r);
            ctx.beginPath();
            ctx.moveTo(leftX, y);
            ctx.lineTo(rightX, y);
            ctx.stroke();
        }

        // 竖线
        for (let c = 0; c < COLS; c++) {
            const x = colToX(c);
            if (c === 0 || c === COLS - 1) {
                ctx.beginPath();
                ctx.moveTo(x, topY);
                ctx.lineTo(x, bottomY);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(x, topY);
                ctx.lineTo(x, riverTopY);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x, riverBottomY);
                ctx.lineTo(x, bottomY);
                ctx.stroke();
            }
        }

        // 九宫格斜线
        ctx.lineWidth = LINE_WIDTH;
        ctx.beginPath();
        ctx.moveTo(colToX(3), rowToY(0));
        ctx.lineTo(colToX(5), rowToY(2));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(colToX(5), rowToY(0));
        ctx.lineTo(colToX(3), rowToY(2));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(colToX(3), rowToY(7));
        ctx.lineTo(colToX(5), rowToY(9));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(colToX(5), rowToY(7));
        ctx.lineTo(colToX(3), rowToY(9));
        ctx.stroke();

        // 兵/炮位置标记
        ctx.strokeStyle = markColor;
        ctx.lineWidth = 1.5;

        function drawPositionMark(col, row) {
            const cx = colToX(col);
            const cy = rowToY(row);
            const markOffset = 5;   // 偏移量保持不变
            const markLength = 10;   // 线长加长

            // 判断四个方向是否超出棋盘边界，仅绘制棋盘内的部分
            const drawTL = col > 0 && row > 0;                 // 左上：左侧和上方都有空间
            const drawTR = col < COLS - 1 && row > 0;          // 右上：右侧和上方有空间
            const drawBL = col > 0 && row < ROWS - 1;          // 左下：左侧和下方有空间
            const drawBR = col < COLS - 1 && row < ROWS - 1;   // 右下：右侧和下方有空间

            // 左上方向
            if (drawTL) {
                ctx.beginPath();
                ctx.moveTo(cx - markOffset - markLength, cy - markOffset);
                ctx.lineTo(cx - markOffset, cy - markOffset);
                ctx.lineTo(cx - markOffset, cy - markOffset - markLength);
                ctx.stroke();
            }
            // 右上方向
            if (drawTR) {
                ctx.beginPath();
                ctx.moveTo(cx + markOffset + markLength, cy - markOffset);
                ctx.lineTo(cx + markOffset, cy - markOffset);
                ctx.lineTo(cx + markOffset, cy - markOffset - markLength);
                ctx.stroke();
            }
            // 左下方向
            if (drawBL) {
                ctx.beginPath();
                ctx.moveTo(cx - markOffset - markLength, cy + markOffset);
                ctx.lineTo(cx - markOffset, cy + markOffset);
                ctx.lineTo(cx - markOffset, cy + markOffset + markLength);
                ctx.stroke();
            }
            // 右下方向
            if (drawBR) {
                ctx.beginPath();
                ctx.moveTo(cx + markOffset + markLength, cy + markOffset);
                ctx.lineTo(cx + markOffset, cy + markOffset);
                ctx.lineTo(cx + markOffset, cy + markOffset + markLength);
                ctx.stroke();
            }
        }

        for (const pos of CANNON_MARK_POSITIONS) drawPositionMark(pos.col, pos.row);
        for (const pos of PAWN_MARK_POSITIONS) drawPositionMark(pos.col, pos.row);

        // 棋子
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const pieceCode = boardState[r][c];
                if (pieceCode) drawPiece(c, r, pieceCode);
            }
        }
    }

    function drawPiece(col, row, pieceCode) {
        const x = colToX(col);
        const y = rowToY(row);
        const isRed = isRedPiece(pieceCode);
        const char = getPieceChar(pieceCode);
        if (!char) return;

        const radius = PIECE_RADIUS;
        const centerX = x;
        const centerY = y;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;

        const gradient = ctx.createRadialGradient(
            centerX - radius * 0.3, centerY - radius * 0.35, radius * 0.1,
            centerX, centerY, radius
        );
        if (isRed) {
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.6, '#f5f0e8');
            gradient.addColorStop(0.85, '#e8e0d0');
            gradient.addColorStop(1, '#d8cfc0');
        } else {
            gradient.addColorStop(0, '#3a3a3a');
            gradient.addColorStop(0.55, '#2a2a2a');
            gradient.addColorStop(0.85, '#1a1a1a');
            gradient.addColorStop(1, '#0d0d0d');
        }
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        const strokeColor = isRed ? '#c0392b' : '#e8e8e8';
        const strokeWidth = 2.2;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.86 - strokeWidth * 0.6, 0, Math.PI * 2);
        ctx.stroke();

        const innerStrokeColor = isRed ? 'rgba(192, 57, 43, 0.35)' : 'rgba(232, 232, 232, 0.3)';
        ctx.strokeStyle = innerStrokeColor;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.86 - strokeWidth * 1.8, 0, Math.PI * 2);
        ctx.stroke();

        const textColor = isRed ? '#c0392b' : '#f0f0f0';
        const fontSize = Math.round(radius * 1.2);
        const fontFamily = fontLoaded ? `'${FONT_FAMILY}', 'STKaiti', 'KaiTi', 'SimSun', serif` :
            `'STKaiti', 'KaiTi', 'SimSun', 'Noto Serif SC', serif`;

        ctx.fillStyle = textColor;
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.save();
        if (!isRed) {
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 2;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 1;
        }
        ctx.fillText(char, centerX, centerY - 1);
        ctx.restore();

        ctx.restore();
    }

    function buildMoveTree(game) {
        const root = {
            move: null,
            parent: null,
            children: [],
            step: 0,
            labelIndex: -1,
            nodeId: 'root'
        };
        const labelNodes = {};

        game.labels.forEach((labelInfo, labelIdx) => {
            const parentLabel = labelInfo[0];
            const branchStep = labelInfo[1];
            const moves = parseMovesString(game.moves[labelIdx]);

            let branchPoint = null;
            if (parentLabel === labelIdx) {
                branchPoint = root;
            } else if (labelNodes[parentLabel]) {
                const parentChain = labelNodes[parentLabel];
                const targetStep = branchStep - 1; // 分叉点应位于第 branchStep-1 步的节点

                branchPoint = parentChain.find(node => node.step === targetStep);

                if (!branchPoint) {
                    if (targetStep < parentChain[0].step) {
                        branchPoint = parentChain[0];
                    } else {
                        branchPoint = parentChain[parentChain.length - 1];
                    }
                    console.warn(`未找到 step=${targetStep} 的节点，使用最近节点 step=${branchPoint.step}`);
                }
            } else {
                console.warn(`未找到父label ${parentLabel}，使用根节点`);
                branchPoint = root;
            }

            let currentNode = branchPoint;
            const newChain = [currentNode];
            moves.forEach((move, moveIdx) => {
                const newNode = {
                    move: move,
                    parent: currentNode,
                    children: [],
                    step: currentNode.step + 1,
                    labelIndex: labelIdx,
                    nodeId: `${labelIdx}-${moveIdx}`
                };
                currentNode.children.push(newNode);
                currentNode = newNode;
                newChain.push(newNode);
            });
            labelNodes[labelIdx] = newChain;
        });

        return root;
    }

    function renderMovesList() {
        movesListEl.innerHTML = '';
        if (!moveTreeRoot || !currentPath || currentPath.length <= 1) {
            movesListEl.innerHTML = '<div class="moves-placeholder">暂无着法</div>';
            return;
        }

        // 添加“棋局开始”选项
        const startItem = document.createElement('div');
        startItem.className = 'move-item start-item';
        if (currentStepIndex === 0) startItem.classList.add('active');
        startItem.textContent = ' (๑•̀ㅂ•́)و✧ 开始';
        startItem.addEventListener('click', () => {
            currentStepIndex = 0;
            applyCurrentStepToBoard();
            renderMovesList();
            renderVariations();
        });
        movesListEl.appendChild(startItem);

        // 按回合分组显示着法
        // 步数从 1 开始（根节点为 0）
        const moveNodes = currentPath.slice(1); // 排除根节点
        const rounds = [];
        let i = 0;
        while (i < moveNodes.length) {
            const node = moveNodes[i];
            const step = node.step;
            if (step % 2 === 1) { // 红方步（奇数）
                rounds.push({ red: node, black: (i+1 < moveNodes.length && moveNodes[i+1].step === step+1) ? moveNodes[i+1] : null });
                i += (rounds[rounds.length-1].black ? 2 : 1);
            } else { // 黑方步（偶数，说明黑方先手）
                rounds.push({ red: null, black: node });
                i += 1;
            }
        }

        rounds.forEach((round, roundIdx) => {
            const roundDiv = document.createElement('div');
            roundDiv.className = 'move-round';

            // 红方着法
            const redSpan = document.createElement('span');
            redSpan.className = 'move-cell red-move';
            if (round.red) {
                const notation = moveToNotation(
                    getBoardStateAtNode(currentPath[round.red.step - 1]),
                    round.red.move,
                    true
                );
                redSpan.textContent = notation;
                if (round.red.parent && round.red.parent.children.length > 1) {
                    // const varMark = document.createElement('span');
                    // varMark.className = 'variation-mark';
                    // varMark.textContent = '变';
                    // redSpan.appendChild(varMark);
                    redSpan.classList.add('has-variation');
                }
                if (currentStepIndex === round.red.step) redSpan.classList.add('active');
                redSpan.addEventListener('click', () => {
                    currentStepIndex = round.red.step;
                    applyCurrentStepToBoard();
                    renderMovesList();
                    renderVariations();
                });
            } else {
                redSpan.classList.add('empty');
                redSpan.innerHTML = '&nbsp;';
            }

            // 黑方着法
            const blackSpan = document.createElement('span');
            blackSpan.className = 'move-cell black-move';
            if (round.black) {
                const notation = moveToNotation(
                    getBoardStateAtNode(currentPath[round.black.step - 1]),
                    round.black.move,
                    false
                );
                blackSpan.textContent = notation;
                if (round.black.parent && round.black.parent.children.length > 1) {
                    // const varMark = document.createElement('span');
                    // varMark.className = 'variation-mark';
                    // varMark.textContent = '变';
                    // blackSpan.appendChild(varMark);
                    blackSpan.classList.add('has-variation');
                }
                if (currentStepIndex === round.black.step) blackSpan.classList.add('active');
                blackSpan.addEventListener('click', () => {
                    currentStepIndex = round.black.step;
                    applyCurrentStepToBoard();
                    renderMovesList();
                    renderVariations();
                });
            } else {
                blackSpan.classList.add('empty');
                blackSpan.innerHTML = '&nbsp;';
            }

            roundDiv.appendChild(redSpan);
            roundDiv.appendChild(blackSpan);
            movesListEl.appendChild(roundDiv);
        });
    }

    function renderVariations() {
        const variationListEl = document.getElementById('variationList');
        if (!variationListEl) return;
        variationListEl.innerHTML = '';

        if (!currentPath.length || currentStepIndex >= currentPath.length) {
            variationListEl.innerHTML = '<div class="moves-placeholder">无变着</div>';
            return;
        }

        const currentNode = currentPath[currentStepIndex];
        // 只有当当前节点的父节点拥有多个子节点时（即当前节点是分支的第一个着法），才显示变着选项
        if (!currentNode.parent || currentNode.parent.children.length <= 1) {
            variationListEl.innerHTML = '<div class="moves-placeholder">无变着</div>';
            return;
        }

        const branchNode = currentNode.parent;
        const children = branchNode.children;

        // 确定当前路径中 branchNode 的下一个节点（用于高亮当前分支）
        const branchChildInPath = (branchNode.step + 1 < currentPath.length)
            ? currentPath[branchNode.step + 1]
            : null;

        children.forEach(child => {
            const isCurrent = (branchChildInPath === child);
            const stateBeforeMove = getBoardStateAtNode(branchNode);
            const isRedTurn = (child.step % 2 === 1);
            const notation = moveToNotation(stateBeforeMove, child.move, isRedTurn);

            const varItem = document.createElement('div');
            varItem.className = 'move-item variation-item';
            if (isCurrent) varItem.classList.add('active');
            varItem.textContent = notation;
            varItem.addEventListener('click', () => {
                // 构建新路径：从根到 branchNode，然后选择 child，并沿第一个子节点走到末端
                const newPath = [];
                let pathNode = moveTreeRoot;
                newPath.push(pathNode);

                while (pathNode !== branchNode) {
                    const next = pathNode.children.find(c => currentPath.includes(c));
                    pathNode = next || pathNode.children[0];
                    newPath.push(pathNode);
                }

                newPath.push(child);
                pathNode = child;
                while (pathNode.children.length > 0) {
                    pathNode = pathNode.children[0];
                    newPath.push(pathNode);
                }

                currentPath = newPath;
                currentStepIndex = currentPath.indexOf(child);
                applyCurrentStepToBoard();
                renderMovesList();
                renderVariations();
            });
            variationListEl.appendChild(varItem);
        });
    }

    function initGame(game) {
        currentGame = game;
        parseFen(game.fen);
        initialBoardState = cloneBoardState(boardState);
        moveTreeRoot = buildMoveTree(game);

        // 构建完整主线路径（从根节点沿第一个子节点走到末端）
        currentPath = [moveTreeRoot];
        let node = moveTreeRoot;
        while (node.children.length > 0) {
            node = node.children[0];
            currentPath.push(node);
        }

        // 初始显示初始局面
        currentStepIndex = 0;
        applyCurrentStepToBoard();

        renderMovesList();
        renderVariations();
    }

    // ============ 切换局面 ============
    function switchToGame(id) {
        const numId = parseInt(id, 10);
        if (isNaN(numId) || numId < 1 || numId > 550) {
            console.warn(`无效的局面ID: ${id}`);
            return;
        }
        // 更新输入框
        gameIdInput.value = numId;
        // 更新下拉框选中项
        for (let i = 0; i < gameSelect.options.length; i++) {
            if (parseInt(gameSelect.options[i].value, 10) === numId) {
                gameSelect.selectedIndex = i;
                break;
            }
        }
        if (gamesLoaded && allGames.length > 0) {
            const game = allGames.find(g => g.id === numId);
            if (game) {
                initGame(game);
            } else {
                console.warn(`未找到ID为 ${numId} 的棋局数据`);
            }
        } else {
            console.log(`JSON 尚未加载，无法设置棋盘，请稍后重试`);
        }
    }

    // ============ 事件绑定 ============
    gameIdInput.addEventListener('change', function() {
        const val = parseInt(this.value, 10);
        if (val >= 1 && val <= 550) {
            switchToGame(val);
        } else {
            this.value = Math.min(550, Math.max(1, val || 1));
            switchToGame(parseInt(this.value, 10));
        }
    });

    gameIdInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            this.blur();
            const val = parseInt(this.value, 10);
            if (val >= 1 && val <= 550) switchToGame(val);
        }
    });

    gameSelect.addEventListener('change', function() {
        const val = parseInt(this.value, 10);
        if (val >= 1 && val <= 550) switchToGame(val);
    });

    canvas.addEventListener('click', function(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;
        const col = xToCol(canvasX);
        const row = yToRow(canvasY);
        if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
            const piece = boardState[row][col];
            if (piece) {
                const char = getPieceChar(piece);
                const side = isRedPiece(piece) ? '红方' : '黑方';
                console.log(`点击了 ${side}${char} (${col},${row})`);
            }
        }
    });

    // ============ 初始化 ============
    function init() {
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        parseFen(DEFAULT_FEN);
        initResources();
        loadGameData();
    }

    init();

    // 暴露全局接口
    window.xiangqiBoard = {
        setFen: function(fen) {
            parseFen(fen);
            if (resourcesReady) {
                drawBoard();
            }
        },
        getFen: function() { return currentFen; },
        redraw: function() { if (resourcesReady) drawBoard(); },
        getBoardState: function() { return boardState; },
        switchToGame: switchToGame
    };
})();
