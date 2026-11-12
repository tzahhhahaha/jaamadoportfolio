import * as THREE from 'three';

export function createSpatialParticles(count = 1400) {
  // Generate circular glowing pixel particle sprite
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.2, 'rgba(120, 220, 255, 0.9)');
  gradient.addColorStop(0.5, 'rgba(56, 189, 248, 0.4)');
  gradient.addColorStop(1, 'rgba(7, 9, 19, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const speeds = new Float32Array(count);

  const palette = [
    new THREE.Color(0x00f0ff), // Cyan
    new THREE.Color(0x38bdf8), // Light Blue
    new THREE.Color(0xa855f7), // Purple
    new THREE.Color(0x10b981), // Emerald
    new THREE.Color(0xf59e0b), // Amber
    new THREE.Color(0xffffff)  // Sparkle
  ];

  for (let i = 0; i < count; i++) {
    // Spatial box spread
    positions[i * 3 + 0] = (Math.random() - 0.5) * 110;
    positions[i * 3 + 1] = Math.random() * 45 - 5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 110;

    const col = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3 + 0] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;

    scales[i] = 0.4 + Math.random() * 0.8;
    speeds[i] = 0.2 + Math.random() * 0.5;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.9,
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const points = new THREE.Points(geometry, material);

  return {
    mesh: points,
    update: (time) => {
      const pos = geometry.attributes.position.array;
      for (let i = 0; i < count; i++) {
        // Subtle vertical drifting and horizontal oscillation
        pos[i * 3 + 1] += Math.sin(time * 0.5 + i) * 0.015 + 0.008 * speeds[i];
        pos[i * 3 + 0] += Math.cos(time * 0.3 + i * 2) * 0.008;

        // Wrap around boundaries
        if (pos[i * 3 + 1] > 40) {
          pos[i * 3 + 1] = -5;
          pos[i * 3 + 0] = (Math.random() - 0.5) * 100;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 100;
        }
      }
      geometry.attributes.position.needsUpdate = true;
    }
  };
}

