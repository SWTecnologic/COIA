import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LOCATION_CONFIG } from '@/lib/constants';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

// Garante que o timestamp é um número válido
const safeTimestamp = (ts: any): number => {
  if (
    typeof ts === 'number' &&
    Number.isFinite(ts) &&
    ts > 0 &&
    ts < Date.now() + 60000
  ) {
    return ts;
  }
  return Date.now();
};

export function useLocation() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, equipe } = useAuth();
  const lastUpdateTimeRef = useRef<number>(0);

  // Salva no banco quando tiver location + user + equipe
  useEffect(() => {
    if (!location || !user || !equipe) return;

    const now = Date.now();
    if (now - lastUpdateTimeRef.current < LOCATION_CONFIG.UPDATE_INTERVAL) return;

    const insertLocationInDatabase = async () => {
      try {
        const isoData = new Date(location.timestamp).toISOString();

        const { error: insertError } = await supabase
          .from('localizacoes_equipes')
          .insert({
            equipe_id: equipe.id,
            latitude: location.latitude,
            longitude: location.longitude,
            data_hora: isoData,
            status: equipe.status,
            precisao_metros: location.accuracy,
            bateria_percentual: null,
          });

        if (insertError) {
          console.error('Error inserting location:', insertError);
        } else {
          lastUpdateTimeRef.current = now;
        }
      } catch (err) {
        console.error('Error inserting location:', err);
      }
    };

    insertLocationInDatabase();
  }, [location, user, equipe]);

  // Rastreamento GPS
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError('Banco de dados não configurado');
      setLoading(false);
      return;
    }

    let subscription: Location.LocationSubscription | null = null;
    let isMounted = true;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setError('Permissão de localização negada');
            setLoading(false);
          }
          return;
        }

        // Timeout de 15s
        const currentLocation = (await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout ao obter localização')), 15000)
          ),
        ])) as Location.LocationObject;

        if (!isMounted) return;

        const locationData: LocationData = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          accuracy: currentLocation.coords.accuracy,
          timestamp: safeTimestamp(currentLocation.timestamp),  // ✅
        };

        setLocation(locationData);
        setLoading(false);

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: LOCATION_CONFIG.UPDATE_INTERVAL,
            distanceInterval: LOCATION_CONFIG.MIN_DISTANCE,
          },
          (newLocation) => {
            if (!isMounted) return;
            setLocation({
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
              accuracy: newLocation.coords.accuracy,
              timestamp: safeTimestamp(newLocation.timestamp),  // ✅ aqui era o bug
            });
          }
        );
      } catch (err) {
        console.error('Location error:', err);
        if (isMounted) {
          setError('Falha ao obter localização');
          setLoading(false);
        }
      }
    };

    startLocationTracking();

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  return { location, loading, error };
}