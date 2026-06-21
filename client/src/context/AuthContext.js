import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [locations, setLocations] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('washops_token');
      if (!token) {
        setLoading(false);
        return;
      }
      const { data } = await api.get('/auth/me');
      setUser(data);

      // Load locations
      const locRes = await api.get('/locations');
      setLocations(locRes.data);

      // Set default location
      const savedLoc = localStorage.getItem('washops_location');
      const found = locRes.data.find((l) => l.id === savedLoc);
      setCurrentLocation(found || locRes.data[0] || null);
    } catch (err) {
      localStorage.removeItem('washops_token');
      localStorage.removeItem('washops_refresh');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('washops_token', data.accessToken);
    localStorage.setItem('washops_refresh', data.refreshToken);
    setUser(data.user);
    setTenant(data.tenant);
    setLocations(data.locations.map((l) => ({ id: l.id, name: l.name })));
    if (data.locations.length > 0) {
      const loc = data.locations[0];
      setCurrentLocation(loc);
      localStorage.setItem('washops_location', loc.id);
    }
    return data;
  };

  const register = async (formData) => {
    const { data } = await api.post('/auth/register', formData);
    localStorage.setItem('washops_token', data.accessToken);
    localStorage.setItem('washops_refresh', data.refreshToken);
    setUser(data.user);
    setTenant(data.tenant);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('washops_token');
    localStorage.removeItem('washops_refresh');
    localStorage.removeItem('washops_location');
    setUser(null);
    setTenant(null);
    setLocations([]);
    setCurrentLocation(null);
  };

  const switchLocation = (location) => {
    setCurrentLocation(location);
    localStorage.setItem('washops_location', location.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        locations,
        currentLocation,
        loading,
        login,
        register,
        logout,
        switchLocation,
        loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
