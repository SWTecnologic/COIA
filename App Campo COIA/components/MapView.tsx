import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { MapPin, Truck, AlertTriangle, Hospital } from 'lucide-react-native';
import { PRIORIDADE_COLORS } from '@/lib/constants';

interface MapViewProps {
  location: {
    latitude: number;
    longitude: number;
  } | null;
  currentDespacho?: any;
  pendingDespacho?: any;
  equipe?: any;
  pontoCritico?: any;
  onMapReady?: () => void;
  mapRef?: React.RefObject<any>;
}

export default function MapComponent({
  location,
  currentDespacho,
  pendingDespacho,
  equipe,
  pontoCritico,
  onMapReady,
  mapRef,
}: MapViewProps) {
  // Centraliza a cada mudança de localização (opcional)
  useEffect(() => {
    if (location && mapRef?.current) {
      mapRef.current.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  }, [location?.latitude, location?.longitude]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        <MapPin size={64} color="#6B7280" />
        <Text style={styles.webText}>Mapa disponível apenas no app móvel</Text>
        <Text style={styles.webSubtext}>Use o Expo Go no Android ou iOS</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <MapPin size={48} color="#6B7280" />
        <Text style={styles.loadingText}>Carregando localização...</Text>
      </View>
    );
  }

  const despacho = currentDespacho || pendingDespacho;
  const ocorrencia = despacho?.ocorrencia;

  const equipeStatusColor = (status: string) => {
    switch (status) {
      case 'disponivel': return '#22C55E';
      case 'em_deslocamento': return '#7C3AED';
      case 'no_local': return '#F97316';
      case 'em_pausa': return '#EAB308';
      default: return '#6B7280';
    }
  };

  const ocorrenciaColor = (prioridade: string) => {
    return PRIORIDADE_COLORS[prioridade as keyof typeof PRIORIDADE_COLORS] || '#6B7280';
  };

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      onMapReady={onMapReady}
      initialRegion={{
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      showsUserLocation={true}
      showsMyLocationButton={false}
      showsCompass={true}
      showsTraffic={false}
      loadingEnabled={true}
      loadingIndicatorColor="#7C3AED"
      loadingBackgroundColor="#F9FAFB"
      moveOnMarkerPress={true}
      mapPadding={{ top: 80, right: 0, bottom: 250, left: 0 }}
      provider={PROVIDER_GOOGLE}
    >
      {/* Marker da equipe */}
      <Marker
        coordinate={{
          latitude: location.latitude,
          longitude: location.longitude,
        }}
        title="Sua localização"
        description={`Status: ${equipe?.status || 'indisponivel'}`}
        anchor={{ x: 0.5, y: 0.5 }}
      >
        <View
          style={[
            styles.equipeMarker,
            { backgroundColor: equipeStatusColor(equipe?.status || 'indisponivel') },
          ]}
        >
          <Truck size={16} color="white" />
        </View>
      </Marker>

      {/* Ocorrência + raio de 50m + rota */}
      {ocorrencia && (
        <>
          {/* Raio de chegada de 50m */}
          <Circle
            center={{
              latitude: ocorrencia.latitude,
              longitude: ocorrencia.longitude,
            }}
            radius={50}
            strokeColor="rgba(124, 58, 237, 0.6)"
            fillColor="rgba(124, 58, 237, 0.15)"
            strokeWidth={2}
          />

          <Marker
            coordinate={{
              latitude: ocorrencia.latitude,
              longitude: ocorrencia.longitude,
            }}
            title={ocorrencia.protocolo}
            description={ocorrencia.descricao || ocorrencia.tipo}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View
              style={[
                styles.ocorrenciaMarker,
                { backgroundColor: ocorrenciaColor(ocorrencia.prioridade) },
              ]}
            >
              <AlertTriangle size={16} color="white" />
            </View>
          </Marker>

          <Polyline
            coordinates={[
              { latitude: location.latitude, longitude: location.longitude },
              { latitude: ocorrencia.latitude, longitude: ocorrencia.longitude },
            ]}
            strokeColor="#7C3AED"
            strokeWidth={3}
            lineDashPattern={[5, 5]}
          />
        </>
      )}

      {/* Ponto crítico */}
      {pontoCritico && (
        <Marker
          coordinate={{
            latitude: pontoCritico.latitude,
            longitude: pontoCritico.longitude,
          }}
          title={pontoCritico.nome}
          description={`Criticidade: ${pontoCritico.nivel_criticidade}`}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.pontoCriticoMarker}>
            <Hospital size={16} color="white" />
          </View>
        </Marker>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  webContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  webText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  webSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  equipeMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  ocorrenciaMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  pontoCriticoMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});