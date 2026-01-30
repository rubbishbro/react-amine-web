import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styles from './PublicProfile.module.css';

export default function PublicProfile() {
    const { state } = useLocation();
    const { id } = useParams();
    const navigate = useNavigate();

    const author = state?.author;

    if (!author) {
        return (
            <div className={styles.page}>
                <p>无法加载用户资料（id: {id}）</p>
                <button onClick={() => navigate(-1)}>返回</button>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div
                    className={styles.avatar}
                    style={author.avatar ? { backgroundImage: `url(${author.avatar})` } : undefined}
                />
                <div>
                    <h2>{author.name}</h2>
                    <div className={styles.meta}>{author.school} · {author.className}</div>
                    <div className={styles.meta}>{author.email}</div>
                </div>
            </div>
        </div>
    );
}