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
} from 'lucide-react-native';
import { TIPO_VEICULO_LABELS, STATUS_EQUIPE_LABELS } from '@/lib/constants';

export default function ProfileScreen() {
  const { user, profile, equipe, veiculo, signOut } = useAuth();
  const [stats, setStats] = useState({ encerradas: 0, tempoMedioReparo: '--' });

  useEffect(() => {
    if (!equipe) return;
    const loadStats = async () => {
      try {
        const { data } = await supabase
          .from('atendimentos')
          .select('data_hora_aceite, data_hora_encerramento, data_hora_inicio_reparo, data_hora_fim_reparo')
          .eq('equipe_id', equipe.id)
          .eq('status', 'concluido');

        if (data && data.length > 0) {
          const totalReparoMin = data.reduce((acc, a) => {
            if (a.data_hora_inicio_reparo && a.data_hora_fim_reparo) {
              return acc + (new Date(a.data_hora_fim_reparo).getTime() - new Date(a.data_hora_inicio_reparo).getTime()) / 60000;
            }
            return acc;
          }, 0);
          const avgMin = Math.round(totalReparoMin / data.length);
          const tempoMedio = avgMin < 60 ? `${avgMin} min` : `${Math.floor(avgMin / 60)}h ${avgMin % 60}min`;
          setStats({ encerradas: data.length, tempoMedioReparo: tempoMedio });
        }
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    };
    loadStats();
  }, [equipe]);

  const handleSignOut = () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair da sua conta?',
      [
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
      ]
    );
  };

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

      {/* Estatísticas */}
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
              {STATUS_EQUIPE_LABELS[equipe.status as keyof typeof STATUS_EQUIPE_LABELS] || equipe.status}
            </Text>
            <Text style={styles.statLabel}>Status da Equipe</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Users size={20} color="#F97316" />
            </View>
            <Text style={styles.statValue}>{equipe.qtd_tecnicos}</Text>
            <Text style={styles.statLabel}>Técnicos na Equipe</Text>
          </View>
        </View>
      </View>

      {/* Informações Pessoais */}
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

      {/* Equipe */}
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
              {equipe.turno === 'diurno' ? 'Diurno' : equipe.turno === 'noturno' ? 'Noturno' : '--'}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Gauge size={20} color="#7C3AED" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Raio Operacional</Text>
            <Text style={styles.infoValue}>{equipe.raio_operacional_km} km</Text>
          </View>
        </View>
      </View>

      {/* Veículo */}
      {veiculo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Veículo</Text>

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
                {veiculo.tipo ? (TIPO_VEICULO_LABELS[veiculo.tipo] || veiculo.tipo) : '--'}
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
        </View>
      )}

      {/* Conta */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conta</Text>

        <View style={styles.accountInfo}>
          <Text style={styles.accountLabel}>Status do Usuário</Text>
          <View style={[
            styles.accountStatusBadge,
            { backgroundColor: profile.ativo ? '#F0FDF4' : '#FEF2F2' }
          ]}>
            <Text style={[
              styles.accountStatusText,
              { color: profile.ativo ? '#16A34A' : '#DC2626' }
            ]}>
              {profile.ativo ? 'Ativo' : 'Inativo'}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color="#DC2626" />
          <Text style={styles.signOutButtonText}>Sair da Conta</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 20, paddingTop: 60, backgroundColor: 'white' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1F2937' },
  statsContainer: { padding: 20, backgroundColor: 'white', marginTop: 8 },
  section: { padding: 20, backgroundColor: 'white', marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 },
  statCard: { width: '50%', paddingHorizontal: 8, paddingVertical: 8, alignItems: 'center' },
  statIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  statValue: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 4, textAlign: 'center' },
  statLabel: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  infoContent: { marginLeft: 12, flex: 1 },
  infoLabel: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  infoValue: { fontSize: 16, fontWeight: '500', color: '#1F2937' },
  accountInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  accountLabel: { fontSize: 16, color: '#6B7280' },
  accountStatusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  accountStatusText: { fontSize: 14, fontWeight: '500' },
  signOutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FEF2F2', borderRadius: 8, paddingVertical: 12, borderWidth: 1, borderColor: '#FCA5A5',
  },
  signOutButtonText: { color: '#DC2626', fontSize: 16, fontWeight: '600', marginLeft: 8 },
});
