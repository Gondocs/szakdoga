import axios from 'axios';
import { toast } from 'react-toastify';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    Accept: 'application/json',
  },
});

/**
 * A 401/403/422 hibákat a hívóhelyek egyedileg kezelik (pl. login hibaüzenet,
 * form validáció), ezért csak a váratlan (hálózati / szerver oldali) hibákra
 * jelenítünk meg globális toastot, hogy ne duplikálódjon a visszajelzés.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        toast.error('Nincs kapcsolat a szerverrel. Ellenőrizze az internetkapcsolatot.');
      } else if (error.response.status >= 500) {
        toast.error('Szerverhiba történt. Próbálja meg később újra.');
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Laravel Sanctum SPA session-autentikációhoz a bejelentkezés előtt le kell
 * kérni a CSRF sütit; ez állítja be az XSRF-TOKEN cookie-t, amit az axios
 * automatikusan visszaküld X-XSRF-TOKEN fejlécben (withXSRFToken).
 */
export async function ensureCsrfCookie(): Promise<void> {
  await apiClient.get('/sanctum/csrf-cookie');
}
