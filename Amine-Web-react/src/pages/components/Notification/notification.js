let addNotificationCallback = null;

// 设置回调函数（由 NotificationManager 调用）
export const setNotificationCallback = (callback) => {
  addNotificationCallback = callback;
};

// 清除回调函数
export const clearNotificationCallback = () => {
  addNotificationCallback = null;
};

// 主通知函数
export const notify = (message, options = {}) => {
  if (addNotificationCallback) {
    return addNotificationCallback({ message, ...options });
  }
  console.warn('NotificationManager not mounted');
  return null;
};

// 快捷方法
notify.success = (message, duration = 3000) => 
  notify(message, { type: 'success', duration });

notify.error = (message, duration = 3000) => 
  notify(message, { type: 'error', duration });

notify.info = (message, duration = 3000) => 
  notify(message, { type: 'info', duration });

notify.warning = (message, duration = 3000) => 
  notify(message, { type: 'warning', duration });

export default notify;