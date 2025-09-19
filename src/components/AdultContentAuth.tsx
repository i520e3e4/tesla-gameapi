'use client';

import { useState, useEffect } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';

interface AdultContentAuthProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_PASSWORD = '159456';

export default function AdultContentAuth({ isOpen, onClose, onSuccess }: AdultContentAuthProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 重置状态当弹窗打开时
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      setShowPassword(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }

    setIsLoading(true);
    setError('');

    // 模拟验证延迟
    await new Promise(resolve => setTimeout(resolve, 500));

    if (password === DEFAULT_PASSWORD) {
      // 验证成功，保存到sessionStorage
      sessionStorage.setItem('adultContentAuth', 'true');
      sessionStorage.setItem('adultContentAuthTime', Date.now().toString());
      onSuccess();
      onClose();
    } else {
      setError('密码错误，请重试');
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
        onKeyDown={handleKeyDown}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 标题 */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            成人内容验证
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            此内容仅限成年人访问，请输入密码继续
          </p>
        </div>

        {/* 密码输入表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              访问密码
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="请输入密码"
                autoFocus
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="text-red-500 text-sm text-center">
              {error}
            </div>
          )}

          {/* 按钮组 */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md transition-colors"
              disabled={isLoading}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '验证中...' : '确认'}
            </button>
          </div>
        </form>

        {/* 提示信息 */}
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            ⚠️ 请确保您已达到法定年龄，并了解相关内容可能不适合未成年人观看。
          </p>
        </div>
      </div>
    </div>
  );
}

// 验证成人内容访问权限的工具函数
export function checkAdultContentAuth(): boolean {
  if (typeof window === 'undefined') return false;
  
  const authStatus = sessionStorage.getItem('adultContentAuth');
  const authTime = sessionStorage.getItem('adultContentAuthTime');
  
  if (!authStatus || !authTime) return false;
  
  // 检查是否超过24小时
  const now = Date.now();
  const authTimestamp = parseInt(authTime, 10);
  const hoursSinceAuth = (now - authTimestamp) / (1000 * 60 * 60);
  
  // 超过24小时需要重新验证
  if (hoursSinceAuth > 24) {
    sessionStorage.removeItem('adultContentAuth');
    sessionStorage.removeItem('adultContentAuthTime');
    return false;
  }
  
  return authStatus === 'true';
}

// 清除成人内容访问权限
export function clearAdultContentAuth(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('adultContentAuth');
    sessionStorage.removeItem('adultContentAuthTime');
  }
}
