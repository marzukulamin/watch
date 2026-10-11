import * as THREE from 'three';
import { reduced } from './motion.js';
// Product photography in an interactive 3D stage. No invented product geometry.
export async function mountScene(container, imagePath) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  container.prepend(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: innerWidth > 700,
      powerPreference: 'low-power',
    });
  } catch {
    canvas.remove();
    container.classList.add('scene-fallback');
    return () => {};
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.3 : 1.75));
  renderer.setClearColor(0x0d0907, 0);
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
  camera.position.z = 10;
  const stage = new THREE.Group();
  scene.add(stage);
  const ornaments = new THREE.Group();
  ornaments.position.z = -3;
  stage.add(ornaments);
  const metal = new THREE.MeshStandardMaterial({
    color: 0xab8864,
    metalness: 0.78,
    roughness: 0.3,
  });
  const torus = new THREE.TorusGeometry(2.12, 0.012, 6, 120);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(torus, metal);
    ring.rotation.set(0.55 + i * 0.5, 0.15 + i * 0.6, 0.3);
    ring.scale.setScalar(1 + i * 0.14);
    ornaments.add(ring);
  }
  const ticksGeo = new THREE.BoxGeometry(0.012, 0.075, 0.012),
    ticksMaterial = new THREE.MeshBasicMaterial({
      color: 0x967756,
      transparent: true,
      opacity: 0.5,
    });
  const ticks = new THREE.InstancedMesh(ticksGeo, ticksMaterial, 60),
    dummy = new THREE.Object3D();
  for (let i = 0; i < 60; i++) {
    const theta = (i * Math.PI) / 30;
    dummy.position.set(Math.sin(theta) * 2.6, Math.cos(theta) * 2.6, -0.5);
    dummy.rotation.z = -theta;
    dummy.updateMatrix();
    ticks.setMatrixAt(i, dummy.matrix);
  }
  ornaments.add(ticks);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const light = new THREE.DirectionalLight(0xf7d4a5, 4);
  light.position.set(3, 4, 5);
  scene.add(light);
  const texture = await new THREE.TextureLoader().loadAsync(imagePath).catch(() => null);
  if (!texture) {
    renderer.dispose();
    canvas.remove();
    return () => {};
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  const photoMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { photo: { value: texture } },
    vertexShader:
      'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:
      'uniform sampler2D photo; varying vec2 vUv; void main(){vec4 c=texture2D(photo,vUv);float white=min(c.r,min(c.g,c.b));float a=(1.0-smoothstep(0.88,0.99,white))*smoothstep(0.04,0.065,vUv.y);gl_FragColor=vec4(c.rgb,a);\n#include <colorspace_fragment>\n}',
  });
  const geometry = new THREE.PlaneGeometry(4.5, 4.5),
    photo = new THREE.Mesh(geometry, photoMaterial);
  photo.position.z = 0.4;
  photo.rotation.z = -0.21;
  stage.add(photo);
  container.classList.add('scene-ready');
  let active = false,
    disposed = false,
    frame = 0,
    last = 0,
    paused = reduced.matches,
    angle = -0.21,
    targetX = 0,
    targetY = 0;
  const resize = () => {
    if (disposed) return;
    const w = container.clientWidth,
      h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    render(performance.now(), true);
  };
  const render = (time, once = false) => {
    if (disposed) return;
    if (!once && time - last < 1000 / (innerWidth < 768 ? 30 : 45)) {
      frame = requestAnimationFrame(render);
      return;
    }
    last = time;
    const hero = container.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, -hero.top / Math.max(1, hero.height)));
    stage.rotation.y = THREE.MathUtils.lerp(
      stage.rotation.y,
      targetX * 0.16 + progress * 0.28,
      0.065,
    );
    stage.rotation.x = THREE.MathUtils.lerp(stage.rotation.x, targetY * 0.08, 0.065);
    photo.rotation.z = angle + progress * 0.18;
    ornaments.rotation.z = paused ? 0 : time * 0.000025;
    stage.position.y = paused ? 0 : Math.sin(time * 0.0005) * 0.06;
    renderer.render(scene, camera);
    if (!once && active && !paused && !document.hidden) frame = requestAnimationFrame(render);
  };
  const restart = () => {
    cancelAnimationFrame(frame);
    if (active && !document.hidden) {
      if (paused) render(performance.now(), true);
      else frame = requestAnimationFrame(render);
    }
  };
  const move = (e) => {
    const r = container.getBoundingClientRect();
    targetX = (e.clientX - r.left) / r.width - 0.5;
    targetY = (e.clientY - r.top) / r.height - 0.5;
    if (paused) render(performance.now(), true);
  };
  container.addEventListener('pointermove', move, { passive: true });
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const io = new IntersectionObserver(
    (entries) => {
      active = entries[0].isIntersecting;
      restart();
    },
    { threshold: 0.03 },
  );
  io.observe(container);
  const visibility = () => restart();
  document.addEventListener('visibilitychange', visibility);
  const mediaChange = () => {
    paused = reduced.matches;
    restart();
  };
  reduced.addEventListener('change', mediaChange);
  const rotate = (direction) => {
    angle += direction * 0.16;
    render(performance.now(), true);
  };
  const left = container.querySelector('[data-scene-left]'),
    right = container.querySelector('[data-scene-right]'),
    pause = container.querySelector('[data-scene-pause]');
  const l = () => rotate(-1),
    r = () => rotate(1),
    p = () => {
      paused = !paused;
      pause.setAttribute('aria-pressed', String(paused));
      pause.textContent = paused ? 'Resume motion' : 'Pause motion';
      restart();
    };
  left?.addEventListener('click', l);
  right?.addEventListener('click', r);
  pause?.addEventListener('click', p);
  resize();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    ro.disconnect();
    io.disconnect();
    container.removeEventListener('pointermove', move);
    document.removeEventListener('visibilitychange', visibility);
    reduced.removeEventListener('change', mediaChange);
    left?.removeEventListener('click', l);
    right?.removeEventListener('click', r);
    pause?.removeEventListener('click', p);
    geometry.dispose();
    torus.dispose();
    ticksGeo.dispose();
    metal.dispose();
    ticksMaterial.dispose();
    photoMaterial.dispose();
    texture.dispose();
    renderer.dispose();
    canvas.remove();
  };
}
