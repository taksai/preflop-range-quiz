import { useCallback, useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import './App.css'

type RawHandRecord = {
  Hand: string
  Color: string
  Players: string
  misses: string
}

type HandRecord = {
  Hand: string
  Color: string
  Players: number
  misses: number
  lastMissedAt?: string
}

type ProgressStore = {
  totalMisses: number
  perHand: Record<
    string,
    {
      misses: number
      lastMissedAt?: string
    }
  >
}

type AnswerStatus = 'idle' | 'correct' | 'incorrect'

const PLAYER_OPTIONS = [0, 1, 2, 3, 5, 7, 8, 9, 10]
const PLAYER_COLOR_LABEL_MAP: Record<number, string> = {
  0: 'グレー',
  1: 'ピンク',
  2: '紫',
  3: '白',
  5: '水色',
  7: '緑',
  8: 'オレンジ',
  9: '赤',
  10: '紺',
}
const LOCAL_STORAGE_KEY = 'preflop-range-progress'
const HAND_RANGE_PATH = `${import.meta.env.BASE_URL}hand_range.csv`

const DEFAULT_PROGRESS: ProgressStore = {
  totalMisses: 0,
  perHand: {},
}

const COLOR_THEME: Record<
  string,
  {
    background: string
    text: string
  }
> = {
  紺: { background: '#1c2a59', text: '#f7faff' },
  赤: { background: '#d7263d', text: '#fff5f7' },
  緑: { background: '#2ca58d', text: '#f2fffb' },
  オレンジ: { background: '#f25f29', text: '#fff8f0' },
  白: { background: '#f5f5f5', text: '#1f2933' },
  水色: { background: '#33a0ff', text: '#f0f9ff' },
  紫: { background: '#8a4fff', text: '#f9f5ff' },
  ピンク: { background: '#ff6bb5', text: '#fff5f8' },
  グレー: { background: '#9aa0a6', text: '#1f1f1f' },
  default: { background: '#0ea5e9', text: '#f0f9ff' },
}

const parseNumber = (value: string, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const ensureMinimumMisses = (misses: number) => Math.max(1, misses)

const getColorTheme = (colorLabel: string) =>
  COLOR_THEME[colorLabel] ?? COLOR_THEME.default

const loadProgressFromStorage = (): ProgressStore => {
  if (typeof window === 'undefined') {
    return DEFAULT_PROGRESS
  }

  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
  if (!raw) {
    return DEFAULT_PROGRESS
  }

  try {
    const parsed = JSON.parse(raw) as ProgressStore
    return {
      totalMisses: parsed.totalMisses ?? 0,
      perHand: parsed.perHand ?? {},
    }
  } catch (error) {
    console.warn('Failed to parse progress. Resetting…', error)
    return DEFAULT_PROGRESS
  }
}

const persistProgress = (progress: ProgressStore) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(progress))
}

const pickWeightedHand = (hands: HandRecord[]): HandRecord | null => {
  if (!hands.length) return null
  const totalWeight = hands.reduce(
    (sum, hand) => sum + ensureMinimumMisses(hand.misses),
    0,
  )
  let threshold = Math.random() * totalWeight

  for (const hand of hands) {
    threshold -= ensureMinimumMisses(hand.misses)
    if (threshold <= 0) {
      return hand
    }
  }

  return hands[hands.length - 1] ?? null
}

function App() {
  const [hands, setHands] = useState<HandRecord[]>([])
  const [currentHand, setCurrentHand] = useState<HandRecord | null>(null)
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>('idle')
  const [selectedValue, setSelectedValue] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [_progress, setProgress] = useState<ProgressStore>(DEFAULT_PROGRESS)

  const updateProgress = useCallback((updater: (prev: ProgressStore) => ProgressStore) => {
    setProgress((prev) => {
      const next = updater(prev)
      persistProgress(next)
      return next
    })
  }, [])

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const response = await fetch(HAND_RANGE_PATH)
        if (!response.ok) {
          throw new Error('CSVの取得に失敗しました')
        }

        const csvText = await response.text()
        const parsed = Papa.parse<RawHandRecord>(csvText, {
          header: true,
          skipEmptyLines: true,
        })

        if (parsed.errors.length) {
          console.error(parsed.errors)
          throw new Error('CSVのパースに失敗しました')
        }

        const storedProgress = loadProgressFromStorage()
        setProgress(storedProgress)

        const normalizedHands = parsed.data
          .filter((row: RawHandRecord | undefined | null): row is RawHandRecord =>
            Boolean(row?.Hand),
          )
          .map((row: RawHandRecord) => {
            const base: HandRecord = {
              Hand: row.Hand.trim(),
              Color: row.Color.trim(),
              Players: parseNumber(row.Players, 0),
              misses: ensureMinimumMisses(parseNumber(row.misses, 1)),
            }
            const saved = storedProgress.perHand[base.Hand]
            return {
              ...base,
              misses: saved?.misses ?? base.misses,
              lastMissedAt: saved?.lastMissedAt,
            }
          })

        setHands(normalizedHands)
        setCurrentHand(pickWeightedHand(normalizedHands))
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'データの読み込みに失敗しました'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    bootstrap()
  }, [])

  useEffect(() => {
    if (!hands.length || currentHand) return
    setCurrentHand(pickWeightedHand(hands))
  }, [hands, currentHand])

  const playerRows = useMemo(() => {
    const midpoint = Math.ceil(PLAYER_OPTIONS.length / 2)
    return [
      PLAYER_OPTIONS.slice(0, midpoint),
      PLAYER_OPTIONS.slice(midpoint),
    ]
  }, [])

  const handleAnswer = (value: number) => {
    if (!currentHand || answerStatus !== 'idle') return
    setSelectedValue(value)
    const isCorrect = value === currentHand.Players
    setAnswerStatus(isCorrect ? 'correct' : 'incorrect')

    if (!isCorrect) {
      const timestamp = new Date().toISOString()
      const incrementedMisses = currentHand.misses + 1

      setHands((prev) =>
        prev.map((hand) =>
          hand.Hand === currentHand.Hand
            ? { ...hand, misses: incrementedMisses, lastMissedAt: timestamp }
            : hand,
        ),
      )
      setCurrentHand((prev) =>
        prev
          ? { ...prev, misses: incrementedMisses, lastMissedAt: timestamp }
          : prev,
      )

      updateProgress((prev) => ({
        totalMisses: prev.totalMisses + 1,
        perHand: {
          ...prev.perHand,
          [currentHand.Hand]: {
            misses: incrementedMisses,
            lastMissedAt: timestamp,
          },
        },
      }))
    }
  }

  const handleNext = () => {
    if (!hands.length) return
    setAnswerStatus('idle')
    setSelectedValue(null)
    setCurrentHand(pickWeightedHand(hands))
  }

  if (loading) {
    return (
      <div className="app-shell">
        <header>
          <p className="tagline">Preflop Range Quiz</p>
        </header>
        <main className="panel">
          <p>読み込み中...</p>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-shell">
        <header>
          <p className="tagline">Preflop Range Quiz</p>
        </header>
        <main className="panel error">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>リロードする</button>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header>
        <p className="tagline">Preflop Range Quiz</p>
      </header>

      <main className="quiz-card">
        <section className="hand-card">
          <span className="hand-label">Hand</span>
          <p className="hand-value">{currentHand?.Hand ?? '--'}</p>
        </section>

        <section>
          <h2>Players を選択</h2>
          <div className="player-rows">
            {playerRows.map((rowValues, rowIndex) => (
              <div className="player-row" key={`row-${rowIndex}`}>
                {rowValues.map((value) => {
                  const buttonTheme = getColorTheme(
                    PLAYER_COLOR_LABEL_MAP[value] ?? 'default',
                  )
                  return (
                    <button
                      key={value}
                      className={[
                        'answer-button',
                        selectedValue === value ? 'answer-button--selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{
                        backgroundColor: buttonTheme.background,
                        color: buttonTheme.text,
                      }}
                      disabled={!currentHand || answerStatus !== 'idle'}
                      onClick={() => handleAnswer(value)}
                    >
                      {value}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </section>

        {answerStatus !== 'idle' && currentHand && (
          <div className={`result-banner ${answerStatus}`}>
            <strong>
              {answerStatus === 'correct' ? '正解！' : '不正解…'}
            </strong>
            <p>
              正解は <span>{currentHand.Players}</span> Players /{' '}
              <span>{currentHand.Color}</span>
            </p>
          </div>
        )}

        <button
          className="next-button"
          onClick={handleNext}
          disabled={answerStatus === 'idle'}
        >
          次のハンドへ
        </button>
      </main>
    </div>
  )
}

export default App
