// pages/components/Notification/NotificationManager.jsx
import React, { useState, useCallback, useEffect } from 'react';
import Notification from './index';
import { setNotificationCallback, clearNotificationCallback } from './notification';
import styles from './Notification.module.css';

const NotificationManager = () => {
  const [notifications, setNotifications] = useState([]);

  // 添加通知
  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    const newNotification = { ...notification, id };
    
    // 添加新通知
    setNotifications(prev => [...prev, newNotification]);
    
    // 自动移除（如果设置了持续时间）
    const duration = notification.duration || 3000;
    if (duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    }
    
    return id;
  }, []);

  // 移除通知
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // 全局注册
  useEffect(() => {
    setNotificationCallback(addNotification);
    return () => {
      clearNotificationCallback();
    };
  }, [addNotification]);

  return (
    <div className={styles.notificationManager}>
      {notifications.map(notification => (
        <Notification
          key={notification.id}
          {...notification}
          onClose={removeNotification}
        />
      ))}
    </div>
  );
};

export default NotificationManager;