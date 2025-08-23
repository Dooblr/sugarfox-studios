// ---- Background3d.tsx ----
import React, { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

interface Background3dProps {
  theme: string;
  zoomLevel: number; // 0..1 scroll
}

const Background3d: React.FC<Background3dProps> = ({ theme, zoomLevel }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const animationRef = useRef<number | null>(null);
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const sphere = useRef<THREE.Mesh | null>(null);
  const particleSystem = useRef<THREE.Points | null>(null);
  const uniforms = useRef<any>(null);
  const clock = useRef<THREE.Clock | null>(null);
  const velocities = useRef<number[]>([]);

  const currentZoom = useRef(zoomLevel);
  useEffect(() => { currentZoom.current = zoomLevel; }, [zoomLevel]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!mountRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;

    const sceneInstance = new THREE.Scene();
    scene.current = sceneInstance;

    const cam = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.current = cam;
    const baseRadius = 6;
    cam.position.set(0, 0, baseRadius);
    cam.lookAt(0, 0, 0);

    const rendererInstance = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.current = rendererInstance;
    rendererInstance.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(rendererInstance.domElement);

    // ---- Noise GLSL ----
    const noiseGLSL = `
      vec3 mod289(vec3 x){return x-floor(x/289.0)*289.0;}
      vec4 mod289(vec4 x){return x-floor(x/289.0)*289.0;}
      vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
      float snoise(vec3 v){ 
        const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
        vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
        vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g;
        vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
        vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
        i=mod289(i); vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
        float n_=1.0/7.0; vec3 ns=n_*D.wyz-D.xzx; vec4 j=p-49.0*floor(p*ns.z*ns.z);
        vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_); vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy;
        vec4 h=1.0-abs(x)-abs(y); vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
        vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
        vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
        vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
        vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
        p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w; vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
        return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
      }
    `;

    uniforms.current = {
      time: { value: 0 },
      mouseX: { value: 0 },
      mouseY: { value: 0 },
      uScroll: { value: zoomLevel },
    };

    const geometry = new THREE.SphereGeometry(1.5, 512, 512);
    const material = new THREE.ShaderMaterial({
      uniforms: uniforms.current,
      vertexShader: `
        uniform float time; uniform float uScroll; varying vec3 vPos; ${noiseGLSL}
        void main() {
          vPos = position;
          float amp = mix(0.02,0.18,uScroll);
          float freq = mix(2.0,4.5,uScroll);
          float baseWave = sin(time*1.0+position.x*freq)*amp + cos(time*0.6+position.y*(freq+1.5))*amp*0.75 + sin(time*1.4+position.z*(freq+0.5))*amp*0.5;
          float melt = snoise(position*(1.2+0.6*uScroll)+time*0.12)*0.06*mix(1.5,3.0,uScroll);
          gl_Position = projectionMatrix*modelViewMatrix*vec4(position + normal*(melt+baseWave),1.0);
        }
      `,
      fragmentShader: `
        uniform float time; uniform float uScroll; varying vec3 vPos; ${noiseGLSL}
        void main() {
          float n = snoise(vPos*(2.0+uScroll*2.0)+time*(0.04+0.08*uScroll));
          float mask = step(0.0,n);
          gl_FragColor = vec4(vec3(mask),1.0);
        }
      `,
      side: THREE.DoubleSide,
    });
    sphere.current = new THREE.Mesh(geometry, material);
    sceneInstance.add(sphere.current);

    // ---- Particles ----
    const particleCount = 200;
    const positions: number[] = [];
    const vel: number[] = [];
    for (let i = 0; i < particleCount; i++) {
      positions.push((Math.random() - 0.5) * 20);
      positions.push((Math.random() - 0.5) * 20);
      positions.push((Math.random() - 0.5) * 20);
      vel.push((Math.random() - 0.5) * 0.002);
      vel.push((Math.random() - 0.5) * 0.002);
      vel.push((Math.random() - 0.5) * 0.002);
    }
    velocities.current = vel;
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({ color: theme === "dark" ? 0xffffff : 0x000000, size: 0.05 });
    particleSystem.current = new THREE.Points(particleGeometry, particleMaterial);
    sceneInstance.add(particleSystem.current);

    // Update particle color on theme change
    const updateParticleColor = () => {
      if (particleSystem.current) {
        (particleSystem.current.material as THREE.PointsMaterial).color.set(theme === "dark" ? 0xffffff : 0x000000);
      }
    };
    updateParticleColor();

    sceneInstance.add(new THREE.AmbientLight(0x404040));
    const pointLight = new THREE.PointLight(0xffffff, 1.2, 50);
    pointLight.position.set(5, 5, 5);
    sceneInstance.add(pointLight);

    clock.current = new THREE.Clock();

    let targetTheta = 0, targetPhi = Math.PI/2;
    let currentTheta = 0, currentPhi = Math.PI/2;

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      const t = clock.current!.getElapsedTime();
      const s = currentZoom.current;

      uniforms.current.time.value = t;
      uniforms.current.uScroll.value += (s - uniforms.current.uScroll.value) * 0.05;
      uniforms.current.mouseX.value += (mouse.current.x - uniforms.current.mouseX.value) * 0.05;
      uniforms.current.mouseY.value += (mouse.current.y - uniforms.current.mouseY.value) * 0.05;

      targetTheta = mouse.current.x * Math.PI * 0.5;
      targetPhi = (mouse.current.y * 0.5 + 1) * Math.PI * 0.5;
      currentTheta += (targetTheta - currentTheta) * 0.05;
      currentPhi += (targetPhi - currentPhi) * 0.05;
      currentPhi = Math.max(0.1, Math.min(Math.PI-0.1, currentPhi));

      const radius = 6 + s * 20;
      camera.current!.position.x = radius * Math.sin(currentPhi) * Math.cos(currentTheta);
      camera.current!.position.y = radius * Math.cos(currentPhi);
      camera.current!.position.z = radius * Math.sin(currentPhi) * Math.sin(currentTheta);
      camera.current!.lookAt(0,0,0);

      sphere.current!.rotation.y += 0.0003 + s*0.001;
      sphere.current!.rotation.x += 0.0001 + s*0.0005;
      const scale = 1.0 + s*0.35;
      sphere.current!.scale.set(scale, scale, scale);

      const particlePositions = particleSystem.current!.geometry.attributes.position.array as Float32Array;
      for(let i=0;i<particlePositions.length;i+=3){
        particlePositions[i]     += velocities.current[i]* (1+s*3);
        particlePositions[i+1]   += velocities.current[i+1]* (1+s*3);
        particlePositions[i+2]   += velocities.current[i+2]* (1+s*3);

        if(Math.abs(particlePositions[i])>10) velocities.current[i]*=-1;
        if(Math.abs(particlePositions[i+1])>10) velocities.current[i+1]*=-1;
        if(Math.abs(particlePositions[i+2])>10) velocities.current[i+2]*=-1;
      }
      particleSystem.current!.geometry.attributes.position.needsUpdate = true;
      (particleSystem.current!.material as THREE.PointsMaterial).size = 0.05*(1+s*0.6);

      renderer.current!.render(sceneInstance, cam);
    };
    animate();

    window.addEventListener("mousemove", handleMouseMove);
    const handleResize = () => {
      if(!mountRef.current) return;
      cam.aspect = mountRef.current.clientWidth/mountRef.current.clientHeight;
      cam.updateProjectionMatrix();
      rendererInstance.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      if(animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      geometry.dispose();
      material.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      rendererInstance.dispose();
      if(mountRef.current && rendererInstance.domElement.parentNode)
        mountRef.current.removeChild(rendererInstance.domElement);
    };
  }, [theme, handleMouseMove]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
};

export default Background3d;
