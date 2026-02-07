import React, { useState } from 'react';
import styles from './Login.module.css';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const { login } = useUser();
    const navigate = useNavigate();
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setError('');
        const result = await login({ loginId: loginId.trim(), password });
        if (!result?.ok) {
            setError(result?.message || '登录失败');
            setSubmitting(false);
            return;
        }
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
                            autoComplete="current-password"
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
