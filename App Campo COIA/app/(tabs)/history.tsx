import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { TIPO_OCORRENCIA_LABELS } from '@/lib/constants';
import { Database } from '@/types/database';
import { CircleCheck as CheckCircle, Clock, MapPin, Zap, Wrench, ClipboardCheck } from 'lucide-react-native';

type Atendimento = Database['public']['Tables']['atendimentos']['Row'];
type Ocorrencia = Database['public']['Tables']['ocorrencias']['Row'];

interface AtendimentoComOcorrencia extends Atendimento {
  ocorrencia?: Ocorrencia;
}

export default function HistoryScreen() {
  const { equipe } = useAuth();
  const [atendimentos, setAtendimentos] = useState<AtendimentoComOcorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttd, setSelectedAttd] = useState<AtendimentoComOcorrencia | null>(null);

  const loadHistory = useCallback(async () => {
    if (!equipe) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('atendimentos')
        .select('*, ocorrencia:ocorrencias(*)')
        .eq('equipe_id', equipe.id)
        .eq('status', 'concluido')
        .order('data_hora_encerramento', { ascending: false })
        .limit(50);

      setAtendimentos(data as AtendimentoComOcorrencia[] || []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  }, [equipe]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const calcTempoTotal = (attd: Atendimento) => {
    if (!attd.data_hora_aceite || !attd.data_hora_encerramento) return '--';
    const start = new Date(attd.data_hora_aceite).getTime();
    const end = new Date(attd.data_hora_encerramento).getTime();
    const diffMin = Math.round((end - start) / 60000);
    if (diffMin < 60) return `${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return `${h}h ${m}min`;
  };

  const calcTempoReparo = (attd: Atendimento) => {
    if (!attd.data_hora_inicio_reparo || !attd.data_hora_fim_reparo) return '--';
    const start = new Date(attd.data_hora_inicio_reparo).getTime();
    const end = new Date(attd.data_hora_fim_reparo).getTime();
    const diffMin = Math.round((end - start) / 60000);
    if (diffMin < 60) return `${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return `${h}h ${m}min`;
  };

  const renderItem = ({ item }: { item: AtendimentoComOcorrencia }) => {
    const ocorrencia = item.ocorrencia;
    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelectedAttd(item)}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardProtocol}>{ocorrencia?.protocolo || '---'}</Text>
            <Text style={styles.cardType}>{ocorrencia ? (TIPO_OCORRENCIA_LABELS[ocorrencia.tipo] || ocorrencia.tipo) : '---'}</Text>
          </View>
          <View style={styles.statusBadge}>
            <CheckCircle size={14} color="#16A34A" />
            <Text style={styles.statusText}>Concluído</Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Clock size={14} color="#6B7280" />
            <Text style={styles.footerText}>{calcTempoTotal(item)}</Text>
          </View>
          <Text style={styles.footerDate}>{formatDate(item.data_hora_encerramento)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetails = () => {
    if (!selectedAttd) return null;
    const ocorrencia = selectedAttd.ocorrencia;

    const steps = [
      { label: 'Aceite', value: selectedAttd.data_hora_aceite, icon: CheckCircle, color: '#16A34A' },
      { label: 'Saída', value: selectedAttd.data_hora_saida, icon: MapPin, color: '#7C3AED' },
      { label: 'Chegada', value: selectedAttd.data_hora_chegada, icon: MapPin, color: '#F97316' },
      { label: 'Início Diagnóstico', value: selectedAttd.data_hora_inicio_diagnostico, icon: ClipboardCheck, color: '#EAB308' },
      { label: 'Fim Diagnóstico', value: selectedAttd.data_hora_fim_diagnostico, icon: ClipboardCheck, color: '#EAB308' },
      { label: 'Início Reparo', value: selectedAttd.data_hora_inicio_reparo, icon: Wrench, color: '#DC2626' },
      { label: 'Fim Reparo', value: selectedAttd.data_hora_fim_reparo, icon: Wrench, color: '#DC2626' },
      { label: 'Teste', value: selectedAttd.data_hora_inicio_teste, icon: ClipboardCheck, color: '#2563EB' },
      { label: 'Religação', value: selectedAttd.data_hora_religacao, icon: Zap, color: '#7C3AED' },
      { label: 'Restabelecimento', value: selectedAttd.data_hora_restabelecimento, icon: CheckCircle, color: '#16A34A' },
      { label: 'Encerramento', value: selectedAttd.data_hora_encerramento, icon: CheckCircle, color: '#16A34A' },
    ];

    return (
      <View style={styles.detailsModal}>
        <View style={styles.detailsContent}>
          <View style={styles.detailsHeader}>
            <Text style={styles.detailsTitle}>Detalhes do Atendimento</Text>
            <TouchableOpacity onPress={() => setSelectedAttd(null)}>
              <Text style={styles.closeText}>Fechar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailsBody}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Protocolo</Text>
              <Text style={styles.detailValue}>{ocorrencia?.protocolo || '---'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tipo</Text>
              <Text style={styles.detailValue}>{ocorrencia ? (TIPO_OCORRENCIA_LABELS[ocorrencia.tipo] || ocorrencia.tipo) : '---'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tempo Total</Text>
              <Text style={styles.detailValue}>{calcTempoTotal(selectedAttd)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tempo de Reparo</Text>
              <Text style={styles.detailValue}>{calcTempoReparo(selectedAttd)}</Text>
            </View>
            {selectedAttd.observacoes && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Observações</Text>
                <Text style={styles.detailValue}>{selectedAttd.observacoes}</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Linha do Tempo</Text>
            {steps.map((step, idx) => {
              const StepIcon = step.icon;
              return (
                <View key={idx} style={styles.stepRow}>
                  <StepIcon size={16} color={step.color} />
                  <Text style={styles.stepLabel}>{step.label}</Text>
                  <Text style={styles.stepValue}>{formatDate(step.value)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  if (!equipe) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Dados da equipe não encontrados</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Histórico</Text>
        <Text style={styles.subtitle}>
          {atendimentos.length} atendimento{atendimentos.length !== 1 ? 's' : ''} concluído{atendimentos.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {atendimentos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <CheckCircle size={64} color="#6B7280" />
          <Text style={styles.emptyTitle}>Nenhum atendimento no histórico</Text>
          <Text style={styles.emptySubtitle}>
            Seus atendimentos concluídos aparecerão aqui
          </Text>
        </View>
      ) : (
        <FlatList
          data={atendimentos}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadHistory} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {selectedAttd && renderDetails()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    padding: 20, paddingTop: 60, backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#6B7280' },
  listContainer: { padding: 20 },
  card: {
    backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardProtocol: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  cardType: { fontSize: 14, color: '#6B7280' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F0FDF4' },
  statusText: { fontSize: 12, fontWeight: '500', color: '#16A34A', marginLeft: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerItem: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 14, color: '#6B7280', marginLeft: 6 },
  footerDate: { fontSize: 14, color: '#6B7280' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#6B7280', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 16, color: '#9CA3AF', textAlign: 'center', lineHeight: 24 },
  errorText: { fontSize: 16, color: '#DC2626', textAlign: 'center', marginTop: 20 },
  detailsModal: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  detailsContent: {
    backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%',
  },
  detailsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  detailsTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  closeText: { fontSize: 16, color: '#7C3AED', fontWeight: '600' },
  detailsBody: { padding: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  detailLabel: { fontSize: 14, color: '#6B7280' },
  detailValue: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 8, marginTop: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  stepLabel: { fontSize: 14, color: '#6B7280', marginLeft: 8, flex: 1 },
  stepValue: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
});
