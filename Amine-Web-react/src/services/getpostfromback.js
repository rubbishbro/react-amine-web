import { API_BASE_URL } from '../pages/config';
import { authHeaders } from './auth.js';

class PostAPI{
    constructor(baseUrl = API_BASE_URL){
        this.baseUrl = baseUrl;
    }

    async getPostsLists({ skip = 0, limit = 20, category = null } = {}){
        try{
            const params = new URLSearchParams();
            params.set('skip', String(skip));
            params.set('limit', String(limit));
            if (category) {
                params.set('category', category);
            }
            const response = await fetch(`${this.baseUrl}/posts/?${params.toString()}`);
            if(!response.ok) {
                throw new Error(`HTTP ${response.status}: 获取失败`);
            }
            const data = await response.json();
            if (Array.isArray(data)) {
                return { items: data, total: data.length, skip, limit };
            }
            const items = Array.isArray(data?.items) ? data.items : [];
            const total = Number.isFinite(data?.total) ? data.total : items.length;
            return { items, total, skip: data?.skip ?? skip, limit: data?.limit ?? limit };
        }catch(error){
            console.error('获取帖子列表失败:', error);
            return { items: [], total: 0, skip, limit };
        }
    }

    async getPostById(id) {
        try {
            const response = await fetch(`${this.baseUrl}/posts/${id}`);
            if (!response.ok) throw new Error('帖子不存在');
            return await response.json();
        } catch (error) {
            console.error(`获取帖子 ${id} 失败:`, error);
            return null;
        }
    }

    async createPost(postData, token) {
        try {
            const payload = {
                title: postData?.title || '',
                content: postData?.content || '',
                summary: postData?.summary || '',
                category: postData?.category || '',
                tags: Array.isArray(postData?.tags) ? postData.tags : [],
                is_published: true,
            };
            const response = await fetch(`${this.baseUrl}/posts/`, {
                method: 'POST',
                headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: 创建失败`);
            }
            return await response.json();
        } catch (error) {
            console.error('创建帖子失败:', error);
            throw error;
        }
    }
}

export default PostAPI;