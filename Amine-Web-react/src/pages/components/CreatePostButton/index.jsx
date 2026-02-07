// pages/components/CreatePostButton/index.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './CreatePostButton.module.css';
import { useUser } from '../../context/UserContext';
import { getUserRestrictions } from '../../utils/adminMeta';
import { buildUserId } from '../../utils/userId';

const CreatePostButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();

  const handleClick = () => {
    // 检查用户是否登录
    if (!user?.loggedIn) {
      window.alert('请先登录后再发帖！');
      navigate('/login');
      return;
    }

    // 检查用户是否完善了个人信息（至少填写了名字）
    const userName = user?.profile?.name?.trim();
    if (!userName || userName === '游客' || userName === '匿名') {
      window.alert('请先完善个人信息（至少填写昵称）后再发帖！');
      navigate('/profile');
      return;
    }

    // 获取用户ID（与帖子作者ID生成方式一致）
    const userId = buildUserId(userName, user?.id || 'guest');
    const restrictions = getUserRestrictions(userId);

    // 检查是否被封禁
    if (restrictions.isBanned) {
      window.alert('您的账号已被封禁，无法发帖。');
      return;
    }

    // 检查是否被禁言
    if (restrictions.isMuted) {
      window.alert('您已被禁言，暂时无法发帖。');
      return;
    }

    navigate('/editor');
  };

  const hiddenPaths = ['/editor', '/profile', '/login', '/user'];

  // 在编辑器/登录/个人信息页面不显示按钮
  if (hiddenPaths.some((path) => location.pathname.startsWith(path))) {
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