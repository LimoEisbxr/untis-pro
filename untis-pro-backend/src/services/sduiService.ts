import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { AppError } from '../server/errors.js';

// Base response structure from Sdui API
interface BaseResponseMeta {
    warnings: string[];
    errors: string[];
    success: string[];
}

interface BaseResponse<T> {
    data: T;
    status: string;
    meta: BaseResponseMeta;
}

// News types based on the API documentation
export interface SduiNews {
    id: number;
    title: string;
    content: string;
    author?: string;
    createdAt: string;
    updatedAt: string;
    attachments?: SduiAttachment[];
    // Add other news properties as needed
}

export interface SduiAttachment {
    id: number;
    name: string;
    type: string;
    url: string;
    size?: number;
}

export interface LoginResponse {
    token: string;
    // Add other login response properties as needed
}

export class SduiApiClient {
    private instance: AxiosInstance;
    private token: string | null = null;

    constructor() {
        this.instance = axios.create({
            baseURL: 'https://api.sdui.app/v1',
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'UntisProApp/1.0',
            },
        });
    }

    public setToken(token: string): void {
        this.token = token;
        this.instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    public async login({
        slink,
        identifier,
        password,
    }: {
        slink: string;
        identifier: string;
        password: string;
    }): Promise<AxiosResponse<BaseResponse<LoginResponse>>> {
        try {
            const response = await this.instance.post('/auth/login', {
                slink,
                identifier,
                password,
            });
            
            if (response.data?.data?.token) {
                this.setToken(response.data.data.token);
            }
            
            return response;
        } catch (error: any) {
            console.error('Sdui login error:', error.response?.data || error.message);
            throw new AppError(
                'Sdui login failed',
                error.response?.status || 500,
                'SDUI_LOGIN_FAILED'
            );
        }
    }

    public async getNewsByPage({
        page,
    }: {
        page: number;
    }): Promise<AxiosResponse<BaseResponse<SduiNews[]>>> {
        if (!this.token) {
            throw new AppError('No Sdui token available', 401, 'NO_SDUI_TOKEN');
        }

        try {
            const response = await this.instance.get('/news', {
                params: { page },
            });
            return response;
        } catch (error: any) {
            console.error('Sdui get news error:', error.response?.data || error.message);
            throw new AppError(
                'Failed to fetch Sdui news',
                error.response?.status || 500,
                'SDUI_NEWS_FAILED'
            );
        }
    }

    public async getNewsById({
        newsId,
    }: {
        newsId: number;
    }): Promise<AxiosResponse<BaseResponse<SduiNews>>> {
        if (!this.token) {
            throw new AppError('No Sdui token available', 401, 'NO_SDUI_TOKEN');
        }

        try {
            const response = await this.instance.get(`/news/${newsId}`);
            return response;
        } catch (error: any) {
            console.error('Sdui get news by id error:', error.response?.data || error.message);
            throw new AppError(
                'Failed to fetch Sdui news item',
                error.response?.status || 500,
                'SDUI_NEWS_ITEM_FAILED'
            );
        }
    }
}

// Cache for Sdui clients per user
const sduiClients = new Map<string, SduiApiClient>();

export function getSduiClient(userId: string): SduiApiClient {
    if (!sduiClients.has(userId)) {
        sduiClients.set(userId, new SduiApiClient());
    }
    return sduiClients.get(userId)!;
}

export function clearSduiClient(userId: string): void {
    sduiClients.delete(userId);
}