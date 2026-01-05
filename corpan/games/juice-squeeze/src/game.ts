import {
  Camera,
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  PointerDragBehavior,
  Scene,
  SceneLoader,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  TransformNode,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core"
import "@babylonjs/loaders/glTF"
import type { HostApi, StackConfig } from "./sdk/types"
import { loadUtterance } from "./data"
import { useGameStore } from "./store/gameState"

type InitialState = {
  stackConfig?: StackConfig
}

export const createJuiceSqueeze = (
  container: HTMLElement,
  hostApi: HostApi,
  initialState?: InitialState
) => {
  let disposed = false
  const root = document.createElement("div")
  root.className = "juice-squeeze"
  container.appendChild(root)

  const updateViewportSize = () => {
    const viewport = window.visualViewport
    const width = Math.round(viewport?.width ?? window.innerWidth)
    const height = Math.round(viewport?.height ?? window.innerHeight)
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return
    }
    container.style.width = `${width}px`
    container.style.height = `${height}px`
    root.style.width = `${width}px`
    root.style.height = `${height}px`
  }

  updateViewportSize()

  const canvas = document.createElement("canvas")
  canvas.style.width = "100%"
  canvas.style.height = "100%"
  root.appendChild(canvas)

  const maxDevicePixelRatio = 2
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    antialias: true,
  })
  engine.setHardwareScalingLevel(
    1 / Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio)
  )

  const scene = new Scene(engine)
  // Tropical sunset background (warm orange/pink)
  scene.clearColor = new Color4(1, 0.7, 0.5, 1) // Bright orange-pink tropical sunset

  // Camera setup - ORTHOGRAPHIC for 2D view
  const camera = new UniversalCamera("camera", new Vector3(0, 0, -15), scene)
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA
  camera.setTarget(Vector3.Zero())
  camera.inputs.clear()
  
  // Track current utterance for word count
  let currentUtterance: { words: string[] } | null = null
  
  // Layout metrics type
  type LayoutMetrics = {
    worldWidth: number
    worldHeight: number
    targetPhraseY: number
    sentenceAreaY: number
    wordBlocksY: number
    blockLabelY: number
    pixelsPerUnit: number
  }
  
  // Get viewport-based layout metrics
  const getLayoutMetrics = (): LayoutMetrics => {
    const canvasElement = engine.getRenderingCanvas()
    if (!canvasElement) {
      // Fallback values
      return {
        worldWidth: 20,
        worldHeight: 20,
        targetPhraseY: 7,
        sentenceAreaY: 2,
        wordBlocksY: -5,
        blockLabelY: -8,
        pixelsPerUnit: 16,
      }
    }
    
    const canvasW = canvasElement.width
    const canvasH = canvasElement.height
    const aspectRatio = canvasW / canvasH
    
    // World units that map to screen
    // On a 320px wide screen, we want ~20 world units visible horizontally
    // This means 1 world unit = 16 pixels at 320px
    // Scale proportionally for larger screens
    const baseWidth = 20 // world units visible at minimum
    const worldWidth = baseWidth * Math.max(1, canvasW / 320)
    const worldHeight = worldWidth / aspectRatio
    
    // Calculate pixels per world unit for HTML overlay positioning
    const pixelsPerUnit = canvasW / worldWidth
    
    // Regions in world coordinates (0,0 = center)
    // Top region: 80-95% of screen height = 85% from bottom = 15% from top
    // In world coords: positive Y is up, so 85% up = worldHeight * 0.35
    const targetPhraseY = worldHeight * 0.35
    
    // Middle region: 45-70% of screen height = 60% from bottom = 40% from top
    // In world coords: 60% up = worldHeight * 0.1
    const sentenceAreaY = worldHeight * 0.1
    
    // Bottom region: 5-35% of screen height = 25% from bottom
    // In world coords: 25% down = -worldHeight * 0.25
    const wordBlocksY = -worldHeight * 0.25
    
    // Block label: 40% from bottom
    const blockLabelY = -worldHeight * 0.4
    
    return {
      worldWidth,
      worldHeight,
      targetPhraseY,
      sentenceAreaY,
      wordBlocksY,
      blockLabelY,
      pixelsPerUnit,
    }
  }
  
  // Calculate dynamic block size based on word count and viewport
  const calculateBlockSize = (wordCount: number, metrics: LayoutMetrics) => {
    // Blocks must fit horizontally with gaps
    const availableWidth = metrics.worldWidth * 0.9 // 90% of screen width
    const gapRatio = 0.15 // 15% of block width as gap
    
    // Calculate max block width that fits all words
    const totalGaps = (wordCount - 1) * gapRatio
    const maxBlockWidth = availableWidth / (wordCount + totalGaps)
    
    // Block height = 50% of width (wide rectangles)
    const blockHeight = maxBlockWidth * 0.5
    
    // Font size = 40% of block height in pixels
    // Convert world units to approximate pixels for font
    const fontSize = Math.floor(blockHeight * metrics.pixelsPerUnit * 0.4)
    
    return {
      width: maxBlockWidth,
      height: blockHeight,
      gap: maxBlockWidth * gapRatio,
      fontSize: Math.max(24, Math.min(fontSize, 200)), // clamp 24-200px
    }
  }
  
  // Position word blocks using metrics and block size
  const positionWordBlocks = (
    blocks: Mesh[],
    metrics: LayoutMetrics,
    blockSize: { width: number; height: number; gap: number }
  ) => {
    const wordCount = blocks.length
    const totalWidth = wordCount * blockSize.width + (wordCount - 1) * blockSize.gap
    const startX = -totalWidth / 2 + blockSize.width / 2
    
    blocks.forEach((block, i) => {
      block.position.x = startX + i * (blockSize.width + blockSize.gap)
      block.position.y = metrics.wordBlocksY
      block.position.z = 0
      
      // Update originalPosition in wordBlockData for snap-back
      const data = wordBlockData.get(block)
      if (data) {
        data.originalPosition = block.position.clone()
      }
    })
  }
  
  // Update camera to fit layout metrics
  const updateCamera = (metrics: LayoutMetrics) => {
    camera.orthoLeft = -metrics.worldWidth / 2
    camera.orthoRight = metrics.worldWidth / 2
    camera.orthoBottom = -metrics.worldHeight / 2
    camera.orthoTop = metrics.worldHeight / 2
    
    console.log("[juice-squeeze] Camera bounds:", {
      left: camera.orthoLeft,
      right: camera.orthoRight,
      top: camera.orthoTop,
      bottom: camera.orthoBottom,
      worldWidth: metrics.worldWidth,
      worldHeight: metrics.worldHeight,
    })
  }
  
  // Initial camera setup
  const initialMetrics = getLayoutMetrics()
  updateCamera(initialMetrics)
  
  console.log("[juice-squeeze] Camera:", {
    type: "Orthographic",
    position: camera.position,
    target: camera.getTarget(),
    mode: camera.mode,
    orthoLeft: camera.orthoLeft,
    orthoRight: camera.orthoRight,
    orthoTop: camera.orthoTop,
    orthoBottom: camera.orthoBottom,
  })

  // Light setup - bright tropical lighting with shadows
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.8 // Brighter for tropical feel
  hemi.diffuse = new Color3(1, 1, 0.9) // Warm light
  
  // Add directional light for better 3D depth and shadows
  const dirLight = new DirectionalLight("dirLight", new Vector3(-0.5, -1, -0.3), scene)
  dirLight.intensity = 0.6
  dirLight.diffuse = new Color3(1, 1, 0.95)
  
  // Shadow generator for 3D depth
  const shadowGenerator = new ShadowGenerator(2048, dirLight)
  shadowGenerator.useBlurExponentialShadowMap = true
  shadowGenerator.blurKernel = 32
  shadowGenerator.setDarkness(0.3)

  // Word blocks storage for dragging and sentence building (Babylon.js rendering state - stays local)
  let wordBlocks: Mesh[] = []
  let wordBlockData: Map<Mesh, { word: string; originalIndex: number; originalPosition: Vector3; isInSentence: boolean }> = new Map()
  
  let sentenceAreaMesh: Mesh | null = null // Store reference to update size
  let sentenceAreaWidth = 60 // Track current sentence area width for collision detection

  // Fruit slice colors (orange, mango, papaya)
  const fruitColors = ["#FFB84D", "#FF6B6B", "#FFE66D"] // Orange, Pink, Yellow

  // Create sentence building area with dynamic sizing
  const createSentenceArea = (metrics: LayoutMetrics, blockSize?: { width: number; gap: number }, wordCount?: number) => {
    // Dispose old area if exists
    if (sentenceAreaMesh) {
      sentenceAreaMesh.dispose()
    }
    
    // Calculate width from word count and block size, or use default
    let areaWidth: number
    if (blockSize && wordCount) {
      const totalWidth = wordCount * blockSize.width + (wordCount - 1) * blockSize.gap
      areaWidth = Math.max(metrics.worldWidth * 0.6, totalWidth + metrics.worldWidth * 0.1) // Add 10% padding
    } else {
      areaWidth = metrics.worldWidth * 0.8 // Default width
    }
    
    sentenceAreaWidth = areaWidth // Store width for collision detection
    
    // Calculate height as percentage of world height (12% of height)
    const areaHeight = metrics.worldHeight * 0.12
    const areaY = metrics.sentenceAreaY
    
    const area = MeshBuilder.CreatePlane("sentence-area", { width: areaWidth, height: areaHeight }, scene)
    area.position = new Vector3(0, areaY, 0)
    
    const areaTexture = new DynamicTexture("sentence-area-texture", { width: 1024, height: 512 }, scene, true)
    areaTexture.hasAlpha = true
    const ctx = areaTexture.getContext() as CanvasRenderingContext2D
    
    // Light background with subtle border
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)" // Semi-transparent white
    ctx.fillRect(0, 0, 1024, 512)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"
    ctx.lineWidth = 8
    ctx.strokeRect(4, 4, 1016, 504)
    
    areaTexture.update()
    
    const areaMaterial = new StandardMaterial("sentence-area-material", scene)
    areaMaterial.diffuseTexture = areaTexture
    areaMaterial.useAlphaFromDiffuseTexture = true
    areaMaterial.emissiveColor = new Color3(1, 1, 1)
    areaMaterial.opacityTexture = areaTexture
    area.material = areaMaterial
    
    sentenceAreaMesh = area
    return area
  }
  
  // Convert language code to readable name
  const getLanguageName = (code: string): string => {
    const languageNames: Record<string, string> = {
      en: "English",
      es: "Spanish",
      fr: "French",
      it: "Italian",
      "pt-BR": "Portuguese (BR)",
      de: "German",
      pl: "Polish",
      ru: "Russian",
      hu: "Hungarian",
      tr: "Turkish",
      ar: "Arabic",
      fa: "Persian",
      hi: "Hindi",
      bn: "Bengali",
      th: "Thai",
      vi: "Vietnamese",
      id: "Indonesian",
      "zh-Hans": "Chinese (Simplified)",
      "zh-Hant": "Chinese (Traditional)",
      "ko-polite": "Korean (Polite)",
      ja: "Japanese",
      ta: "Tamil",
      te: "Telugu",
      kn: "Kannada",
      mr: "Marathi",
      gu: "Gujarati",
      "pa-Guru": "Punjabi (Gurmukhi)",
      "pa-Arab": "Punjabi (Shahmukhi)",
      ur: "Urdu",
    }
    return languageNames[code] || code
  }

  // Create target phrase display with language label (viewport-based)
  const createTargetPhraseDisplay = (text: string, languageCode: string, metrics: LayoutMetrics) => {
    // Remove old display if exists
    const oldDisplay = root.querySelector(".target-phrase-display")
    if (oldDisplay) {
      oldDisplay.remove()
    }
    
    const languageName = getLanguageName(languageCode)
    const canvasElement = engine.getRenderingCanvas()
    if (!canvasElement) return
    
    // Get canvas bounding rect for pixel positioning
    const canvasRect = canvasElement.getBoundingClientRect()
    const canvasHeight = canvasElement.height
    
    // Convert world Y coordinate to CSS pixel position
    // World Y is positive up, CSS Y is positive down from top
    // pixelY = (canvasHeight / 2) - (worldY * pixelsPerUnit)
    const worldY = metrics.targetPhraseY
    const pixelY = canvasRect.top + (canvasHeight / 2) - (worldY * metrics.pixelsPerUnit)
    
    // Responsive font sizes based on viewport percentage
    const viewportWidth = canvasElement.width
    const labelFontSize = Math.max(14, Math.min(22, viewportWidth * 0.04)) // 4% of width
    const phraseFontSize = Math.max(20, Math.min(36, viewportWidth * 0.055)) // 5.5% of width
    
    const display = document.createElement("div")
    display.className = "target-phrase-display"
    
    // Create language label
    const label = document.createElement("div")
    label.textContent = `${languageName}:`
    label.style.cssText = `
      font-size: ${labelFontSize}px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
      text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    `
    
    // Create phrase text
    const phrase = document.createElement("div")
    phrase.textContent = text
    phrase.style.cssText = `
      font-size: ${phraseFontSize}px;
      font-weight: bold;
      color: white;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
      line-height: 1.2;
    `
    
    display.appendChild(label)
    display.appendChild(phrase)
    
    display.style.cssText = `
      position: fixed;
      top: ${pixelY}px;
      left: 50%;
      transform: translateX(-50%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 1000;
      pointer-events: none;
      text-align: center;
      padding: 0 20px;
      max-width: 90vw;
    `
    root.appendChild(display)
  }
  
  // Create "Build in: [Language]" label near word blocks area (viewport-based)
  const createBlockLanguageLabel = (languageCode: string, metrics: LayoutMetrics) => {
    // Remove old label if exists
    const oldLabel = root.querySelector(".block-language-label")
    if (oldLabel) {
      oldLabel.remove()
    }
    
    const languageName = getLanguageName(languageCode)
    const canvasElement = engine.getRenderingCanvas()
    if (!canvasElement) return
    
    // Get canvas bounding rect for pixel positioning
    const canvasRect = canvasElement.getBoundingClientRect()
    const canvasHeight = canvasElement.height
    
    // Convert world Y coordinate to CSS pixel position
    // World Y is positive up, CSS Y is positive down from top
    const worldY = metrics.blockLabelY
    const pixelY = canvasRect.top + (canvasHeight / 2) - (worldY * metrics.pixelsPerUnit)
    
    // Responsive font size based on viewport percentage
    const viewportWidth = canvasElement.width
    const labelFontSize = Math.max(16, Math.min(24, viewportWidth * 0.04)) // 4% of width
    const padding = Math.max(6, Math.min(12, viewportWidth * 0.02)) // 2% of width
    
    const label = document.createElement("div")
    label.className = "block-language-label"
    label.textContent = `Build in: ${languageName}`
    label.style.cssText = `
      position: fixed;
      top: ${pixelY}px;
      left: 50%;
      transform: translateX(-50%);
      font-size: ${labelFontSize}px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.95);
      text-shadow: 2px 2px 4px rgba(0,0,0,0.6);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 1000;
      pointer-events: none;
      text-align: center;
      padding: ${padding}px ${padding * 2}px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      backdrop-filter: blur(4px);
    `
    root.appendChild(label)
  }

  // Create fruit particle texture for win animations
  const createFruitParticleTexture = () => {
    return new Texture(
      "data:image/svg+xml;base64," +
        btoa(
          `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">` +
            `<circle cx="16" cy="16" r="14" fill="white"/>` +
          `</svg>`
        ),
      scene
    )
  }

  // Create win particle explosion
  const createWinParticles = (position: Vector3) => {
    console.log("[juice-squeeze]    Creating particle system at position:", position)
    try {
      const particleSystem = new ParticleSystem("winParticles", 300, scene)
      
      particleSystem.createSphereEmitter(2.0) // Larger emitter for more visible effect
      particleSystem.particleTexture = createFruitParticleTexture()
      
      // Bright fruit colors (orange, pink, yellow)
      particleSystem.color1 = new Color4(1, 0.72, 0.3, 1) // Orange
      particleSystem.color2 = new Color4(1, 0.42, 0.42, 1) // Pink
      particleSystem.colorDead = new Color4(1, 0.9, 0.43, 0) // Yellow fade
      
      // Larger, more visible particles
      particleSystem.minSize = 0.3
      particleSystem.maxSize = 0.8
      particleSystem.minLifeTime = 1.0
      particleSystem.maxLifeTime = 2.0
      particleSystem.emitRate = 3000
      particleSystem.manualEmitCount = 300 // More particles
      particleSystem.minEmitPower = 4
      particleSystem.maxEmitPower = 8
      particleSystem.updateSpeed = 0.01
      particleSystem.gravity = new Vector3(0, -2, 0) // Stronger gravity
      
      particleSystem.emitter = position.clone()
      particleSystem.start()
      console.log("[juice-squeeze]    ✅ Particle system started")
      
      setTimeout(() => {
        particleSystem.stop()
        particleSystem.dispose()
        console.log("[juice-squeeze]    Particle system disposed")
      }, 2000) // Longer duration
    } catch (error) {
      console.error("[juice-squeeze]    ❌ Error creating particles:", error)
    }
  }

  // Check if sentence is complete and correct
  const checkWin = () => {
    const state = useGameStore.getState()
    const { hasWon, phrase } = state
    
    console.log("[juice-squeeze] ========================================")
    console.log("[juice-squeeze] 🎯 CHECKING WIN CONDITION")
    console.log("[juice-squeeze] ========================================")
    console.log("[juice-squeeze]    hasWon:", hasWon)
    
    if (hasWon) {
      console.log("[juice-squeeze]    Already won, skipping check")
      return // Prevent multiple wins
    }
    
    const wordsInSentence = Array.from(wordBlockData.values())
      .filter((data) => data.isInSentence)
      .sort((a, b) => {
        // Get position in sentence area by finding the mesh
        const meshA = Array.from(wordBlockData.entries()).find(([_, d]) => d === a)?.[0]
        const meshB = Array.from(wordBlockData.entries()).find(([_, d]) => d === b)?.[0]
        if (!meshA || !meshB) return 0
        return meshA.position.x - meshB.position.x
      })
      .map((data) => data.word)
    
    console.log("[juice-squeeze]    Words in sentence area:", wordsInSentence)
    console.log("[juice-squeeze]    Words in sentence count:", wordsInSentence.length)
    console.log("[juice-squeeze]    Correct words:", phrase.correctWords)
    console.log("[juice-squeeze]    Correct words count:", phrase.correctWords.length)
    
    if (wordsInSentence.length === phrase.correctWords.length) {
      console.log("[juice-squeeze]    ✅ Word count matches!")
      const isCorrect = wordsInSentence.every((word, i) => {
        const matches = word === phrase.correctWords[i]
        if (!matches) {
          console.log(`[juice-squeeze]    ❌ Mismatch at index ${i}: "${word}" !== "${phrase.correctWords[i]}"`)
        }
        return matches
      })
      console.log("[juice-squeeze]    Order is correct:", isCorrect)
      
      if (isCorrect && !hasWon) {
        console.log("[juice-squeeze]    🎉 WIN CONDITION MET!")
        useGameStore.getState().setWon(true)
        useGameStore.getState().incrementCompletedPhrases()
        useGameStore.getState().incrementScore()
        
        // WIN!
        console.log("[juice-squeeze]    Creating win particles...")
        const currentMetrics = getLayoutMetrics()
        const centerPos = new Vector3(0, currentMetrics.sentenceAreaY, 0)
        try {
          createWinParticles(centerPos)
          console.log("[juice-squeeze]    ✅ Win particles created")
        } catch (error) {
          console.error("[juice-squeeze]    ❌ Error creating particles:", error)
        }
        
        // Play TTS in block language (the language the player built)
        // Use the actual words from the sentence area to ensure complete text
        const completeSentence = wordsInSentence.join(" ")
        
        console.log("[juice-squeeze] ========================================")
        console.log("[juice-squeeze] 🔊 TTS CALL - WIN CONDITION MET (Completed Translation)")
        console.log("[juice-squeeze] ========================================")
        console.log("[juice-squeeze]    Words in sentence:", wordsInSentence)
        console.log("[juice-squeeze]    Complete sentence:", completeSentence)
        console.log("[juice-squeeze]    Sentence length:", completeSentence.length)
            const currentState = useGameStore.getState()
            const blockLang = currentState.phrase.blockLang || "en"
            console.log("[juice-squeeze]    Block language:", blockLang)
            console.log("[juice-squeeze]    hostApi available:", !!hostApi)
            console.log("[juice-squeeze]    hostApi.speak type:", typeof hostApi.speak)
            console.log("[juice-squeeze]    hostApi.speak function:", hostApi.speak)
            
            if (typeof hostApi.speak === "function") {
              try {
                console.log("[juice-squeeze]    BEFORE TTS CALL:")
                console.log("[juice-squeeze]      Language parameter:", blockLang)
                console.log("[juice-squeeze]      Text parameter:", completeSentence)
                console.log("[juice-squeeze]      Text type:", typeof completeSentence)
                console.log("[juice-squeeze]      Text length:", completeSentence.length)
                
                hostApi.speak(blockLang, completeSentence)
            
            console.log("[juice-squeeze]    AFTER TTS CALL:")
            console.log("[juice-squeeze] ✅ TTS call completed (no error thrown)")
            console.log("[juice-squeeze]    If TTS doesn't play, check:")
            console.log("[juice-squeeze]      1. Is hostApi.speak actually implemented?")
            console.log("[juice-squeeze]      2. Is the language code valid?", blockLang)
            console.log("[juice-squeeze]      3. Is the text non-empty?", completeSentence.length > 0)
          } catch (error) {
            console.error("[juice-squeeze] ❌ TTS call threw error:", error)
            if (error instanceof Error) {
              console.error("[juice-squeeze]    Error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack,
              })
            } else {
              console.error("[juice-squeeze]    Error (unknown type):", String(error))
            }
          }
        } else {
          console.error("[juice-squeeze] ❌ hostApi.speak is not a function!")
          console.error("[juice-squeeze]    Available hostApi methods:", Object.keys(hostApi))
          console.error("[juice-squeeze]    hostApi object:", hostApi)
        }
        
        console.log("[juice-squeeze] ========================================")
        
        // Show "Next Phrase" button
        console.log("[juice-squeeze]    Showing Next Phrase button...")
        nextPhraseButton.style.display = "block"
        nextPhraseButton.style.visibility = "visible"
        nextPhraseButton.style.opacity = "1"
        // Force a reflow to ensure visibility
        void nextPhraseButton.offsetHeight
        console.log("[juice-squeeze]    ✅ Next Phrase button displayed")
        console.log("[juice-squeeze]    Button computed style:", {
          display: window.getComputedStyle(nextPhraseButton).display,
          visibility: window.getComputedStyle(nextPhraseButton).visibility,
          opacity: window.getComputedStyle(nextPhraseButton).opacity,
          zIndex: window.getComputedStyle(nextPhraseButton).zIndex,
        })
        
        console.log("[juice-squeeze] WIN! Sentence:", completeSentence)
        console.log("[juice-squeeze] ========================================")
      } else {
        console.log("[juice-squeeze]    Order is incorrect or already won")
        console.log("[juice-squeeze] ========================================")
      }
    } else {
      console.log("[juice-squeeze]    Word count doesn't match")
      console.log("[juice-squeeze] ========================================")
    }
  }

  // Sentence area will be created when word blocks are loaded

  // Create 3D Corpán avatar (from hover-runner)
  const createCorpanAvatar = async () => {
    try {
      // Load the same GLB model hover-runner uses
      // Path from games/juice-squeeze/src to games/hover-runner/src/assets/models
      const corpanLogoUrl = "../../hover-runner/src/assets/models/corpan_logo.glb"
      const avatarContainer = new TransformNode("corpan-avatar-container", scene)
      avatarContainer.position = new Vector3(-10, 5, 0)
      
      // Gentle floating animation
      let floatTime = 0
      const floatAnimation = () => {
        if (disposed) return
        floatTime += 0.01
        avatarContainer.position.y = 5 + Math.sin(floatTime) * 0.3
        requestAnimationFrame(floatAnimation)
      }
      floatAnimation()
      
      SceneLoader.LoadAssetContainerAsync("", corpanLogoUrl, scene)
        .then((logoAsset) => {
          if (disposed) return
          logoAsset.addAllToScene()
          const logoRoot = logoAsset.transformNodes.find(
            (node) => node.name === "corpan_logo_root"
          )
          if (logoRoot) {
            logoRoot.parent = avatarContainer
          } else {
            logoAsset.meshes.forEach((mesh) => {
              if (!mesh.parent) {
                mesh.parent = avatarContainer
              }
            })
          }
          
          // Scale avatar to appropriate size for 2D orthographic view
          avatarContainer.scaling = new Vector3(2, 2, 2)
          
          console.log("[juice-squeeze] ✅ Corpán avatar loaded at (-10, 5, 0)")
        })
        .catch((error) => {
          console.warn("[juice-squeeze] Could not load Corpán avatar:", error)
        })
      
      return avatarContainer
    } catch (error) {
      console.warn("[juice-squeeze] Could not create Corpán avatar:", error)
      return null
    }
  }
  
  createCorpanAvatar()

  // Create title "Juice Squeeze" (responsive)
  const titleElement = document.createElement("div")
  titleElement.textContent = "Juice Squeeze"
  
  const updateTitleSize = () => {
    const viewport = window.visualViewport
    const viewportWidth = viewport?.width ?? window.innerWidth
    const viewportHeight = viewport?.height ?? window.innerHeight
    const titleFontSize = Math.max(28, Math.min(48, viewportWidth / 12))
    const titleTop = Math.max(60, Math.min(100, viewportHeight * 0.08))
    
    titleElement.style.fontSize = `${titleFontSize}px`
    titleElement.style.top = `${titleTop}px`
  }
  
  updateTitleSize()
  titleElement.style.cssText += `
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    font-weight: bold;
    color: #FF6B6B;
    text-shadow: 3px 3px 6px rgba(0,0,0,0.3), 0 0 20px rgba(255,107,107,0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    letter-spacing: 2px;
    z-index: 1000;
    pointer-events: none;
  `
  root.appendChild(titleElement)
  
  // Update title on resize
  const titleResizeHandler = () => updateTitleSize()
  window.addEventListener("resize", titleResizeHandler)

  // Create exit button
  const exitButton = document.createElement("button")
  exitButton.textContent = "✕"
  exitButton.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 44px;
    height: 44px;
    font-size: 24px;
    font-weight: bold;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    cursor: pointer;
    z-index: 1001;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  `
  exitButton.addEventListener("mouseenter", () => {
    exitButton.style.background = "rgba(255, 255, 255, 0.3)"
    exitButton.style.transform = "scale(1.1)"
  })
  exitButton.addEventListener("mouseleave", () => {
    exitButton.style.background = "rgba(255, 255, 255, 0.2)"
    exitButton.style.transform = "scale(1)"
  })
  exitButton.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("corpan:exit"))
  })
  root.appendChild(exitButton)

  // Create "Next Phrase" button
  const nextPhraseButton = document.createElement("button")
  nextPhraseButton.textContent = "Next Phrase"
  nextPhraseButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 16px 32px;
    font-size: 18px;
    font-weight: bold;
    background: #FF6B6B;
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    z-index: 1001;
    display: none;
    visibility: hidden;
    opacity: 0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: opacity 0.3s ease;
  `
  nextPhraseButton.addEventListener("click", () => {
    console.log("[juice-squeeze] Next Phrase button clicked")
    useGameStore.getState().setWon(false)
    useGameStore.getState().resetBlocks()
    nextPhraseButton.style.display = "none"
    nextPhraseButton.style.visibility = "hidden"
    nextPhraseButton.style.opacity = "0"
    createWordBlocks()
  })
  root.appendChild(nextPhraseButton)

  // Clear old word blocks
  const clearWordBlocks = () => {
    wordBlocks.forEach((block) => {
      block.dispose()
    })
    wordBlocks = []
    wordBlockData = new Map()
    
    // Clear language labels
    const oldTargetDisplay = root.querySelector(".target-phrase-display")
    if (oldTargetDisplay) {
      oldTargetDisplay.remove()
    }
    const oldBlockLabel = root.querySelector(".block-language-label")
    if (oldBlockLabel) {
      oldBlockLabel.remove()
    }
  }

  // Pick two random languages from stack config for translation practice
  const pickLanguagePair = (languages: string[]): [string, string] => {
    if (languages.length === 0) {
      return ["en", "en"] // Fallback
    }
    if (languages.length === 1) {
      return [languages[0], languages[0]] // Same language if only one
    }
    
    // Pick two different random languages
    const shuffled = [...languages].sort(() => Math.random() - 0.5)
    const langA = shuffled[0]
    const langB = shuffled[1]
    
    // Randomly decide which is target (shown at top) and which is blocks
    return Math.random() < 0.5 ? [langA, langB] : [langB, langA]
  }

  // Create word blocks from loaded utterance
  const createWordBlocks = async () => {
    // Clear existing blocks
    clearWordBlocks()
    useGameStore.getState().setWon(false)
    useGameStore.getState().resetBlocks()
    // Hide button while loading
    nextPhraseButton.style.display = "none"
    nextPhraseButton.style.visibility = "hidden"
    nextPhraseButton.style.opacity = "0"
    const state = useGameStore.getState()
    console.log("[juice-squeeze] Reset game state - hasWon:", state.hasWon)
    
    const stackConfig = hostApi.getStackConfig()
    
    // Pick two random languages for this round
    const [targetLang, blockLang] = pickLanguagePair(stackConfig.languages)
    console.log(`[juice-squeeze] Language pair: Target="${targetLang}" (shown at top), Block="${blockLang}" (word blocks)`)
    
    console.log("[juice-squeeze] Loading utterance with language pair...")
    const utterance = await loadUtterance(hostApi, 2, blockLang, targetLang)
    
    if (!utterance) {
      console.warn("[juice-squeeze] No utterance loaded!")
      return
    }

    console.log("[juice-squeeze] Utterance:", {
      id: utterance.id,
      blockText: utterance.text, // Text in block language
      targetText: utterance.targetText, // Text in target language
      wordCount: utterance.words.length,
      words: utterance.words,
    })

    // Store current utterance for camera calculation
    currentUtterance = utterance
    
    // Store phrase data in store
    const words = utterance.words
    useGameStore.getState().loadNewPhrase({
      id: utterance.id,
      targetText: utterance.targetText || null,
      blockText: utterance.text,
      targetLang,
      blockLang,
      correctWords: [...words], // Store correct order for win condition checking
      words: [...words],
    })
    
    const wordCount = words.length

    if (wordCount === 0) {
      console.warn("[juice-squeeze] No words in utterance!")
      return
    }

    // Create shuffled copy of words array for gameplay challenge!
    const shuffledWords = [...utterance.words].sort(() => Math.random() - 0.5)
    console.log(`[juice-squeeze] Original order (${blockLang}): [${words.join(", ")}]`)
    console.log(`[juice-squeeze] Scrambled order: [${shuffledWords.join(", ")}]`)

    // Get current layout metrics
    const metrics = getLayoutMetrics()
    
    // Calculate dynamic block size based on word count
    const blockSize = calculateBlockSize(wordCount, metrics)
    
    // Show target phrase (target language) below title with language label
    if (utterance.targetText) {
      createTargetPhraseDisplay(utterance.targetText, targetLang, metrics)
      console.log(`[juice-squeeze] Target phrase (${targetLang}) displayed: "${utterance.targetText}"`)
    } else {
      console.warn("[juice-squeeze] No target text available!")
      return
    }
    
    // Show "Build in: [Language]" label near word blocks area
    createBlockLanguageLabel(blockLang, metrics)

    console.log(`[juice-squeeze] Creating ${wordCount} word blocks (scrambled)`)

    // Create sentence area with dynamic sizing
    createSentenceArea(metrics, blockSize, wordCount)
    
    // Update camera to fit layout
    updateCamera(metrics)
    
    console.log(`[juice-squeeze] Dynamic layout: blockWidth=${blockSize.width.toFixed(2)}, blockHeight=${blockSize.height.toFixed(2)}, gap=${blockSize.gap.toFixed(2)}, fontSize=${blockSize.fontSize}, wordCount=${wordCount}`)
    
    // Calculate block positions - will be set after creating meshes
    const blockPositions: { x: number; y: number; z: number }[] = []
    const totalWidth = wordCount * blockSize.width + (wordCount - 1) * blockSize.gap
    const startX = -totalWidth / 2 + blockSize.width / 2
    
    shuffledWords.forEach((_, index) => {
      const x = startX + index * (blockSize.width + blockSize.gap)
      blockPositions.push({ x, y: metrics.wordBlocksY, z: 0 })
    })

      // Create texture for each word with fruit slice colors (using shuffled order)
      shuffledWords.forEach((word, shuffledIndex) => {
        // Find original index for correct ordering
        const originalIndex = words.indexOf(word)
        
        // Get position from calculated layout
        const pos = blockPositions[shuffledIndex]
        if (!pos) {
          console.error(`[juice-squeeze] No position for block ${shuffledIndex}`)
          return
        }
        
        console.log(`[juice-squeeze] Creating block ${shuffledIndex + 1}/${wordCount}: "${word}" (original index: ${originalIndex}) at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`)
      
      // High-quality texture resolution (1024x512 as specified)
      const textureWidth = 1024
      const textureHeight = 512
      const texture = new DynamicTexture(
        `word-texture-${utterance.id}-${shuffledIndex}`,
        { width: textureWidth, height: textureHeight },
        scene,
        true
      )
      texture.hasAlpha = true
      const ctx = texture.getContext() as CanvasRenderingContext2D

      // Use fruit slice color (cycle through colors)
      const fruitColor = fruitColors[shuffledIndex % fruitColors.length]
      
      // Clear and fill with fruit slice background
      ctx.clearRect(0, 0, textureWidth, textureHeight)
      ctx.fillStyle = fruitColor // Bright fruit color
      ctx.fillRect(0, 0, textureWidth, textureHeight)

      // Calculate font size to fill 80% of texture width
      // Start with large font size and shrink until text fits
      let fontSize = 300 // Start big
      ctx.font = `bold ${fontSize}px Arial`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      
      let textWidth = ctx.measureText(word).width
      
      // Shrink until text fits 80% of texture width
      while (textWidth > textureWidth * 0.8 && fontSize > 48) {
        fontSize -= 10
        ctx.font = `bold ${fontSize}px Arial`
        textWidth = ctx.measureText(word).width
      }
      
      // For short words, make them HUGE (fill vertically too)
      if (word.length <= 3) {
        const maxVerticalSize = textureHeight * 0.7
        fontSize = Math.min(fontSize, maxVerticalSize)
        ctx.font = `bold ${fontSize}px Arial`
      }
      
      // Thin border only (2px) for subtle definition
      ctx.strokeStyle = "rgba(0, 0, 0, 0.2)"
      ctx.lineWidth = 2
      ctx.strokeRect(1, 1, textureWidth - 2, textureHeight - 2)
      
      // Draw text with high contrast - pure black
      ctx.fillStyle = "#000000" // Pure black text
      ctx.fillText(word, textureWidth / 2, textureHeight / 2)

      texture.update()

      // Create plane mesh for word block with dynamic size
      const block = MeshBuilder.CreatePlane(
        `word-block-${utterance.id}-${shuffledIndex}`,
        { 
          width: blockSize.width, 
          height: blockSize.height
        },
        scene
      )

      // Position block from calculated layout
      const originalPosition = new Vector3(pos.x, pos.y, pos.z)
      block.position = originalPosition.clone()
      
      // Verify no overlap - log each block's position and edges
      const leftEdge = block.position.x - blockSize.width / 2
      const rightEdge = block.position.x + blockSize.width / 2
      console.log(`[juice-squeeze] Block "${word}" at x=${block.position.x.toFixed(2)}, width=${blockSize.width.toFixed(2)}, edges: ${leftEdge.toFixed(2)} to ${rightEdge.toFixed(2)}`)

      // Apply texture material with enhanced 3D depth
      const material = new StandardMaterial(`word-material-${utterance.id}-${shuffledIndex}`, scene)
      material.diffuseTexture = texture
      material.useAlphaFromDiffuseTexture = true
      material.emissiveTexture = texture
      material.emissiveColor = new Color3(0.9, 0.9, 0.9) // Brighter glow
      material.specularColor = new Color3(0.3, 0.3, 0.3) // More shine
      material.specularPower = 64
      material.ambientColor = new Color3(0.3, 0.3, 0.3) // Ambient lighting
      block.material = material
      
      // Enable shadows for 3D depth
      block.receiveShadows = true
      shadowGenerator.addShadowCaster(block)

      // Store block data
      wordBlockData.set(block, {
        word,
        originalIndex: originalIndex, // Use originalIndex for win checking
        originalPosition,
        isInSentence: false,
      })

      // Add dragging behavior
      const dragBehavior = new PointerDragBehavior({
        dragPlaneNormal: new Vector3(0, 0, 1), // Drag in XY plane
      })
      dragBehavior.attach(block)
      
      dragBehavior.onDragStartObservable.add(() => {
        // Scale up and lift when dragging for better feedback
        block.scaling = new Vector3(1.15, 1.15, 1.15)
        block.position.z = 1 // Lift above other blocks (small fixed value for plane)
      })
      
      dragBehavior.onDragEndObservable.add(() => {
        // Reset scale and position
        block.scaling = new Vector3(1, 1, 1)
        
        const data = wordBlockData.get(block)
        if (!data) return
        
        // Check if dropped in sentence area (using current metrics)
        const currentMetrics = getLayoutMetrics()
        const sentenceAreaY = currentMetrics.sentenceAreaY
        const sentenceAreaHeight = currentMetrics.worldHeight * 0.12 // 12% of height
        const isInSentenceArea = 
          block.position.y >= sentenceAreaY - sentenceAreaHeight / 2 &&
          block.position.y <= sentenceAreaY + sentenceAreaHeight / 2 &&
          Math.abs(block.position.x) <= sentenceAreaWidth / 2
        
        if (isInSentenceArea) {
          // Mark as in sentence area (but still draggable!)
          data.isInSentence = true
          // Snap Y to sentence area center and reset Z
          block.position.y = sentenceAreaY
          block.position.z = 0
          
          // Arrange all words in sentence area by X position (allows reordering)
          // Use tight spacing for sentence area (blockWidth * 1.1)
          const wordsInSentence = Array.from(wordBlockData.values())
            .filter((d) => d.isInSentence)
            .map((d) => {
              const mesh = Array.from(wordBlockData.entries()).find(([_, data]) => data === d)?.[0]
              return { data: d, mesh, x: mesh?.position.x || 0 }
            })
            .sort((a, b) => a.x - b.x) // Sort by current X position (allows reordering)
          
          // Tight spacing in sentence area - pack blocks together
          const currentMetrics = getLayoutMetrics()
          const currentWordCount = currentUtterance?.words?.length || wordsInSentence.length
          const currentBlockSize = calculateBlockSize(currentWordCount, currentMetrics)
          const sentenceSpacing = currentBlockSize.width * 1.1
          const sentenceStartX = -(wordsInSentence.length - 1) * sentenceSpacing / 2
          const sentenceAreaYPos = currentMetrics.sentenceAreaY
          wordsInSentence.forEach((item, i) => {
            if (item.mesh) {
              item.mesh.position.x = sentenceStartX + i * sentenceSpacing
              item.mesh.position.y = sentenceAreaYPos
            }
          })
          
          // Check win condition (but don't lock blocks)
          checkWin()
        } else {
          // Dragged out of sentence area - return to original position
          data.isInSentence = false
          const targetPos = data.originalPosition.clone()
          
          // Animate snap back
          const snapBack = () => {
            const currentPos = block.position
            const diff = targetPos.subtract(currentPos)
            if (diff.length() > 0.1) {
              block.position = currentPos.add(diff.scale(0.2))
              requestAnimationFrame(snapBack)
            } else {
              block.position = targetPos
              block.position.z = 0 // Reset Z position
            }
          }
          snapBack()
          
          // Re-arrange remaining words in sentence area
          const wordsInSentence = Array.from(wordBlockData.values())
            .filter((d) => d.isInSentence)
            .map((d) => {
              const mesh = Array.from(wordBlockData.entries()).find(([_, data]) => data === d)?.[0]
              return { data: d, mesh, x: mesh?.position.x || 0 }
            })
            .sort((a, b) => a.x - b.x)
          
          if (wordsInSentence.length > 0) {
            // Tight spacing in sentence area - pack blocks together
            const currentMetrics = getLayoutMetrics()
            const currentBlockSize = calculateBlockSize(currentUtterance?.words?.length || wordsInSentence.length, currentMetrics)
            const sentenceSpacing = currentBlockSize.width * 1.1
            const sentenceStartX = -(wordsInSentence.length - 1) * sentenceSpacing / 2
            const sentenceAreaYPos = currentMetrics.sentenceAreaY
            wordsInSentence.forEach((item, i) => {
              if (item.mesh) {
                item.mesh.position.x = sentenceStartX + i * sentenceSpacing
                item.mesh.position.y = sentenceAreaYPos
              }
            })
          }
        }
      })

      wordBlocks.push(block)
    })
    
    // Position all blocks using the positioning function
    positionWordBlocks(wordBlocks, metrics, blockSize)
    
    console.log(`[juice-squeeze] Created ${wordBlocks.length} word blocks total`)
    
    // Play target phrase TTS at round start (player hears what they need to translate)
    const phraseState = useGameStore.getState().phrase
    if (utterance.targetText && phraseState.targetLang) {
      const playTargetTTS = () => {
        const targetText = utterance.targetText!
        const targetLang = phraseState.targetLang!
        
        console.log("[juice-squeeze] ========================================")
        console.log("[juice-squeeze] 🔊 TTS CALL - ROUND START (Target Phrase)")
        console.log("[juice-squeeze] ========================================")
        console.log("[juice-squeeze]    Target phrase:", targetText)
        console.log("[juice-squeeze]    Target language:", targetLang)
        console.log("[juice-squeeze]    hostApi available:", !!hostApi)
        console.log("[juice-squeeze]    hostApi.speak type:", typeof hostApi.speak)
        
        if (typeof hostApi.speak === "function") {
          try {
            console.log("[juice-squeeze]    BEFORE TTS CALL:")
            console.log("[juice-squeeze]      Language parameter:", targetLang)
            console.log("[juice-squeeze]      Text parameter:", targetText)
            console.log("[juice-squeeze]      Text type:", typeof targetText)
            console.log("[juice-squeeze]      Text length:", targetText.length)
            
            hostApi.speak(targetLang, targetText)
            
            console.log("[juice-squeeze]    AFTER TTS CALL:")
            console.log("[juice-squeeze] ✅ Target phrase TTS call completed (no error thrown)")
            console.log("[juice-squeeze]    If TTS doesn't play, check:")
            console.log("[juice-squeeze]      1. Is hostApi.speak actually implemented?")
            console.log("[juice-squeeze]      2. Is the language code valid?", targetLang)
            console.log("[juice-squeeze]      3. Is the text non-empty?", targetText.length > 0)
          } catch (error) {
            console.error("[juice-squeeze] ❌ Target phrase TTS call threw error:", error)
            if (error instanceof Error) {
              console.error("[juice-squeeze]    Error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack,
              })
            } else {
              console.error("[juice-squeeze]    Error (unknown type):", String(error))
            }
          }
        } else {
          console.error("[juice-squeeze] ❌ hostApi.speak is not a function!")
          console.error("[juice-squeeze]    Available hostApi methods:", Object.keys(hostApi))
        }
        console.log("[juice-squeeze] ========================================")
      }
      
      // Small delay to ensure blocks are rendered before TTS
      setTimeout(playTargetTTS, 500)
    }
  }

  // Load and create word blocks
  createWordBlocks().catch((err) => {
    console.error("[juice-squeeze] Failed to load utterances:", err)
  })

  const onResize = () => {
    if (disposed) {
      return
    }
    updateViewportSize()
    engine.setHardwareScalingLevel(
      1 / Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio)
    )
    engine.resize()
    
    // Get new layout metrics
    const metrics = getLayoutMetrics()
    
    // Update camera
    updateCamera(metrics)
    
    // If we have blocks, recalculate and reposition everything
    if (currentUtterance && wordBlocks.length > 0) {
      const wordCount = currentUtterance.words.length
      const blockSize = calculateBlockSize(wordCount, metrics)
      
      // Reposition all blocks
      positionWordBlocks(wordBlocks, metrics, blockSize)
      
      // Update sentence area
      createSentenceArea(metrics, blockSize, wordCount)
      
      // Update UI overlays
      const phraseState = useGameStore.getState().phrase
      if (phraseState.targetText && phraseState.targetLang) {
        createTargetPhraseDisplay(phraseState.targetText, phraseState.targetLang, metrics)
      }
      if (phraseState.blockLang) {
        createBlockLanguageLabel(phraseState.blockLang, metrics)
      }
    }
  }
  
  // Initial camera setup already done above

  let resizeFrame = 0
  let resizeTimeout: number | null = null
  const scheduleResize = () => {
    if (resizeFrame) {
      window.cancelAnimationFrame(resizeFrame)
    }
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0
      onResize()
    })
    if (resizeTimeout != null) {
      window.clearTimeout(resizeTimeout)
    }
    resizeTimeout = window.setTimeout(onResize, 250)
  }

  scheduleResize()
  window.addEventListener("resize", scheduleResize)
  window.addEventListener("orientationchange", scheduleResize)
  if (window.screen?.orientation) {
    window.screen.orientation.addEventListener("change", scheduleResize)
  }
  const visualViewport = window.visualViewport
  if (visualViewport) {
    visualViewport.addEventListener("resize", scheduleResize)
    visualViewport.addEventListener("scroll", scheduleResize)
  }

  engine.runRenderLoop(() => {
    if (!disposed) {
      scene.render()
    }
  })

  const dispose = () => {
    if (disposed) {
      return
    }
    disposed = true

    // Clear word blocks
    clearWordBlocks()
    
    // Remove UI elements
    nextPhraseButton.remove()
    titleElement.remove()
    exitButton.remove()
    
    // Remove title resize handler
    window.removeEventListener("resize", titleResizeHandler)

    if (resizeFrame) {
      window.cancelAnimationFrame(resizeFrame)
      resizeFrame = 0
    }
    if (resizeTimeout != null) {
      window.clearTimeout(resizeTimeout)
      resizeTimeout = null
    }
    window.removeEventListener("resize", scheduleResize)
    window.removeEventListener("orientationchange", scheduleResize)
    if (window.screen?.orientation) {
      window.screen.orientation.removeEventListener("change", scheduleResize)
    }
    if (visualViewport) {
      visualViewport.removeEventListener("resize", scheduleResize)
      visualViewport.removeEventListener("scroll", scheduleResize)
    }
    engine.stopRenderLoop()
    scene.dispose()
    engine.dispose()
    root.remove()
  }

  return { dispose }
}

