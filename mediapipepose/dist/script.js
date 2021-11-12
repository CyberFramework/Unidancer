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

        console.log(results.poseLandmarks[11]);
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
        updateModel(results.poseWorldLandmarks);
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
        
            // if (window.innerWidth > window.innerHeight) {
            //     height = window.innerHeight;
            //     width = height / aspect;
            // }
            // else {
            //     width = window.innerWidth;
            //     height = width * aspect;
            // }
            width = window.innerWidth*0.3;
            height = width * aspect;

            canvasElement.width = width;
            canvasElement.height = height;
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

// import {
//     Bone,
//     Color,
//     CylinderGeometry,
//     DoubleSide,
//     Float32BufferAttribute,
//     MeshPhongMaterial,
//     PerspectiveCamera,
//     PointLight,
//     Scene,
//     SkinnedMesh,
//     Skeleton,
//     SkeletonHelper,
//     Vector3,
//     Uint16BufferAttribute,
//     WebGLRenderer
// } from "../../build/three.module.js";
import * as THREE from '../../build/three.module.js';
import { GUI } from '../../examples/jsm/libs/dat.gui.module.js';
import { OrbitControls } from '../../examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from '/examples/jsm/loaders/FBXLoader.js'

let gui, scene, camera, renderer, orbit, lights, mesh, bones, skeletonHelper, fbxModel;
var circle, particle, skelet;
var currentBG = 0;
var moon, world;

const state = {
    animateBones: false
};

function initScene() {
    gui = new GUI();

    scene = new THREE.Scene();
    
    scene.background = new THREE.Color(0x444444);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth*0.7/ window.innerHeight, 0.1, 200);
    camera.position.x = 9;
    camera.position.y = 4;
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight, true );
    document.body.appendChild(renderer.domElement);
    renderer.setScissor(window.innerWidth*0.3, 0, window.innerWidth*0.7, window.innerHeight);
    renderer.setViewport(window.innerWidth*0.3, 0, window.innerWidth*0.7, window.innerHeight);

    orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableZoom = false;
    orbit.target.set(0,5,0);
    orbit.update();

    lights = [];

    // window.addEventListener('resize', function () {

    //     camera.aspect = window.innerWidth / window.innerHeight;
    //     camera.updateProjectionMatrix();

    //     renderer.setSize(window.innerWidth, window.innerHeight);

    // }, false);


    // 임시 background 교체
    currentBG = 2;
    switch (currentBG) {
        case 0:
            rendBG_sheep();
            break;
        case 1:
            rendBG_planet2();
            break;
        case 2:
            rendBG_moon();
            break;
        default:
    }

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

    // planet2의 애니메이션, 최적화를 위해 이 배경일때만 작동하도록 수정바람
    if (currentBG == 1) {
        particle.rotation.x += 0.0000;
        particle.rotation.y -= 0.0040;
        circle.rotation.x -= 0.0020;
        circle.rotation.y -= 0.0030;
        skelet.rotation.x -= 0.0010;
        skelet.rotation.y += 0.0020;
    }
    else if (currentBG == 2) {
        moon.rotation.y += 0.002;
        moon.rotation.x += 0.0001;
        world.rotation.y += 0.0001
        world.rotation.x += 0.0005

    }


    renderer.clear();
    renderer.render(scene, camera);

}

function loadModel() {
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
            bones = getBoneList(object);
        });
        object.scale.set(.03, .03, .03)
        object.rotation.y = 45;
        object.castShadow = true;
        scene.add(object);


        const helper = new THREE.SkeletonHelper(object);
        scene.add(helper);

        // setupDatGui(object);
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


    var vec1, vec2;

    // ==========================================================
    // Arms
    // ==========================================================
    // left sholder
    vec1 = getSubVector(poseList[11], poseList[12]);
    vec2 = getSubVector(poseList[13], poseList[11]);
    vec1.y *= -1;
    vec2.y *= -1;
    rotateJoint(vec1, [1, 0, 0], vec2, bones, 17);

    // left arm
    vec1 = getSubVector(poseList[13], poseList[11]);
    vec2 = getSubVector(poseList[15], poseList[13]);
    vec1.y *= -1;
    vec2.y *= -1;
    rotateJoint(vec1, [1, 0, 0], vec2, bones, 19);

    // // left hand
    // vec1 = getVector(poseList[15], poseList[13]);
    // vec2 = getVector(poseList[19], poseList[15]);
    // vec1.y *= -1;
    // vec2.y *= -1;
    // rotateJoint(vec1, [1, 0, 0], vec2, bones, 21);

    // right sholder
    vec1 = getSubVector(poseList[12], poseList[11]);
    vec2 = getSubVector(poseList[14], poseList[12]);
    vec1.y *= -1;
    vec2.y *= -1;
    rotateJoint(vec1, [-1, 0, 0], vec2, bones, 60);

    // // right arm
    vec1 = getSubVector(poseList[14], poseList[12]);
    vec2 = getSubVector(poseList[16], poseList[14]);
    vec1.y *= -1;
    vec2.y *= -1;
    rotateJoint(vec1, [-1, 0, 0], vec2, bones, 62);

    // // // right hand
    // vec1 = getVector(poseList[16], poseList[14]);
    // vec2 = getVector(poseList[20], poseList[16]);
    // vec1.y *= -1;
    // vec2.y *= -1;
    // rotateJoint(vec1, [-1, 0, 0], vec2, bones, 64);

    // ==========================================================
    // Hip to Neck
    // ==========================================================
    // Hips
    vec1 = new THREE.Vector3(1,0,0);
    vec2 = getSubVector(poseList[23], poseList[24]);
    vec1.y *= -1;
    vec2.y *= -1;
    rotateJoint(vec1, [1, 0, 0], vec2, bones, 2);

    // 허리-어깨
    vec1 = getSubVector(poseList[11], poseList[12]);
    vec2 = getSubVector(poseList[23], poseList[24]);
    vec1.y *= -1;
    vec2.y *= -1;
    rotateJoint(vec1, [1, 0, 0], vec2, bones, 4);

    // neck
    var midShoulder = new THREE.Vector3(0.5*(poseList[11].x + poseList[12].x), 0.5*(poseList[11].y + poseList[12].y), 0.5*(poseList[11].z + poseList[12].z));
    var midHip = new THREE.Vector3(0.5*(poseList[23].x + poseList[24].x), 0.5*(poseList[23].y + poseList[24].y), 0.5*(poseList[23].z + poseList[24].z));
    var midMouse = new THREE.Vector3(0.5*(poseList[9].x + poseList[10].x), 0.5*(poseList[9].y + poseList[10].y), 0.5*(poseList[9].z + poseList[10].z));
    var temp = getSubVector(midShoulder, midHip)
    vec1 = getSubVector(midMouse, temp);
    vec2 = getSubVector(poseList[0], midMouse);
    vec1.y *= -1;
    vec2.y *= -1;
    rotateJoint(vec1, [0, 1, 0], vec2, bones, 8);


    // ==========================================================
    // Left Leg
    // ==========================================================
    // 허벅지
    vec1 = getSubVector(midHip, midShoulder);
    // vec1 = getSubVector(poseList[23], poseList[11]);
    vec2 = getSubVector(poseList[25], poseList[23]);
    vec1.z *= -1;
    vec2.z *= -1;
    rotateJoint(vec1, [0, -1, 0], vec2, bones, 110);

    // 종아리
    vec1 = getSubVector(poseList[25], poseList[23]);
    vec2 = getSubVector(poseList[27], poseList[25]);
    vec1.y *= -1;
    vec2.y *= -1;
    vec1.z *= -1;
    vec2.z *= -1;
    rotateJoint(vec1, [0, -1, 0], vec2, bones, 112);



    // ==========================================================
    // Right Leg
    // ==========================================================
    // 허벅지
    vec1 = getSubVector(midHip, midShoulder);
    vec2 = getSubVector(poseList[26], poseList[24]);
    vec1.z *= -1;
    vec2.z *= -1;
    rotateJoint(vec1, [0, -1, 0], vec2, bones, 101);

    // // 종아리
    vec1 = getSubVector(poseList[26], poseList[24]);
    vec2 = getSubVector(poseList[28], poseList[26]);
    vec1.y *= -1;
    vec2.y *= -1;
    vec1.z *= -1;
    vec2.z *= -1;
    rotateJoint(vec1, [0, -1, 0], vec2, bones, 103);

}

function getSubVector(p1, p2) {
    return new THREE.Vector3(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z)
}

function getAngle(x1, y1, x2, y2) {
    var bunza = x1 * y2 - y1 * x2;
    if (bunza == 0) return 0;
    var v1Norm = Math.pow(x1 * x1 + y1 * y1, 0.5);
    var v2Norm = Math.pow(x2 * x2 + y2 * y2, 0.5);
    return Math.asin(bunza / (v1Norm * v2Norm));
}

function getAngleXYZ(v1, v2) {
    var rx = getAngle(v1.y, v1.z, v2.y, v2.z);
    var ry = getAngle(v1.x, v1.z, v2.x, v2.z);
    var rz = getAngle(v1.x, v1.y, v2.x, v2.y);

    return [rx, ry, rz];
}

function rotateJoint(v1, tov1, v2, bones, idx) {
    // 내가 여기서 v2만 변환해주면 되는 거잔아
    // 
    var xVec = new THREE.Vector3(...tov1);
    var ro = getAngleXYZ(v1, xVec);
    var vec2 = rotateVector(v2, ro[0], ro[1], ro[2]);

    var rotation = getAngleXYZ(xVec, vec2);

    bones[idx].rotation.x = rotation[0];
    bones[idx].rotation.y = rotation[1];
    bones[idx].rotation.z = rotation[2];
}

function rotateVector(vec, rx, ry, rz) {
    var temp1 = rotateXY(vec.x, vec.y, rz);
    var temp2 = rotateXY(temp1[0], vec.z, ry);
    var temp3 = rotateXY(temp1[1], temp2[1], rx);

    return new THREE.Vector3(temp2[0], temp3[0], temp3[1]);
}

function rotateXY(x, y, r) {
    var cosR = Math.cos(r);
    var sinR = Math.sin(r);

    var nx = x * cosR - y * sinR;
    var ny = x * sinR + y * cosR;
    return [nx, ny];
}


initScene();
loadModel();
render();



//------------------------------- Background Parts -----------------------------------
function rendBG_sheep() {
    scene.background = new THREE.Color(0xA5E3E6);

    lights[0] = new THREE.DirectionalLight(0xffffff, 1, 0);
    lights[1] = new THREE.DirectionalLight(0xffffff, 1, 0);
    lights[2] = new THREE.DirectionalLight(0xffffff, 1, 0);

    lights[0].position.set(0, 200, 0);
    lights[1].position.set(100, 200, 100);
    lights[2].position.set(- 100, - 200, - 100);

    //lights[0].castShadow = true;
    lights[1].castShadow = true;
    lights[2].castShadow = true;

    scene.add(lights[0]);
    scene.add(lights[1]);
    scene.add(lights[2]);

    // for convenience
    var pi = Math.PI;

    // var h = window.innerHeight,
    // w = window.innerWidth;


    // const dpi = window.devicePixelRatio;
    // renderer.setSize(w * dpi, h * dpi);

    // renderer.shadowMapEnabled = true;
    // renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // document.body.appendChild(renderer.domElement);

    //camera
    // camera.position.set(25, 5, 0);
    // camera.lookAt(new THREE.Vector3(0, 4, 0));

    //lights, 3 point lighting
    // var col_light = 0xffffff; // set

    // var light = new THREE.AmbientLight(col_light, 0.6);

    // var keyLight = new THREE.DirectionalLight(col_light, 0.6);
    // keyLight.position.set(20, 30, 10);
    // keyLight.castShadow = true;
    // keyLight.shadow.camera.top = 20;

    // var shadowHelper = new THREE.CameraHelper( keyLight.shadow.camera );
    // scene.add( shadowHelper );

    // var fillLight = new THREE.DirectionalLight(col_light, 0.3);
    // fillLight.position.set(-20, 20, 20);

    // var backLight = new THREE.DirectionalLight(col_light, 0.1);
    // backLight.position.set(10, 0, -20);

    // Add lights
    // scene.add(light);
    // scene.add(keyLight);
    // scene.add(fillLight);
    // scene.add(backLight);

    // axis
    // var axesHelper = new THREE.AxesHelper(50);
    // scene.add(axesHelper);

    //materials
    var mat_orange = new THREE.MeshPhongMaterial({ color: 0xff8c75 });
    var mat_grey = new THREE.MeshLambertMaterial({ color: 0xf3f2f7 });
    var mat_yellow = new THREE.MeshLambertMaterial({ color: 0xfeb42b });
    var mat_dark = new THREE.MeshPhongMaterial({ color: 0x5a6e6c });
    var mat_brown = new THREE.MeshLambertMaterial({ color: 0xa3785f });
    var mat_stone = new THREE.MeshLambertMaterial({ color: 0x9eaeac });
    //-------------------------------------ground-------------------------------------
    var layers = [];
    var ground = new THREE.Group();
    for (var i = 0; i < 5; i++) {
        var h = 0.1;
        var geometry = new THREE.CylinderGeometry(8 - i - 0.01, 8 - i, h, 9);
        layers.push(new THREE.Mesh(geometry, mat_orange));
        layers[i].position.y = h * i;
        layers[i].receiveShadow = true;
        ground.add(layers[i]);
    }
    layers[0].scale.x = 0.8;
    layers[1].scale.set(0.77, 1, 0.91);
    layers[1].rotation.y = ((2 * pi) / 9) * 0.6;
    layers[2].scale.set(0.8, 1, 0.91);
    layers[2].rotation.y = ((2 * pi) / 9) * 0.3;
    layers[3].scale.set(0.75, 1, 0.92);
    layers[3].rotation.y = ((2 * pi) / 9) * 0.7;
    layers[4].scale.set(0.7, 1, 0.93);
    layers[4].rotation.y = ((2 * pi) / 9) * 0.9;

    var geo_base = new THREE.CylinderGeometry(8, 1, 10, 9);
    var base = new THREE.Mesh(geo_base, mat_dark);
    base.scale.x = layers[0].scale.x;
    base.position.y = -5;
    ground.add(base);
    ground.translateY(-0.5);
    ground.receiveShadow = true;
    scene.add(ground);

    //-------------------------------------trees-------------------------------------
    var tree = new THREE.Group();

    //trunk
    var geo_trunk = new THREE.IcosahedronGeometry(9, 0);
    var trunk = new THREE.Mesh(geo_trunk, mat_grey);
    var a = new THREE.Vector3(1, 0, 10);
    trunk.rotation.x = pi / 2;
    trunk.position.y = 5;
    trunk.scale.set(0.03, 0.03, 1);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    //crown
    var geo_crown = new THREE.IcosahedronGeometry(2.5, 0);
    var crown = new THREE.Mesh(geo_crown, mat_yellow);
    crown.scale.y = 0.4;
    crown.rotation.z = -0.5;
    crown.rotation.x = -0.2;
    crown.position.set(trunk.position.x, 12, trunk.position.z);
    crown.castShadow = true;
    tree.add(crown);

    //leaf
    var leaf = new THREE.Group();
    var mainStem = new THREE.Mesh(geo_trunk, mat_grey);
    mainStem.scale.set(0.007, 0.007, 0.16);
    mainStem.rotation.x = pi / 2;
    mainStem.castShadow = true;
    leaf.add(mainStem);

    var geo_blade = new THREE.CylinderGeometry(0.7, 0.7, 0.05, 12);
    var blade = new THREE.Mesh(geo_blade, mat_yellow);
    blade.rotation.z = pi / 2;
    blade.scale.x = 1.2;
    blade.position.set(-0.05, 0.4, 0);
    blade.castShadow = true;
    leaf.add(blade);

    var subStems = [];
    for (var i = 0; i < 8; i++) {
        subStems[i] = mainStem.clone();
        subStems[i].scale.set(0.0055, 0.0055, 0.01);
        subStems[i].castShadow = true;
        leaf.add(subStems[i]);
    }
    subStems[0].rotation.x = -pi / 4;
    subStems[0].scale.z = 0.04;
    subStems[0].position.set(0, 0.8, 0.2);

    subStems[2].rotation.x = -pi / 6;
    subStems[2].scale.z = 0.05;
    subStems[2].position.set(0, 0.5, 0.25);

    subStems[4].rotation.x = -pi / 8;
    subStems[4].scale.z = 0.055;
    subStems[4].position.set(0, 0.2, 0.3);

    subStems[6].rotation.x = -pi / 10;
    subStems[6].scale.z = 0.045;
    subStems[6].position.set(0, -0.1, 0.26);

    for (var i = 1; i < 8; i += 2) {
        subStems[i].rotation.x = -subStems[i - 1].rotation.x;
        subStems[i].scale.z = subStems[i - 1].scale.z;
        subStems[i].position.set(
            0,
            subStems[i - 1].position.y,
            -subStems[i - 1].position.z
        );
    }
    leaf.rotation.x = pi / 3;
    leaf.rotation.z = 0.2;
    leaf.position.set(trunk.position.x - 0.2, 5, trunk.position.z + 1);
    tree.add(leaf);

    var leaf_1 = leaf.clone();
    leaf_1.rotation.x = -pi / 3;
    leaf_1.position.set(trunk.position.x - 0.2, 6, trunk.position.z - 1);
    tree.add(leaf_1);
    tree.rotation.y = -pi / 12;
    tree.position.set(-2, 0, -2);
    scene.add(tree);

    var tree_1 = tree.clone();
    tree_1.scale.set(0.8, 0.8, 0.8);
    tree_1.position.set(-1, 0, -5);
    tree_1.rotation.y = -pi / 5;
    scene.add(tree_1);

    var tree_2 = tree.clone();
    tree_2.scale.set(0.7, 0.7, 0.7);
    tree_2.position.set(-2, 0, 0.5);
    tree_2.rotation.y = -pi / 12;
    tree_2.children[2].rotation.x = -pi / 3;
    tree_2.children[2].position.z = trunk.position.z - 1;
    tree_2.children[3].rotation.x = pi / 3;
    tree_2.children[3].position.z = trunk.position.z + 1;
    scene.add(tree_2);

    //-------------------------------------stone-------------------------------------
    var geo_stone = new THREE.DodecahedronGeometry(1, 0);
    var stone = [];
    for (var i = 0; i < 2; i++) {
        stone[i] = new THREE.Mesh(geo_stone, mat_stone);
        scene.add(stone[i]);
        stone[i].castShadow = true;
    }
    stone[0].rotation.set(0, 12, pi / 2);
    stone[0].scale.set(3, 1, 1);
    stone[0].position.set(-1, 0.5, 4.6);

    stone[1].rotation.set(0, 0, pi / 2);
    stone[1].scale.set(1, 1, 1);
    stone[1].position.set(0, 0.2, 5.3);

    //-------------------------------------sheep-------------------------------------
    //sheep body
    var sheep = new THREE.Group();
    // var geo_sheepHead=new THREE.SphereGeometry(.5,8,6);
    var geo_sheepHead = new THREE.IcosahedronGeometry(1, 0);
    var sheepHead = new THREE.Mesh(geo_sheepHead, mat_dark);
    sheepHead.scale.z = 0.6;
    sheepHead.scale.y = 1.1;
    sheepHead.position.y = 2.5;
    sheepHead.rotation.x = -0.2;
    sheepHead.castShadow = true;
    sheep.add(sheepHead);

    var geo_sheepBody = new THREE.IcosahedronGeometry(3.5, 0);
    var sheepBody = new THREE.Mesh(geo_sheepBody, mat_grey);
    sheepBody.position.set(0, sheepHead.position.y, -2.2);
    sheepBody.scale.set(0.5, 0.5, 0.6);
    sheepBody.rotation.set(0, 0, pi / 3);
    sheepBody.castShadow = true;
    sheep.add(sheepBody);

    var geo_tail = new THREE.IcosahedronGeometry(0.5, 0);
    var tail = new THREE.Mesh(geo_tail, mat_grey);
    tail.position.set(sheepHead.position.x, sheepHead.position.y + 1.2, -3.8);
    tail.castShadow = true;
    sheep.add(tail);

    var hair = [];
    var geo_hair = new THREE.IcosahedronGeometry(0.4, 0);
    for (var i = 0; i < 5; i++) {
        hair[i] = new THREE.Mesh(geo_hair, mat_grey);
        hair[i].castShadow = true;
        sheep.add(hair[i]);
    }

    hair[0].position.set(-0.4, sheepHead.position.y + 0.9, -0.1);
    hair[1].position.set(0, sheepHead.position.y + 1, -0.1);
    hair[2].position.set(0.4, sheepHead.position.y + 0.9, -0.1);
    hair[3].position.set(-0.1, sheepHead.position.y + 0.9, -0.4);
    hair[4].position.set(0.12, sheepHead.position.y + 0.9, -0.4);

    hair[0].rotation.set(pi / 12, 0, pi / 3);
    hair[1].rotation.set(pi / 12, pi / 6, pi / 3);
    hair[2].rotation.set(pi / 12, 0, pi / 3);
    hair[3].rotation.set(pi / 12, 0, pi / 3);
    hair[4].rotation.set(pi / 12, pi / 6, pi / 3);

    hair[0].scale.set(0.6, 0.6, 0.6);
    hair[2].scale.set(0.8, 0.8, 0.8);
    hair[3].scale.set(0.7, 0.7, 0.7);
    hair[4].scale.set(0.6, 0.6, 0.6);

    var legs = [];
    var geo_leg = new THREE.CylinderGeometry(0.15, 0.1, 1, 5);
    for (var i = 0; i < 4; i++) {
        legs[i] = new THREE.Mesh(geo_leg, mat_dark);
        legs[i].castShadow = true;
        legs[i].receiveShadow = true;
        sheep.add(legs[i]);
    }
    legs[0].position.set(0.5, 1.1, -1.5);
    legs[1].position.set(-0.5, 1.1, -1.5);
    legs[2].position.set(0.8, 1.1, -3);
    legs[3].position.set(-0.8, 1.1, -3);

    var feet = [];
    var geo_foot = new THREE.DodecahedronGeometry(0.2, 0);
    for (var i = 0; i < legs.length; i++) {
        feet[i] = new THREE.Mesh(geo_foot, mat_dark);
        sheep.add(feet[i]);
        feet[i].scale.set(1, 0.8, 1);
        feet[i].castShadow = true;
        feet[i].receiveShadow = true;
        feet[i].position.set(legs[i].position.x, 0, legs[i].position.z + 0.09);
    }
    feet[0].position.y = 0.56;
    feet[1].position.y = 0.66;
    feet[2].position.y = 0.7;
    feet[3].position.y = 0.7;

    //eyes
    var geo_eye = new THREE.CylinderGeometry(0.3, 0.2, 0.05, 8);
    var eyes = [];
    for (var i = 0; i < 2; i++) {
        eyes[i] = new THREE.Mesh(geo_eye, mat_grey);
        sheep.add(eyes[i]);
        eyes[i].castShadow = true;
        eyes[i].position.set(0, sheepHead.position.y + 0.1, 0.5);
        eyes[i].rotation.x = pi / 2 - pi / 15;
    }
    eyes[0].position.x = 0.3;
    eyes[1].position.x = -eyes[0].position.x;

    eyes[0].rotation.z = -pi / 15;
    eyes[1].rotation.z = -eyes[0].rotation.z;

    //eyeballs
    var geo_eyeball = new THREE.SphereGeometry(0.11, 8, 8);
    var eyeballs = [];
    for (var i = 0; i < 2; i++) {
        eyeballs[i] = new THREE.Mesh(geo_eyeball, mat_dark);
        sheep.add(eyeballs[i]);
        eyeballs[i].castShadow = true;
        eyeballs[i].position.set(
            eyes[i].position.x,
            eyes[i].position.y,
            eyes[i].position.z + 0.02
        );
    }

    sheep.position.set(4.8, -0.8, -3);
    sheep.scale.set(0.8, 0.8, 0.8);
    sheep.rotation.set(0, pi / 4, 0);
    scene.add(sheep);

    //fence
    var fence = new THREE.Group();
    var wood = [];
    var geo_wood = new THREE.BoxGeometry(1, 1, 1);
    for (var i = 0; i < 4; i++) {
        wood[i] = new THREE.Mesh(geo_wood, mat_brown);
        fence.add(wood[i]);
        wood[i].castShadow = true;
        wood[i].receiveShadow = true;
    }
    wood[0].scale.set(0.15, 1.7, 0.4);
    wood[1].scale.set(0.15, 1.8, 0.4);
    wood[2].scale.set(0.1, 0.3, 3.2);
    wood[3].scale.set(0.1, 0.3, 3.2);

    wood[0].position.set(0, 1.2, -1);
    wood[1].position.set(0, 1, 1);
    // wood[2].position.set(.12,1.5,0);
    wood[2].position.set(0, 1.5, 0);
    wood[3].position.set(0.12, 0.9, 0);

    wood[3].rotation.x = pi / 32;
    wood[2].rotation.x = -pi / 32;
    wood[2].rotation.y = pi / 32;

    fence.position.set(1, -0.5, 3);
    fence.rotation.y = pi / 5;
    scene.add(fence);

}

function rendBG_planet2() {
    scene.background = new THREE.Color(0x000000);
    const loader = new THREE.TextureLoader();
    loader.load('../src/manyworlds-hyperwall-small.jpg' , function(texture)
                {
                 scene.background = texture;  
                });

    // change light property
    lights[0] = new THREE.DirectionalLight( 0xffffff, 1 );
    lights[0].position.set( 10, 0, 0 );
    lights[0].castShadow = true;
    lights[1] = new THREE.DirectionalLight( 0x11E8BB, 1 );
    lights[1].position.set( 7.5, 10, 5 );
    lights[1].castShadow = true;

    lights[2] = new THREE.DirectionalLight( 0x8200C9, 1 );
    lights[2].position.set( -7.5, -10, 5 );
    lights[2].castShadow = true;


    scene.add(lights[0]);
    scene.add(lights[1]);
    scene.add(lights[2]);

    circle = new THREE.Object3D();
    skelet = new THREE.Object3D();
    particle = new THREE.Object3D();

    scene.add(circle);
    scene.add(skelet);
    scene.add(particle);
  
    var geometry = new THREE.TetrahedronGeometry(2, 0);
    var geom = new THREE.SphereGeometry(7, 30, 30);
    var geom2 = new THREE.IcosahedronGeometry(15, 1);
  
    var material = new THREE.MeshPhongMaterial({
      color: 0xffffff,
    });
  
    for (var i = 0; i < 1000; i++) {
      var mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      mesh.position.multiplyScalar(90 + (Math.random() * 700));
      mesh.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
      particle.add(mesh);
    }
  
    var mat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
    });
  
    var mat2 = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      wireframe: true,
      side: THREE.DoubleSide
  
    });
  
    var planet = new THREE.Mesh(geom, mat);
    planet.scale.x = planet.scale.y = planet.scale.z = 1.6;
    planet.receiveShadow = true;
    circle.add(planet);
    
    circle.translateY(-11);
  
    // var planet2 = new THREE.Mesh(geom2, mat2);
    // planet2.scale.x = planet2.scale.y = planet2.scale.z = 2.3;
    //skelet.add(planet2);


}


// function rendBG_desert() {
//     lights[0] = new THREE.HemisphereLight(0xFFFFFF, 0x444444, 1);

//     const geo = new THREE.PlaneBufferGeometry(10000, 10000);
//     const material = new THREE.ShaderMaterial({
//         uniforms: {
//             resolution: {
//               value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
//             }
//     });
//     material.defaultAttributeValues.uv = [1.0, 1.0];
  
//     const mesh = new THREE.Mesh(geo, material);
//     // const mesh = new THREE.Mesh(geo, new THREE.MeshNormalMaterial());
//     mesh.position.set(-100, 0, 0);
//     mesh.rotation.set(0, Math.PI / 2, 0);
//     mesh.scale.set(1, 1, -1);
    
//     scene.add(mesh);

//     const igeo = new THREE.IcosahedronGeometry(40, 3);
//     // const normalMat = new THREE.MeshPhongMaterial({color: 0xFF00FF, shading: THREE.FlatShading});
//     const normalMat = new THREE.MeshPhongMaterial({ color: 0xc1994a, shading: THREE.FlatShading });
//     ground = new THREE.Mesh(igeo, normalMat);
//     igeo.verticesNeedUpdate = true;
//     console.log(igeo.attributes.position.array);
//     igeo.attributes.position.array.forEach(vert => {
//         let randomTranslate = Math.floor(Math.random() * 10) + 1;
//         let plusMinus = Math.floor(Math.random() * 2) == 1 ? 1 : -1;
//         randomTranslate *= plusMinus;
//         if (vert % 2 == 1)
//             vert += randomTranslate;
//     });
//     igeo.verticesNeedUpdate = true;

//     ground.position.set(0, -65, 0);
//     ground.scale.set(1, 1, 8);

//     scene.add(ground);
// }

function rendBG_moon() {
    var textureURL = "../src/lroc_color_poles_1k.jpg"; 
    var displacementURL = "../src/ldem_3_8bit.jpg"; 
    var worldURL = "../src/hipp8_s.jpg"

    orbit.enablePan = false;


    var geometry = new THREE.SphereGeometry( 20,60,60 );

    var textureLoader = new THREE.TextureLoader();
    var texture = textureLoader.load( textureURL );
    var displacementMap = textureLoader.load( displacementURL );
    var worldTexture = textureLoader.load( worldURL );
    
    var material = new THREE.MeshPhongMaterial ( 
      { color: 0xffffff ,
      map: texture ,
         displacementMap: displacementMap,
      displacementScale: 0.06,
      bumpMap: displacementMap,
      bumpScale: 0.04,
       reflectivity:0, 
       shininess :0
      } 
    
    );
    
    moon = new THREE.Mesh( geometry, material );
    
    
    const light = new THREE.DirectionalLight(0xFFFFFF, 1);
    light.position.set(100, 20, 50);
    light.castShadow = true;
    scene.add(light);
    
    
    const hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.1 );
    hemiLight.color.setHSL( 0.6, 1, 0.6 );
    hemiLight.groundColor.setHSL( 0.095, 1, 0.75 );
    hemiLight.position.set( 0, 0, 0 );
    scene.add( hemiLight );
    
    
    var worldGeometry = new THREE.SphereGeometry( 100,60,60 );
    var worldMaterial = new THREE.MeshBasicMaterial ( 
      { color: 0xffffff ,
      map: worldTexture ,
      side: THREE.BackSide
      } 
    );
    world = new THREE.Mesh( worldGeometry, worldMaterial );
    scene.add( world );
    
    moon.translateY(-20);
    moon.receiveShadow = true;
    scene.add( moon );
    
    moon.rotation.x = 3.1415*0.02;
    moon.rotation.y = 3.1415*1.54;
}