/**
 * Chess Engine - Complete game logic
 * Handles board state, move generation, validation, and game state detection
 */
class ChessEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.board = this.createInitialBoard();
        this.turn = 'w';
        this.castling = { K: true, Q: true, k: true, q: true };
        this.enPassant = null;
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;
        this.undoStack = [];
        this.moveLog = [];
        this.gameOver = false;
        this.result = null;
        this.resultReason = '';
    }

    createInitialBoard() {
        return [
            ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
            ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
            ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
        ];
    }

    isWhite(piece) { return piece !== null && piece === piece.toUpperCase(); }
    isBlack(piece) { return piece !== null && piece === piece.toLowerCase(); }
    getColor(piece) {
        if (!piece) return null;
        return this.isWhite(piece) ? 'w' : 'b';
    }
    isAlly(piece, color) { return this.getColor(piece) === color; }
    isEnemy(piece, color) {
        const c = this.getColor(piece);
        return c !== null && c !== color;
    }
    inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
    opponent(color) { return color === 'w' ? 'b' : 'w'; }

    // ========== MOVE GENERATION ==========

    getPseudoLegalMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];
        const color = this.getColor(piece);
        const type = piece.toLowerCase();
        switch (type) {
            case 'p': return this.getPawnMoves(row, col, color);
            case 'r': return this.getSlidingMoves(row, col, color, [[0, 1], [0, -1], [1, 0], [-1, 0]]);
            case 'b': return this.getSlidingMoves(row, col, color, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
            case 'q': return this.getSlidingMoves(row, col, color, [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
            case 'n': return this.getKnightMoves(row, col, color);
            case 'k': return this.getKingMoves(row, col, color);
            default: return [];
        }
    }

    getPawnMoves(row, col, color) {
        const moves = [];
        const dir = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;
        const promoRow = color === 'w' ? 0 : 7;

        const r1 = row + dir;
        if (this.inBounds(r1, col) && !this.board[r1][col]) {
            if (r1 === promoRow) {
                for (const p of ['q', 'r', 'b', 'n']) {
                    moves.push({ from: { row, col }, to: { row: r1, col }, promotion: color === 'w' ? p.toUpperCase() : p });
                }
            } else {
                moves.push({ from: { row, col }, to: { row: r1, col } });
                const r2 = row + 2 * dir;
                if (row === startRow && !this.board[r2][col]) {
                    moves.push({ from: { row, col }, to: { row: r2, col } });
                }
            }
        }

        for (const dc of [-1, 1]) {
            const nc = col + dc;
            if (!this.inBounds(r1, nc)) continue;
            if (this.isEnemy(this.board[r1][nc], color)) {
                if (r1 === promoRow) {
                    for (const p of ['q', 'r', 'b', 'n']) {
                        moves.push({ from: { row, col }, to: { row: r1, col: nc }, promotion: color === 'w' ? p.toUpperCase() : p });
                    }
                } else {
                    moves.push({ from: { row, col }, to: { row: r1, col: nc } });
                }
            }
            if (this.enPassant && this.enPassant.row === r1 && this.enPassant.col === nc) {
                moves.push({ from: { row, col }, to: { row: r1, col: nc }, enPassant: true });
            }
        }
        return moves;
    }

    getSlidingMoves(row, col, color, directions) {
        const moves = [];
        for (const [dr, dc] of directions) {
            let r = row + dr, c = col + dc;
            while (this.inBounds(r, c)) {
                if (this.isAlly(this.board[r][c], color)) break;
                moves.push({ from: { row, col }, to: { row: r, col: c } });
                if (this.board[r][c]) break;
                r += dr; c += dc;
            }
        }
        return moves;
    }

    getKnightMoves(row, col, color) {
        const moves = [];
        for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
            const r = row + dr, c = col + dc;
            if (this.inBounds(r, c) && !this.isAlly(this.board[r][c], color)) {
                moves.push({ from: { row, col }, to: { row: r, col: c } });
            }
        }
        return moves;
    }

    getKingMoves(row, col, color) {
        const moves = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr, c = col + dc;
                if (this.inBounds(r, c) && !this.isAlly(this.board[r][c], color)) {
                    moves.push({ from: { row, col }, to: { row: r, col: c } });
                }
            }
        }

        const enemy = this.opponent(color);
        if (color === 'w' && row === 7 && col === 4) {
            if (this.castling.K && !this.board[7][5] && !this.board[7][6] && this.board[7][7] === 'R') {
                if (!this.isSquareAttacked(7, 4, enemy) && !this.isSquareAttacked(7, 5, enemy) && !this.isSquareAttacked(7, 6, enemy)) {
                    moves.push({ from: { row: 7, col: 4 }, to: { row: 7, col: 6 }, castling: 'K' });
                }
            }
            if (this.castling.Q && !this.board[7][3] && !this.board[7][2] && !this.board[7][1] && this.board[7][0] === 'R') {
                if (!this.isSquareAttacked(7, 4, enemy) && !this.isSquareAttacked(7, 3, enemy) && !this.isSquareAttacked(7, 2, enemy)) {
                    moves.push({ from: { row: 7, col: 4 }, to: { row: 7, col: 2 }, castling: 'Q' });
                }
            }
        } else if (color === 'b' && row === 0 && col === 4) {
            if (this.castling.k && !this.board[0][5] && !this.board[0][6] && this.board[0][7] === 'r') {
                if (!this.isSquareAttacked(0, 4, enemy) && !this.isSquareAttacked(0, 5, enemy) && !this.isSquareAttacked(0, 6, enemy)) {
                    moves.push({ from: { row: 0, col: 4 }, to: { row: 0, col: 6 }, castling: 'k' });
                }
            }
            if (this.castling.q && !this.board[0][3] && !this.board[0][2] && !this.board[0][1] && this.board[0][0] === 'r') {
                if (!this.isSquareAttacked(0, 4, enemy) && !this.isSquareAttacked(0, 3, enemy) && !this.isSquareAttacked(0, 2, enemy)) {
                    moves.push({ from: { row: 0, col: 4 }, to: { row: 0, col: 2 }, castling: 'q' });
                }
            }
        }
        return moves;
    }

    // ========== ATTACK DETECTION ==========

    isSquareAttacked(row, col, byColor) {
        // Knight
        for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
            const r = row + dr, c = col + dc;
            if (this.inBounds(r, c)) {
                const p = this.board[r][c];
                if (p && this.getColor(p) === byColor && p.toLowerCase() === 'n') return true;
            }
        }
        // King
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr, c = col + dc;
                if (this.inBounds(r, c)) {
                    const p = this.board[r][c];
                    if (p && this.getColor(p) === byColor && p.toLowerCase() === 'k') return true;
                }
            }
        }
        // Pawn
        const pawnRow = row + (byColor === 'w' ? 1 : -1);
        const pawnChar = byColor === 'w' ? 'P' : 'p';
        if (this.inBounds(pawnRow, col - 1) && this.board[pawnRow][col - 1] === pawnChar) return true;
        if (this.inBounds(pawnRow, col + 1) && this.board[pawnRow][col + 1] === pawnChar) return true;
        // Rook/Queen (straight)
        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            let r = row + dr, c = col + dc;
            while (this.inBounds(r, c)) {
                const p = this.board[r][c];
                if (p) {
                    if (this.getColor(p) === byColor && (p.toLowerCase() === 'r' || p.toLowerCase() === 'q')) return true;
                    break;
                }
                r += dr; c += dc;
            }
        }
        // Bishop/Queen (diagonal)
        for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            let r = row + dr, c = col + dc;
            while (this.inBounds(r, c)) {
                const p = this.board[r][c];
                if (p) {
                    if (this.getColor(p) === byColor && (p.toLowerCase() === 'b' || p.toLowerCase() === 'q')) return true;
                    break;
                }
                r += dr; c += dc;
            }
        }
        return false;
    }

    findKing(color) {
        const king = color === 'w' ? 'K' : 'k';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c] === king) return { row: r, col: c };
            }
        }
        return null;
    }

    isInCheck(color) {
        const king = this.findKing(color);
        if (!king) return false;
        return this.isSquareAttacked(king.row, king.col, this.opponent(color));
    }

    // ========== LEGAL MOVES ==========

    getLegalMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];
        const color = this.getColor(piece);
        if (color !== this.turn) return [];
        const pseudoMoves = this.getPseudoLegalMoves(row, col);
        return pseudoMoves.filter(move => {
            this.makeMoveInternal(move);
            const legal = !this.isInCheck(color);
            this.undoMoveInternal();
            return legal;
        });
    }

    getAllLegalMoves(color) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && this.getColor(piece) === color) {
                    const pseudoMoves = this.getPseudoLegalMoves(r, c);
                    for (const move of pseudoMoves) {
                        this.makeMoveInternal(move);
                        if (!this.isInCheck(color)) {
                            moves.push(move);
                        }
                        this.undoMoveInternal();
                    }
                }
            }
        }
        return moves;
    }

    // ========== MOVE EXECUTION ==========

    makeMoveInternal(move) {
        const piece = this.board[move.from.row][move.from.col];
        const undo = {
            from: { row: move.from.row, col: move.from.col },
            to: { row: move.to.row, col: move.to.col },
            piece: piece,
            capturedPiece: null,
            capturedPos: null,
            castling: { K: this.castling.K, Q: this.castling.Q, k: this.castling.k, q: this.castling.q },
            enPassant: this.enPassant ? { row: this.enPassant.row, col: this.enPassant.col } : null,
            halfMoveClock: this.halfMoveClock,
            isEnPassant: !!move.enPassant,
            isCastling: move.castling || null,
            isPromotion: move.promotion || null
        };

        // Handle en passant capture
        if (move.enPassant) {
            undo.capturedPiece = this.board[move.from.row][move.to.col];
            undo.capturedPos = { row: move.from.row, col: move.to.col };
            this.board[move.from.row][move.to.col] = null;
        } else if (this.board[move.to.row][move.to.col]) {
            undo.capturedPiece = this.board[move.to.row][move.to.col];
            undo.capturedPos = { row: move.to.row, col: move.to.col };
        }

        // Move piece
        this.board[move.to.row][move.to.col] = move.promotion || piece;
        this.board[move.from.row][move.from.col] = null;

        // Castling rook
        if (move.castling === 'K') { this.board[7][5] = 'R'; this.board[7][7] = null; }
        else if (move.castling === 'Q') { this.board[7][3] = 'R'; this.board[7][0] = null; }
        else if (move.castling === 'k') { this.board[0][5] = 'r'; this.board[0][7] = null; }
        else if (move.castling === 'q') { this.board[0][3] = 'r'; this.board[0][0] = null; }

        // Update castling rights
        if (piece === 'K') { this.castling.K = false; this.castling.Q = false; }
        if (piece === 'k') { this.castling.k = false; this.castling.q = false; }
        if (move.from.row === 7 && move.from.col === 0) this.castling.Q = false;
        if (move.from.row === 7 && move.from.col === 7) this.castling.K = false;
        if (move.from.row === 0 && move.from.col === 0) this.castling.q = false;
        if (move.from.row === 0 && move.from.col === 7) this.castling.k = false;
        if (move.to.row === 7 && move.to.col === 0) this.castling.Q = false;
        if (move.to.row === 7 && move.to.col === 7) this.castling.K = false;
        if (move.to.row === 0 && move.to.col === 0) this.castling.q = false;
        if (move.to.row === 0 && move.to.col === 7) this.castling.k = false;

        // En passant target
        if (piece.toLowerCase() === 'p' && Math.abs(move.to.row - move.from.row) === 2) {
            this.enPassant = { row: (move.from.row + move.to.row) / 2, col: move.from.col };
        } else {
            this.enPassant = null;
        }

        // Half move clock
        if (piece.toLowerCase() === 'p' || undo.capturedPiece) {
            this.halfMoveClock = 0;
        } else {
            this.halfMoveClock++;
        }

        this.turn = this.turn === 'w' ? 'b' : 'w';
        this.undoStack.push(undo);
    }

    undoMoveInternal() {
        const undo = this.undoStack.pop();
        if (!undo) return;

        // Restore piece
        this.board[undo.from.row][undo.from.col] = undo.piece;

        if (undo.isEnPassant) {
            this.board[undo.to.row][undo.to.col] = null;
            this.board[undo.capturedPos.row][undo.capturedPos.col] = undo.capturedPiece;
        } else {
            this.board[undo.to.row][undo.to.col] = undo.capturedPiece;
        }

        // Undo castling rook
        if (undo.isCastling === 'K') { this.board[7][7] = 'R'; this.board[7][5] = null; }
        else if (undo.isCastling === 'Q') { this.board[7][0] = 'R'; this.board[7][3] = null; }
        else if (undo.isCastling === 'k') { this.board[0][7] = 'r'; this.board[0][5] = null; }
        else if (undo.isCastling === 'q') { this.board[0][0] = 'r'; this.board[0][3] = null; }

        this.castling = undo.castling;
        this.enPassant = undo.enPassant;
        this.halfMoveClock = undo.halfMoveClock;
        this.turn = this.turn === 'w' ? 'b' : 'w';
    }

    // Public move - validates and executes, returns move info or null
    makeMove(fromRow, fromCol, toRow, toCol, promotion) {
        if (this.gameOver) return null;

        const legalMoves = this.getLegalMoves(fromRow, fromCol);
        let move = legalMoves.find(m =>
            m.to.row === toRow && m.to.col === toCol &&
            (!promotion || m.promotion === promotion)
        );

        if (!move) {
            // For promotion: if no specific promotion given, check if any promotion move exists
            move = legalMoves.find(m => m.to.row === toRow && m.to.col === toCol);
            if (!move) return null;
            if (move.promotion && !promotion) {
                return { needsPromotion: true, from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
            }
        }

        const piece = this.board[fromRow][fromCol];
        const captured = move.enPassant ?
            this.board[fromRow][toCol] :
            this.board[toRow][toCol];

        this.makeMoveInternal(move);

        // Generate notation
        const notation = this.generateNotation(move, piece, captured);

        // Check game state
        const opponentColor = this.turn;
        const opponentMoves = this.getAllLegalMoves(opponentColor);
        const inCheck = this.isInCheck(opponentColor);

        let status = '';
        if (opponentMoves.length === 0) {
            this.gameOver = true;
            if (inCheck) {
                this.result = opponentColor === 'w' ? 'black' : 'white';
                this.resultReason = 'checkmate';
                status = 'checkmate';
            } else {
                this.result = 'draw';
                this.resultReason = 'stalemate';
                status = 'stalemate';
            }
        } else if (inCheck) {
            status = 'check';
        } else if (this.halfMoveClock >= 100) {
            this.gameOver = true;
            this.result = 'draw';
            this.resultReason = '50-move rule';
            status = 'draw';
        } else if (this.isInsufficientMaterial()) {
            this.gameOver = true;
            this.result = 'draw';
            this.resultReason = 'insufficient material';
            status = 'draw';
        }

        // Add check/checkmate symbols
        let finalNotation = notation;
        if (status === 'checkmate') finalNotation += '#';
        else if (status === 'check') finalNotation += '+';

        const moveInfo = {
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: piece,
            captured: captured,
            promotion: move.promotion,
            castling: move.castling,
            enPassant: move.enPassant,
            notation: finalNotation,
            status: status,
            moveNumber: this.moveLog.length
        };

        this.moveLog.push(moveInfo);
        return moveInfo;
    }

    generateNotation(move, piece, captured) {
        if (move.castling === 'K' || move.castling === 'k') return 'O-O';
        if (move.castling === 'Q' || move.castling === 'q') return 'O-O-O';

        const type = piece.toLowerCase();
        let notation = '';

        if (type !== 'p') {
            notation += type.toUpperCase();
            // Disambiguation
            const color = this.getColor(piece) === 'w' ? 'b' : 'w'; // turn already switched
            const actualColor = color === 'w' ? 'b' : 'w';
            // Find other pieces of same type that can move to same square
            // (simplified - check same file/rank)
        }

        if (captured) {
            if (type === 'p') notation += String.fromCharCode(97 + move.from.col);
            notation += 'x';
        }

        notation += String.fromCharCode(97 + move.to.col) + (8 - move.to.row);

        if (move.promotion) {
            notation += '=' + move.promotion.toUpperCase();
        }

        return notation;
    }

    isInsufficientMaterial() {
        const pieces = { w: [], b: [] };
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p) pieces[this.getColor(p)].push(p.toLowerCase());
            }
        }
        // King vs King
        if (pieces.w.length === 1 && pieces.b.length === 1) return true;
        // King+Bishop vs King or King+Knight vs King
        if (pieces.w.length === 1 && pieces.b.length === 2 && (pieces.b.includes('b') || pieces.b.includes('n'))) return true;
        if (pieces.b.length === 1 && pieces.w.length === 2 && (pieces.w.includes('b') || pieces.w.includes('n'))) return true;
        return false;
    }

    // Get captured pieces for display
    getCapturedPieces() {
        const captured = { w: [], b: [] };
        for (const move of this.moveLog) {
            if (move.captured) {
                const color = this.getColor(move.captured);
                captured[color].push(move.captured.toLowerCase());
            }
        }
        // Sort by value
        const order = { q: 0, r: 1, b: 2, n: 3, p: 4 };
        captured.w.sort((a, b) => order[a] - order[b]);
        captured.b.sort((a, b) => order[a] - order[b]);
        return captured;
    }

    // Resign
    resign(color) {
        this.gameOver = true;
        this.result = color === 'w' ? 'black' : 'white';
        this.resultReason = 'resignation';
    }

    // Timeout
    timeout(color) {
        this.gameOver = true;
        this.result = color === 'w' ? 'black' : 'white';
        this.resultReason = 'timeout';
    }
}
