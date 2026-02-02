import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Post from '../components/Post';
import './index.css';
import { useUser } from '../context/UserContext';
import { loadPostContent } from '../utils/postLoader';

export const Content = ({ onReadMore }) => {
    const navigate = useNavigate();
    const { favorites } = useUser();
    const [favoritePosts, setFavoritePosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadFavoritePosts = async () => {
            try {
                setLoading(true);
                const posts = [];

                for (const postId of favorites) {
                    const post = await loadPostContent(postId);
                    if (post) {
                        posts.push(post);
                    }
                }

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
                <p className="favorites-count">共 {favorites.length} 个收藏</p>
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
                        <div key={post.id} className="favorite-item" onClick={() => onReadMore?.(post.id)}>
                            <Post
                                post={post}
                                preview={true}
                                onReadMore={onReadMore}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Content;
