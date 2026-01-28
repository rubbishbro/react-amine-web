# 简介

项目架构如下

```
D:.
│  LICENSE  #许可证
│  README.md  #项目介绍文档
│
└─Amine-Web-react  #服务器主体文件 
    │  .gitignore  
    │  eslint.config.js 
    │  index.html  #入口html
    │  package-lock.json 
    │  package.json
    │  vite.config.js
    │
    ├─node_modules  #服务器运行包，从远程仓库clone下来后通过npm install自动安装
    |
    ├─posts  #帖子存储文件夹
    │      metadata.json  #帖子管理
    │      post-1.json  #存储帖子的基本信息
    │      post-1.md  #存储帖子的内容
    │
    ├─public  #静态资源
    │      BackGround.png  #背景图片
    │      favicon.ico  #网站图标
    │
    └─src  #代码库
        │  App.css  #React的APP的样式文件
        │  App.jsx  #React的APP的根组件，渲染主页
        │  index.css  #主页基本样式文件
        │  main.jsx  #React入口
        │
        ├─about  #社团介绍页面
        │      about.css
        │      about.js
        │      about.jsx
        │
        ├─activities  #社团活动页面
        │      activities.css
        │      activities.js
        │      activities.jsx
        │
        ├─amine  #季度新番页面
        │      amine.css
        │      amine.js
        │      amine.jsx
        │
        ├─community  #主页
        │      index.css
        │      index.js
        │      index.jsx
        │
        ├─components  #组件
        │  ├─Post  #帖子框显示组件
        │  │      index.jsx
        │  │      Post.module.css
        │  │
        │  ├─PostDetail  #帖子界面加载组件
        │  │      index.jsx
        │  │      PostDetail.module.css
        │  │
        │  └─PostList  #帖子列表加载组件
        │          index.jsx
        │          PostList.module.css
        │
        ├─derivativeworks  #同人/杂谈页面
        │      derivativeworks.css
        │      derivativeworks.js
        │      derivativeworks.jsx
        │
        ├─forum  #论坛闲聊页面
        │      forum.css
        │      forum.js
        │      forum.jsx
        │
        ├─musicgames  #音游区页面
        │      musicgames.css
        │      musicgames.js
        │      musicgames.jsx
        │
        ├─resources  #网络资源页面
        │      resources.css
        │      resources.js
        │      resources.jsx
        │
        ├─tech  #前沿技术页面
        │      tech.css
        │      tech.js
        │      tech.jsx
        │
        └─utils   #工具库
                postLoader.js  #帖子加载工具
```

本地需要的环境准备（如果不全请告诉我）
- VSCode (代码编辑工具)
- GitLens —— Git supercharged (VSCode扩展)
- Live Server (VSCode扩展)
- VSCode for Node.js - Development Pack (VSCode扩展)
- Node.js 工具(用于提供npm包管理器)
- Git (用于链接远程仓库)


项目修改方法
- 首先确保你已应完成了本地所需要的配置，如果没有，请先完成本地环境的配置
- 然后通过 `git clone https://github.com/rubbishbro/react-amine-web.git` 将远程仓库导入你的本地
- 然后输入 `git checkout -b feat/你的名字` 来创建你的分支，之后你的修改就能在你的分支上被看到
- 进入 `/react-amine-web/Amine-Web-react/` 目录下输入 `npm install`
- 然后输入 `npm run dev` 来启动网站
- 在控制台中找到链接，复制到Chome/Edge中打开来查看网站
- 根据项目目录修改你想修改的部分
- 在你完成修改之后，输入 `git add .` 命令添加你的修改到暂存区
- 接着，输入 `git commit -m "你修改的内容"` 来上传你的修改
- 最后 `git push -u origin feat/你的名字` 来上传它
