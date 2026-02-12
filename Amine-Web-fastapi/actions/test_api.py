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
        # 添加 Origin 头部模拟浏览器跨域请求
        headers = {"Origin": "http://localhost:5173"}
        response = requests.get(f"{BASE_URL}/posts", headers=headers)
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
        # 添加 Origin 头部模拟浏览器跨域请求
        headers = {"Origin": "http://localhost:5173"}
        response = requests.get(f"{BASE_URL}/users/username/张三", headers=headers)
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
        # 使用 GET 请求测试 CORS（模拟浏览器真实请求）
        response = requests.get(
            f"{BASE_URL}/posts",
            headers={'Origin': 'http://localhost:5173'}
        )
        print(f"状态码: {response.status_code}")
        print(f"CORS 响应头:")
        print(f"  Access-Control-Allow-Origin: {response.headers.get('Access-Control-Allow-Origin')}")
        print(f"  Access-Control-Allow-Credentials: {response.headers.get('Access-Control-Allow-Credentials')}")
        print(f"  Vary: {response.headers.get('Vary')}")
        
        if response.headers.get('Access-Control-Allow-Origin'):
            print("✅ CORS 配置正常 - 前端可以正常访问")
        else:
            print("❌ CORS 配置异常 - 前端可能无法访问")
            
        # 额外测试: OPTIONS 预检请求（跨域复杂请求会先发送）
        print("\n📋 OPTIONS 预检请求:")
        options_response = requests.options(
            f"{BASE_URL}/posts",
            headers={
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type,authorization',
            }
        )
        print(f"  状态码: {options_response.status_code}")
        print(f"  Allow-Methods: {options_response.headers.get('Access-Control-Allow-Methods')}")
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
