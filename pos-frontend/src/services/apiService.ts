import { API_BASE_URL } from '../constants';

export const apiService = {
  request: async (endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', data?: any) => {
    const token = sessionStorage.getItem('token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) { headers['Authorization'] = `Bearer ${token}`; }
    const config: RequestInit = { method, headers, body: data ? JSON.stringify(data) : undefined, };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    if (response.status === 401) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        window.location.reload();
    }
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    if (response.status === 202) {
        return response.json();
    }
    return response.status === 204 ? null : response.json();
  },
  get: (endpoint: string) => apiService.request(endpoint, 'GET'),
  post: (endpoint: string, data: any) => apiService.request(endpoint, 'POST', data),
  put: (endpoint: string, data: any) => apiService.request(endpoint, 'PUT', data),
  delete: (endpoint: string) => apiService.request(endpoint, 'DELETE'),
  patch: (endpoint: string, data?: any) => apiService.request(endpoint, 'PATCH', data),
};
