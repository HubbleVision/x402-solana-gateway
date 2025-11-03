type LogLevel = 'info' | 'success' | 'error' | 'warning' | 'debug';

export class Logger {
  private isDebug: boolean;

  constructor(debug: boolean = false) {
    this.isDebug = debug;
  }

  log(level: LogLevel, message: string, data?: any) {
    const timestamp = new Date().toLocaleTimeString();
    const icons = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      debug: '🐛'
    };

    const icon = icons[level];
    const prefix = `${timestamp} ${icon}`;

    console.log(`${prefix} ${message}`);

    if (data !== undefined && (this.isDebug || level !== 'debug')) {
      if (typeof data === 'object') {
        console.log(`   📄 ${JSON.stringify(data, null, 2)}`);
      } else {
        console.log(`   📄 ${data}`);
      }
    }
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  success(message: string, data?: any) {
    this.log('success', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  warning(message: string, data?: any) {
    this.log('warning', message, data);
  }

  debug(message: string, data?: any) {
    if (this.isDebug) {
      this.log('debug', message, data);
    }
  }
}