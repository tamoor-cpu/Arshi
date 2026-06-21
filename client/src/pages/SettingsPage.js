import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { Settings, MapPin, Building2, Save, Plus, CheckCircle2, Moon, Sun, Monitor, Palette } from 'lucide-react';

export default function SettingsPage() {
  const { currentLocation, user, locations, loadUser } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const [locationForm, setLocationForm] = useState({
    name: '', address: '', city: '', state: '', zipCode: '',
    latitude: '', longitude: '', geofenceRadius: 150,
  });
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: '', address: '', city: '', state: '', zipCode: '',
    latitude: '', longitude: '', geofenceRadius: 150,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (currentLocation) {
      setLocationForm({
        name: currentLocation.name || '',
        address: currentLocation.address || '',
        city: currentLocation.city || '',
        state: currentLocation.state || '',
        zipCode: currentLocation.zipCode || '',
        latitude: currentLocation.latitude || '',
        longitude: currentLocation.longitude || '',
        geofenceRadius: currentLocation.geofenceRadius || 150,
      });
    }
  }, [currentLocation]);

  const saveLocation = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/locations/${currentLocation.id}`, locationForm);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const createLocation = async (e) => {
    e.preventDefault();
    try {
      await api.post('/locations', newLocation);
      setShowNewLocation(false);
      setNewLocation({ name: '', address: '', city: '', state: '', zipCode: '', latitude: '', longitude: '', geofenceRadius: 150 });
      loadUser();
    } catch (err) {
      console.error('Create location error:', err);
    }
  };

  const isAdmin = ['SUPER_ADMIN', 'REGIONAL_ADMIN'].includes(user?.role);

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your location and account settings</p>
      </div>

      {/* Appearance Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <Palette className="w-5 h-5 text-purple-600" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Appearance</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {darkMode ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-yellow-500" />}
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Switch between light and dark themes</p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                darkMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  darkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => { if (darkMode) toggleDarkMode(); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                !darkMode
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-600 dark:text-gray-400'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span className="text-sm font-medium">Light</span>
            </button>
            <button
              onClick={() => { if (!darkMode) toggleDarkMode(); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                darkMode
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-600 dark:text-gray-400'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span className="text-sm font-medium">Dark</span>
            </button>
          </div>
        </div>
      </div>

      {/* Current Location Settings */}
      {currentLocation && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Location Settings</h2>
            {saved && (
              <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>
          <form onSubmit={saveLocation} className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location Name</label>
                <input type="text" value={locationForm.name} onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                <input type="text" value={locationForm.address} onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                <input type="text" value={locationForm.city} onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
                  <input type="text" value={locationForm.state} onChange={(e) => setLocationForm({ ...locationForm, state: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zip</label>
                  <input type="text" value={locationForm.zipCode} onChange={(e) => setLocationForm({ ...locationForm, zipCode: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Geofence Settings (for clock-in/out)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Latitude</label>
                  <input type="number" step="any" value={locationForm.latitude} onChange={(e) => setLocationForm({ ...locationForm, latitude: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="32.7767" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Longitude</label>
                  <input type="number" step="any" value={locationForm.longitude} onChange={(e) => setLocationForm({ ...locationForm, longitude: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="-96.797" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Radius (meters)</label>
                  <input type="number" value={locationForm.geofenceRadius} onChange={(e) => setLocationForm({ ...locationForm, geofenceRadius: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add New Location */}
      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Locations ({locations.length})</h2>
            </div>
            <button
              onClick={() => setShowNewLocation(!showNewLocation)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
            >
              <Plus className="w-4 h-4" /> Add Location
            </button>
          </div>

          {showNewLocation && (
            <form onSubmit={createLocation} className="p-6 border-b border-gray-100 dark:border-gray-700 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input type="text" value={newLocation.name} onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                  <input type="text" value={newLocation.address} onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                  <input type="text" value={newLocation.city} onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
                    <input type="text" value={newLocation.state} onChange={(e) => setNewLocation({ ...newLocation, state: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zip</label>
                    <input type="text" value={newLocation.zipCode} onChange={(e) => setNewLocation({ ...newLocation, zipCode: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Create Location</button>
                <button type="button" onClick={() => setShowNewLocation(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
              </div>
            </form>
          )}

          <div className="p-4 space-y-2">
            {locations.map((loc) => (
              <div key={loc.id} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{loc.name}</span>
                {loc.id === currentLocation?.id && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">Current</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
