import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
// Original, unbranded concept geometry. Never represented as a catalogue product.
export function createAssemblyScene(canvas) {
  const mobile = innerWidth < 768;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !mobile,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.75));
  renderer.setClearColor(0x080605, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  const watch = new THREE.Group();
  scene.add(watch);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.06);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  const steel = new THREE.MeshStandardMaterial({ color: 0xb6b3a9, metalness: 1, roughness: 0.21 });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xd6b58a,
    metalness: 0.93,
    roughness: 0.22,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x080706, metalness: 0.15, roughness: 0.5 });
  const crystal = new THREE.MeshPhysicalMaterial({
    color: 0xe9e5db,
    metalness: 0,
    roughness: 0.06,
    transparent: true,
    opacity: 0.11,
    clearcoat: 1,
    depthWrite: false,
  });
  scene.add(new THREE.AmbientLight(0xdac6a5, 0.6));
  const key = new THREE.DirectionalLight(0xffecd3, 3.5);
  key.position.set(-4, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 3);
  rim.position.set(4, 0, 2);
  scene.add(rim);
  const parts = [];
  const mesh = (geometry, material = steel) => new THREE.Mesh(geometry, material);
  function part(object, position, order, spread = 0) {
    object.position.set(...position);
    watch.add(object);
    parts.push({
      object,
      position: object.position.clone(),
      quaternion: object.quaternion.clone(),
      order,
      spread,
    });
    return object;
  }
  function disk(radius, depth, material) {
    const m = mesh(new THREE.CylinderGeometry(radius, radius, depth, 64), material);
    m.rotation.x = Math.PI / 2;
    return m;
  }
  function ring(outer, inner, depth, material = steel) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSize: 0.018,
      bevelThickness: 0.018,
      bevelSegments: 2,
      steps: 1,
      curveSegments: 64,
    });
    g.translate(0, 0, -depth / 2);
    return mesh(g, material);
  }
  function gear(radius, teeth) {
    const group = new THREE.Group();
    group.add(ring(radius * 0.83, radius * 0.3, 0.055, gold));
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const tooth = mesh(new THREE.BoxGeometry(radius * 0.17, radius * 0.21, 0.055), gold);
      tooth.position.set(Math.sin(a) * radius * 0.86, Math.cos(a) * radius * 0.86, 0);
      tooth.rotation.z = -a;
      group.add(tooth);
    }
    return group;
  }
  part(ring(1.13, 0.91, 0.26), [0, 0, -0.12], 0, -0.35);
  part(gear(0.36, 18), [-0.35, 0.2, -0.16], 1, -0.25);
  part(gear(0.29, 16), [0.29, 0.27, -0.16], 2, -0.2);
  part(gear(0.23, 14), [0.12, -0.3, -0.16], 3, -0.15);
  const dial = new THREE.Group();
  dial.add(disk(0.93, 0.045, dark));
  for (let i = 0; i < 60; i++) {
    const a = (i * Math.PI) / 30;
    const major = i % 5 === 0;
    const marker = mesh(
      new THREE.BoxGeometry(major ? 0.035 : 0.013, major ? 0.12 : 0.043, 0.024),
      major ? gold : steel,
    );
    marker.position.set(Math.sin(a) * 0.82, Math.cos(a) * 0.82, 0.038);
    marker.rotation.z = -a;
    dial.add(marker);
  }
  // Restrained dial detailing; no retailer logo is printed on an invented product.
  const chapter = mesh(new THREE.TorusGeometry(0.735, 0.003, 4, 64), gold);
  chapter.position.z = 0.035;
  dial.add(chapter);
  part(dial, [0, 0, 0.025], 4, 0.28);
  function hand(length, width, angle, material) {
    const group = new THREE.Group();
    const h = mesh(new THREE.BoxGeometry(width, length, 0.022), material);
    h.position.y = length * 0.35;
    group.add(h);
    group.rotation.z = angle;
    return group;
  }
  part(hand(0.55, 0.046, Math.PI / 3, gold), [0, 0, 0.094], 5, 0.5);
  part(hand(0.72, 0.029, -Math.PI / 3, gold), [0, 0, 0.12], 6, 0.62);
  part(hand(0.8, 0.009, Math.PI * 0.88, steel), [0, 0, 0.143], 7, 0.74);
  part(disk(0.055, 0.036, gold), [0, 0, 0.16], 8, 0.8);
  part(disk(0.955, 0.018, crystal), [0, 0, 0.21], 9, 1);
  part(ring(1.115, 0.96, 0.07, gold), [0, 0, 0.19], 10, 1.25);
  const crown = new THREE.Group();
  const crownCore = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 32), gold);
  crownCore.rotation.z = Math.PI / 2;
  crown.add(crownCore);
  for (let i = 0; i < 6; i++) {
    const r = mesh(new THREE.TorusGeometry(0.12, 0.009, 5, 32));
    r.rotation.y = Math.PI / 2;
    r.position.x = -0.09 + i * 0.036;
    crown.add(r);
  }
  part(crown, [1.2, 0, -0.03], 11, 0.2);
  for (const sign of [-1, 1]) {
    for (const side of [-1, 1]) {
      const lug = mesh(new THREE.BoxGeometry(0.13, 0.44, 0.18));
      lug.rotation.z = sign * side * 0.18;
      part(lug, [side * 0.64, sign * 1.08, -0.11], 12 + (sign + 1) * 0.15, 0.1);
    }
    for (let i = 0; i < 8; i++) {
      const link = new THREE.Group(),
        w = 0.95 - i * 0.025;
      const g = new RoundedBoxGeometry(w, 0.235, 0.12, 2, 0.025);
      const outer = mesh(g);
      link.add(outer);
      const center = mesh(new RoundedBoxGeometry(w * 0.36, 0.22, 0.135, 2, 0.016), gold);
      center.position.z = 0.011;
      link.add(center);
      part(
        link,
        [0, sign * (1.25 + i * 0.25), -0.13 - Math.pow(i / 8, 2) * 0.13],
        13 + i * 0.12 + (sign + 1) * 0.15,
        0.3 + i * 0.03,
      );
    }
  }
  const oblique = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.24, -0.58, -0.07));
  const frontal = new THREE.Quaternion();
  const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, 0.5, 0.12));
  const ease = (t) => {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  };
  let disposed = false;
  function resize() {
    if (disposed) return;
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.position.set(0, 0, camera.aspect < 0.7 ? 16 : 12);
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  function frame(seconds) {
    if (disposed) return;
    watch.visible = seconds >= 1.35;
    watch.position.y = 0.7;
    watch.quaternion.copy(oblique).slerp(frontal, ease((seconds - 6.5) / 1.5));
    watch.scale.setScalar(0.73 + 0.025 * ease((seconds - 6.5) / 1.5));
    for (const p of parts) {
      const arrival = ease((seconds - 1.5 - p.order * 0.09) / 1.4);
      const seat = ease((seconds - 4 - p.order * 0.06) / 1.65);
      p.object.position.copy(p.position);
      p.object.position.x += (1 - arrival) * (4.9 + p.order * 0.06);
      p.object.position.z += (1 - seat) * (p.spread + 1.1);
      p.object.position.y += (1 - arrival) * (0.25 * Math.sin(p.order));
      p.object.quaternion
        .copy(p.quaternion)
        .multiply(new THREE.Quaternion().slerp(turn, (1 - arrival) * 0.8));
    }
    key.position.x = -4 + 8 * ease((seconds - 7.7) / 1.3);
    renderer.render(scene, camera);
  }
  return {
    frame,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      const geometries = new Set(),
        materials = new Set();
      scene.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
        if (o.material) materials.add(o.material);
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
