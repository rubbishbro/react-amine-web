"""
测试 API 端点
"""
import requests

# 测试后端 API
BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_posts_api():
    """测试获取帖子列表"""
    print("🔍 测试 GET /posts")
    print("-" * 50)
    
    try:
        response = requests.get(f"{BASE_URL}/posts")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            posts = response.json()
            print(f"✅ 成功！获取到 {len(posts)} 个帖子")
            
            if posts:
                print("\n第一个帖子示例:")
                first_post = posts[0]
                print(f"  ID: {first_post.get('id')}")
                print(f"  标题: {first_post.get('title')}")
                print(f"  作者ID: {first_post.get('author_id')}")
                print(f"  作者信息: {first_post.get('author')}")
                print(f"  是否发布: {first_post.get('is_published')}")
            else:
                print("⚠️  数据库中没有帖子")
        else:
            print(f"❌ 失败: {response.text}")
    except Exception as e:
        print(f"❌ 连接失败: {e}")
        print("请确保后端服务已启动: uvicorn app.main:app --reload")

def test_users_api():
    """测试获取用户"""
    print("\n🔍 测试 GET /users/username/{username}")
    print("-" * 50)
    
    try:
        response = requests.get(f"{BASE_URL}/users/username/张三")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            user = response.json()
            print(f"✅ 成功！")
            print(f"  ID: {user.get('id')}")
            print(f"  用户名: {user.get('username')}")
            print(f"  邮箱: {user.get('email')}")
            print(f"  是否管理员: {user.get('is_superuser')}")
            print(f"  头衔: {user.get('title')}")
            print(f"  是否禁言: {user.get('is_muted')}")
            print(f"  是否封禁: {user.get('is_banned')}")
        else:
            print(f"❌ 失败: {response.text}")
    except Exception as e:
        print(f"❌ 连接失败: {e}")

def test_cors():
    """测试CORS配置"""
    print("\n🔍 测试 CORS 配置")
    print("-" * 50)
    
    try:
        response = requests.options(
            f"{BASE_URL}/posts",
            headers={
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'GET',
            }
        )
        print(f"状态码: {response.status_code}")
        print(f"CORS 头部:")
        print(f"  Access-Control-Allow-Origin: {response.headers.get('Access-Control-Allow-Origin')}")
        print(f"  Access-Control-Allow-Methods: {response.headers.get('Access-Control-Allow-Methods')}")
        
        if response.headers.get('Access-Control-Allow-Origin'):
            print("✅ CORS 配置正常")
        else:
            print("⚠️  CORS 可能未正确配置")
    except Exception as e:
        print(f"❌ 测试失败: {e}")

if __name__ == "__main__":
    print("=" * 50)
    print("API 连通性测试")
    print("=" * 50)
    
    test_posts_api()
    test_users_api()
    test_cors()
    
    print("\n" + "=" * 50)
    print("测试完成")
    print("=" * 50)
