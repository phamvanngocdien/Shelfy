import axios from 'axios';
import toast from 'react-hot-toast';
import axiosRetry from 'axios-retry';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

axiosRetry(api, { 
  retries: 3, 
  retryDelay: axiosRetry.exponentialDelay, 
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response?.status ?? 0) >= 500;
  }
});

// Use react-hot-toast directly (not the useToast hook)
// because Axios interceptors run outside React component lifecycle,
// and calling hooks outside components violates the Rules of Hooks.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 429) {
        toast.error('Too many requests. Please try again later.');
      } else if (status === 403) {
        toast.error('You are not authorized to perform this action.');
      } else if (status === 500) {
        toast.error('Server error. Please try again later.');
      } else {
        toast.error(data?.error || 'An error occurred.');
      }
    } else if (error.request) {
      toast.error('Network error. Please check your connection.');
    } else {
      toast.error('An unexpected error occurred.');
    }
    return Promise.reject(error);
  }
);

export default api;