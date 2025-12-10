import { GameSession, Card, GameAction } from '../types';
export declare const generateDeck: () => Card[];
export declare const shuffleDeck: (deck: Card[]) => Card[];
export declare const startNewGame: (roomId: string) => Promise<GameSession>;
export declare const getGameStatus: (sessionId: string) => Promise<any>;
export declare const executeGameAction: (sessionId: string, playerId: string, action: GameAction) => Promise<any>;
export declare const evaluateHandStrength: (holeCards: Card[], communityCards: Card[]) => number;
export declare const determineWinner: (sessionId: string) => Promise<any>;
