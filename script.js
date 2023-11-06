import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import WebXRPolyfill from 'webxr-polyfill';
const polyfill = new WebXRPolyfill();

// Ensuring radians are positive and between 0 and 2pi
function sRad(rad) {
	while (rad < 0) {
		rad += 2 * Math.PI;
	}

	return rad % (2 * Math.PI);
}

// Converting degrees to radians
function degToRad(deg) {
	return sRad(deg * Math.PI / 180);
}

const EARTH_RADIUS = 6371;

function calcDistance(lat1, lon1, lat2, lon2) {
	// Haversign formula
	// https://en.wikipedia.org/wiki/Haversine_formula
	const dLon = lon2 - lon1;
	const dLat = lat2 - lat1;

	const a = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dLon / 2), 2);

	return EARTH_RADIUS * 2 * Math.asin(Math.sqrt(a));
};

function calcBearing(lat1, lon1, lat2, lon2) {
	// https://www.igismap.com/what-is-bearing-angle-and-calculate-between-two-points/
	const dL = lon2 - lon1;

	const X = Math.cos(lat2) * Math.sin(dL);
	const Y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dL);

	return Math.atan2(X, Y);
};

function calcVerticalAngle(lat1, lon1, lat2, lon2) {
	return degToRad((calcDistance(lat1, lon1, lat2, lon2) / (2 * Math.PI * EARTH_RADIUS)) * 360) / 2;
}

function genLocationId(loc) {
	return `location-option-${loc.name}-${loc.region}-${loc.nation}`.toLowerCase().replace(/\s/g, '-');
}

window.addEventListener("load", async () => {
	const canVibrate = ('vibrate' in window.navigator);

	// Fetch location data JSON
  const data = JSON.parse(await (await fetch(new Request('./static/locations.json'))).text());

	// Populate menu of locations
	for (let i = -1; i < data.locations.length; i++) {
		let name;
		let id;

		if (i == -1) {
			name = "Closest";
			id = name.toLowerCase();
		} else {
			name = `${data.locations[i].region}, ${data.locations[i].nation}`;
			id = genLocationId(data.locations[i]);
		}

		const str = `<div class="location-select-box-option"><input id="${id}" type="radio" name="location" value="${i}"${i == -1 ? 'checked="checked"' : ''}><label for="${id}">${name}</label></div>`;

		const template = document.createElement('template');
		template.innerHTML = str;

		document.getElementById('location-select-form').prepend(template.content.firstChild);
	}

	// Add handler for location menu toggle
	const locationSelectForm = document.getElementById('location-select-form');
	const locationSelectToggle = document.getElementById('location-select-box-button');
	const locationSelectBox = document.getElementById('location-select-box');

	locationSelectToggle.addEventListener('click', (event) => {
		if (locationSelectToggle.ariaChecked === "true") {
			locationSelectToggle.ariaChecked = "false";
			locationSelectToggle.setAttribute('aria-checked', 'false');
			locationSelectBox.className = "in";
		} else {
			locationSelectToggle.ariaChecked = "true";
			locationSelectToggle.setAttribute('aria-checked', 'true');
			locationSelectBox.className = "out";
		}
	});

	// Variables for current device data
	var latitude = null;
	var longitude = null;
	var heading = null;
	const rotation = {
		yaw: null,
		pitch: null,
		roll: null
	}
	const acceleration = {
		x: null,
		y: null,
		z: null,
		pitch: null,
		roll: null,
	}

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
			console.info(`Removing error ${id}.`);

			$(`#${id}`).remove();
		};
	};

	// Display warnings as HTML
	function displayWarning(id, message = null) {
		if (message && !$(`#${id}`).length) {
			console.warn(`code: ${id}\n${message}`);

			$(`#warning-template`).clone().attr({
				id: id
			}).html(message).appendTo("#message-box").on("click", () => {
				console.info(`User dismissed warning ${id}.`);
				$(this).css('display', 'none');
			});
		} else if (!message && $(`#${id}`).length) {
			console.info(`Removing warning ${id}.`);

			$(`#${id}`).remove();
		};
	};

	// Save the location of the device
	function handleGeoPosition(position) {
		latitude = degToRad(position.coords.latitude);
		longitude = degToRad(position.coords.longitude);
		heading = degToRad(position.coords.heading);

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
	var print_orientation_info = true;
	function handleOrientation(orientation) {
		rotation.yaw = orientation.webkitCompassHeading || orientation.alpha;

		if (print_orientation_info && orientation.webkitCompassHeading) {
			print_orientation_info = false;

			console.info("Using webkit-specific compass heading.");
		};

		rotation.pitch = degToRad(orientation.beta);
		rotation.roll = degToRad(orientation.gamma);
		rotation.yaw = degToRad(rotation.yaw);
	};

	// Save device motion
	var print_motion_info = true;
	function handleMotion(motion) {
		var X = motion.accelerationIncludingGravity.x;
		var Y = motion.accelerationIncludingGravity.y;
		var Z = motion.accelerationIncludingGravity.z;

		if (motion.acceleration) {
			X = X - motion.acceleration.x;
			Y = Y - motion.acceleration.y;
			Z = Z - motion.acceleration.z;
		} else if (print_motion_info) {
			print_motion_info = false;

			console.info("No acceleration without gravity available. Device acceleration will affect display.");
		}

		acceleration.x = X;
		acceleration.y = Y;
		acceleration.z = Z;

		// Roll and pitch from acceleration
		// https://stackoverflow.com/a/30195572
		var Roll = Math.atan2(-X, Math.sqrt(Math.pow(Y, 2) + Math.pow(Z, 2)));
		var Pitch = Math.atan2(Y, (Z >= 0 ? 1 : -1) * Math.sqrt(Math.pow(Z, 2) + (0.001 * Math.pow(X, 2))));

		acceleration.roll = Roll;
		acceleration.pitch = Pitch;
	};

	// Vibrate morse code for "go to hell"
	var vibrate_lock = false;
	function vibrate() {
		if (vibrate_lock) {
			return;
		}

		const pattern = [300, 100, 300, 100, 100, 300, 300, 100, 300, 100, 300, 700, 300, 300, 300, 100, 300, 100, 300, 700, 100, 100, 100, 100, 100, 100, 100, 300, 100, 300, 100, 100, 300, 100, 100, 100, 100, 300, 100, 100, 300, 100, 100, 100, 100, 100, 700];

		vibrate_lock = true;
		setTimeout(() => {vibrate_lock = false}, pattern.reduce((a, b) => a + b, 0))
		window.navigator.vibrate(pattern);
	};

	// Get accelerometer and orientation data
	if (DeviceOrientationEvent.requestPermission || DeviceMotionEvent.requestPermission) {
		console.info("Requesting permission for device orientation using Safari API.");

		const request = document.getElementById("message-ask-orient-perm");

		function requestMotionPermission() {
			function handleResponse(response) {
				if (response === "granted") {
					window.addEventListener("deviceorientation", handleOrientation, true);
					window.addEventListener("devicemotion", handleMotion, true);
					
					request.style.display = "none";
				} else {
					displayError("compass-no-perm", "Please allow getting device orientation and motion.");
					request.style.display = "none";
				}
			}

			if (DeviceMotionEvent.requestPermission) {
				DeviceMotionEvent.requestPermission().then(handleResponse).catch(() => {
					// No warning yet
				});
			} else if (DeviceOrientationEvent.requestPermission) {
				DeviceOrientationEvent.requestPermission().then(handleResponse).catch(() => {
					// No warning yet
				});
			};
		};

		request.addEventListener("click", requestMotionPermission);
		request.style.display = null;
	} else {
		window.addEventListener("deviceorientationabsolute", handleOrientation, true);
		window.addEventListener("devicemotion", handleMotion, true);
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
		displayError("geo-no-support", "Your browser does not support geolocation.");
		return;
	}

	// Lock orientation to portrait if possible
	if ('lock' in screen.orientation) {
		screen.orientation.lock('natural').catch((error) => {
			console.error(error);
		});
	}

	// Create the required three.js objects
	const scene = new THREE.Scene();
	let camera = new THREE.PerspectiveCamera(75, 1, 0.1, 10.1);
	const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	const loader = new GLTFLoader();

	// Add handler for AR toggle
	const ARToggle = document.getElementById('ar-toggle-button');
	var ARSession = null;

	if (navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar'))) {
		ARToggle.style = "";

		async function startARSession(session) {
			ARSession = session;
			ARSession.addEventListener('end', endARSession);

			renderer.xr.setReferenceSpaceType('local');
			await renderer.xr.setSession(session);
			renderer.xr.enabled = true;
		}

		function endARSession() {
			ARSession.removeEventListener('end', endARSession);

			renderer.xr.enabled = false;
			ARSession = null;

			// Reset camera
			camera = new THREE.PerspectiveCamera(75, 1, 0.1, 10.1);
		}

		ARToggle.addEventListener('click', (event) => {
			if (ARToggle.ariaChecked === "true") {
				ARToggle.ariaChecked = "false";
				ARToggle.setAttribute('aria-checked', 'false');
				renderer.xr.enabled = false;

				if (ARSession) {
					ARSession.end().then(() => {ARSession = null});
				}

			} else {
				ARToggle.ariaChecked = "true";
				ARToggle.setAttribute('aria-checked', 'true');

				renderer.xr.enabled = true;

				navigator.xr.requestSession('immersive-ar', {
					requiredFeatures: ['dom-overlay', 'local'],
					optionalFeatures: ['dom-overlay', 'local', 'light-estimation'],
					domOverlay: {
						root: document.getElementById('main-content'),
					},
				}).then((session) => {
					startARSession(session);
				}).catch((error) => {
					console.error("Something went wrong while trying to start the XR session.");

					ARToggle.style.display = "none";
					ARToggle.style.pointerEvents = "none";
				});
			}
		});
	} else {
		console.info("WebXR AR is not supported.");
	}

	// Add some light
	const alight = new THREE.AmbientLight(0x820014);
	scene.add(alight);

	// Add renderer to DOM
	renderer.domElement.id = 'arrow';
	document.getElementById('arrow').replaceWith(renderer.domElement);

	// Load the arrow
	loader.load('static/arrow.gltf', function (gltf) {
		let model = gltf.scene;
		model.scale.set(0.3, 0.3, 0.3);

		// Replace model material
		var newMaterial = new THREE.MeshStandardMaterial({color: 0xff7875});
		model.traverse((o) => {
			if (o.isMesh) o.material = newMaterial;
		});

		// Create a group for the model
		const arrowGroup = new THREE.Group();
		arrowGroup.add(model);

		// Add some yellow lights to the group
		const yellowLightFront = new THREE.PointLight(0xffec3d, 3);
		yellowLightFront.position.set(0, 5, 0);
		arrowGroup.add(yellowLightFront);

		const yellowLightTop = new THREE.PointLight(0xffec3d, 10);
		yellowLightTop.position.set(0, 5, 2);
		arrowGroup.add(yellowLightTop);

		const yellowLightBottom = new THREE.PointLight(0xffec3d, 10);
		yellowLightBottom.position.set(0, 5, -2);
		arrowGroup.add(yellowLightBottom);

		// Add a light to the group
		const light = new THREE.PointLight(0x1a1a1a, 50);
		light.position.set(0, 4, 3);
		arrowGroup.add(light);

		// Add group to scene
		arrowGroup.position.z = -5;
		scene.add(arrowGroup);
		
		// Make the render size a square
		const size = Math.min(document.getElementById("center").clientWidth, document.getElementById("center").clientHeight);
		renderer.setSize(size, size);

		// Render the scene
		renderer.render(scene, camera);

		// Update all the displays
		function updateDisplays() {
			// Call function every frame
			renderer.setAnimationLoop(updateDisplays);

			// Find the angles and distance to the selected location
			let loc = parseInt(locationSelectForm.elements.location.value);
			let distance;
			let bearing;
			let verticalAngle;

			if (loc === -1) {
				if (latitude != null && longitude != null) {
					// Find the closest location
					loc = 0;
					distance = Number.MAX_SAFE_INTEGER;
					for (let i = 0; i < data.locations.length; i++) {
						const locLatitude = degToRad(data.locations[i].latitude);
						const locLongitude = degToRad(data.locations[i].longitude);

						const iDistance = calcDistance(latitude, longitude, locLatitude, locLongitude);

						if (iDistance <= distance) {
							loc = i;
							distance = iDistance;
							bearing = calcBearing(latitude, longitude, locLatitude, locLongitude);
							verticalAngle = calcVerticalAngle(latitude, longitude, locLatitude, locLongitude);
						}
					}
				}
			} else {
				// Use the selected location
				const locLatitude = degToRad(data.locations[loc].latitude);
				const locLongitude = degToRad(data.locations[loc].longitude);

				distance = calcDistance(latitude, longitude, locLatitude, locLongitude);
				bearing = calcBearing(latitude, longitude, locLatitude, locLongitude);
				verticalAngle = calcVerticalAngle(latitude, longitude, locLatitude, locLongitude);
			}

			if (loc >= 0) {
				// Update links and references to hell
				document.getElementById('hell-name').setAttribute('title', `${data.locations[loc].name}, ${data.locations[loc].region}, ${data.locations[loc].nation}`);
				document.getElementById('hell-link').setAttribute('href', `${data.locations[loc].url}`);

				// Display which location is being selected
				$('.location-select-box-option > label').removeClass("location-option-selected");
				$(`.location-select-box-option > input#${genLocationId(data.locations[loc])} ~ label`).addClass('location-option-selected');

				// Set distance to hell
				if (latitude != null && longitude != null) {
					document.getElementById('distance').innerHTML = `${distance.toFixed(2).toLocaleString()}km`;
				}
			}

			// Get compass heading
			const hdn = rotation.yaw || heading;

			// Display error if the device has no compass
			if (!hdn && !DeviceOrientationEvent.requestPermission) {
				displayError("compass-no-support", "Your device does not support getting compass headings.");
				// TEST: Override this
				//return;
			} else {
				displayError("compass-no-support");
			}

			// Display error if the device has no geolocation
			if (latitude == null && longitude == null) {
				displayError("geo-no-support", "Your device does not support geolocation.");
				return;
			} else {
				displayError("geo-no-support");
			}

			// Different modes for a device with full sensors, only orientation data, and only compass
			if (acceleration.roll != null && acceleration.pitch != null) {
				var yaw_c = hdn - bearing;
				var pitch_c = sRad(acceleration.pitch);
				
				if (pitch_c > (Math.PI / 4) && pitch_c <= (7 * Math.PI / 4)) {
					yaw_c = yaw_c + Math.PI;
				}

				// NOTE: Z points up, X points right, Y points forwards
				//       That means Z is yaw, X is pitch, Y is roll
				const rot = new THREE.Euler(sRad(-acceleration.pitch), sRad(Math.PI - acceleration.roll), sRad(yaw_c), 'XYZ');
				arrowGroup.setRotationFromEuler(rot);
				arrowGroup.rotateX(sRad(-verticalAngle));
			} else if (rotation.pitch != null && rotation.roll != null) {
				displayWarning('motion-no-support', 'Due to your device\'s capabilities, there may be a large error in roll when the device is oriented vertically.');
				console.warn("No acceleration data. Falling back to orientation API.");
				var pitch_c = -rotation.pitch;
				var roll_c = -rotation.roll;
				var yaw_c = hdn - bearing;

				if (rotation.pitch > Math.PI / 2 && rotation.pitch < 3 * Math.PI / 2) {
					roll_c = roll;
				}

				if (rotation.pitch > Math.PI) {
					pitch_c = Math.PI + pitch_c;
					yaw_c = yaw_c + Math.PI;
					roll_c = -roll_c + Math.PI;
				}

				if (sRad(rotation.pitch) > (Math.PI / 4) && sRad(rotation.pitch) <= (7 * Math.PI / 4)) {
					yaw_c = yaw_c + Math.PI;
				}

				// NOTE: Z points up, X points right, Y points forwards
				//       That means Z is yaw, X is pitch, Y is roll
				const rot = new THREE.Euler(sRad(pitch_c), sRad(roll_c), sRad(yaw_c), 'XYZ');
				arrowGroup.setRotationFromEuler(rot);
				arrowGroup.rotateX(sRad(-verticalAngle));
			} else {
				arrowGroup.rotation.x = 0;
				arrowGroup.rotation.y = 0;
				arrowGroup.rotation.z = hdn - bearing;
			}

			// Vibrate if possible and arrow is close enough
			if (Math.abs(bearing - hdn) < (Math.PI / 18)) {
				if (canVibrate) {
					vibrate();
				}
			} else if (canVibrate) {
				window.navigator.vibrate(0);
			}

			// Display the distance between user location and Hell
			$("#distance").html(`${distance.toFixed(2).toLocaleString()}km`);

			// Make the render size a square
			const size = Math.min(document.getElementById("center").clientWidth, document.getElementById("center").clientHeight);
			renderer.setSize(size, size);
			if ((!renderer.xr.enabled) && screen.orientation) {
				try {
					document.getElementById('arrow').style.transform = `rotate(${screen.orientation.angle}deg)`;
				} catch (e) {
					// Do nothing
				}
			}

			// Render the scene
			renderer.render(scene, camera);
		};

		// Draw the arrow
		updateDisplays();
	}, undefined, function (error) {
		console.error(error);
	});
});

// vim:ts=2:sw=2:noexpandtab
