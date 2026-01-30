import React, { useEffect, useState } from 'react';
import styles from './Profile.module.css';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';

const emptyProfile = {
    name: '',
    school: '',
    className: '',
    email: '',
    avatar: '',
};

export default function Profile() {
    const { user, login, updateProfile, logout } = useUser();
    const navigate = useNavigate();

    const isLoggedIn = user?.loggedIn === true;

    useEffect(() => {
        if (!isLoggedIn) login();
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [isLoggedIn, login]);

    const [form, setForm] = useState(() => ({
    ...emptyProfile,
    ...(user?.profile || {})
    }));

    const handleChange = (e) => {
        setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
    };

    const handleAvatar = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const img = new Image();
        const reader = new FileReader();
        reader.onload = () => {
            img.onload = () => {
                const maxSize = 128;
                const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setForm((s) => ({ ...s, avatar: dataUrl }));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    };

    const handleSave = (e) => {
        e.preventDefault();
        updateProfile(form);
        navigate('/'); // 回主界面
    };

    const handleLogout = () => {
        logout();
        navigate('/'); // 回主界面
    };

    return (
        <div className={styles.page}>
            <h2 className={styles.title}>个人信息编辑</h2>
            <form className={styles.form} onSubmit={handleSave}>
                <div className={styles.avatarRow}>
                    <div
                        className={styles.avatar}
                        style={form.avatar ? { backgroundImage: `url(${form.avatar})` } : undefined}
                    />
                    <input type="file" accept="image/*" onChange={handleAvatar} />
                </div>

                <label className={styles.label}>
                    昵称
                    <input name="name" value={form.name} onChange={handleChange} />
                </label>
                <label className={styles.label}>
                    学校
                    <input name="school" value={form.school} onChange={handleChange} />
                </label>
                <label className={styles.label}>
                    班级
                    <input name="className" value={form.className} onChange={handleChange} />
                </label>
                <label className={styles.label}>
                    邮箱
                    <input name="email" value={form.email} onChange={handleChange} />
                </label>

                <div className={styles.actions}>
                    <button className={styles.save} type="submit">保存</button>
                    <button className={styles.logout} type="button" onClick={handleLogout}>退出登录</button>
                </div>
            </form>
        </div>
    );
}