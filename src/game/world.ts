import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { terrainHeight, ramps } from "./physics";

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
  const geometry = new THREE.PlaneGeometry(220, 220);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    vertexShader:
      "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: `varying vec2 vUv;
      void main(){ vec2 p=vUv-.5; float d=length(p); if(d>.5) discard;
      float bands=step(.28,fract((vUv.y+.015)*18.)); if(vUv.y<.55 && bands<.5) discard;
      vec3 col=mix(vec3(1.,.16,.32),vec3(1.,.77,.43),smoothstep(.1,1.,vUv.y));
      gl_FragColor=vec4(col, .96); }`,
  });
  const sun = new THREE.Mesh(geometry, material);
  sun.position.set(-100, 145, -590);
  scene.add(sun);
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader:
        "varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "varying vec2 vUv; void main(){float a=pow(max(0.,1.-length(vUv-.5)*2.),4.); gl_FragColor=vec4(.8,.15,.18,a*.32);}",
    }),
  );
  halo.position.copy(sun.position);
  halo.position.z -= 1;
  scene.add(halo);
}
function createSky(scene: THREE.Scene) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 24, 16),
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
      radius = 1250;
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
  const geo = new THREE.PlaneGeometry(1900, 1900, 170, 170);
  geo.rotateX(-Math.PI / 2);
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
  const grid = new THREE.GridHelper(1000, 100, 0x4db49f, 0x255957);
  grid.position.y = -1.3;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.25;
  scene.add(grid);
}
function createRoad(scene: THREE.Scene) {
  const nodes = [
    [0, 125],
    [38, 70],
    [105, -25],
    [93, -122],
    [20, -211],
    [-104, -160],
    [-138, -54],
    [-88, 52],
  ];
  const path = new THREE.CatmullRomCurve3(
    nodes.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    "catmullrom",
    0.35,
  );
  const vertices: number[] = [],
    indices: number[] = [],
    left: THREE.Vector3[] = [],
    right: THREE.Vector3[] = [];
  const samples = 360;
  for (let i = 0; i <= samples; i++) {
    const p = path.getPoint(i / samples),
      t = path.getTangent(i / samples),
      n = new THREE.Vector3(-t.z, 0, t.x);
    const l = p.clone().addScaledVector(n, 10),
      r = p.clone().addScaledVector(n, -10);
    l.y = terrainHeight(l.x, l.z) + 0.2;
    r.y = terrainHeight(r.x, r.z) + 0.2;
    left.push(l);
    right.push(r);
    vertices.push(l.x, l.y, l.z, r.x, r.y, r.z);
    if (i < samples) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    if (i % 5 === 0) {
      const dash = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.04, 2.4),
        new THREE.MeshBasicMaterial({ color: 0x78b4b1 }),
      );
      dash.position.set(p.x, terrainHeight(p.x, p.z) + 0.23, p.z);
      dash.rotation.y = Math.atan2(t.x, t.z);
      scene.add(dash);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  scene.add(
    new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0x11101f,
        metalness: 0.65,
        roughness: 0.5,
        side: THREE.DoubleSide,
      }),
    ),
  );
  for (const edge of [left, right])
    scene.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(edge),
          360,
          0.085,
          4,
          false,
        ),
        new THREE.MeshBasicMaterial({ color: 0xff527d }),
      ),
    );
  for (let i = 0; i < 24; i++) {
    const p = path.getPoint(i / 24),
      t = path.getTangent(i / 24),
      n = new THREE.Vector3(-t.z, 0, t.x);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 1.6, 0.12),
        new THREE.MeshBasicMaterial({ color: i % 3 ? 0x86fadd : 0xff5b82 }),
      );
      post.position.set(
        p.x + n.x * 12 * side,
        terrainHeight(p.x + n.x * 12 * side, p.z + n.z * 12 * side) + 0.8,
        p.z + n.z * 12 * side,
      );
      scene.add(post);
    }
  }
}
function createRamps(scene: THREE.Scene) {
  for (const ramp of ramps) {
    const w = ramp.width / 2,
      l = ramp.length / 2,
      h = ramp.height;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [-w, 0, l, w, 0, l, -w, h, -l, w, h, -l],
        3,
      ),
    );
    geo.setIndex([0, 2, 1, 1, 2, 3]);
    geo.computeVertexNormals();
    const g = outlined(geo, 0x86fadd, 0x112b2b);
    g.position.set(ramp.x, terrainHeight(ramp.x, ramp.z) + 0.25, ramp.z);
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
  for (let i = 0; i < 45; i++) {
    const angle = i * 2.39996,
      radius = 230 + Math.sin(i * 13) * 45,
      x = Math.cos(angle) * radius,
      z = Math.sin(angle) * radius - 50;
    const h = 5 + (Math.sin(i * 17) + 1) * 12;
    const rock = outlined(
      new THREE.ConeGeometry(5 + (i % 5), h, 4, 1),
      i % 3 ? 0x225d64 : 0x5c375f,
      0x0b0e19,
      0.8,
    );
    rock.position.set(x, terrainHeight(x, z) + h / 2, z);
    rock.rotation.y = i;
    scene.add(rock);
  }
  // A pair of enormous, distant broadcast pylons frames the arena.
  for (const x of [-240, 245]) {
    const tower = outlined(
      new THREE.CylinderGeometry(1, 5, 70, 4, 8, true),
      0x35635f,
      0x08100f,
    );
    tower.position.set(x, terrainHeight(x, -230) + 35, -230);
    scene.add(tower);
    const hoop = ring(10, 0x6b466c, 0.15);
    hoop.position.set(x, tower.position.y + 37, -230);
    scene.add(hoop);
  }
  const bounds = new THREE.Mesh(
    new THREE.TorusGeometry(342, 0.2, 4, 180),
    new THREE.MeshBasicMaterial({
      color: 0x6c4e8d,
      transparent: true,
      opacity: 0.5,
    }),
  );
  bounds.rotation.x = Math.PI / 2;
  bounds.position.set(0, 2, -50);
  scene.add(bounds);
}
export function createWorld(scene: THREE.Scene) {
  scene.fog = new THREE.FogExp2(0x080d16, 0.0018);
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
  group.userData.index = index;
  return group;
}
export function createBoss(texture: THREE.Texture, color: number) {
  const group = new THREE.Group();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 12; x++) {
      ctx.fillStyle =
        (x + y) % 2 ? "#141323" : new THREE.Color(color).getStyle();
      ctx.fillRect((x * 256) / 12, y * 32, 256 / 12 + 1, 32);
    }
  const map = new THREE.CanvasTexture(canvas);
  map.magFilter = THREE.NearestFilter;
  map.colorSpace = THREE.SRGBColorSpace;
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(12, 32, 24),
    new THREE.MeshStandardMaterial({
      map,
      metalness: 0.5,
      roughness: 0.3,
      emissive: color,
      emissiveIntensity: 0.15,
    }),
  );
  group.add(core);
  const cage = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(18, 1)),
    new THREE.LineBasicMaterial({
      color: 0x548984,
      transparent: true,
      opacity: 0.45,
    }),
  );
  group.add(cage);
  for (let i = 0; i < 3; i++) {
    const orbit = ring(20 + i * 2, i % 2 ? COLORS.mint : color, 0.13);
    orbit.rotation.set(0.8 + i * 0.4, 0.3 + i * 0.8, i * 0.9);
    group.add(orbit);
  }
  const eye = glow(0xffffff, 9, texture);
  eye.position.set(0, 2, 11.7);
  group.add(eye);
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(25, 24, 16),
    new THREE.MeshBasicMaterial({
      color: COLORS.mint,
      wireframe: true,
      transparent: true,
      opacity: 0.07,
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
