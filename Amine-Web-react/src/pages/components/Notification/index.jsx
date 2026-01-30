// pages/components/Notification/index.jsx
import React, { useState, useEffect, useCallback } from 'react';
import styles from './Notification.module.css';

const Notification = ({ 
  id,
  message, 
  type = 'success',
  duration = 3000,
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  // 将 startExit 移到 useEffect 之前
  const startExit = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose(id);
    }, 300); // 动画时间
  }, [id, onClose]);

  const handleClose = useCallback(() => {
    startExit();
  }, [startExit]);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        startExit();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, startExit]);

  if (!isVisible) return null;

  const icons = {
    success: '✅',
    error: '❌',
    info: '💡',
    warning: '⚠️'
  };

  return (
    <div 
      className={`${styles.notification} ${styles[type]} ${isExiting ? styles.exiting : ''}`}
      onClick={handleClose}
    >
      <div className={styles.icon}>{icons[type]}</div>
      <div className={styles.content}>
        <div className={styles.message}>{message}</div>
      </div>
      <button 
        className={styles.closeButton}
        onClick={handleClose}
        aria-label="关闭通知"
      >
        ×
      </button>
    </div>
  );
};

export default Notification;