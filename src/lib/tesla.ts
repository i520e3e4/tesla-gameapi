/**
 * Tesla 车机优化工具库
 * 
 * 实现基于 Gamepad API 的特斯拉行驶时视频播放解决方案
 * 核心原理：利用特斯拉车机系统对游戏应用的特殊处理机制
 */

/**
 * 检测是否在特斯拉车机环境中运行
 */
export function detectTeslaEnvironment(): {
  isTesla: boolean;
  confidence: number;
  details: {
    userAgent: boolean;
    screenSize: boolean;
    teslaAPI: boolean;
    qtWebEngine: boolean;
  };
} {
  const userAgent = navigator.userAgent.toLowerCase();
  const details = {
    userAgent: userAgent.includes('tesla') || 
               userAgent.includes('qtcarplay') ||
               (userAgent.includes('webkit') && userAgent.includes('mobile')),
    screenSize: (window.screen.width === 1200 && window.screen.height === 1920) ||
                (window.screen.width === 1920 && window.screen.height === 1200),
    teslaAPI: typeof (window as any).tesla !== 'undefined',
    qtWebEngine: typeof (window as any).QtWebEngine !== 'undefined'
  };

  const indicators = Object.values(details).filter(Boolean).length;
  const confidence = indicators / Object.keys(details).length;
  const isTesla = confidence > 0.25; // 至少有一个指标匹配

  return { isTesla, confidence, details };
}

/**
 * 检查 Gamepad API 支持情况
 */
export function checkGamepadSupport(): {
  supported: boolean;
  api: boolean;
  secure: boolean;
} {
  const api = typeof navigator !== 'undefined' && 
             typeof navigator.getGamepads === 'function';
  const secure = location.protocol === 'https:' || 
                location.hostname === 'localhost';

  return {
    supported: api && secure,
    api,
    secure
  };
}

/**
 * 游戏手柄轮询管理器
 */
export class GamepadPoller {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private frequency = 30; // 默认30fps
  private onError?: (error: Error) => void;
  private onStatusChange?: (status: { running: boolean; connectedGamepads: number }) => void;

  constructor(options?: {
    frequency?: number;
    onError?: (error: Error) => void;
    onStatusChange?: (status: { running: boolean; connectedGamepads: number }) => void;
  }) {
    if (options?.frequency) this.frequency = options.frequency;
    if (options?.onError) this.onError = options.onError;
    if (options?.onStatusChange) this.onStatusChange = options.onStatusChange;
  }

  /**
   * 开始轮询
   */
  start(): boolean {
    if (this.isRunning) return true;

    const gamepadSupport = checkGamepadSupport();
    if (!gamepadSupport.supported) {
      const error = new Error('Gamepad API not supported or not in secure context');
      this.onError?.(error);
      return false;
    }

    this.isRunning = true;
    const interval = 1000 / this.frequency;

    this.intervalId = setInterval(() => {
      try {
        const gamepads = navigator.getGamepads();
        let connectedCount = 0;
        
        if (gamepads) {
          for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) connectedCount++;
          }
        }

        this.onStatusChange?.({
          running: this.isRunning,
          connectedGamepads: connectedCount
        });
      } catch (error) {
        this.onError?.(error as Error);
      }
    }, interval);

    return true;
  }

  /**
   * 停止轮询
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.onStatusChange?.({
      running: false,
      connectedGamepads: 0
    });
  }

  /**
   * 调整轮询频率
   */
  setFrequency(frequency: number): void {
    this.frequency = Math.max(1, Math.min(60, frequency)); // 限制在1-60fps之间
    
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): { running: boolean; frequency: number } {
    return {
      running: this.isRunning,
      frequency: this.frequency
    };
  }
}

/**
 * 特斯拉优化管理器
 */
export class TeslaOptimizationManager {
  private gamepadPoller: GamepadPoller;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private activityInterval: NodeJS.Timeout | null = null;
  private isActive = false;
  private listeners: Array<() => void> = [];

  constructor() {
    this.gamepadPoller = new GamepadPoller({
      frequency: 30,
      onError: (error) => console.error('Tesla Gamepad Error:', error),
      onStatusChange: (status) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('Tesla Gamepad Status:', status);
        }
      }
    });
  }

  /**
   * 启动完整的特斯拉优化
   */
  start(): boolean {
    if (this.isActive) return true;

    // 检测环境
    const teslaEnv = detectTeslaEnvironment();
    const gamepadSupport = checkGamepadSupport();

    console.log('Tesla Optimization Environment:', {
      tesla: teslaEnv,
      gamepad: gamepadSupport
    });

    // 只在特斯拉环境或支持Gamepad时启动
    if (!teslaEnv.isTesla && !gamepadSupport.supported) {
      console.log('Tesla optimization not needed in this environment');
      return false;
    }

    this.isActive = true;

    // 1. 启动 Gamepad 轮询（核心功能）
    this.gamepadPoller.start();

    // 2. 防休眠机制
    this.keepAliveInterval = setInterval(() => {
      try {
        const timestamp = Date.now();
        document.documentElement.setAttribute('data-tesla-keepalive', timestamp.toString());
        
        // 微小的样式变化来保持页面活跃
        document.body.style.setProperty('--tesla-keepalive', (timestamp % 2).toString());
      } catch (error) {
        console.error('Tesla keep-alive error:', error);
      }
    }, 1000);

    // 3. 模拟用户活动
    this.activityInterval = setInterval(() => {
      try {
        const event = new CustomEvent('tesla-activity', {
          detail: { 
            timestamp: Date.now(), 
            type: 'optimization-heartbeat',
            gamepadActive: this.gamepadPoller.getStatus().running
          }
        });
        document.dispatchEvent(event);
      } catch (error) {
        console.error('Tesla activity simulation error:', error);
      }
    }, 5000);

    // 4. 页面可见性处理
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面隐藏时降低频率但不停止
        this.gamepadPoller.setFrequency(10);
      } else {
        // 页面可见时恢复正常频率
        this.gamepadPoller.setFrequency(30);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    this.listeners.push(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    });

    // 5. 网络状态监听
    const handleNetworkChange = () => {
      console.log('Tesla network status:', navigator.onLine ? 'online' : 'offline');
    };

    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
    this.listeners.push(() => {
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
    });

    console.log('Tesla optimization started successfully');
    return true;
  }

  /**
   * 停止优化
   */
  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;

    // 停止所有定时器
    this.gamepadPoller.stop();
    
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }

    // 清理事件监听器
    this.listeners.forEach(cleanup => cleanup());
    this.listeners = [];

    console.log('Tesla optimization stopped');
  }

  /**
   * 获取当前状态
   */
  getStatus(): {
    active: boolean;
    gamepadStatus: { running: boolean; frequency: number };
    environment: ReturnType<typeof detectTeslaEnvironment>;
  } {
    return {
      active: this.isActive,
      gamepadStatus: this.gamepadPoller.getStatus(),
      environment: detectTeslaEnvironment()
    };
  }
}

/**
 * 全局特斯拉优化实例
 */
let globalTeslaManager: TeslaOptimizationManager | null = null;

/**
 * 获取全局特斯拉优化管理器实例
 */
export function getTeslaManager(): TeslaOptimizationManager {
  if (!globalTeslaManager) {
    globalTeslaManager = new TeslaOptimizationManager();
  }
  return globalTeslaManager;
}

/**
 * 启动特斯拉优化（便捷函数）
 */
export function startTeslaOptimization(): boolean {
  return getTeslaManager().start();
}

/**
 * 停止特斯拉优化（便捷函数）
 */
export function stopTeslaOptimization(): void {
  getTeslaManager().stop();
}

/**
 * 获取特斯拉优化状态（便捷函数）
 */
export function getTeslaOptimizationStatus() {
  return getTeslaManager().getStatus();
}

/**
 * 在窗口对象上暴露调试接口（仅开发环境）
 */
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as any).TeslaDebug = {
    detectEnvironment: detectTeslaEnvironment,
    checkGamepadSupport,
    getManager: getTeslaManager,
    start: startTeslaOptimization,
    stop: stopTeslaOptimization,
    getStatus: getTeslaOptimizationStatus
  };
}