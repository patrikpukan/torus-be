import { Injectable } from '@nestjs/common';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

type GetParameters = Parameters<typeof axios.get>;
type PostParameters = Parameters<typeof axios.post>;
type PutParamenters = Parameters<typeof axios.put>;

/**
 * You can use this class to make HTTP requests to the backend.
 * It is a wrapper around the axios library.
 *
 * Import the HttpModule in the @Module where you want to use this and then you can inject this HttpClient in your services.
 *
 * It's here only for your convenience, you can write your own/use whatever you'd prefer. It's generally a good idea to have wrappers for these things.
 * so that you don't have to rewrite every usage across the codebase if you e.g. decide to replace axios with something else.
 */
@Injectable()
export class HttpClient {
  readonly #instance = axios.create();

  get<T>(...args: GetParameters): Promise<AxiosResponse<T>> {
    return this.#instance.get<T>(...args);
  }

  post<T>(...args: PostParameters): Promise<AxiosResponse<T>> {
    return this.#instance.post<T>(...args);
  }

  put<T>(...args: PutParamenters): Promise<AxiosResponse<T>> {
    return this.#instance.put<T>(...args);
  }

  formPost<T>(
    url: string,
    data: Record<string, string>,
    config: AxiosRequestConfig = {},
  ): Promise<AxiosResponse<T>> {
    const requestData = new URLSearchParams();

    for (const [key, value] of Object.entries(data)) {
      requestData.append(key, value);
    }

    const requestConfig = {
      ...config,
      headers: {
        ...config.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    return this.#instance.post<T>(url, requestData, requestConfig);
  }
}
