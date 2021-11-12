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

	// initBones();
	// setupDatGui();

}

function createGeometry(sizing) {

	const geometry = new CylinderGeometry(
		5, // radiusTop
		5, // radiusBottom
		sizing.height, // height
		8, // radiusSegments
		sizing.segmentCount * 3, // heightSegments
		true // openEnded
	);

	const position = geometry.attributes.position;

	const vertex = new Vector3();

	const skinIndices = [];
	const skinWeights = [];

	for (let i = 0; i < position.count; i++) {

		vertex.fromBufferAttribute(position, i);

		const y = (vertex.y + sizing.halfHeight);

		const skinIndex = Math.floor(y / sizing.segmentHeight);
		const skinWeight = (y % sizing.segmentHeight) / sizing.segmentHeight;

		skinIndices.push(skinIndex, skinIndex + 1, 0, 0);
		skinWeights.push(1 - skinWeight, skinWeight, 0, 0);

	}

	geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4));
	geometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4));

	return geometry;

}

function createBones(sizing) {

	bones = [];

	let prevBone = new Bone();
	bones.push(prevBone);
	prevBone.position.y = - sizing.halfHeight;

	for (let i = 0; i < sizing.segmentCount; i++) {

		const bone = new Bone();
		bone.position.y = sizing.segmentHeight;
		bones.push(bone);
		prevBone.add(bone);
		prevBone = bone;

	}

	return bones;

}

function createMesh(geometry, bones) {

	const material = new MeshPhongMaterial({
		color: 0x156289,
		emissive: 0x072534,
		side: DoubleSide,
		flatShading: true
	});

	const mesh = new SkinnedMesh(geometry, material);
	const skeleton = new Skeleton(bones);

	mesh.add(bones[0]);

	mesh.bind(skeleton);

	skeletonHelper = new SkeletonHelper(mesh);
	skeletonHelper.material.linewidth = 2;
	scene.add(skeletonHelper);

	return mesh;

}

function setupDatGui(object) {

	let folder;
	// let folder = gui.addFolder("General Options");

	// folder.add(state, "animateBones");
	// folder.__controllers[0].name("Animate Bones");

	// folder.add(mesh, "pose");
	// folder.__controllers[1].name(".pose()");
	var a = object.children[1]
	const bones = getBoneList(object);

	for (let i = 0; i < bones.length; i++) {

		const bone = bones[i];

		folder = gui.addFolder(i + ':' + bone.name);

		folder.add(bone.position, 'x', - 10 + bone.position.x, 10 + bone.position.x);
		folder.add(bone.position, 'y', - 10 + bone.position.y, 10 + bone.position.y);
		folder.add(bone.position, 'z', - 10 + bone.position.z, 10 + bone.position.z);

		folder.add(bone.rotation, 'x', - Math.PI * 1, Math.PI * 1);
		folder.add(bone.rotation, 'y', - Math.PI * 1, Math.PI * 1);
		folder.add(bone.rotation, 'z', - Math.PI * 1, Math.PI * 1);

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

function initBones() {

	const segmentHeight = 8;
	const segmentCount = 4;
	const height = segmentHeight * segmentCount;
	const halfHeight = height * 0.5;

	const sizing = {
		segmentHeight: segmentHeight,
		segmentCount: segmentCount,
		height: height,
		halfHeight: halfHeight
	};

	const geometry = createGeometry(sizing);
	const bones = createBones(sizing);
	mesh = createMesh(geometry, bones);

	mesh.scale.multiplyScalar(1);
	scene.add(mesh);

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


function getBoneList( object ) {

	const boneList = [];

	if ( object && object.isBone) {

		boneList.push( object );

	}

	for (let i = 0; i < object.children.length; i++) {


		boneList.push.apply(boneList, getBoneList(object.children[i]));

	}
	
	return boneList;

}





initScene();
myBones();
render();