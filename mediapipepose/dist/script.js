import DeviceDetector from "https://cdn.skypack.dev/device-detector-js@2.2.10";

// Usage: testSupport({client?: string, os?: string}[])
// Client and os are regular expressions.
// See: https://cdn.jsdelivr.net/npm/device-detector-js@2.2.10/README.md for
// legal values for client and os
testSupport([
    { client: 'Chrome' },
]);

function testSupport(supportedDevices) {
    const deviceDetector = new DeviceDetector();
    const detectedDevice = deviceDetector.parse(navigator.userAgent);
    let isSupported = false;
    for (const device of supportedDevices) {
        if (device.client !== undefined) {
            const re = new RegExp(`^${device.client}$`);
            if (!re.test(detectedDevice.client.name)) {
                continue;
            }
        }
        if (device.os !== undefined) {
            const re = new RegExp(`^${device.os}$`);
            if (!re.test(detectedDevice.os.name)) {
                continue;
            }
        }
        isSupported = true;
        break;
    }
    if (!isSupported) {
        alert(`This demo, running on ${detectedDevice.client.name}/${detectedDevice.os.name}, ` +
            `is not well supported at this time, expect some flakiness while we improve our code.`);
    }
}
const controls = window;
const LandmarkGrid = window.LandmarkGrid;
const drawingUtils = window;
const mpPose = window;
const options = {
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${mpPose.VERSION}/${file}`;
    }
};
// Our input frames will come from here.
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const controlsElement = document.getElementsByClassName('control-panel')[0];
const canvasCtx = canvasElement.getContext('2d');
// We'll add this to our control panel later, but we'll save it here so we can
// call tick() each time the graph runs.
const fpsControl = new controls.FPS();
// Optimization: Turn off animated spinner after its hiding animation is done.
const spinner = document.querySelector('.loading');
spinner.ontransitionend = () => {
    spinner.style.display = 'none';
};
const landmarkContainer = document.getElementsByClassName('landmark-grid-container')[0];
const grid = new LandmarkGrid(landmarkContainer, {
    connectionColor: 0xCCCCCC,
    definedColors: [{ name: 'LEFT', value: 0xffa500 }, { name: 'RIGHT', value: 0x00ffff }],
    range: 2,
    fitToGrid: true,
    labelSuffix: 'm',
    landmarkSize: 2,
    numCellsPerAxis: 4,
    showHidden: false,
    centered: true,
});
let activeEffect = 'mask';

function onResults(results) {
    // Hide the spinner.
    document.body.classList.add('loaded');
    // Update the frame rate.
    fpsControl.tick();
    // Draw the overlays.
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    if (results.segmentationMask) {
        canvasCtx.drawImage(results.segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
        // Only overwrite existing pixels.
        if (activeEffect === 'mask' || activeEffect === 'both') {
            canvasCtx.globalCompositeOperation = 'source-in';
            // This can be a color or a texture or whatever...
            canvasCtx.fillStyle = '#00FF007F';
            canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        }
        else {
            canvasCtx.globalCompositeOperation = 'source-out';
            canvasCtx.fillStyle = '#0000FF7F';
            canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        }
        // Only overwrite missing pixels.
        canvasCtx.globalCompositeOperation = 'destination-atop';
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.globalCompositeOperation = 'source-over';
    }
    else {
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    }

    if (results.poseLandmarks) {
        updateModel(results.poseLandmarks);
        drawingUtils.drawConnectors(canvasCtx, results.poseLandmarks, mpPose.POSE_CONNECTIONS, { visibilityMin: 0.65, color: 'white' });
        drawingUtils.drawLandmarks(canvasCtx, Object.values(mpPose.POSE_LANDMARKS_LEFT)
            .map(index => results.poseLandmarks[index]), { visibilityMin: 0.65, color: 'white', fillColor: 'rgb(255,138,0)' });
        drawingUtils.drawLandmarks(canvasCtx, Object.values(mpPose.POSE_LANDMARKS_RIGHT)
            .map(index => results.poseLandmarks[index]), { visibilityMin: 0.65, color: 'white', fillColor: 'rgb(0,217,231)' });
        drawingUtils.drawLandmarks(canvasCtx, Object.values(mpPose.POSE_LANDMARKS_NEUTRAL)
            .map(index => results.poseLandmarks[index]), { visibilityMin: 0.65, color: 'white', fillColor: 'white' });
    }
    canvasCtx.restore();
    if (results.poseWorldLandmarks) {
        grid.updateLandmarks(results.poseWorldLandmarks, mpPose.POSE_CONNECTIONS, [
            { list: Object.values(mpPose.POSE_LANDMARKS_LEFT), color: 'LEFT' },
            { list: Object.values(mpPose.POSE_LANDMARKS_RIGHT), color: 'RIGHT' },
        ]);
    }
    else {
        grid.updateLandmarks([]);
    }
}
const pose = new mpPose.Pose(options);
pose.onResults(onResults);

// Present a control panel through which the user can manipulate the solution
// options.
new controls.ControlPanel(controlsElement, {
    selfieMode: true,
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    effect: 'background',
}).add([
    new controls.StaticText({ title: 'MediaPipe Pose' }),
    fpsControl,
    new controls.Toggle({ title: 'Selfie Mode', field: 'selfieMode' }),
    new controls.SourcePicker({
        onSourceChanged: () => {
            // Resets because this model gives better results when reset between
            // source changes.
            pose.reset();
        },
        onFrame: async (input, size) => {
            const aspect = size.height / size.width;
            let width, height;
            if (window.innerWidth > window.innerHeight) {
                height = window.innerHeight;
                width = height / aspect;
            }
            else {
                width = window.innerWidth;
                height = width * aspect;
            }
            canvasElement.width = width / 3;
            canvasElement.height = height / 3;
            await pose.send({ image: input });
        },
    }),
]).on(x => {
    const options = x;
    videoElement.classList.toggle('selfie', options.selfieMode);
    activeEffect = x['effect'];
    pose.setOptions(options);
});

// =====================================================
// 여기까지가 웹캠에서 포즈 인식하는 부분
// 모델링하는 부분 이제 시작
// =====================================================

import {
    Bone,
    Color,
    CylinderGeometry,
    DoubleSide,
    Float32BufferAttribute,
    MeshPhongMaterial,
    PerspectiveCamera,
    PointLight,
    Scene,
    SkinnedMesh,
    Skeleton,
    SkeletonHelper,
    Vector3,
    Uint16BufferAttribute,
    WebGLRenderer
} from "../../build/three.module.js";

import { GUI } from '../../examples/jsm/libs/dat.gui.module.js';
import { OrbitControls } from '../../examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from '/examples/jsm/loaders/FBXLoader.js'

let gui, scene, camera, renderer, orbit, lights, mesh, bones, skeletonHelper, fbxModel;

const state = {
    animateBones: false
};

function initScene() {

    gui = new GUI();

    scene = new Scene();
    scene.background = new Color(0x444444);

    camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.z = 30;
    camera.position.y = 30;

    renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableZoom = false;

    lights = [];
    lights[0] = new PointLight(0xffffff, 1, 0);
    lights[1] = new PointLight(0xffffff, 1, 0);
    lights[2] = new PointLight(0xffffff, 1, 0);

    lights[0].position.set(0, 200, 0);
    lights[1].position.set(100, 200, 100);
    lights[2].position.set(- 100, - 200, - 100);

    scene.add(lights[0]);
    scene.add(lights[1]);
    scene.add(lights[2]);

    window.addEventListener('resize', function () {

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(window.innerWidth, window.innerHeight);

    }, false);
}

function setupDatGui(object) {

    let folder;
    // let folder = gui.addFolder("General Options");

    // folder.add(state, "animateBones");
    // folder.__controllers[0].name("Animate Bones");

    // folder.add(mesh, "pose");
    // folder.__controllers[1].name(".pose()");
    var a = object.children[1]
    bones = getBoneList(object);

    for (let i = 0; i < bones.length; i++) {

        const bone = bones[i];

        folder = gui.addFolder(i + ':' + bone.name);

        folder.add(bone.position, 'x', - 10 + bone.position.x, 10 + bone.position.x);
        folder.add(bone.position, 'y', - 10 + bone.position.y, 10 + bone.position.y);
        folder.add(bone.position, 'z', - 10 + bone.position.z, 10 + bone.position.z);

        folder.add(bone.rotation, 'x', - Math.PI * 0.5, Math.PI * 0.5);
        folder.add(bone.rotation, 'y', - Math.PI * 0.5, Math.PI * 0.5);
        folder.add(bone.rotation, 'z', - Math.PI * 0.5, Math.PI * 0.5);

        folder.add(bone.scale, 'x', 0, 2);
        folder.add(bone.scale, 'y', 0, 2);
        folder.add(bone.scale, 'z', 0, 2);

        folder.__controllers[0].name("position.x");
        folder.__controllers[1].name("position.y");
        folder.__controllers[2].name("position.z");

        folder.__controllers[3].name("rotation.x");
        folder.__controllers[4].name("rotation.y");
        folder.__controllers[5].name("rotation.z");

        folder.__controllers[6].name("scale.x");
        folder.__controllers[7].name("scale.y");
        folder.__controllers[8].name("scale.z");

    }

}


function render() {

    requestAnimationFrame(render);

    const time = Date.now() * 0.001;

    //Wiggle the bones
    if (state.animateBones) {

        for (let i = 0; i < mesh.skeleton.bones.length; i++) {

            mesh.skeleton.bones[i].rotation.z = Math.sin(time) * 2 / mesh.skeleton.bones.length;

        }

    }

    renderer.render(scene, camera);

}

function myBones() {
    const loader = new FBXLoader();
    loader.load('/models/SambaDancing.fbx', function (object) {

        // mixer = new THREE.AnimationMixer( object );

        // const action = mixer.clipAction( object.animations[ 0 ] );
        // action.play();

        object.traverse(function (child) {

            if (child.isMesh) {

                child.castShadow = true;
                child.receiveShadow = true;

            }

        });
        object.scale.set(.1, .1, .1)
        scene.add(object);


        const helper = new SkeletonHelper(object);
        scene.add(helper);

        setupDatGui(object);
    });
}

function getBoneList(object) {
    const boneList = [];
    if (object && object.isBone) {
        boneList.push(object);
    }

    for (let i = 0; i < object.children.length; i++) {
        boneList.push.apply(boneList, getBoneList(object.children[i]));
    }

    return boneList;

}

function updateModel(poseList) {
    var rz, ry;
    // hips

    // left sholder
    rz = sign(poseList[11].y - poseList[13].y) *
        getAngle(poseList[11].x - poseList[12].x, poseList[11].y - poseList[12].y,
            poseList[13].x - poseList[11].x, poseList[13].y - poseList[11].y);
    ry = -1 * sign(poseList[11].z - poseList[13].z) *
        getAngle(poseList[11].x - poseList[12].x, poseList[11].z - poseList[12].z,
            poseList[13].x - poseList[11].x, poseList[13].z - poseList[11].z);

    bones[17].rotation.z = cliper(rz, -1.2, 1.3);
    bones[17].rotation.y = cliper(ry, -1.3, 1.3);

    // left arm
    rz = sign(poseList[13].y - poseList[15].y) *
        getAngle(poseList[13].x - poseList[11].x, poseList[13].y - poseList[11].y,
            poseList[15].x - poseList[13].x, poseList[15].y - poseList[13].y);
    ry = -1 * sign(poseList[13].z - poseList[15].z) *
        getAngle(poseList[13].x - poseList[11].x, poseList[13].z - poseList[11].z,
            poseList[15].x - poseList[13].x, poseList[15].z - poseList[13].z);

    bones[19].rotation.z = cliper(rz, -2, 2);
    bones[19].rotation.y = cliper(ry, -2, 2);

    // right sholder
    rz = -1 * sign(poseList[12].y - poseList[14].y) *
        getAngle(poseList[12].x - poseList[11].x, poseList[12].y - poseList[12].y,
            poseList[14].x - poseList[12].x, poseList[14].y - poseList[12].y);
    ry = sign(poseList[12].z - poseList[14].z) *
        getAngle(poseList[12].x - poseList[11].x, poseList[12].z - poseList[12].z,
            poseList[14].x - poseList[12].x, poseList[14].z - poseList[12].z);

    bones[60].rotation.z = cliper(rz, -1.2, 1.3);
    bones[60].rotation.y = cliper(ry, -1.3, 1.3);

    // right arm
    rz =  -1 * sign(poseList[14].y - poseList[16].y) *
        getAngle(poseList[14].x - poseList[12].x, poseList[14].y - poseList[12].y,
            poseList[16].x - poseList[14].x, poseList[16].y - poseList[14].y);
    ry = sign(poseList[14].z - poseList[16].z) *
        getAngle(poseList[14].x - poseList[12].x, poseList[14].z - poseList[12].z,
            poseList[16].x - poseList[14].x, poseList[16].z - poseList[14].z);

    bones[62].rotation.z = cliper(rz, -2, 2);
    bones[62].rotation.y = cliper(ry, -2, 2);       







}

function getAngle(x1, y1, x2, y2) {
    var innerProdcut = x1 * x2 + y1 * y2;
    var v1Norm = Math.pow(x1 * x1 + y1 * y1, 0.5);
    var v2Norm = Math.pow(x2 * x2 + y2 * y2, 0.5);
    return Math.acos(innerProdcut / (v1Norm * v2Norm));
}

function sign(num) {
    if (num >= 0) {
        return 1;
    }
    return -1;
}

function cliper(num, min, max) {
    if (num > max) return max;
    if (num < min) return min
    return num;
}
initScene();
myBones();
render();





