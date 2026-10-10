// hooks/useRotaAtendimento.ts
// Traça a rota da posição atual da equipe até o local da ocorrência
// (mesma ideia do app de transporte: Google Directions + polyline).
//
// Economia de chamadas à API:
//  - busca só quando o destino muda, quando a equipe andou > MIN_MOVE_M
//    (e passou MIN_INTERVAL_MS) ou quando saiu da rota (> OFF_ROUTE_M);
//  - nos demais casos apenas "apara" o trecho já percorrido, sem chamar a API.

import { useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { decodePolyline, LatLng } from '@/lib/decodePolyline';

const GOOGLE_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey || '';

const MIN_MOVE_M = 80;
const MIN_INTERVAL_MS = 15_000;
const OFF_ROUTE_M = 100;

export type ResumoRota = {
  distanciaTexto: string;
  duracaoTexto: string;
  distanciaM: number;
  duracaoSeg: number;
};

function distM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function nearest(coords: LatLng[], p: LatLng): { index: number; dist: number } {
  let index = 0;
  let dist = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = distM(coords[i], p);
    if (d < dist) {
      dist = d;
      index = i;
    }
  }
  return { index, dist };
}

type Params = {
  origem: LatLng | null; // posição atual da equipe
  destino: LatLng | null; // local da ocorrência
  ativo: boolean; // true enquanto deve exibir a rota
};

export function useRotaAtendimento({ origem, destino, ativo }: Params) {
  const [rota, setRota] = useState<LatLng[]>([]);
  const [resumo, setResumo] = useState<ResumoRota | null>(null);
  const [loading, setLoading] = useState(false);

  const rotaRef = useRef<LatLng[]>([]);
  const lastFetch = useRef<{ pos: LatLng; at: number } | null>(null);
  const destKey = useRef<string | null>(null);
  const reqId = useRef(0);

  const aplicarRota = (coords: LatLng[]) => {
    rotaRef.current = coords;
    setRota(coords);
  };

  const buscar = async (from: LatLng, to: LatLng) => {
    const myReq = ++reqId.current;
    lastFetch.current = { pos: from, at: Date.now() };
    setLoading(true);

    try {
      const url =
        `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${from.latitude},${from.longitude}` +
        `&destination=${to.latitude},${to.longitude}` +
        `&mode=driving&language=pt-BR&key=${GOOGLE_API_KEY}`;

      const res = await fetch(url);
      const json = await res.json();
      if (myReq !== reqId.current) return; // chegou resposta velha

      if (json.status === 'OK' && json.routes?.length > 0) {
        const leg = json.routes[0].legs[0];
        aplicarRota(decodePolyline(json.routes[0].overview_polyline.points));
        setResumo({
          distanciaTexto: leg.distance.text,
          duracaoTexto: leg.duration.text,
          distanciaM: leg.distance.value,
          duracaoSeg: leg.duration.value,
        });
      } else {
        console.warn('[useRotaAtendimento] Directions:', json.status);
        // fallback: linha reta, para ao menos mostrar a direção
        aplicarRota([from, to]);
        const d = distM(from, to);
        setResumo({
          distanciaTexto: d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`,
          duracaoTexto: '—',
          distanciaM: d,
          duracaoSeg: 0,
        });
      }
    } catch (e) {
      console.error('[useRotaAtendimento] erro:', e);
      if (myReq === reqId.current) aplicarRota([from, to]);
    } finally {
      if (myReq === reqId.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!ativo || !origem || !destino) {
      reqId.current++;
      rotaRef.current = [];
      lastFetch.current = null;
      destKey.current = null;
      setRota([]);
      setResumo(null);
      setLoading(false);
      return;
    }

    const key = `${destino.latitude.toFixed(5)},${destino.longitude.toFixed(5)}`;
    const destMudou = key !== destKey.current;
    const last = lastFetch.current;
    const agora = Date.now();

    let precisaBuscar = destMudou || !last;

    if (!precisaBuscar && last) {
      const andou = distM(last.pos, origem);
      const fora =
        rotaRef.current.length > 1 &&
        nearest(rotaRef.current, origem).dist > OFF_ROUTE_M;

      precisaBuscar =
        (fora && agora - last.at > 5_000) ||
        (andou > MIN_MOVE_M && agora - last.at > MIN_INTERVAL_MS);
    }

    if (precisaBuscar) {
      destKey.current = key;
      buscar(origem, destino);
      return;
    }

    // Sem nova chamada: remove da linha o trecho já percorrido.
    if (rotaRef.current.length > 2) {
      const { index } = nearest(rotaRef.current, origem);
      if (index > 0) aplicarRota([origem, ...rotaRef.current.slice(index + 1)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ativo,
    origem?.latitude,
    origem?.longitude,
    destino?.latitude,
    destino?.longitude,
  ]);

  return { rota, resumo, loading };
}