import type { AxiosInstance } from 'axios';

/**
 * Axios instance ga HTTP so'rov/javob loggerini ulash.
 *
 * @param instance — Axios instance
 * @param prefix — Log prefix (masalan: "FISCAL")
 */
export function attachHttpLogger(instance: AxiosInstance, prefix: string): void {
  instance.interceptors.request.use(
    (config) => {
      console.log(
        `[${prefix}] → ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
      );
      return config;
    },
    (error) => {
      console.error(`[${prefix}] → Request error:`, error.message);
      return Promise.reject(error);
    },
  );

  instance.interceptors.response.use(
    (response) => {
      console.log(
        `[${prefix}] ← ${response.status} ${response.config.url}`,
      );
      return response;
    },
    (error) => {
      if (error.response) {
        console.error(
          `[${prefix}] ← ${error.response.status} ${error.config?.url}`,
        );
      } else {
        console.error(`[${prefix}] ← Network error:`, error.message);
      }
      return Promise.reject(error);
    },
  );
}
