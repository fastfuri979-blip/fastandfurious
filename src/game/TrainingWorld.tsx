import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export type Equipment = 'gadget' | 'scanner' | 'shield'
export type AlienPhase = 'patrol' | 'chase' | 'windup' | 'attack' | 'stunned' | 'defeated'
export type BossAttack = 'idle' | 'beam' | 'slam' | 'charge' | 'windup'
export type WorldEffect = { id: number; kind: 'fire' | 'scan' } | null

export interface TrainingWorldProps {
  lane: number
  jumpHeight: number
  distance: number
  equipment: Equipment
  effect: WorldEffect
  shieldActive: boolean
  arenaActive: boolean
  alien: {
    active: boolean
    lane: number
    remaining: number
    health: number
    phase: AlienPhase
  }
  boss: {
    health: number
    phase: number
    scanProgress: number
    attack: BossAttack
    attackPattern: Exclude<BossAttack, 'idle' | 'windup'> | null
    attackLane: number
    weakPoint: boolean
    active: boolean
    victory: boolean
  }
  onRenderError: (message: string) => void
}

interface AnimatedEffect extends THREE.Object3D {
  userData: {
    age?: number
    kind?: 'projectile' | 'scan'
  }
}

interface BossRig {
  root: THREE.Group
  arms: [THREE.Group, THREE.Group]
  legs: [THREE.Group, THREE.Group]
  cores: THREE.Mesh[]
}

const lanePositions = [-5, 0, 5]

function makeRockMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x89543c, roughness: 0.98, flatShading: true })
}

function buildTrainingTerrain(scene: THREE.Scene) {
  const groundGeometry = new THREE.PlaneGeometry(190, 250, 76, 100)
  const vertices = groundGeometry.attributes.position
  for (let index = 0; index < vertices.count; index += 1) {
    const x = vertices.getX(index)
    const z = vertices.getY(index)
    const side = Math.max(0, Math.abs(x) - 7)
    const ridge = Math.sin(x * 0.13) * Math.cos(z * 0.11) * 0.32
    const roughness = Math.sin(x * 0.61 + z * 0.27) * 0.1
    vertices.setZ(index, side * 0.045 + ridge + roughness)
  }
  groundGeometry.computeVertexNormals()
  groundGeometry.rotateX(-Math.PI / 2)

  const ground = new THREE.Mesh(
    groundGeometry,
    new THREE.MeshStandardMaterial({ color: 0x9a6348, roughness: 1, metalness: 0 }),
  )
  ground.position.set(0, -0.23, -38)
  ground.receiveShadow = true
  scene.add(ground)

  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 250),
    new THREE.MeshStandardMaterial({ color: 0x574439, roughness: 0.95, metalness: 0.02 }),
  )
  path.rotation.x = -Math.PI / 2
  path.position.set(0, -0.1, -38)
  path.receiveShadow = true
  scene.add(path)

  const stripeMaterial = new THREE.MeshStandardMaterial({
    color: 0xcca47f,
    roughness: 0.85,
    emissive: 0x281309,
  })
  for (const x of [-4.25, 4.25]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 210), stripeMaterial)
    stripe.position.set(x, 0.01, -38)
    scene.add(stripe)
  }

  const rockMaterial = makeRockMaterial()
  const rockGeometry = new THREE.IcosahedronGeometry(1, 0)
  const cliffGeometry = new THREE.IcosahedronGeometry(1, 1)
  const ridgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x75452f,
    roughness: 1,
    flatShading: true,
  })
  let seed = 431
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  for (let index = 0; index < 56; index += 1) {
    const side = index % 2 === 0 ? -1 : 1
    const rock = new THREE.Mesh(rockGeometry, rockMaterial)
    const size = 0.35 + random() * 1.8
    rock.position.set(side * (8 + random() * 17), size * 0.38 - 0.12, 16 - random() * 145)
    rock.scale.set(size * (0.8 + random() * 0.7), size * (0.5 + random() * 0.6), size)
    rock.rotation.set(random(), random() * Math.PI, random())
    rock.castShadow = true
    rock.receiveShadow = true
    scene.add(rock)
  }

  for (let index = 0; index < 20; index += 1) {
    const side = index % 2 === 0 ? -1 : 1
    const cliff = new THREE.Mesh(cliffGeometry, ridgeMaterial)
    const height = 5 + random() * 11
    cliff.position.set(side * (32 + random() * 8), height * 0.43, -18 - index * 6.3)
    cliff.scale.set(5 + random() * 5, height, 7 + random() * 7)
    cliff.rotation.set(random() * 0.4, random() * Math.PI, random() * 0.25)
    cliff.castShadow = true
    cliff.receiveShadow = true
    scene.add(cliff)
  }

  const craterMaterial = new THREE.MeshStandardMaterial({
    color: 0x514b44,
    roughness: 1,
    side: THREE.DoubleSide,
  })
  const craterRimMaterial = new THREE.MeshStandardMaterial({
    color: 0x9a8b76,
    roughness: 0.9,
    flatShading: true,
  })
  for (const crater of [
    { x: -13, z: -16, radius: 3.3 },
    { x: 15, z: -43, radius: 4.1 },
    { x: -18, z: -76, radius: 5.2 },
    { x: 13, z: -110, radius: 3.5 },
  ]) {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(crater.radius, 18), craterMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(crater.x, -0.12, crater.z)
    floor.scale.set(1, 0.72, 1)
    floor.receiveShadow = true
    scene.add(floor)

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(crater.radius, 0.38, 6, 18),
      craterRimMaterial,
    )
    rim.rotation.x = -Math.PI / 2
    rim.position.set(crater.x, -0.02, crater.z)
    rim.scale.set(1, 0.72, 1)
    rim.castShadow = true
    scene.add(rim)
  }

  const structureMaterial = new THREE.MeshStandardMaterial({
    color: 0x9a8b79,
    roughness: 0.78,
    metalness: 0.3,
  })
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x67c7d7,
    emissive: 0x0e5868,
    emissiveIntensity: 1.8,
    metalness: 0.35,
    roughness: 0.24,
  })
  const hangar = new THREE.Group()
  const mainBuilding = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 8), structureMaterial)
  mainBuilding.position.y = 3
  mainBuilding.castShadow = true
  mainBuilding.receiveShadow = true
  hangar.add(mainBuilding)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(15, 0.7, 9), structureMaterial)
  roof.position.y = 6.35
  roof.castShadow = true
  hangar.add(roof)
  const door = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.8, 0.14), glassMaterial)
  door.position.set(0, 2.2, 4.08)
  hangar.add(door)
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3.1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x4a6672,
      roughness: 0.34,
      metalness: 0.28,
      transparent: true,
      opacity: 0.86,
    }),
  )
  dome.position.set(0, 6.45, -1.5)
  dome.castShadow = true
  hangar.add(dome)

  const solarMaterial = new THREE.MeshStandardMaterial({
    color: 0x28475d,
    emissive: 0x0b2536,
    metalness: 0.62,
    roughness: 0.4,
  })
  for (const side of [-1, 1]) {
    const module = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 8, 12), structureMaterial)
    module.rotation.z = Math.PI / 2
    module.position.set(side * 9, 2.3, 0)
    module.castShadow = true
    module.receiveShadow = true
    hangar.add(module)

    const solarPanel = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 3.4), solarMaterial)
    solarPanel.position.set(side * 9.5, 5.25, -2.6)
    solarPanel.rotation.z = side * -0.12
    solarPanel.castShadow = true
    hangar.add(solarPanel)
    for (let line = -1; line <= 1; line += 1) {
      const cellLine = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.025, 3.25),
        new THREE.MeshBasicMaterial({ color: 0x72d9ed }),
      )
      cellLine.position.set(side * 9.5 + line * 1.25, 5.34, -2.6)
      hangar.add(cellLine)
    }
  }

  const dish = new THREE.Group()
  const dishBowl = new THREE.Mesh(
    new THREE.SphereGeometry(1.7, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    structureMaterial,
  )
  dishBowl.rotation.x = Math.PI
  dishBowl.position.y = 1.2
  dish.add(dishBowl)
  const dishMast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2.2, 8), structureMaterial)
  dishMast.position.y = -0.5
  dish.add(dishMast)
  dish.position.set(5, 7.1, -2.3)
  dish.rotation.x = -0.45
  hangar.add(dish)

  hangar.position.set(-15, -0.2, -78)
  scene.add(hangar)

  for (const x of [-23, 18]) {
    const tower = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 10, 7), structureMaterial)
    shaft.position.y = 5
    shaft.castShadow = true
    tower.add(shaft)
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2, 7), structureMaterial)
    cap.position.y = 10.7
    cap.castShadow = true
    tower.add(cap)
    const beacon = new THREE.PointLight(0x42d8ff, 1.8, 11)
    beacon.position.y = 9.2
    tower.add(beacon)
    tower.position.set(x, -0.1, -66)
    scene.add(tower)
  }

  const particles = new THREE.BufferGeometry()
  const particlePositions = new Float32Array(360 * 3)
  for (let index = 0; index < 360; index += 1) {
    particlePositions[index * 3] = (random() - 0.5) * 90
    particlePositions[index * 3 + 1] = 0.5 + random() * 12
    particlePositions[index * 3 + 2] = 24 - random() * 150
  }
  particles.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
  const dust = new THREE.Points(
    particles,
    new THREE.PointsMaterial({
      color: 0xe5b795,
      size: 0.09,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    }),
  )
  dust.name = 'training-dust'
  scene.add(dust)

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 22),
    new THREE.MeshBasicMaterial({ color: 0x0b121b, transparent: true, opacity: 0.34 }),
  )
  shadow.name = 'astronaut-shadow'
  shadow.rotation.x = -Math.PI / 2
  shadow.position.set(0, 0.04, 0)
  scene.add(shadow)

  const motionMarks = new THREE.Group()
  const dashMaterial = new THREE.MeshStandardMaterial({
    color: 0xb7d2d7,
    emissive: 0x31535a,
    roughness: 0.6,
  })
  for (let index = 0; index < 12; index += 1) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 2.8), dashMaterial)
    dash.position.set(0, 0.035, -index * 8)
    motionMarks.add(dash)
  }
  scene.add(motionMarks)

  const distantPlanet = new THREE.Group()
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(10.5, 28, 20),
    new THREE.MeshStandardMaterial({
      color: 0xb88370,
      roughness: 1,
      emissive: 0x3e1a15,
      emissiveIntensity: 0.35,
    }),
  )
  planet.castShadow = true
  distantPlanet.add(planet)
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(11.25, 28, 20),
    new THREE.MeshBasicMaterial({
      color: 0xf1ad8a,
      transparent: true,
      opacity: 0.13,
      side: THREE.BackSide,
    }),
  )
  distantPlanet.add(atmosphere)
  distantPlanet.position.set(34, 28, -122)
  scene.add(distantPlanet)

  return { dust, shadow, motionMarks }
}

function buildAlien(scene: THREE.Scene) {
  const alien = new THREE.Group()
  const skin = new THREE.MeshStandardMaterial({
    color: 0x739c67,
    roughness: 0.68,
    flatShading: true,
    emissive: 0x142717,
  })
  const darkSkin = new THREE.MeshStandardMaterial({ color: 0x3e6047, roughness: 0.8 })
  const eye = new THREE.MeshStandardMaterial({
    color: 0xf3cb67,
    emissive: 0xf58420,
    emissiveIntensity: 1.8,
  })
  const core = new THREE.MeshStandardMaterial({
    color: 0x55e6e2,
    emissive: 0x12b9c9,
    emissiveIntensity: 2,
  })

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.68, 12, 9), skin)
  torso.scale.set(0.8, 1.35, 0.66)
  torso.position.y = 1.45
  torso.castShadow = true
  alien.add(torso)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.56, 12, 10), skin)
  head.scale.set(1.05, 0.82, 0.9)
  head.position.set(0, 2.55, -0.08)
  head.castShadow = true
  alien.add(head)

  for (const side of [-1, 1]) {
    const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), eye)
    eyeMesh.position.set(side * 0.27, 2.57, -0.52)
    alien.add(eyeMesh)

    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.82, 3, 6), darkSkin)
    arm.position.set(side * 0.7, 1.55, 0)
    arm.rotation.z = side * -0.48
    arm.castShadow = true
    alien.add(arm)

    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 5), skin)
    claw.position.set(side * 0.94, 0.95, -0.1)
    claw.rotation.z = Math.PI
    claw.castShadow = true
    alien.add(claw)

    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.74, 3, 6), darkSkin)
    leg.position.set(side * 0.3, 0.48, 0)
    leg.castShadow = true
    alien.add(leg)
  }

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), core)
  chest.position.set(0, 1.62, -0.56)
  alien.add(chest)
  alien.scale.setScalar(1.05)
  alien.visible = false
  alien.name = 'patrolling-alien'
  scene.add(alien)
  return alien
}

function makeCragGeometry(radius: number, seed: number) {
  const geometry = new THREE.IcosahedronGeometry(radius, 1)
  const positions = geometry.attributes.position
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index)
    const y = positions.getY(index)
    const z = positions.getZ(index)
    const variation = 0.96 + Math.sin((x * 4.3 + y * 2.7 + seed) * 1.7) *
      Math.cos((z * 4.1 - y * 3.2 + seed) * 1.3) * 0.09
    positions.setXYZ(index, x * variation, y * variation, z * variation)
  }
  geometry.computeVertexNormals()
  return geometry
}

function buildBoss(scene: THREE.Scene): BossRig {
  const root = new THREE.Group()
  const armor = new THREE.MeshStandardMaterial({
    color: 0x40342e,
    metalness: 0.18,
    roughness: 0.92,
    flatShading: true,
  })
  const armorLight = new THREE.MeshStandardMaterial({
    color: 0x78523e,
    metalness: 0.2,
    roughness: 0.82,
    flatShading: true,
  })
  const armorDark = new THREE.MeshStandardMaterial({
    color: 0x211d1a,
    roughness: 1,
    flatShading: true,
  })
  const crystalMaterial = new THREE.MeshStandardMaterial({
    color: 0x8c3324,
    emissive: 0x55170c,
    emissiveIntensity: 0.7,
    roughness: 0.5,
    metalness: 0.12,
  })
  const coreMaterials = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({
    color: 0xffb066,
    emissive: 0xff471d,
    emissiveIntensity: 2.7,
    roughness: 0.28,
    metalness: 0.12,
  }))
  const torso = new THREE.Mesh(makeCragGeometry(1.65, 17), armor)
  torso.scale.set(1.34, 1.48, 0.9)
  torso.position.set(0, 3.35, 0)
  torso.castShadow = true
  torso.receiveShadow = true
  root.add(torso)

  const abdomen = new THREE.Mesh(makeCragGeometry(1.03, 29), armorDark)
  abdomen.scale.set(1.12, 1.15, 0.88)
  abdomen.position.set(0, 2.25, 0.04)
  abdomen.castShadow = true
  root.add(abdomen)

  const head = new THREE.Mesh(makeCragGeometry(0.92, 41), armorLight)
  head.scale.set(1.12, 0.86, 0.86)
  head.position.set(0, 5.28, 0.12)
  head.castShadow = true
  root.add(head)

  const headCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 12, 10),
    new THREE.MeshStandardMaterial({
      color: 0xff8851,
      emissive: 0xff3215,
      emissiveIntensity: 3.4,
    }),
  )
  headCore.position.set(0, 5.08, 1.18)
  root.add(headCore)

  const cores: THREE.Mesh[] = []
  for (const [index, position] of [
    [-1.25, 4.02, 1.48],
    [0, 3.43, 1.88],
    [1.25, 4.02, 1.48],
  ].entries()) {
    const socket = new THREE.Mesh(
      new THREE.TorusGeometry(index === 1 ? 0.48 : 0.4, 0.12, 8, 18),
      armorDark,
    )
    socket.position.set(position[0], position[1], position[2] - 0.04)
    root.add(socket)

    const core = new THREE.Mesh(new THREE.SphereGeometry(index === 1 ? 0.38 : 0.29, 14, 12), coreMaterials[index])
    core.position.set(position[0], position[1], position[2])
    core.name = index === 1 ? 'boss-weak-point' : `boss-weak-point-${index}`
    root.add(core)
    cores.push(core)
  }

  const rockGeometry = makeCragGeometry(0.72, 53)
  let seed = 193
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  for (let index = 0; index < 17; index += 1) {
    const side = index % 2 === 0 ? -1 : 1
    const plate = new THREE.Mesh(rockGeometry, index % 3 === 0 ? armor : armorLight)
    plate.position.set(
      side * (0.55 + random() * 0.7),
      2.5 + random() * 2.55,
      0.42 + random() * 0.4,
    )
    plate.scale.set(0.8 + random() * 0.85, 0.7 + random() * 0.8, 0.52 + random() * 0.4)
    plate.rotation.set(random() * 0.7, random() * Math.PI, random() * 0.7)
    plate.castShadow = true
    plate.receiveShadow = true
    root.add(plate)
  }

  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group()
    arm.position.set(side * 1.78, 4.05, 0.02)
    const shoulder = new THREE.Mesh(makeCragGeometry(0.84, 61 + side), armorLight)
    shoulder.scale.set(1.02, 0.92, 0.92)
    shoulder.position.set(side * 0.38, -0.15, 0.02)
    shoulder.castShadow = true
    arm.add(shoulder)

    const upper = new THREE.Mesh(makeCragGeometry(0.78, 67 + side), armor)
    upper.scale.set(0.76, 1.34, 0.82)
    upper.position.set(side * 0.72, -0.98, 0)
    upper.castShadow = true
    arm.add(upper)

    const forearm = new THREE.Mesh(makeCragGeometry(0.72, 71 + side), armorLight)
    forearm.scale.set(1.02, 1.35, 0.92)
    forearm.position.set(side * 1.3, -1.95, 0.12)
    forearm.castShadow = true
    arm.add(forearm)

    const fist = new THREE.Mesh(makeCragGeometry(0.67, 83 + side), armorDark)
    fist.scale.set(1.12, 0.88, 1)
    fist.position.set(side * 1.76, -2.86, 0.28)
    fist.castShadow = true
    arm.add(fist)

    for (let claw = -1; claw <= 1; claw += 1) {
      const talon = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.72, 6), armorLight)
      talon.position.set(side * (1.62 + claw * 0.23), -3.4, 0.56)
      talon.rotation.x = -0.18
      talon.castShadow = true
      arm.add(talon)
    }
    root.add(arm)
    return arm
  }) as [THREE.Group, THREE.Group]

  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Group()
    leg.position.set(side * 0.72, 1.5, 0)
    const thigh = new THREE.Mesh(makeCragGeometry(0.72, 89 + side), armorDark)
    thigh.scale.set(0.9, 1.15, 0.95)
    thigh.position.y = -0.32
    thigh.castShadow = true
    leg.add(thigh)

    const foot = new THREE.Mesh(makeCragGeometry(0.68, 97 + side), armorLight)
    foot.scale.set(1.22, 0.58, 1.45)
    foot.position.set(side * 0.12, -1.12, 0.32)
    foot.castShadow = true
    leg.add(foot)
    root.add(leg)
    return leg
  }) as [THREE.Group, THREE.Group]

  for (let index = 0; index < 11; index += 1) {
    const side = index % 2 === 0 ? -1 : 1
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.34 + random() * 0.3, 0.8 + random() * 1.2, 5),
      crystalMaterial,
    )
    spike.position.set(side * (0.7 + random() * 1.65), 4.55 + random() * 1.4, -0.28 + random() * 0.35)
    spike.rotation.z = side * (0.25 + random() * 0.45)
    spike.castShadow = true
    root.add(spike)
  }

  root.scale.setScalar(1.75)
  root.position.set(0, 0, -12)
  root.visible = false
  root.name = 'titan-guardian'
  scene.add(root)
  return { root, arms, legs, cores }
}

function buildArena(scene: THREE.Scene) {
  const arena = new THREE.Group()
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(24, 26, 0.7, 48, 1),
    new THREE.MeshStandardMaterial({ color: 0x46342d, metalness: 0.08, roughness: 0.96, flatShading: true }),
  )
  floor.position.set(0, -0.45, -12)
  floor.receiveShadow = true
  arena.add(floor)

  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0xff9a52,
    emissive: 0x7d280d,
    emissiveIntensity: 1.15,
    metalness: 0.15,
    roughness: 0.48,
  })
  for (const radius of [10, 18, 24]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.12, 8, 64), ringMaterial)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(0, -0.05, -12)
    arena.add(ring)
  }

  const pylonMaterial = new THREE.MeshStandardMaterial({
    color: 0x60473a,
    metalness: 0.12,
    roughness: 0.9,
    flatShading: true,
  })
  for (const position of [
    [-19, -25],
    [19, -25],
    [-19, 2],
    [19, 2],
  ]) {
    const pylon = new THREE.Group()
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.2, 8, 7), pylonMaterial)
    column.position.y = 4
    column.castShadow = true
    pylon.add(column)
    const lamp = new THREE.PointLight(0xff763e, 2.6, 22)
    lamp.position.y = 7
    pylon.add(lamp)
    pylon.position.set(position[0], -0.1, position[1])
    arena.add(pylon)
  }

  const boulderGeometry = new THREE.IcosahedronGeometry(1, 1)
  const boulderMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a4136,
    roughness: 1,
    flatShading: true,
  })
  let seed = 701
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  for (let index = 0; index < 22; index += 1) {
    const angle = (index / 22) * Math.PI * 2
    const radius = 20 + random() * 7
    const z = -12 + Math.sin(angle) * radius
    if (z > -2) continue
    const rock = new THREE.Mesh(boulderGeometry, boulderMaterial)
    const size = 1.2 + random() * 2.7
    rock.position.set(Math.cos(angle) * radius, size * 0.38 - 0.1, z)
    rock.scale.set(size * 1.1, size * 0.72, size)
    rock.rotation.set(random(), random() * Math.PI, random())
    rock.castShadow = true
    rock.receiveShadow = true
    arena.add(rock)
  }
  scene.add(arena)
  return arena
}

export default function TrainingWorld(props: TrainingWorldProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)

  useEffect(() => {
    propsRef.current = props
  }, [props])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch (error) {
      propsRef.current.onRenderError(
        error instanceof Error ? `WebGL initialization failed: ${error.message}` : 'WebGL initialization failed.',
      )
      return
    }

    const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x8e7263)
      scene.fog = new THREE.Fog(0x9b7662, 48, 170)

    const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 230)
    camera.position.set(0, 7.5, 15)
    camera.lookAt(0, 1.2, -24)

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.domElement.className = 'training-webgl-canvas'
    host.appendChild(renderer.domElement)

    const ambient = new THREE.HemisphereLight(0xffdfc1, 0x422c22, 1.75)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xffc48f, 3.5)
    sun.position.set(-28, 44, 22)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -34
    sun.shadow.camera.right = 34
    sun.shadow.camera.top = 38
    sun.shadow.camera.bottom = -28
    sun.shadow.bias = -0.0004
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0x9ac9da, 0.72)
    fill.position.set(20, 12, -38)
    scene.add(fill)
    const horizonGlow = new THREE.PointLight(0xff9a5c, 2.6, 90)
    horizonGlow.position.set(-13, 10, -70)
    scene.add(horizonGlow)

    const { dust, shadow, motionMarks } = buildTrainingTerrain(scene)
    const alien = buildAlien(scene)
    const bossRig = buildBoss(scene)
    const boss = bossRig.root
    const arena = buildArena(scene)

    const shield = new THREE.Mesh(
      new THREE.SphereGeometry(1.7, 20, 16),
      new THREE.MeshStandardMaterial({
        color: 0x66e8ff,
        emissive: 0x1686d0,
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.18,
        wireframe: true,
        depthWrite: false,
      }),
    )
    shield.visible = false
    scene.add(shield)

    const gearGroup = new THREE.Group()
    const gearBody = new THREE.MeshStandardMaterial({
      color: 0x536e80,
      metalness: 0.82,
      roughness: 0.3,
    })
    const gearGlow = new THREE.MeshStandardMaterial({
      color: 0x48f5ff,
      emissive: 0x08b8db,
      emissiveIntensity: 2.6,
      metalness: 0.25,
      roughness: 0.2,
    })
    const gadget = new THREE.Group()
    const gadgetBody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.62), gearBody)
    gadgetBody.position.z = -0.12
    gadget.add(gadgetBody)
    const gadgetBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.38, 8), gearGlow)
    gadgetBarrel.rotation.x = Math.PI / 2
    gadgetBarrel.position.set(0, 0.02, -0.52)
    gadget.add(gadgetBarrel)
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.14), gearBody)
    grip.position.set(0, -0.2, 0.04)
    grip.rotation.x = -0.22
    gadget.add(grip)
    gearGroup.add(gadget)

    const scanner = new THREE.Group()
    const scannerBody = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.36, 0.12), gearBody)
    scanner.add(scannerBody)
    const scannerScreen = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.25, 0.02), gearGlow)
    scannerScreen.position.z = -0.075
    scanner.add(scannerScreen)
    gearGroup.add(scanner)

    const shieldEmitter = new THREE.Group()
    const emitterBody = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.44, 10), gearBody)
    emitterBody.rotation.z = Math.PI / 2
    shieldEmitter.add(emitterBody)
    const emitterRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 7, 16), gearGlow)
    emitterRing.position.x = 0.26
    emitterRing.rotation.y = Math.PI / 2
    shieldEmitter.add(emitterRing)
    gearGroup.add(shieldEmitter)
    gearGroup.userData = { gadget, scanner, shieldEmitter }
    scene.add(gearGroup)

    const hazardMaterial = new THREE.MeshBasicMaterial({
      color: 0xff5d2f,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
    })
    const bossHazards = lanePositions.map((x) => {
      const hazard = new THREE.Mesh(new THREE.CircleGeometry(2.3, 24), hazardMaterial.clone())
      hazard.rotation.x = -Math.PI / 2
      hazard.position.set(x, 0.08, -4)
      hazard.visible = false
      scene.add(hazard)
      return hazard
    })

    const effects: AnimatedEffect[] = []
    let lastEffectId = propsRef.current.effect?.id ?? 0
    let lastTime = 0
    const effectMaterial = new THREE.MeshStandardMaterial({
      color: 0x83fbff,
      emissive: 0x14dcff,
      emissiveIntensity: 4,
      roughness: 0.2,
    })

    const resize = () => {
      if (!host) return
      const width = Math.max(1, host.clientWidth)
      const height = Math.max(1, host.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)
    resize()

    let animationFrame = 0
    const renderFrame = (time: number) => {
      const current = propsRef.current
      const delta = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, 0.05)
      lastTime = time

      const playerX = lanePositions[current.lane] ?? 0
      const cameraTargetX = playerX * 0.48
      camera.position.x += (cameraTargetX - camera.position.x) * Math.min(1, delta * 2.8)
      camera.lookAt(cameraTargetX * 0.55, 1.15, current.arenaActive ? -13 : -24)

      shadow.position.x = playerX
      shadow.scale.setScalar(Math.max(0.4, 1.1 - current.jumpHeight * 0.004))
      const shadowMaterial = shadow.material as THREE.MeshBasicMaterial
      shadowMaterial.opacity = Math.max(0.08, 0.34 - current.jumpHeight * 0.0015)
      shield.position.set(playerX, 1.25 + current.jumpHeight * 0.004, 0.1)
      shield.visible = current.shieldActive
      gearGroup.position.set(playerX + 0.78, 1.1 + current.jumpHeight * 0.004, -0.05)
      gearGroup.rotation.y = Math.sin(time * 0.006) * 0.05
      const activeGear = gearGroup.userData as {
        gadget: THREE.Group
        scanner: THREE.Group
        shieldEmitter: THREE.Group
      }
      activeGear.gadget.visible = current.equipment === 'gadget'
      activeGear.scanner.visible = current.equipment === 'scanner'
      activeGear.shieldEmitter.visible = current.equipment === 'shield'
      activeGear.gadget.rotation.x = current.effect?.kind === 'fire' ? Math.sin(time * 0.03) * 0.12 : 0
      activeGear.scanner.rotation.z = current.effect?.kind === 'scan' ? Math.sin(time * 0.02) * 0.12 : 0

      alien.visible = current.alien.active && !current.arenaActive
      alien.position.set(
        lanePositions[current.alien.lane] ?? 0,
        0.05 + Math.sin(time * 0.004) * 0.14,
        -Math.max(4, Math.min(76, current.alien.remaining)),
      )
      alien.rotation.y = Math.sin(time * 0.0015) * 0.22 + Math.PI
      alien.scale.setScalar(current.alien.phase === 'windup' ? 1.13 : current.alien.phase === 'stunned' ? 0.88 : 1.05)
      const alienCore = alien.children.find((child) => child.type === 'Mesh' && child.position.y > 1.4) as
        | THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
        | undefined
      if (alienCore?.material?.emissive) {
        alienCore.material.emissiveIntensity = current.alien.phase === 'windup' ? 3.5 : 1.8
      }

      boss.visible = current.arenaActive && (current.boss.active || current.boss.victory)
      boss.position.y = current.boss.victory ? -0.4 : Math.sin(time * 0.002) * 0.12
      const charging = current.boss.attackPattern === 'charge' && current.boss.attack !== 'idle'
      boss.rotation.x = current.boss.victory ? 0.88 : charging ? -0.18 : Math.sin(time * 0.0014) * 0.025
      boss.rotation.y = Math.sin(time * 0.0007) * 0.08
      const slamWindup = current.boss.attack === 'windup' && current.boss.attackPattern === 'slam'
      const slamImpact = current.boss.attack === 'slam'
      bossRig.arms[0].rotation.z = Math.sin(time * 0.0018) * 0.08 + (slamWindup ? 0.82 : slamImpact ? -0.3 : 0)
      bossRig.arms[1].rotation.z = -Math.sin(time * 0.0018) * 0.08 - (slamWindup ? 0.82 : slamImpact ? -0.3 : 0)
      bossRig.arms[0].rotation.x = Math.sin(time * 0.0022) * 0.06
      bossRig.arms[1].rotation.x = -Math.sin(time * 0.0022) * 0.06
      bossRig.legs[0].rotation.x = Math.sin(time * 0.0024) * 0.045
      bossRig.legs[1].rotation.x = -Math.sin(time * 0.0024) * 0.045
      const scannedCoreCount = current.boss.scanProgress >= 100
        ? bossRig.cores.length
        : Math.floor(current.boss.scanProgress / 40)
      bossRig.cores.forEach((core, index) => {
        const material = core.material as THREE.MeshStandardMaterial
        if (current.boss.weakPoint) {
          material.color.setHex(0xffb066)
          material.emissive.setHex(0xff471d)
          material.emissiveIntensity = 4.8 + Math.sin(time * 0.01) * 1.2
        } else if (index < scannedCoreCount) {
          material.color.setHex(0x8df5ff)
          material.emissive.setHex(0x17bad1)
          material.emissiveIntensity = 2.2 + Math.sin(time * 0.006 + index) * 0.3
        } else {
          material.color.setHex(0xa56543)
          material.emissive.setHex(0x7d230e)
          material.emissiveIntensity = 0.8 + Math.sin(time * 0.004 + index) * 0.18
        }
      })
      arena.visible = current.arenaActive
      bossHazards.forEach((hazard, index) => {
        const activeHazard = current.arenaActive && current.boss.attack === 'windup' &&
          (current.boss.attackPattern === 'slam' || index === current.boss.attackLane)
        hazard.visible = activeHazard
        hazard.scale.setScalar(1 + Math.sin(time * 0.012) * 0.08)
      })

      const effect = current.effect
      if (effect && effect.id !== lastEffectId) {
        lastEffectId = effect.id
        if (effect.kind === 'fire') {
          const projectile = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), effectMaterial)
          projectile.position.set(playerX, 1.35 + current.jumpHeight * 0.004, -1)
          const light = new THREE.PointLight(0x30ddff, 2.5, 8)
          projectile.add(light)
          projectile.userData = { kind: 'projectile', age: 0 }
          scene.add(projectile)
          effects.push(projectile)
        } else {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(1.1, 1.35, 36),
            new THREE.MeshBasicMaterial({ color: 0x61efff, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
          )
          ring.rotation.x = -Math.PI / 2
          ring.position.set(playerX, 0.14, 0)
          ring.userData = { kind: 'scan', age: 0 }
          scene.add(ring)
          effects.push(ring)
        }
      }

      for (let index = effects.length - 1; index >= 0; index -= 1) {
        const item = effects[index]
        item.userData.age = (item.userData.age ?? 0) + delta
        if (item.userData.kind === 'projectile') item.position.z -= delta * 32
        if (item.userData.kind === 'scan') {
          const progress = (item.userData.age ?? 0) / 1.25
          item.scale.setScalar(1 + progress * 8)
          const scanMaterial = (item as THREE.Mesh).material as THREE.MeshBasicMaterial
          scanMaterial.opacity = Math.max(0, 1 - progress)
        }
        const expired = (item.userData.age ?? 0) > (item.userData.kind === 'scan' ? 1.25 : 2.8) ||
          item.position.z < -84
        if (expired) {
          scene.remove(item)
          if (item instanceof THREE.Mesh) {
            item.geometry.dispose()
            const material = item.material
            if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
            else material.dispose()
          }
          effects.splice(index, 1)
        }
      }

      dust.rotation.y = time * 0.000025
      motionMarks.children.forEach((mark, index) => {
        mark.position.z = 12 - ((current.distance * 0.72 + index * 8) % 96)
      })
      renderer.render(scene, camera)
      animationFrame = window.requestAnimationFrame(renderFrame)
    }
    animationFrame = window.requestAnimationFrame(renderFrame)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose()
          const material = object.material
          if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
          else material.dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={hostRef} className="three-world-layer" aria-hidden="true" />
}
