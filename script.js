const form = document.getElementById('launch-form')
const baseUrlInput = document.getElementById('baseUrl')
const tvCodeInput = document.getElementById('tvCode')
const gameSelect = document.getElementById('game')
const clearBtn = document.getElementById('clearBtn')
const frame = document.getElementById('arcadeFrame')
const statusEl = document.getElementById('status')
const stageTitle = document.getElementById('stageTitle')
const fullscreenBtn = document.getElementById('fullscreenBtn')
const calibrationCoach = document.getElementById('calibrationCoach')
const coachTitle = document.getElementById('coachTitle')
const coachPrompt = document.getElementById('coachPrompt')
const FIXED_BASE_URL = 'https://fitperks.ai'
const TRUSTED_APP_ORIGINS = new Set([
  'https://fitperks.ai',
  'https://fitperks.org',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

function directionFromPrompt(prompt) {
  const normalizedPrompt = String(prompt || '').toLowerCase()
  if (normalizedPrompt.includes('left')) return 'left'
  if (normalizedPrompt.includes('right')) return 'right'
  if (normalizedPrompt.includes('front') || normalizedPrompt.includes('forward') || normalizedPrompt.includes('closer')) return 'front'
  if (normalizedPrompt.includes('back')) return 'back'
  return 'center'
}

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

function showCalibrationCoach(title, prompt, isReady = false, direction = 'center') {
  calibrationCoach.hidden = false
  calibrationCoach.classList.toggle('ready', isReady)
  calibrationCoach.dataset.direction = direction
  coachTitle.textContent = title
  coachPrompt.textContent = prompt
}

function hideCalibrationCoach() {
  calibrationCoach.hidden = true
  calibrationCoach.classList.remove('ready')
  calibrationCoach.dataset.direction = 'center'
  coachTitle.textContent = 'Pair phone, then stand in frame'
  coachPrompt.textContent = 'Move back, move front, move left, or move right until the hologram turns green.'
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
  statusEl.textContent = `Launched. Pair phone with code ${code}, then follow TV movement prompts until calibration locks.`
  showCalibrationCoach(
    'Pair phone, then stand in frame',
    'After pairing, move back, move front, move left, or move right as prompted until calibration succeeds.',
    false,
    'center',
  )

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
  hideCalibrationCoach()
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

window.addEventListener('message', (event) => {
  if (!TRUSTED_APP_ORIGINS.has(event.origin) || !event.data || typeof event.data !== 'object') {
    return
  }

  const message = event.data
  if (message.source !== 'fitperks-arcade-tv' || message.type !== 'calibration') {
    return
  }

  if (message.status === 'waiting' || message.status === 'idle') {
    const prompt = typeof message.prompt === 'string' && message.prompt.trim()
      ? message.prompt.trim()
      : 'Open the phone controller and enter this TV code.'
    showCalibrationCoach('Waiting for phone camera', prompt, false, 'center')
    statusEl.textContent = prompt
    return
  }

  if (message.status === 'paired') {
    showCalibrationCoach(
      'Phone paired. Find the hologram.',
      'Stand where the phone camera can see your full body. Follow move back, move front, move left, or move right prompts.',
      false,
      'center',
    )
    statusEl.textContent = 'Phone paired. Calibrate in front of the TV.'
    return
  }

  if (message.status === 'ready') {
    showCalibrationCoach('Calibration locked', 'Great. Starting automatically in 3, 2, 1.', true, 'center')
    statusEl.textContent = 'Calibration locked. Starting game.'
    window.setTimeout(hideCalibrationCoach, 1200)
    return
  }

  if (message.status === 'prompt') {
    const prompt = typeof message.prompt === 'string' && message.prompt.trim()
      ? message.prompt.trim()
      : 'Move back, move front, move left, or move right until calibration succeeds.'
    const direction = typeof message.direction === 'string' ? message.direction : directionFromPrompt(prompt)
    showCalibrationCoach('Adjust your position', prompt, false, direction)
    statusEl.textContent = prompt
  }
})

restore()
