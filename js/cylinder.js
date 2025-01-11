import * as THREE from 'three';
import {GUI} from 'three/addons/libs/lil-gui.module.min.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const particlesData = [];
const maxParticleCount = 1000;
const cylinderRadius = 500;
const cylinderHeight = 700;
const halfHeight = cylinderHeight / 2

let particleCount = 500;
let group;
let container;
let camera, scene, renderer;
let positions, colors;
let particles, particlePositions;
let points, linesMesh;
let helperGrid;
let orbitControls;

const effectController = {
    enableRotation: true,
    rotationSpeed: 0.05,
    enableMouseRotation: true,
    showPoints: true,
    showLines: true,
    showHelperGrid: true,
    minDistance: 150,
    limitConnections: true,
    maxConnections: 20,
    particleCount: 700,
    particleVelocity: 1.0,
    colorEnabled: [true, true, true],
    availableColors: ['#b02727', '#454545', '#15154c'],
};

init();

function init() {
    initGUI();
    setupScene();
    initParticles();
    initLines();
    initWebGLRenderer();

    container.appendChild(renderer.domElement);
    window.addEventListener('resize', onWindowResize);
    updateParticleColors();
}

function initGUI() {
    const gui = new GUI({title: 'Base Settings'});
    gui.add(effectController, 'showPoints').name('Show Points').onChange((value) => {
        points.visible = value;
    });
    gui.add(effectController, 'showLines').name('Show Lines').onChange((value) => {
        linesMesh.visible = value;
    });
    gui.add(effectController, 'minDistance', 10, 300).name('Minimal Distance');
    gui.add(effectController, 'limitConnections').name('Limit Connections');
    gui.add(effectController, 'maxConnections', 0, 30, 1).name('Max Connections');
    gui.add(effectController, 'particleCount', 0, maxParticleCount, 1).name('Particle Count').onChange((value) => {
        particleCount = value;
        particles.setDrawRange(0, particleCount);
    });
    gui.add(effectController, 'particleVelocity', 0, 5).name('Particle Speed').onChange(() => {
        updateParticleVelocity();
    });
    gui.add(effectController, 'showHelperGrid').name('Helper Grid').onChange((value) => {
        helperGrid.visible = value;
    });
    const motionFolder = gui.addFolder('Motion Settings');
    motionFolder.add(effectController, 'enableRotation').name('Rotation');
    motionFolder.add(effectController, 'rotationSpeed', 0, 1, 0.01).name('Rotation Speed');
    motionFolder.add(effectController, 'enableMouseRotation').name('Mouse Rotation').onChange((value) => {
        orbitControls.enabled = value;
    });
    motionFolder.open();
    const colorFolder = gui.addFolder('Color Settings');
    effectController.availableColors.forEach((color, index) => {
        colorFolder.add(effectController.colorEnabled, index).name(`Enable Color ${index + 1}`).onChange(() => {
            updateParticleColors();
        });
    });
    effectController.availableColors.forEach((color, index) => {
        colorFolder.addColor(effectController.availableColors, index).name(`Color ${index + 1}`).onChange(() => {
            updateParticleColors();
        });
    });
    colorFolder.open();
}

function updateParticleVelocity() {
    for (let i = 0; i < particleCount; i++) {
        const velocity = particlesData[i].velocity;
        velocity.set(getRandomVelocity(), getRandomVelocity(), getRandomVelocity());
    }
}

function updateParticleColors() {
    if (!particles.attributes.color) {
        particles.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxParticleCount * 3), 3));
    }

    const colorsArray = particles.attributes.color.array;
    for (let i = 0; i < maxParticleCount; i++) {
        let availableColors = effectController.availableColors.filter((_, index) => effectController.colorEnabled[index]);
        let color;
        if (availableColors.length > 0) {
            const colorIndex = Math.floor(Math.random() * availableColors.length);
            color = new THREE.Color(availableColors[colorIndex]);
        } else {
            color = new THREE.Color(1, 1, 1);
        }

        colorsArray[i * 3] = color.r;
        colorsArray[i * 3 + 1] = color.g;
        colorsArray[i * 3 + 2] = color.b;
        particlesData[i].color = color;
    }

    particles.attributes.color.needsUpdate = true;
}

function animate() {
    let vertexPos = 0;
    let colorPos = 0;
    let numConnected = 0;

    for (let i = 0; i < particleCount; i++) particlesData[i].numConnections = 0;
    for (let i = 0; i < particleCount; i++) {
        const particleData = particlesData[i];
        const baseIndex1 = i * 3;

        particlePositions[baseIndex1] += particleData.velocity.x;
        particlePositions[baseIndex1 + 1] += particleData.velocity.y;
        particlePositions[baseIndex1 + 2] += particleData.velocity.z;

        setVelocity(particleData, particlePositions, baseIndex1);

        if (effectController.limitConnections && particleData.numConnections >= effectController.maxConnections) continue;
        for (let j = i + 1; j < particleCount; j++) {
            const particleData2 = particlesData[j];
            const baseIndex2 = j * 3;

            if (effectController.limitConnections && particleData2.numConnections >= effectController.maxConnections) continue;
            const distance = calculateDistanceBetweenParticles(particlePositions, baseIndex1, baseIndex2);
            if (distance < effectController.minDistance) {
                particleData.numConnections++;
                particleData2.numConnections++;
                addLine(vertexPos, baseIndex1, baseIndex2);
                vertexPos += 6;
                addLineColor(colorPos, particleData.color, particleData2.color);
                colorPos += 6;
                numConnected++;
            }
        }
    }

    updateGeometry(numConnected);
    points.geometry.attributes.position.needsUpdate = true;
    if (effectController.enableRotation) {
        group.rotation.y += effectController.rotationSpeed / 10;
    }

    renderer.render(scene, camera);
}

function setupScene() {
    container = document.getElementById('container');
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 4000);
    camera.position.z = 1750;
    initOrbitControls();
    scene = new THREE.Scene();
    group = new THREE.Group();
    scene.add(group);
    group.add(getHelperGrid());
}

function initParticles() {
    positions = new Float32Array(maxParticleCount * maxParticleCount * 3);
    colors = new Float32Array(maxParticleCount * maxParticleCount * 3);
    particlePositions = new Float32Array(maxParticleCount * 3);
    for (let i = 0; i < maxParticleCount; i++) {
        const {position, velocity} = createParticleData();
        particlePositions[i * 3] = position.x;
        particlePositions[i * 3 + 1] = position.y;
        particlePositions[i * 3 + 2] = position.z;
        particlesData.push({velocity});
    }

    particles = new THREE.BufferGeometry();
    particles.setDrawRange(0, particleCount);
    particles.setAttribute(
        'position',
        new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.DynamicDrawUsage)
    );

    const pointsMaterial = createPointsMaterial();
    points = new THREE.Points(particles, pointsMaterial);
    group.add(points);
}

function createParticleData() {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * cylinderRadius;
    const position = new THREE.Vector3(
        radius * Math.cos(angle),
        Math.random() * cylinderHeight - halfHeight,
        radius * Math.sin(angle)
    );

    const velocity = new THREE.Vector3(
        getRandomVelocity(),
        getRandomVelocity(),
        getRandomVelocity()
    );

    return {position, velocity};
}

function initLines() {
    const geometry = getGeometry();
    const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
    });

    linesMesh = new THREE.LineSegments(geometry, material);
    group.add(linesMesh);
}

function setVelocity(particleData, positions, index) {
    const distanceFromCenter = Math.sqrt(particlePositions[index] * particlePositions[index] + particlePositions[index + 2] * particlePositions[index + 2]);
    if (particlePositions[index + 1] < -halfHeight || particlePositions[index + 1] > halfHeight) {
        particleData.velocity.y = -particleData.velocity.y;
    }

    if (distanceFromCenter > cylinderRadius) {
        const angle = Math.atan2(particlePositions[index + 2], particlePositions[index]);
        particlePositions[index] = Math.cos(angle) * cylinderRadius;
        particlePositions[index + 2] = Math.sin(angle) * cylinderRadius;
        particleData.velocity.x = -particleData.velocity.x;
        particleData.velocity.z = -particleData.velocity.z;
    }
}

function calculateDistanceBetweenParticles(positions, index1, index2) {
    const dx = positions[index1] - positions[index2];
    const dy = positions[index1 + 1] - positions[index2 + 1];
    const dz = positions[index1 + 2] - positions[index2 + 2];

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function addLine(vertexPos, index1, index2) {
    positions[vertexPos] = particlePositions[index1];
    positions[vertexPos + 1] = particlePositions[index1 + 1];
    positions[vertexPos + 2] = particlePositions[index1 + 2];
    positions[vertexPos + 3] = particlePositions[index2];
    positions[vertexPos + 4] = particlePositions[index2 + 1];
    positions[vertexPos + 5] = particlePositions[index2 + 2];
}

function addLineColor(colorPos, color1, color2) {
    colors[colorPos] = color1.r;
    colors[colorPos + 1] = color1.g;
    colors[colorPos + 2] = color1.b;
    colors[colorPos + 3] = color2.r;
    colors[colorPos + 4] = color2.g;
    colors[colorPos + 5] = color2.b;
}

function updateGeometry(numConnected) {
    linesMesh.geometry.setDrawRange(0, numConnected * 2);
    linesMesh.geometry.attributes.position.needsUpdate = true;
    linesMesh.geometry.attributes.color.needsUpdate = true;
}

function getHelperGrid() {
    helperGrid = new THREE.LineSegments(
        new THREE.WireframeGeometry(new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 32, 10)),
        new THREE.LineBasicMaterial({color: 0x474747, transparent: true, blending: THREE.AdditiveBlending})
    );
    helperGrid.visible = effectController.showHelperGrid;

    return helperGrid;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function initOrbitControls() {
    orbitControls = new OrbitControls(camera, container);
    orbitControls.minDistance = 1000;
    orbitControls.maxDistance = 3000;
    orbitControls.enabled = effectController.enableMouseRotation;
}

function getGeometry() {
    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.computeBoundingSphere();
    geometry.setDrawRange(0, 0);

    return geometry;
}

function createPointsMaterial() {
    return new THREE.PointsMaterial({
        size: 3,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        sizeAttenuation: false,
    });
}

function initWebGLRenderer() {
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
}

function getRandomVelocity() {
    return (-1 + Math.random() * 2) * effectController.particleVelocity;
}
