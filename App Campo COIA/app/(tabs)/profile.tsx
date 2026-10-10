import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import {
  User,
  Mail,
  Users,
  Car,
  LogOut,
  MapPin,
  Wrench,
  Clock,
  Gauge,
  ShieldCheck,
  Zap,
  Package,
  Truck,
} from 'lucide-react-native';
import { TIPO_VEICULO_LABELS, STATUS_EQUIPE_LABELS } from '@/lib/constants';

// =====================================================
// TIPOS AUXILIARES
// =====================================================

type Habilidade = {
  codigo: string;
  nome: string;
};

type Tecnico = {
  id: string;
  nome: string;
  cargo: string;
  status: string;
  habilitacoes: Habilidade[];
};

type Especialidade = {
  codigo: string;
  nome: string;
  nivel: string;
};

type Equipamento = {
  codigo: string;
  nome: string;
  categoria: string;
  quantidade: number;
  status: string;
};

// =====================================================
// COMPONENTE
// =====================================================

export default function ProfileScreen() {
  const { user, profile, equipe, veiculo, signOut } = useAuth();

  const [stats, setStats] = useState({
    encerradas: 0,
    tempoMedioReparo: '--',
  });

  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  // -----------------------------------------------------
  // ESTATÍSTICAS
  // -----------------------------------------------------
  useEffect(() => {
    if (!equipe) return;

    const loadStats = async () => {
      try {
        const { data } = await supabase
          .from('atendimentos')
          .select(
            'data_hora_aceite, data_hora_encerramento, data_hora_inicio_reparo, data_hora_fim_reparo'
          )
          .eq('equipe_id', equipe.id)
          .eq('status', 'concluido');

        if (data && data.length > 0) {
          const totalReparoMin = data.reduce((acc, a) => {
            if (a.data_hora_inicio_reparo && a.data_hora_fim_reparo) {
              return (
                acc +
                (new Date(a.data_hora_fim_reparo).getTime() -
                  new Date(a.data_hora_inicio_reparo).getTime()) /
                  60000
              );
            }
            return acc;
          }, 0);

          const avgMin = Math.round(totalReparoMin / data.length);
          const tempoMedio =
            avgMin < 60
              ? `${avgMin} min`
              : `${Math.floor(avgMin / 60)}h ${avgMin % 60}min`;

          setStats({
            encerradas: data.length,
            tempoMedioReparo: tempoMedio,
          });
        }
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    };

    loadStats();
  }, [equipe]);

  // -----------------------------------------------------
  // DETALHES DA EQUIPE (técnicos, especialidades, equipamentos)
  // -----------------------------------------------------
  useEffect(() => {
    if (!equipe) return;

    const loadDetalhes = async () => {
      try {
        setLoadingDetalhes(true);

        // 1. Busca em paralelo: técnicos, especialidades, equipamentos
        const [tecRes, espRes, eqpRes] = await Promise.all([
          supabase
            .from('equipe_tecnicos')
            .select('tecnico_id, tecnicos(id, nome, cargo, status)')
            .eq('equipe_id', equipe.id),

          supabase
            .from('equipe_especialidades')
            .select('nivel, especialidades(codigo, nome)')
            .eq('equipe_id', equipe.id)
            .eq('ativo', true),

          supabase
            .from('equipamentos_equipe')
            .select('codigo, nome, categoria, quantidade, status')
            .eq('equipe_id', equipe.id),
        ]);

        // 2. Monta lista de técnicos
        const tecnicosBase: Tecnico[] = (tecRes.data ?? [])
          .map((row: any) => {
            const t = Array.isArray(row.tecnicos)
              ? row.tecnicos[0]
              : row.tecnicos;
            if (!t) return null;
            return {
              id: t.id,
              nome: t.nome,
              cargo: t.cargo,
              status: t.status,
              habilitacoes: [],
            } as Tecnico;
          })
          .filter(Boolean);

        // 3. Busca habilitações dos técnicos (se existirem)
        if (tecnicosBase.length > 0) {
          const ids = tecnicosBase.map((t) => t.id);

          const { data: habData } = await supabase
            .from('tecnico_habilitacoes')
            .select('tecnico_id, status, habilitacoes(codigo, nome)')
            .in('tecnico_id', ids)
            .eq('status', 'valida');

          // Distribui habilitações por técnico
          (habData ?? []).forEach((h: any) => {
            const tecnico = tecnicosBase.find((t) => t.id === h.tecnico_id);
            if (!tecnico) return;
            const hab = Array.isArray(h.habilitacoes)
              ? h.habilitacoes[0]
              : h.habilitacoes;
            if (hab) tecnico.habilitacoes.push(hab);
          });
        }

        setTecnicos(tecnicosBase);

        // 4. Especialidades
        const espList: Especialidade[] = (espRes.data ?? [])
          .map((row: any) => {
            const e = Array.isArray(row.especialidades)
              ? row.especialidades[0]
              : row.especialidades;
            if (!e) return null;
            return {
              codigo: e.codigo,
              nome: e.nome,
              nivel: row.nivel,
            } as Especialidade;
          })
          .filter(Boolean);

        setEspecialidades(espList);

        // 5. Equipamentos
        setEquipamentos((eqpRes.data as any[]) ?? []);
      } catch (error) {
        console.error('[loadDetalhes]', error);
      } finally {
        setLoadingDetalhes(false);
      }
    };

    loadDetalhes();
  }, [equipe]);

  // -----------------------------------------------------
  // SIGNOUT
  // -----------------------------------------------------
  const handleSignOut = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/(auth)/login');
          } catch (error) {
            Alert.alert('Erro', 'Falha ao sair da conta');
          }
        },
      },
    ]);
  };

  // -----------------------------------------------------
  // HELPERS VISUAIS
  // -----------------------------------------------------
  const corDoStatusEquipamento = (status: string) => {
    if (status === 'operacional') return { bg: '#F0FDF4', fg: '#16A34A' };
    if (status === 'manutencao') return { bg: '#FEF3C7', fg: '#D97706' };
    if (status === 'indisponivel') return { bg: '#FEF2F2', fg: '#DC2626' };
    return { bg: '#F3F4F6', fg: '#6B7280' };
  };

  const corDoStatusTecnico = (status: string) => {
    if (status === 'disponivel') return { bg: '#F0FDF4', fg: '#16A34A' };
    if (status === 'em_atendimento') return { bg: '#EFF6FF', fg: '#2563EB' };
    if (status === 'indisponivel') return { bg: '#FEF2F2', fg: '#DC2626' };
    return { bg: '#F3F4F6', fg: '#6B7280' };
  };

  const labelStatusTecnico = (status: string) => {
    if (status === 'disponivel') return 'Disponível';
    if (status === 'em_atendimento') return 'Em atendimento';
    if (status === 'indisponivel') return 'Indisponível';
    return status;
  };

  const labelNivelEsp = (nivel: string) => {
    if (nivel === 'basico') return 'Básico';
    if (nivel === 'intermediario') return 'Intermediário';
    if (nivel === 'avancado') return 'Avançado';
    return nivel;
  };

  // -----------------------------------------------------
  // RENDER
  // -----------------------------------------------------
  if (!user || !profile || !equipe) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meu Perfil</Text>
      </View>

      {/* ============================================ */}
      {/* ESTATÍSTICAS */}
      {/* ============================================ */}
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Estatísticas</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Wrench size={20} color="#7C3AED" />
            </View>
            <Text style={styles.statValue}>{stats.encerradas}</Text>
            <Text style={styles.statLabel}>Ocorrências Encerradas</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Clock size={20} color="#16A34A" />
            </View>
            <Text style={styles.statValue}>{stats.tempoMedioReparo}</Text>
            <Text style={styles.statLabel}>Tempo Médio de Reparo</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <MapPin size={20} color="#EAB308" />
            </View>
            <Text style={styles.statValue}>
              {STATUS_EQUIPE_LABELS[
                equipe.status as keyof typeof STATUS_EQUIPE_LABELS
              ] || equipe.status}
            </Text>
            <Text style={styles.statLabel}>Status da Equipe</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Users size={20} color="#F97316" />
            </View>
            <Text style={styles.statValue}>
              {tecnicos.length || equipe.qtd_tecnicos}
            </Text>
            <Text style={styles.statLabel}>Técnicos na Equipe</Text>
          </View>
        </View>
      </View>

      {/* ============================================ */}
      {/* INFO PESSOAL */}
      {/* ============================================ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informações Pessoais</Text>

        <View style={styles.infoRow}>
          <User size={20} color="#6B7280" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Nome</Text>
            <Text style={styles.infoValue}>{profile.nome}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Mail size={20} color="#6B7280" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>
        </View>
      </View>

      {/* ============================================ */}
      {/* EQUIPE */}
      {/* ============================================ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Equipe</Text>

        <View style={styles.infoRow}>
          <Users size={20} color="#7C3AED" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Código</Text>
            <Text style={styles.infoValue}>{equipe.codigo}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Users size={20} color="#7C3AED" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Nome</Text>
            <Text style={styles.infoValue}>{equipe.nome}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Clock size={20} color="#7C3AED" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Turno</Text>
            <Text style={styles.infoValue}>
              {equipe.turno === 'diurno'
                ? 'Diurno'
                : equipe.turno === 'noturno'
                ? 'Noturno'
                : '--'}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Gauge size={20} color="#7C3AED" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Raio Operacional</Text>
            <Text style={styles.infoValue}>
              {equipe.raio_operacional_km} km
            </Text>
          </View>
        </View>
      </View>

      {/* ============================================ */}
      {/* 🆕 TÉCNICOS */}
      {/* ============================================ */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Users size={20} color="#7C3AED" />
          <Text style={styles.sectionTitle}>Técnicos</Text>
        </View>

        {loadingDetalhes && tecnicos.length === 0 ? (
          <ActivityIndicator color="#7C3AED" style={{ marginTop: 8 }} />
        ) : tecnicos.length === 0 ? (
          <Text style={styles.vazioTexto}>Nenhum técnico cadastrado</Text>
        ) : (
          tecnicos.map((t) => {
            const st = corDoStatusTecnico(t.status);
            return (
              <View key={t.id} style={styles.tecnicoCard}>
                <View style={styles.tecnicoHeader}>
                  <View style={styles.tecnicoIcone}>
                    <User size={18} color="#7C3AED" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.tecnicoNome}>{t.nome}</Text>
                    <Text style={styles.tecnicoCargo}>{t.cargo}</Text>
                  </View>

                  <View style={[styles.badgePequeno, { backgroundColor: st.bg }]}>
                    <Text style={[styles.badgePequenoTexto, { color: st.fg }]}>
                      {labelStatusTecnico(t.status)}
                    </Text>
                  </View>
                </View>

                {/* Habilitações */}
                {t.habilitacoes.length > 0 ? (
                  <View style={styles.habRow}>
                    <ShieldCheck size={14} color="#16A34A" />
                    {t.habilitacoes.map((h) => (
                      <View key={h.codigo} style={styles.habBadge}>
                        <Text style={styles.habBadgeTexto}>
                          {h.codigo}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.habRow}>
                    <ShieldCheck size={14} color="#DC2626" />
                    <Text style={styles.habVazia}>
                      Sem habilitações válidas
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* ============================================ */}
      {/* 🆕 ESPECIALIDADES */}
      {/* ============================================ */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Zap size={20} color="#F59E0B" />
          <Text style={styles.sectionTitle}>Especialidades</Text>
        </View>

        {especialidades.length === 0 ? (
          <Text style={styles.vazioTexto}>
            Nenhuma especialidade cadastrada
          </Text>
        ) : (
          <View style={styles.especialidadeWrap}>
            {especialidades.map((e) => (
              <View key={e.codigo} style={styles.especialidadeChip}>
                <Zap size={12} color="#D97706" />
                <Text style={styles.especialidadeTexto}>{e.nome}</Text>
                <View style={styles.nivelChip}>
                  <Text style={styles.nivelChipTexto}>
                    {labelNivelEsp(e.nivel)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ============================================ */}
      {/* 🆕 EQUIPAMENTOS */}
      {/* ============================================ */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Package size={20} color="#0891B2" />
          <Text style={styles.sectionTitle}>Equipamentos</Text>
        </View>

        {equipamentos.length === 0 ? (
          <Text style={styles.vazioTexto}>Nenhum equipamento cadastrado</Text>
        ) : (
          equipamentos.map((e) => {
            const st = corDoStatusEquipamento(e.status);
            return (
              <View key={e.codigo} style={styles.equipamentoRow}>
                <View style={styles.equipamentoIcone}>
                  <Wrench size={16} color="#0891B2" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.equipamentoNome}>{e.nome}</Text>
                  <Text style={styles.equipamentoCategoria}>
                    {e.categoria.replace(/_/g, ' ')}
                  </Text>
                </View>

                <View style={styles.qtdBadge}>
                  <Text style={styles.qtdBadgeTexto}>x{e.quantidade}</Text>
                </View>

                <View
                  style={[styles.badgePequeno, { backgroundColor: st.bg }]}
                >
                  <Text style={[styles.badgePequenoTexto, { color: st.fg }]}>
                    {e.status}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* ============================================ */}
      {/* VEÍCULO (melhorado) */}
      {/* ============================================ */}
      {veiculo && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Truck size={20} color="#2563EB" />
            <Text style={styles.sectionTitle}>Veículo</Text>
          </View>

          <View style={styles.infoRow}>
            <Car size={20} color="#2563EB" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Modelo</Text>
              <Text style={styles.infoValue}>{veiculo.modelo || '--'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Car size={20} color="#2563EB" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Tipo</Text>
              <Text style={styles.infoValue}>
                {veiculo.tipo
                  ? TIPO_VEICULO_LABELS[veiculo.tipo] || veiculo.tipo
                  : '--'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Car size={20} color="#2563EB" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Placa</Text>
              <Text style={styles.infoValue}>{veiculo.placa || '--'}</Text>
            </View>
          </View>

          {veiculo.capacidade != null && (
            <View style={styles.infoRow}>
              <Package size={20} color="#2563EB" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Capacidade</Text>
                <Text style={styles.infoValue}>{veiculo.capacidade} kg</Text>
              </View>
            </View>
          )}

          <View style={styles.infoRow}>
            <ShieldCheck size={20} color="#2563EB" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>{veiculo.status || '--'}</Text>
            </View>
          </View>
        </View>
      )}

      {/* ============================================ */}
      {/* CONTA */}
      {/* ============================================ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conta</Text>

        <View style={styles.accountInfo}>
          <Text style={styles.accountLabel}>Status do Usuário</Text>
          <View
            style={[
              styles.accountStatusBadge,
              { backgroundColor: profile.ativo ? '#F0FDF4' : '#FEF2F2' },
            ]}
          >
            <Text
              style={[
                styles.accountStatusText,
                { color: profile.ativo ? '#16A34A' : '#DC2626' },
              ]}
            >
              {profile.ativo ? 'Ativo' : 'Inativo'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <LogOut size={20} color="#DC2626" />
          <Text style={styles.signOutButtonText}>Sair da Conta</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 20, paddingTop: 60, backgroundColor: 'white' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1F2937' },
  statsContainer: { padding: 20, backgroundColor: 'white', marginTop: 8 },
  section: { padding: 20, backgroundColor: 'white', marginTop: 8 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },

  // stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 },
  statCard: {
    width: '50%',
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: { fontSize: 12, color: '#6B7280', textAlign: 'center' },

  // info rows
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  infoContent: { marginLeft: 12, flex: 1 },
  infoLabel: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  infoValue: { fontSize: 16, fontWeight: '500', color: '#1F2937' },

  // conta
  accountInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  accountLabel: { fontSize: 16, color: '#6B7280' },
  accountStatusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  accountStatusText: { fontSize: 14, fontWeight: '500' },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  signOutButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // ====== TÉCNICOS ======
  vazioTexto: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  tecnicoCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
  },
  tecnicoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tecnicoIcone: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tecnicoNome: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  tecnicoCargo: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  badgePequeno: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgePequenoTexto: { fontSize: 11, fontWeight: '600' },

  habRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  habBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  habBadgeTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  habVazia: {
    fontSize: 12,
    color: '#DC2626',
    fontStyle: 'italic',
    marginLeft: 4,
  },

  // ====== ESPECIALIDADES ======
  especialidadeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  especialidadeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  especialidadeTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  nivelChip: {
    backgroundColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  nivelChipTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: '#78350F',
  },

  // ====== EQUIPAMENTOS ======
  equipamentoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  equipamentoIcone: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  equipamentoNome: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  equipamentoCategoria: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  qtdBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 4,
  },
  qtdBadgeTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
});