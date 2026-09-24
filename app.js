/**
 * Chess Application - Main UI Controller
 * Handles screens, board rendering, timers, game flow
 */

// ========== Cookie Utility ==========
const Cookie = {
    set(name, value, days = 365) {
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
    },
    get(name) {
        const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : null;
    },
    remove(name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
    }
};

const PIECE_UNICODE = {
    K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
};

const TIMER_PRESETS = {
    '1+0': { time: 60, increment: 0, label: '1 min' },
    '3+0': { time: 180, increment: 0, label: '3 min' },
    '5+0': { time: 300, increment: 0, label: '5 min' },
    '5+3': { time: 300, increment: 3, label: '5+3' },
    '10+0': { time: 600, increment: 0, label: '10 min' },
    '15+10': { time: 900, increment: 10, label: '15+10' },
    '30+0': { time: 1800, increment: 0, label: '30 min' },
    'none': { time: Infinity, increment: 0, label: '∞' }
};

const BOARD_THEMES = {
    classic:  { name: 'Classic',  light: '#f0d9b5', dark: '#b58863', coordLight: '#b58863', coordDark: '#f0d9b5' },
    green:    { name: 'Green',    light: '#eeeed2', dark: '#769656', coordLight: '#769656', coordDark: '#eeeed2' },
    blue:     { name: 'Ice',      light: '#dee3e6', dark: '#8ca2ad', coordLight: '#8ca2ad', coordDark: '#dee3e6' },
    purple:   { name: 'Royal',    light: '#e0d0f0', dark: '#9070aa', coordLight: '#9070aa', coordDark: '#e0d0f0' },
    wood:     { name: 'Walnut',   light: '#e6c88c', dark: '#a87944', coordLight: '#a87944', coordDark: '#e6c88c' },
    neon:     { name: 'Neon',     light: '#2a3040', dark: '#171d2c', coordLight: '#dfff00', coordDark: '#dfff00' },
    midnight: { name: 'Midnight', light: '#b0bec5', dark: '#546e7a', coordLight: '#546e7a', coordDark: '#b0bec5' },
    coral:    { name: 'Coral',    light: '#f5e6ca', dark: '#c97856', coordLight: '#c97856', coordDark: '#f5e6ca' }
};

class ChessApp {
    constructor() {
        this.engine = new ChessEngine();
        this.ai = null;
        this.gameMode = null; // 'bot' or 'pvp'
        this.playerName = '';
        this.player2Name = '';
        this.playerColor = 'w';
        this.selectedSquare = null;
        this.legalMoves = [];
        this.lastMove = null;
        this.boardFlipped = false;
        this.difficulty = 50;
        this.boardTheme = 'classic';

        // Timer
        this.timerPreset = '10+0';
        this.timers = { w: 600, b: 600 };
        this.timerInterval = null;
        this.timerIncrement = 0;

        this.init();
    }

    init() {
        this.loadPreferences();
        this.setupEventListeners();
        this.showScreen('welcome-screen');
    }

    // ========== COOKIE PERSISTENCE ==========

    loadPreferences() {
        const name = Cookie.get('chess_name');
        if (name) document.getElementById('playerNameInput').value = name;

        const timer = Cookie.get('chess_timer');
        if (timer && TIMER_PRESETS[timer]) this.timerPreset = timer;

        const diff = Cookie.get('chess_difficulty');
        if (diff) this.difficulty = parseInt(diff);

        const color = Cookie.get('chess_color');
        if (color) this.playerColor = color;

        const theme = Cookie.get('chess_board_theme');
        if (theme && BOARD_THEMES[theme]) this.boardTheme = theme;

        const p2name = Cookie.get('chess_player2');
        if (p2name) document.getElementById('player2NameInput').value = p2name;
    }

    savePreferences() {
        Cookie.set('chess_name', this.playerName);
        Cookie.set('chess_timer', this.timerPreset);
        Cookie.set('chess_difficulty', this.difficulty);
        Cookie.set('chess_color', this.playerColor);
        Cookie.set('chess_board_theme', this.boardTheme);
        if (this.player2Name) Cookie.set('chess_player2', this.player2Name);
    }

    setupEventListeners() {
        // Welcome screen
        document.getElementById('continueBtn').addEventListener('click', () => this.handleContinue());
        document.getElementById('playerNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleContinue();
        });

        // Mode selection
        document.getElementById('botModeCard').addEventListener('click', () => this.selectMode('bot'));
        document.getElementById('pvpModeCard').addEventListener('click', () => this.selectMode('pvp'));

        // Difficulty slider
        document.getElementById('difficultySlider').addEventListener('input', (e) => {
            this.difficulty = parseInt(e.target.value);
            this.updateBotProfile();
        });

        // Timer pills
        document.querySelectorAll('.timer-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                document.querySelectorAll('.timer-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.timerPreset = pill.dataset.timer;
            });
        });

        // Color options
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.playerColor = opt.dataset.color;
            });
        });

        // Board theme options
        document.querySelectorAll('.theme-option').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.boardTheme = opt.dataset.theme;
            });
        });

        // Start game buttons
        document.getElementById('startBotGame').addEventListener('click', () => this.startBotGame());
        document.getElementById('startPvpGame').addEventListener('click', () => this.startPvpGame());

        // Back buttons
        document.querySelectorAll('.back-to-mode').forEach(btn => {
            btn.addEventListener('click', () => this.showScreen('mode-screen'));
        });
        document.getElementById('backToWelcome').addEventListener('click', () => this.showScreen('welcome-screen'));

        // Game controls
        document.getElementById('resignBtn').addEventListener('click', () => this.resign());
        document.getElementById('newGameBtn').addEventListener('click', () => this.showScreen('mode-screen'));
        document.getElementById('drawBtn').addEventListener('click', () => this.offerDraw());

        // Game over modal
        document.getElementById('playAgainBtn').addEventListener('click', () => this.playAgain());
        document.getElementById('goHomeBtn').addEventListener('click', () => {
            this.closeModal('gameOverModal');
            this.showScreen('mode-screen');
        });

        // PVP name input
        document.getElementById('player2NameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.startPvpGame();
        });
    }

    // ========== SCREEN MANAGEMENT ==========

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');

        if (screenId === 'mode-screen') {
            document.getElementById('greetingName').textContent = this.playerName;
        }
    }

    // ========== WELCOME & MODE ==========

    handleContinue() {
        const name = document.getElementById('playerNameInput').value.trim();
        if (!name) {
            document.getElementById('playerNameInput').focus();
            document.getElementById('playerNameInput').style.borderColor = 'var(--danger)';
            setTimeout(() => {
                document.getElementById('playerNameInput').style.borderColor = '';
            }, 2000);
            return;
        }
        this.playerName = name;
        Cookie.set('chess_name', name);
        this.showScreen('mode-screen');
    }

    selectMode(mode) {
        this.gameMode = mode;
        if (mode === 'bot') {
            this.updateBotProfile();
            this.applySetupDefaults('bot-setup-screen');
            this.showScreen('bot-setup-screen');
        } else {
            this.applySetupDefaults('pvp-setup-screen');
            this.showScreen('pvp-setup-screen');
        }
    }

    updateBotProfile() {
        const tempAI = new ChessAI(this.engine, this.difficulty);
        document.getElementById('botName').textContent = tempAI.getBotName();
        const title = tempAI.getBotTitle();
        const titleEl = document.getElementById('botTitle');
        if (title) {
            titleEl.textContent = title;
            titleEl.style.display = 'inline-block';
        } else {
            titleEl.style.display = 'none';
        }
        document.getElementById('botElo').textContent = tempAI.getELO();
        document.getElementById('difficultyValue').textContent = this.getDifficultyLabel();

        // Update rank label
        const elo = tempAI.getELO();
        let rank = 'Beginner';
        if (elo >= 2000) rank = 'Master';
        else if (elo >= 1600) rank = 'Expert';
        else if (elo >= 1200) rank = 'Intermediate';
        else if (elo >= 800) rank = 'Casual';
        document.getElementById('botRankLabel').textContent = rank + ' Level';
    }

    getDifficultyLabel() {
        if (this.difficulty <= 20) return 'Beginner';
        if (this.difficulty <= 40) return 'Easy';
        if (this.difficulty <= 55) return 'Intermediate';
        if (this.difficulty <= 70) return 'Advanced';
        if (this.difficulty <= 85) return 'Expert';
        return 'Master';
    }

    // ========== GAME START ==========

    applySetupDefaults(screenId) {
        // Restore saved difficulty slider
        const slider = document.getElementById('difficultySlider');
        if (slider) slider.value = this.difficulty;

        // Restore saved timer selection
        document.querySelectorAll(`#${screenId} .timer-pill`).forEach(p => {
            p.classList.toggle('active', p.dataset.timer === this.timerPreset);
        });

        // Restore saved color
        document.querySelectorAll('.color-option').forEach(o => {
            o.classList.toggle('active', o.dataset.color === this.playerColor);
        });

        // Restore saved board theme
        document.querySelectorAll('.theme-option').forEach(o => {
            o.classList.toggle('active', o.dataset.theme === this.boardTheme);
        });
    }

    startBotGame() {
        let color = this.playerColor;
        if (color === 'random') {
            color = Math.random() < 0.5 ? 'w' : 'b';
        }
        this.playerColor = color;
        this.boardFlipped = color === 'b';

        const botColor = color === 'w' ? 'b' : 'w';
        this.ai = new ChessAI(this.engine, this.difficulty, botColor);

        this.player2Name = this.ai.getBotName();
        this.savePreferences();
        this.initGame();

        // If player is black, bot moves first
        if (this.playerColor === 'b') {
            setTimeout(() => this.makeBotMove(), 500);
        }
    }

    startPvpGame() {
        const name2 = document.getElementById('player2NameInput').value.trim() || 'Player 2';
        this.player2Name = name2;
        this.playerColor = 'w';
        this.boardFlipped = false;
        this.ai = null;
        this.savePreferences();
        this.initGame();
    }

    initGame() {
        this.engine.reset();
        this.selectedSquare = null;
        this.legalMoves = [];
        this.lastMove = null;

        // Setup timers
        const preset = TIMER_PRESETS[this.timerPreset];
        this.timers = { w: preset.time, b: preset.time };
        this.timerIncrement = preset.increment;
        if (this.timerInterval) clearInterval(this.timerInterval);

        // Setup UI
        this.setupPlayerInfo();
        this.renderBoard();
        this.updateMoveList();
        this.updateStatus();
        this.updateTimerDisplay();
        this.startTimer();

        this.showScreen('game-screen');
    }

    setupPlayerInfo() {
        const isWhite = this.playerColor === 'w';
        const topColor = this.boardFlipped ? 'w' : 'b';
        const bottomColor = this.boardFlipped ? 'b' : 'w';

        // Top player (opponent from board perspective)
        const topName = topColor === this.playerColor ? this.playerName : this.player2Name;
        const bottomName = bottomColor === this.playerColor ? this.playerName : this.player2Name;

        document.getElementById('topPlayerName').textContent = topName;
        document.getElementById('bottomPlayerName').textContent = bottomName;

        const topAvatar = document.getElementById('topPlayerAvatar');
        const bottomAvatar = document.getElementById('bottomPlayerAvatar');
        topAvatar.className = 'player-avatar ' + (topColor === 'w' ? 'white-player' : 'black-player');
        bottomAvatar.className = 'player-avatar ' + (bottomColor === 'w' ? 'white-player' : 'black-player');
        topAvatar.textContent = topName[0].toUpperCase();
        bottomAvatar.textContent = bottomName[0].toUpperCase();

        // ELO display for bot
        if (this.ai) {
            const botEloText = `Rating: ${this.ai.getELO()}`;
            if (topColor !== this.playerColor) {
                document.getElementById('topPlayerElo').textContent = botEloText;
                document.getElementById('bottomPlayerElo').textContent = '';
            } else {
                document.getElementById('bottomPlayerElo').textContent = botEloText;
                document.getElementById('topPlayerElo').textContent = '';
            }
        } else {
            document.getElementById('topPlayerElo').textContent = '';
            document.getElementById('bottomPlayerElo').textContent = '';
        }

        // Store color mapping
        this.topColor = topColor;
        this.bottomColor = bottomColor;
    }

    // ========== BOARD RENDERING ==========

    renderBoard() {
        const boardEl = document.getElementById('chessBoard');
        boardEl.innerHTML = '';

        // Apply board theme
        const theme = BOARD_THEMES[this.boardTheme] || BOARD_THEMES.classic;
        boardEl.className = 'chess-board board-' + this.boardTheme;

        for (let displayRow = 0; displayRow < 8; displayRow++) {
            for (let displayCol = 0; displayCol < 8; displayCol++) {
                const row = this.boardFlipped ? 7 - displayRow : displayRow;
                const col = this.boardFlipped ? 7 - displayCol : displayCol;

                const square = document.createElement('div');
                const isLight = (row + col) % 2 === 0;
                square.className = `square ${isLight ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;

                // Coordinate labels
                if (displayCol === 0) {
                    const rank = document.createElement('span');
                    rank.className = 'coord-label coord-rank';
                    rank.textContent = 8 - row;
                    square.appendChild(rank);
                }
                if (displayRow === 7) {
                    const file = document.createElement('span');
                    file.className = 'coord-label coord-file';
                    file.textContent = String.fromCharCode(97 + col);
                    square.appendChild(file);
                }

                // Highlights
                if (this.lastMove) {
                    if ((row === this.lastMove.from.row && col === this.lastMove.from.col) ||
                        (row === this.lastMove.to.row && col === this.lastMove.to.col)) {
                        square.classList.add('highlighted');
                    }
                }

                if (this.selectedSquare && this.selectedSquare.row === row && this.selectedSquare.col === col) {
                    square.classList.add('selected');
                }

                // Check highlight
                const king = this.engine.findKing(this.engine.turn);
                if (king && this.engine.isInCheck(this.engine.turn) && king.row === row && king.col === col) {
                    square.classList.add('check');
                }

                // Legal move dots
                const isLegalTarget = this.legalMoves.some(m => m.to.row === row && m.to.col === col);
                if (isLegalTarget) {
                    const piece = this.engine.board[row][col];
                    if (piece) {
                        const ring = document.createElement('div');
                        ring.className = 'capture-ring';
                        square.appendChild(ring);
                    } else {
                        const dot = document.createElement('div');
                        dot.className = 'move-dot';
                        square.appendChild(dot);
                    }
                }

                // Piece
                const piece = this.engine.board[row][col];
                if (piece) {
                    const pieceEl = document.createElement('span');
                    pieceEl.className = 'piece';
                    pieceEl.textContent = PIECE_UNICODE[piece];
                    square.appendChild(pieceEl);
                }

                // Click handler
                square.addEventListener('click', () => this.handleSquareClick(row, col));

                boardEl.appendChild(square);
            }
        }
    }

    // ========== INTERACTION ==========

    handleSquareClick(row, col) {
        if (this.engine.gameOver) return;

        // In bot mode, only allow moves on player's turn
        if (this.ai && this.engine.turn !== this.playerColor) return;

        const piece = this.engine.board[row][col];
        const isOwnPiece = piece && this.engine.getColor(piece) === this.engine.turn;

        if (this.selectedSquare) {
            // Check if clicking on a legal move target
            const targetMove = this.legalMoves.find(m => m.to.row === row && m.to.col === col);
            if (targetMove) {
                this.handleMove(this.selectedSquare.row, this.selectedSquare.col, row, col);
                return;
            }

            // If clicking own piece, select it instead
            if (isOwnPiece) {
                this.selectSquare(row, col);
                return;
            }

            // Deselect
            this.deselectSquare();
            return;
        }

        if (isOwnPiece) {
            this.selectSquare(row, col);
        }
    }

    selectSquare(row, col) {
        this.selectedSquare = { row, col };
        this.legalMoves = this.engine.getLegalMoves(row, col);
        this.renderBoard();
    }

    deselectSquare() {
        this.selectedSquare = null;
        this.legalMoves = [];
        this.renderBoard();
    }

    handleMove(fromRow, fromCol, toRow, toCol, promotion) {
        const result = this.engine.makeMove(fromRow, fromCol, toRow, toCol, promotion || undefined);

        if (!result) return;

        if (result.needsPromotion) {
            this.showPromotionModal(result.from, result.to);
            return;
        }

        // Add timer increment
        const movedColor = this.engine.turn === 'w' ? 'b' : 'w';
        if (this.timers[movedColor] !== Infinity) {
            this.timers[movedColor] += this.timerIncrement;
        }

        this.lastMove = result;
        this.selectedSquare = null;
        this.legalMoves = [];

        this.renderBoard();
        this.updateMoveList();
        this.updateStatus();
        this.updateTimerDisplay();
        this.updateCapturedPieces();
        this.updateActiveTurn();

        // Play sound
        this.playSound(result);

        if (this.engine.gameOver) {
            this.stopTimer();
            setTimeout(() => this.showGameOver(), 600);
            return;
        }

        // Bot move
        if (this.ai && this.engine.turn === this.ai.color) {
            setTimeout(() => this.makeBotMove(), 400);
        }
    }

    makeBotMove() {
        if (this.engine.gameOver) return;

        // Show thinking indicator
        const thinking = document.getElementById('thinkingIndicator');
        thinking.classList.add('active');

        setTimeout(() => {
            const move = this.ai.getBestMove();
            thinking.classList.remove('active');

            if (!move) return;

            let promotion = move.promotion || undefined;
            const result = this.engine.makeMove(move.from.row, move.from.col, move.to.row, move.to.col, promotion);
            if (!result) return;

            // Add timer increment
            const movedColor = this.engine.turn === 'w' ? 'b' : 'w';
            if (this.timers[movedColor] !== Infinity) {
                this.timers[movedColor] += this.timerIncrement;
            }

            this.lastMove = result;
            this.selectedSquare = null;
            this.legalMoves = [];

            this.renderBoard();
            this.updateMoveList();
            this.updateStatus();
            this.updateTimerDisplay();
            this.updateCapturedPieces();
            this.updateActiveTurn();
            this.playSound(result);

            if (this.engine.gameOver) {
                this.stopTimer();
                setTimeout(() => this.showGameOver(), 600);
            }
        }, 100);
    }

    // ========== PROMOTION ==========

    showPromotionModal(from, to) {
        const color = this.engine.turn;
        const pieces = color === 'w' ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];
        const container = document.getElementById('promotionPieces');
        container.innerHTML = '';

        for (const p of pieces) {
            const btn = document.createElement('button');
            btn.className = 'promotion-piece';
            btn.textContent = PIECE_UNICODE[p];
            btn.addEventListener('click', () => {
                this.closeModal('promotionModal');
                this.handleMove(from.row, from.col, to.row, to.col, p);
            });
            container.appendChild(btn);
        }

        document.getElementById('promotionModal').classList.add('active');
    }

    // ========== TIMER ==========

    startTimer() {
        if (this.timerPreset === 'none') return;
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            if (this.engine.gameOver) {
                this.stopTimer();
                return;
            }

            const color = this.engine.turn;
            if (this.timers[color] !== Infinity) {
                this.timers[color] = Math.max(0, this.timers[color] - 0.1);
                this.updateTimerDisplay();

                if (this.timers[color] <= 0) {
                    this.engine.timeout(color);
                    this.stopTimer();
                    this.renderBoard();
                    this.updateStatus();
                    setTimeout(() => this.showGameOver(), 600);
                }
            }
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimerDisplay() {
        const format = (seconds) => {
            if (seconds === Infinity) return '∞';
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return `${m}:${s.toString().padStart(2, '0')}`;
        };

        const topTimer = document.getElementById('topTimer');
        const bottomTimer = document.getElementById('bottomTimer');

        topTimer.textContent = format(this.timers[this.topColor]);
        bottomTimer.textContent = format(this.timers[this.bottomColor]);

        // Low time warning
        topTimer.classList.toggle('low-time', this.timers[this.topColor] < 30 && this.timers[this.topColor] !== Infinity);
        bottomTimer.classList.toggle('low-time', this.timers[this.bottomColor] < 30 && this.timers[this.bottomColor] !== Infinity);
    }

    // ========== UI UPDATES ==========

    updateMoveList() {
        const list = document.getElementById('moveList');
        list.innerHTML = '';

        const moves = this.engine.moveLog;
        for (let i = 0; i < moves.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const row = document.createElement('div');
            row.className = 'move-row';

            const numEl = document.createElement('span');
            numEl.className = 'move-number';
            numEl.textContent = moveNum + '.';
            row.appendChild(numEl);

            const whiteEl = document.createElement('span');
            whiteEl.className = 'move-white' + (i === moves.length - 1 ? ' current' : '');
            whiteEl.textContent = moves[i].notation;
            row.appendChild(whiteEl);

            if (i + 1 < moves.length) {
                const blackEl = document.createElement('span');
                blackEl.className = 'move-black' + (i + 1 === moves.length - 1 ? ' current' : '');
                blackEl.textContent = moves[i + 1].notation;
                row.appendChild(blackEl);
            }

            list.appendChild(row);
        }

        list.scrollTop = list.scrollHeight;
    }

    updateStatus() {
        const statusEl = document.getElementById('gameStatus');
        statusEl.className = 'game-status';

        if (this.engine.gameOver) {
            if (this.engine.resultReason === 'checkmate') {
                statusEl.className = 'game-status checkmate';
                const winner = this.engine.result === 'white' ? 'White' : 'Black';
                statusEl.innerHTML = `<span class="status-dot" style="background:var(--danger)"></span> Checkmate! ${winner} wins`;
            } else if (this.engine.resultReason === 'timeout') {
                const winner = this.engine.result === 'white' ? 'White' : 'Black';
                statusEl.innerHTML = `<span class="status-dot" style="background:var(--danger)"></span> Time out! ${winner} wins`;
            } else if (this.engine.resultReason === 'resignation') {
                const winner = this.engine.result === 'white' ? 'White' : 'Black';
                statusEl.innerHTML = `<span class="status-dot" style="background:var(--danger)"></span> ${winner} wins by resignation`;
            } else {
                statusEl.innerHTML = `<span class="status-dot" style="background:var(--warning)"></span> Draw — ${this.engine.resultReason}`;
            }
        } else if (this.engine.isInCheck(this.engine.turn)) {
            statusEl.className = 'game-status check';
            statusEl.innerHTML = `<span class="status-dot" style="background:var(--warning)"></span> Check!`;
        } else {
            const turnName = this.engine.turn === 'w' ? 'White' : 'Black';
            statusEl.innerHTML = `<span class="status-dot"></span> ${turnName}'s turn`;
        }
    }

    updateActiveTurn() {
        const topInfo = document.getElementById('topPlayerInfo');
        const bottomInfo = document.getElementById('bottomPlayerInfo');

        topInfo.classList.toggle('active-turn', this.engine.turn === this.topColor);
        bottomInfo.classList.toggle('active-turn', this.engine.turn === this.bottomColor);
    }

    updateCapturedPieces() {
        const captured = this.engine.getCapturedPieces();

        // Top player shows pieces they captured (enemy pieces)
        const topCaptured = document.getElementById('topCaptured');
        const bottomCaptured = document.getElementById('bottomCaptured');

        // Top player captured = pieces of bottom color that were taken
        const topCapturedPieces = captured[this.bottomColor];
        const bottomCapturedPieces = captured[this.topColor];

        topCaptured.innerHTML = topCapturedPieces.map(p => {
            const piece = this.topColor === 'w' ?
                PIECE_UNICODE[p] : PIECE_UNICODE[p.toUpperCase()];
            // Show the captured pieces (enemy color)
            return `<span>${PIECE_UNICODE[this.bottomColor === 'w' ? p.toUpperCase() : p]}</span>`;
        }).join('');

        bottomCaptured.innerHTML = bottomCapturedPieces.map(p => {
            return `<span>${PIECE_UNICODE[this.topColor === 'w' ? p.toUpperCase() : p]}</span>`;
        }).join('');
    }

    // ========== SOUNDS ==========

    playSound(move) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (move.status === 'checkmate') {
                osc.frequency.value = 440;
                gain.gain.value = 0.15;
                osc.start();
                osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.15);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
                osc.stop(ctx.currentTime + 0.3);
            } else if (move.status === 'check') {
                osc.frequency.value = 660;
                gain.gain.value = 0.12;
                osc.start();
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
                osc.stop(ctx.currentTime + 0.15);
            } else if (move.captured) {
                osc.frequency.value = 300;
                osc.type = 'square';
                gain.gain.value = 0.08;
                osc.start();
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
                osc.stop(ctx.currentTime + 0.1);
            } else if (move.castling) {
                osc.frequency.value = 500;
                gain.gain.value = 0.1;
                osc.start();
                osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.1);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
                osc.stop(ctx.currentTime + 0.15);
            } else {
                osc.frequency.value = 500;
                gain.gain.value = 0.06;
                osc.start();
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
                osc.stop(ctx.currentTime + 0.08);
            }
        } catch (e) {
            // Audio not available
        }
    }

    // ========== GAME ACTIONS ==========

    resign() {
        if (this.engine.gameOver) return;
        if (!confirm('Are you sure you want to resign?')) return;

        const resignColor = this.ai ? this.playerColor : this.engine.turn;
        this.engine.resign(resignColor);
        this.stopTimer();
        this.updateStatus();
        this.renderBoard();
        setTimeout(() => this.showGameOver(), 400);
    }

    offerDraw() {
        if (this.engine.gameOver) return;
        if (this.ai) {
            // Bot accepts draw only if evaluation is roughly equal
            const eval_ = this.ai.evaluateFast();
            const threshold = 100;
            if (Math.abs(eval_) < threshold) {
                this.engine.gameOver = true;
                this.engine.result = 'draw';
                this.engine.resultReason = 'mutual agreement';
                this.stopTimer();
                this.updateStatus();
                setTimeout(() => this.showGameOver(), 400);
            } else {
                alert('The bot declines the draw offer.');
            }
        } else {
            if (confirm('Do both players agree to a draw?')) {
                this.engine.gameOver = true;
                this.engine.result = 'draw';
                this.engine.resultReason = 'mutual agreement';
                this.stopTimer();
                this.updateStatus();
                setTimeout(() => this.showGameOver(), 400);
            }
        }
    }

    // ========== MODALS ==========

    showGameOver() {
        const modal = document.getElementById('gameOverModal');
        const icon = document.getElementById('resultIcon');
        const text = document.getElementById('resultText');
        const reason = document.getElementById('resultReason');

        if (this.engine.result === 'draw') {
            icon.textContent = '🤝';
            text.textContent = 'Draw!';
            text.style.color = 'var(--warning)';
        } else {
            const winnerColor = this.engine.result;
            let winnerName;

            if (this.ai) {
                winnerName = winnerColor === this.playerColor ? this.playerName : this.player2Name;
            } else {
                winnerName = winnerColor === 'w' ? this.playerName : this.player2Name;
            }

            const isPlayerWin = this.ai ? winnerColor === this.playerColor : true;

            if (this.ai && winnerColor === this.playerColor) {
                icon.textContent = '🏆';
                text.textContent = 'You Win!';
                text.style.color = 'var(--success)';
            } else if (this.ai) {
                icon.textContent = '😔';
                text.textContent = 'You Lost';
                text.style.color = 'var(--danger)';
            } else {
                icon.textContent = '🏆';
                text.textContent = `${winnerName} Wins!`;
                text.style.color = 'var(--success)';
            }
        }

        reason.textContent = this.engine.resultReason.charAt(0).toUpperCase() + this.engine.resultReason.slice(1);
        modal.classList.add('active');
    }

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    }

    playAgain() {
        this.closeModal('gameOverModal');
        if (this.gameMode === 'bot') {
            this.showScreen('bot-setup-screen');
        } else {
            this.showScreen('pvp-setup-screen');
        }
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ChessApp();
});
