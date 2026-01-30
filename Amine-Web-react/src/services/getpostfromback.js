class PostAPI{
    constructor(baseUrl = 'http://192.168.33.158:8000'){
        this.baseUrl = baseUrl;
    }

    async getPostsLists(){
        try{
            const response = await fetch(`${this.baseUrl}/posts`);
            if(!response.ok)throw new Error('获取失败');
            return await response.json();
        }catch(error){
            console.error('获取列表失败',error);
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