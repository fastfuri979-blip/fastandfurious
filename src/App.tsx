import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type {
  AlienPhase,
  BossAttack,
  Equipment,
  WorldEffect,
} from './game/TrainingWorld'
import './App.css'

const TrainingWorld = lazy(() => import('./game/TrainingWorld'))
type Lane = 'left' | 'center' | 'right'
type Motion = 'running' | 'jumping' | 'sliding'
type ObjectKind = 'energy' | 'oxygen' | 'hurdle' | 'beam'

interface TrainingObject {
  id: number
  kind: ObjectKind
  lane: Lane
  distance: number
}

interface GameSimulation {
  distance: number
  score: number
  laneIndex: number
  jumpHeight: number
  verticalVelocity: number
  slideRemaining: number
  boostEnergy: number
  boostEnabled: boolean
  cameraX: number
  lastFrame: number
  nextHudUpdate: number
  nextObjectDistance: number
  nextObjectId: number
  oxygen: number
  energyCells: number
  oxygenTanks: number
  collisions: number
  objects: TrainingObject[]
  health: number
  equipment: Equipment
  shieldRemaining: number
  effectId: number
  effect: WorldEffect
  enemyActive: boolean
  enemyHealth: number
  enemyDistance: number
  enemyLaneIndex: number
  enemyPhase: AlienPhase
  enemyAttackTimer: number
  enemyChaseTimer: number
  enemyStunRemaining: number
  arenaActive: boolean
  bossHealth: number
  bossPhase: number
  bossAttack: BossAttack
  bossAttackPattern: 'beam' | 'slam' | 'charge' | null
  bossAttackLane: number
  bossAttackTimer: number
  bossPatternIndex: number
  bossScanProgress: number
  bossWeakRemaining: number
  bossComplete: boolean
  gameOver: boolean
}

interface AlienHudState {
  active: boolean
  lane: number
  remaining: number
  health: number
  phase: AlienPhase
}

interface BossHudState {
  active: boolean
  health: number
  phase: number
  scanProgress: number
  attack: BossAttack
  attackPattern: 'beam' | 'slam' | 'charge' | null
  attackLane: number
  weakPoint: boolean
  victory: boolean
}

const laneNames: Lane[] = ['left', 'center', 'right']
const laneObjectPositions: Record<Lane, number> = { left: 19, center: 50, right: 77 }
const objectPattern: Array<{ kind: ObjectKind; lane: Lane }> = [
  { kind: 'hurdle', lane: 'left' },
  { kind: 'energy', lane: 'center' },
  { kind: 'oxygen', lane: 'right' },
  { kind: 'beam', lane: 'center' },
  { kind: 'energy', lane: 'right' },
  { kind: 'hurdle', lane: 'center' },
  { kind: 'oxygen', lane: 'left' },
  { kind: 'beam', lane: 'right' },
]

function createGameSimulation(): GameSimulation {
  return {
    distance: 0,
    score: 0,
    laneIndex: 1,
    jumpHeight: 0,
    verticalVelocity: 0,
    slideRemaining: 0,
    boostEnergy: 100,
    boostEnabled: false,
    cameraX: 0,
    lastFrame: 0,
    nextHudUpdate: 0,
    nextObjectDistance: 118,
    nextObjectId: 8,
    oxygen: 100,
    energyCells: 0,
    oxygenTanks: 0,
    collisions: 0,
    health: 100,
    equipment: 'gadget',
    shieldRemaining: 0,
    effectId: 0,
    effect: null,
    enemyActive: true,
    enemyHealth: 60,
    enemyDistance: 56,
    enemyLaneIndex: 0,
    enemyPhase: 'patrol',
    enemyAttackTimer: 0.9,
    enemyChaseTimer: 0,
    enemyStunRemaining: 0,
    arenaActive: false,
    bossHealth: 120,
    bossPhase: 1,
    bossAttack: 'idle',
    bossAttackPattern: null,
    bossAttackLane: 1,
    bossAttackTimer: 2,
    bossPatternIndex: 0,
    bossScanProgress: 0,
    bossWeakRemaining: 0,
    bossComplete: false,
    gameOver: false,
    objects: [
      { id: 1, kind: 'energy', lane: 'center', distance: 12 },
      { id: 2, kind: 'oxygen', lane: 'right', distance: 26 },
      { id: 3, kind: 'hurdle', lane: 'left', distance: 42 },
      { id: 4, kind: 'beam', lane: 'center', distance: 58 },
      { id: 5, kind: 'energy', lane: 'right', distance: 74 },
      { id: 6, kind: 'oxygen', lane: 'center', distance: 90 },
      { id: 7, kind: 'hurdle', lane: 'left', distance: 104 },
    ],
  }
}

const menuItems = [
  'NEW GAME',
  'CONTINUE',
  'MISSION SELECT',
  'SPACECRAFT DESIGN',
  'MULTIPLAYER',
  'SANDBOX',
  'ACHIEVEMENTS',
  'SETTINGS',
]

const missions = [
  {
    title: 'EARTH: THE BEGINNING',
    planet: 'Terra',
    difficulty: 'Training',
    status: 'Unlocked',
    objective: 'Train under mission control, assemble a launch-ready craft, and survive the first orbital ascent.',
    objectives: ['Zero-g shuttle run', 'Energy cell recovery', 'Launch brief readiness'],
  },
  {
    title: 'ROCKET LAUNCH',
    planet: 'Low Earth Orbit',
    difficulty: 'Critical',
    status: 'Ready',
    objective: 'Checkpoint launch systems, survive ascent, and separate stages cleanly before orbital insertion.',
    objectives: ['Propellant calibration', 'Engine ignition', 'Stage separation'],
  },
  {
    title: 'MOON: LOST RESEARCH STATION',
    planet: 'Luna',
    difficulty: 'Low Gravity',
    status: 'Scanning',
    objective: 'Recover the missing rover, restore signal relay, and decrypt lunar geology data.',
    objectives: ['Rover track recovery', 'Signal relay', 'Sample collection'],
  },
  {
    title: 'MARS: THE UNKNOWN SIGNAL',
    planet: 'Ares',
    difficulty: 'Hostile',
    status: 'Investigating',
    objective: 'Trace the mysterious signal through canyon dust, storm fronts, and alien anomalies.',
    objectives: ['Soil scans', 'Signal triangulation', 'Anomaly map'],
  },
]

const statCards = [
  { label: 'Crew', value: '04' },
  { label: 'Signal', value: '92%' },
  { label: 'Oxygen', value: '76%' },
  { label: 'Integrity', value: 'A+' },
]

const systemStatus = ['Launch Systems Online', 'Thermal Shield Stable', 'Crew Comms Clear']

function App() {
  const [selectedMission, setSelectedMission] = useState(missions[0])
  const [runnerLane, setRunnerLane] = useState<'left' | 'center' | 'right'>('center')
  const [boost, setBoost] = useState(76)
  const [gameStarted, setGameStarted] = useState(false)
  const [astronautLane, setAstronautLane] = useState<Lane>('center')
  const [astronautMotion, setAstronautMotion] = useState<Motion>('running')
  const [astronautHeight, setAstronautHeight] = useState(0)
  const [trainingScore, setTrainingScore] = useState(0)
  const [energyCells, setEnergyCells] = useState(0)
  const [oxygenTanks, setOxygenTanks] = useState(0)
  const [oxygen, setOxygen] = useState(100)
  const [boostEnergy, setBoostEnergy] = useState(100)
  const [boostEnabled, setBoostEnabled] = useState(false)
  const [sprinting, setSprinting] = useState(false)
  const [currentSpeed, setCurrentSpeed] = useState(9)
  const [travelDistance, setTravelDistance] = useState(0)
  const [cameraX, setCameraX] = useState(0)
  const [collisions, setCollisions] = useState(0)
  const [trainingObjects, setTrainingObjects] = useState<TrainingObject[]>([])
  const [trainingMessage, setTrainingMessage] = useState('Training simulation ready')
  const [playerHealth, setPlayerHealth] = useState(100)
  const [gameOver, setGameOver] = useState(false)
  const [bossScanProgress, setBossScanProgress] = useState(0)
  const [equipment, setEquipment] = useState<Equipment>('gadget')
  const [shieldActive, setShieldActive] = useState(false)
  const [worldEffect, setWorldEffect] = useState<WorldEffect>(null)
  const [alienState, setAlienState] = useState<AlienHudState>({
    active: true,
    lane: 0,
    remaining: 56,
    health: 60,
    phase: 'patrol',
  })
  const [bossState, setBossState] = useState<BossHudState>({
    active: false,
    health: 120,
    phase: 1,
    scanProgress: 0,
    attack: 'idle',
    attackPattern: null,
    attackLane: 1,
    weakPoint: false,
    victory: false,
  })
  const [worldError, setWorldError] = useState('')
  const simulationRef = useRef<GameSimulation>(createGameSimulation())
  const pressedKeysRef = useRef(new Set<string>())

  const toggleBoost = () => {
    setBoost((value) => (value >= 100 ? 68 : Math.min(value + 18, 100)))
  }

  const moveToLane = useCallback((lane: Lane) => {
    const sim = simulationRef.current
    sim.laneIndex = laneNames.indexOf(lane)
    setAstronautLane(lane)
  }, [])

  const moveLaneBy = useCallback((direction: -1 | 1) => {
    const sim = simulationRef.current
    const nextLaneIndex = Math.max(0, Math.min(laneNames.length - 1, sim.laneIndex + direction))
    sim.laneIndex = nextLaneIndex
    setAstronautLane(laneNames[nextLaneIndex])
  }, [])

  const jump = useCallback(() => {
    const sim = simulationRef.current
    if (sim.jumpHeight > 0 || sim.slideRemaining > 0) return
    sim.verticalVelocity = 520
    setAstronautMotion('jumping')
  }, [])

  const slide = useCallback(() => {
    const sim = simulationRef.current
    if (sim.jumpHeight > 0) return
    sim.slideRemaining = 0.82
    setAstronautMotion('sliding')
  }, [])

  const toggleSprint = useCallback(() => {
    const keys = pressedKeysRef.current
    if (keys.has('shift')) {
      keys.delete('shift')
      setSprinting(false)
    } else {
      keys.add('shift')
      setSprinting(true)
    }
  }, [])

  const toggleGameBoost = useCallback(() => {
    const sim = simulationRef.current
    if (sim.boostEnergy <= 0) return
    sim.boostEnabled = !sim.boostEnabled
    setBoostEnabled(sim.boostEnabled)
  }, [])

  const selectEquipment = useCallback((nextEquipment: Equipment) => {
    simulationRef.current.equipment = nextEquipment
    setEquipment(nextEquipment)
    setTrainingMessage(`${nextEquipment === 'gadget' ? 'Energy gadget' : nextEquipment === 'scanner' ? 'Scientific scanner' : 'Energy shield'} selected`)
  }, [])

  const activateEquipment = useCallback(() => {
    const sim = simulationRef.current
    if (sim.gameOver) return

    if (sim.equipment === 'shield') {
      sim.shieldRemaining = 3
      setShieldActive(true)
      setTrainingMessage('Defensive shield active - 3 seconds')
      return
    }

    sim.effectId += 1
    sim.effect = { id: sim.effectId, kind: sim.equipment === 'gadget' ? 'fire' : 'scan' }
    setWorldEffect(sim.effect)

    if (sim.equipment === 'scanner') {
      if (sim.arenaActive && !sim.bossComplete) {
        sim.bossScanProgress = Math.min(100, sim.bossScanProgress + 40)
        if (sim.bossScanProgress >= 100) {
          sim.bossWeakRemaining = 7
          setTrainingMessage('Titan Guardian weak points scanned - core exposed')
        } else {
          setTrainingMessage(`Titan weak-point scan ${Math.ceil(sim.bossScanProgress / 40)} of 3`)
        }
        setBossScanProgress(sim.bossScanProgress)
      } else if (sim.enemyActive && sim.enemyDistance - sim.distance <= 38) {
        sim.enemyPhase = 'stunned'
        sim.enemyStunRemaining = 1.4
        setTrainingMessage('Alien scan complete - target stunned')
      } else {
        setTrainingMessage('Terrain scan pulse emitted')
      }
      return
    }

    if (sim.arenaActive && !sim.bossComplete) {
      const damage = sim.bossWeakRemaining > 0 ? 32 : 16
      sim.bossHealth = Math.max(0, sim.bossHealth - damage)
      sim.bossPhase = sim.bossHealth > 80 ? 1 : sim.bossHealth > 40 ? 2 : 3
      if (sim.bossHealth === 0) {
        sim.bossComplete = true
        sim.bossAttack = 'idle'
        setTrainingMessage('Titan Guardian defeated - encounter complete')
      } else {
        setTrainingMessage(`Energy bolt hit guardian - ${damage} damage`)
      }
    } else if (
      sim.enemyActive &&
      sim.enemyDistance - sim.distance <= 42 &&
      sim.enemyDistance > sim.distance &&
      sim.enemyLaneIndex === sim.laneIndex
    ) {
      sim.enemyHealth = Math.max(0, sim.enemyHealth - 30)
      sim.enemyStunRemaining = 0.9
      sim.enemyPhase = sim.enemyHealth === 0 ? 'defeated' : 'stunned'
      if (sim.enemyHealth === 0) {
        sim.enemyActive = false
        setTrainingMessage('Alien defeated - encounter complete')
      } else {
        setTrainingMessage(`Energy bolt hit alien - ${sim.enemyHealth} health remaining`)
      }
    } else {
      setTrainingMessage('Energy bolt discharged - no target in range')
    }
  }, [])

  const enterBossArena = useCallback(() => {
    const sim = simulationRef.current
    if (sim.gameOver) return
    sim.arenaActive = true
    sim.bossHealth = 120
    sim.bossPhase = 1
    sim.bossAttack = 'idle'
    sim.bossAttackPattern = null
    sim.bossAttackLane = 1
    sim.bossAttackTimer = 1.6
    sim.bossPatternIndex = 0
    sim.bossScanProgress = 0
    sim.bossWeakRemaining = 0
    sim.bossComplete = false
    setBossScanProgress(0)
    setBossState({
      active: true,
      health: 120,
      phase: 1,
      scanProgress: 0,
      attack: 'idle',
      attackPattern: null,
      attackLane: 1,
      weakPoint: false,
      victory: false,
    })
    setTrainingMessage('Titan Guardian arena active - scan its weak points and survive the attack warnings')
  }, [])

  const exitBossArena = useCallback(() => {
    const sim = simulationRef.current
    sim.arenaActive = false
    sim.bossAttack = 'idle'
    sim.bossAttackPattern = null
    sim.bossComplete = false
    setBossState((current) => ({
      ...current,
      active: false,
      attack: 'idle',
      attackPattern: null,
      victory: false,
    }))
    setTrainingMessage('Returned to Earth training course')
  }, [])

  const handleWorldError = useCallback((message: string) => {
    setWorldError(message)
  }, [])

  const startNewGame = () => {
    const sim = createGameSimulation()
    simulationRef.current = sim
    pressedKeysRef.current.clear()
    setSelectedMission(missions[0])
    setRunnerLane('center')
    setBoost(76)
    setAstronautLane('center')
    setAstronautMotion('running')
    setAstronautHeight(0)
    setTrainingScore(0)
    setEnergyCells(0)
    setOxygenTanks(0)
    setOxygen(100)
    setBoostEnergy(100)
    setBoostEnabled(false)
    setSprinting(false)
    setCurrentSpeed(9)
    setTravelDistance(0)
    setCameraX(0)
    setCollisions(0)
    setTrainingObjects(sim.objects)
    setTrainingMessage('Training simulation ready')
    setPlayerHealth(100)
    setGameOver(false)
    setBossScanProgress(0)
    setEquipment('gadget')
    setShieldActive(false)
    setWorldEffect(null)
    setAlienState({ active: true, lane: 0, remaining: 56, health: 60, phase: 'patrol' })
    setBossState({
      active: false,
      health: 120,
      phase: 1,
      scanProgress: 0,
      attack: 'idle',
      attackPattern: null,
      attackLane: 1,
      weakPoint: false,
      victory: false,
    })
    setWorldError('')
    setGameStarted(true)
  }

  useEffect(() => {
    if (!gameStarted) return
    const pressedKeys = pressedKeysRef.current

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const keys = pressedKeys
      if (['arrowleft', 'arrowright', ' ', 'arrowup', 'arrowdown'].includes(key)) {
        event.preventDefault()
      }
      if (event.repeat || keys.has(key)) return
      keys.add(key)

      if (key === 'arrowleft' || key === 'a') {
        moveLaneBy(-1)
      } else if (key === 'arrowright' || key === 'd') {
        moveLaneBy(1)
      } else if (key === ' ' || key === 'arrowup' || key === 'w') {
        jump()
      } else if (key === 'arrowdown' || key === 's') {
        slide()
      } else if (key === 'shift') {
        setSprinting(true)
      } else if (key === 'b') {
        toggleGameBoost()
      } else if (key === '1') {
        selectEquipment('gadget')
      } else if (key === '2') {
        selectEquipment('scanner')
      } else if (key === '3') {
        selectEquipment('shield')
      } else if (key === 'f') {
        activateEquipment()
      } else if (key === 'escape') {
        keys.clear()
        if (simulationRef.current.arenaActive) exitBossArena()
        else setGameStarted(false)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      pressedKeys.delete(key)
      if (key === 'shift') setSprinting(false)
    }

    const releaseKeys = () => {
      pressedKeys.clear()
      setSprinting(false)
    }

    const damagePlayer = (damage: number, message: string) => {
      const sim = simulationRef.current
      if (sim.shieldRemaining > 0) {
        sim.shieldRemaining = 0
        setShieldActive(false)
        setTrainingMessage('Energy shield absorbed the attack')
        return
      }

      sim.health = Math.max(0, sim.health - damage)
      setPlayerHealth(sim.health)
      setTrainingMessage(message)
      if (sim.health === 0) {
        sim.gameOver = true
        setGameOver(true)
        setTrainingMessage('Suit integrity lost - restart the training mission')
      }
    }

    let frameId = 0
    const animate = (now: number) => {
      const sim = simulationRef.current
      if (sim.lastFrame === 0) sim.lastFrame = now
      const delta = Math.min((now - sim.lastFrame) / 1000, 0.05)
      sim.lastFrame = now
      const previousDistance = sim.distance
      const isSprinting = pressedKeys.has('shift')
      const isBoosting = sim.boostEnabled && sim.boostEnergy > 0
      const isDrivingCourse = !sim.arenaActive && !sim.gameOver
      const speed = isDrivingCourse ? 9 + (isSprinting ? 5 : 0) + (isBoosting ? 8 : 0) : 0
      if (isDrivingCourse) {
        sim.distance += speed * delta
        sim.score += speed * delta * 1.5
      }

      if (sim.jumpHeight > 0 || sim.verticalVelocity > 0) {
        sim.verticalVelocity -= 1350 * delta
        sim.jumpHeight = Math.max(0, sim.jumpHeight + sim.verticalVelocity * delta)
        if (sim.jumpHeight === 0) sim.verticalVelocity = 0
      }
      sim.slideRemaining = Math.max(0, sim.slideRemaining - delta)
      sim.shieldRemaining = Math.max(0, sim.shieldRemaining - delta)
      if (sim.shieldRemaining === 0) setShieldActive(false)

      if (isBoosting) {
        sim.boostEnergy = Math.max(0, sim.boostEnergy - delta * 24)
        if (sim.boostEnergy === 0) {
          sim.boostEnabled = false
          setBoostEnabled(false)
        }
      } else {
        sim.boostEnergy = Math.min(100, sim.boostEnergy + delta * 8)
      }

      while (isDrivingCourse && sim.distance + 48 >= sim.nextObjectDistance) {
        const pattern = objectPattern[(sim.nextObjectId - 8) % objectPattern.length]
        sim.objects.push({
          id: sim.nextObjectId,
          kind: pattern.kind,
          lane: pattern.lane,
          distance: sim.nextObjectDistance,
        })
        sim.nextObjectId += 1
        sim.nextObjectDistance += 18
      }

      if (isDrivingCourse) {
        const remainingObjects: TrainingObject[] = []
        for (const object of sim.objects) {
          if (object.distance > previousDistance && object.distance <= sim.distance) {
            if (object.lane === laneNames[sim.laneIndex]) {
              if (object.kind === 'energy') {
                sim.energyCells += 1
                sim.score += 100
                setEnergyCells(sim.energyCells)
                setTrainingMessage('Energy cell secured - +100 XP')
              } else if (object.kind === 'oxygen') {
                sim.oxygenTanks += 1
                sim.oxygen = Math.min(100, sim.oxygen + 25)
                sim.score += 75
                setOxygenTanks(sim.oxygenTanks)
                setOxygen(sim.oxygen)
                setTrainingMessage('Oxygen tank secured - +75 XP')
              } else {
                const cleared = object.kind === 'hurdle'
                  ? sim.jumpHeight > 36
                  : sim.slideRemaining > 0.08
                if (!cleared) {
                  sim.collisions += 1
                  sim.oxygen = Math.max(0, sim.oxygen - 20)
                  sim.score = Math.max(0, sim.score - 50)
                  setCollisions(sim.collisions)
                  setOxygen(sim.oxygen)
                  damagePlayer(12, `${object.kind === 'hurdle' ? 'Hurdle' : 'Overhead beam'} impact`)
                  if (sim.shieldRemaining > 0) sim.shieldRemaining = 0
                } else {
                  setTrainingMessage(`${object.kind === 'hurdle' ? 'Hurdle cleared' : 'Beam cleared'}`)
                }
              }
            }
            continue
          }
          if (object.distance > sim.distance) remainingObjects.push(object)
        }
        sim.objects = remainingObjects
      }

      const targetCameraX = (sim.laneIndex - 1) * 34
      sim.cameraX += (targetCameraX - sim.cameraX) * Math.min(1, delta * 5)

      if (sim.enemyActive && !sim.arenaActive && !sim.gameOver) {
        const enemyRemaining = sim.enemyDistance - sim.distance
        if (sim.enemyStunRemaining > 0) {
          sim.enemyStunRemaining = Math.max(0, sim.enemyStunRemaining - delta)
          sim.enemyPhase = 'stunned'
        } else if (sim.enemyPhase === 'attack') {
          sim.enemyAttackTimer -= delta
          if (sim.enemyAttackTimer <= 0) {
            sim.enemyDistance = sim.distance + 44
            sim.enemyPhase = 'patrol'
            sim.enemyAttackTimer = 0.8
          }
        } else if (enemyRemaining <= 0) {
          sim.enemyDistance = sim.distance + 44
          sim.enemyPhase = 'patrol'
        } else if (enemyRemaining > 24) {
          sim.enemyPhase = 'patrol'
          sim.enemyLaneIndex = Math.floor(sim.distance / 5) % laneNames.length
        } else if (enemyRemaining > 9) {
          if (sim.enemyPhase !== 'chase') setTrainingMessage('Alien detected - it is closing on your lane')
          sim.enemyPhase = 'chase'
          sim.enemyChaseTimer -= delta
          if (sim.enemyChaseTimer <= 0) {
            if (sim.enemyLaneIndex < sim.laneIndex) sim.enemyLaneIndex += 1
            else if (sim.enemyLaneIndex > sim.laneIndex) sim.enemyLaneIndex -= 1
            sim.enemyChaseTimer = 0.55
          }
        } else if (sim.enemyPhase !== 'windup') {
          sim.enemyPhase = 'windup'
          sim.enemyAttackTimer = 0.95
          setTrainingMessage('Alien attack warning - change lane or activate the shield')
        } else {
          sim.enemyAttackTimer -= delta
          if (sim.enemyAttackTimer <= 0) {
            sim.enemyPhase = 'attack'
            sim.enemyAttackTimer = 0.65
            const avoided = sim.enemyLaneIndex !== sim.laneIndex || sim.jumpHeight > 55 ||
              sim.slideRemaining > 0.08 || sim.shieldRemaining > 0
            if (avoided) {
              if (sim.shieldRemaining > 0) {
                sim.shieldRemaining = 0
                setShieldActive(false)
                setTrainingMessage('Energy shield absorbed the alien strike')
              } else {
                setTrainingMessage('Alien strike evaded')
              }
            } else {
              damagePlayer(18, 'Alien strike - suit integrity -18')
            }
          }
        }
      } else if (sim.enemyStunRemaining > 0) {
        sim.enemyStunRemaining = Math.max(0, sim.enemyStunRemaining - delta)
        if (sim.enemyStunRemaining === 0 && sim.enemyActive) sim.enemyPhase = 'chase'
      }

      if (sim.arenaActive && !sim.bossComplete && !sim.gameOver) {
        sim.bossWeakRemaining = Math.max(0, sim.bossWeakRemaining - delta)
        if (sim.bossAttack === 'idle') {
          sim.bossAttackTimer -= delta
          if (sim.bossAttackTimer <= 0) {
            const patterns = sim.bossPhase === 1
              ? ['beam', 'slam'] as const
              : sim.bossPhase === 2
                ? ['slam', 'beam', 'charge'] as const
                : ['charge', 'slam', 'beam'] as const
            const pattern = patterns[sim.bossPatternIndex % patterns.length]
            sim.bossAttackPattern = pattern
            sim.bossAttackLane = sim.bossPatternIndex % laneNames.length
            sim.bossPatternIndex += 1
            sim.bossAttack = 'windup'
            sim.bossAttackTimer = 1.05
            setTrainingMessage(`Guardian ${pattern} warning - evade or raise the shield`)
          }
        } else if (sim.bossAttack === 'windup') {
          sim.bossAttackTimer -= delta
          if (sim.bossAttackTimer <= 0) {
            const pattern = sim.bossAttackPattern ?? 'beam'
            sim.bossAttack = pattern
            sim.bossAttackTimer = 0.62
            const safeLane = sim.laneIndex !== sim.bossAttackLane
            const avoided = sim.shieldRemaining > 0 ||
              (pattern === 'beam' && safeLane) ||
              (pattern === 'slam' && sim.jumpHeight > 58) ||
              (pattern === 'charge' && (sim.slideRemaining > 0.08 || safeLane))
            if (sim.shieldRemaining > 0) {
              sim.shieldRemaining = 0
              setShieldActive(false)
              setTrainingMessage('Energy shield absorbed the guardian attack')
            } else if (avoided) {
              setTrainingMessage(`Guardian ${pattern} evaded`)
            } else {
              sim.collisions += 1
              setCollisions(sim.collisions)
              damagePlayer(22, `Guardian ${pattern} hit - suit integrity -22`)
            }
          }
        } else {
          sim.bossAttackTimer -= delta
          if (sim.bossAttackTimer <= 0) {
            sim.bossAttack = 'idle'
            sim.bossAttackPattern = null
            sim.bossAttackTimer = Math.max(1.25, 2.7 - sim.bossPhase * 0.4)
          }
        }
      }

      if (now >= sim.nextHudUpdate) {
        setAstronautHeight(sim.jumpHeight)
        setAstronautMotion(sim.jumpHeight > 0 ? 'jumping' : sim.slideRemaining > 0 ? 'sliding' : 'running')
        setTrainingScore(Math.floor(sim.score))
        setTravelDistance(sim.distance)
        setBoostEnergy(sim.boostEnergy)
        setCurrentSpeed(speed)
        setSprinting(isSprinting)
        setCameraX(sim.cameraX)
        setTrainingObjects(sim.objects.filter((object) => object.distance - sim.distance <= 48))
        setPlayerHealth(sim.health)
        setShieldActive(sim.shieldRemaining > 0)
        setAlienState({
          active: sim.enemyActive,
          lane: sim.enemyLaneIndex,
          remaining: sim.enemyDistance - sim.distance,
          health: sim.enemyHealth,
          phase: sim.enemyPhase,
        })
        setBossState({
          active: sim.arenaActive,
          health: sim.bossHealth,
          phase: sim.bossPhase,
          scanProgress: sim.bossScanProgress,
          attack: sim.bossAttack,
          attackPattern: sim.bossAttackPattern,
          attackLane: sim.bossAttackLane,
          weakPoint: sim.bossWeakRemaining > 0,
          victory: sim.bossComplete,
        })
        setBossScanProgress(sim.bossScanProgress)
        setGameOver(sim.gameOver)
        sim.nextHudUpdate = now + 60
      }

      frameId = window.requestAnimationFrame(animate)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', releaseKeys)
    document.addEventListener('visibilitychange', releaseKeys)
    frameId = window.requestAnimationFrame(animate)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', releaseKeys)
      document.removeEventListener('visibilitychange', releaseKeys)
      window.cancelAnimationFrame(frameId)
      pressedKeys.clear()
    }
  }, [activateEquipment, exitBossArena, gameStarted, jump, moveLaneBy, selectEquipment, slide, toggleGameBoost])

  if (gameStarted) {
    return (
      <main className="training-screen">
        <header className="training-header">
          <div>
            <p className="eyebrow accent">{bossState.active ? 'Titan Guardian Arena' : 'Earth - Training Grounds'}</p>
            <h1>{bossState.active ? 'TITAN GUARDIAN' : 'EARTH: THE BEGINNING'}</h1>
          </div>
          <div className="training-header-actions">
            {!bossState.active && !bossState.victory ? (
              <button type="button" className="secondary-button" disabled={gameOver} onClick={enterBossArena}>
                ENTER TITAN ARENA
              </button>
            ) : null}
            {bossState.active ? (
              <button type="button" className="secondary-button" onClick={exitBossArena}>
                RETURN TO TRAINING
              </button>
            ) : null}
            <button type="button" className="secondary-button" onClick={() => setGameStarted(false)}>
              RETURN TO MISSION CONTROL
            </button>
          </div>
        </header>

        <section className="training-hud" aria-label="training mission status">
          <div><span>MISSION</span><strong>ASTRONAUT FIELD TRAINING</strong></div>
          <div><span>SCORE</span><strong>{trainingScore}</strong></div>
          <div><span>ENERGY CELLS</span><strong>{energyCells}</strong></div>
          <div><span>OXYGEN TANKS</span><strong>{oxygenTanks}</strong></div>
          <div><span>OXYGEN</span><strong>{oxygen}%</strong></div>
          <div><span>SPEED / DISTANCE</span><strong>{currentSpeed} m/s / {Math.floor(travelDistance)} m</strong></div>
          <div><span>OBSTACLE HITS</span><strong>{collisions}</strong></div>
          <div><span>SUIT INTEGRITY</span><strong>{playerHealth}%</strong></div>
          <div><span>STATUS</span><strong>{trainingMessage}</strong></div>
        </section>

        {bossState.active ? (
          <section className="boss-hud" aria-label="Titan Guardian encounter">
            <div className="boss-health-header">
              <strong>TITAN GUARDIAN - PHASE {bossState.phase}</strong>
              <span>{bossState.health} / 120 HP</span>
            </div>
            <div className="meter-track boss-health-track">
              <span style={{ width: `${(bossState.health / 120) * 100}%` }} />
            </div>
            <div className="guardian-scan-progress" aria-label={`${bossState.scanProgress >= 100 ? 3 : Math.floor(bossState.scanProgress / 40)} of 3 weak points scanned`}>
              <span>WEAK-POINT SCANS</span>
              <div className="guardian-scan-pips" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className={index < (bossState.scanProgress >= 100 ? 3 : Math.floor(bossState.scanProgress / 40)) ? 'scanned' : ''}
                  />
                ))}
              </div>
              <strong>{bossState.weakPoint ? 'CORE EXPOSED' : `${bossState.scanProgress >= 100 ? 3 : Math.floor(bossState.scanProgress / 40)} / 3`}</strong>
            </div>
            {bossState.weakPoint ? <p>SCANNED WEAK POINTS - CORE EXPOSED</p> : null}
            {bossState.attack === 'windup' ? (
              <p className="boss-warning">WARNING: {bossState.attackPattern?.toUpperCase()} attack - evade lane {bossState.attackLane + 1}</p>
            ) : null}
          </section>
        ) : null}

        <section className="training-scene" aria-label={bossState.active ? 'Titan Guardian arena' : 'Earth astronaut training scene'}>
          <div className={`training-sky ${bossState.active ? 'arena-mode' : ''}`}>
            <Suspense fallback={<div className="world-loading">Constructing 3D terrain...</div>}>
              <TrainingWorld
                lane={laneNames.indexOf(astronautLane)}
                jumpHeight={astronautHeight}
                distance={travelDistance}
                equipment={equipment}
                effect={worldEffect}
                shieldActive={shieldActive}
                arenaActive={bossState.active}
                alien={alienState}
                boss={bossState}
                onRenderError={handleWorldError}
              />
            </Suspense>
            {worldError ? <div className="webgl-error" role="alert">{worldError}</div> : null}
            <div
              className="training-camera-world"
              data-camera-x={cameraX.toFixed(1)}
              style={{ transform: `translate3d(${-cameraX}px, 0, 0)` }}
            >
              <div className="training-sun" />
              <div className="training-cloud cloud-one" />
              <div className="training-cloud cloud-two" />
              <div className="training-mountain mountain-one" />
              <div className="training-mountain mountain-two" />
              <div className="training-base">
                <span>ORBITQUEST AEROSPACE TRAINING CENTER</span>
              </div>
              <div className="training-runway">
                <span className="runway-mark runway-mark-one" />
                <span className="runway-mark runway-mark-two" />
                <span className="runway-mark runway-mark-three" />
                {trainingObjects.map((object) => {
                  const remaining = object.distance - travelDistance
                  const objectTop = Math.min(53, 15 + ((48 - remaining) / 48) * 38)
                  const label = object.kind === 'energy'
                    ? 'ENERGY'
                    : object.kind === 'oxygen'
                      ? 'O2'
                      : object.kind === 'hurdle'
                        ? 'HURDLE'
                        : 'BEAM'

                  return (
                    <div
                      key={object.id}
                      className={`training-object object-${object.kind}`}
                      data-kind={object.kind}
                      data-lane={object.lane}
                      aria-label={`${label} in ${object.lane} lane`}
                      style={{
                        left: `${laneObjectPositions[object.lane]}%`,
                        top: `${objectTop}%`,
                      }}
                    >
                      <span>{label}</span>
                    </div>
                  )
                })}
                <div
                  className={`training-astronaut lane-${astronautLane} motion-${astronautMotion}${sprinting ? ' sprinting' : ''}`}
                  data-lane={astronautLane}
                  data-motion={astronautMotion}
                  data-height={Math.round(astronautHeight)}
                  data-equipment={equipment}
                  style={{ bottom: `calc(20% + ${astronautHeight}px)` }}
                >
                  {shieldActive ? <span className="astronaut-shield" aria-label="shield active" /> : null}
                  <span className="astronaut-helmet" />
                  <span className="astronaut-torso" />
                  <span className="astronaut-pack" />
                  <span className="astronaut-leg leg-one" />
                  <span className="astronaut-leg leg-two" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="training-controls">
          <div className="training-instructions">
            <p className="eyebrow">Field Exercise 01</p>
            <h2>Move through the training course</h2>
            <p>
              A / D or Left / Right changes lanes. Space / Up jumps; Down slides. Hold Shift to sprint,
              press B or BOOST to use boost. Keys 1-3 switch gear; F activates it. Cross cells and oxygen to collect.
            </p>
            <div className="training-meters">
              <div className="meter-row">
                <span>OXYGEN {oxygen}%</span>
                <div className="meter-track"><span className="oxygen-meter" style={{ width: `${oxygen}%` }} /></div>
              </div>
              <div className="meter-row">
                <span>BOOST {Math.round(boostEnergy)}%</span>
                <div className="meter-track"><span className="boost-meter" style={{ width: `${boostEnergy}%` }} /></div>
              </div>
            </div>
            <p className="training-feedback" role="status">{trainingMessage}</p>
          </div>
          <div className="control-pad" aria-label="astronaut controls">
            <button type="button" onClick={() => moveToLane('left')}>LEFT</button>
            <button type="button" onClick={() => moveToLane('center')}>CENTER</button>
            <button type="button" onClick={() => moveToLane('right')}>RIGHT</button>
            <button type="button" onClick={jump}>JUMP</button>
            <button type="button" onClick={slide}>SLIDE</button>
            <button type="button" aria-pressed={sprinting} onClick={toggleSprint}>
              {sprinting ? 'STOP SPRINT' : 'SPRINT'}
            </button>
            <button type="button" aria-pressed={boostEnabled} onClick={toggleGameBoost}>
              {boostEnabled ? 'BOOST ON' : 'BOOST'}
            </button>
          </div>
        </section>

        <section className="equipment-panel" aria-label="astronaut equipment">
          <div>
            <p className="eyebrow">Field Equipment</p>
            <h2>{equipment === 'gadget' ? 'Handheld energy gadget' : equipment === 'scanner' ? 'Scientific scanner' : 'Defensive energy shield'}</h2>
            <p>{equipment === 'gadget'
              ? 'Fire bolts at the alien or guardian when they are in range and your lanes align.'
              : equipment === 'scanner'
                ? `Scan alien lifeforms and Titan Guardian weak points: ${bossScanProgress}%`
                : shieldActive
                  ? 'Shield is absorbing the next impact.'
                  : 'Activate the shield before an attack lands; it absorbs one hit.'}</p>
          </div>
          <div className="equipment-controls">
            <button type="button" aria-pressed={equipment === 'gadget'} onClick={() => selectEquipment('gadget')}>GADGET [1]</button>
            <button type="button" aria-pressed={equipment === 'scanner'} onClick={() => selectEquipment('scanner')}>SCANNER [2]</button>
            <button type="button" aria-pressed={equipment === 'shield'} onClick={() => selectEquipment('shield')}>SHIELD [3]</button>
            <button type="button" className="primary-button" onClick={activateEquipment}>
              {equipment === 'gadget' ? 'FIRE [F]' : equipment === 'scanner' ? 'SCAN [F]' : 'ACTIVATE SHIELD [F]'}
            </button>
          </div>
        </section>

        {alienState.active && !bossState.active ? (
          <section className={`alien-status alien-${alienState.phase}`} aria-label="alien encounter">
            <div>
              <p className="eyebrow">Hostile Lifeform</p>
              <strong>
                {alienState.phase.toUpperCase()} · LANE {laneNames[alienState.lane].toUpperCase()} ·
                {' '}{Math.max(0, Math.floor(alienState.remaining))} M AHEAD
              </strong>
            </div>
            <div className="alien-health">
              <span>HEALTH {alienState.health} / 60</span>
              <div className="meter-track"><span style={{ width: `${(alienState.health / 60) * 100}%` }} /></div>
            </div>
          </section>
        ) : null}

        {bossState.victory ? (
          <section className="encounter-result" role="status">
            <div>
              <p className="eyebrow accent">Scientific Encounter Complete</p>
              <h2>Titan Guardian defeated</h2>
              <p>Core scan data recovered. The arena encounter is complete.</p>
            </div>
            <button type="button" className="primary-button" onClick={exitBossArena}>RETURN TO EARTH TRAINING</button>
          </section>
        ) : null}

        {gameOver ? (
          <section className="game-over-panel" role="alert">
            <h2>Mission failed</h2>
            <p>Suit integrity reached zero. Restart the training mission to continue.</p>
            <button type="button" className="primary-button" onClick={startNewGame}>RESTART TRAINING</button>
          </section>
        ) : null}
      </main>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">OQ</div>
          <div>
            <p className="eyebrow">NASA Space Apps Challenge</p>
            <h1>ORBITQUEST 3D</h1>
          </div>
        </div>

        <nav className="main-nav" aria-label="main navigation">
          {menuItems.map((item) => (
            <button
              key={item}
              type="button"
              className="nav-button"
              onClick={item === 'NEW GAME' ? startNewGame : undefined}
            >
              {item}
            </button>
          ))}
        </nav>
      </header>

      <main className="content-grid">
        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow accent">Beyond the Unknown</p>
            <h2>Train. Launch. Discover the impossible.</h2>
            <p className="hero-text">
              Lead a multinational crew through Earth training, lunar rescue missions, and a
              harrowing signal search across alien worlds.
            </p>

            <div className="cta-row">
              <button type="button" className="primary-button" onClick={startNewGame}>
                NEW GAME
              </button>
              <button type="button" className="secondary-button">
                CONTINUE
              </button>
            </div>

            <div className="status-row" aria-label="flight status">
              {systemStatus.map((status) => (
                <span key={status} className="status-pill">
                  {status}
                </span>
              ))}
            </div>
          </div>

          <div className="scene-panel" aria-label="space scene">
            <div className="planet planet-earth" />
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="spacecraft" />
            <div className="starfield" />
          </div>
        </section>

        <aside className="mission-panel">
          <div className="panel-header">
            <p className="eyebrow">Mission Control</p>
            <span className="status-badge">{selectedMission.status}</span>
          </div>

          <h3>{selectedMission.title}</h3>
          <p className="mission-meta">
            <span>{selectedMission.planet}</span>
            <span>{selectedMission.difficulty}</span>
          </p>

          <p className="mission-objective">{selectedMission.objective}</p>

          <ul className="objective-list">
            {selectedMission.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>

          <div className="launch-card">
            <div>
              <p className="eyebrow">Launch Window</p>
              <strong>03:12:48</strong>
            </div>
            <button type="button" className="flat-button">
              PREPARE
            </button>
          </div>
        </aside>
      </main>

      <section className="stats-row" aria-label="mission stats">
        {statCards.map((card) => (
          <div className="stat-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </section>

      <section className="mission-grid" aria-label="mission list">
        {missions.map((mission) => (
          <button
            key={mission.title}
            type="button"
            className={`mission-card ${selectedMission.title === mission.title ? 'active' : ''}`}
            onClick={() => setSelectedMission(mission)}
          >
            <span className="planet-tag">{mission.planet}</span>
            <strong>{mission.title}</strong>
            <small>{mission.difficulty}</small>
          </button>
        ))}
      </section>

      <section className="simulator-panel">
        <div className="simulator-copy">
          <p className="eyebrow accent">Training Simulator</p>
          <h3>Runner sequence / obstacle response</h3>
          <p>
            Dash across hazard zones, vault debris, and move between lanes to collect oxygen tanks and
            energy cells while the signal grows stronger.
          </p>
        </div>

        <div className="runner-box" aria-label="runner control panel">
          <div className="runner-track">
            <div className={`runner-avatar lane-${runnerLane}`}>
              <span className="avatar-body" />
            </div>
            <div className="obstacle obstacle-one" />
            <div className="obstacle obstacle-two" />
            <div className="pickup pickup-one" />
          </div>

          <div className="runner-controls">
            <button type="button" onClick={() => setRunnerLane('left')}>
              Left
            </button>
            <button type="button" onClick={() => setRunnerLane('center')}>
              Center
            </button>
            <button type="button" onClick={() => setRunnerLane('right')}>
              Right
            </button>
            <button type="button" onClick={toggleBoost}>
              Boost {boost}%
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default App
