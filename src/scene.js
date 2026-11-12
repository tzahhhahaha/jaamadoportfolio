import * as THREE from 'three';
import gsap from 'gsap';

export class SceneManager {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070913);
    this.scene.fog = new THREE.FogExp2(0x070913, 0.011);

    this.initCamera();
    this.initRenderer();
    this.initLights();
    this.initControls();

    window.addEventListener('resize', this.onResize.bind(this));
  }

  initCamera() {
    // Isometric angle with low FOV for true isometric diorama aesthetic
    this.camera = new THREE.PerspectiveCamera(38, this.width / this.height, 0.5, 500);
    this.defaultCameraPos = new THREE.Vector3(44, 38, 44);
    this.defaultTarget = new THREE.Vector3(0, 2, 0);

    this.camera.position.copy(this.defaultCameraPos);
    this.camera.lookAt(this.defaultTarget);
    this.targetLookAt = this.defaultTarget.clone();
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.container.appendChild(this.renderer.domElement);
  }

  initLights() {
    // Crisp cyberpunk ambient fill
    const ambientLight = new THREE.AmbientLight(0x3b4758, 1.35);
    this.scene.add(ambientLight);

    // Main isometric sun casting sharp subtle soft voxel shadows
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    sunLight.position.set(35, 55, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 130;
    sunLight.shadow.camera.left = -45;
    sunLight.shadow.camera.right = 45;
    sunLight.shadow.camera.top = 45;
    sunLight.shadow.camera.bottom = -45;
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.radius = 2.0; // subtle soft shadow edges
    this.scene.add(sunLight);

    // Rim backlight for cyberpunk edge illumination
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.25);
    rimLight.position.set(-30, 25, -35);
    this.scene.add(rimLight);
  }

  initControls() {
    // Simple custom orbit & pan mouse tracking without full orbitcontrols overhead
    this.isMouseDown = false;
    this.prevMousePos = { x: 0, y: 0 };
    this.orbitAngles = { theta: Math.PI / 4, phi: Math.PI / 3.4 };
    this.distance = 70;
    this.orbitCenter = new THREE.Vector3(0, 2, 0);

    const onMouseDown = (e) => {
      if (e.target.tagName !== 'CANVAS') return;
      this.isMouseDown = true;
      this.prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!this.isMouseDown) return;
      const dx = (e.clientX - this.prevMousePos.x) * 0.005;
      const dy = (e.clientY - this.prevMousePos.y) * 0.005;

      this.orbitAngles.theta -= dx;
      this.orbitAngles.phi = Math.max(0.2, Math.min(Math.PI / 2.1, this.orbitAngles.phi - dy));

      this.updateCameraOrbit();
      this.prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      this.isMouseDown = false;
    };

    const onWheel = (e) => {
      if (e.target.tagName !== 'CANVAS') return;
      this.distance = Math.max(30, Math.min(110, this.distance + e.deltaY * 0.05));
      this.updateCameraOrbit();
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('wheel', onWheel, { passive: true });
  }

  updateCameraOrbit() {
    const x = this.orbitCenter.x + this.distance * Math.sin(this.orbitAngles.phi) * Math.sin(this.orbitAngles.theta);
    const y = this.orbitCenter.y + this.distance * Math.cos(this.orbitAngles.phi);
    const z = this.orbitCenter.z + this.distance * Math.sin(this.orbitAngles.phi) * Math.cos(this.orbitAngles.theta);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.orbitCenter);
  }

  // Smooth cinematic camera focus transition
  focusOn(position, targetLook, duration = 1.8) {
    gsap.to(this.orbitCenter, {
      x: targetLook.x,
      y: targetLook.y,
      z: targetLook.z,
      duration: duration,
      ease: 'power2.out'
    });

    gsap.to(this.camera.position, {
      x: position.x,
      y: position.y,
      z: position.z,
      duration: duration,
      ease: 'power2.out',
      onUpdate: () => {
        this.camera.lookAt(this.orbitCenter);
      }
    });
  }

  // Camera presets
  setCameraPreset(preset) {
    if (preset === 'isometric') {
      this.focusOn(new THREE.Vector3(44, 38, 44), new THREE.Vector3(0, 2, 0), 1.5);
    } else if (preset === 'topdown') {
      this.focusOn(new THREE.Vector3(0.1, 75, 0), new THREE.Vector3(0, 0, 0), 1.5);
    } else if (preset === 'cinematic') {
      this.focusOn(new THREE.Vector3(28, 22, 38), new THREE.Vector3(0, 3, 0), 2.0);
    }
  }

  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

