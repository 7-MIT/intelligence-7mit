// Proxy OpenWeather: API key disimpan sebagai secret server (OPENWEATHER_API_KEY), tidak pernah dikirim ke browser.
const ENDPOINTS = { weather: 'weather', forecast: 'forecast' };

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const type = ENDPOINTS[url.searchParams.get('type')];
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  if (!type || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return new Response('Bad request', { status: 400 });
  }
  if (!env.OPENWEATHER_API_KEY) return new Response('Not configured', { status: 503 });

  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'id';
  const upstream = new URL(`https://api.openweathermap.org/data/2.5/${type}`);
  upstream.search = new URLSearchParams({ lat, lon, units: 'metric', lang, appid: env.OPENWEATHER_API_KEY });

  const res = await fetch(upstream, { cf: { cacheTtl: 600, cacheEverything: true } });
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=600' }
  });
}
