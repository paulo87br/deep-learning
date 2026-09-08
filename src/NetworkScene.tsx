import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { Trace } from './network'

export type Theme = 'dark' | 'light'
const PALETTES = {
  dark: { background: '#090b0f', idle: '#d9dde5', active: '#e2aa3d', signal: '#f5f1e8', line: '#38404d' },
  light: { background: '#f4f1e9', idle: '#343942', active: '#a96800', signal: '#087687', line: '#c7c0b3' },
}
const X = [-6, -2, 2, 6]
const CAMERA = new THREE.Vector3(13, 7, 17)

type NodeRecord = { mesh: THREE.Mesh; layer: number; index: number; value: number }

export function NetworkScene({ trace, activeStage, theme, resetId, onSelectLayer }: {
  trace: Trace; activeStage: number; theme: Theme; resetId: number; onSelectLayer: (layer: number) => void
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef(activeStage)
  const themeRef = useRef(theme)
  const nodesRef = useRef<NodeRecord[]>([])
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const onSelectRef = useRef(onSelectLayer)
  useEffect(() => { activeRef.current = activeStage }, [activeStage])
  useEffect(() => { themeRef.current = theme }, [theme])
  useEffect(() => { onSelectRef.current = onSelectLayer }, [onSelectLayer])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const scene = new THREE.Scene()
    const palette = PALETTES[themeRef.current]
    scene.background = new THREE.Color(palette.background)
    scene.fog = new THREE.FogExp2(palette.background, .016)
    const camera = new THREE.PerspectiveCamera(44, mount.clientWidth / mount.clientHeight, .1, 100)
    camera.position.copy(CAMERA); camera.lookAt(0, 0, 0); cameraRef.current = camera
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(mount.clientWidth, mount.clientHeight); renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = .28; controls.minDistance = 9; controls.maxDistance = 32
    controlsRef.current = controls

    const layerValues = [trace.normalized, trace.hidden1, trace.hidden2, trace.probabilities]
    const sphere = new THREE.SphereGeometry(.22, 20, 20)
    const nodes: NodeRecord[] = []
    layerValues.forEach((values, layer) => values.forEach((value, index) => {
      const material = new THREE.MeshBasicMaterial({ color: palette.idle, transparent: true, opacity: .25, toneMapped: false })
      const mesh = new THREE.Mesh(sphere, material)
      const y = (index - (values.length - 1) / 2) * 1.03
      const z = Math.sin(index * 1.7 + layer) * .62
      mesh.position.set(X[layer], y, z); mesh.userData.layer = layer; scene.add(mesh)
      nodes.push({ mesh, layer, index, value })
    }))
    nodesRef.current = nodes
    const lines: THREE.Line[] = []
    for (let layer = 0; layer < 3; layer += 1) {
      const from = nodes.filter((node) => node.layer === layer)
      const to = nodes.filter((node) => node.layer === layer + 1)
      from.forEach((a) => to.forEach((b) => {
        const material = new THREE.LineBasicMaterial({ color: palette.line, transparent: true, opacity: .07 })
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.mesh.position, b.mesh.position]), material)
        line.userData.bridge = layer; scene.add(line); lines.push(line)
      }))
    }
    const pulseMaterial = new THREE.MeshBasicMaterial({ color: palette.active, toneMapped: false })
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(.1, 16, 16), pulseMaterial); scene.add(pulse)

    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2()
    const pick = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(nodes.map((node) => node.mesh))[0]
      if (typeof hit?.object.userData.layer === 'number') onSelectRef.current(hit.object.userData.layer)
    }
    renderer.domElement.addEventListener('pointerup', pick)
    renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false })
    let frame = 0
    const animate = (time: number) => {
      frame = requestAnimationFrame(animate)
      const colors = PALETTES[themeRef.current]
      if (scene.background instanceof THREE.Color) scene.background.set(colors.background)
      if (scene.fog instanceof THREE.FogExp2) scene.fog.color.set(colors.background)
      const stage = activeRef.current
      const activeLayer = stage < 2 ? 0 : stage < 4 ? 1 : stage < 6 ? 2 : 3
      nodes.forEach((node) => {
        const material = node.mesh.material as THREE.MeshBasicMaterial
        material.color.set(node.layer === activeLayer ? colors.active : node.value > .55 ? colors.signal : colors.idle)
        const targetOpacity = node.layer === activeLayer ? .98 : node.layer < activeLayer ? .48 : .16
        material.opacity += (targetOpacity - material.opacity) * .09
        const pulseScale = node.layer === activeLayer ? 1.05 + Math.sin(time * .006 + node.index) * .16 : .86
        node.mesh.scale.setScalar(pulseScale + Math.min(1, Math.abs(node.value)) * .45)
      })
      lines.forEach((line) => {
        const material = line.material as THREE.LineBasicMaterial
        const active = line.userData.bridge === Math.max(0, activeLayer - 1)
        material.color.set(active ? colors.active : colors.line); material.opacity = active ? .22 : .055
      })
      const fromX = activeLayer ? X[activeLayer - 1] : X[0] - 1.3
      const progress = (Math.sin(time * .0035) + 1) / 2
      pulse.position.set(THREE.MathUtils.lerp(fromX, X[activeLayer], progress), 0, 0)
      pulseMaterial.color.set(colors.active)
      controls.update(); renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(animate)
    const resize = new ResizeObserver(() => { camera.aspect = mount.clientWidth / mount.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.clientWidth, mount.clientHeight) })
    resize.observe(mount)
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); controls.dispose(); renderer.domElement.removeEventListener('pointerup', pick)
      nodes.forEach((node) => (node.mesh.material as THREE.Material).dispose()); sphere.dispose()
      lines.forEach((line) => { line.geometry.dispose(); (line.material as THREE.Material).dispose() })
      pulse.geometry.dispose(); pulseMaterial.dispose(); renderer.dispose(); renderer.domElement.remove()
    }
  }, [trace])

  useEffect(() => { if (cameraRef.current && controlsRef.current) { cameraRef.current.position.copy(CAMERA); controlsRef.current.target.set(0, 0, 0); controlsRef.current.autoRotate = true; controlsRef.current.update() } }, [resetId])
  return <div ref={mountRef} className="network-scene" aria-label="Rede neural tridimensional e interativa" />
}
