"""
启动简单的 HTTP 服务器来测试 CORS
使用方法: python actions/start_cors_test.py
然后在浏览器访问: http://localhost:5173/cors-test.html
"""
import http.server
import socketserver
import os
import sys

PORT = 5173

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 添加缓存控制头
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()
    
    def log_message(self, format, *args):
        # 自定义日志格式
        print(f"[HTTP] {self.address_string()} - {format % args}")

def main():
    # 切换到项目根目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    os.chdir(project_root)
    
    # 检查 cors-test.html 文件是否存在
    if not os.path.exists('cors-test.html'):
        print("❌ 错误: 找不到 cors-test.html 文件")
        print(f"   当前目录: {os.getcwd()}")
        sys.exit(1)
    
    print("=" * 60)
    print("🌐 CORS 测试服务器")
    print("=" * 60)
    print(f"✅ 服务器已启动在 http://localhost:{PORT}")
    print(f"✅ 测试页面: http://localhost:{PORT}/cors-test.html")
    print()
    print("📋 确保后端服务已启动:")
    print("   uvicorn app.main:app --reload")
    print()
    print("⚠️  按 Ctrl+C 停止服务器")
    print("=" * 60)
    print()
    
    try:
        with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n👋 服务器已停止")
        sys.exit(0)
    except OSError as e:
        if e.errno == 10048:  # Windows: 端口被占用
            print(f"\n❌ 端口 {PORT} 已被占用")
            print("   可能的解决方案:")
            print("   1. 关闭占用该端口的程序")
            print("   2. 或修改此脚本中的 PORT 变量")
        else:
            print(f"\n❌ 错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
