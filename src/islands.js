import * as THREE from 'three';
import gsap from 'gsap';
import { sound } from './audio.js';

// Helper to create pixel text canvas textures
function createTextTexture(text, bgColor = 'transparent', textColor = '#ffffff', fontSize = 28, borderColor = null) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  if (bgColor !== 'transparent') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 128);
  }

  if (borderColor) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 504, 120);
  }

  ctx.fillStyle = textColor;
  ctx.font = `bold ${fontSize}px "Press Start 2P", monospace, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

// Helper to generate animated CRT matrix code texture
export function createMatrixTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const chars = '01OPTISTANCE_AI_CHEERPOSE_RECOGNITION_SELF_ASSESSMENT_TRAINING_VALIANTS_FIX_NI_PAPS_';
  const drops = Array(16).fill(0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;

  function update() {
    ctx.fillStyle = 'rgba(5, 20, 10, 0.25)';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 14px monospace';

    for (let i = 0; i < drops.length; i++) {
      const char = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(char, i * 16, drops[i] * 16);

      if (drops[i] * 16 > 256 && Math.random() > 0.96) {
        drops[i] = 0;
      }
      drops[i]++;
    }
    texture.needsUpdate = true;
  }

  return { texture, update };
}

// Helper to generate art canvas painting
function createPaintingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Vibrant pixel sunset over mountains
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#3b82f6');
  grad.addColorStop(0.4, '#a855f7');
  grad.addColorStop(0.7, '#f97316');
  grad.addColorStop(1, '#facc15');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Pixel sun
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(128, 140, 40, 0, Math.PI * 2);
  ctx.fill();

  // Pixel mountain ridges
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.moveTo(0, 256);
  ctx.lineTo(80, 150);
  ctx.lineTo(160, 200);
  ctx.lineTo(256, 130);
  ctx.lineTo(256, 256);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

export class WorldBuilder {
  constructor(scene) {
    this.scene = scene;
    this.interactiveObjects = []; // for raycasting
    this.animatedElements = [];
    this.paths = {};
    this.beacons = {}; // Destination landing beacon pads
    this.islandLights = {}; // Whole-island dynamic illumination lights
    this.islandCenters = {
      hub: new THREE.Vector3(0, 3.8, 0),
      chapter1: new THREE.Vector3(-24, 0.8, -24), // Elementary Top-Left
      chapter2: new THREE.Vector3(-24, 0.8, 24),  // CCSA Junior High Bottom-Left
      chapter3: new THREE.Vector3(24, 0.8, 24),   // Trace Senior High Bottom-Right
      chapter4: new THREE.Vector3(24, 0.8, -24)   // CCC College Top-Right
    };

    this.initSharedMaterials();
  }

  // Create destination landing beacon pad
  createLandingBeacon(colorHex, radius = 2.2) {
    const group = new THREE.Group();

    // Concentric inner ring
    const r1Geo = new THREE.RingGeometry(radius * 0.65, radius * 0.82, 32);
    r1Geo.rotateX(-Math.PI / 2);
    const r1Mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const r1 = new THREE.Mesh(r1Geo, r1Mat);
    r1.position.y = 0.02;

    // Concentric outer tech ring
    const r2Geo = new THREE.RingGeometry(radius * 0.92, radius * 1.08, 32);
    r2Geo.rotateX(-Math.PI / 2);
    const r2Mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.6,
      wireframe: true,
      side: THREE.DoubleSide
    });
    const r2 = new THREE.Mesh(r2Geo, r2Mat);
    r2.position.y = 0.025;

    // Vertical holographic beacon cylinder
    const cylGeo = new THREE.CylinderGeometry(radius * 0.85, radius * 0.85, 9, 24, 1, true);
    const cylMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const cyl = new THREE.Mesh(cylGeo, cylMat);
    cyl.position.y = 4.5;

    group.add(r1, r2, cyl);

    return {
      group,
      r1,
      r2,
      cyl,
      r1Mat,
      r2Mat,
      cylMat,
      isActive: false,
      colorHex
    };
  }

  initSharedMaterials() {
    this.mat = {
      islandBase: new THREE.MeshStandardMaterial({ color: 0x0c1022, roughness: 0.8, metalness: 0.2 }),
      islandTopDark: new THREE.MeshStandardMaterial({ color: 0x161f38, roughness: 0.7 }),
      islandGrass: new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.9 }),
      woodParquet: new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.6 }),
      metalDark: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.7 }),
      metalSilver: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.2, metalness: 0.9 }),

      // Neon glowing materials
      neonCyan: new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00e5ff, emissiveIntensity: 1.5, roughness: 0.2 }),
      neonBlue: new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x2563eb, emissiveIntensity: 1.5, roughness: 0.2 }),
      neonPurple: new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x9333ea, emissiveIntensity: 1.5, roughness: 0.2 }),
      neonEmerald: new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 1.5, roughness: 0.2 }),
      neonAmber: new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 1.5, roughness: 0.2 }),

      // Glass and holograms
      holoCyan: new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65, wireframe: true }),
      holoShield: new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.8 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, transmission: 0.8, roughness: 0.1 })
    };
  }

  buildAll() {
    this.buildHub();
    this.buildChapter1Elementary();
    this.buildChapter2CCSA();
    this.buildChapter3Trace();
    this.buildChapter4CCC();
    this.buildNeonPathways();
    return this;
  }

  // ==========================================
  // 1. ELEVATED INTERACTIVE JOURNEY HUB
  // ==========================================
  buildHub() {
    const hubGroup = new THREE.Group();
    hubGroup.name = 'island-hub';
    hubGroup.position.set(0, 0, 0);

    // Stepped hexagonal floating plinth
    const baseCylGeo = new THREE.CylinderGeometry(8.5, 9.8, 3.2, 6);
    const baseMesh = new THREE.Mesh(baseCylGeo, this.mat.islandBase);
    baseMesh.position.y = 1.6;
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    hubGroup.add(baseMesh);

    // Glowing rim border
    const rimGeo = new THREE.CylinderGeometry(8.7, 8.7, 0.3, 6);
    const rimMesh = new THREE.Mesh(rimGeo, this.mat.neonAmber);
    rimMesh.position.y = 3.25;
    hubGroup.add(rimMesh);

    // Top cyber platform deck
    const deckGeo = new THREE.CylinderGeometry(8.4, 8.4, 0.4, 6);
    const deckMesh = new THREE.Mesh(deckGeo, this.mat.islandTopDark);
    deckMesh.position.y = 3.5;
    deckMesh.receiveShadow = true;
    hubGroup.add(deckMesh);

    // Elevated Center Pedestal where character stands
    const pedGeo = new THREE.CylinderGeometry(3.2, 3.6, 0.3, 6);
    const pedMesh = new THREE.Mesh(pedGeo, this.mat.neonCyan);
    pedMesh.position.y = 3.75;
    hubGroup.add(pedMesh);

    // Destination Landing Beacon Pad on Hub
    this.beacons.hub = this.createLandingBeacon(0xf59e0b, 2.8);
    this.beacons.hub.group.position.set(0, 3.76, 0);
    this.beacons.hub.isActive = true; // Initial active station
    hubGroup.add(this.beacons.hub.group);

    // Hub Whole-Island Radiant Illumination (Brilliant Amber + Daylight Fill)
    const hubLight = new THREE.PointLight(0xf59e0b, 28.0, 52, 1.1);
    hubLight.position.set(0, 9.0, 0);
    const hubFill = new THREE.PointLight(0xffffff, 10.0, 42, 1.2);
    hubFill.position.set(0, 7.5, 0);
    hubGroup.add(hubLight, hubFill);
    this.islandLights.hub = { primary: hubLight, fill: hubFill, maxPrimary: 28.0, maxFill: 10.0, rim: rimMesh };

    // Floating Holographic Rings around hub
    const ringGeo = new THREE.TorusGeometry(10.5, 0.15, 8, 36);
    const ringMesh = new THREE.Mesh(ringGeo, this.mat.holoCyan);
    ringMesh.rotation.x = Math.PI / 2.2;
    ringMesh.position.y = 3.5;
    hubGroup.add(ringMesh);
    this.animatedElements.push({
      mesh: ringMesh,
      update: (time) => {
        ringMesh.rotation.z = time * 0.4;
        ringMesh.rotation.x = Math.PI / 2.2 + Math.sin(time) * 0.1;
      }
    });

    // Holographic Vertical Pillar Beam
    const beamGeo = new THREE.CylinderGeometry(2.5, 2.5, 14, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.y = 9.5;
    hubGroup.add(beamMesh);

    // 3D Billboard Label: "INTERACTIVE JOURNEY HUB"
    const signTex = createTextTexture("INTERACTIVE JOURNEY HUB", "#070913", "#38bdf8", 22, "#38bdf8");
    const signGeo = new THREE.PlaneGeometry(6.4, 1.6);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });
    const signMesh = new THREE.Mesh(signGeo, signMat);
    signMesh.position.set(0, 6.2, 3.8);
    hubGroup.add(signMesh);

    // ------------------------------------------
    // Glowing Neon-Pixel "CONTACT ME" Terminal Button
    // ------------------------------------------
    const termPlinthGeo = new THREE.BoxGeometry(1.6, 1.4, 1.2);
    const termPlinth = new THREE.Mesh(termPlinthGeo, this.mat.metalDark);
    termPlinth.position.set(3.2, 4.3, 1.8);
    termPlinth.castShadow = true;

    // Angled terminal console top
    const consoleGeo = new THREE.BoxGeometry(1.4, 0.3, 0.9);
    consoleGeo.rotateX(-Math.PI / 6);
    const consoleMesh = new THREE.Mesh(consoleGeo, this.mat.metalSilver);
    consoleMesh.position.set(3.2, 5.0, 1.8);

    // Glowing Neon Button labeled "CONTACT"
    const btnTex = createTextTexture("CONTACT ME", "#070913", "#f59e0b", 26, "#f59e0b");
    const btnGeo = new THREE.BoxGeometry(1.2, 0.22, 0.6);
    btnGeo.rotateX(-Math.PI / 6);
    const btnMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 1.8,
      roughness: 0.2
    });
    const contactBtn = new THREE.Mesh(btnGeo, btnMat);
    contactBtn.position.set(3.2, 5.18, 1.8);
    contactBtn.userData = { isContactButton: true, chapterId: 'contact' };
    this.interactiveObjects.push(contactBtn);

    // Floating pulsing arrow or holographic tag above contact button
    const tagTex = createTextTexture("CONTACT", "#f59e0b", "#070913", 28);
    const tagGeo = new THREE.PlaneGeometry(1.8, 0.5);
    const tagMat = new THREE.MeshBasicMaterial({ map: tagTex, side: THREE.DoubleSide });
    const tagMesh = new THREE.Mesh(tagGeo, tagMat);
    tagMesh.position.set(3.2, 6.1, 1.8);
    this.animatedElements.push({
      mesh: tagMesh,
      update: (time) => {
        tagMesh.position.y = 6.1 + Math.sin(time * 3) * 0.12;
      }
    });

    hubGroup.add(termPlinth, consoleMesh, contactBtn, tagMesh);

    // Make Hub platform clickable to return
    deckMesh.userData = { chapterId: 'hub' };
    this.interactiveObjects.push(deckMesh);

    this.scene.add(hubGroup);
  }

  // ==========================================
  // 2. TOP-LEFT CHAPTER 1 (ELEMENTARY, AGES 7-12)
  // Schoolhouse diorama with soccer ball & cyan lighting
  // ==========================================
  buildChapter1Elementary() {
    const group = new THREE.Group();
    group.name = 'island-chapter1';
    group.position.copy(this.islandCenters.chapter1);

    // Island Base
    const baseGeo = new THREE.BoxGeometry(16, 2.8, 16);
    const baseMesh = new THREE.Mesh(baseGeo, this.mat.islandBase);
    baseMesh.position.y = -1.4;
    baseMesh.receiveShadow = true;
    baseMesh.userData = { chapterId: 'chapter1' };
    this.interactiveObjects.push(baseMesh);
    group.add(baseMesh);

    // Cyan Neon Edge Trim
    const trimGeo = new THREE.BoxGeometry(16.3, 0.3, 16.3);
    const trimMesh = new THREE.Mesh(trimGeo, this.mat.neonCyan);
    trimMesh.position.y = 0.05;
    group.add(trimMesh);

    // Grass schoolyard lawn
    const yardGeo = new THREE.BoxGeometry(15.6, 0.2, 15.6);
    const yardMesh = new THREE.Mesh(yardGeo, this.mat.islandGrass);
    yardMesh.position.y = 0.15;
    yardMesh.receiveShadow = true;
    group.add(yardMesh);

    // Destination Landing Beacon Pad (Cyan)
    this.beacons.chapter1 = this.createLandingBeacon(0x00f0ff, 2.4);
    this.beacons.chapter1.group.position.set(0, 0.25, 0);
    group.add(this.beacons.chapter1.group);

    // --- Pixel Schoolhouse Building ---
    const schoolGroup = new THREE.Group();
    schoolGroup.position.set(-2, 0.2, -2.5);

    // Main classroom hall
    const wallsGeo = new THREE.BoxGeometry(7.5, 4.2, 6);
    const wallsMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.7 }); // classic red brick
    const wallsMesh = new THREE.Mesh(wallsGeo, wallsMat);
    wallsMesh.position.y = 2.1;
    wallsMesh.castShadow = true;
    schoolGroup.add(wallsMesh);

    // Steep pitched roof (roof prism)
    const roofGeo = new THREE.ConeGeometry(5.8, 2.5, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.6 });
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.y = 5.4;
    roofMesh.scale.set(1.15, 1, 0.95);
    roofMesh.castShadow = true;
    schoolGroup.add(roofMesh);

    // Belfry / Clock Tower
    const towerGeo = new THREE.BoxGeometry(1.8, 2.6, 1.8);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const towerMesh = new THREE.Mesh(towerGeo, towerMat);
    towerMesh.position.set(0, 6.8, 0);
    schoolGroup.add(towerMesh);

    // Clock Face
    const clockGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 12);
    clockGeo.rotateX(Math.PI / 2);
    const clockMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.6 });
    const clockMesh = new THREE.Mesh(clockGeo, clockMat);
    clockMesh.position.set(0, 7.2, 0.95);
    schoolGroup.add(clockMesh);

    // Glowing classroom windows
    const winGeo = new THREE.BoxGeometry(1.2, 1.4, 0.1);
    const winMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 1.2 });
    [-2.2, 0, 2.2].forEach(x => {
      const win = new THREE.Mesh(winGeo, winMat);
      win.position.set(x, 2.4, 3.05);
      schoolGroup.add(win);
    });

    // Schoolhouse Doorway
    const doorGeo = new THREE.BoxGeometry(1.4, 2.2, 0.15);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.position.set(0, 1.1, 3.05);
    schoolGroup.add(doorMesh);

    group.add(schoolGroup);

    // --- Interactive Tiny Pixel Soccer Ball ---
    const ballGroup = new THREE.Group();
    ballGroup.position.set(3.5, 0.55, 3.5);

    const ballGeo = new THREE.DodecahedronGeometry(0.48, 1);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.2
    });
    this.soccerBall = new THREE.Mesh(ballGeo, ballMat);
    this.soccerBall.castShadow = true;
    this.soccerBall.userData = { isSoccerBall: true };
    this.interactiveObjects.push(this.soccerBall);
    ballGroup.add(this.soccerBall);

    // Tiny goal post
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8);
    const crossGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8);
    crossGeo.rotateZ(Math.PI / 2);

    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(2.4, 0.7, 5.5);
    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(4.8, 0.7, 5.5);
    const crossBar = new THREE.Mesh(crossGeo, postMat);
    crossBar.position.set(3.6, 1.4, 5.5);
    group.add(ballGroup, leftPost, rightPost, crossBar);

    // Chapter Signpost
    const signTex = createTextTexture("CH.1 // BUCAL ELEM SCHOOL", "#070913", "#00f0ff", 22, "#00f0ff");
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.1), new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide }));
    signMesh.position.set(0, 3.5, 7.2);
    group.add(signMesh);

    // Cyan Whole-Island Radiant Illumination (Brilliant Cyan + Daylight Fill)
    const cyanLight = new THREE.PointLight(0x00f0ff, 2.5, 52, 1.1);
    cyanLight.position.set(0, 8.5, 0);
    const cyanFill = new THREE.PointLight(0xffffff, 1.0, 42, 1.2);
    cyanFill.position.set(0, 7.0, 0);
    group.add(cyanLight, cyanFill);
    this.islandLights.chapter1 = { primary: cyanLight, fill: cyanFill, maxPrimary: 28.0, maxFill: 10.0, rim: trimMesh };

    this.scene.add(group);
  }

  // ==========================================
  // 3. BOTTOM-LEFT CHAPTER 2 (JUNIOR HIGH, AGES 13-16)
  // CCSA Arts and Sports diorama with easel, basketball hoop & blue neon
  // ==========================================
  buildChapter2CCSA() {
    const group = new THREE.Group();
    group.name = 'island-chapter2';
    group.position.copy(this.islandCenters.chapter2);

    // Island Base
    const baseGeo = new THREE.BoxGeometry(16, 2.8, 16);
    const baseMesh = new THREE.Mesh(baseGeo, this.mat.islandBase);
    baseMesh.position.y = -1.4;
    baseMesh.receiveShadow = true;
    baseMesh.userData = { chapterId: 'chapter2' };
    this.interactiveObjects.push(baseMesh);
    group.add(baseMesh);

    // Blue Neon Edge Trim
    const trimGeo = new THREE.BoxGeometry(16.3, 0.3, 16.3);
    const trimMesh = new THREE.Mesh(trimGeo, this.mat.neonBlue);
    trimMesh.position.y = 0.05;
    group.add(trimMesh);

    // Split Deck: Half Parquet Wood Basketball Court / Half Studio Floor
    const courtGeo = new THREE.BoxGeometry(8, 0.2, 15.6);
    const courtMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.5 }); // Blue hardcourt
    const courtMesh = new THREE.Mesh(courtGeo, courtMat);
    courtMesh.position.set(-3.8, 0.15, 0);
    courtMesh.receiveShadow = true;

    // Court key lines
    const lineGeo = new THREE.RingGeometry(1.8, 1.95, 24);
    lineGeo.rotateX(-Math.PI / 2);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const circle = new THREE.Mesh(lineGeo, lineMat);
    circle.position.set(-3.8, 0.26, -1);
    group.add(courtMesh, circle);

    const studioGeo = new THREE.BoxGeometry(7.6, 0.2, 15.6);
    const studioMesh = new THREE.Mesh(studioGeo, this.mat.woodParquet);
    studioMesh.position.set(4, 0.15, 0);
    studioMesh.receiveShadow = true;
    group.add(studioMesh);

    // Destination Landing Beacon Pad (Blue)
    this.beacons.chapter2 = this.createLandingBeacon(0x3b82f6, 2.4);
    this.beacons.chapter2.group.position.set(0, 0.25, 0);
    group.add(this.beacons.chapter2.group);

    // --- Miniature Basketball Hoop ---
    const hoopGroup = new THREE.Group();
    hoopGroup.position.set(-3.8, 0.25, -6.2);

    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 5.5, 8);
    const pole = new THREE.Mesh(poleGeo, this.mat.metalDark);
    pole.position.y = 2.75;

    // Transparent Glass Backboard
    const bbGeo = new THREE.BoxGeometry(3.2, 2.2, 0.1);
    const bbMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1,
      metalness: 0.8
    });
    const backboard = new THREE.Mesh(bbGeo, bbMat);
    backboard.position.set(0, 4.6, 0.6);

    // Orange Rim
    const rimGeo = new THREE.TorusGeometry(0.55, 0.06, 8, 18);
    rimGeo.rotateX(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 1.2 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(0, 3.8, 1.2);

    // Basketball on court
    const bballGeo = new THREE.SphereGeometry(0.42, 12, 12);
    const bballMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 });
    this.basketball = new THREE.Mesh(bballGeo, bballMat);
    this.basketball.position.set(0, 0.42, 3.8);
    this.basketball.userData = { isBasketball: true };
    this.interactiveObjects.push(this.basketball);

    hoopGroup.add(pole, backboard, rim, this.basketball);
    group.add(hoopGroup);

    // --- Art Easel with Pixel Canvas ---
    const easelGroup = new THREE.Group();
    easelGroup.position.set(3.8, 0.25, -1.5);

    // Easel wooden tripod legs
    const legGeo = new THREE.BoxGeometry(0.12, 4.2, 0.12);
    const easelMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 });

    const lLeg = new THREE.Mesh(legGeo, easelMat);
    lLeg.position.set(-0.8, 2.0, 0);
    lLeg.rotation.z = -0.15;
    const rLeg = new THREE.Mesh(legGeo, easelMat);
    rLeg.position.set(0.8, 2.0, 0);
    rLeg.rotation.z = 0.15;
    const backLeg = new THREE.Mesh(legGeo, easelMat);
    backLeg.position.set(0, 2.0, -0.9);
    backLeg.rotation.x = -0.25;

    // Painting Canvas
    const canvasTex = createPaintingTexture();
    const canvasGeo = new THREE.BoxGeometry(2.4, 2.8, 0.12);
    const canvasMat = new THREE.MeshStandardMaterial({ map: canvasTex, roughness: 0.4 });
    const canvasMesh = new THREE.Mesh(canvasGeo, canvasMat);
    canvasMesh.position.set(0, 2.7, 0.15);
    canvasMesh.rotation.x = -0.1;

    // Paint bucket & palette
    const bucketGeo = new THREE.CylinderGeometry(0.35, 0.3, 0.6, 12);
    const bucketMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, emissiveIntensity: 0.8 });
    const bucket = new THREE.Mesh(bucketGeo, bucketMat);
    bucket.position.set(1.4, 0.3, 0.5);

    easelGroup.add(lLeg, rLeg, backLeg, canvasMesh, bucket);
    group.add(easelGroup);

    // Chapter Signpost
    const signTex = createTextTexture("CH.2 // CCSA ARTS & SPORTS", "#070913", "#3b82f6", 22, "#3b82f6");
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.1), new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide }));
    signMesh.position.set(0, 3.5, 7.2);
    group.add(signMesh);

    // Blue Whole-Island Radiant Illumination (Brilliant Electric Blue + Daylight Fill)
    const blueLight = new THREE.PointLight(0x3b82f6, 2.5, 52, 1.1);
    blueLight.position.set(0, 8.5, 0);
    const blueFill = new THREE.PointLight(0xffffff, 1.0, 42, 1.2);
    blueFill.position.set(0, 7.0, 0);
    group.add(blueLight, blueFill);
    this.islandLights.chapter2 = { primary: blueLight, fill: blueFill, maxPrimary: 28.0, maxFill: 10.0, rim: trimMesh };

    this.scene.add(group);
  }

  // ==========================================
  // 4. BOTTOM-RIGHT CHAPTER 3 (SENIOR HIGH, AGES 17-19)
  // Trace College TVL-ICT diorama with computer workbench, tools & purple neon
  // ==========================================
  buildChapter3Trace() {
    const group = new THREE.Group();
    group.name = 'island-chapter3';
    group.position.copy(this.islandCenters.chapter3);

    // Island Base
    const baseGeo = new THREE.BoxGeometry(16, 2.8, 16);
    const baseMesh = new THREE.Mesh(baseGeo, this.mat.islandBase);
    baseMesh.position.y = -1.4;
    baseMesh.receiveShadow = true;
    baseMesh.userData = { chapterId: 'chapter3' };
    this.interactiveObjects.push(baseMesh);
    group.add(baseMesh);

    // Purple Neon Edge Trim
    const trimGeo = new THREE.BoxGeometry(16.3, 0.3, 16.3);
    const trimMesh = new THREE.Mesh(trimGeo, this.mat.neonPurple);
    trimMesh.position.y = 0.05;
    group.add(trimMesh);

    // Tech lab antistatic floor
    const floorGeo = new THREE.BoxGeometry(15.6, 0.2, 15.6);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.6 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = 0.15;
    floorMesh.receiveShadow = true;
    group.add(floorMesh);

    // Destination Landing Beacon Pad (Purple)
    this.beacons.chapter3 = this.createLandingBeacon(0xa855f7, 2.4);
    this.beacons.chapter3.group.position.set(0, 0.25, 0);
    group.add(this.beacons.chapter3.group);

    // --- Electronics Workbench ---
    const benchGroup = new THREE.Group();
    benchGroup.position.set(0, 0.25, -2);

    // Workbench Table
    const topGeo = new THREE.BoxGeometry(9.5, 0.4, 4.5);
    const topMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.5 });
    const tableTop = new THREE.Mesh(topGeo, topMat);
    tableTop.position.y = 2.4;

    // Metal legs
    const legGeo = new THREE.BoxGeometry(0.3, 2.4, 0.3);
    const legPositions = [
      [-4.4, 1.2, -1.9],
      [4.4, 1.2, -1.9],
      [-4.4, 1.2, 1.9],
      [4.4, 1.2, 1.9]
    ];
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeo, this.mat.metalDark);
      leg.position.set(...pos);
      benchGroup.add(leg);
    });
    benchGroup.add(tableTop);

    // Dual Glowing Monitors displaying diagnostics & code
    const screenTex = createTextTexture("TRACE TVL-ICT // OS_INIT", "#070913", "#c084fc", 24, "#a855f7");
    const monGeo = new THREE.BoxGeometry(2.6, 1.8, 0.15);
    const monMat = new THREE.MeshStandardMaterial({
      map: screenTex,
      roughness: 0.2,
      emissive: 0x9333ea,
      emissiveIntensity: 0.8
    });

    const leftMon = new THREE.Mesh(monGeo, monMat);
    leftMon.position.set(-1.6, 3.8, -0.6);
    leftMon.rotation.y = 0.15;

    const rightMon = new THREE.Mesh(monGeo, monMat);
    rightMon.position.set(1.6, 3.8, -0.6);
    rightMon.rotation.y = -0.15;

    // Open PC Tower Chassis with glowing RGB internals
    const pcGeo = new THREE.BoxGeometry(1.2, 2.0, 2.2);
    const pcMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 });
    const pcTower = new THREE.Mesh(pcGeo, pcMat);
    pcTower.position.set(3.6, 3.6, 0.2);

    // Glowing RGB fan inside PC
    const fanGeo = new THREE.TorusGeometry(0.4, 0.08, 8, 16);
    const fanMat = new THREE.MeshStandardMaterial({ color: 0xc084fc, emissive: 0xa855f7, emissiveIntensity: 2.0 });
    const fan = new THREE.Mesh(fanGeo, fanMat);
    fan.position.set(3.0, 3.6, 0.2);
    fan.rotation.y = Math.PI / 2;
    this.animatedElements.push({
      mesh: fan,
      update: (time) => { fan.rotation.z = time * 8; }
    });

    // Precision Repair Tools: Digital Multimeter, Soldering Iron, Screwdrivers
    const dmmGeo = new THREE.BoxGeometry(0.6, 0.2, 0.9);
    const dmmMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const dmm = new THREE.Mesh(dmmGeo, dmmMat);
    dmm.position.set(-3.2, 2.7, 0.5);

    const solderGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.2, 8);
    solderGeo.rotateX(Math.PI / 3);
    const solderMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 });
    const solder = new THREE.Mesh(solderGeo, solderMat);
    solder.position.set(-2.2, 2.8, 0.7);

    benchGroup.add(leftMon, rightMon, pcTower, fan, dmm, solder);
    group.add(benchGroup);

    // Chapter Signpost
    const signTex = createTextTexture("CH.3 // TRACE TVL-ICT", "#070913", "#a855f7", 24, "#a855f7");
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.1), new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide }));
    signMesh.position.set(0, 3.5, 7.2);
    group.add(signMesh);

    // Purple Whole-Island Radiant Illumination (Brilliant Purple + Daylight Fill)
    const purpleLight = new THREE.PointLight(0xa855f7, 2.5, 52, 1.1);
    purpleLight.position.set(0, 8.5, 0);
    const purpleFill = new THREE.PointLight(0xffffff, 1.0, 42, 1.2);
    purpleFill.position.set(0, 7.0, 0);
    group.add(purpleLight, purpleFill);
    this.islandLights.chapter3 = { primary: purpleLight, fill: purpleFill, maxPrimary: 28.0, maxFill: 10.0, rim: trimMesh };

    this.scene.add(group);
  }

  // ==========================================
  // 5. TOP-RIGHT CHAPTER 4 (COLLEGE & PRESENT, AGES 19-21)
  // City College of Calamba diorama with volleyball net, CRT AI terminal & emerald green neon
  // ==========================================
  buildChapter4CCC() {
    const group = new THREE.Group();
    group.name = 'island-chapter4';
    group.position.copy(this.islandCenters.chapter4);

    // Island Base
    const baseGeo = new THREE.BoxGeometry(16, 2.8, 16);
    const baseMesh = new THREE.Mesh(baseGeo, this.mat.islandBase);
    baseMesh.position.y = -1.4;
    baseMesh.receiveShadow = true;
    baseMesh.userData = { chapterId: 'chapter4' };
    this.interactiveObjects.push(baseMesh);
    group.add(baseMesh);

    // Emerald Green Neon Edge Trim
    const trimGeo = new THREE.BoxGeometry(16.3, 0.3, 16.3);
    const trimMesh = new THREE.Mesh(trimGeo, this.mat.neonEmerald);
    trimMesh.position.y = 0.05;
    group.add(trimMesh);

    // Hardwood volleyball court floor with emerald boundary lines
    const courtGeo = new THREE.BoxGeometry(15.6, 0.2, 15.6);
    const courtMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.5 }); // Emerald gym court
    const courtMesh = new THREE.Mesh(courtGeo, courtMat);
    courtMesh.position.y = 0.15;
    courtMesh.receiveShadow = true;
    group.add(courtMesh);

    // Destination Landing Beacon Pad (Emerald Green)
    this.beacons.chapter4 = this.createLandingBeacon(0x10b981, 2.4);
    this.beacons.chapter4.group.position.set(0, 0.25, 0);
    group.add(this.beacons.chapter4.group);

    // --- Regulation Volleyball Net ---
    const netGroup = new THREE.Group();
    netGroup.position.set(0, 0.25, 1.5);

    // Net Antenna Poles
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 4.2, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8 }); // Yellow poles
    const leftPole = new THREE.Mesh(poleGeo, poleMat);
    leftPole.position.set(-6.2, 2.1, 0);
    const rightPole = new THREE.Mesh(poleGeo, poleMat);
    rightPole.position.set(6.2, 2.1, 0);

    // Mesh Net with white top/bottom tape
    const netMeshGeo = new THREE.PlaneGeometry(12.2, 1.8);
    const netMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      wireframe: true,
      side: THREE.DoubleSide
    });
    const net = new THREE.Mesh(netMeshGeo, netMat);
    net.position.set(0, 2.6, 0);

    // Tournament Volleyball
    const vballGeo = new THREE.SphereGeometry(0.44, 14, 14);
    const vballMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4, emissive: 0x0284c7, emissiveIntensity: 0.3 });
    this.volleyball = new THREE.Mesh(vballGeo, vballMat);
    this.volleyball.position.set(2.4, 0.44, -1.8);
    this.volleyball.userData = { isVolleyball: true };
    this.interactiveObjects.push(this.volleyball);

    netGroup.add(leftPole, rightPole, net, this.volleyball);
    group.add(netGroup);

    // --- Glowing Retro CRT Computer Terminal Streaming AI Matrix Code ---
    const termGroup = new THREE.Group();
    termGroup.position.set(-3.2, 0.25, -4.5);

    // Tech Desk
    const deskGeo = new THREE.BoxGeometry(4.2, 0.3, 2.6);
    const desk = new THREE.Mesh(deskGeo, this.mat.metalDark);
    desk.position.y = 2.0;

    const dLegGeo = new THREE.BoxGeometry(0.2, 2.0, 0.2);
    [[-1.9, 1.0, -1.1], [1.9, 1.0, -1.1], [-1.9, 1.0, 1.1], [1.9, 1.0, 1.1]].forEach(pos => {
      const leg = new THREE.Mesh(dLegGeo, this.mat.metalSilver);
      leg.position.set(...pos);
      termGroup.add(leg);
    });
    termGroup.add(desk);

    // CRT Monitor housing (beveled beige/grey retro housing)
    const crtGeo = new THREE.BoxGeometry(2.4, 2.2, 2.2);
    const crtMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
    const crt = new THREE.Mesh(crtGeo, crtMat);
    crt.position.set(0, 3.4, 0);

    // Animated Green AI Matrix Code Screen
    const matrixHandler = createMatrixTexture();
    this.animatedElements.push({ update: () => matrixHandler.update() });

    const crtScreenGeo = new THREE.PlaneGeometry(1.8, 1.5);
    const crtScreenMat = new THREE.MeshBasicMaterial({
      map: matrixHandler.texture,
      side: THREE.FrontSide
    });
    const crtScreen = new THREE.Mesh(crtScreenGeo, crtScreenMat);
    crtScreen.position.set(0, 3.4, 1.12);

    // Server Rack Unit behind desk with blinking LEDs
    const rackGeo = new THREE.BoxGeometry(2.2, 5.5, 1.8);
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.7 });
    const rack = new THREE.Mesh(rackGeo, rackMat);
    rack.position.set(3.4, 2.75, 0);

    // Blinking status LEDs on rack
    const ledGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const ledMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 2.0 });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(3.4, 4.5, 0.92);
    this.animatedElements.push({
      mesh: led,
      update: (time) => {
        led.material.emissiveIntensity = Math.sin(time * 6) > 0.2 ? 2.5 : 0.2;
      }
    });

    termGroup.add(crt, crtScreen, rack, led);
    group.add(termGroup);

    // Chapter Signpost
    const signTex = createTextTexture("CH.4 // CCC • AI & VOLLEYBALL", "#070913", "#10b981", 20, "#10b981");
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.1), new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide }));
    signMesh.position.set(0, 3.5, 7.2);
    group.add(signMesh);

    // Emerald Whole-Island Radiant Illumination (Brilliant Emerald + Daylight Fill)
    const emeraldLight = new THREE.PointLight(0x10b981, 2.5, 52, 1.1);
    emeraldLight.position.set(0, 8.5, 0);
    const emeraldFill = new THREE.PointLight(0xffffff, 1.0, 42, 1.2);
    emeraldFill.position.set(0, 7.0, 0);
    group.add(emeraldLight, emeraldFill);
    this.islandLights.chapter4 = { primary: emeraldLight, fill: emeraldFill, maxPrimary: 28.0, maxFill: 10.0, rim: trimMesh };

    this.scene.add(group);
  }

  // ==========================================
  // 6. GLOWING COLOR-CODED NEON PATHWAYS
  // Smooth Bezier ribbons & photon pulse particles
  // ==========================================
  buildNeonPathways() {
    const hubPos = this.islandCenters.hub;

    const routes = [
      { id: 'chapter1', target: this.islandCenters.chapter1, color: 0x00f0ff },
      { id: 'chapter2', target: this.islandCenters.chapter2, color: 0x3b82f6 },
      { id: 'chapter3', target: this.islandCenters.chapter3, color: 0xa855f7 },
      { id: 'chapter4', target: this.islandCenters.chapter4, color: 0x10b981 }
    ];

    routes.forEach(route => {
      // Create Bezier Curve for smooth walking & bridge rendering
      // Start slightly outside hub deck
      const startDir = route.target.clone().sub(hubPos).normalize();
      const startPt = hubPos.clone().add(startDir.clone().multiplyScalar(5.5));
      startPt.y = 3.6;

      const endPt = route.target.clone().add(startDir.clone().negate().multiplyScalar(4.5));
      endPt.y = 0.8;

      // Midpoint with gentle arched sag/curve
      const midPt = startPt.clone().add(endPt).multiplyScalar(0.5);
      midPt.y = 2.4;

      const curve = new THREE.QuadraticBezierCurve3(startPt, midPt, endPt);
      this.paths[route.id] = curve;

      // Reverse curve (from island back to hub)
      this.paths[`${route.id}_to_hub`] = new THREE.QuadraticBezierCurve3(endPt, midPt, startPt);

      // Render 3D Bridge Ribbon
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.45, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: route.color,
        emissive: route.color,
        emissiveIntensity: 1.4,
        roughness: 0.2,
        transparent: true,
        opacity: 0.95
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      this.scene.add(tubeMesh);

      // Floating support energy rings along the pathway
      [0.25, 0.5, 0.75].forEach(t => {
        const pt = curve.getPoint(t);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.85, 0.06, 6, 16),
          new THREE.MeshBasicMaterial({ color: route.color, wireframe: true })
        );
        ring.position.copy(pt);
        this.scene.add(ring);
        this.animatedElements.push({
          mesh: ring,
          update: (time) => { ring.rotation.z = time * 2; }
        });
      });

      // Animated Photon Light Pulse traveling along each pathway
      const pulseGeo = new THREE.SphereGeometry(0.35, 8, 8);
      const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      this.scene.add(pulseMesh);

      this.animatedElements.push({
        mesh: pulseMesh,
        update: (time) => {
          const t = (time * 0.4 + (route.color % 3) * 0.3) % 1;
          const pos = curve.getPoint(t);
          pulseMesh.position.copy(pos);
        }
      });
    });
  }

  // Bounce sports balls on click
  bounceBall(type) {
    let ball = null;
    if (type === 'soccer') ball = this.soccerBall;
    if (type === 'basketball') ball = this.basketball;
    if (type === 'volleyball') ball = this.volleyball;

    if (!ball) return;
    sound.playBallBounce();

    const startY = ball.position.y;
    let t = 0;
    const interval = setInterval(() => {
      t += 0.08;
      ball.position.y = startY + Math.sin(t * Math.PI) * 1.5;
      ball.rotation.x += 0.2;
      ball.rotation.y += 0.15;
      if (t >= 1) {
        ball.position.y = startY;
        clearInterval(interval);
      }
    }, 16);
  }

  // When character reaches an island, the WHOLE island lights up brilliantly!
  setIslandIllumination(activeIslandId, isWalking = false) {
    Object.keys(this.islandLights).forEach(key => {
      const lights = this.islandLights[key];
      const isReached = !isWalking && key === activeIslandId;

      const targetPrimary = isReached ? (lights.maxPrimary || 32.0) : 2.5;
      const targetFill = isReached ? (lights.maxFill || 12.0) : 1.0;

      gsap.to(lights.primary, {
        intensity: targetPrimary,
        duration: 0.9,
        ease: 'power2.out'
      });
      gsap.to(lights.fill, {
        intensity: targetFill,
        duration: 0.9,
        ease: 'power2.out'
      });
      if (lights.rim && lights.rim.material) {
        gsap.to(lights.rim.material, {
          emissiveIntensity: isReached ? 3.5 : 1.2,
          duration: 0.9,
          ease: 'power2.out'
        });
      }
    });
  }

  // Dynamically activate the landing beacon on the target destination
  setActiveDestination(destinationId) {
    Object.keys(this.beacons).forEach(key => {
      const b = this.beacons[key];
      const active = key === destinationId;
      b.isActive = active;
      b.r1Mat.opacity = active ? 0.95 : 0.22;
      b.r2Mat.opacity = active ? 0.85 : 0.18;
      b.cylMat.opacity = active ? 0.24 : 0.03;
      b.group.scale.set(active ? 1.05 : 0.92, 1, active ? 1.05 : 0.92);
    });
  }

  update(delta, time) {
    this.animatedElements.forEach(el => el.update(time));

    // Animate destination landing beacons
    Object.values(this.beacons).forEach(b => {
      if (b.r2) {
        b.r2.rotation.z = time * (b.isActive ? 2.5 : 0.8);
      }
      if (b.cyl && b.isActive) {
        b.cylMat.opacity = 0.18 + Math.sin(time * 4) * 0.08;
      }
    });
  }
}

