export class Logger {
    private readonly color: string;
    private readonly prefix: string;

    constructor(prefix: string, color: string = '#3b82f6') {
        this.prefix = prefix;
        this.color = color;
    }

    error(message: string, ...arguments_: any[]) {
        console.error(`%c${this.prefix}%c ${message}`, `color: #ef4444; font-weight: bold;`, 'color: inherit;', ...arguments_);
    }

    info(message: string, ...arguments_: any[]) {
        console.log(`%c${this.prefix}%c ${message}`, `color: ${this.color}; font-weight: bold;`, 'color: inherit;', ...arguments_);
    }

    warn(message: string, ...arguments_: any[]) {
        console.warn(`%c${this.prefix}%c ${message}`, `color: #f59e0b; font-weight: bold;`, 'color: inherit;', ...arguments_);
    }
}