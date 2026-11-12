import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { SceneManager } from './scene.js';
import { WorldBuilder } from './islands.js';
import { FunkoCharacter } from './character.js';
import { createSpatialParticles } from './particles.js';
import { sound } from './audio.js';
import { portfolioData } from './data.js';

class App {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.sceneManager = new SceneManager(this.container);
    this.world = new WorldBuilder(this.sceneManager.scene).buildAll();
    this.character = new FunkoCharacter(this.sceneManager.scene);
    this.particles = createSpatialParticles(1400);
    this.sceneManager.scene.add(this.particles.mesh);

    this.currentStation = 'hub';
    this.isTransitioning = false;
    this.currentCameraPresetIndex = 0;
    this.cameraPresets = ['isometric', 'cinematic', 'topdown'];

    // Initialize hub whole-island illumination
    this.world.setIslandIllumination('hub', false);
    this.world.setActiveDestination('hub');
    this.updateDestinationHUD('hub', false);

    this.initRaycasting();
    this.initUI();
    this.animate = this.animate.bind(this);

    requestAnimationFrame(this.animate);
  }

  initRaycasting() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    const getRaycastTargets = () => {
      const targets = [...this.world.interactiveObjects];
      if (this.character && this.character.group) {
        targets.push(this.character.group);
      }
      return targets;
    };

    const onPointerMove = (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);
      const intersects = this.raycaster.intersectObjects(getRaycastTargets(), true);

      if (intersects.length > 0) {
        document.body.style.cursor = 'pointer';
      } else {
        document.body.style.cursor = 'default';
      }
    };

    const onPointerDown = (e) => {
      if (e.target.tagName !== 'CANVAS') return;

      this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);
      const intersects = this.raycaster.intersectObjects(getRaycastTargets(), true);

      if (intersects.length > 0) {
        let hitObj = intersects[0].object;
        while (
          hitObj &&
          !hitObj.userData.isCharacter &&
          !hitObj.userData.chapterId &&
          !hitObj.userData.isContactButton &&
          !hitObj.userData.isSoccerBall &&
          !hitObj.userData.isBasketball &&
          !hitObj.userData.isVolleyball
        ) {
          hitObj = hitObj.parent;
        }

        if (!hitObj) return;

        sound.playClick();

        if (hitObj.userData.isCharacter) {
          // When clicking the idle character at the center hub, open general information & introduction
          if (this.currentStation === 'hub' || !this.isTransitioning) {
            this.openAboutModal();
          } else {
            this.openChapterModal(this.currentStation);
          }
        } else if (hitObj.userData.isContactButton) {
          this.openContactModal();
        } else if (hitObj.userData.isSoccerBall) {
          this.world.bounceBall('soccer');
        } else if (hitObj.userData.isBasketball) {
          this.world.bounceBall('basketball');
        } else if (hitObj.userData.isVolleyball) {
          this.world.bounceBall('volleyball');
        } else if (hitObj.userData.chapterId) {
          this.navigateToChapter(hitObj.userData.chapterId);
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerdown', onPointerDown);
  }

  navigateToChapter(targetId) {
    if (this.isTransitioning) return;

    // If already at target, open the dossier or about modal directly
    if (this.currentStation === targetId) {
      if (targetId !== 'hub') {
        this.openChapterModal(targetId);
      } else {
        this.openAboutModal();
      }
      return;
    }

    this.isTransitioning = true;
    this.updateNavPills(targetId);
    this.updateTelemetry(`WALKING TOWARDS ${targetId.toUpperCase()}...`);

    // Color mapping for dynamic spotlight and destination indicators
    const meta = {
      hub: { color: '#f59e0b' },
      chapter1: { color: '#00f0ff' },
      chapter2: { color: '#3b82f6' },
      chapter3: { color: '#a855f7' },
      chapter4: { color: '#10b981' }
    };
    const targetCenter = this.world.islandCenters[targetId] || this.world.islandCenters.hub;
    const colorHex = (meta[targetId] || meta.hub).color;

    // While walking, islands dim to standby
    this.world.setIslandIllumination(targetId, true);
    this.world.setActiveDestination(targetId);
    this.updateDestinationHUD(targetId, true);

    // Determine path spline
    let curve = null;
    if (this.currentStation === 'hub') {
      curve = this.world.paths[targetId];
    } else if (targetId === 'hub') {
      curve = this.world.paths[`${this.currentStation}_to_hub`];
    } else {
      const targetPosition = this.world.islandCenters[targetId];
      const direction = targetPosition.clone().sub(this.character.group.position).setY(0).normalize();
      const start = this.character.group.position.clone();
      const end = targetPosition.clone().addScaledVector(direction, -4.5);
      start.y = 0.8;
      end.y = 0.8;

      const control = start.clone().add(end).multiplyScalar(0.5);
      control.y = 2.4;

      const midpointFromHub = control.clone().sub(this.world.islandCenters.hub).setY(0);
      if (midpointFromHub.length() < 8) {
        control.add(new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(24));
      }

      curve = new THREE.QuadraticBezierCurve3(start, control, end);
    }

    if (!curve) {
      // Fallback direct teleport if needed
      const dest = this.world.islandCenters[targetId] || this.world.islandCenters.hub;
      this.character.group.position.copy(dest);
      this.character.transformTo(targetId);
      this.onArrival(targetId);
      return;
    }

    // Camera follow focus
    this.sceneManager.focusOn(
      targetCenter.clone().add(new THREE.Vector3(25, 20, 25)),
      targetCenter,
      2.6
    );

    // Command Funko avatar to walk
    const duration = this.currentStation !== 'hub' && targetId !== 'hub'
      ? Math.max(2.4, curve.getLength() / 14)
      : 2.4;
    this.character.walkAlongPath(curve, duration, targetId, (arrivedId) => {
      this.onArrival(arrivedId);
    });
  }

  onArrival(arrivedId) {
    this.isTransitioning = false;
    this.currentStation = arrivedId;
    this.updateNavPills(arrivedId);
    this.updateTelemetry(`ARRIVED AT ${arrivedId.toUpperCase()} // READY`);

    // Character reached the island: the WHOLE island bursts into radiant light!
    this.world.setIslandIllumination(arrivedId, false);
    this.world.setActiveDestination(arrivedId);
    this.updateDestinationHUD(arrivedId, false);

    // Confetti celebration on chapter arrival
    if (arrivedId !== 'hub') {
      const colors = {
        chapter1: ['#00f0ff', '#38bdf8', '#ffffff'],
        chapter2: ['#3b82f6', '#60a5fa', '#f97316'],
        chapter3: ['#a855f7', '#c084fc', '#facc15'],
        chapter4: ['#10b981', '#34d399', '#00ff88']
      };
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.7 },
        colors: colors[arrivedId] || ['#00f0ff']
      });

      setTimeout(() => {
        this.openChapterModal(arrivedId);
      }, 400);
    }
  }

  updateNavPills(activeId) {
    document.querySelectorAll('.nav-pill').forEach(btn => {
      if (btn.dataset.chapter === activeId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  updateTelemetry(statusText) {
    const el = document.getElementById('telemetry-status');
    if (el) el.textContent = statusText;
  }

  // Update prominent glassmorphic HUD card showing current destination
  updateDestinationHUD(destinationId, isWalking = false) {
    const meta = {
      hub: { title: 'INTERACTIVE JOURNEY HUB', era: 'Nexus Origin • Ages 7–21+', color: '#f59e0b' },
      chapter1: { title: 'CH.1 ELEMENTARY SCHOOL', era: 'Ages 7–12 • Foundations & Curiosity', color: '#00f0ff' },
      chapter2: { title: 'CH.2 CCSA JUNIOR HIGH', era: 'Ages 13–16 • Arts & Basketball Arena', color: '#3b82f6' },
      chapter3: { title: 'CH.3 TRACE COLLEGE TVL-ICT', era: 'Ages 17–19 • Hardware & Code Matrix', color: '#a855f7' },
      chapter4: { title: 'CH.4 CCC & PRESENT', era: 'Ages 19–21 • Varsity & AI Engineering', color: '#10b981' }
    };

    const info = meta[destinationId] || meta.hub;
    const hudTitle = document.getElementById('dest-hud-title');
    const hudMeta = document.getElementById('dest-hud-meta');
    const hudLabel = document.getElementById('dest-badge-label');
    const hudCard = document.getElementById('current-destination-hud');

    if (hudTitle) {
      hudTitle.textContent = info.title;
      hudTitle.style.color = info.color;
    }
    if (hudMeta) {
      hudMeta.textContent = isWalking ? `En route... traveling along neon pathway` : info.era;
    }
    if (hudLabel) {
      hudLabel.textContent = isWalking ? 'WALKING TO DESTINATION' : 'STANDING ON DESTINATION';
    }
    if (hudCard) {
      hudCard.style.borderColor = info.color;
      hudCard.style.boxShadow = `0 0 24px ${info.color}44`;
    }

    const standingText = isWalking 
      ? `EN ROUTE: ${info.title}`
      : `STANDING ON: ${info.title} (${info.era})`;
    const standingEl = document.getElementById('telemetry-destination');
    if (standingEl) standingEl.textContent = standingText;
  }

  openChapterModal(chapterId) {
    const data = portfolioData.chapters[chapterId];
    if (!data) return;

    sound.playChapterArrival(chapterId);

    const modal = document.getElementById('chapter-modal');
    const badge = document.getElementById('modal-badge');
    const title = document.getElementById('modal-title');
    const meta = document.getElementById('modal-meta');
    const story = document.getElementById('modal-story');
    const milestonesList = document.getElementById('modal-milestones');
    const skillsList = document.getElementById('modal-skills');
    const featuresList = document.getElementById('modal-features');

    badge.textContent = data.badge;
    badge.style.backgroundColor = `${data.color}22`;
    badge.style.color = data.color;
    badge.style.border = `1px solid ${data.color}`;

    title.textContent = data.title;
    let metaText = data.institution;
    if (data.specialization) metaText += ` • ${data.specialization}`;
    if (data.strand) metaText += ` • Strand: ${data.strand}`;
    metaText += ` • ${data.era}`;
    meta.textContent = metaText;
    story.textContent = data.story;

    // Honors & Achievements
    const achievementsList = document.getElementById('modal-achievements');
    if (achievementsList) {
      achievementsList.innerHTML = '';
      (data.achievements || []).forEach(ach => {
        const card = document.createElement('div');
        card.className = 'achievement-card';
        card.innerHTML = `<span class="achievement-icon">🏆</span><span class="achievement-text">${ach}</span>`;
        achievementsList.appendChild(card);
      });
    }

    // Milestones
    milestonesList.innerHTML = '';
    (data.keyMilestones || []).forEach(m => {
      const item = document.createElement('div');
      item.className = 'milestone-item';
      item.style.borderLeftColor = data.color;
      item.innerHTML = `<div class="milestone-label">${m.label}</div><div class="milestone-desc">${m.desc}</div>`;
      milestonesList.appendChild(item);
    });

    // Skills
    skillsList.innerHTML = '';
    (data.skillsLearned || []).forEach(s => {
      const tag = document.createElement('span');
      tag.className = 'skill-tag';
      tag.style.borderColor = `${data.color}55`;
      tag.textContent = s;
      skillsList.appendChild(tag);
    });

    // Diorama Features
    featuresList.innerHTML = '';
    (data.dioramaFeatures || []).forEach(f => {
      const item = document.createElement('div');
      item.className = 'milestone-item';
      item.style.borderLeftColor = data.accentColor || data.color;
      item.innerHTML = `<div class="milestone-desc" style="color: #f1f5f9;">✦ ${f}</div>`;
      featuresList.appendChild(item);
    });

    modal.classList.add('open');
  }

  openContactModal() {
    sound.playClick();
    const modal = document.getElementById('contact-modal');
    modal.classList.add('open');
  }

  openAboutModal() {
    sound.playClick();
    const modal = document.getElementById('about-modal');
    if (!modal) return;

    // Dynamically populate core pillars if container is empty
    const pillarsContainer = document.getElementById('about-pillars');
    if (pillarsContainer && pillarsContainer.children.length === 0) {
      const pillars = portfolioData.developer.generalInfo.corePillars || [];
      pillars.forEach(p => {
        const card = document.createElement('div');
        card.className = 'pillar-card';
        card.innerHTML = `
          <div class="pillar-icon">${p.icon}</div>
          <div>
            <div class="pillar-title">${p.title}</div>
            <div class="pillar-desc">${p.desc}</div>
          </div>
        `;
        pillarsContainer.appendChild(card);
      });
    }

    modal.classList.add('open');
  }

  renderProjects(filter = 'all') {
    const container = document.getElementById('projects-container');
    if (!container) return;
    container.innerHTML = '';

    const gdProjects = (portfolioData.projects && portfolioData.projects.graphicDesign) || [];
    const sdProjects = (portfolioData.projects && portfolioData.projects.softwareDevelopment) || [];

    let list = [];
    if (filter === 'all' || filter === 'graphic-design') {
      list = list.concat(gdProjects.map(p => ({ ...p, isGraphic: true })));
    }
    if (filter === 'all' || filter === 'software-dev') {
      list = list.concat(sdProjects.map(p => ({ ...p, isSoftware: true })));
    }

    list.forEach(proj => {
      const card = document.createElement('div');
      card.className = `project-card ${proj.isGraphic ? 'type-graphic' : 'type-software'}`;

      const tagsHtml = (proj.tags || []).map(t => `<span class="project-tag">${t}</span>`).join('');

      let actionHtml = '';
      if (proj.isGraphic && proj.driveLink) {
        actionHtml = `
          <a href="${proj.driveLink}" target="_blank" rel="noopener noreferrer" class="btn-drive-action">
            <span>📂</span> OPEN IN GOOGLE DRIVE
          </a>
        `;
      } else {
        actionHtml = `
          <span class="software-status-tag">⚡ ${proj.status || 'IN ACTIVE DEVELOPMENT'}</span>
        `;
      }

      card.innerHTML = `
        <div>
          <div class="project-top-row">
            <span class="project-category-badge ${proj.isGraphic ? 'badge-graphic' : 'badge-software'}">
              ${proj.icon} ${proj.category.toUpperCase()}
            </span>
            <span style="font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">
              ${proj.type || 'Repo System'}
            </span>
          </div>
          <h4 class="project-title">${proj.title}</h4>
          <p class="project-desc">${proj.desc}</p>
          <div class="project-tags">${tagsHtml}</div>
        </div>
        <div class="project-actions">
          ${actionHtml}
        </div>
      `;

      container.appendChild(card);
    });
  }

  openProjectsModal(filter = 'all') {
    sound.playClick();
    this.renderProjects(filter);

    // Reset tab active states
    document.querySelectorAll('.project-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    const modal = document.getElementById('projects-modal');
    if (modal) modal.classList.add('open');
  }

  initUI() {
    // Navigation Pills
    document.querySelectorAll('.nav-pills .nav-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const ch = btn.dataset.chapter;
        if (ch) this.navigateToChapter(ch);
      });
    });

    // Header buttons
    const btnAbout = document.getElementById('btn-about');
    if (btnAbout) btnAbout.addEventListener('click', () => this.openAboutModal());

    document.getElementById('btn-contact-header').addEventListener('click', () => this.openContactModal());

    const btnProjects = document.getElementById('btn-projects');
    if (btnProjects) {
      btnProjects.addEventListener('click', () => {
        this.openProjectsModal('all');
      });
    }

    // Projects Tab Switcher buttons
    document.querySelectorAll('.project-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        document.querySelectorAll('.project-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter || 'all';
        this.renderProjects(filter);
      });
    });

    // Toggle 3D Concept Art view inside Projects Modal
    const btnToggleConcept = document.getElementById('btn-toggle-concept-art');
    if (btnToggleConcept) {
      btnToggleConcept.addEventListener('click', () => {
        sound.playClick();
        const section = document.getElementById('inline-concept-art');
        if (section) {
          const isClosed = section.style.display === 'none' || section.style.display === '';
          section.style.display = isClosed ? 'block' : 'none';
          btnToggleConcept.innerHTML = isClosed 
            ? '<span>✕</span> HIDE CONCEPT ART' 
            : '<span>🖼️</span> 3D DIORAMA CONCEPT ART';
        }
      });
    }

    // Camera preset switcher
    const camBtn = document.getElementById('btn-camera-view');
    camBtn.addEventListener('click', () => {
      sound.playClick();
      this.currentCameraPresetIndex = (this.currentCameraPresetIndex + 1) % this.cameraPresets.length;
      const preset = this.cameraPresets[this.currentCameraPresetIndex];
      camBtn.innerHTML = `<span>📷</span> CAM: ${preset.toUpperCase().slice(0, 3)}`;
      this.sceneManager.setCameraPreset(preset);
    });

    // Audio toggle
    const audioBtn = document.getElementById('btn-audio-toggle');
    audioBtn.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      if (isMuted) {
        audioBtn.innerHTML = `<span>🔇</span> AUDIO: OFF`;
      } else {
        audioBtn.innerHTML = `<span>🔊</span> AUDIO: ON`;
        sound.startMusic();
      }
    });

    // Modal Close buttons
    document.getElementById('chapter-modal-close').addEventListener('click', () => {
      document.getElementById('chapter-modal').classList.remove('open');
    });
    document.getElementById('modal-close-action').addEventListener('click', () => {
      document.getElementById('chapter-modal').classList.remove('open');
    });
    document.getElementById('modal-return-hub').addEventListener('click', () => {
      document.getElementById('chapter-modal').classList.remove('open');
      this.navigateToChapter('hub');
    });

    document.getElementById('contact-modal-close').addEventListener('click', () => {
      document.getElementById('contact-modal').classList.remove('open');
    });
    const projectsCloseBtn = document.getElementById('projects-modal-close');
    if (projectsCloseBtn) {
      projectsCloseBtn.addEventListener('click', () => {
        document.getElementById('projects-modal').classList.remove('open');
      });
    }

    // About Modal Close & Action buttons
    const aboutCloseBtn = document.getElementById('about-modal-close');
    if (aboutCloseBtn) {
      aboutCloseBtn.addEventListener('click', () => {
        document.getElementById('about-modal').classList.remove('open');
      });
    }
    const aboutCloseAction = document.getElementById('about-close-action');
    if (aboutCloseAction) {
      aboutCloseAction.addEventListener('click', () => {
        document.getElementById('about-modal').classList.remove('open');
      });
    }
    const aboutOpenContact = document.getElementById('about-open-contact');
    if (aboutOpenContact) {
      aboutOpenContact.addEventListener('click', () => {
        document.getElementById('about-modal').classList.remove('open');
        this.openContactModal();
      });
    }

    // Copy Email button
    document.getElementById('btn-copy-email').addEventListener('click', () => {
      navigator.clipboard.writeText('jeamuel.amado@example.com');
      const btn = document.getElementById('btn-copy-email');
      const oldText = btn.innerHTML;
      btn.innerHTML = '✓ EMAIL COPIED!';
      sound.playClick();
      setTimeout(() => { btn.innerHTML = oldText; }, 2000);
    });

    // Send Transmission form
    document.getElementById('contact-form').addEventListener('submit', (e) => {
      e.preventDefault();
      sound.playTeleport();
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#00f0ff', '#10b981']
      });

      const sendBtn = document.getElementById('btn-send-msg');
      sendBtn.innerHTML = '✓ TRANSMISSION SENT!';
      setTimeout(() => {
        document.getElementById('contact-modal').classList.remove('open');
        sendBtn.innerHTML = '⚡ TRANSMIT MESSAGE';
        document.getElementById('contact-form').reset();
      }, 1400);
    });
  }

  animate(timestamp) {
    requestAnimationFrame(this.animate);

    const delta = 0.016; // 60fps delta
    const time = timestamp * 0.001;

    // Update character walk & animations
    this.character.update(delta, time);

    // Update island animations (rotating rings, CRT code, LEDs, light pulses)
    this.world.update(delta, time);

    // Update floating cyberpunk spatial dust particles
    this.particles.update(time);

    // Update coordinates HUD
    const coordsEl = document.getElementById('telemetry-coords');
    if (coordsEl) {
      const p = this.character.group.position;
      coordsEl.textContent = `POS: [${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}]`;
    }

    // Render WebGL
    this.sceneManager.render();
  }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
  new App();
});

