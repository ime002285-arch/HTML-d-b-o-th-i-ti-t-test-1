const DOM = {
    searchBar: document.getElementById('search-input'),
    searchResults: document.getElementById('search-results'),
    locationBtn: document.getElementById('location-btn'),
    cityName: document.getElementById('city-name'),
    currentDate: document.getElementById('current-date'),
    currentTemp: document.getElementById('current-temp'),
    weatherDesc: document.getElementById('weather-desc'),
    mainIcon: document.getElementById('main-icon'),
    windSpeed: document.getElementById('wind-speed'),
    humidity: document.getElementById('humidity'),
    visibility: document.getElementById('visibility'),
    hourlyContainer: document.getElementById('hourly-container'),
    dailyContainer: document.getElementById('daily-container'),
    loading: document.getElementById('loading'),
    content: document.getElementById('weather-content'),
    errorMsg: document.getElementById('error-message'),
    errorText: document.getElementById('error-text'),
    retryBtn: document.getElementById('retry-btn'),
    viewAllBtn: document.querySelector('.view-all'),
    closeDailyBtn: document.getElementById('close-daily'),
    dailyForecastSec: document.getElementById('daily-forecast')
};

// Weather codes mapping to Phosphor Icons and themes
const weatherMapping = {
    0: { desc: 'Trời quang', icon: 'ph-sun', theme: 'clear-day' },
    1: { desc: 'Ít mây', icon: 'ph-cloud-sun', theme: 'clear-day' },
    2: { desc: 'Nhiều mây', icon: 'ph-cloud', theme: 'cloudy' },
    3: { desc: 'Âm u', icon: 'ph-cloud-fog', theme: 'cloudy' },
    45: { desc: 'Sương mù', icon: 'ph-cloud-fog', theme: 'cloudy' },
    48: { desc: 'Sương mù lạnh', icon: 'ph-cloud-fog', theme: 'cloudy' },
    51: { desc: 'Mưa phùn nhẹ', icon: 'ph-cloud-drizzle', theme: 'rainy' },
    53: { desc: 'Mưa phùn', icon: 'ph-cloud-drizzle', theme: 'rainy' },
    55: { desc: 'Mưa phùn dày', icon: 'ph-cloud-drizzle', theme: 'rainy' },
    61: { desc: 'Mưa nhỏ', icon: 'ph-cloud-rain', theme: 'rainy' },
    63: { desc: 'Mưa vừa', icon: 'ph-cloud-rain', theme: 'rainy' },
    65: { desc: 'Mưa to', icon: 'ph-cloud-rain', theme: 'rainy' },
    71: { desc: 'Tuyết rơi nhẹ', icon: 'ph-cloud-snow', theme: 'cloudy' },
    73: { desc: 'Tuyết rơi', icon: 'ph-cloud-snow', theme: 'cloudy' },
    75: { desc: 'Tuyết rơi dày', icon: 'ph-cloud-snow', theme: 'cloudy' },
    95: { desc: 'Sấm chớp', icon: 'ph-cloud-lightning', theme: 'rainy' },
    96: { desc: 'Giông bão nhẹ', icon: 'ph-cloud-lightning', theme: 'rainy' },
    99: { desc: 'Giông bão dữ dội', icon: 'ph-cloud-lightning', theme: 'rainy' }
};

const defaultMapping = { desc: 'Không xác định', icon: 'ph-cloud-warning', theme: 'cloudy' };

let currentCoords = { lat: 21.0285, lon: 105.8542 }; // Hanoi default
let debounceTimer;

// Init app
function init() {
    setupEventListeners();
    fetchWeatherByCoords(currentCoords.lat, currentCoords.lon, "Hà Nội");
}

function setupEventListeners() {
    DOM.searchBar.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        if (query.length < 2) {
            DOM.searchResults.classList.add('hidden');
            return;
        }
        debounceTimer = setTimeout(() => searchLocation(query), 500);
    });

    document.addEventListener('click', (e) => {
        if (!DOM.searchBar.contains(e.target) && !DOM.searchResults.contains(e.target)) {
            DOM.searchResults.classList.add('hidden');
        }
    });

    DOM.locationBtn.addEventListener('click', getUserLocation);
    DOM.retryBtn.addEventListener('click', () => fetchWeatherByCoords(currentCoords.lat, currentCoords.lon, DOM.cityName.textContent));

    DOM.viewAllBtn.addEventListener('click', (e) => {
        e.preventDefault();
        DOM.dailyForecastSec.classList.remove('hidden');
    });

    DOM.closeDailyBtn.addEventListener('click', () => {
        DOM.dailyForecastSec.classList.add('hidden');
    });
}

function getUserLocation() {
    if (!navigator.geolocation) {
        showError("Trình duyệt không hỗ trợ định vị GPS.");
        return;
    }

    showLoading();
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            reverseGeocode(lat, lon);
        },
        () => {
            showError("Bạn đã từ chối quyền truy cập vị trí.");
        }
    );
}

// Fetch APIs
async function searchLocation(query) {
    try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=vi&format=json`);
        const data = await res.json();
        
        DOM.searchResults.innerHTML = '';
        if (data.results && data.results.length > 0) {
            data.results.forEach(city => {
                const li = document.createElement('li');
                li.textContent = `${city.name}, ${city.country}`;
                li.addEventListener('click', () => {
                    DOM.searchBar.value = '';
                    DOM.searchResults.classList.add('hidden');
                    fetchWeatherByCoords(city.latitude, city.longitude, city.name);
                });
                DOM.searchResults.appendChild(li);
            });
            DOM.searchResults.classList.remove('hidden');
        } else {
            DOM.searchResults.classList.add('hidden');
        }
    } catch (error) {
        console.error("Search error:", error);
    }
}

async function reverseGeocode(lat, lon) {
    try {
        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=vi`);
        const data = await res.json();
        const city = data.city || data.locality || "Vị trí của bạn";
        fetchWeatherByCoords(lat, lon, city);
    } catch (e) {
        fetchWeatherByCoords(lat, lon, "Vị trí hiện tại");
    }
}

async function fetchWeatherByCoords(lat, lon, name) {
    currentCoords = { lat, lon };
    showLoading();

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
        const res = await fetch(url);
        
        if (!res.ok) throw new Error("API response error");
        
        const data = await res.json();
        updateUI(data, name);
    } catch (error) {
        console.error(error);
        showError("Lỗi kết nối khi lấy dữ liệu thời tiết.");
    }
}

function updateUI(data, name) {
    DOM.loading.classList.add('hidden');
    DOM.errorMsg.classList.add('hidden');
    DOM.content.classList.remove('hidden');

    DOM.cityName.textContent = name;
    
    // Format Date
    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    DOM.currentDate.textContent = now.toLocaleDateString('vi-VN', options);

    // Current weather
    const current = data.current;
    const code = current.weather_code;
    const weatherInfo = weatherMapping[code] || defaultMapping;
    
    // Check if night
    const isNight = now.getHours() < 6 || now.getHours() > 18;
    let theme = weatherInfo.theme;
    if (theme === 'clear-day' && isNight) theme = 'clear-night';
    if (code === 0 && isNight) weatherInfo.icon = 'ph-moon';
    if (code === 1 && isNight) weatherInfo.icon = 'ph-cloud-moon';
    
    document.body.className = theme; // background
    
    DOM.mainIcon.className = `ph-fill ${weatherInfo.icon}`;
    DOM.currentTemp.textContent = `${Math.round(current.temperature_2m)}°`;
    DOM.weatherDesc.textContent = weatherInfo.desc;
    
    // Details
    DOM.windSpeed.textContent = `${current.wind_speed_10m} km/h`;
    DOM.humidity.textContent = `${current.relative_humidity_2m}%`;
    DOM.visibility.textContent = `N/A`; // Open-Meteo doesn't provide visibility easily in simple current api, hardcode or remove
    DOM.visibility.closest('.detail-item').style.display = 'none'; // hide it

    // Hourly (next 12 hours)
    const currentHourIndex = data.hourly.time.findIndex(t => new Date(t).getHours() === now.getHours() && new Date(t).getDate() === now.getDate());
    DOM.hourlyContainer.innerHTML = '';
    
    let startIndex = currentHourIndex !== -1 ? currentHourIndex : 0;
    
    for (let i = startIndex; i < startIndex + 12; i++) {
        if (!data.hourly.time[i]) break; // prevent out of bounds
        
        const hourTime = new Date(data.hourly.time[i]);
        const hourCode = data.hourly.weather_code[i];
        const hourTemp = Math.round(data.hourly.temperature_2m[i]);
        
        let hIcon = (weatherMapping[hourCode] || defaultMapping).icon;
        let pLabel = i === startIndex ? "Bây giờ" : `${hourTime.getHours()}:00`;
        
        const div = document.createElement('div');
        div.className = 'hourly-item';
        div.innerHTML = `
            <span class="time">${pLabel}</span>
            <i class="ph-fill ${hIcon}"></i>
            <span class="temp">${hourTemp}°</span>
        `;
        DOM.hourlyContainer.appendChild(div);
    }

    // Daily Forecast
    DOM.dailyContainer.innerHTML = '';
    for (let i = 0; i < data.daily.time.length; i++) {
        const dayDate = new Date(data.daily.time[i]);
        const dayCode = data.daily.weather_code[i];
        const dayMax = Math.round(data.daily.temperature_2m_max[i]);
        const dayMin = Math.round(data.daily.temperature_2m_min[i]);
        
        let dayName = i === 0 ? "Hôm nay" : dayDate.toLocaleDateString('vi-VN', { weekday: 'short' });
        let dIcon = (weatherMapping[dayCode] || defaultMapping).icon;

        const div = document.createElement('div');
        div.className = 'daily-item';
        div.innerHTML = `
            <span class="day-name">${dayName}</span>
            <i class="ph-fill ${dIcon} day-icon"></i>
            <div class="day-temp">
                <span class="max">${dayMax}°</span>
                <span class="min">${dayMin}°</span>
            </div>
        `;
        DOM.dailyContainer.appendChild(div);
    }
}

function showLoading() {
    DOM.content.classList.add('hidden');
    DOM.errorMsg.classList.add('hidden');
    DOM.loading.classList.remove('hidden');
}

function showError(msg) {
    DOM.loading.classList.add('hidden');
    DOM.content.classList.add('hidden');
    DOM.errorMsg.classList.remove('hidden');
    DOM.errorText.textContent = msg;
}

// Start
document.addEventListener('DOMContentLoaded', init);
