/**
 * Routing Service
 * Providing road-based navigation and route optimization using OSRM
 */

export interface RoutePoint {
    lat: number;
    lng: number;
}

export interface RouteResponse {
    distance: number;
    duration: number;
    geometry: any; // GeoJSON LineString
    waypoints: any[];
}

const OSRM_BASE_URL = 'https://router.project-osrm.org';

export class RoutingService {
    /**
     * Get road-accurate path between two or more points
     */
    static async getRoute(points: RoutePoint[]): Promise<RouteResponse | null> {
        if (points.length < 2) return null;

        const coordinates = points.map(p => `${p.lng},${p.lat}`).join(';');
        const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
                console.error('OSRM Route error:', data.code);
                return null;
            }

            const route = data.routes[0];
            return {
                distance: route.distance,
                duration: route.duration,
                geometry: route.geometry,
                waypoints: data.waypoints,
            };
        } catch (error) {
            console.error('Routing failed:', error);
            return null;
        }
    }

    /**
     * Optimize a trip through multiple points (TSP)
     * Uses OSRM Trip service to find the shortest road-based path visiting all points
     */
    static async optimizeRoute(points: RoutePoint[]): Promise<RouteResponse | null> {
        if (points.length < 2) return null;

        // OSRM Trip service limits might apply (usually 100 points)
        const coordinates = points.map(p => `${p.lng},${p.lat}`).join(';');
        const url = `${OSRM_BASE_URL}/trip/v1/driving/${coordinates}?overview=full&geometries=geojson&source=first`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.code !== 'Ok' || !data.trips || data.trips.length === 0) {
                console.error('OSRM Trip error:', data.code);
                // Fallback to basic route if trip optimization fails
                return this.getRoute(points);
            }

            const trip = data.trips[0];
            return {
                distance: trip.distance,
                duration: trip.duration,
                geometry: trip.geometry,
                waypoints: data.waypoints,
            };
        } catch (error) {
            console.error('Route optimization failed:', error);
            return null;
        }
    }
}
