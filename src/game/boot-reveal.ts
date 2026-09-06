import * as THREE from "three";

export const BOOT_DURATION = 4.2;
export const bootScanPosition = (progress: number) => -0.4 + progress * 1.8;
const scanDeclarations = `
  uniform vec2 uBootViewport;
  uniform float uBootFront;
  varying vec3 vBootWorld;
  float bootCoordinate() {
    vec2 direction = vec2(0.8660254, 0.5);
    float diagonal = dot(gl_FragCoord.xy, direction) / dot(uBootViewport, direction);
    float terrainVariation = sin(vBootWorld.x * .031 + vBootWorld.z * .023) * .16
      + sin(vBootWorld.z * .071 - vBootWorld.y * .029) * .09;
    return diagonal + terrainVariation;
  }
`;
type Renderable = THREE.Mesh | THREE.Line | THREE.Points | THREE.Sprite;

/** A single diagonal scan for near and distant geometry, independent of world scale. */
export class BootReveal {
  private progress = { value: 0 };
  private front = { value: bootScanPosition(0) };
  private viewport: { value: THREE.Vector2 };
  private originals: {
    object: Renderable;
    material: Renderable["material"];
  }[] = [];
  private materials: THREE.Material[] = [];
  private wires: THREE.LineSegments[] = [];
  private geometries = new Set<THREE.BufferGeometry>();
  private elapsed = 0;
  private disposed = false;
  private background: THREE.Scene["background"];

  constructor(
    private scene: THREE.Scene,
    viewport = new THREE.Vector2(1, 1),
  ) {
    this.viewport = { value: viewport.clone() };
    this.background = scene.background;
    scene.background = new THREE.Color(0x010503);
    const meshes: THREE.Mesh[] = [];
    const clones = new Map<THREE.Material, THREE.Material>();
    scene.traverse((object) => {
      if (
        !(
          object instanceof THREE.Mesh ||
          object instanceof THREE.Line ||
          object instanceof THREE.Points ||
          object instanceof THREE.Sprite
        )
      )
        return;
      this.originals.push({ object, material: object.material });
      if (object instanceof THREE.Mesh) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        if (
          materials.every(
            (material) =>
              !(material instanceof THREE.ShaderMaterial) &&
              !("wireframe" in material && material.wireframe),
          )
        )
          meshes.push(object);
      }
      const clone = (original: THREE.Material) => {
        const cached = clones.get(original);
        if (cached) return cached;
        const material = original.clone();
        material.onBeforeCompile = (shader, renderer) => {
          original.onBeforeCompile(shader, renderer);
          shader.uniforms.uBootViewport = this.viewport;
          shader.uniforms.uBootFront = this.front;
          shader.vertexShader =
            "varying vec3 vBootWorld;\n" +
            shader.vertexShader.replace(
              /void main\s*\(\s*\)\s*\{/,
              "void main() { vBootWorld = (modelMatrix * vec4(position, 1.0)).xyz;",
            );
          shader.fragmentShader =
            scanDeclarations +
            shader.fragmentShader.replace(
              /void main\s*\(\s*\)\s*\{/,
              `void main() {
                float coverage = smoothstep(bootCoordinate() - .085, bootCoordinate() + .085, uBootFront - .05);
                float grain = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
                if (coverage < grain) discard;
              `,
            );
        };
        material.customProgramCacheKey = () =>
          `boot-scan:${original.customProgramCacheKey()}`;
        clones.set(original, material);
        this.materials.push(material);
        return material;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(clone)
        : clone(object.material);
    });
    const wireMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uBootViewport: this.viewport,
        uBootFront: this.front,
        uBootProgress: this.progress,
      },
      vertexShader:
        "varying vec3 vBootWorld; void main() { vBootWorld = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `${scanDeclarations}
        uniform float uBootProgress;
        void main() {
          float d = bootCoordinate();
          float rim = exp(-pow((d - uBootFront) / 0.045, 2.0));
          float trail = smoothstep(uBootFront - 0.085, uBootFront - 0.025, d) * (1.0 - smoothstep(uBootFront, uBootFront + 0.02, d));
          float blueprint = smoothstep(0.0, .16, uBootProgress) * (1.0 - smoothstep(.7, 1.0, uBootProgress));
          float alpha = blueprint * .045 + rim * .15 + trail * .055;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(0.15, 0.65, 0.45, alpha);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.materials.push(wireMaterial);
    const geometryCache = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
    for (const mesh of meshes) {
      let geometry = geometryCache.get(mesh.geometry);
      if (!geometry) {
        geometry =
          mesh.geometry.getAttribute("position").count > 30000
            ? new THREE.WireframeGeometry(mesh.geometry)
            : new THREE.EdgesGeometry(mesh.geometry, 18);
        geometryCache.set(mesh.geometry, geometry);
        this.geometries.add(geometry);
      }
      const wire = new THREE.LineSegments(geometry, wireMaterial);
      mesh.add(wire);
      this.wires.push(wire);
    }
  }
  resize(viewport: THREE.Vector2) {
    this.viewport.value.copy(viewport);
  }
  update(dt: number) {
    this.elapsed += Math.min(1 / 30, Math.max(0, dt));
    const progress = Math.min(1, this.elapsed / BOOT_DURATION);
    this.front.value = bootScanPosition(progress);
    this.progress.value = progress;
    return progress;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.background = this.background;
    for (const { object, material } of this.originals)
      object.material = material;
    this.wires.forEach((wire) => wire.removeFromParent());
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
  }
}
