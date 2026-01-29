import { useEffect, useRef } from 'react';

let _handlers = {}

export function usePageTitle(title) {
  const originalTitle = useRef(document.title);
  
  useEffect(() => {
    if (title) {
      document.title = title;
    }
    
    const currentOriginalTitle = originalTitle.current;
    
    return () => {
      document.title = currentOriginalTitle;
    };
  }, [title]);
  
  const setTitle = (newTitle) => {
    document.title = newTitle;
  };
  
  return { setTitle };
}

export function initCommunityBoard() {
  const sidebar = document.getElementById('sidebar')
  const trigger = document.querySelector('.menu-trigger')
  const homeBtn = document.querySelector('.home-button')
  const mainCard = document.querySelector('.main-card')

  function toggleSidebar() {
    if (!sidebar) return
    sidebar.classList.toggle('active')
    if (sidebar.classList.contains('active')) {
      trigger.style.transform = 'rotate(90deg)'
      trigger.style.left = '280px'
      if (homeBtn) {
        homeBtn.style.left = '280px'
        // ensure home button does not rotate
        homeBtn.style.transform = 'none'
      }
    } else {
      trigger.style.transform = 'rotate(0deg)'
      trigger.style.left = '25px'
      if (homeBtn) {
        homeBtn.style.left = '25px'
      }
    }
  }

  _handlers.toggle = toggleSidebar

  if (trigger) trigger.addEventListener('click', toggleSidebar)

  function mainClickHandler() {
    if (sidebar && sidebar.classList.contains('active')) {
      toggleSidebar()
    }
  }

  _handlers.mainClick = mainClickHandler

  if (mainCard) mainCard.addEventListener('click', mainClickHandler)
}

export function closeSidebar() {
  const sidebar = document.getElementById('sidebar')
  const trigger = document.querySelector('.menu-trigger')
  if (sidebar && sidebar.classList.contains('active')) {
    sidebar.classList.remove('active')
    if (trigger) {
      trigger.style.transform = 'rotate(0deg)'
      trigger.style.left = '25px'
      const homeBtn = document.querySelector('.home-button')
      if (homeBtn) homeBtn.style.left = '25px'
    }
  }
}

export function teardownCommunityBoard() {
  const sidebar = document.getElementById('sidebar')
  const trigger = document.querySelector('.menu-trigger')
  const mainCard = document.querySelector('.main-card')

  if (trigger && _handlers.toggle) trigger.removeEventListener('click', _handlers.toggle)
  if (mainCard && _handlers.mainClick) mainCard.removeEventListener('click', _handlers.mainClick)
  _handlers = {}
  if (trigger) {
    trigger.style.transform = ''
    trigger.style.left = ''
  }
  if (sidebar) sidebar.classList.remove('active')
  const homeBtn = document.querySelector('.home-button')
  if (homeBtn) {
    homeBtn.style.left = ''
    homeBtn.style.transform = ''
  }
}

export default { initCommunityBoard, teardownCommunityBoard }
