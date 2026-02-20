import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { registerByEmail, resetPasswordByEmailCode, sendEmailCode } from '../../services/auth';
import styles from './Login.module.css';

export default function Login() {
  const { login } = useUser();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });
  const [registerForm, setRegisterForm] = useState({
    email: '',
    code: '',
    password: '',
    confirmPassword: '',
  });
  const [resetForm, setResetForm] = useState({
    email: '',
    code: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setSuccess('');
  };

  const startCountdown = (seconds = 60) => {
    setCountdown(seconds);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleLoginChange = (event) => {
    const { name, value } = event.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegisterChange = (event) => {
    const { name, value } = event.target;
    setRegisterForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleResetChange = (event) => {
    const { name, value } = event.target;
    setResetForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSendCode = async (purpose) => {
    if (sendingCode || countdown > 0) return;
    const email = purpose === 'register' ? registerForm.email.trim() : resetForm.email.trim();
    if (!email) {
      setError('请先输入邮箱');
      return;
    }
    setSendingCode(true);
    setError('');
    setSuccess('');
    try {
      const result = await sendEmailCode({ email, purpose });
      let message = '验证码已发送，请检查邮箱';
      if (result?.debug_code) {
        message += `（开发模式验证码：${result.debug_code}）`;
      }
      setSuccess(message);
      startCountdown(60);
    } catch (err) {
      setError(err?.message || '发送验证码失败');
    } finally {
      setSendingCode(false);
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setSuccess('');

    const result = await login({
      email: loginForm.email.trim(),
      password: loginForm.password,
    });

    if (!result?.ok) {
      setError(result?.message || '登录失败');
      setSubmitting(false);
      return;
    }

    navigate('/profile');
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSuccess('');

    if (!PASSWORD_RULE.test(registerForm.password)) {
      setError('密码必须至少8位，且包含大写字母、小写字母和数字');
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setSubmitting(true);
    try {
      await registerByEmail({
        email: registerForm.email.trim(),
        code: registerForm.code.trim(),
        password: registerForm.password,
        confirmPassword: registerForm.confirmPassword,
      });
      setSuccess('注册成功，请使用邮箱和密码登录');
      setLoginForm({ email: registerForm.email.trim(), password: '' });
      switchMode('login');
    } catch (err) {
      setError(err?.message || '注册失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSuccess('');

    if (!PASSWORD_RULE.test(resetForm.password)) {
      setError('密码必须至少8位，且包含大写字母、小写字母和数字');
      return;
    }
    if (resetForm.password !== resetForm.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setSubmitting(true);
    try {
      await resetPasswordByEmailCode({
        email: resetForm.email.trim(),
        code: resetForm.code.trim(),
        password: resetForm.password,
        confirmPassword: resetForm.confirmPassword,
      });
      setSuccess('密码重置成功，请使用新密码登录');
      setLoginForm({ email: resetForm.email.trim(), password: '' });
      switchMode('login');
    } catch (err) {
      setError(err?.message || '重置密码失败');
    } finally {
      setSubmitting(false);
    }
  };

  const renderLoginForm = () => (
    <form className={styles.form} onSubmit={handleLoginSubmit}>
      <label className={styles.label}>
        邮箱
        <input
          name="email"
          type="email"
          value={loginForm.email}
          onChange={handleLoginChange}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </label>

      <label className={styles.label}>
        密码
        <input
          name="password"
          type="password"
          value={loginForm.password}
          onChange={handleLoginChange}
          placeholder="请输入密码"
          autoComplete="current-password"
        />
      </label>

      <div className={styles.linkRow}>
        <button type="button" className={styles.linkButton} onClick={() => switchMode('reset')}>
          忘记密码？
        </button>
        <button type="button" className={styles.linkButton} onClick={() => switchMode('register')}>
          去注册
        </button>
      </div>

      <button type="submit" className={styles.submit} disabled={submitting}>
        {submitting ? '正在登录...' : '登录'}
      </button>
    </form>
  );

  const renderRegisterForm = () => (
    <form className={styles.form} onSubmit={handleRegisterSubmit}>
      <label className={styles.label}>
        邮箱
        <input
          name="email"
          type="email"
          value={registerForm.email}
          onChange={handleRegisterChange}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </label>

      <div className={styles.codeRow}>
        <label className={styles.label}>
          验证码
          <input
            name="code"
            value={registerForm.code}
            onChange={handleRegisterChange}
            placeholder="请输入邮箱验证码"
          />
        </label>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => handleSendCode('register')}
          disabled={sendingCode || countdown > 0}
        >
          {countdown > 0 ? `${countdown}s 后重发` : '发送验证码'}
        </button>
      </div>

      <label className={styles.label}>
        密码
        <input
          name="password"
          type="password"
          value={registerForm.password}
          onChange={handleRegisterChange}
          placeholder="至少8位，含大小写字母和数字"
          autoComplete="new-password"
        />
      </label>

      <label className={styles.label}>
        再次输入密码
        <input
          name="confirmPassword"
          type="password"
          value={registerForm.confirmPassword}
          onChange={handleRegisterChange}
          placeholder="请再次输入密码"
          autoComplete="new-password"
        />
      </label>

      <button type="submit" className={styles.submit} disabled={submitting}>
        {submitting ? '正在注册...' : '注册'}
      </button>

      <button type="button" className={styles.linkButtonLeft} onClick={() => switchMode('login')}>
        已有账号？去登录
      </button>
    </form>
  );

  const renderResetForm = () => (
    <form className={styles.form} onSubmit={handleResetSubmit}>
      <label className={styles.label}>
        邮箱
        <input
          name="email"
          type="email"
          value={resetForm.email}
          onChange={handleResetChange}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </label>

      <div className={styles.codeRow}>
        <label className={styles.label}>
          验证码
          <input
            name="code"
            value={resetForm.code}
            onChange={handleResetChange}
            placeholder="请输入邮箱验证码"
          />
        </label>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => handleSendCode('reset_password')}
          disabled={sendingCode || countdown > 0}
        >
          {countdown > 0 ? `${countdown}s 后重发` : '发送验证码'}
        </button>
      </div>

      <label className={styles.label}>
        新密码
        <input
          name="password"
          type="password"
          value={resetForm.password}
          onChange={handleResetChange}
          placeholder="至少8位，含大小写字母和数字"
          autoComplete="new-password"
        />
      </label>

      <label className={styles.label}>
        再次输入新密码
        <input
          name="confirmPassword"
          type="password"
          value={resetForm.confirmPassword}
          onChange={handleResetChange}
          placeholder="请再次输入新密码"
          autoComplete="new-password"
        />
      </label>

      <button type="submit" className={styles.submit} disabled={submitting}>
        {submitting ? '正在重置...' : '重置密码'}
      </button>

      <button type="button" className={styles.linkButtonLeft} onClick={() => switchMode('login')}>
        返回登录
      </button>
    </form>
  );

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <p className={styles.badge}>连接后端 · 邮箱认证</p>
        <h1 className={styles.heading}>账号中心</h1>
        <p className={styles.subheading}>
          注册、登录、找回密码均通过后端接口处理，不依赖本地账号缓存。
        </p>
        <ul className={styles.bullets}>
          <li>邮箱唯一，服务端校验</li>
          <li>验证码用于注册与密码重置</li>
          <li>密码需至少8位且包含大小写字母+数字</li>
        </ul>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>{mode === 'login' ? '邮箱登录' : mode === 'register' ? '邮箱注册' : '忘记密码'}</h2>
          <span>{mode === 'login' ? '使用邮箱 + 密码登录' : mode === 'register' ? '邮箱验证码注册' : '邮箱验证码重置密码'}</span>
        </div>

        {mode === 'login' && renderLoginForm()}
        {mode === 'register' && renderRegisterForm()}
        {mode === 'reset' && renderResetForm()}

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <p className={styles.hint}>所有账号操作均会同步到后端数据库，邮箱作为唯一身份凭证。</p>
      </div>
    </div>
  );
}
