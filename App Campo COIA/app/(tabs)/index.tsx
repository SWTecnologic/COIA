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
  ScrollView,
} from 'react-native';
import MapView from '@/components/MapView';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { useDespachos, AcaoAtendimento } from '@/hooks/useDespachos';
import {
  STATUS_OCORRENCIA,
  STATUS_OCORRENCIA_LABELS,
  STATUS_EQUIPE,
  STATUS_EQUIPE_LABELS,
  PRIORIDADE_LABELS,
  PRIORIDADE_COLORS,
  TIPO_OCORRENCIA_LABELS,
  ACOES_ATENDIMENTO,
} from '@/lib/constants';
import { formatDistance, showConfirmAlert, calculateDistance } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import {
  MapPin,
  Navigation,
  Power,
  PowerOff,
  CircleCheck as CheckCircle,
  Clock,
  Truck,
  BatteryLow,
  Coffee,
  Wrench,
  ClipboardCheck,
  Zap,
} from 'lucide-react-native';

const RAIO_CHEGADA_METROS = 50;

export default function MapScreen() {
  const mapRef = useRef<any>(null);
  const { user, profile, equipe, veiculo, loading: authLoading } = useAuth();
  const { location, loading: locationLoading, error: locationError } = useLocation();
  const {
    currentDespacho,
    pendingDespacho,
    acceptDespacho,
    rejectDespacho,
    executarAcao,
    loading: despachoLoading,
  } = useDespachos();

  const [mapReady, setMapReady] = useState(false);
  const [testeModal, setTesteModal] = useState(false);
  const [testeForm, setTesteForm] = useState({ tipo_teste: 'Teste de Continuidade', resultado: 'aprovado' });
  const [pausaAtiva, setPausaAtiva] = useState<any>(null);
  const [bateriaPct, setBateriaPct] = useState<number | null>(null);

  // Log de diagnóstico
  console.log('[MapScreen]', {
    authLoading,
    locationLoading,
    locationError,
    hasLocation: !!location,
    hasEquipe: !!equipe,
    hasUser: !!user,
    equipeStatus: equipe?.status,
    distancia: currentDespacho?.ocorrencia ? calcularDistancia() : null,
  });

  // Carrega pausa ativa
  useEffect(() => {
    if (!equipe) return;
    const loadPausa = async () => {
      const { data } = await supabase
        .from('pausas_equipes')
        .select('*')
        .eq('equipe_id', equipe.id)
        .eq('status', 'em_andamento')
        .maybeSingle();
      setPausaAtiva(data);
    };
    loadPausa();
  }, [equipe]);

  // === CÁLCULO DE DISTÂNCIA ===
  const calcularDistancia = (): number | null => {
    const ocorrencia = currentDespacho?.ocorrencia;
    if (!location || !ocorrencia) return null;
    const km = calculateDistance(
      location.latitude,
      location.longitude,
      ocorrencia.latitude,
      ocorrencia.longitude
    );
    return km * 1000; // metros
  };

  const distanciaMetros = calcularDistancia();
  const podeChegarNoLocal =
    distanciaMetros != null && distanciaMetros <= RAIO_CHEGADA_METROS;

  // === AÇÕES ===
  const toggleOnlineStatus = async () => {
    if (!equipe) return;
    const newStatus =
      equipe.status === STATUS_EQUIPE.DISPONIVEL
        ? STATUS_EQUIPE.INDISPONIVEL
        : STATUS_EQUIPE.DISPONIVEL;

    const { data, error } = await supabase
      .from('equipes')
      .update({ status: newStatus })
      .eq('id', equipe.id)
      .select();

    console.log('[toggleOnlineStatus] data:', data);
    console.log('[toggleOnlineStatus] error:', error);

    if (error) {
      Alert.alert('Erro', `Não foi possível alterar: ${error.message}`);
    }
  };

  const togglePausa = async () => {
    if (!equipe) return;

    if (equipe.status === STATUS_EQUIPE.EM_PAUSA) {
      // Terminar pausa
      await supabase
        .from('pausas_equipes')
        .update({ status: 'concluida', fim_real: new Date().toISOString() })
        .eq('equipe_id', equipe.id)
        .eq('status', 'em_andamento');

      await supabase
        .from('equipes')
        .update({ status: STATUS_EQUIPE.DISPONIVEL })
        .eq('id', equipe.id);

      setPausaAtiva(null);
    } else {
      if (equipe.status !== STATUS_EQUIPE.DISPONIVEL) {
        Alert.alert('Aguarde', 'Você só pode pausar quando estiver disponível.');
        return;
      }

      const { data } = await supabase
        .from('pausas_equipes')
        .insert({
          equipe_id: equipe.id,
          tipo: 'descanso',
          inicio_real: new Date().toISOString(),
          status: 'em_andamento',
        })
        .select()
        .maybeSingle();

      await supabase
        .from('equipes')
        .update({ status: STATUS_EQUIPE.EM_PAUSA })
        .eq('id', equipe.id);

      setPausaAtiva(data);
    }
  };

  const handleAccept = async () => {
    if (!pendingDespacho) return;
    if (pausaAtiva) {
      Alert.alert('Pausa Ativa', 'Volte da pausa antes de aceitar ocorrências.');
      return;
    }
    if (bateriaPct !== null && bateriaPct < 5) {
      Alert.alert('Bateria Baixa', 'Bateria abaixo de 5%. Não é possível aceitar.');
      return;
    }
    try {
      await acceptDespacho(pendingDespacho.id);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível aceitar a ocorrência');
    }
  };

  const handleReject = () => {
    if (!pendingDespacho) return;
    showConfirmAlert('Recusar Ocorrência', 'Tem certeza que deseja recusar?', () =>
      rejectDespacho(pendingDespacho.id)
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
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível executar a ação');
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
      setTesteForm({ tipo_teste: 'Teste de Continuidade', resultado: 'aprovado' });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível registrar o teste');
    }
  };

  const centerMapOnLocation = () => {
    if (location && mapRef.current && mapReady) {
      mapRef.current?.animateToRegion?.(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  };

  // === FLUXO DE BOTÕES ===
  const getNextAction = (): { text: string; action: () => void; color: string; icon: any; disabled?: boolean } | null => {
    if (!currentDespacho?.ocorrencia) return null;
    const status = currentDespacho.ocorrencia.status;
    const attd = currentDespacho.atendimento;

    switch (status) {
      case STATUS_OCORRENCIA.EM_ANALISE:
        return {
          text: 'Iniciar Deslocamento',
          action: () => handleAction(ACOES_ATENDIMENTO.SAIR),
          color: '#7C3AED',
          icon: Truck,
        };

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
          text: `Aproxime-se — ${Math.round(distanciaMetros || 0)}m`,
          action: () => {
            Alert.alert(
              'Aguarde',
              `Você está a ${Math.round(distanciaMetros || 0)}m do local. Aproxime-se para liberar.`
            );
          },
          color: '#9CA3AF',
          icon: Navigation,
          disabled: true,
        };

      case STATUS_OCORRENCIA.EQUIPE_NO_LOCAL:
        return {
          text: 'Iniciar Reparo',
          action: () => handleAction(ACOES_ATENDIMENTO.INICIAR_REPARO),
          color: '#DC2626',
          icon: Wrench,
        };

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

      case STATUS_OCORRENCIA.EM_TESTE:
      case STATUS_OCORRENCIA.AGUARDANDO_RELIGACAO:
        return {
          text: 'Religação Concluída',
          action: () => handleAction(ACOES_ATENDIMENTO.ENCERRAR),
          color: '#16A34A',
          icon: CheckCircle,
        };

      default:
        return null;
    }
  };

  // === LOADING / ERROS ===
  if (authLoading || locationLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>
          {authLoading ? 'Carregando dados do usuário...' : 'Carregando localização...'}
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
          {locationError || 'Verifique se as permissões de localização estão ativadas'}
        </Text>
      </View>
    );
  }

  const nextAction = getNextAction();
  const isOnline = equipe.status !== STATUS_EQUIPE.INDISPONIVEL;
  const isEmPausa = equipe.status === STATUS_EQUIPE.EM_PAUSA;
  const ocorrencia = currentDespacho?.ocorrencia;
  const pendingOcorrencia = pendingDespacho?.ocorrencia;

  return (
    <View style={styles.container}>
      <MapView
        mapRef={mapRef}
        location={location}
        currentDespacho={currentDespacho}
        pendingDespacho={pendingDespacho}
        equipe={equipe}
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
          {STATUS_EQUIPE_LABELS[equipe.status as keyof typeof STATUS_EQUIPE_LABELS] ||
            equipe.status}
        </Text>
      </View>

      {/* Banner de pausa */}
      {pausaAtiva && (
        <View style={styles.pausaBanner}>
          <Coffee size={18} color="#EAB308" />
          <Text style={styles.pausaText}>Você está em pausa — {pausaAtiva.tipo}</Text>
        </View>
      )}

      {/* Controles flutuantes */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={centerMapOnLocation}>
          <Navigation size={20} color="#7C3AED" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pausaButton, { backgroundColor: isEmPausa ? '#16A34A' : '#EAB308' }]}
          onPress={togglePausa}
        >
          <Coffee size={20} color="white" />
          <Text style={styles.onlineButtonText}>
            {isEmPausa ? 'Voltar' : 'Pausa'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.onlineButton, { backgroundColor: isOnline ? '#DC2626' : '#16A34A' }]}
          onPress={toggleOnlineStatus}
        >
          {isOnline ? <PowerOff size={20} color="white" /> : <Power size={20} color="white" />}
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
              <Text style={styles.metaValue}>{ocorrencia.consumidores_afetados}</Text>
            </View>
            {distanciaMetros != null && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Distância</Text>
                <Text style={styles.metaValue}>
                  {distanciaMetros < 1000
                    ? `${Math.round(distanciaMetros)}m`
                    : `${(distanciaMetros / 1000).toFixed(1)}km`}
                </Text>
              </View>
            )}
          </View>

          {nextAction && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: nextAction.color },
                (despachoLoading || nextAction.disabled) && styles.buttonDisabled,
              ]}
              onPress={nextAction.action}
              disabled={despachoLoading || nextAction.disabled}
            >
              {React.createElement(nextAction.icon, { size: 18, color: 'white' })}
              <Text style={styles.actionButtonText}>{nextAction.text}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Card de pedido pendente (despacho ofertado) */}
      {pendingDespacho && pendingOcorrencia && (
        <View style={styles.pendingOrderModal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nova Ocorrência</Text>

            <View style={styles.orderDetails}>
              <Text style={styles.modalProtocol}>{pendingOcorrencia.protocolo}</Text>
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
                          ],
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

            <TouchableOpacity
              style={[
                styles.acceptButton,
                { marginLeft: 0 },
                (pausaAtiva || despachoLoading) && styles.buttonDisabled,
              ]}
              onPress={handleAccept}
              disabled={pausaAtiva || despachoLoading}
            >
              <Truck size={20} color="white" />
              <Text style={styles.acceptButtonText}>Iniciar Deslocamento</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal de teste */}
      <Modal visible={testeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.formModal}>
            <Text style={styles.formModalTitle}>Registrar Teste de Rede</Text>

            <Text style={styles.fieldLabel}>Tipo de Teste</Text>
            <TextInput
              style={styles.fieldInput}
              value={testeForm.tipo_teste}
              onChangeText={(v) => setTesteForm({ ...testeForm, tipo_teste: v })}
              placeholder="Ex: Teste de continuidade"
            />

            <Text style={styles.fieldLabel}>Resultado</Text>
            <TextInput
              style={styles.fieldInput}
              value={testeForm.resultado}
              onChangeText={(v) => setTesteForm({ ...testeForm, resultado: v })}
              placeholder="aprovado / reprovado"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => setTesteModal(false)}
              >
                <Text style={styles.rejectButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptButton} onPress={submitTeste}>
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
  loadingText: { marginTop: 16, fontSize: 16, color: '#6B7280' },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  errorText: { fontSize: 18, fontWeight: '600', color: '#DC2626', marginTop: 16 },
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
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
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
  pausaText: { fontSize: 14, fontWeight: '500', color: '#92400E', marginLeft: 8 },
  batteryBanner: {
    position: 'absolute',
    top: 150,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  batteryText: { fontSize: 14, fontWeight: '500', marginLeft: 8 },
  controls: { position: 'absolute', right: 20, bottom: 180, gap: 8 },
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
  orderHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusIndicator2: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderStatus: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginLeft: 8 },
  orderProtocol: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  orderType: { fontSize: 16, fontWeight: '500', color: '#1F2937', marginBottom: 12 },
  orderMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaItem: { alignItems: 'center', flex: 1 },
  metaLabel: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  metaValue: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  buttonDisabled: { opacity: 0.6 },
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
  orderDetails: { alignItems: 'center', marginBottom: 24 },
  modalProtocol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  modalType: { fontSize: 16, color: '#6B7280', marginBottom: 12 },
  priorityBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  priorityText: { fontSize: 14, fontWeight: '600' },
  orderDistance: { fontSize: 16, color: '#6B7280', marginBottom: 4 },
  orderEta: { fontSize: 14, color: '#7C3AED', marginBottom: 4 },
  orderConsumers: { fontSize: 14, color: '#6B7280' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between' },
  rejectButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButtonText: { color: '#6B7280', fontSize: 16, fontWeight: '600' },
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
  acceptButtonText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 },
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
  textArea: { minHeight: 60 },
});