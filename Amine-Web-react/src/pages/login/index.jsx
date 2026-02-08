import React, { useState } from 'react';
import styles from './Login.module.css';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const { login } = useUser();
    const navigate = useNavigate();
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const readAccount = (id) => {
        if (!id) return null;
        try {
            const raw = localStorage.getItem('aw_accounts');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            return parsed[id] || null;
        } catch {
            return null;
        }
    };

    const trimmedLoginId = loginId.trim();
    const isNewAccount = !!trimmedLoginId && !readAccount(trimmedLoginId);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setError('');
        if (isNewAccount) {
            if (!confirmPassword) {
                setError('请再次输入密码');
                setSubmitting(false);
                return;
            }
            if (password !== confirmPassword) {
                setError('两次密码不一致');
                setSubmitting(false);
                return;
            }
        }
        const result = await login({ loginId: trimmedLoginId, password });
        if (!result?.ok) {
            setError(result?.message || '登录失败');
            setSubmitting(false);
            return;
        }
        setConfirmPassword('');
        navigate('/profile');
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h2 className={styles.title}>登录</h2>
                <form className={styles.form} onSubmit={handleSubmit}>
                    <label className={styles.label}>
                        ID
                        <input
                            name="loginId"
                            value={loginId}
                            onChange={(event) => setLoginId(event.target.value)}
                            placeholder="输入自定义ID"
                            autoComplete="username"
                        />
                    </label>
                    <label className={styles.label}>
                        密码
                        <input
                            name="password"
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="至少8位"
                            autoComplete={isNewAccount ? 'new-password' : 'current-password'}
                        />
                    </label>
                    <label className={styles.label}>
                        再次输入密码
                        <input
                            name="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            placeholder="请再次输入密码"
                            autoComplete="new-password"
                        />
                    </label>
                    {error && <div className={styles.error}>{error}</div>}
                    <button type="submit" className={styles.submit} disabled={submitting}>
                        {submitting ? '登录中...' : '登录'}
                    </button>
                </form>
                <p className={styles.hint}>首次登录会自动注册一个本地账号。</p>
            </div>
        </div>
    );
}
