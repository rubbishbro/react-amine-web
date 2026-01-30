/*
  App组件，作为React应用的根组件，导入并渲染CommunityBoard组件
*/

import CommunityBoard from './pages/community/index.jsx'
import ScrollToTop from './pages/components/ScrollToTop/index.jsx'
import CreatePostButton from './pages/components/CreatePostButton/index.jsx';
import './App.css'
import { UserProvider } from './pages/context/UserContext';

function App() {
  return (
    <UserProvider>
      <ScrollToTop />
      <CreatePostButton />
      <CommunityBoard />
    </UserProvider>
  )
}

export default App
