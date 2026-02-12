import { API_BASE_URL } from '../pages/config';

class PostAPI{
    constructor(baseUrl = API_BASE_URL){
        this.baseUrl = baseUrl;
    }

    async getPostsLists(){
        try{
            const response = await fetch(`${this.baseUrl}/posts`);
            if(!response.ok) {
                throw new Error(`HTTP ${response.status}: 获取失败`);
            }
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        }catch(error){
            console.error('获取帖子列表失败:', error);
            return [];
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
}

export default PostAPI;