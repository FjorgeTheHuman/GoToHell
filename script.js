// Constants
const hell_latitude = 42.4338 * (Math.PI / 180);
const hell_longitude = -83.9845 * (Math.PI / 180);
const hell_altitude = 270;

// WebGL
//const canvas = document.getElementById('arrow');
//const webgl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

// Variables for current device data
var latitude;
var longitude;
var heading;
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
		}).html(message).appendTo("#error-box");

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
	heading = position.coords.heading;

	if (!heading) {
		displayError("geo-no-support", "Your device does not support the required geolocation features.");
		return;
	}

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
		heading = orientation.webkitCompassHeading;
		
		console.warn("Using webkit-specific compass heading.");
	} else if (orientation.alpha) {
		heading = orientation.alpha;
	};

	pitch = orientation.beta;
	roll = orientation.gamma;
};

// Draw the arrow on the canvas
function displayArrow() {
	//if (!webgl || !(webgl instanceof WebGLRenderingContext)) {
	//	displayError("webgl-no-support", "Please enable WebGL or use a browser which supports it.");
	//	return;
	//}

	if (latitude != null && longitude != null && heading != null && pitch != null && yaw != null) {
		console.log("Full range of data.");
	} else if (latitude != null && longitude != null && heading != null) {
		console.warning("Only latitude, longitude, and heading.");
	} else {
		//return;
	}

	$("#distance").html(`${distance(latitude, longitude).toFixed(2).toLocaleString()}km`);
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

// Check for geolocation support
if ("geolocation" in navigator) {
	navigator.geolocation.getCurrentPosition(handleGeoPosition, handleGeoError);
	navigator.geolocation.watchPosition(handleGeoPosition, handleGeoError);
} else {
	displayError("geo-no-support", "Your device does not support geolocation.");
}

window.addEventListener("deviceorientation", handleOrientation, true);

// Async infinite loop to draw arrow
async function loop() {
	while (true) {
		displayArrow();

		await wait(50);
	};
};

loop();

// vim:ts=2:sw=2:noexpandtab
