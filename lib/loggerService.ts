// GameOfLifeApp/lib/loggerService.ts

type LogListener = (messages: string[]) => void;

const MAX_LOG_LINES = 50; // Keep the log history manageable
let _messages: string[] = [];
let _listeners: Set<LogListener> = new Set(); // Use a Set for easier listener management

const loggerService = {
  addLog: (message: string): void => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
    const fullMessage = `[${timestamp}] ${message}`;
    console.log(`DEBUG LOG: ${fullMessage}`); // Also log to console for convenience

    _messages.push(fullMessage);
    // Trim old messages if exceeding max lines
    if (_messages.length > MAX_LOG_LINES) {
      _messages = _messages.slice(_messages.length - MAX_LOG_LINES);
    }
    loggerService._notifyListeners();
  },

  clearLogs: (): void => {
    _messages = [];
    loggerService._notifyListeners();
  },

  getMessages: (): string[] => {
    // Return a copy to prevent external modification
    return [..._messages];
  },

  subscribe: (listener: LogListener): (() => void) => {
    _listeners.add(listener);
    // Return an unsubscribe function
    return () => {
      _listeners.delete(listener);
    };
  },

  // Internal method to notify all subscribed components
  _notifyListeners: (): void => {
    const currentMessages = loggerService.getMessages();
    _listeners.forEach(listener => listener(currentMessages));
  },
};

// Ensure it's a singleton
Object.freeze(loggerService);

export default loggerService;