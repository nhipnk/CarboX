import { useEffect, useRef } from 'react';

const GlobeCanvas = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    let animationId: number;

    const init = async () => {
      const THREE = await import('three');
      const ThreeGlobe = (await import('three-globe')).default;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
      camera.position.z = 250;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(300, 300);
      renderer.setClearColor(0x000000, 0);
      mountRef.current?.appendChild(renderer.domElement);

      const globe: any = new ThreeGlobe()
        .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-day.jpg')
        .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
        .atmosphereColor('#22c55e')
        .atmosphereAltitude(0.2);

      // Điểm sáng thành phố
      const cities = [
        { lat: 10.8, lng: 106.6 },
        { lat: 21.0, lng: 105.8 },
        { lat: 35.7, lng: 139.7 },
        { lat: 51.5, lng: -0.1 },
        { lat: 40.7, lng: -74.0 },
        { lat: 48.8, lng: 2.3 },
        { lat: 1.3, lng: 103.8 },
        { lat: 37.5, lng: 127.0 },
        { lat: 31.2, lng: 121.5 },
        { lat: -23.5, lng: -46.6 },
        { lat: 28.6, lng: 77.2 },
        { lat: -33.8, lng: 151.2 },
        { lat: 55.7, lng: 37.6 },
        { lat: 23.1, lng: 113.3 },
      ];

      globe.pointsData(cities)
        .pointAltitude(0.06)
        .pointColor(() => '#22c55e')
        .pointRadius(0.5);

      // Arc kết nối
      const arcs = [
        { startLat: 10.8, startLng: 106.6, endLat: 51.5, endLng: -0.1 },
        { startLat: 10.8, startLng: 106.6, endLat: 40.7, endLng: -74.0 },
        { startLat: 35.7, startLng: 139.7, endLat: 48.8, endLng: 2.3 },
        { startLat: 1.3, startLng: 103.8, endLat: 51.5, endLng: -0.1 },
        { startLat: 21.0, startLng: 105.8, endLat: 37.5, endLng: 127.0 },
        { startLat: 28.6, startLng: 77.2, endLat: 48.8, endLng: 2.3 },
        { startLat: 40.7, startLng: -74.0, endLat: -23.5, endLng: -46.6 },
      ];

      globe.arcsData(arcs)
        .arcColor(() => ['rgba(34,197,94,0.9)', 'rgba(34,197,94,0)'])
        .arcAltitude(0.25)
        .arcStroke(0.6)
        .arcDashLength(0.4)
        .arcDashGap(0.2)
        .arcDashAnimateTime(1500);

      scene.add(globe);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0x22c55e, 1);
      dirLight.position.set(1, 1, 1);
      scene.add(dirLight);

      const animate = () => {
        globe.rotation.y += 0.003;
        renderer.render(scene, camera);
        animationId = requestAnimationFrame(animate);
      };
      animate();
    };

    init().catch(console.error);

    return () => {
      cancelAnimationFrame(animationId);
      if (mountRef.current) mountRef.current.innerHTML = '';
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ width: 300, height: 300 }}
    />
  );
};

export default GlobeCanvas;