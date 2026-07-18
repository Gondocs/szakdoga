import Echo from 'laravel-echo';
import Pusher, { type ChannelAuthorizerGenerator } from 'pusher-js';
import { apiClient } from './api/client';

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

// A pusher-js csomagnak globálisan elérhetőnek kell lennie (a laravel-echo
// belül erre a window.Pusher-re támaszkodik Reverb broadcaster módban).
window.Pusher = Pusher;

let echoInstance: Echo<'reverb'> | null = null;

/**
 * A privát csatornák (event.{id}.updates) jogosultság-ellenőrzése a
 * meglévő Sanctum SPA session-nel történik: a pusher-js saját, cookie
 * nélküli XHR-je helyett a projekt axios-klienesét (apiClient) használjuk,
 * hogy a session-süti és az X-XSRF-TOKEN fejléc is menjen a
 * /broadcasting/auth kéréshez.
 */
function getEcho(): Echo<'reverb'> {
  if (!echoInstance) {
    echoInstance = new Echo({
      broadcaster: 'reverb',
      key: import.meta.env.VITE_REVERB_APP_KEY,
      wsHost: import.meta.env.VITE_REVERB_HOST,
      wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
      wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
      forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
      enabledTransports: ['ws', 'wss'],
      authorizer: ((channel) => ({
        authorize(socketId, callback) {
          apiClient
            .post('/broadcasting/auth', { socket_id: socketId, channel_name: channel.name })
            .then((response) => callback(null, response.data))
            .catch((error) => callback(error, null));
        },
      })) satisfies ChannelAuthorizerGenerator,
    });
  }

  return echoInstance;
}

/**
 * Csak bejelentkezett felhasználónak van értelme WebSocket-kapcsolatot
 * nyitni (a csatorna-jogosultság is a bejelentkezéshez kötött), ezért az
 * AuthContext hívja meg login után, nem fut le automatikusan importáláskor.
 */
export function connectEcho(): Echo<'reverb'> {
  return getEcho();
}

export function disconnectEcho(): void {
  echoInstance?.disconnect();
  echoInstance = null;
}
