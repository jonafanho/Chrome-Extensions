import FetchData from "./fetch.js";
import SETTINGS from "./settings.js";

const DEFAULT_LOCATION = [47.649281, -122.358524];
const LOCATION_ACCURACY_THRESHOLD = 200;

const REFRESH_MINECRAFT_INTERVAL = 5000;
const REFRESH_WEATHER_INTERVAL = 60000;
const REFRESH_STOPS_INTERVAL = 30000;
const RADIUS = 1000;
const MAX_ARRIVALS = 5;

let latitude;
let longitude;
let stopData = [];

const GEOLOCATION_ID = navigator.geolocation.watchPosition(pos => {
	latitude = pos.coords.latitude;
	longitude = pos.coords.longitude;
	FETCH_WEATHER.fetchData();
	FETCH_STOPS.fetchData();
	if (pos.coords.accuracy < LOCATION_ACCURACY_THRESHOLD) {
		navigator.geolocation.clearWatch(GEOLOCATION_ID);
		console.log(`Location watch stopped. Accuracy: ${pos.coords.accuracy} m`);
	} else {
		console.log(`Location last updated: ${new Date}`);
	}
}, error => {
	console.warn(`ERROR(${error.code}): ${error.message}`);
	latitude = DEFAULT_LOCATION[0];
	longitude = DEFAULT_LOCATION[1];
	FETCH_WEATHER.fetchData();
	FETCH_STOPS.fetchData();
}, {enableHighAccuracy: true, maximumAge: 0});
const FETCH_WEATHER = new FetchData(() => `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${SETTINGS.weatherKey}`, REFRESH_WEATHER_INTERVAL, false, () => true, result => {
	const {main, name, weather} = result;
	document.getElementById("temperature").innerText = `${Math.round(main["temp"]).toString()}°`;
	document.getElementById("temperature-low").innerText = `${Math.round(main["temp_min"]).toString()}°`;
	document.getElementById("temperature-high").innerText = `${Math.round(main["temp_max"]).toString()}°`;
	document.getElementById("weather-details").innerText = `${name}, ${weather[0]["description"]}`;
	document.getElementById("weather-icon").src = `https://openweathermap.org/img/wn/${weather[0]["icon"]}@4x.png`;
	document.getElementById("weather").style.opacity = "1";
});
const FETCH_STOPS = new FetchData(() => `${SETTINGS.obaDomain}/api/where/stops-for-location.json?key=${SETTINGS.obaKey}&lat=${latitude}&lon=${longitude}&radius=${RADIUS}&&includeReferences=false`, REFRESH_STOPS_INTERVAL, false, () => true, result => {
	const stops = result["data"]["list"];
	stops.forEach(stop => stop["distance"] = getDistance(stop["lat"], stop["lon"], latitude, longitude));
	stops.sort((a, b) => a["distance"] - b["distance"]);
	const tempStopData = [];

	stops.forEach(stop => {
		const {name, id, distance, direction} = stop;
		tempStopData.push({
			id: id,
			title: `${name}${direction ? ` (${direction})` : ""} | ${id} | ${distance} m`,
			arrivals: [],
		});
	});

	let fetchedCount = 0;
	for (let i = 0; i < tempStopData.length; i++) {
		const {id} = tempStopData[i];
		fetch(`${SETTINGS.obaDomain}/api/where/arrivals-and-departures-for-stop/${id}.json?key=${SETTINGS.obaKey}&minutesBefore=0&minutesAfter=120&&includeReferences=false`, {cache: "no-cache"}).then(response => response.json()).then(result => {
			const arrivals = result["data"]["entry"]["arrivalsAndDepartures"];
			arrivals.forEach(arrival => {
				const {
					routeShortName,
					tripHeadsign,
					vehicleId,
					predictedDepartureTime,
					scheduledDepartureTime,
				} = arrival;
				tempStopData[i]["arrivals"].push({
					"route": routeShortName,
					"destination": tripHeadsign,
					"vehicleId": vehicleId,
					"arrival": predictedDepartureTime === 0 ? scheduledDepartureTime : predictedDepartureTime,
					"deviation": predictedDepartureTime === 0 ? null : predictedDepartureTime - scheduledDepartureTime,
				});
			});
			checkFetch();
		}).catch(() => checkFetch());

		const checkFetch = () => {
			fetchedCount++;
			if (fetchedCount === tempStopData.length) {
				stopData = tempStopData;
			}
		};
	}
});

new FetchData(() => "https://jonafanho.no-ip.org/lets-play-system-map/info", REFRESH_MINECRAFT_INTERVAL, false, () => true, result => {
	const serverSummaryElement = document.getElementById("server-info");
	serverSummaryElement.innerText = "";
	let playerCount = 0;
	result.forEach(playersInDimension => {
		playerCount += playersInDimension.length;
		playersInDimension.forEach(playerDetails => {
			const {player, name, number, destination, circular, color} = playerDetails;
			serverSummaryElement.innerHTML +=
				`<div class="flex-row grayscale">` +
				`<img class="image-small" src="https://mc-heads.net/avatar/${player}" alt=""/>` +
				`<div class="spacer-small"></div>` +
				`<div class="centered-flex-content">${player}</div>` +
				`</div>`;
		});
		serverSummaryElement.innerHTML += `<div class="spacer-small"></div>`;
	});
	document.getElementById("server-summary").innerHTML = `<h3>There ${playerCount === 1 ? "is" : "are"} ${playerCount > 0 ? playerCount : "no"} player${playerCount === 1 ? "" : "s"} online.</h3>`;
	document.getElementById("server").style.opacity = "1";
}).fetchData();

const refreshArrivals = () => {
	const stopsElement = document.getElementById("stops");
	stopsElement.innerText = "";
	const visitedArrivals = [];
	const millis = Date.now();

	stopData.forEach(stopDetails => {
		const {title, arrivals} = stopDetails;
		let arrivalsHtml = "";
		let arrivalCount = 0;

		for (let i = 0; i < arrivals.length; i++) {
			const {route, destination, deviation, vehicleId, arrival} = arrivals[i];
			const key = `${route}_${destination}`;
			const arrivalMillis = arrival - millis;

			if (!visitedArrivals.includes(key)) {
				arrivalsHtml +=
					`<div class="flex-row">` +
					(route ? `<div class="no-overflow-text" style="width: 4em; flex-shrink: 0">${route}</div>` : "") +
					`<div class="no-overflow-text" style="width: 100%">${destination}</div>` +
					`<div class="no-overflow-text" style="width: 6em; flex-shrink: 0; text-align: right"">${deviation == null ? "" : Math.abs(deviation) < 30000 ? "On time" : millisecondsToTimeString(Math.abs(deviation)) + ` ${deviation > 0 ? "delay" : "early"}`}</div>` +
					`<div class="no-overflow-text" style="width: 6em; flex-shrink: 0; text-align: right"">${vehicleId}</div>` +
					`<div class="no-overflow-text" style="width: 6em; flex-shrink: 0; text-align: right">${arrivalMillis < 0 ? "Gone" : millisecondsToTimeString(arrivalMillis)}</div>` +
					`</div>`
				arrivalCount++;
				visitedArrivals.push(key);
			}

			if (arrivalCount >= MAX_ARRIVALS) {
				break;
			}
		}

		if (arrivalsHtml) {
			stopsElement.style.opacity = "1";
			stopsElement.innerHTML += `<h3 class="centered no-overflow-text">${title}</h3>${arrivalsHtml}<div class="spacer-small"></div>`;
		}
	});
};
setInterval(refreshArrivals, 1000);

const updateClock = () => {
	const date = new Date();
	const hours = date.getHours();
	document.getElementById("time").innerText = `${(hours % 12) + ((hours % 12) === 0 ? 12 : 0)}:${date.getMinutes().toString().padStart(2, "0")}`;
	document.getElementById("date").innerText = date.toLocaleString("default", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
	document.getElementById("clock").style.opacity = "1";
	setTimeout(updateClock, 60000 - date.getSeconds() * 1000 - date.getMilliseconds());
};
updateClock();

const getDistance = (lat1, lon1, lat2, lon2) => {
	const dLat = Math.PI * (lat2 - lat1) / 180.0;
	const dLon = Math.PI * (lon2 - lon1) / 180.0;
	lat1 = Math.PI * lat1 / 180.0;
	lat2 = Math.PI * lat2 / 180.0;
	const a = Math.pow(Math.sin(dLat / 2), 2) + Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2);
	const rad = 6371;
	const c = 2000 * Math.asin(Math.sqrt(a));
	return Math.round(rad * c);
};

const millisecondsToTimeString = milliseconds => {
	const hours = Math.floor(milliseconds / 3600000);
	const minutes = Math.floor((milliseconds / 60000) % 60);
	const seconds = Math.floor((milliseconds / 1000) % 60);
	return (hours === 0 ? minutes : hours + ":" + minutes.toString().padStart(2, "0")) + ":" + seconds.toString().padStart(2, "0");
};
