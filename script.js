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
const coachAvatar = document.querySelector('.coach-runner-avatar')
const directLaunchWrap = document.getElementById('directLaunchWrap')
const directLaunchLink = document.getElementById('directLaunchLink')
const FIXED_BASE_URL = 'https://fitperks.ai'
const DEBUG_MODE = new URLSearchParams(window.location.search).get('debug') === '1'

if (coachAvatar instanceof HTMLImageElement) {
  coachAvatar.addEventListener('error', () => {
    const fallbackSrc = coachAvatar.dataset.fallbackSrc
    if (fallbackSrc && coachAvatar.src !== fallbackSrc && !coachAvatar.dataset.fallbackAttempted) {
      coachAvatar.dataset.fallbackAttempted = 'true'
      coachAvatar.src = fallbackSrc
    }
  })
}

const TRUSTED_APP_ORIGINS = new Set([
  'https://fitperks.ai',
  'https://www.fitperks.ai',
  'https://fitperks.org',
  'https://www.fitperks.org',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

let lastCoachCue = ''
let launchedGame = ''

function appOwnsCalibration() {
  return launchedGame === 'dodge-runner'
}

function playCoachCue(cue) {
  const AudioCtor = window.AudioContext || window.webkitAudioContext
  if (!AudioCtor) {
    return
  }

  const context = new AudioCtor()
  const gain = context.createGain()
  const now = context.currentTime
  const notes = cue === 'ready'
    ? [
        { frequency: 523.25, start: 0, duration: 0.11 },
        { frequency: 659.25, start: 0.13, duration: 0.16 },
      ]
    : [
        { frequency: 392, start: 0, duration: 0.13 },
        { frequency: 261.63, start: 0.15, duration: 0.22 },
      ]
  const endAt = notes.reduce((end, note) => Math.max(end, note.start + note.duration), 0)

  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(cue === 'ready' ? 0.11 : 0.09, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + endAt + 0.12)
  gain.connect(context.destination)

  notes.forEach((note, index) => {
    const oscillator = context.createOscillator()
    const noteGain = context.createGain()
    const startAt = now + note.start
    const stopAt = startAt + note.duration
    oscillator.type = cue === 'ready' ? (index === 0 ? 'sine' : 'triangle') : 'sawtooth'
    oscillator.frequency.setValueAtTime(note.frequency, startAt)
    noteGain.gain.setValueAtTime(0.0001, startAt)
    noteGain.gain.exponentialRampToValueAtTime(0.62, startAt + 0.015)
    noteGain.gain.exponentialRampToValueAtTime(0.0001, stopAt)
    oscillator.connect(noteGain)
    noteGain.connect(gain)
    oscillator.start(startAt)
    oscillator.stop(stopAt + 0.02)
  })

  context.resume().catch(() => undefined)
  window.setTimeout(() => {
    gain.disconnect()
    context.close()
  }, (endAt + 0.28) * 1000)
}

function playCoachCueOnce(cue) {
  if (lastCoachCue === cue) {
    return
  }

  lastCoachCue = cue
  playCoachCue(cue)
}

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
    if (DEBUG_MODE) {
      url.searchParams.set('debug', '1')
    }
    return url.toString()
  }

  const url = new URL('/play/pose-wall', baseUrl)
  url.searchParams.set('tv', '1')
  url.searchParams.set('code', code)
  if (DEBUG_MODE) {
    url.searchParams.set('debug', '1')
  }
  return url.toString()
}

function updateDirectLaunchLink() {
  const code = normalizeCode(tvCodeInput.value)
  const game = gameSelect.value
  const baseUrl = normalizeBaseUrl(FIXED_BASE_URL)
  if (!baseUrl || code.length !== 4 || !(directLaunchLink instanceof HTMLAnchorElement)) {
    if (directLaunchWrap) {
      directLaunchWrap.hidden = true
    }
    return ''
  }

  const url = buildTargetUrl(baseUrl, game, code)
  directLaunchLink.href = url
  directLaunchLink.textContent = url
  if (directLaunchWrap) {
    directLaunchWrap.hidden = false
  }
  return url
}

function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Some TV browsers disable storage; launching should still work.
  }
}

function safeLocalStorageGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function showCalibrationCoach(title, prompt, isReady = false, direction = 'center') {
  if (appOwnsCalibration()) {
    hideCalibrationCoach()
    return
  }

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
  launchedGame = game
  const url = buildTargetUrl(baseUrl, game, code)
  lastCoachCue = ''
  frame.removeAttribute('src')
  stageTitle.textContent = `${game === 'dodge-runner' ? 'Dodge Runner' : 'Pose Wall'} - Code ${code}`
  statusEl.textContent = `Opening ${game === 'dodge-runner' ? 'Dodge Runner' : 'Pose Wall'} directly on this TV...`
  if (DEBUG_MODE) {
    statusEl.textContent += ' Debug mode is enabled.'
  }
  hideCalibrationCoach()

  safeLocalStorageSet('fitperks.tv.lastCode', code)
  safeLocalStorageSet('fitperks.tv.lastGame', game)

  if (directLaunchLink instanceof HTMLAnchorElement) {
    directLaunchLink.href = url
    directLaunchLink.textContent = url
  }
  if (directLaunchWrap) {
    directLaunchWrap.hidden = false
  }

  window.location.href = url
}

function restore() {
  const savedCode = safeLocalStorageGet('fitperks.tv.lastCode')
  const savedGame = safeLocalStorageGet('fitperks.tv.lastGame')

  baseUrlInput.value = FIXED_BASE_URL
  if (savedCode) {
    tvCodeInput.value = normalizeCode(savedCode)
  }
  if (savedGame === 'dodge-runner' || savedGame === 'pose-wall') {
    gameSelect.value = savedGame
  }
  updateDirectLaunchLink()
}

form.addEventListener('submit', (event) => {
  event.preventDefault()
  launch()
})

tvCodeInput.addEventListener('input', () => {
  tvCodeInput.value = normalizeCode(tvCodeInput.value)
  updateDirectLaunchLink()
})

gameSelect.addEventListener('change', () => {
  updateDirectLaunchLink()
})

clearBtn.addEventListener('click', () => {
  lastCoachCue = ''
  tvCodeInput.value = ''
  launchedGame = ''
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
    lastCoachCue = ''
    const prompt = typeof message.prompt === 'string' && message.prompt.trim()
      ? message.prompt.trim()
      : 'Open the phone controller and enter this TV code.'
    showCalibrationCoach('Waiting for phone camera', prompt, false, 'center')
    statusEl.textContent = prompt
    return
  }

  if (message.status === 'paired') {
    lastCoachCue = ''
    showCalibrationCoach(
      'Phone paired. Find the hologram.',
      'Stand where the phone camera can see your full body. Follow move back, move front, move left, or move right prompts.',
      false,
      'center',
    )
    statusEl.textContent = 'Phone paired. Calibrate in front of the TV.'
    return
  }

  if (message.status === 'disconnected') {
    const prompt = typeof message.prompt === 'string' && message.prompt.trim()
      ? message.prompt.trim()
      : 'Tracking paused. Reconnect, then recalibrate.'
    const direction = typeof message.direction === 'string' ? message.direction : directionFromPrompt(prompt)
    playCoachCueOnce('disconnected')
    showCalibrationCoach('Tracking paused', prompt, false, direction)
    statusEl.textContent = prompt
    return
  }

  if (message.status === 'ready') {
    playCoachCueOnce('ready')
    showCalibrationCoach('Calibration locked', 'Great. Starting automatically in 3, 2, 1.', true, 'center')
    statusEl.textContent = 'Calibration locked. Starting game.'
    window.setTimeout(hideCalibrationCoach, 1200)
    return
  }

  if (message.status === 'prompt') {
    lastCoachCue = ''
    const prompt = typeof message.prompt === 'string' && message.prompt.trim()
      ? message.prompt.trim()
      : 'Move back, move front, move left, or move right until calibration succeeds.'
    const direction = typeof message.direction === 'string' ? message.direction : directionFromPrompt(prompt)
    showCalibrationCoach('Adjust your position', prompt, false, direction)
    statusEl.textContent = prompt
  }
})

restore()
