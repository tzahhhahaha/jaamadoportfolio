import * as THREE from 'three';
import { sound } from './audio.js';

export class FunkoCharacter {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'funko-character';

    // Animation state
    this.isWalking = false;
    this.walkClock = 0;
    this.currentChapter = 'hub';
    this.targetPosition = new THREE.Vector3(0, 3.8, 0);
    this.currentCurve = null;
    this.curveProgress = 0;
    this.curveDuration = 2.4; // seconds
    this.curveStartTime = 0;
    this.onArrivalCallback = null;
    this.lastFootstepStep = 0;

    // Materials dictionary for seamless theme swapping
    this.materials = {
      skin: new THREE.MeshStandardMaterial({ color: 0xffdfc4, roughness: 0.6 }),
      eyes: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.2 }),
      eyeGleam: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      hairDark: new THREE.MeshStandardMaterial({ color: 0x1f1917, roughness: 0.8 }),
      pants: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 }),
      shoes: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 }),
      hoodieHub: new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.5, emissive: 0x0284c7, emissiveIntensity: 0.2 }),
      // Chapter specifics
      chap1Outfit: new THREE.MeshStandardMaterial({ color: 0x00f0ff, roughness: 0.5, emissive: 0x00bcd4, emissiveIntensity: 0.3 }),
      chap1Backpack: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 }),
      chap2Outfit: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5, emissive: 0x1d4ed8, emissiveIntensity: 0.3 }),
      chap3Outfit: new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.5, emissive: 0x7e22ce, emissiveIntensity: 0.3 }),
      chap4Jersey: new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.4, emissive: 0x047857, emissiveIntensity: 0.4 }),
      goldTrim: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.6 }),
      neonCyan: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
      hologramRing: new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6, wireframe: true }),
      groundLightPool: new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending })
    };

    this.buildMesh();
    this.scene.add(this.group);

    // Initial position on the elevated hub
    this.group.position.set(0, 3.8, 0);
  }

  buildMesh() {
    this.characterRoot = new THREE.Group();
    this.characterRoot.userData = { isCharacter: true };
    this.group.userData = { isCharacter: true };

    // Dedicated invisible click hitbox for reliable raycasting & interaction
    const clickHitBox = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 3.8, 2.2),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    clickHitBox.position.set(0, 1.8, 0);
    clickHitBox.userData = { isCharacter: true };
    this.characterRoot.add(clickHitBox);
    this.clickHitBox = clickHitBox;

    // === HEAD (Oversized Funko signature) ===
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 2.05, 0);

    const headGeo = new THREE.BoxGeometry(1.6, 1.45, 1.4);
    this.headMesh = new THREE.Mesh(headGeo, this.materials.skin);
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;
    this.headMesh.userData = { isCharacter: true };
    this.headGroup.add(this.headMesh);

    // Hair voxels (stylish front fringe and side blocks)
    const hairGeo = new THREE.BoxGeometry(1.66, 0.45, 1.46);
    this.hairTop = new THREE.Mesh(hairGeo, this.materials.hairDark);
    this.hairTop.position.set(0, 0.58, 0);
    this.hairTop.castShadow = true;
    this.headGroup.add(this.hairTop);

    const fringeGeo = new THREE.BoxGeometry(1.4, 0.3, 0.3);
    this.hairFringe = new THREE.Mesh(fringeGeo, this.materials.hairDark);
    this.hairFringe.position.set(0, 0.42, 0.68);
    this.headGroup.add(this.hairFringe);

    // Funko Big Glossy Eyes
    const eyeGeo = new THREE.BoxGeometry(0.28, 0.32, 0.08);
    const gleamGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);

    // Left Eye
    const leftEye = new THREE.Mesh(eyeGeo, this.materials.eyes);
    leftEye.position.set(-0.45, -0.05, 0.71);
    const leftGleam = new THREE.Mesh(gleamGeo, this.materials.eyeGleam);
    leftGleam.position.set(0.06, 0.08, 0.05);
    leftEye.add(leftGleam);
    this.headGroup.add(leftEye);

    // Right Eye
    const rightEye = new THREE.Mesh(eyeGeo, this.materials.eyes);
    rightEye.position.set(0.45, -0.05, 0.71);
    const rightGleam = new THREE.Mesh(gleamGeo, this.materials.eyeGleam);
    rightGleam.position.set(0.06, 0.08, 0.05);
    rightEye.add(rightGleam);
    this.headGroup.add(rightEye);

    // Cute nose nub
    const noseGeo = new THREE.BoxGeometry(0.12, 0.1, 0.1);
    const nose = new THREE.Mesh(noseGeo, this.materials.skin);
    nose.position.set(0, -0.15, 0.73);
    this.headGroup.add(nose);

    // Cyber headphones around neck (hub neutral state)
    this.headphones = new THREE.Group();
    const hpBand = new THREE.TorusGeometry(0.72, 0.06, 8, 24, Math.PI);
    const bandMesh = new THREE.Mesh(hpBand, this.materials.neonCyan);
    bandMesh.rotation.x = Math.PI / 2;
    bandMesh.position.set(0, -0.55, 0);
    this.headphones.add(bandMesh);

    const earGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 12);
    const leftEar = new THREE.Mesh(earGeo, this.materials.neonCyan);
    leftEar.rotation.z = Math.PI / 2;
    leftEar.position.set(-0.85, -0.55, 0);
    const rightEar = leftEar.clone();
    rightEar.position.set(0.85, -0.55, 0);
    this.headphones.add(leftEar, rightEar);
    this.headGroup.add(this.headphones);

    this.characterRoot.add(this.headGroup);

    // === TORSO (Compact blocky body) ===
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.95, 0);

    const torsoGeo = new THREE.BoxGeometry(0.95, 0.9, 0.65);
    this.torsoMesh = new THREE.Mesh(torsoGeo, this.materials.hoodieHub);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.userData = { isCharacter: true };
    this.torsoGroup.add(this.torsoMesh);

    // Chapter accessories container
    this.accessoriesGroup = new THREE.Group();
    this.torsoGroup.add(this.accessoriesGroup);

    this.characterRoot.add(this.torsoGroup);

    // === ARMS ===
    const armGeo = new THREE.BoxGeometry(0.25, 0.75, 0.25);
    armGeo.translate(0, -0.3, 0); // pivot at shoulder

    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.62, 1.25, 0);
    this.leftArmMesh = new THREE.Mesh(armGeo, this.materials.hoodieHub);
    this.leftArmMesh.castShadow = true;
    this.leftArmGroup.add(this.leftArmMesh);
    this.characterRoot.add(this.leftArmGroup);

    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.62, 1.25, 0);
    this.rightArmMesh = new THREE.Mesh(armGeo, this.materials.hoodieHub);
    this.rightArmMesh.castShadow = true;
    this.rightArmGroup.add(this.rightArmMesh);
    this.characterRoot.add(this.rightArmGroup);

    // === LEGS ===
    const legGeo = new THREE.BoxGeometry(0.32, 0.6, 0.32);
    legGeo.translate(0, -0.25, 0); // pivot at hip

    const shoeGeo = new THREE.BoxGeometry(0.36, 0.2, 0.46);
    shoeGeo.translate(0, -0.45, 0.05);

    // Left Leg
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.28, 0.55, 0);
    this.leftLegMesh = new THREE.Mesh(legGeo, this.materials.pants);
    this.leftShoeMesh = new THREE.Mesh(shoeGeo, this.materials.shoes);
    this.leftLegGroup.add(this.leftLegMesh, this.leftShoeMesh);
    this.characterRoot.add(this.leftLegGroup);

    // Right Leg
    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.28, 0.55, 0);
    this.rightLegMesh = new THREE.Mesh(legGeo, this.materials.pants);
    this.rightShoeMesh = new THREE.Mesh(shoeGeo, this.materials.shoes);
    this.leftLegMesh.castShadow = true;
    this.rightLegMesh.castShadow = true;
    this.rightLegGroup.add(this.rightLegMesh, this.rightShoeMesh);
    this.characterRoot.add(this.rightLegGroup);

    // ==========================================
    // 1. SUBTLE CONTACT SHADOW UNDER FEET
    // Direct floor contact shadow, grounds avatar cleanly without light halos
    // ==========================================
    const shadowGeo = new THREE.PlaneGeometry(2.4, 2.0);
    shadowGeo.rotateX(-Math.PI / 2);

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext('2d');
    const sgrad = sctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    sgrad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    sgrad.addColorStop(0.35, 'rgba(3, 7, 18, 0.45)');
    sgrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.15)');
    sgrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sctx.fillStyle = sgrad;
    sctx.fillRect(0, 0, 128, 128);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    this.contactShadow = new THREE.Mesh(shadowGeo, this.shadowMat);
    this.contactShadow.position.y = 0.02;
    this.characterRoot.add(this.contactShadow);

    this.group.add(this.characterRoot);
  }

  setLightColor(colorHex) {
    // Character has no personal spotlight or light ring attached; whole island lights up
  }

  // Chapter-specific outfit and transformation
  transformTo(chapterId) {
    this.currentChapter = chapterId;

    // Reset accessories
    while (this.accessoriesGroup.children.length > 0) {
      this.accessoriesGroup.remove(this.accessoriesGroup.children[0]);
    }

    const meta = {
      hub: '#f59e0b',
      chapter1: '#00f0ff',
      chapter2: '#3b82f6',
      chapter3: '#a855f7',
      chapter4: '#10b981'
    };
    this.setLightColor(meta[chapterId] || meta.hub);

    // Scale adjustments for age representation
    if (chapterId === 'chapter1') {
      // Elementary: Smaller cute child scale (ages 7-12)
      this.characterRoot.scale.set(0.8, 0.8, 0.8);
      this.torsoMesh.material = this.materials.chap1Outfit;
      this.leftArmMesh.material = this.materials.chap1Outfit;
      this.rightArmMesh.material = this.materials.chap1Outfit;
      this.headphones.visible = false;

      // Add cute yellow backpack
      const packGeo = new THREE.BoxGeometry(0.7, 0.65, 0.35);
      const backpack = new THREE.Mesh(packGeo, this.materials.chap1Backpack);
      backpack.position.set(0, 0, -0.42);
      this.accessoriesGroup.add(backpack);

    } else if (chapterId === 'chapter2') {
      // Junior High: Youth scale (ages 13-16)
      this.characterRoot.scale.set(0.9, 0.9, 0.9);
      this.torsoMesh.material = this.materials.chap2Outfit;
      this.leftArmMesh.material = this.materials.chap2Outfit;
      this.rightArmMesh.material = this.materials.chap2Outfit;
      this.headphones.visible = false;

      // Add miniature artist palette held in left hand
      const paletteGeo = new THREE.BoxGeometry(0.35, 0.05, 0.35);
      const palette = new THREE.Mesh(paletteGeo, this.materials.goldTrim);
      palette.position.set(-0.65, -0.25, 0.2);
      this.accessoriesGroup.add(palette);

    } else if (chapterId === 'chapter3') {
      // Senior High: Older teen TVL-ICT (ages 17-19)
      this.characterRoot.scale.set(1.0, 1.0, 1.0);
      this.torsoMesh.material = this.materials.chap3Outfit;
      this.leftArmMesh.material = this.materials.chap3Outfit;
      this.rightArmMesh.material = this.materials.chap3Outfit;
      this.headphones.visible = true;

      // Add tech ID lanyard / badge
      const badgeGeo = new THREE.BoxGeometry(0.3, 0.38, 0.05);
      const badge = new THREE.Mesh(badgeGeo, this.materials.neonCyan);
      badge.position.set(0, -0.15, 0.36);
      this.accessoriesGroup.add(badge);

    } else if (chapterId === 'chapter4') {
      // College & Present: Athletic Adult Varsity #10 (ages 19-21)
      this.characterRoot.scale.set(1.05, 1.05, 1.05);
      this.torsoMesh.material = this.materials.chap4Jersey;
      this.leftArmMesh.material = this.materials.chap4Jersey;
      this.rightArmMesh.material = this.materials.chap4Jersey;
      this.headphones.visible = false;

      // Varsity number "#10" patch on chest
      const numGeo = new THREE.BoxGeometry(0.4, 0.3, 0.04);
      const numPatch = new THREE.Mesh(numGeo, this.materials.goldTrim);
      numPatch.position.set(0, 0.1, 0.35);
      this.accessoriesGroup.add(numPatch);

    } else {
      // Hub neutral state
      this.characterRoot.scale.set(1.0, 1.0, 1.0);
      this.torsoMesh.material = this.materials.hoodieHub;
      this.leftArmMesh.material = this.materials.hoodieHub;
      this.rightArmMesh.material = this.materials.hoodieHub;
      this.headphones.visible = true;
    }

    // Holographic flash effect on transformation
    const originalEmissive = this.torsoMesh.material.emissiveIntensity;
    this.torsoMesh.material.emissiveIntensity = 1.2;
    setTimeout(() => {
      if (this.torsoMesh && this.torsoMesh.material) {
        this.torsoMesh.material.emissiveIntensity = originalEmissive;
      }
    }, 450);

    sound.playChapterArrival(chapterId);
  }

  // Walk along curved neon spline to destination
  walkAlongPath(curve, duration, targetChapterId, onComplete) {
    this.isWalking = true;
    this.currentCurve = curve;
    this.curveDuration = duration || 2.4;
    this.curveProgress = 0;
    this.curveStartTime = performance.now();
    this.onArrivalCallback = onComplete;
    this.targetChapterId = targetChapterId;
    this.lastFootstepStep = 0;

    const meta = {
      hub: '#f59e0b',
      chapter1: '#00f0ff',
      chapter2: '#3b82f6',
      chapter3: '#a855f7',
      chapter4: '#10b981'
    };
    this.setLightColor(meta[targetChapterId] || meta.hub);
  }

  update(delta, time) {
    if (this.isWalking && this.currentCurve) {
      const elapsed = (performance.now() - this.curveStartTime) / 1000;
      this.curveProgress = Math.min(elapsed / this.curveDuration, 1);

      // Get point and tangent on curve
      const point = this.currentCurve.getPoint(this.curveProgress);
      const tangent = this.currentCurve.getTangent(this.curveProgress);

      this.group.position.copy(point);

      // Face direction of motion
      if (tangent.lengthSq() > 0.001) {
        const lookTarget = point.clone().add(new THREE.Vector3(tangent.x, 0, tangent.z));
        this.group.lookAt(lookTarget);
      }

      // Walk cycle animation
      this.walkClock += delta * 12;
      const legSwing = Math.sin(this.walkClock) * 0.7;
      const armSwing = Math.cos(this.walkClock) * 0.6;
      const bodyBob = Math.abs(Math.sin(this.walkClock)) * 0.12;

      this.leftLegGroup.rotation.x = legSwing;
      this.rightLegGroup.rotation.x = -legSwing;
      this.leftArmGroup.rotation.x = armSwing;
      this.rightArmGroup.rotation.x = -armSwing;
      this.headGroup.rotation.z = Math.sin(this.walkClock * 0.5) * 0.08;
      this.torsoGroup.position.y = 0.95 + bodyBob;

      // Audio footstep trigger on cycle peaks
      const currentStep = Math.floor(this.walkClock / Math.PI);
      if (currentStep !== this.lastFootstepStep) {
        this.lastFootstepStep = currentStep;
        sound.playFootstep();
      }

      // Check arrival
      if (this.curveProgress >= 1) {
        this.isWalking = false;
        this.currentCurve = null;

        // Reset poses
        this.leftLegGroup.rotation.x = 0;
        this.rightLegGroup.rotation.x = 0;
        this.leftArmGroup.rotation.x = 0;
        this.rightArmGroup.rotation.x = 0;
        this.torsoGroup.position.y = 0.95;

        // Transform into target chapter attire
        this.transformTo(this.targetChapterId);

        if (this.onArrivalCallback) {
          this.onArrivalCallback(this.targetChapterId);
        }
      }
    } else {
      // Idle breathing & head bob animation
      const breath = Math.sin(time * 2.2) * 0.04;
      this.headGroup.position.y = 2.05 + breath;
      this.torsoGroup.position.y = 0.95 + breath * 0.5;
      this.headGroup.rotation.y = Math.sin(time * 0.8) * 0.06;
    }
  }
}

