import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';
import flowerPng from '../assets/flower.png';

interface LoginFormData {
  username: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: ''
  });
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Basic validation
    if (!formData.username || !formData.password) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    try {
      // Try proxy first, fallback to direct URL if proxy fails
      let response;
      try {
        response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: formData.username.trim(),
            password: formData.password
          })
        });
      } catch (proxyError) {
        // Fallback to direct backend URL if proxy fails
        response = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: formData.username.trim(),
            password: formData.password
          })
        });
      }

      // Check if response is HTML (error page) instead of JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server is not responding properly. Please check if the backend server is running.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Login failed');
      }

      // Store authentication data
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('authToken', data.data.token);
      localStorage.setItem('userRole', data.data.coordinator.role || 'coordinator');
      localStorage.setItem('username', data.data.coordinator.username);
      localStorage.setItem('coordinatorData', JSON.stringify(data.data.coordinator));
      
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.message.includes('fetch')) {
        setError('Unable to connect to server. Please check your internet connection or contact support.');
      } else if (err.message.includes('DOCTYPE')) {
        setError('Server configuration error. Please contact support.');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <video autoPlay loop muted playsInline className="background-video">
        <source src={require('../assets/entry.mp4')} type="video/mp4" />
      </video>
      <img src={flowerPng} alt="Decorative flower" className="rotating-flower rotating-flower-1" />
      <img src={flowerPng} alt="Decorative flower" className="rotating-flower rotating-flower-2" />
      <img src={flowerPng} alt="Decorative flower" className="rotating-flower rotating-flower-3" />
      <div className="login-card">
        <div className="login-header">
          <h2>Coordinator Login</h2>
          <p>Sign in to access your dashboard</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Enter your username"
              disabled={isLoading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              disabled={isLoading}
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <p>For coordinator access only</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
