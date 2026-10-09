/**
 * Geolocation and Distance Utilities for Golf Notes
 */

// Earth radius in meters
const EARTH_RADIUS_METERS = 6371000;
const METERS_TO_YARDS = 1.09361;
const METERS_TO_MILES = 0.000621371;

/**
 * Calculates geodesic distance between two lat/lng points using the Haversine formula.
 * @param {number} lat1 Latitude of point 1
 * @param {number} lon1 Longitude of point 1
 * @param {number} lat2 Latitude of point 2
 * @param {number} lon2 Longitude of point 2
 * @returns {number} Distance in meters
 */
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates distance in yards (standard golf measurement)
 */
export function getDistanceYards(lat1, lon1, lat2, lon2) {
  const meters = getDistanceMeters(lat1, lon1, lat2, lon2);
  return Math.round(meters * METERS_TO_YARDS);
}

/**
 * Calculates distance in miles (for nearby course search)
 */
export function getDistanceMiles(lat1, lon1, lat2, lon2) {
  const meters = getDistanceMeters(lat1, lon1, lat2, lon2);
  const miles = meters * METERS_TO_MILES;
  return miles < 10 ? miles.toFixed(1) : Math.round(miles);
}

/**
 * Requests high-accuracy current device position using browser Geolocation API
 * @returns {Promise<{lat: number, lng: number, accuracy: number}>}
 */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser/device.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        let message = 'Unable to retrieve location.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location permission denied. Please enable GPS permissions.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'GPS signal unavailable. Try moving outdoors.';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out.';
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
        ...options,
      }
    );
  });
}

/**
 * Calculates initial compass bearing in degrees (0..360) from point 1 to point 2
 */
export function getBearing(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(rLat2);
  const x =
    Math.cos(rLat1) * Math.sin(rLat2) -
    Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);

  const initialBearingRad = Math.atan2(y, x);
  return ((initialBearingRad * 180) / Math.PI + 360) % 360;
}

/**
 * Projects a destination coordinate given a starting lat/lng, distance in yards, and bearing in degrees
 */
export function projectDestination(lat1, lon1, distanceYards, bearingDegrees) {
  if (!lat1 || !lon1 || !distanceYards) return null;
  const distanceMeters = distanceYards / METERS_TO_YARDS;
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearingRad = (bearingDegrees * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLon1 = (lon1 * Math.PI) / 180;

  const rLat2 = Math.asin(
    Math.sin(rLat1) * Math.cos(angularDistance) +
    Math.cos(rLat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );

  const rLon2 =
    rLon1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(rLat1),
      Math.cos(angularDistance) - Math.sin(rLat1) * Math.sin(rLat2)
    );

  return {
    lat: (rLat2 * 180) / Math.PI,
    lng: (((rLon2 * 180) / Math.PI + 540) % 360) - 180,
  };
}
