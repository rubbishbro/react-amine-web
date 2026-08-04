import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Post from '../components/Post';
import './index.css';
import { useUser } from '../context/userContext.js';
import { loadPostContent } from '../utils/postLoader';

export const Content = ({ onReadMore }) => {
    const navigate = useNavigate();
    const { favorites } = useUser();
    const [favoritePosts, setFavoritePosts] = useState([]);
    const [loading, setLoading] = useState(true);

    const handleOpenPost = (postId) => {
        if (onReadMore) {
            onReadMore(postId);
            return;
        }
        navigate(`/post/${postId}`);
    };

    useEffect(() => {
        const loadFavoritePosts = async () => {
            try {
                setLoading(true);
                const results = await Promise.all(
                    favorites.map((postId) => loadPostContent(postId))
                );
                const posts = results.filter(Boolean);
                setFavoritePosts(posts);
            } catch (error) {
                console.error('Error loading favorite posts:', error);
            } finally {
                setLoading(false);
            }
        };

        loadFavoritePosts();
    }, [favorites]);

    if (loading) {
        return (
            <div className="favorites-container">
                <div className="loading">加载中...</div>
            </div>
        );
    }

    return (
        <div className="favorites-container">
            <div className="favorites-header">
                <h2>🌟 我的收藏夹</h2>
                <p className="favorites-count">共 {favoritePosts.length} 个收藏</p>
            </div>

            {favoritePosts.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <p className="empty-text">还没有收藏任何帖子</p>
                    <p className="empty-subtext">浏览有趣的帖子，点击收藏按钮收藏它们</p>
                    <Link to="/" className="empty-action">
                        返回首页
                    </Link>
                </div>
            ) : (
                <div className="favorites-list">
                    {favoritePosts.map((post) => (
                        <div key={post.id} className="favorite-item">
                            <Post
                                post={post}
                                preview={true}
                                onReadMore={handleOpenPost}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Content;
