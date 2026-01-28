import React, { useState, useEffect } from 'react';
import styles from './ScrollToTop.module.css';

const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);

  // 监听滚动事件
  useEffect(() => {
    const handleScroll = () => {
      // 当滚动超过300px时显示按钮
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // 添加滚动监听
    window.addEventListener('scroll', handleScroll);
    
    // 清理函数
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // 回到顶部函数
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth' // 平滑滚动
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <button 
      className={styles.scrollToTopButton}
      onClick={scrollToTop}
      aria-label="回到顶部"
    >
      ↑
      <span className={styles.tooltip}>回到顶部</span>
    </button>
  );
};

export default ScrollToTop;