const setIcon = (tabId, iconUrl) => {
	chrome.scripting.executeScript({
		target: {tabId: tabId},
		func: iconUrl => {
			let link = document.querySelector("link[rel*='icon']");
			if (!link) {
				link = document.createElement("link");
				link.rel = "icon";
				document.getElementsByTagName("head")[0].appendChild(link);
			}
			link.href = iconUrl;
		},
		args: [iconUrl],
	});
};

const setMainImage = (tabId, mainImageFilter, mainImageUrl) => {
	chrome.scripting.executeScript({
		target: {tabId: tabId},
		func: (mainImageFilter, mainImageUrl) => {
			const mainImage = [...document.querySelectorAll("img")].find(element => element.src.includes(mainImageFilter));
			mainImage.src = mainImageUrl;
			mainImage.style = "";
			mainImage.removeAttribute("height");
			mainImage.removeAttribute("srcset");
		},
		args: [mainImageFilter, mainImageUrl],
	});
};

chrome.webNavigation.onCompleted.addListener(details => {
	const {tabId} = details;
	setIcon(tabId, "https://upload.wikimedia.org/wikipedia/commons/b/b0/Google_icon_%282010-2015%29.png");
	setMainImage(tabId, "branding/googlelogo", "https://upload.wikimedia.org/wikipedia/commons/4/4a/Logo_2013_Google.png");
	chrome.scripting.executeScript({
		target: {tabId: tabId},
		func: () => [...document.querySelectorAll("span")].filter(element => element.style.background.includes("images/nav_logo")).forEach(element => element.style.background = element.style.background.replace(/nav_logo\d+/g, "nav_logo225")),
	});
}, {url: [{hostContains: "www.google"}, {hostContains: "images.google"}]});

chrome.webNavigation.onCompleted.addListener(details => {
	const {tabId} = details;
	setIcon(tabId, "https://upload.wikimedia.org/wikipedia/commons/4/4e/Gmail_Icon.png");
	setMainImage(tabId, "logo_gmail", "https://upload.wikimedia.org/wikipedia/commons/archive/0/0a/20201023123348%21Gmail_logo.png");
}, {url: [{hostContains: "mail.google"}]});
