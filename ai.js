/**
 * Chess AI - Minimax with Alpha-Beta Pruning
 * Configurable difficulty with piece-square tables
 */
class ChessAI {
    constructor(engine, difficulty = 50, color = 'b') {
        this.engine = engine;
        this.difficulty = difficulty; // 0-100
        this.color = color;
        this.nodesSearched = 0;

        // Piece values (centipawns)
        this.pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

        // Piece-square tables (from white's perspective, flipped for black)
        this.pst = {
            p: [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [50, 50, 50, 50, 50, 50, 50, 50],
                [10, 10, 20, 30, 30, 20, 10, 10],
                [5, 5, 10, 25, 25, 10, 5, 5],
                [0, 0, 0, 20, 20, 0, 0, 0],
                [5, -5, -10, 0, 0, -10, -5, 5],
                [5, 10, 10, -20, -20, 10, 10, 5],
                [0, 0, 0, 0, 0, 0, 0, 0]
            ],
            n: [
                [-50, -40, -30, -30, -30, -30, -40, -50],
                [-40, -20, 0, 0, 0, 0, -20, -40],
                [-30, 0, 10, 15, 15, 10, 0, -30],
                [-30, 5, 15, 20, 20, 15, 5, -30],
                [-30, 0, 15, 20, 20, 15, 0, -30],
                [-30, 5, 10, 15, 15, 10, 5, -30],
                [-40, -20, 0, 5, 5, 0, -20, -40],
                [-50, -40, -30, -30, -30, -30, -40, -50]
            ],
            b: [
                [-20, -10, -10, -10, -10, -10, -10, -20],
                [-10, 0, 0, 0, 0, 0, 0, -10],
                [-10, 0, 10, 10, 10, 10, 0, -10],
                [-10, 5, 5, 10, 10, 5, 5, -10],
                [-10, 0, 5, 10, 10, 5, 0, -10],
                [-10, 10, 10, 10, 10, 10, 10, -10],
                [-10, 5, 0, 0, 0, 0, 5, -10],
                [-20, -10, -10, -10, -10, -10, -10, -20]
            ],
            r: [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [5, 10, 10, 10, 10, 10, 10, 5],
                [-5, 0, 0, 0, 0, 0, 0, -5],
                [-5, 0, 0, 0, 0, 0, 0, -5],
                [-5, 0, 0, 0, 0, 0, 0, -5],
                [-5, 0, 0, 0, 0, 0, 0, -5],
                [-5, 0, 0, 0, 0, 0, 0, -5],
                [0, 0, 0, 5, 5, 0, 0, 0]
            ],
            q: [
                [-20, -10, -10, -5, -5, -10, -10, -20],
                [-10, 0, 0, 0, 0, 0, 0, -10],
                [-10, 0, 5, 5, 5, 5, 0, -10],
                [-5, 0, 5, 5, 5, 5, 0, -5],
                [0, 0, 5, 5, 5, 5, 0, -5],
                [-10, 5, 5, 5, 5, 5, 0, -10],
                [-10, 0, 5, 0, 0, 0, 0, -10],
                [-20, -10, -10, -5, -5, -10, -10, -20]
            ],
            k: [
                [-30, -40, -40, -50, -50, -40, -40, -30],
                [-30, -40, -40, -50, -50, -40, -40, -30],
                [-30, -40, -40, -50, -50, -40, -40, -30],
                [-30, -40, -40, -50, -50, -40, -40, -30],
                [-20, -30, -30, -40, -40, -30, -30, -20],
                [-10, -20, -20, -20, -20, -20, -20, -10],
                [20, 20, 0, 0, 0, 0, 20, 20],
                [20, 30, 10, 0, 0, 10, 30, 20]
            ]
        };
    }

    getSearchDepth() {
        if (this.difficulty <= 15) return 1;
        if (this.difficulty <= 35) return 2;
        if (this.difficulty <= 60) return 3;
        if (this.difficulty <= 85) return 3;
        return 4;
    }

    getELO() {
        // Map difficulty 0-100 to approximate ELO
        const minElo = 400;
        const maxElo = 2500;
        return Math.round(minElo + (this.difficulty / 100) * (maxElo - minElo));
    }

    getBotName() {
        if (this.difficulty <= 20) return 'BabyBot';
        if (this.difficulty <= 40) return 'CasualBot';
        if (this.difficulty <= 55) return 'ClubBot';
        if (this.difficulty <= 70) return 'TacticsBot';
        if (this.difficulty <= 85) return 'MasterBot';
        return 'GrandBot';
    }

    getBotTitle() {
        if (this.difficulty <= 20) return '';
        if (this.difficulty <= 40) return '';
        if (this.difficulty <= 55) return 'CM';
        if (this.difficulty <= 70) return 'FM';
        if (this.difficulty <= 85) return 'IM';
        return 'GM';
    }

    evaluate() {
        let score = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.engine.board[r][c];
                if (!piece) continue;
                const type = piece.toLowerCase();
                const isWhite = piece === piece.toUpperCase();
                const value = this.pieceValues[type] || 0;
                const pstRow = isWhite ? r : 7 - r;
                const pstValue = this.pst[type] ? this.pst[type][pstRow][c] : 0;
                score += isWhite ? (value + pstValue) : -(value + pstValue);
            }
        }

        // Mobility bonus
        const whiteMoves = this.engine.getAllLegalMoves('w').length;
        const blackMoves = this.engine.getAllLegalMoves('b').length;
        score += (whiteMoves - blackMoves) * 5;

        return score;
    }

    // Faster evaluation without mobility (for deeper searches)
    evaluateFast() {
        let score = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.engine.board[r][c];
                if (!piece) continue;
                const type = piece.toLowerCase();
                const isWhite = piece === piece.toUpperCase();
                const value = this.pieceValues[type] || 0;
                const pstRow = isWhite ? r : 7 - r;
                const pstValue = this.pst[type] ? this.pst[type][pstRow][c] : 0;
                score += isWhite ? (value + pstValue) : -(value + pstValue);
            }
        }
        return score;
    }

    orderMoves(moves) {
        // Simple move ordering: captures first, then by MVV-LVA
        return moves.sort((a, b) => {
            const aCap = this.engine.board[a.to.row][a.to.col];
            const bCap = this.engine.board[b.to.row][b.to.col];
            const aVal = aCap ? this.pieceValues[aCap.toLowerCase()] : 0;
            const bVal = bCap ? this.pieceValues[bCap.toLowerCase()] : 0;
            return bVal - aVal;
        });
    }

    minimax(depth, alpha, beta, isMaximizing) {
        this.nodesSearched++;

        if (depth === 0) return this.evaluateFast();

        const color = isMaximizing ? 'w' : 'b';
        let moves = this.engine.getAllLegalMoves(color);

        if (moves.length === 0) {
            if (this.engine.isInCheck(color)) {
                return isMaximizing ? -99999 + (this.getSearchDepth() - depth) : 99999 - (this.getSearchDepth() - depth);
            }
            return 0; // Stalemate
        }

        moves = this.orderMoves(moves);

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                this.engine.makeMoveInternal(move);
                const eval_ = this.minimax(depth - 1, alpha, beta, false);
                this.engine.undoMoveInternal();
                maxEval = Math.max(maxEval, eval_);
                alpha = Math.max(alpha, eval_);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                this.engine.makeMoveInternal(move);
                const eval_ = this.minimax(depth - 1, alpha, beta, true);
                this.engine.undoMoveInternal();
                minEval = Math.min(minEval, eval_);
                beta = Math.min(beta, eval_);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    getBestMove() {
        this.nodesSearched = 0;
        const depth = this.getSearchDepth();
        const isMaximizing = this.color === 'w';
        let moves = this.engine.getAllLegalMoves(this.color);

        if (moves.length === 0) return null;
        if (moves.length === 1) return moves[0];

        moves = this.orderMoves(moves);

        let bestMove = null;
        let bestEval = isMaximizing ? -Infinity : Infinity;
        const moveEvals = [];

        for (const move of moves) {
            this.engine.makeMoveInternal(move);
            const eval_ = this.minimax(depth - 1, -Infinity, Infinity, !isMaximizing);
            this.engine.undoMoveInternal();
            moveEvals.push({ move, eval: eval_ });

            if (isMaximizing) {
                if (eval_ > bestEval) { bestEval = eval_; bestMove = move; }
            } else {
                if (eval_ < bestEval) { bestEval = eval_; bestMove = move; }
            }
        }

        // Add randomness for lower difficulties
        if (this.difficulty < 60) {
            const randomFactor = (60 - this.difficulty) / 60;
            if (Math.random() < randomFactor * 0.5) {
                // Pick a random move from top N
                moveEvals.sort((a, b) => isMaximizing ? b.eval - a.eval : a.eval - b.eval);
                const topN = Math.max(2, Math.ceil(moveEvals.length * (randomFactor * 0.4 + 0.1)));
                const candidates = moveEvals.slice(0, topN);
                const pick = candidates[Math.floor(Math.random() * candidates.length)];
                return pick.move;
            }
        }

        return bestMove;
    }
}
