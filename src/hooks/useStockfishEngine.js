"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStockfishEngine = useStockfishEngine;
var react_1 = require("react");
var chess_js_1 = require("chess.js");
var stockfish_wasm_1 = require("stockfish.wasm");
var initialState = {
    suggestions: [],
    depth: null,
    lastUpdated: null,
    error: null,
    isReady: false,
};
function useStockfishEngine() {
    var _this = this;
    var _a = (0, react_1.useState)(initialState), state = _a[0], setState = _a[1];
    var engineRef = (0, react_1.useRef)(null);
    var pendingFenRef = (0, react_1.useRef)(null);
    var fenRef = (0, react_1.useRef)('');
    var listenerRef = (0, react_1.useRef)();
    var disposedRef = (0, react_1.useRef)(false);
    var analysisCacheRef = (0, react_1.useRef)(new Map());
    (0, react_1.useEffect)(function () {
        var cancelled = false;
        var initEngine = function () { return __awaiter(_this, void 0, void 0, function () {
            var createEngine, engine, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        createEngine = stockfish_wasm_1.default;
                        return [4 /*yield*/, createEngine()];
                    case 1:
                        engine = _a.sent();
                        if (cancelled)
                            return [2 /*return*/];
                        engineRef.current = engine;
                        listenerRef.current = function (line) { return handleEngineMessage(line); };
                        engine.addMessageListener(listenerRef.current);
                        engine.postMessage('uci');
                        engine.postMessage('setoption name Threads value 2');
                        engine.postMessage('setoption name MultiPV value 3');
                        engine.postMessage('setoption name Skill Level value 20');
                        engine.postMessage('isready');
                        return [3 /*break*/, 3];
                    case 2:
                        err_1 = _a.sent();
                        setState(function (prev) { return (__assign(__assign({}, prev), { error: 'Не удалось запустить движок Stockfish. Обновите браузер и попробуйте снова.' })); });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); };
        initEngine();
        return function () {
            var _a;
            cancelled = true;
            disposedRef.current = true;
            if (listenerRef.current && engineRef.current) {
                engineRef.current.removeMessageListener(listenerRef.current);
            }
            (_a = engineRef.current) === null || _a === void 0 ? void 0 : _a.terminate();
        };
    }, []);
    var handleEngineMessage = (0, react_1.useCallback)(function (line) {
        if (disposedRef.current)
            return;
        if (line.includes('Nodes searched'))
            return;
        if (line === 'readyok') {
            setState(function (prev) { return (__assign(__assign({}, prev), { isReady: true })); });
            if (pendingFenRef.current) {
                analyzeFen(pendingFenRef.current);
                pendingFenRef.current = null;
            }
            return;
        }
        if (line.startsWith('bestmove')) {
            return;
        }
        if (!line.startsWith('info') || !line.includes(' pv '))
            return;
        var parsed = parseInfoLine(line);
        if (!parsed)
            return;
        var multipv = parsed.multipv, depth = parsed.depth, score = parsed.score, pv = parsed.pv, uci = parsed.uci;
        var san = convertUciToSan(fenRef.current, uci);
        var pvSan = convertPvToSan(fenRef.current, pv);
        analysisCacheRef.current.set(multipv, {
            id: multipv,
            multipv: multipv,
            san: san,
            score: score,
            pv: pvSan,
            uci: uci,
        });
        var suggestions = Array.from(analysisCacheRef.current.values()).sort(function (a, b) { return a.multipv - b.multipv; });
        setState(function (prev) { return (__assign(__assign({}, prev), { suggestions: suggestions, depth: depth, lastUpdated: new Date() })); });
    }, []);
    var analyzeFen = (0, react_1.useCallback)(function (fen) {
        if (!engineRef.current) {
            pendingFenRef.current = fen;
            return;
        }
        fenRef.current = fen;
        analysisCacheRef.current.clear();
        engineRef.current.postMessage('stop');
        engineRef.current.postMessage("position fen ".concat(fen));
        engineRef.current.postMessage('go depth 16');
    }, []);
    var analyze = (0, react_1.useCallback)(function (fen) {
        if (state.error)
            return;
        analyzeFen(fen);
    }, [analyzeFen, state.error]);
    return (0, react_1.useMemo)(function () { return ({
        analyze: analyze,
        suggestions: state.suggestions,
        depth: state.depth,
        isReady: state.isReady,
        error: state.error,
        lastUpdated: state.lastUpdated,
    }); }, [analyze, state]);
}
function parseInfoLine(line) {
    var tokens = line.trim().split(/\s+/);
    var multipvIndex = tokens.indexOf('multipv');
    var depthIndex = tokens.indexOf('depth');
    var scoreIndex = tokens.indexOf('score');
    var pvIndex = tokens.indexOf('pv');
    if (pvIndex === -1 || scoreIndex === -1 || multipvIndex === -1) {
        return null;
    }
    var scoreType = tokens[scoreIndex + 1];
    var scoreRaw = Number(tokens[scoreIndex + 2]);
    var multipv = Number(tokens[multipvIndex + 1]);
    var depth = depthIndex !== -1 ? Number(tokens[depthIndex + 1]) : null;
    var pv = tokens.slice(pvIndex + 1);
    var uci = pv[0];
    return {
        multipv: multipv,
        depth: depth,
        score: formatScore(scoreType, scoreRaw),
        pv: pv,
        uci: uci,
    };
}
function formatScore(type, raw) {
    if (type === 'mate') {
        var sign_1 = raw > 0 ? '+' : '-';
        return "".concat(sign_1, "#").concat(Math.abs(raw));
    }
    var value = raw / 100;
    var sign = value > 0 ? '+' : '';
    return "".concat(sign).concat(value.toFixed(2));
}
function convertUciToSan(fen, uci) {
    var _a;
    if (!uci)
        return '';
    var chess = new chess_js_1.Chess(fen);
    var from = uci.slice(0, 2);
    var to = uci.slice(2, 4);
    var promotion = uci.length > 4 ? uci.slice(4) : undefined;
    var move = chess.move({ from: from, to: to, promotion: promotion });
    return (_a = move === null || move === void 0 ? void 0 : move.san) !== null && _a !== void 0 ? _a : uci;
}
function convertPvToSan(fen, pvMoves) {
    var chess = new chess_js_1.Chess(fen);
    var sanMoves = [];
    pvMoves.forEach(function (uci) {
        var from = uci.slice(0, 2);
        var to = uci.slice(2, 4);
        var promotion = uci.length > 4 ? uci.slice(4) : undefined;
        var move = chess.move({ from: from, to: to, promotion: promotion });
        if (move) {
            sanMoves.push(move.san);
        }
    });
    return sanMoves.slice(0, 4).join(' ');
}
