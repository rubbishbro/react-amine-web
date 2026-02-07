import React, { useEffect, useState } from 'react';
import styles from './Profile.module.css';
import { useUser } from '../context/UserContext';
import { buildUserId } from '../utils/userId';
import { useLocation, useNavigate } from 'react-router-dom';

const emptyProfile = {
    name: '',
    school: '',
    className: '',
    email: '',
    avatar: '',
    cover: '',
    bio: '',
};

export default function Profile() {
    const { user, login, updateProfile, logout, setAdmin } = useUser();
    const location = useLocation();
    const navigate = useNavigate();

    const isLoggedIn = user?.loggedIn === true;

    useEffect(() => {
        if (!isLoggedIn) login();
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [isLoggedIn, login]);

    useEffect(() => {
        if (location.state?.openAdmin) {
            setAdminOpen(true);
        }
    }, [location.state?.openAdmin]);

    const [form, setForm] = useState(() => ({
        ...emptyProfile,
        ...(user?.profile || {})
    }));
    const [adminOpen, setAdminOpen] = useState(location.state?.openAdmin === true);
    const [adminKey, setAdminKey] = useState('');
    const [adminError, setAdminError] = useState('');
    const isAdmin = user?.isAdmin === true;

    const handleChange = (e) => {
        setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
    };

    const [avatarError, setAvatarError] = useState('');
    const [coverError, setCoverError] = useState('');

    const handleAvatar = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 限制原始文件大小（2MB）
        const maxFileSize = 2 * 1024 * 1024;
        if (file.size > maxFileSize) {
            setAvatarError('图片大小不能超过 2MB');
            e.target.value = '';
            return;
        }

        setAvatarError('');
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
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

                // 限制压缩后大小（50KB），避免 localStorage 配额超限
                if (dataUrl.length > 50 * 1024) {
                    setAvatarError('图片压缩后仍过大，请选择更小的图片');
                    return;
                }

                setForm((s) => ({ ...s, avatar: dataUrl }));
            };
            img.onerror = () => {
                setAvatarError('图片加载失败，请选择有效的图片文件');
            };
            img.src = reader.result;
        };
        reader.onerror = () => {
            setAvatarError('读取文件失败');
        };
        reader.readAsDataURL(file);
    };

    const handleCover = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const maxFileSize = 2 * 1024 * 1024;
        if (file.size > maxFileSize) {
            setCoverError('图片大小不能超过 2MB');
            e.target.value = '';
            return;
        }

        setCoverError('');
        const img = new Image();
        const reader = new FileReader();
        reader.onload = () => {
            img.onload = () => {
                const maxWidth = 1200;
                const scale = Math.min(maxWidth / img.width, 1);
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

                if (dataUrl.length > 200 * 1024) {
                    setCoverError('图片压缩后仍过大，请选择更小的图片');
                    return;
                }

                setForm((s) => ({ ...s, cover: dataUrl }));
            };
            img.onerror = () => {
                setCoverError('图片加载失败，请选择有效的图片文件');
            };
            img.src = reader.result;
        };
        reader.onerror = () => {
            setCoverError('读取文件失败');
        };
        reader.readAsDataURL(file);
    };

    const handleSave = (e) => {
        e.preventDefault();
        updateProfile(form);
        const derivedId = buildUserId(form.name, user?.id || 'local');
        const nextUser = {
            id: user?.id || 'local',
            profile: { ...form },
            isAdmin: user?.isAdmin === true,
        };
        navigate(`/user/${derivedId}`, {
            state: {
                author: {
                    id: derivedId,
                    name: nextUser.profile?.name || '匿名',
                    avatar: nextUser.profile?.avatar || '',
                    cover: nextUser.profile?.cover || '',
                    school: nextUser.profile?.school || '',
                    className: nextUser.profile?.className || '',
                    email: nextUser.profile?.email || '',
                    bio: nextUser.profile?.bio || '',
                    isAdmin: nextUser.isAdmin === true,
                },
            },
        });
    };

    const handleAdminKey = () => {
        if (adminKey.trim() === 'E动漫社forever') {
            setAdmin(true);
            setAdminError('');
            setAdminKey('');
        } else {
            setAdminError('无效的密钥');
        }
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
                    <div className={styles.avatarUpload}>
                        <input type="file" accept="image/*" onChange={handleAvatar} />
                        <span className={styles.avatarHint}>支持 JPG/PNG，最大 2MB</span>
                        {avatarError && <span className={styles.avatarError}>{avatarError}</span>}
                    </div>
                </div>

                <div className={styles.coverRow}>
                    <div
                        className={styles.coverPreview}
                        style={form.cover ? { backgroundImage: `url(${form.cover})` } : undefined}
                    />
                    <div className={styles.avatarUpload}>
                        <input type="file" accept="image/*" onChange={handleCover} />
                        <span className={styles.avatarHint}>头图建议横向，最大 2MB</span>
                        {coverError && <span className={styles.avatarError}>{coverError}</span>}
                    </div>
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
                <label className={styles.label}>
                    个人简介（支持 Markdown）
                    <textarea
                        name="bio"
                        value={form.bio}
                        onChange={handleChange}
                        rows={4}
                        placeholder="介绍一下你自己，比如兴趣、擅长领域等..."
                    />
                </label>

                <div className={styles.adminSection}>
                    <button
                        type="button"
                        className={styles.adminToggle}
                        onClick={() => setAdminOpen((prev) => !prev)}
                    >
                        管理员密钥 {adminOpen ? '▲' : '▼'}
                    </button>
                    {adminOpen && (
                        <div className={styles.adminPanel}>
                            <div className={styles.adminStatus}>
                                当前身份：{isAdmin ? '管理员' : '普通用户'}
                            </div>
                            <div className={styles.adminInputRow}>
                                <input
                                    value={adminKey}
                                    onChange={(e) => setAdminKey(e.target.value)}
                                    placeholder="输入密钥"
                                />
                                <button
                                    type="button"
                                    className={styles.adminApply}
                                    onClick={handleAdminKey}
                                >
                                    验证
                                </button>
                            </div>
                            {adminError && (
                                <div className={styles.adminError}>{adminError}</div>
                            )}
                        </div>
                    )}
                </div>

                <div className={styles.actions}>
                    <button className={styles.save} type="submit">保存</button>
                    <button className={styles.logout} type="button" onClick={handleLogout}>退出登录</button>
                </div>
            </form>
        </div>
    );
}