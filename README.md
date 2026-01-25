# 简介

动漫风格的静态网站

本网站前端使用React和CSS开发（同时使用npm作为包管理器）

**项目概览**
- **根目录**: 项目工作区在 `react-amine-web`，实际前端工程在 Amine-Web-react 子目录（该目录包含 `index.html`、`package.json`、`src` 等）。
- **入口 HTML**: `index.html` — 挂载点为 `div#root`，并通过 `<script type="module" src="/src/main.jsx">` 启动前端。
- **入口 JS**: `src/main.jsx` — 通常负责 React 根渲染、全局样式与路由挂载。
- **主组件**: `src/App.jsx` — 应用根组件，页面布局、顶栏或路由占位通常在此处。
- **页面/模块**: `src/community/` — 包含社区相关页面与样式（例如 `index.jsx`、`index.css`）。其他功能应按目录分组放在 `src/` 下。
- **静态资源**: `public/` — 放 favicon、图标等无需打包的静态文件。
- **构建/脚本**: `package.json`（在 Amine-Web-react） — 含 `dev`、`build`、`start` 等脚本，使用 Vite（看 `vite.config.js`）来运行与打包。

下一步你可以运行开发服务器（如果当前没启动）：
```powershell
cd ...\react-amine-web\Amine-Web-react
npm install
npm run dev
```

**如何添加新功能（常用流程）**
- 新组件：在 `src/components/` 创建 `MyWidget.jsx`，导出默认组件；在需要处 `import MyWidget from './components/MyWidget'` 并在 `App.jsx` 或页面中使用。
- 新页面：在 `src/pages/` 创建页面组件（例如 `src/pages/About.jsx`），然后在 `App.jsx` 中通过路由注册该页面（推荐使用 `react-router`）。
- 路由（若未配置）：安装 `react-router-dom`，在 `src/main.jsx` 或 `App.jsx` 用 `<BrowserRouter>` 包裹并在 `<Routes>` 中添加 `<Route path="/xxx" element={<Page/>} />`。
- 状态管理：小型项目可用 React `useContext` + `useReducer`，中大型可引入 `Redux` 或 `Zustand`，把全局状态放到 `src/store/`。
- 样式约定：组件级样式放 `src/components/ComponentName.module.css` 或使用 CSS-in-JS；全局样式放 `src/index.css` / `App.css`。
- 资源与接口：把 API 调用封装到 `src/api/`，每个模块一个文件，统一处理 token/错误/请求拦截器。

**开发与提交最佳实践**
- 先在新的 git 分支开发新功能（`feature/xxx`）。
- 本地运行 `npm run dev` 验证界面与交互。
- 添加或更新测试（如果项目有测试套件）。
- 格式化（如 `prettier`）并运行 lint（如 `eslint`）。
- 提交并推送 PR，简短描述变更点。