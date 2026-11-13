"use client";

// Preview tool for voxel models. Renders one model at rest on a plain ground so art threads can
// take screenshots without building their own scene. Query: ?id=<model id>&state=always|working|
// idle|depleted&dither=0|1&bg=<hex>. Exposes window.__modelPreview.snapshot() for the script.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { bakeModel } from "./loader";
import { findModel, MODEL_REGISTRY } from "./registry";
import type { ModelState } from "./format";

declare global {
    interface Window {
        __modelPreview?: { ready: boolean; snapshot: () => string };
    }
}

export default function ModelPreview() {
    const ref = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const q = new URLSearchParams(window.location.search);
        const id = q.get("id") ?? "";
        const model = findModel(id);
        if (!model) {
            setError(
                id
                    ? `No model with id "${id}".`
                    : `Registry holds ${MODEL_REGISTRY.length} models. Pass ?id=`
            );
            return;
        }
        const state = (q.get("state") ?? "always") as ModelState;
        const dither = q.get("dither") !== "0";
        const bg = new THREE.Color(`#${q.get("bg") ?? "140d08"}`);

        const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            preserveDrawingBuffer: true,
        });
        renderer.setPixelRatio(1);
        const resize = () => {
            const w = Math.max(1, canvas.clientWidth);
            const h = Math.max(1, canvas.clientHeight);
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        };

        const scene = new THREE.Scene();
        scene.background = bg;
        const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
        const [sx, sy, sz] = model.size ?? [
            model.footprint ? model.footprint.w * 10 : 20,
            20,
            model.footprint ? model.footprint.d * 10 : 20,
        ];
        const span = Math.max(sx, sy, sz) * model.voxel;
        const centre = new THREE.Vector3(
            (sx * model.voxel) / 2,
            (sy * model.voxel) / 3,
            (sz * model.voxel) / 2
        );
        camera.position.set(
            centre.x + span * 1.3,
            centre.y + span * 0.9,
            centre.z + span * 1.5
        );
        const controls = new OrbitControls(camera, canvas);
        controls.target.copy(centre);
        controls.enableDamping = true;
        controls.update();

        scene.add(new THREE.HemisphereLight(0xffe2b0, 0x4a2f18, 2.2));
        const sun = new THREE.DirectionalLight(0xffd9a0, 4.2);
        sun.position.set(15, 9, -10);
        scene.add(sun);
        const fill = new THREE.DirectionalLight(0xff9d66, 1.7);
        fill.position.set(-14, 5, 17);
        scene.add(fill);

        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(400, 400),
            new THREE.MeshStandardMaterial({ color: 0x6b5238, roughness: 1 })
        );
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.85,
            metalness: 0.05,
        });
        const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffd070 });
        for (const { geometry, glow } of bakeModel(model, state)) {
            // Glow voxels draw unlit, like the island's furnace windows.
            scene.add(new THREE.Mesh(geometry, glow ? glowMaterial : material));
        }
        for (const light of model.lights ?? []) {
            if (light.when !== "always" && state !== "working") continue;
            const pl = new THREE.PointLight(
                light.color,
                light.intensity,
                light.distance
            );
            pl.position.set(
                light.pos[0] * model.voxel,
                light.pos[1] * model.voxel,
                light.pos[2] * model.voxel
            );
            scene.add(pl);
        }

        if (!dither) renderer.setClearColor(bg);
        resize();
        const draw = () => {
            controls.update();
            renderer.render(scene, camera);
        };
        let raf = 0;
        const loop = () => {
            draw();
            raf = requestAnimationFrame(loop);
        };
        loop();
        window.__modelPreview = {
            ready: true,
            snapshot: () => {
                draw();
                return canvas.toDataURL("image/png");
            },
        };
        window.addEventListener("resize", resize);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
            controls.dispose();
            renderer.dispose();
            delete window.__modelPreview;
        };
    }, []);

    if (error) {
        return (
            <p
                style={{
                    padding: 24,
                    fontFamily: "monospace",
                    color: "#f0dfb8",
                }}
            >
                {error}
            </p>
        );
    }
    return (
        <canvas
            ref={ref}
            style={{
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100dvh",
                display: "block",
                background: "#140d08",
            }}
        />
    );
}
