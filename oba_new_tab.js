const NAME = "Jonathan";
const TIMES = [5, 12, 18, 22];
const IMAGE_OPTIONS = ["landscape", "nature", "ocean", "sky", "space", "sunset"];

const DEFAULT_LOCATION = [47.649281, -122.358524];
const LOCATION_ACCURACY_THRESHOLD = 200;

const DOMAIN = "http://api.pugetsound.onebusaway.org";
const RADIUS = 1000;
const MAX_ARRIVALS = 5;
const REFRESH_INTERVAL = 10000;

function setup() {
	"use strict";

	class MainScreen extends React.Component {

		constructor(props) {
			super(props);
			this.state = {
				milliseconds: 0,
				time: "",
				greeting: "",
			};
			this.temperatureMessage = "";
			this.dataMessage = "";
			this.dataLastUpdated = new Date();
			this.locationMessage = "";
			this.accuracy = 0;
			this.latitude = 0;
			this.longitude = 0;
			this.imageTitle = "";
			this.imageAuthor = "";
			this.imageUrl = "";
			this.nearbyStops = [];
			this.arrivals = [];
			this.clock = this.clock.bind(this);
			this.getWeather = this.getWeather.bind(this);
			this.getNearbyStops = this.getNearbyStops.bind(this);
			this.getStop = this.getStop.bind(this);
		}

		componentDidMount() {
			this.clock();
			setInterval(this.clock, 1000);
			const id = navigator.geolocation.watchPosition((pos) => {
				const latitude = pos.coords.latitude;
				const longitude = pos.coords.longitude;
				this.getNearbyStops(latitude, longitude);
				this.getWeather(latitude, longitude);
				if (pos.coords.accuracy < LOCATION_ACCURACY_THRESHOLD) {
					navigator.geolocation.clearWatch(id);
					this.locationMessage = "Location watch stopped. ";
				} else {
					this.locationMessage = "Location last updated: " + getTimeNow(new Date());
				}
				this.accuracy = pos.coords.accuracy;
				this.latitude = latitude;
				this.longitude = longitude;
			}, (error) => {
				console.warn(`ERROR(${error.code}): ${error.message}`);
				const latitude = DEFAULT_LOCATION[0];
				const longitude = DEFAULT_LOCATION[1];
				this.getNearbyStops(latitude, longitude);
				this.getWeather(latitude, longitude);
			}, {enableHighAccuracy: true, timeout: REFRESH_INTERVAL, maximumAge: 0});
			this.generateImage();
			document.body.onscroll = setFooterOpacity;
		}

		clock() {
			const now = new Date();
			let greeting;
			if (now.getHours() >= TIMES[3] || now.getHours() < TIMES[0]) {
				greeting = "Go to sleep";
			} else if (now.getHours() < TIMES[1]) {
				greeting = "Good morning";
			} else if (now.getHours() < TIMES[2]) {
				greeting = "Good afternoon";
			} else if (now.getHours() < TIMES[3]) {
				greeting = "Good evening";
			}
			if (now.getTime() - this.dataLastUpdated >= REFRESH_INTERVAL) {
				this.getStop(0, []);
			}
			this.setState({milliseconds: now.getTime(), time: getTimeNowShort(now), greeting: greeting}, setFooterOpacity);
		}

		getWeather(latitude, longitude) {
			const url = `http://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${WEATHER_KEY}`;
			const request = new XMLHttpRequest();
			request.open("GET", url);
			request.onreadystatechange = () => {
				if (request.readyState === 4 && request.status === 200) {
					const parsed = JSON.parse(request.responseText);
					this.temperatureMessage = `It's ${Math.round(parsed["main"]["temp"] - 273.15)}°C in ${parsed.name}. Where would you like to go today?`;
				}
			};
			request.send();
		}

		generateImage() {
			document.body.style.backgroundColor = "rgba(0,0,0,1)";
			const request = new XMLHttpRequest();
			request.open("GET", `https://api.unsplash.com/photos/random/?client_id=${UNSPLASH_KEY}&w=3840&orientation=landscape&query=${IMAGE_OPTIONS[Math.floor(Math.random() * IMAGE_OPTIONS.length)]}`);
			request.onreadystatechange = () => {
				if (request.readyState === 4 && request.status === 200) {
					const parsed = JSON.parse(request.responseText);
					this.imageTitle = parsed["description"] == null ? "" : parsed["description"];
					this.imageAuthor = parsed["user"]["name"];
					this.imageUrl = parsed["user"]["links"]["html"];
					const image = new Image();
					image.onload = () => {
						document.documentElement.style.backgroundImage = `url(${image.src})`;
						document.body.style.backgroundColor = "rgba(0,0,0,0.3)";
					}
					image.src = parsed["urls"]["custom"];
				}
			};
			request.send();
		}

		getNearbyStops(latitude, longitude) {
			const url = `${DOMAIN}/api/where/stops-for-location.json?key=${OBA_KEY}&lat=${latitude}&lon=${longitude}&radius=${RADIUS}&&includeReferences=false`;
			const request = new XMLHttpRequest();
			request.open("GET", url);
			request.onreadystatechange = () => {
				if (request.readyState === 4 && request.status === 200) {
					const response = JSON.parse(request.responseText)["data"]["list"];
					response.forEach(stop => stop["distance"] = getDistance(stop["lat"], stop["lon"], latitude, longitude));
					response.sort((a, b) => a["distance"] - b["distance"]);
					this.nearbyStops = response;
					this.getStop(0, []);
				}
			};
			request.send();
		}

		getStop(index, list) {
			if (index < this.nearbyStops.length) {
				const url = `${DOMAIN}/api/where/arrivals-and-departures-for-stop/${this.nearbyStops[index]["id"]}.json?key=${OBA_KEY}&minutesBefore=0&minutesAfter=120&&includeReferences=false`;
				const request = new XMLHttpRequest();
				request.open("GET", url);
				request.onreadystatechange = () => {
					if (request.readyState === 4 && request.status === 200) {
						const arrivals = JSON.parse(request.responseText)["data"]["entry"]["arrivalsAndDepartures"];
						arrivals.length = Math.min(arrivals.length, MAX_ARRIVALS);
						arrivals.forEach(arrival => {
							if (!list.some(test => test["routeShortName"] === arrival["routeShortName"] && test["tripHeadsign"] === arrival["tripHeadsign"] && test["stopId"] !== arrival["stopId"])) {
								list.push({
									routeShortName: arrival["routeShortName"],
									tripHeadsign: arrival["tripHeadsign"],
									stopId: arrival["stopId"],
									vehicleId: arrival["vehicleId"],
									scheduledDepartureTime: arrival["scheduledDepartureTime"],
									predictedDepartureTime: arrival["predictedDepartureTime"]
								})
							}
						});
						this.getStop(index + 1, list);
					}
				};
				request.send();
			} else {
				const date = new Date();
				this.dataLastUpdated = date.getTime();
				this.dataMessage = "Data last updated: " + getTimeNow(date);
				this.arrivals = list;
			}
		}

		render() {
			return (
				<div>
					<div className="time_short">{this.state.time}</div>
					<div className="greeting">{this.state.greeting}, {NAME}.</div>
					<div className="subtitle" style={{opacity: this.temperatureMessage === "" ? 0 : 1}}>{this.temperatureMessage}</div>
					<br/>
					<br/>
					<table>
						<tbody>
						{this.nearbyStops.map(stop => <StopWithArrivals key={stop["id"]} milliseconds={this.state.milliseconds} stop={stop} arrivals={this.arrivals.filter(arrival => arrival["stopId"] === stop["id"])}/>)}
						</tbody>
					</table>
					<br/>
					<br/>
					<div id="footer">
						<div>{this.dataMessage}</div>
						<LocationMessage message={this.locationMessage} accuracy={this.accuracy} latitude={this.latitude} longitude={this.longitude}/>
						<UnsplashImage title={this.imageTitle} author={this.imageAuthor} url={this.imageUrl}/>
					</div>
				</div>
			);
		}
	}

	ReactDOM.render(<MainScreen/>, document.querySelector("#react-root"));
}

function StopWithArrivals(props) {
	const {milliseconds, stop, arrivals} = props;
	return arrivals.length === 0 ? null : (
		<>
			<tr>
				<th colSpan={5}>{stop["name"]} ({stop["direction"]}) | {stop["distance"]}m | {stop["id"]}</th>
			</tr>
			{[...Array(arrivals.length)].map((u, index) => {
				const arrival = arrivals[index];
				const arrivalTime = arrival["predictedDepartureTime"] === 0 ? arrival["scheduledDepartureTime"] : arrival["predictedDepartureTime"];
				const arrivalString = milliseconds > arrivalTime ? "Gone" : millisecondsToTimeString(arrivalTime - milliseconds);
				let deviationString = "";
				if (arrival["predictedDepartureTime"] !== 0) {
					const deviation = arrival["predictedDepartureTime"] - arrival["scheduledDepartureTime"];
					if (Math.abs(deviation) < 30000) {
						deviationString = "On time";
					} else {
						deviationString = millisecondsToTimeString(Math.abs(deviation)) + " " + (deviation > 0 ? "delay" : "early");
					}
				}
				return (
					<tr key={stop["id"] + "_" + index}>
						<td className="column_small">{arrival["routeShortName"]}</td>
						<td>{arrival["tripHeadsign"]}</td>
						<td className="column_small">{arrival["vehicleId"]}</td>
						<td className="column_small column_right">{deviationString}</td>
						<td className="column_small column_right">{arrivalString}</td>
					</tr>
				);
			})}
			<tr>
				<td>&nbsp;</td>
			</tr>
		</>
	);
}

function LocationMessage(props) {
	const {message, accuracy, latitude, longitude} = props;
	const url = `https://www.google.com.hk/maps/place/${Math.abs(latitude)}${latitude >= 0 ? "N" : "S"}+${Math.abs(longitude)}${longitude >= 0 ? "E" : "W"}`;
	return message === "" ? null : <div>{message} (<a href={url} target="_blank">Accuracy: {accuracy}m</a>)</div>;
}

function UnsplashImage(props) {
	const {title, author, url} = props;
	return author === "" || url === "" ? null : (
		<div>
			{title.length === 0 ? "Photo" : `"${title.charAt(0).toUpperCase() + title.substr(1)}"`} by&nbsp;
			<a href={`${url}?utm_source=jonathans_new_tab&utm_medium=referral`} target="_blank">{author}</a>
			&nbsp;on&nbsp;
			<a href="https://unsplash.com/?utm_source=jonathans_new_tab&utm_medium=referral" target="_blank">Unsplash</a>
		</div>
	);
}

function millisecondsToTimeString(milliseconds) {
	const hours = Math.floor(milliseconds / 3600000);
	const minutes = Math.floor((milliseconds / 60000) % 60);
	const seconds = Math.floor((milliseconds / 1000) % 60);
	return (hours === 0 ? minutes : hours + ":" + minutes.toString().padStart(2, "0")) + ":" + seconds.toString().padStart(2, "0");
}

function getTimeNow(now) {
	return now.getDate() + "/" + (now.getMonth() + 1) + "/" + now.getFullYear() + "\t" + getTimeNowShort(now) + ":" + now.getSeconds().toString().padStart(2, "0") + " " + (now.getHours() >= 12 ? "PM" : "AM");
}

function getTimeNowShort(now) {
	const hours = now.getHours();
	return ((hours % 12) + ((hours % 12) === 0 ? 12 : 0)) + ":" + now.getMinutes().toString().padStart(2, "0");
}

function getDistance(lat1, lon1, lat2, lon2) {
	const dLat = Math.PI * (lat2 - lat1) / 180.0;
	const dLon = Math.PI * (lon2 - lon1) / 180.0;
	lat1 = Math.PI * lat1 / 180.0;
	lat2 = Math.PI * lat2 / 180.0;
	const a = Math.pow(Math.sin(dLat / 2), 2) + Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2);
	const rad = 6371;
	const c = 2000 * Math.asin(Math.sqrt(a));
	return Math.round(rad * c);
}

function setFooterOpacity() {
	document.querySelector("#footer").style.opacity = document.body.clientHeight + document.body.scrollTop < document.body.scrollHeight - 1 ? "0" : "100";
}

setup();
