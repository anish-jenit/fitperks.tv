const form = document.getElementById('launch-form')
const baseUrlInput = document.getElementById('baseUrl')
const tvCodeInput = document.getElementById('tvCode')
const gameSelect = document.getElementById('game')
const clearBtn = document.getElementById('clearBtn')
const frame = document.getElementById('arcadeFrame')
const statusEl = document.getElementById('status')
const stageTitle = document.getElementById('stageTitle')
const fullscreenBtn = document.getElementById('fullscreenBtn')
const FIXED_BASE_URL = 'https://fitperks.ai'

function normalizeCode(value) {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4)
}

function normalizeBaseUrl(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    return ''
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(withProtocol)
    return url.origin
  } catch {
    return ''
  }
}

function buildTargetUrl(baseUrl, game, code) {
  if (game === 'dodge-runner') {
    const url = new URL('/tv', baseUrl)
    url.searchParams.set('code', code)
    return url.toString()
  }

  const url = new URL('/play/pose-wall', baseUrl)
  url.searchParams.set('tv', '1')
  url.searchParams.set('code', code)
  return url.toString()
}

function launch() {
  const code = normalizeCode(tvCodeInput.value)
  tvCodeInput.value = code
  baseUrlInput.value = FIXED_BASE_URL

  const baseUrl = normalizeBaseUrl(FIXED_BASE_URL)
  if (!baseUrl) {
    statusEl.textContent = 'Enter a valid app URL such as https://fitperks.ai'
    return
  }

  if (code.length !== 4) {
    statusEl.textContent = 'Enter a 4-character TV code.'
    return
  }

  const game = gameSelect.value
  const url = buildTargetUrl(baseUrl, game, code)
  frame.src = url
  stageTitle.textContent = `${game === 'dodge-runner' ? 'Dodge Runner' : 'Pose Wall'} - Code ${code}`
  statusEl.textContent = `Launched. Enter code ${code} on your phone and calibrate in front of TV.`

  localStorage.setItem('fitperks.tv.lastCode', code)
  localStorage.setItem('fitperks.tv.lastGame', game)
}

function restore() {
  const savedCode = localStorage.getItem('fitperks.tv.lastCode')
  const savedGame = localStorage.getItem('fitperks.tv.lastGame')

  baseUrlInput.value = FIXED_BASE_URL
  if (savedCode) {
    tvCodeInput.value = normalizeCode(savedCode)
  }
  if (savedGame === 'dodge-runner' || savedGame === 'pose-wall') {
    gameSelect.value = savedGame
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault()
  launch()
})

tvCodeInput.addEventListener('input', () => {
  tvCodeInput.value = normalizeCode(tvCodeInput.value)
})

clearBtn.addEventListener('click', () => {
  tvCodeInput.value = ''
  frame.removeAttribute('src')
  stageTitle.textContent = 'No game launched'
  statusEl.textContent = 'Cleared. Enter a code to launch again.'
})

fullscreenBtn.addEventListener('click', async () => {
  const target = frame.src ? frame : document.documentElement
  if (!document.fullscreenElement) {
    try {
      await target.requestFullscreen()
    } catch {
      statusEl.textContent = 'Fullscreen is blocked by this browser.'
    }
    return
  }

  await document.exitFullscreen()
})

restore()
