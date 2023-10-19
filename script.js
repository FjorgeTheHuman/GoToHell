import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

window.addEventListener("load", () => {

	// Constants
	const hell_latitude = 42.4338 * (Math.PI / 180);
	const hell_longitude = -83.9845 * (Math.PI / 180);
	const hell_altitude = 270;

	// Variables for current device data
	var latitude;
	var longitude;
	var heading;
	var yaw;
	var pitch;
	var roll;

	// Wait function for infinite loop
	function wait(ms) { return new Promise(res => setTimeout(res, ms)); };

	// Display errors as HTML
	function displayError(id, message = null, timeout = 0) {
		if (message && !$(`#${id}`).length) {
			console.error(`code: ${id}\n${message}`);

			$(`#error-template`).clone().attr({
				id: id
			}).html(message).appendTo("#message-box");

			if (timeout > 0) {
				setTimeout(displayError(id), timeout);
			};
		} else if (!message && $(`#${id}`).length) {
			console.warn(`Removing error ${id}.`);

			$(`#${id}`).remove();
		};
	};

	// Save the location of the device
	function handleGeoPosition(position) {
		latitude = position.coords.latitude;
		longitude = position.coords.longitude;
		heading = position.coords.heading

		displayError("geo-no-perm");
		displayError("geo-error");
		displayError("geo-timeout");
	};

	// Display various error codes from the geolocation API
	function handleGeoError(err) {
		switch (err.code) {
			case 1:
				displayError("geo-no-perm", "Please allow geolocation.");
				break;
			case 2:
				displayError("geo-error", "Something went wrong while determining your location.");
				break;
			case 3:
				displayError("geo-timeout", "Geolocation request timed out.");
				break;
		}
	};

	// Save device orientation
	function handleOrientation(orientation) {
		if (orientation.webkitCompassHeading) {
			yaw = orientation.webkitCompassHeading;
			
			console.warn("Using webkit-specific compass heading.");
		} else if (orientation.alpha) {
			yaw = orientation.alpha;
		};

		pitch = orientation.beta;
		roll = orientation.gamma;
	};

	// Vibrate morse code for "go to hell"
	function vibrate() {
		window.navigator.vibrate([300, 100, 300, 100, 100, 300, 300, 100, 300, 100, 300, 700, 300, 300, 300, 100, 300, 100, 300, 700, 100, 100, 100, 100, 100, 100, 100, 300, 100, 300, 100, 100, 300, 100, 100, 100, 100, 300, 100, 100, 300, 100, 100, 100, 100, 100, 700]);
	};

	function distance(lat, lon) {
		// Haversign formula
		// https://en.wikipedia.org/wiki/Haversine_formula
		const lat_r = lat * (Math.PI / 180);
		const lon_r = lon * (Math.PI / 180);

		const dlon = hell_longitude - lon_r;
		const dlat = hell_latitude - lat_r;

		const a = Math.pow(Math.sin(dlat / 2), 2) + Math.cos(lat_r) * Math.cos(hell_latitude) * Math.pow(Math.sin(dlon / 2), 2);

		return 6371 * 2 * Math.asin(Math.sqrt(a));
	};

	// Get orientation
	if (DeviceOrientationEvent.requestPermission) {
		console.warn("Requesting permission for device orientation.")

		function requestOrientationPermission() {
			DeviceOrientationEvent.requestPermission()
			.then((response) => {
				if (response === "granted") {
					window.addEventListener("deviceorientation", handleOrientation, true);
					
					$('#message-ask-orient-perm').attr({style: "display: none;"});
				} else {
					displayError("compass-no-perm", "Please allow getting device orientation.");
				}
			}).catch(() => {
				displayError("compass-no-support", "Your device does not support getting compass headings.")
			});
		};

		const request = document.getElementById("message-ask-orient-perm");
		request.addEventListener("click", requestOrientationPermission);
		request.style = {};
	} else {
		window.addEventListener("deviceorientationabsolute", handleOrientation, true);
	}

	// Check for WebGL support
	if (!WebGL.isWebGLAvailable()) {
		displayError("webgl-no-support", "Please enable WebGL or use a browser that supports it.");
		return;
	};

	// Check for geolocation support
	if ("geolocation" in navigator) {
		navigator.geolocation.getCurrentPosition(handleGeoPosition, handleGeoError);
		navigator.geolocation.watchPosition(handleGeoPosition, handleGeoError);
	} else {
		displayError("geo-no-support", "Your device does not support geolocation.");
	}

	// Create the required three.js objects
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
	const renderer = new THREE.WebGLRenderer();
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	const loader = new GLTFLoader();

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

	scene.add(new THREE.AxesHelper(5))

const light = new THREE.PointLight(0xffffff, 1000)
light.position.set(2.5, 7.5, 15)
scene.add(light)

	// Add some light
	const ilight = new THREE.AmbientLight(0xffffff);
	scene.add(ilight);

	camera.position.z = 5;

	document.getElementById("center").appendChild(renderer.domElement);
	renderer.domElement.id = "arrow";

	// Load the arrow
	loader.load('static/arrow.gltf', function (gltf) {
		let model = gltf.scene;

		var newMaterial = new THREE.MeshStandardMaterial({color: 0xff0000});
model.traverse((o) => {
  if (o.isMesh) o.material = newMaterial;
});

		model.scale.set(4, 4, 4);

		scene.add(model);
				model.rotation.y = -Math.PI / 2;
		
		// Make the render size a square
		const size = Math.min(document.getElementById("center").clientWidth, document.getElementById("center").clientHeight);
		renderer.setSize(size, size);

		// Render the scene
		renderer.render(scene, camera);

		// Draw the arrow on the canvas
		function displayArrow() {
			requestAnimationFrame(displayArrow);

			const hdn = yaw || heading;

			if (!hdn && !DeviceOrientationEvent.requestPermission) {
				displayError("compass-no-support", "Your device does not support getting compass headings.");
			} else {
				displayError("compass-no-support");
			}

			if (latitude != null && longitude != null && hdn != null && pitch != null && yaw != null) {
				model.rotation.y = -Math.PI / 2;
			} else if (latitude != null && longitude != null && hdn != null) {
				console.log("Using 2D compass mode.");
				// TODO: Implement 2D compass
			}

			$("#distance").html(`${distance(latitude, longitude).toFixed(2).toLocaleString()}km`);
controls.update()
			// Make the render size a square
			const size = Math.min(document.getElementById("center").clientWidth, document.getElementById("center").clientHeight);
			renderer.setSize(size, size);

			// Render the scene
			renderer.render(scene, camera);
		};

		// draw arrow forever
		displayArrow();
	}, undefined, function (error) {
		console.error(error);
	});
});

// vim:ts=2:sw=2:noexpandtab
