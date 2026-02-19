import React, { useEffect, useRef, useState } from 'react';
import styles from './Profile.module.css';
import { useUser } from '../context/UserContext';
import { buildUserId, getMappedUserId } from '../utils/userId';
import { useLocation, useNavigate } from 'react-router-dom';
import { adminActivate } from '../../services/adminApi';
import { uploadFile, updateUserAvatar } from '../../services/auth';

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
    const { user, updateProfile, logout, setAdmin, authToken, refreshUser } = useUser();
    const location = useLocation();
    const navigate = useNavigate();

    const isLoggedIn = user?.loggedIn === true;

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, []);

    useEffect(() => {
        if (location.state?.openAdmin) {
            setAdminOpen(true);
        }
    }, [location.state?.openAdmin]);

    useEffect(() => {
        if (!isLoggedIn) {
            navigate('/login');
        }
    }, [isLoggedIn, navigate]);

    const [form, setForm] = useState(() => ({
        ...emptyProfile,
        ...(user?.profile || {})
    }));
    const formDirtyRef = useRef(false);
    const lastUserIdRef = useRef(user?.id || '');
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [adminOpen, setAdminOpen] = useState(location.state?.openAdmin === true);
    const [adminKey, setAdminKey] = useState('');
    const [adminError, setAdminError] = useState('');
    const isAdmin = user?.isAdmin === true;

    useEffect(() => {
        const currentUserId = user?.id || '';
        if (currentUserId !== lastUserIdRef.current) {
            lastUserIdRef.current = currentUserId;
            formDirtyRef.current = false;
            setForm({
                ...emptyProfile,
                ...(user?.profile || {})
            });
            return;
        }

        if (!formDirtyRef.current) {
            setForm({
                ...emptyProfile,
                ...(user?.profile || {})
            });
        }
    }, [user?.profile, user?.id]);

    const handleChange = (e) => {
        formDirtyRef.current = true;
        setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
    };

    const [avatarError, setAvatarError] = useState('');
    const [coverError, setCoverError] = useState('');

    const handleAvatar = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const maxFileSize = 2 * 1024 * 1024;
        if (file.size > maxFileSize) {
            setAvatarError('图片大小不能超过 2MB');
            e.target.value = '';
            return;
        }
        setAvatarError('');

        try {
            // 先在本地压缩，再上传到后端
            const blob = await new Promise((resolve, reject) => {
                const img = new Image();
                const reader = new FileReader();
                reader.onload = () => {
                    img.onload = () => {
                        const maxSize = 256;
                        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.round(img.width * scale);
                        canvas.height = Math.round(img.height * scale);
                        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('压缩失败'))), 'image/jpeg', 0.85);
                    };
                    img.onerror = () => reject(new Error('图片加载失败，请选择有效的图片文件'));
                    img.src = reader.result;
                };
                reader.onerror = () => reject(new Error('读取文件失败'));
                reader.readAsDataURL(file);
            });
            const { url } = await uploadFile(authToken, new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
            formDirtyRef.current = true;
            setForm((s) => ({ ...s, avatar: url }));
        } catch (err) {
            setAvatarError(err.message || '上传失败，请重试');
        }
    };

    const handleCover = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const maxFileSize = 2 * 1024 * 1024;
        if (file.size > maxFileSize) {
            setCoverError('图片大小不能超过 2MB');
            e.target.value = '';
            return;
        }
        setCoverError('');

        try {
            const blob = await new Promise((resolve, reject) => {
                const img = new Image();
                const reader = new FileReader();
                reader.onload = () => {
                    img.onload = () => {
                        const maxWidth = 1200;
                        const scale = Math.min(maxWidth / img.width, 1);
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.round(img.width * scale);
                        canvas.height = Math.round(img.height * scale);
                        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('压缩失败'))), 'image/jpeg', 0.85);
                    };
                    img.onerror = () => reject(new Error('图片加载失败，请选择有效的图片文件'));
                    img.src = reader.result;
                };
                reader.onerror = () => reject(new Error('读取文件失败'));
                reader.readAsDataURL(file);
            });
            const { url } = await uploadFile(authToken, new File([blob], 'cover.jpg', { type: 'image/jpeg' }));
            formDirtyRef.current = true;
            setForm((s) => ({ ...s, cover: url }));
        } catch (err) {
            setCoverError(err.message || '上传失败，请重试');
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (password && password.length < 8) {
            setPasswordError('密码至少8位');
            return;
        }
        setPasswordError('');
        await updateProfile({ ...form, password: password || '' });
        // 头像和头图 URL 同步到后端数据库，其他设备登录后可自动读取
        if (authToken) {
            updateUserAvatar(authToken, { avatarUrl: form.avatar, coverUrl: form.cover }).catch(() => {});
        }
        const derivedId = getMappedUserId(user?.id || buildUserId(form.name, user?.id || 'local'));
        const nextUser = {
            id: user?.id || 'local',
            profile: { ...form },
            isAdmin: user?.isAdmin === true,
        };
        setPassword('');
        formDirtyRef.current = false;
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

    const handleAdminKey = async () => {
        const key = adminKey.trim();
        if (!key) return;
        try {
            await adminActivate(authToken, key);
            await refreshUser();
            setAdminError('');
            setAdminKey('');
        } catch (err) {
            setAdminError(err.message || '无效的密钥');
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/'); // 回主界面
    };

    if (!isLoggedIn) return null;

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
                <label className={styles.label}>
                    密码（留空则不修改）
                    <input
                        name="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="至少8位"
                    />
                </label>
                {passwordError && <span className={styles.loginError}>{passwordError}</span>}

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