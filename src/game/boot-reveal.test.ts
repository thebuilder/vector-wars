import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { BootReveal } from "./boot-reveal";

function fixture() {
  const scene = new THREE.Scene();
  const ship = new THREE.Group();
  const original = new THREE.MeshStandardMaterial();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 6), original);
  ship.add(hull);
  scene.add(ship);
  return { scene, ship, hull, original };
}

describe("boot scan lifecycle", () => {
  it("restores shared and array materials and removes temporary geometry on skip", () => {
    const { scene, hull, original } = fixture();
    const other = new THREE.Mesh(hull.geometry, [original, original]);
    scene.add(other);
    const originals = other.material;
    const sourceDisposed = vi.spyOn(original, "dispose");
    const geometryDisposed = vi.spyOn(hull.geometry, "dispose");
    const scan = new BootReveal(scene);
    expect(hull.material).not.toBe(original);
    const temporaryDisposed = vi.spyOn(hull.material, "dispose");
    const wire = hull.children[0] as THREE.LineSegments;
    const wireDisposed = vi.spyOn(wire.geometry, "dispose");
    scan.update(1 / 30);
    scan.dispose();
    scan.dispose();
    expect(hull.material).toBe(original);
    expect(other.material).toBe(originals);
    expect(hull.children).toHaveLength(0);
    expect(sourceDisposed).not.toHaveBeenCalled();
    expect(geometryDisposed).not.toHaveBeenCalled();
    expect(temporaryDisposed).toHaveBeenCalledTimes(1);
    expect(wireDisposed).toHaveBeenCalledTimes(1);
    hull.geometry.dispose();
    original.dispose();
  });

  it("does not jump to completion after an inactive-tab time gap", () => {
    const { scene, hull, original } = fixture();
    const scan = new BootReveal(scene);
    expect(scan.update(60)).toBeLessThan(0.01);
    expect(scan.update(-10)).toBeLessThan(0.01);
    let progress = 0;
    for (let i = 0; i < 130; i++) progress = scan.update(1 / 30);
    expect(progress).toBe(1);
    scan.dispose();
    hull.geometry.dispose();
    original.dispose();
  });

  it.each(["standard", "basic", "points", "sprite"] as const)(
    "preserves GLSL preprocessor lines in %s shaders",
    (kind) => {
      const { scene, hull, original } = fixture();
      const scan = new BootReveal(scene);
      const source = THREE.ShaderLib[kind];
      const shader = {
        vertexShader: source.vertexShader,
        fragmentShader: source.fragmentShader,
        uniforms: {},
      };
      hull.material.onBeforeCompile(
        shader as THREE.WebGLProgramParametersWithUniforms,
        {} as THREE.WebGLRenderer,
      );
      for (const text of [shader.vertexShader, shader.fragmentShader]) {
        expect(text).not.toMatch(/[^\s]#/);
      }
      scan.dispose();
      hull.geometry.dispose();
      original.dispose();
    },
  );
  it("keeps the scan speed independent of scene scale and updates its viewport on resize", () => {
    const near = fixture();
    const far = fixture();
    far.hull.scale.setScalar(10000);
    const a = new BootReveal(near.scene, new THREE.Vector2(1280, 720));
    const b = new BootReveal(far.scene, new THREE.Vector2(2560, 1440));
    const compile = (material: THREE.Material) => {
      const shader = {
        ...THREE.ShaderLib.standard,
        uniforms: {} as Record<string, THREE.IUniform>,
      };
      material.onBeforeCompile(
        shader as THREE.WebGLProgramParametersWithUniforms,
        {} as THREE.WebGLRenderer,
      );
      return shader.uniforms;
    };
    const u = compile(near.hull.material);
    const v = compile(far.hull.material);
    const start = u.uBootFront.value;
    for (let i = 0; i < 30; i++) {
      a.update(1 / 30);
      b.update(1 / 30);
    }
    const oneSecond = u.uBootFront.value;
    expect(oneSecond).toBe(v.uBootFront.value);
    for (let i = 0; i < 30; i++) a.update(1 / 30);
    expect(u.uBootFront.value - oneSecond).toBeCloseTo(oneSecond - start);
    a.resize(new THREE.Vector2(1920, 1080));
    expect(u.uBootViewport.value.toArray()).toEqual([1920, 1080]);
    a.dispose();
    b.dispose();
    for (const { hull, original } of [near, far]) {
      hull.geometry.dispose();
      original.dispose();
    }
  });
});
