import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { TIPO_PAUSA_LABELS } from '@/lib/constants';
import { Coffee, Play, Square, Clock } from 'lucide-react-native';
import { Database } from '@/types/database';

type PausaEquipe = Database['public']['Tables']['pausas_equipes']['Row'];

export default function PausasScreen() {
  const { equipe } = useAuth();
  const [pausas, setPausas] = useState<PausaEquipe[]>([]);
  const [pausaAtiva, setPausaAtiva] = useState<PausaEquipe | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPausas = useCallback(async () => {
    if (!equipe) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('pausas_equipes')
        .select('*')
        .eq('equipe_id', equipe.id)
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false });

      setPausas(data || []);

      const ativa = (data || []).find((p) => p.status === 'em_andamento');
      setPausaAtiva(ativa || null);
    } catch (error) {
      console.error('Error loading pausas:', error);
    } finally {
      setLoading(false);
    }
  }, [equipe]);

  useEffect(() => {
    loadPausas();

    if (!equipe) return;
    const subscription = supabase
      .channel('pausas')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pausas_equipes',
          filter: `equipe_id=eq.${equipe.id}`,
        },
        () => loadPausas()
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, [equipe, loadPausas]);

  const iniciarPausa = async (tipo: PausaEquipe['tipo']) => {
    if (!equipe) return;
    if (pausaAtiva) {
      Alert.alert('Pausa em Andamento', 'Você já tem uma pausa em andamento. Volte dela antes de iniciar outra.');
      return;
    }

    try {
      await supabase.from('pausas_equipes').insert({
        equipe_id: equipe.id,
        tipo,
        inicio_real: new Date().toISOString(),
        status: 'em_andamento',
      });

      await supabase.from('equipes').update({ status: 'em_pausa' }).eq('id', equipe.id);

      loadPausas();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível iniciar a pausa');
    }
  };

  const voltarPausa = async () => {
    if (!pausaAtiva || !equipe) return;

    try {
      await supabase
        .from('pausas_equipes')
        .update({
          fim_real: new Date().toISOString(),
          status: 'concluida',
        })
        .eq('id', pausaAtiva.id);

      await supabase.from('equipes').update({ status: 'disponivel' }).eq('id', equipe.id);

      setPausaAtiva(null);
      loadPausas();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível voltar da pausa');
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '--:--';
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getPausaColor = (tipo: string) => {
    const colors: Record<string, string> = {
      cafe_manha: '#F97316',
      almoco: '#DC2626',
      cafe_tarde: '#EAB308',
      jantar: '#7C3AED',
      descanso: '#2563EB',
    };
    return colors[tipo] || '#6B7280';
  };

  const tiposPausa: { tipo: PausaEquipe['tipo']; label: string; icon: string }[] = [
    { tipo: 'cafe_manha', label: 'Café da Manhã', icon: '☕' },
    { tipo: 'almoco', label: 'Almoço', icon: '🍽' },
    { tipo: 'cafe_tarde', label: 'Café da Tarde', icon: '☕' },
    { tipo: 'jantar', label: 'Jantar', icon: '🍽' },
    { tipo: 'descanso', label: 'Descanso', icon: '😴' },
  ];

  const renderPausaItem = ({ item }: { item: PausaEquipe }) => (
    <View style={styles.pausaCard}>
      <View style={[styles.pausaIndicator, { backgroundColor: getPausaColor(item.tipo) }]} />
      <View style={styles.pausaInfo}>
        <Text style={styles.pausaTipo}>{TIPO_PAUSA_LABELS[item.tipo] || item.tipo}</Text>
        <Text style={styles.pausaHorario}>
          {formatTime(item.inicio_real)} - {item.fim_real ? formatTime(item.fim_real) : 'em andamento'}
        </Text>
      </View>
      <View style={[styles.pausaStatusBadge, { backgroundColor: item.status === 'em_andamento' ? '#FEF3C7' : '#F0FDF4' }]}>
        <Text style={[styles.pausaStatusText, { color: item.status === 'em_andamento' ? '#92400E' : '#16A34A' }]}>
          {item.status === 'em_andamento' ? 'Em andamento' : 'Concluída'}
        </Text>
      </View>
    </View>
  );

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
        <Text style={styles.title}>Pausas</Text>
        <Text style={styles.subtitle}>Gerencie suas pausas do dia</Text>
      </View>

      {/* Pausa ativa banner */}
      {pausaAtiva && (
        <View style={styles.pausaAtivaContainer}>
          <View style={styles.pausaAtivaInfo}>
            <Coffee size={24} color="#EAB308" />
            <View style={styles.pausaAtivaText}>
              <Text style={styles.pausaAtivaTipo}>{TIPO_PAUSA_LABELS[pausaAtiva.tipo] || pausaAtiva.tipo}</Text>
              <Text style={styles.pausaAtivaHorario}>Iniciada às {formatTime(pausaAtiva.inicio_real)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.voltarButton} onPress={voltarPausa}>
            <Square size={18} color="white" />
            <Text style={styles.voltarButtonText}>Voltar da Pausa</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Botões de pausa */}
      {!pausaAtiva && (
        <View style={styles.pausaButtons}>
          {tiposPausa.map((tipo) => (
            <TouchableOpacity
              key={tipo.tipo}
              style={[styles.pausaButton, { borderColor: getPausaColor(tipo.tipo) }]}
              onPress={() => iniciarPausa(tipo.tipo)}
            >
              <Text style={styles.pausaButtonIcon}>{tipo.icon}</Text>
              <Text style={[styles.pausaButtonText, { color: getPausaColor(tipo.tipo) }]}>
                {tipo.label}
              </Text>
              <Play size={16} color={getPausaColor(tipo.tipo)} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Lista de pausas do dia */}
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Pausas de Hoje</Text>
        {pausas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Clock size={48} color="#6B7280" />
            <Text style={styles.emptyText}>Nenhuma pausa registrada hoje</Text>
          </View>
        ) : (
          <FlatList
            data={pausas}
            renderItem={renderPausaItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPausas} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
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
  pausaAtivaContainer: {
    margin: 20, backgroundColor: '#FEF3C7', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  pausaAtivaInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  pausaAtivaText: { marginLeft: 12, flex: 1 },
  pausaAtivaTipo: { fontSize: 18, fontWeight: '600', color: '#92400E' },
  pausaAtivaHorario: { fontSize: 14, color: '#92400E', opacity: 0.8 },
  voltarButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#DC2626', borderRadius: 8, paddingVertical: 12,
  },
  voltarButtonText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  pausaButtons: {
    padding: 20,
  },
  pausaButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12,
    padding: 16, marginBottom: 12, borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  pausaButtonIcon: { fontSize: 24, marginRight: 12 },
  pausaButtonText: { flex: 1, fontSize: 16, fontWeight: '600' },
  historySection: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 16 },
  listContainer: { paddingBottom: 20 },
  pausaCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12,
    padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  pausaIndicator: { width: 4, height: 40, borderRadius: 2, marginRight: 12 },
  pausaInfo: { flex: 1 },
  pausaTipo: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  pausaHorario: { fontSize: 14, color: '#6B7280' },
  pausaStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  pausaStatusText: { fontSize: 12, fontWeight: '500' },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 16 },
  errorText: { fontSize: 16, color: '#DC2626', textAlign: 'center', marginTop: 20 },
});
