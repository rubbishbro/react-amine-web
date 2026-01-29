let _handlers = {}

export function initPage() {
  const sidebar = document.getElementById('sidebar')
  const trigger = document.querySelector('.menu-trigger')
  const mainCard = document.querySelector('.main-card')

  function toggleSidebar() {
    if (!sidebar) return
    sidebar.classList.toggle('active')
    if (sidebar.classList.contains('active')) {
      trigger.style.transform = 'rotate(90deg)'
      trigger.style.left = '280px'
    } else {
      trigger.style.transform = 'rotate(0deg)'
      trigger.style.left = '25px'
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

export function teardownPage() {
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
}

export default { initPage, teardownPage }
