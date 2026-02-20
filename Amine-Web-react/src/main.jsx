/*
  React入口文件，导入了项目框架文件和全局样式文件，并将App组件渲染到HTML的root节点中
*/

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
//引入hashrouter，后面需要更改为browserRouter
import { HashRouter } from 'react-router-dom'
import './index.css'
import './pages/config/markdown.css'
import App from './App.jsx'
import { UserProvider } from './pages/context/UserContext'
import './utils/cleanStorage.js' // 加载清理工具（开发环境使用）

createRoot(document.getElementById('root')).render(
  <StrictMode>
     <UserProvider>
    <HashRouter>
      <App />
    </HashRouter>
    </UserProvider>
  </StrictMode>,
)
