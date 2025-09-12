'use client';

import { useEffect, useRef } from 'react';

/**
 * TeslaGamepadKeepAlive 组件
 * 
 * 核心原理：利用特斯拉车机系统的游戏手柄API特性来防止行驶时视频锁定
 * 
 * 技术实现：
 * 1. 持续调用 navigator.getGamepads() API
 * 2. 模拟一个正在等待连接的游戏应用
 * 3. 向特斯拉系统发送"我是游戏应用"的信号
 * 4. 绕过针对视频播放的行驶锁定机制
 */
export default function TeslaGamepadKeepAlive() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);

  useEffect(() => {
    // 检查是否支持 Gamepad API
    if (typeof navigator === 'undefined' || !navigator.getGamepads) {
      console.log('Gamepad API not supported');
      return;
    }

    // 启动游戏手柄监听循环
    const startGamepadLoop = () => {
      if (isActiveRef.current) return;
      
      isActiveRef.current = true;
      console.log('Tesla Gamepad Keep-Alive: Started');

      // 高频率轮询 Gamepad API (每秒约30次)
      // 这个频率足以让特斯拉系统认为这是一个活跃的游戏应用
      intervalRef.current = setInterval(() => {
        try {
          // 调用 getGamepads() 来维持"游戏应用"状态
          const gamepads = navigator.getGamepads();
          
          // 可选：检查是否有真实的手柄连接
          // 但主要目的是持续调用API来维持"游戏"身份
          let connectedGamepads = 0;
          if (gamepads) {
            for (let i = 0; i < gamepads.length; i++) {
              if (gamepads[i]) {
                connectedGamepads++;
              }
            }
          }
          
          // 在开发环境下可以输出调试信息
          if (process.env.NODE_ENV === 'development' && Math.random() < 0.01) {
            console.log(`Tesla Keep-Alive: Polling gamepads (${connectedGamepads} connected)`);
          }
        } catch (error) {
          console.error('Gamepad polling error:', error);
        }
      }, 33); // 约30fps的轮询频率
    };

    // 停止游戏手柄监听循环
    const stopGamepadLoop = () => {
      if (!isActiveRef.current) return;
      
      isActiveRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      console.log('Tesla Gamepad Keep-Alive: Stopped');
    };

    // 页面可见性变化处理
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面隐藏时继续运行，因为我们需要在后台保持"游戏"状态
        // 但可以降低频率以节省资源
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = setInterval(() => {
            try {
              navigator.getGamepads();
            } catch (error) {
              console.error('Background gamepad polling error:', error);
            }
          }, 100); // 降低到10fps
        }
      } else {
        // 页面可见时恢复正常频率
        stopGamepadLoop();
        startGamepadLoop();
      }
    };

    // 页面焦点变化处理
    const handleFocusChange = () => {
      if (document.hasFocus()) {
        startGamepadLoop();
      }
      // 注意：失去焦点时不停止，因为我们需要在后台保持活跃
    };

    // 启动监听
    startGamepadLoop();

    // 添加事件监听器
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocusChange);
    window.addEventListener('blur', handleFocusChange);

    // 清理函数
    return () => {
      stopGamepadLoop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocusChange);
      window.removeEventListener('blur', handleFocusChange);
    };
  }, []);

  // 这个组件不渲染任何可见内容
  return null;
}

/**
 * 使用说明：
 * 
 * 1. 将此组件添加到应用的根布局中（layout.tsx）
 * 2. 组件会在应用启动时自动开始工作
 * 3. 无需任何用户交互或配置
 * 4. 组件会持续在后台运行，模拟游戏应用状态
 * 
 * 工作原理：
 * 
 * - 特斯拉车机为了支持USB游戏手柄，浏览器会持续监听手柄输入
 * - 本组件通过高频调用 navigator.getGamepads() 来模拟游戏应用
 * - 特斯拉系统检测到"游戏应用"后，不会在行驶时锁定视频播放
 * - 这种方法比全屏API或应用跳转更稳定，不易被系统更新影响
 * 
 * 注意事项：
 * 
 * - 此方法仅适用于特斯拉车机浏览器
 * - 在其他浏览器中运行不会产生负面影响
 * - 组件会自动处理页面可见性变化以优化性能
 * - 开发环境下会输出调试信息
 */