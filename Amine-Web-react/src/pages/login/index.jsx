import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import styles from './Login.module.css';

export default function Login() {
  const { login } = useUser();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    loginId: '',
    password: '',
    school: '',
    className: '',
    email: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');

    const result = await login({
      loginId: form.loginId.trim(),
      password: form.password,
      school: form.school,
      className: form.className,
      email: form.email,
    });

    if (!result?.ok) {
      setError(result?.message || '登录失败');
      setSubmitting(false);
      return;
    }

    navigate('/profile');
  };

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <p className={styles.badge}>连接后端 · JWT 登录</p>
        <h1 className={styles.heading}>进入 Amine Web</h1>
        <p className={styles.subheading}>
          使用后端账号登录，ID 与帖子作者保持一致，跨设备同步点赞与收藏。
        </p>
        <ul className={styles.bullets}>
          <li>后端验证 · 安全存储 Token</li>
          <li>同步获取用户档案</li>
          <li>学校 / 班级 等额外信息可选填</li>
        </ul>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>账号登录</h2>
          <span>使用后端 /api/v1/login/access-token</span>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            用户名或邮箱
            <input
              name="loginId"
              value={form.loginId}
              onChange={handleChange}
              placeholder="后端账户 username / email"
              autoComplete="username"
            />
          </label>

          <label className={styles.label}>
            密码
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </label>

          <div className={styles.inline}>
            <label className={styles.label}>
              学校（可选）
              <input
                name="school"
                value={form.school}
                onChange={handleChange}
                placeholder="示例：华东理工大学"
              />
            </label>
            <label className={styles.label}>
              班级（可选）
              <input
                name="className"
                value={form.className}
                onChange={handleChange}
                placeholder="示例：计科 2202"
              />
            </label>
          </div>

          <label className={styles.label}>
            邮箱（可选，用于完善资料）
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? '正在连接...' : '登录'}
          </button>
        </form>

        <p className={styles.hint}>
          登录后自动同步后端用户信息，如需修改头像、学校或班级，请在个人资料页完善。
        </p>
      </div>
    </div>
  );
}
