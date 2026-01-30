// pages/components/CreatePostButton/index.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './CreatePostButton.module.css';

const CreatePostButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = () => {
    navigate('/editor');
  };

  // 在编辑器页面不显示按钮
  if (location.pathname.startsWith('/editor')) {
    return null;
  }

  return (
    <button 
      className={styles.createPostButton}
      onClick={handleClick}
      aria-label="新建帖子"
    >
      <div className={styles.buttonContent}>
        <span className={styles.plusIcon}>+</span>
        <span className={styles.buttonText}>新建帖子</span>
      </div>
    </button>
  );
};

export default CreatePostButton;