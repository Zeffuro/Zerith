export class Logger {
    private readonly prefix: string;
    private readonly color: string;

    constructor(prefix: string, color: string = '#3b82f6') {
        this.prefix = prefix;
        this.color = color;
    }

    info(message: string, ...args: any[]) {
        console.log(`%c${this.prefix}%c ${message}`, `color: ${this.color}; font-weight: bold;`, 'color: inherit;', ...args);
    }

    warn(message: string, ...args: any[]) {
        console.warn(`%c${this.prefix}%c ${message}`, `color: #f59e0b; font-weight: bold;`, 'color: inherit;', ...args);
    }

    error(message: string, ...args: any[]) {
        console.error(`%c${this.prefix}%c ${message}`, `color: #ef4444; font-weight: bold;`, 'color: inherit;', ...args);
    }
}