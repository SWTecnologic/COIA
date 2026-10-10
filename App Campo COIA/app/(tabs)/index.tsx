import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import * as Battery from 'expo-battery';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

import MapView from '@/components/MapView';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/hooks/useLocation';
// useDespachos continua sendo usado SÓ para as ações (aceitar/recusar/executar).
// A leitura de estado agora vem do useCampoRealtime (tempo real).
import { useDespachos, AcaoAtendimento } from '@/hooks/useDespachos';
import { useCampoRealtime } from '@/hooks/useCampoRealtime';
import { useRotaAtendimento } from '@/hooks/useRotaAtendimento';

import {
  STATUS_OCORRENCIA,
  STATUS_OCORRENCIA_LABELS,
  STATUS_OCORRENCIA_FINAL,
  STATUS_EQUIPE,
  STATUS_EQUIPE_LABELS,
  STATUS_EQUIPE_OFFLINE_VALUES,
  STATUS_EQUIPE_EM_OPERACAO_VALUES,
  PRIORIDADE_LABELS,
  PRIORIDADE_COLORS,
  TIPO_OCORRENCIA_LABELS,
  ACOES_ATENDIMENTO,
} from '@/lib/constants';

import { showConfirmAlert, calculateDistance } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

import {
  MapPin,
  Navigation,
  Power,
  PowerOff,
  CircleCheck as CheckCircle,
  Clock,
  Truck,
  Coffee,
  Wrench,
  ClipboardCheck,
  Camera,
} from 'lucide-react-native';

const RAIO_CHEGADA_METROS = 50;

const RESULTADOS_TESTE = [
  { id: 'aprovado', label: 'Aprovado', color: '#16A34A' },
  { id: 'reprovado_parcial', label: 'Reprovado parcial', color: '#EAB308' },
  { id: 'reprovado', label: 'Reprovado', color: '#DC2626' },
];

export default function MapScreen() {
  const mapRef = useRef<any>(null);

  const {
    user,
    profile,
    equipe,
    veiculo,
    loading: authLoading,
  } = useAuth();

  const {
    location,
    loading: locationLoading,
    error: locationError,
  } = useLocation();

  // Ações (backend)
  const {
    acceptDespacho,
    rejectDespacho,
    executarAcao,
    loading: despachoLoading,
  } = useDespachos();

  // Estado em tempo real
  const {
    currentDespacho,
    pendingDespacho,
    equipeStatus: equipeStatusRT,
    setEquipeStatus,
    pausaAtiva,
    connected,
    refetch,
  } = useCampoRealtime(equipe?.id);

  const equipeStatus: string | undefined = equipeStatusRT ?? equipe?.status;

  const [mapReady, setMapReady] = useState(false);
  const [testeModal, setTesteModal] = useState(false);

  const [testeForm, setTesteForm] = useState({
    tipo_teste: 'Teste de Continuidade',
    resultado: 'aprovado',
  });

  const [bateriaPct, setBateriaPct] = useState<number | null>(null);

  // 🆕 Foto do local (pós-reparo)
  const [fotoEnviando, setFotoEnviando] = useState(false);
  const [fotoDoLocal, setFotoDoLocal] = useState<string | null>(null);

  // Bateria (para a trava de aceite)
  useEffect(() => {
    let sub: any;

    Battery.getBatteryLevelAsync()
      .then((l) => {
        if (l >= 0) setBateriaPct(Math.round(l * 100));
      })
      .catch(() => {});

    try {
      sub = Battery.addBatteryLevelListener(({ batteryLevel }) => {
        if (batteryLevel >= 0) setBateriaPct(Math.round(batteryLevel * 100));
      });
    } catch {}

    return () => sub?.remove?.();
  }, []);

  // 🆕 Carrega foto existente quando muda o atendimento ativo
  useEffect(() => {
    let cancelado = false;

    async function carregarFoto() {
      const atendimentoId = currentDespacho?.atendimento?.id;
      if (!atendimentoId) {
        setFotoDoLocal(null);
        return;
      }

      const { data } = await supabase
        .from('atendimento_fotos')
        .select('url')
        .eq('atendimento_id', atendimentoId)
        .eq('tipo', 'pos_reparo')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!cancelado) {
        setFotoDoLocal(data?.[0]?.url ?? null);
      }
    }

    carregarFoto();
    return () => {
      cancelado = true;
    };
  }, [currentDespacho?.atendimento?.id]);

  // === CÁLCULO DE DISTÂNCIA ===
  const calcularDistancia = (): number | null => {
    const ocorrenciaAtual = currentDespacho?.ocorrencia;

    if (!location || !ocorrenciaAtual) return null;

    const latitudeOcorrencia = Number(ocorrenciaAtual.latitude);
    const longitudeOcorrencia = Number(ocorrenciaAtual.longitude);

    if (
      !Number.isFinite(latitudeOcorrencia) ||
      !Number.isFinite(longitudeOcorrencia)
    ) {
      return null;
    }

    const km = calculateDistance(
      location.latitude,
      location.longitude,
      latitudeOcorrencia,
      longitudeOcorrencia
    );

    if (!Number.isFinite(km) || km < 0) return null;

    return km * 1000;
  };

  const distanciaMetros = calcularDistancia();

  // Raio de chegada considera a imprecisão do GPS
  const precisaoGps = Number((location as any)?.accuracy);
  const raioChegada = Math.max(
    RAIO_CHEGADA_METROS,
    Number.isFinite(precisaoGps) ? Math.min(precisaoGps, 100) : 0
  );

  const podeChegarNoLocal =
    distanciaMetros !== null && distanciaMetros <= raioChegada;

  // === ROTA ATÉ O LOCAL DE ATENDIMENTO ===
  const statusOcorrencia = currentDespacho?.ocorrencia?.status;

  const mostrarRota =
    statusOcorrencia === STATUS_OCORRENCIA.NOVA ||
    statusOcorrencia === STATUS_OCORRENCIA.REGISTRADA ||
    statusOcorrencia === STATUS_OCORRENCIA.EM_ANALISE ||
    statusOcorrencia === STATUS_OCORRENCIA.AGUARDANDO_EQUIPE ||
    statusOcorrencia === STATUS_OCORRENCIA.EQUIPE_EM_DESLOCAMENTO;

  const destinoOcorrencia = (() => {
    const o = currentDespacho?.ocorrencia;
    if (!o) return null;
    const latitude = Number(o.latitude);
    const longitude = Number(o.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : null;
  })();

  const { rota, resumo: resumoRota } = useRotaAtendimento({
    origem: location
      ? { latitude: location.latitude, longitude: location.longitude }
      : null,
    destino: destinoOcorrencia,
    ativo: mostrarRota,
  });

  // === AÇÕES ===

  const registrarSessao = async (online: boolean) => {
    if (!equipe) return;
    try {
      if (online) {
        await supabase.from('sessoes_equipes').insert({
          equipe_id: equipe.id,
          data_hora_online: new Date().toISOString(),
          status: 'aberta',
          origem: 'app_campo',
        });
      } else {
        await supabase
          .from('sessoes_equipes')
          .update({
            data_hora_offline: new Date().toISOString(),
            status: 'encerrada',
          })
          .eq('equipe_id', equipe.id)
          .eq('status', 'aberta');
      }
    } catch (e) {
      console.warn('[registrarSessao]', e);
    }
  };

  const toggleOnlineStatus = async () => {
    if (!equipe) return;

    const estaOnline = !STATUS_EQUIPE_OFFLINE_VALUES.includes(
      equipeStatus as any
    );

    if (
      currentDespacho ||
      STATUS_EQUIPE_EM_OPERACAO_VALUES.includes(equipeStatus as any)
    ) {
      Alert.alert(
        'Atendimento em andamento',
        'Finalize a ocorrência antes de ficar offline.'
      );
      return;
    }

    if (equipeStatus === STATUS_EQUIPE.EM_PAUSA) {
      Alert.alert('Em pausa', 'Volte da pausa antes de alterar o status.');
      return;
    }

    const newStatus = estaOnline
      ? STATUS_EQUIPE.INDISPONIVEL
      : STATUS_EQUIPE.DISPONIVEL;

    try {
      const { error } = await supabase
        .from('equipes')
        .update({ status: newStatus })
        .eq('id', equipe.id);

      if (error) {
        Alert.alert(
          'Erro',
          `Não foi possível alterar o status: ${error.message}`
        );
        return;
      }

      setEquipeStatus(newStatus);
      registrarSessao(!estaOnline);
    } catch (error) {
      console.error('[toggleOnlineStatus]', error);
      Alert.alert('Erro', 'Falha ao alterar o status da equipe.');
    }
  };

  const togglePausa = async () => {
    if (!equipe) return;

    try {
      if (equipeStatus === STATUS_EQUIPE.EM_PAUSA) {
        const { error: pausaError } = await supabase
          .from('pausas_equipes')
          .update({
            status: 'concluida',
            fim_real: new Date().toISOString(),
          })
          .eq('equipe_id', equipe.id)
          .eq('status', 'em_andamento');

        if (pausaError) throw pausaError;

        const { error: equipeError } = await supabase
          .from('equipes')
          .update({ status: STATUS_EQUIPE.DISPONIVEL })
          .eq('id', equipe.id);

        if (equipeError) throw equipeError;

        setEquipeStatus(STATUS_EQUIPE.DISPONIVEL);
        refetch();
        return;
      }

      if (equipeStatus !== STATUS_EQUIPE.DISPONIVEL) {
        Alert.alert(
          'Aguarde',
          'Você só pode iniciar uma pausa quando estiver disponível.'
        );
        return;
      }

      const { error } = await supabase.from('pausas_equipes').insert({
        equipe_id: equipe.id,
        tipo: 'descanso',
        inicio_real: new Date().toISOString(),
        status: 'em_andamento',
      });

      if (error) throw error;

      const { error: equipeError } = await supabase
        .from('equipes')
        .update({ status: STATUS_EQUIPE.EM_PAUSA })
        .eq('id', equipe.id);

      if (equipeError) throw equipeError;

      setEquipeStatus(STATUS_EQUIPE.EM_PAUSA);
      refetch();
    } catch (error: any) {
      console.error('[togglePausa]', error);
      Alert.alert(
        'Erro',
        error?.message || 'Não foi possível alterar a pausa.'
      );
    }
  };

  // ==========================================================
  // ACEITE — com 4 travas (UI + status + pausa + bateria)
  // + trava de banco via índice único (fora do app)
  // ==========================================================
  const handleAccept = async () => {
    if (!pendingDespacho) return;

    // TRAVA 1: já tem ocorrência ativa carregada
    if (currentDespacho) {
      Alert.alert(
        'Ocorrência em andamento',
        'Você já tem uma ocorrência ativa. Finalize antes de aceitar outra.'
      );
      return;
    }

    // TRAVA 2: status da equipe indica operação
    if (STATUS_EQUIPE_EM_OPERACAO_VALUES.includes(equipeStatus as any)) {
      Alert.alert(
        'Equipe em operação',
        `Seu status atual é "${
          STATUS_EQUIPE_LABELS[
            equipeStatus as keyof typeof STATUS_EQUIPE_LABELS
          ] || equipeStatus
        }". Finalize antes de aceitar outra ocorrência.`
      );
      return;
    }

    // TRAVA 3: pausa ativa
    if (pausaAtiva) {
      Alert.alert('Pausa Ativa', 'Volte da pausa antes de aceitar ocorrências.');
      return;
    }

    // TRAVA 4: bateria baixa
    if (bateriaPct !== null && bateriaPct < 5) {
      Alert.alert(
        'Bateria Baixa',
        'Bateria abaixo de 5%. Não é possível aceitar.'
      );
      return;
    }

    try {
      await acceptDespacho(pendingDespacho.id);
      refetch();
    } catch (error: any) {
      console.error('[handleAccept]', error);

      const msg = String(error?.message || '');
      if (msg.includes('uniq_atendimento_ativo_por_equipe')) {
        Alert.alert(
          'Ocorrência em andamento',
          'Você já tem um atendimento ativo no banco. Finalize antes de aceitar outro.'
        );
        return;
      }

      Alert.alert('Erro', 'Não foi possível aceitar a ocorrência.');
    }
  };

  const handleReject = () => {
    if (!pendingDespacho) return;

    showConfirmAlert(
      'Recusar Ocorrência',
      'Tem certeza que deseja recusar?',
      async () => {
        try {
          await rejectDespacho(pendingDespacho.id);
          refetch();
        } catch (error) {
          console.error('[handleReject]', error);
          Alert.alert('Erro', 'Não foi possível recusar a ocorrência.');
        }
      }
    );
  };

  const handleAction = async (acao: AcaoAtendimento) => {
    if (!currentDespacho?.ocorrencia) return;

    if (acao === ACOES_ATENDIMENTO.REGISTRAR_TESTE) {
      setTesteModal(true);
      return;
    }

    try {
      await executarAcao(currentDespacho.ocorrencia.id, acao);
      refetch();
    } catch (error) {
      console.error('[handleAction]', error);
      Alert.alert('Erro', 'Não foi possível executar a ação.');
    }
  };

  const submitTeste = async () => {
    if (!currentDespacho?.ocorrencia) return;

    try {
      await executarAcao(
        currentDespacho.ocorrencia.id,
        ACOES_ATENDIMENTO.REGISTRAR_TESTE,
        testeForm
      );

      setTesteModal(false);

      setTesteForm({
        tipo_teste: 'Teste de Continuidade',
        resultado: 'aprovado',
      });

      refetch();
    } catch (error) {
      console.error('[submitTeste]', error);
      Alert.alert('Erro', 'Não foi possível registrar o teste.');
    }
  };

  // ==========================================================
  // 🆕 FOTO DO LOCAL (pós-reparo, antes de concluir)
  // ==========================================================
  const tirarFotoDoLocal = async () => {
    const atendimentoId = currentDespacho?.atendimento?.id;
    const ocorrenciaId = currentDespacho?.ocorrencia?.id;

    if (!atendimentoId || !ocorrenciaId) {
      Alert.alert('Erro', 'Atendimento não identificado.');
      return;
    }

    // 1. Permissão de câmera
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permissão negada',
        'Precisamos da câmera para registrar o local do reparo.'
      );
      return;
    }

    // 2. Abre a câmera DIRETO (sem galeria)
    const resultado = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
      allowsEditing: false,
      exif: false,
    });

    if (resultado.canceled) return;

    const asset = resultado.assets[0];
    if (!asset?.base64) {
      Alert.alert('Erro', 'Não foi possível obter a imagem.');
      return;
    }

    try {
      setFotoEnviando(true);

      // 3. Caminho no bucket
      const timestamp = Date.now();
      const fileName = `atendimentos/${atendimentoId}/${timestamp}.jpg`;

      // 4. Upload no Supabase Storage (bucket "Files")
      const { error: upErr } = await supabase.storage
        .from('Registros')
        .upload(fileName, decode(asset.base64), {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (upErr) throw upErr;

      // 5. URL pública
      const { data: urlData } = supabase.storage
        .from('Registros')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // 6. Salva referência no banco
      const { error: dbErr } = await supabase
        .from('atendimento_fotos')
        .insert({
          atendimento_id: atendimentoId,
          ocorrencia_id: ocorrenciaId,
          url: publicUrl,
          path: fileName,
          tipo: 'pos_reparo',
        });

      if (dbErr) throw dbErr;

      setFotoDoLocal(publicUrl);
      Alert.alert('Foto registrada', 'Agora você pode concluir a religação.');
      refetch();
    } catch (err: any) {
      console.error('[tirarFotoDoLocal]', err);
      Alert.alert(
        'Erro ao enviar foto',
        err?.message || 'Não foi possível registrar a foto.'
      );
    } finally {
      setFotoEnviando(false);
    }
  };

  const centerMapOnLocation = () => {
    if (!location || !mapRef.current || !mapReady) return;

    mapRef.current?.animateToRegion?.(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      1000
    );
  };

  // ==========================================================
  // FLUXO DE BOTÕES
  // ==========================================================
  const getNextAction = (): {
    text: string;
    action: () => void;
    color: string;
    icon: any;
    disabled?: boolean;
  } | null => {
    if (!currentDespacho?.ocorrencia) return null;

    const status = currentDespacho.ocorrencia.status;
    const attd = currentDespacho.atendimento;

    // FINAIS: nenhum botão (restabelecida / cancelada)
    if ((STATUS_OCORRENCIA_FINAL as readonly string[]).includes(status)) {
      return null;
    }

    switch (status) {
      // INICIAIS
      case STATUS_OCORRENCIA.NOVA:
      case STATUS_OCORRENCIA.REGISTRADA:
      case STATUS_OCORRENCIA.EM_ANALISE:
      case STATUS_OCORRENCIA.AGUARDANDO_EQUIPE:
        return {
          text: 'Iniciar Deslocamento',
          action: () => handleAction(ACOES_ATENDIMENTO.SAIR),
          color: '#7C3AED',
          icon: Truck,
        };

      // DESLOCAMENTO
      case STATUS_OCORRENCIA.EQUIPE_EM_DESLOCAMENTO:
        if (podeChegarNoLocal) {
          return {
            text: 'Cheguei no Local',
            action: () => handleAction(ACOES_ATENDIMENTO.CHEGAR),
            color: '#F97316',
            icon: MapPin,
          };
        }

        return {
          text:
            distanciaMetros === null
              ? 'Aguardando localização'
              : `Aproxime-se — ${Math.round(distanciaMetros)}m`,
          action: () => {
            if (distanciaMetros === null) {
              Alert.alert(
                'Localização indisponível',
                'Não foi possível calcular a distância. Verifique o GPS e as coordenadas da ocorrência.'
              );
              return;
            }

            Alert.alert(
              'Aguarde',
              `Você está a ${Math.round(
                distanciaMetros
              )} metros do local. A chegada será liberada quando estiver a até ${Math.round(
                raioChegada
              )} metros.`
            );
          },
          color: '#9CA3AF',
          icon: Navigation,
          disabled: true,
        };

      // NO LOCAL / DIAGNÓSTICO / AGUARDANDO MATERIAL
      case STATUS_OCORRENCIA.EQUIPE_NO_LOCAL:
      case STATUS_OCORRENCIA.DIAGNOSTICO:
      case STATUS_OCORRENCIA.AGUARDANDO_MATERIAL:
        return {
          text: 'Iniciar Reparo',
          action: () => handleAction(ACOES_ATENDIMENTO.INICIAR_REPARO),
          color: '#DC2626',
          icon: Wrench,
        };

      // REPARO
      case STATUS_OCORRENCIA.EM_REPARO:
        if (!attd?.data_hora_fim_reparo) {
          return {
            text: 'Finalizar Reparo',
            action: () => handleAction(ACOES_ATENDIMENTO.FINALIZAR_REPARO),
            color: '#DC2626',
            icon: Wrench,
          };
        }

        return {
          text: 'Testar Rede',
          action: () => handleAction(ACOES_ATENDIMENTO.REGISTRAR_TESTE),
          color: '#2563EB',
          icon: ClipboardCheck,
        };

      // TESTE / RELIGAÇÃO — 2 etapas (foto → encerrar)
      case STATUS_OCORRENCIA.EM_TESTE:
      case STATUS_OCORRENCIA.AGUARDANDO_RELIGACAO: {
        // ETAPA 1: ainda não tirou a foto
        if (!fotoDoLocal) {
          return {
            text: fotoEnviando ? 'Enviando foto...' : 'Tirar Foto do Local',
            action: tirarFotoDoLocal,
            color: '#0891B2',
            icon: Camera,
            disabled: fotoEnviando,
          };
        }

        // ETAPA 2: já tem foto → encerrar
        return {
          text: 'Religação Concluída',
          action: () => handleAction(ACOES_ATENDIMENTO.ENCERRAR),
          color: '#16A34A',
          icon: CheckCircle,
        };
      }

      // FALLBACK
      default:
        console.warn('[getNextAction] status não mapeado:', status);
        return null;
    }
  };

  // === LOADING / ERROS ===

  if (authLoading || locationLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />

        <Text style={styles.loadingText}>
          {authLoading
            ? 'Carregando dados do usuário...'
            : 'Carregando localização...'}
        </Text>
      </View>
    );
  }

  if (!equipe) {
    return (
      <View style={styles.errorContainer}>
        <MapPin size={48} color="#DC2626" />

        <Text style={styles.errorText}>Equipe não vinculada</Text>

        <Text style={styles.errorDescription}>
          Seu usuário não está associado a nenhuma equipe.
        </Text>
      </View>
    );
  }

  if (locationError || !location) {
    return (
      <View style={styles.errorContainer}>
        <MapPin size={48} color="#DC2626" />

        <Text style={styles.errorText}>Erro ao acessar localização</Text>

        <Text style={styles.errorDescription}>
          {locationError ||
            'Verifique se as permissões de localização estão ativadas.'}
        </Text>
      </View>
    );
  }

  const nextAction = getNextAction();
  const isOnline = !STATUS_EQUIPE_OFFLINE_VALUES.includes(equipeStatus as any);
  const isEmPausa = equipeStatus === STATUS_EQUIPE.EM_PAUSA;
  const ocorrencia = currentDespacho?.ocorrencia;
  const pendingOcorrencia = pendingDespacho?.ocorrencia;

  return (
    <View style={styles.container}>
      <MapView
        mapRef={mapRef}
        location={location}
        currentDespacho={currentDespacho}
        pendingDespacho={pendingDespacho}
        equipe={{ ...equipe, status: equipeStatus }}
        routeCoords={rota}
        destination={destinoOcorrencia}
        onMapReady={() => setMapReady(true)}
      />

      {/* Indicador de status */}
      <View style={styles.statusIndicator}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: isEmPausa
                ? '#EAB308'
                : isOnline
                ? '#16A34A'
                : '#6B7280',
            },
          ]}
        />

        <Text style={styles.statusText}>
          {STATUS_EQUIPE_LABELS[
            equipeStatus as keyof typeof STATUS_EQUIPE_LABELS
          ] || equipeStatus}
          {connected ? '' : ' • reconectando…'}
        </Text>
      </View>

      {/* Banner de pausa */}
      {pausaAtiva && (
        <View style={styles.pausaBanner}>
          <Coffee size={18} color="#EAB308" />
          <Text style={styles.pausaText}>
            Você está em pausa — {pausaAtiva.tipo}
          </Text>
        </View>
      )}

      {/* Controles flutuantes */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={centerMapOnLocation}
        >
          <Navigation size={20} color="#7C3AED" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pausaButton,
            { backgroundColor: isEmPausa ? '#16A34A' : '#EAB308' },
          ]}
          onPress={togglePausa}
        >
          <Coffee size={20} color="white" />
          <Text style={styles.onlineButtonText}>
            {isEmPausa ? 'Voltar' : 'Pausa'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.onlineButton,
            { backgroundColor: isOnline ? '#DC2626' : '#16A34A' },
          ]}
          onPress={toggleOnlineStatus}
        >
          {isOnline ? (
            <PowerOff size={20} color="white" />
          ) : (
            <Power size={20} color="white" />
          )}

          <Text style={styles.onlineButtonText}>
            {isOnline ? 'Offline' : 'Online'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Card de ocorrência ativa */}
      {ocorrencia && (
        <View style={styles.orderInfo}>
          <View style={styles.orderHeader}>
            <View
              style={[
                styles.statusIndicator2,
                {
                  backgroundColor:
                    PRIORIDADE_COLORS[
                      ocorrencia.prioridade as keyof typeof PRIORIDADE_COLORS
                    ] || '#6B7280',
                },
              ]}
            >
              <Clock size={16} color="white" />
            </View>

            <Text style={styles.orderStatus}>
              {STATUS_OCORRENCIA_LABELS[
                ocorrencia.status as keyof typeof STATUS_OCORRENCIA_LABELS
              ] || ocorrencia.status}
            </Text>
          </View>

          <Text style={styles.orderProtocol}>{ocorrencia.protocolo}</Text>

          <Text style={styles.orderType}>
            {TIPO_OCORRENCIA_LABELS[ocorrencia.tipo] || ocorrencia.tipo}
          </Text>

          <View style={styles.orderMeta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Prioridade</Text>

              <Text
                style={[
                  styles.metaValue,
                  {
                    color:
                      PRIORIDADE_COLORS[
                        ocorrencia.prioridade as keyof typeof PRIORIDADE_COLORS
                      ] || '#6B7280',
                  },
                ]}
              >
                {PRIORIDADE_LABELS[
                  ocorrencia.prioridade as keyof typeof PRIORIDADE_LABELS
                ] || ocorrencia.prioridade}
              </Text>
            </View>

            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Consumidores</Text>
              <Text style={styles.metaValue}>
                {ocorrencia.consumidores_afetados}
              </Text>
            </View>

            {distanciaMetros !== null && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Distância</Text>

                <Text style={styles.metaValue}>
                  {distanciaMetros < 1000
                    ? `${Math.round(distanciaMetros)}m`
                    : `${(distanciaMetros / 1000).toFixed(1)}km`}
                </Text>
              </View>
            )}

            {mostrarRota && resumoRota && resumoRota.duracaoTexto !== '—' && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Chegada</Text>
                <Text style={styles.metaValue}>{resumoRota.duracaoTexto}</Text>
              </View>
            )}
          </View>

          {/* 🆕 Miniatura da foto registrada */}
          {fotoDoLocal && (
            <View style={styles.fotoContainer}>
              <Text style={styles.metaLabel}>Foto do local registrada</Text>
              <Image
                source={{ uri: fotoDoLocal }}
                style={styles.fotoPreview}
                resizeMode="cover"
              />
            </View>
          )}

          {nextAction && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: nextAction.color },
                (despachoLoading || nextAction.disabled) &&
                  styles.buttonDisabled,
              ]}
              onPress={nextAction.action}
              disabled={despachoLoading || !!nextAction.disabled}
            >
              {React.createElement(nextAction.icon, {
                size: 18,
                color: 'white',
              })}

              <Text style={styles.actionButtonText}>{nextAction.text}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Card de despacho pendente */}
      {pendingDespacho && pendingOcorrencia && (
        <View style={styles.pendingOrderModal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nova Ocorrência</Text>

            <View style={styles.orderDetails}>
              <Text style={styles.modalProtocol}>
                {pendingOcorrencia.protocolo}
              </Text>

              <Text style={styles.modalType}>
                {TIPO_OCORRENCIA_LABELS[pendingOcorrencia.tipo] ||
                  pendingOcorrencia.tipo}
              </Text>

              <View style={styles.orderMeta}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Prioridade</Text>

                  <Text
                    style={[
                      styles.metaValue,
                      {
                        color:
                          PRIORIDADE_COLORS[
                            pendingOcorrencia.prioridade as keyof typeof PRIORIDADE_COLORS
                          ] || '#6B7280',
                      },
                    ]}
                  >
                    {PRIORIDADE_LABELS[
                      pendingOcorrencia.prioridade as keyof typeof PRIORIDADE_LABELS
                    ] || pendingOcorrencia.prioridade}
                  </Text>
                </View>

                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Consumidores</Text>
                  <Text style={styles.metaValue}>
                    {pendingOcorrencia.consumidores_afetados}
                  </Text>
                </View>

                {pendingDespacho.eta_minutos != null && (
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Chegada</Text>
                    <Text style={styles.metaValue}>
                      {pendingDespacho.eta_minutos} min
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={handleReject}
                disabled={despachoLoading}
              >
                <Text style={styles.rejectButtonText}>Recusar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.acceptButton,
                  (pausaAtiva || despachoLoading || currentDespacho) &&
                    styles.buttonDisabled,
                ]}
                onPress={handleAccept}
                disabled={!!pausaAtiva || despachoLoading || !!currentDespacho}
              >
                <Truck size={20} color="white" />
                <Text style={styles.acceptButtonText}>Aceitar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Modal de teste */}
      <Modal
        visible={testeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setTesteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.formModal}>
            <Text style={styles.formModalTitle}>Registrar Teste de Rede</Text>

            <Text style={styles.fieldLabel}>Tipo de Teste</Text>

            <TextInput
              style={styles.fieldInput}
              value={testeForm.tipo_teste}
              onChangeText={(v) =>
                setTesteForm((prev) => ({ ...prev, tipo_teste: v }))
              }
              placeholder="Ex: Teste de continuidade"
            />

            <Text style={styles.fieldLabel}>Resultado</Text>

            <View style={styles.chipRow}>
              {RESULTADOS_TESTE.map((r) => {
                const selecionado = testeForm.resultado === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.chip,
                      selecionado && {
                        backgroundColor: r.color,
                        borderColor: r.color,
                      },
                    ]}
                    onPress={() =>
                      setTesteForm((prev) => ({ ...prev, resultado: r.id }))
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selecionado && { color: 'white' },
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.modalActions, { marginTop: 20 }]}>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => setTesteModal(false)}
              >
                <Text style={styles.rejectButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.acceptButton}
                onPress={submitTeste}
              >
                <Text style={styles.acceptButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },

  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 16,
  },

  errorDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },

  statusIndicator: {
    position: 'absolute',
    top: 60,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },

  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },

  pausaBanner: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  pausaText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400E',
    marginLeft: 8,
  },

  controls: {
    position: 'absolute',
    right: 20,
    bottom: 180,
    gap: 8,
  },

  controlButton: {
    backgroundColor: 'white',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  pausaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  onlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  onlineButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },

  orderInfo: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 100,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },

  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  statusIndicator2: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  orderStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },

  orderProtocol: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },

  orderType: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 12,
  },

  orderMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  metaItem: {
    alignItems: 'center',
    flex: 1,
  },

  metaLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },

  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },

  // 🆕 Estilos da foto
  fotoContainer: {
    marginTop: 12,
    alignItems: 'center',
  },

  fotoPreview: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginTop: 6,
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },

  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  pendingOrderModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 20,
  },

  orderDetails: {
    alignItems: 'center',
    marginBottom: 24,
  },

  modalProtocol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },

  modalType: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 12,
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  rejectButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },

  rejectButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },

  acceptButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },

  acceptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  formModal: {
    backgroundColor: 'white',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },

  formModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },

  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
    marginTop: 12,
  },

  fieldInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 16,
    color: '#1F2937',
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },

  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});