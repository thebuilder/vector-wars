import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { terrainHeight, ramps, rampHeight } from "./physics";

import {
  PILLARS,
  OUTPOSTS,
  WORLD_RADIUS,
  WORLD_CENTER_Z,
} from "./layout";

import { sampleRoad } from "./roads";

export const COLORS = {
  mint: 0x86fadd,
  pink: 0xff5b82,
  dark: 0x05090a,
  violet: 0x956add,
};
export function outlined(
  geometry: THREE.BufferGeometry,
  color: number,
  fill = 0x10161d,
  opacity = 1,
): THREE.Group {
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: fill,
        roughness: 0.55,
        metalness: 0.45,
      }),
    ),
  );
  group.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
    ),
  );
  return group;
}
export function ring(
  radius: number,
  color: number,
  thickness = 0.12,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, thickness, 6, 80),
    new THREE.MeshBasicMaterial({ color }),
  );
  return mesh;
}
export function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.15, "#ffffff");
  grad.addColorStop(0.4, "rgba(255,255,255,.25)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}
export function glow(
  color: number,
  size: number,
  texture: THREE.Texture,
): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sprite.scale.set(size, size, 1);
  return sprite;
}
function createSun(scene: THREE.Scene) {
  // A distant, fixed-size light on the horizon rather than an arena prop.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(105, 64),
    new THREE.MeshBasicMaterial({ color: 0xe98e7b, fog: false }),
  );
  sun.position.set(-1100, 230, -2750);
  scene.add(sun);
}
function createSky(scene: THREE.Scene) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(3900, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader:
        "varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: `varying vec3 vPosition; void main(){float h=normalize(vPosition).y; vec3 col=mix(vec3(.09,.035,.085),vec3(.013,.022,.035),smoothstep(-.05,.42,h)); gl_FragColor=vec4(col,1.);}`,
    }),
  );
  scene.add(sky);
  let seed = 87;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const points: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < 1600; i++) {
    const theta = random() * Math.PI * 2,
      y = random() * 0.92 + 0.02,
      radius = 3200;
    points.push(
      Math.cos(theta) * Math.sqrt(1 - y * y) * radius,
      y * radius,
      Math.sin(theta) * Math.sqrt(1 - y * y) * radius,
    );
    const c = new THREE.Color([0x99c9ce, 0x86fadd, 0xff9cab, 0xffffff][i % 4]);
    colors.push(c.r, c.g, c.b);
  }
  const stars = new THREE.BufferGeometry();
  stars.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  stars.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  scene.add(
    new THREE.Points(
      stars,
      new THREE.PointsMaterial({
        size: 1.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.65,
        sizeAttenuation: false,
        fog: false,
      }),
    ),
  );
  createSun(scene);
}
function createTerrain(scene: THREE.Scene) {
  const geo = new THREE.PlaneGeometry(3100, 3100, 240, 240);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, WORLD_CENTER_Z);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++)
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const surface = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: 0x080e17,
      roughness: 0.85,
      metalness: 0.3,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );
  scene.add(surface);
  const wire = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: 0x388c82,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    }),
  );
  wire.position.y = 0.015;
  scene.add(wire);
  const grid = new THREE.GridHelper(2400, 160, 0x4db49f, 0x255957);
  grid.position.y = -1.3;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.25;
  scene.add(grid);
}
function createRoad(scene: THREE.Scene) {
  const samples=sampleRoad();
  const vertices:number[]=[],indices:number[]=[];
  const edges=[[],[]] as number[][];
  samples.forEach((sample,i)=>{
    const {p,t,left,right,normal,gap}=sample;
    vertices.push(left.x,left.y,left.z,right.x,right.y,right.z);
    [left,right].forEach((edge,index)=>{
      const a=edge.clone().addScaledVector(normal,.12),b=edge.clone().addScaledVector(normal,-.12);
      edges[index].push(a.x,a.y+.02,a.z,b.x,b.y+.02,b.z);
    });
    if(i<samples.length-1 && !gap && !samples[i+1].gap) {
      const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);
    }
    if(i%8===0&&!gap) {
      const dash=new THREE.Mesh(new THREE.BoxGeometry(.22,.04,3),new THREE.MeshBasicMaterial({color:0x78b4b1}));
      dash.position.copy(p);dash.rotation.y=Math.atan2(t.x,t.z);scene.add(dash);
    }
  });
  [vertices,...edges].forEach((positions,index)=>{
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const material=index===0?new THREE.MeshStandardMaterial({color:0x161522,metalness:.45,roughness:.6,side:THREE.DoubleSide}):new THREE.MeshBasicMaterial({color:0xff527d,side:THREE.DoubleSide});
    scene.add(new THREE.Mesh(geometry,material));
  });
}
function createRamps(scene: THREE.Scene) {
  for (const ramp of ramps) {
    const w = ramp.width / 2,
      l = ramp.length / 2,
      h = rampHeight(ramp, ramp.z - l) - rampHeight(ramp, ramp.z + l);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -w,
          0,
          l,
          w,
          0,
          l,
          -w,
          h,
          -l,
          w,
          h,
          -l,
          -w,
          -3,
          -l,
          w,
          -3,
          -l,
          -w,
          -3,
          l,
          w,
          -3,
          l,
        ],
        3,
      ),
    );
    geo.setIndex([
      0, 2, 1, 1, 2, 3, 0, 4, 6, 0, 2, 4, 1, 5, 3, 1, 7, 5, 2, 5, 4, 2, 3, 5,
    ]);
    geo.computeVertexNormals();
    const g = outlined(geo, 0x86fadd, 0x112b2b);
    g.position.set(ramp.x, rampHeight(ramp, ramp.z + l), ramp.z);
    scene.add(g);
    for (let i = 1; i < 7; i++) {
      const t = i / 7;
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(ramp.width - 0.6, 0.08, 0.3),
        new THREE.MeshBasicMaterial({ color: i > 4 ? 0xffbc57 : 0x86fadd }),
      );
      strip.position.set(
        ramp.x,
        g.position.y + t * h + 0.1,
        ramp.z + l - t * ramp.length,
      );
      strip.rotation.x = Math.atan(h / ramp.length);
      scene.add(strip);
    }
  }
}
function createScenery(scene: THREE.Scene) {
  PILLARS.forEach((p, i) => {
    const rock = outlined(
      new THREE.CylinderGeometry(p.radius, p.radius, p.height, 6),
      i % 3 ? 0x326b6b : 0x815579,
      0x0d141d,
      0.8,
    );
    rock.position.set(p.x, terrainHeight(p.x, p.z) + p.height / 2, p.z);
    scene.add(rock);
    if (p.height > 30) {
      const cap = ring(p.radius + 1.5, 0xff5b82, 0.15);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(p.x, terrainHeight(p.x, p.z) + p.height, p.z);
      scene.add(cap);
    }
  });
  OUTPOSTS.forEach((site, i) => {
    const pad = ring(60, [0xffbc57, 0xb890ff, 0x86fadd][i], 0.24);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(site.x, terrainHeight(site.x, site.z) + 0.4, site.z);
    scene.add(pad);
    // Concentric lines give each defended compound a visible territorial footprint.
    const outer = ring(64, 0x455c68, 0.08);
    outer.rotation.copy(pad.rotation);
    outer.position.copy(pad.position);
    scene.add(outer);
  });
  const bounds = ring(WORLD_RADIUS, 0x6c4e8d, 0.3);
  bounds.rotation.x = Math.PI / 2;
  bounds.position.set(0, 2, WORLD_CENTER_Z);
  scene.add(bounds);
}

/** Three physical markers communicate the breach order in world space. */
export function createBreachGates() {
  return OUTPOSTS.map((site) =>
    site.gates.map((gate, index) => {
      const group = new THREE.Group();
      group.position.set(
        gate.x,
        terrainHeight(gate.x, gate.z) + gate.altitude,
        gate.z,
      );
      const hoop = ring(gate.airborne ? 8 : 12, 0xffbc57, 0.22);
      group.add(hoop);
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffcf8a";
      ctx.font = "bold 38px monospace";
      ctx.textAlign = "center";
      ctx.fillText(index === 2 ? "JUMP" : `0${index + 1}`, 64, 45);
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(canvas),
          transparent: true,
          depthWrite: false,
        }),
      );
      label.position.y = gate.airborne ? 11 : 16;
      label.scale.set(11, 5.5, 1);
      group.add(label);
      return group;
    }),
  );
}
export function createWorld(scene: THREE.Scene) {
  scene.fog = new THREE.FogExp2(0x080d16, 0.00085);
  scene.add(new THREE.HemisphereLight(0x9fbfd2, 0x272033, 2));
  const light = new THREE.DirectionalLight(0xffb8b0, 2.8);
  light.position.set(-100, 160, -100);
  scene.add(light);
  createSky(scene);
  createTerrain(scene);
  createRoad(scene);
  createRamps(scene);
  createScenery(scene);
}
export function createShip(texture: THREE.Texture) {
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);
  const placeholder = outlined(
    new THREE.ConeGeometry(1.3, 4.5, 4),
    COLORS.mint,
  );
  placeholder.rotation.x = -Math.PI / 2;
  body.add(placeholder);
  new GLTFLoader().load(
    "/models/vxr-01.glb",
    (gltf) => {
      placeholder.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          const ms = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          ms.forEach((m) => m.dispose());
        }
      });
      body.remove(placeholder);
      const edges: { parent: THREE.Object3D; line: THREE.LineSegments }[] = [];
      gltf.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const line = new THREE.LineSegments(
            new THREE.EdgesGeometry(obj.geometry, 25),
            new THREE.LineBasicMaterial({
              color: 0x749e99,
              transparent: true,
              opacity: 0.45,
            }),
          );
          edges.push({ parent: obj, line });
        }
      });
      edges.forEach(({ parent, line }) => parent.add(line));
      // Blender's -Y nose exports along glTF +Z. The game drives along -Z.
      gltf.scene.rotation.y = Math.PI;
      body.add(gltf.scene);
    },
    undefined,
    () => {
      /* The procedural silhouette remains playable if the model fails to load. */
    },
  );
  const exhausts: THREE.Sprite[] = [];
  for (const x of [-1.65, 1.65]) {
    const exhaust = glow(COLORS.mint, 2.8, texture);
    exhaust.position.set(x, 0.15, 2.5);
    root.add(exhaust);
    exhausts.push(exhaust);
  }
  const underglow = glow(0x39efcf, 4, texture);
  underglow.material.opacity = 0.32;
  underglow.position.y = -0.5;
  root.add(underglow);
  return { root, body, exhausts };
}
export function createRelay(index: number, texture: THREE.Texture) {
  const group = new THREE.Group();
  const base = outlined(new THREE.CylinderGeometry(5, 7, 2, 6), 0x6c9690);
  group.add(base);
  const mast = outlined(
    new THREE.CylinderGeometry(1.7, 3, 15, 4),
    COLORS.pink,
    0x181220,
  );
  mast.position.y = 8;
  group.add(mast);
  const core = outlined(new THREE.OctahedronGeometry(3), COLORS.pink, 0x4c142e);
  core.position.y = 17;
  group.add(core);
  const r = ring(5.5, COLORS.pink, 0.16);
  r.rotation.x = Math.PI / 2;
  r.position.y = 13;
  group.add(r);
  const beacon = glow(COLORS.pink, 13, texture);
  beacon.position.y = 17;
  group.add(beacon);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 100, 6),
    new THREE.MeshBasicMaterial({
      color: COLORS.pink,
      transparent: true,
      opacity: 0.35,
    }),
  );
  beam.position.y = 60;
  group.add(beam);
  const shield = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 24, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x86fadd,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
  );
  shield.name = "relay-shield";
  shield.position.y = 11;
  group.add(shield);
  group.userData.index = index;
  return group;
}
export function createBoss(texture: THREE.Texture, color: number) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(10, 0),
    new THREE.MeshStandardMaterial({
      color: 0x3b2635,
      emissive: color,
      emissiveIntensity: 0.65,
      metalness: 0.7,
      roughness: 0.3,
    }),
  );
  group.add(core);
  const cage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.OctahedronGeometry(12)),
    new THREE.LineBasicMaterial({ color: 0xffdba4 }),
  );
  group.add(cage);
  const hull = outlined(new THREE.BoxGeometry(38, 5, 25), color, 0x111724);
  hull.position.y = -12;
  group.add(hull);
  for (const side of [-1, 1]) {
    const pontoon = outlined(new THREE.BoxGeometry(8, 12, 38), color, 0x15212b);
    pontoon.position.set(side * 20, -9, 0);
    group.add(pontoon);
    for (const z of [-14, 14]) {
      const turret = outlined(
        new THREE.CylinderGeometry(2, 4, 9, 6),
        color,
        0x231725,
      );
      turret.position.set(side * 20, 1, z);
      group.add(turret);
      const muzzle = glow(color, 7, texture);
      muzzle.position.set(side * 20, 6, z);
      group.add(muzzle);
    }
    const strut = outlined(new THREE.BoxGeometry(3, 25, 3), 0x718f97, 0x182331);
    strut.position.set(side * 13, 1, 0);
    strut.rotation.z = side * -0.25;
    group.add(strut);
  }
  const field = ring(14, color, 0.3);
  field.rotation.x = Math.PI / 2;
  field.position.y = -4;
  group.add(field);
  const shield = new THREE.Mesh(
    new THREE.IcosahedronGeometry(32, 2),
    new THREE.MeshBasicMaterial({
      color: COLORS.mint,
      wireframe: true,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
    }),
  );
  shield.name = "shield";
  group.add(shield);
  return { group, core, cage, shield };
}
export function createDrone(texture: THREE.Texture) {
  const group = outlined(
    new THREE.OctahedronGeometry(1.6, 0),
    COLORS.pink,
    0x281424,
  );
  group.scale.set(1.5, 0.5, 1);
  const light = glow(COLORS.pink, 4, texture);
  group.add(light);
  const wing = outlined(
    new THREE.BoxGeometry(5, 0.15, 0.5),
    COLORS.pink,
    0x15111e,
  );
  group.add(wing);
  return group;
}
export function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  root.traverse((obj) => {
    if (
      obj instanceof THREE.Mesh ||
      obj instanceof THREE.LineSegments ||
      obj instanceof THREE.Points ||
      obj instanceof THREE.Sprite
    ) {
      if ("geometry" in obj) geometries.add(obj.geometry);
      for (const material of Array.isArray(obj.material)
        ? obj.material
        : [obj.material]) {
        materials.add(material);
        const m = material as THREE.MeshStandardMaterial;
        if (m.map) textures.add(m.map);
      }
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
