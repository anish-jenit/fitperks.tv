const form = document.getElementById('launch-form')
const baseUrlInput = document.getElementById('baseUrl')
const tvCodeInput = document.getElementById('tvCode')
const gameInput = document.getElementById('game')
const frame = document.getElementById('arcadeFrame')
const statusEl = document.getElementById('status')
const homeBtn = document.getElementById('homeBtn')
const setupView = document.getElementById('setupView')
const gameView = document.getElementById('gameView')
const sessionBadge = document.getElementById('sessionBadge')

const FIXED_BASE_URL = 'https://fitperks.ai'
const INITIAL_SEARCH_PARAMS = new URLSearchParams(window.location.search)

function normalizeCode(value) {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4)
}

function normalizeBaseUrl(value) {
  try {
    return new URL(value || FIXED_BASE_URL).origin
  } catch {
    return FIXED_BASE_URL
  }
}

function buildTargetUrl(baseUrl, game, code) {
  const path = game === 'pose-wall' ? '/play/pose-wall' : '/tv'
  const url = new URL(path, baseUrl)

  if (game === 'pose-wall') {
    url.searchParams.set('tv', '1')
  }

  url.searchParams.set('code', code)
  return url.toString()
}

function showSetup() {
  setupView.hidden = false
  gameView.hidden = true
  homeBtn.hidden = true
  sessionBadge.hidden = true
  frame.removeAttribute('src')
  sessionBadge.textContent = 'ID ----'
  statusEl.textContent = 'Waiting for Game ID.'
  window.history.replaceState(null, '', './')
}

function showGame(code, game = 'dodge-runner') {
  const normalizedCode = normalizeCode(code)
  if (normalizedCode.length !== 4) {
    setupView.hidden = false
    gameView.hidden = true
    homeBtn.hidden = true
    sessionBadge.hidden = true
    statusEl.textContent = 'Enter a valid 4-character Game ID.'
    return
  }

  const baseUrl = normalizeBaseUrl(baseUrlInput.value || FIXED_BASE_URL)
  const targetUrl = buildTargetUrl(baseUrl, game, normalizedCode)

  tvCodeInput.value = normalizedCode
  setupView.hidden = true
  gameView.hidden = false
  homeBtn.hidden = false
  sessionBadge.hidden = false
  sessionBadge.textContent = `ID ${normalizedCode}`
  frame.src = targetUrl
  window.history.replaceState(null, '', `./?code=${encodeURIComponent(normalizedCode)}`)
}

form.addEventListener('submit', (event) => {
  event.preventDefault()
  const code = normalizeCode(tvCodeInput.value)
  const game = gameInput.value || 'dodge-runner'
  showGame(code, game)
})

tvCodeInput.addEventListener('input', () => {
  tvCodeInput.value = normalizeCode(tvCodeInput.value)
  statusEl.textContent = tvCodeInput.value.length === 4 ? 'Ready to play on TV.' : 'Enter the 4-character Game ID.'
})

homeBtn.addEventListener('click', showSetup)

const initialCode = normalizeCode(INITIAL_SEARCH_PARAMS.get('code') || '')
if (initialCode.length === 4) {
  showGame(initialCode)
} else {
  showSetup()
}
