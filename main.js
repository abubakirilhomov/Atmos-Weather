// 1. ВСТАВЬ СЮДА СВОЙ API KEY
const API_KEY = "ae9f7564f99f7a14a20c6ac15cf62301";

const $ = (id) => document.getElementById(id);
let hourlySwiper = null;
let requestNumber = 0;

$("year").textContent = new Date().getFullYear();

// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
function setStatus(message, error = false) {
    $("status").textContent = message;
    $("status").className = error
        ? "text-red-300 text-sm mb-5 min-h-5"
        : "muted text-sm mb-5 min-h-5";
}

function localTime(timestamp, timezone, options = {}) {
    return new Date((timestamp + timezone) * 1000)
        .toLocaleString("ru-RU", {
            ...options,
            timeZone: "UTC"
        });
}

function clock(timestamp, timezone) {
    return localTime(timestamp, timezone, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
}

function weatherImage(icon) {
    return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}

function iconFor(code) {
    if (code >= 200 && code < 300) return "cloud-lightning";
    if (code >= 300 && code < 600) return "cloud-rain";
    if (code >= 600 && code < 700) return "snowflake";
    if (code >= 700 && code < 800) return "cloud-fog";
    if (code === 800) return "sun";
    return "cloud";
}

// 3. АВТОМАТИЧЕСКАЯ СМЕНА АТМОСФЕРЫ
function setAtmosphere(weather, timezone) {
    const body = document.body;
    body.classList.remove("sunny", "cloudy", "rainy", "snowy", "night");

    const isNight = weather.icon && weather.icon.endsWith("n");

    if (isNight) {
        body.classList.add("night");
    } else if (weather.id >= 200 && weather.id < 600) {
        body.classList.add("rainy");
    } else if (weather.id >= 600 && weather.id < 700) {
        body.classList.add("snowy");
    } else if (weather.id === 800) {
        body.classList.add("sunny");
    } else {
        body.classList.add("cloudy");
    }
}

// 4. ЗАПРОС К OPENWEATHERMAP
async function getJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("API-ключ недействителен или ещё не активирован.");
        }
        if (response.status === 404) {
            throw new Error("Город не найден. Проверь название.");
        }
        if (response.status === 429) {
            throw new Error("Слишком много запросов. Попробуй чуть позже.");
        }
        throw new Error("Не удалось загрузить погоду. Попробуй ещё раз.");
    }
    return response.json();
}

// 5. ПОИСК ГОРОДА ЧЕРЕЗ GEOCODING API
async function searchCity(city) {
    const url = new URL("https://api.openweathermap.org/geo/1.0/direct");
    url.search = new URLSearchParams({
        q: city,
        limit: "1",
        appid: API_KEY
    });
    const places = await getJSON(url);
    if (!places.length) {
        throw new Error("Город не найден. Попробуй другое название.");
    }
    return places[0];
}

// 6. ПОГОДА ПО КООРДИНАТАМ
async function loadWeather(lat, lon, place = null) {
    if (!API_KEY || API_KEY === "YOUR_OPENWEATHERMAP_API_KEY") {
        setStatus("Сначала вставь свой OpenWeatherMap API-ключ в код.", true);
        return;
    }

    const thisRequest = ++requestNumber;
    setStatus("Получаем актуальные данные...");

    try {
        const params = new URLSearchParams({
            lat,
            lon,
            appid: API_KEY,
            units: "metric",
            lang: "ru"
        });

        const [current, forecast] = await Promise.all([
            getJSON(`https://api.openweathermap.org/data/2.5/weather?${params}`),
            getJSON(`https://api.openweathermap.org/data/2.5/forecast?${params}`)
        ]);

        // Не позволяем старому запросу перезаписать более новый
        if (thisRequest !== requestNumber) return;

        renderCurrent(current, place);
        renderHourly(forecast);
        renderDaily(forecast);
        setAtmosphere(current.weather[0], current.timezone);

        localStorage.setItem("atmos-last-place", JSON.stringify({
            lat,
            lon,
            name: current.name,
            country: current.sys.country
        }));

        setStatus("Данные обновлены");
        animateWeather();
    } catch (error) {
        if (thisRequest !== requestNumber) return;
        setStatus(error.message || "Произошла ошибка.", true);
    }
}

// 7. ТЕКУЩАЯ ПОГОДА
function renderCurrent(data, place) {
    const weather = data.weather[0];
    const time = Date.now() / 1000 + data.timezone;
    const date = new Date(time * 1000);

    $("cityName").textContent = place?.name || data.name;
    $("countryName").textContent =
        place?.country || data.sys.country || "";

    $("todayLabel").textContent = date.toLocaleDateString("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC"
    });

    $("temperature").textContent = Math.round(data.main.temp);
    $("description").textContent = weather.description;
    $("feelsLike").textContent = Math.round(data.main.feels_like);
    $("humidity").textContent = data.main.humidity + "%";
    $("wind").textContent = data.wind.speed;
    $("pressure").textContent = data.main.pressure;
    $("visibility").textContent =
        data.visibility != null
            ? (data.visibility / 1000).toFixed(1)
            : "—";

    $("sunrise").textContent = clock(data.sys.sunrise, data.timezone);
    $("sunset").textContent = clock(data.sys.sunset, data.timezone);

    $("weatherBadge").textContent = weather.description;
    $("mainIcon").src = weatherImage(weather.icon);
    $("mainIcon").alt = weather.description;
}

// 8. ПРОГНОЗ ПО ЧАСАМ (API ОТДАЁТ ДАННЫЕ КАЖДЫЕ 3 ЧАСА)
function renderHourly(data) {
    const items = data.list.slice(0, 12);

    $("hourlyList").innerHTML = items.map((item, index) => {
        const date = new Date(item.dt * 1000);
        const time = date.toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
            hour12: false
        });

        const label = index === 0 ? "Сейчас" : time;
        const weather = item.weather[0];

        return `
      <div class="swiper-slide">
        <article class="hour-card glass-light rounded-2xl p-3 sm:p-4 text-center h-full">
          <p class="muted text-xs">${label}</p>
          <img class="hour-icon mx-auto my-2"
            src="${weatherImage(weather.icon)}"
            alt="${weather.description}"
            loading="lazy">
          <p class="text-xl font-semibold">${Math.round(item.main.temp)}°</p>
          <p class="muted text-xs mt-2">${Math.round(item.pop * 100)}% дождя</p>
        </article>
      </div>`;
    }).join("");

    if (hourlySwiper) hourlySwiper.destroy(true, true);

    hourlySwiper = new Swiper("#hourlySwiper", {
        slidesPerView: 2.5,
        spaceBetween: 10,
        grabCursor: true,
        breakpoints: {
            480: { slidesPerView: 3.5, spaceBetween: 12 },
            640: { slidesPerView: 4.5, spaceBetween: 14 },
            900: { slidesPerView: 6, spaceBetween: 14 },
            1100: { slidesPerView: 7, spaceBetween: 16 }
        }
    });

    $("prevHour").onclick = () => hourlySwiper?.slidePrev();
    $("nextHour").onclick = () => hourlySwiper?.slideNext();
}

// 9. ПРОГНОЗ НА 5 ДНЕЙ: ГРУППИРУЕМ 3-ЧАСОВЫЕ ЗАПИСИ
function renderDaily(data) {
    const days = {};

    data.list.forEach(item => {
        const date = item.dt_txt.split(" ")[0];
        if (!days[date]) days[date] = [];
        days[date].push(item);
    });

    $("dailyList").innerHTML = Object.entries(days)
        .slice(0, 5)
        .map(([date, items], index) => {
            const temps = items.map(item => item.main.temp);
            const midday = items.find(item => item.dt_txt.includes("12:00:00"))
                || items[Math.floor(items.length / 2)];
            const weather = midday.weather[0];

            const label = index === 0
                ? "Сегодня"
                : new Date(date + "T12:00:00Z").toLocaleDateString("ru-RU", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC"
                });

            return `
        <div class="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1">
          <div class="w-24 sm:w-32 shrink-0">
            <p class="font-medium capitalize">${label}</p>
          </div>
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <img src="${weatherImage(weather.icon)}"
              class="w-11 h-11 object-contain"
              alt="${weather.description}" loading="lazy">
            <span class="muted text-xs sm:text-sm capitalize truncate">${weather.description}</span>
          </div>
          <div class="flex gap-3 sm:gap-5 text-right shrink-0">
            <span class="font-semibold">${Math.round(Math.max(...temps))}°</span>
            <span class="muted">${Math.round(Math.min(...temps))}°</span>
          </div>
        </div>`;
        }).join("");
}

// 10. АНИМАЦИЯ ПОЯВЛЕНИЯ
function animateWeather() {
    if (!window.gsap ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    gsap.fromTo(
        "#weatherPanel > article",
        { y: 14, opacity: 0.5 },
        { y: 0, opacity: 1, duration: 0.65, stagger: 0.12, ease: "power2.out" }
    );

    gsap.fromTo(
        "#hourlyList .swiper-slide",
        { y: 8, opacity: 0.4 },
        { y: 0, opacity: 1, duration: 0.35, stagger: 0.025, ease: "power2.out" }
    );
}

// 11. ПОИСК ПО НАЗВАНИЮ
$("searchForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const city = $("cityInput").value.trim();

    if (!city) {
        setStatus("Введи название города.", true);
        return;
    }

    if (!API_KEY || API_KEY === "YOUR_OPENWEATHERMAP_API_KEY") {
        setStatus("Сначала добавь API-ключ в код.", true);
        return;
    }

    setStatus("Ищем город...");

    try {
        const place = await searchCity(city);
        await loadWeather(place.lat, place.lon, place);
    } catch (error) {
        setStatus(error.message, true);
    }
});

// 12. ГЕОЛОКАЦИЯ БРАУЗЕРА
$("locationBtn").addEventListener("click", () => {
    if (!navigator.geolocation) {
        setStatus("Этот браузер не поддерживает геолокацию.", true);
        return;
    }

    setStatus("Определяем твоё местоположение...");

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            await loadWeather(latitude, longitude);
        },
        (error) => {
            const messages = {
                1: "Ты запретил доступ к местоположению.",
                2: "Не удалось определить местоположение.",
                3: "Время ожидания геолокации истекло."
            };
            setStatus(messages[error.code] || "Ошибка геолокации.", true);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
});

// 13. СТАРТ: ПОСЛЕДНИЙ ГОРОД ИЛИ ТАШКЕНТ
async function startApp() {
    if (!API_KEY || API_KEY === "YOUR_OPENWEATHERMAP_API_KEY") {
        setStatus("Добавь API-ключ в код, чтобы включить погоду.", true);
        return;
    }

    try {
        const saved = JSON.parse(localStorage.getItem("atmos-last-place"));
        if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) {
            await loadWeather(saved.lat, saved.lon, saved);
            return;
        }
    } catch (error) {
        localStorage.removeItem("atmos-last-place");
    }

    try {
        const tashkent = await searchCity("Tashkent, Uzbekistan");
        await loadWeather(tashkent.lat, tashkent.lon, tashkent);
    } catch (error) {
        setStatus(error.message, true);
    }
}

// Инициализация Lucide
if (window.lucide) lucide.createIcons();

startApp();