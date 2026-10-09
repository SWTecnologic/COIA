export interface Database {
  public: {
    Tables: {
      usuarios_sistema: {
        Row: {
          id: string;
          auth_user_id: string | null;
          tipo_usuario: 'tecnico' | 'gerente';
          equipe_id: string | null;
          nome: string;
          login: string | null;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          tipo_usuario?: 'tecnico' | 'gerente';
          equipe_id?: string | null;
          nome: string;
          login?: string | null;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          tipo_usuario?: 'tecnico' | 'gerente';
          equipe_id?: string | null;
          nome?: string;
          login?: string | null;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      equipes: {
        Row: {
          id: string;
          codigo: string;
          nome: string;
          status: 'disponivel' | 'em_deslocamento' | 'no_local' | 'em_pausa' | 'indisponivel';
          regiao_id: string | null;
          base_operacional_id: string | null;
          veiculo_id: string | null;
          qtd_tecnicos: number;
          turno: 'diurno' | 'noturno' | null;
          raio_operacional_km: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          nome: string;
          status?: 'disponivel' | 'em_deslocamento' | 'no_local' | 'em_pausa' | 'indisponivel';
          regiao_id?: string | null;
          base_operacional_id?: string | null;
          veiculo_id?: string | null;
          qtd_tecnicos?: number;
          turno?: 'diurno' | 'noturno' | null;
          raio_operacional_km?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          codigo?: string;
          nome?: string;
          status?: 'disponivel' | 'em_deslocamento' | 'no_local' | 'em_pausa' | 'indisponivel';
          regiao_id?: string | null;
          base_operacional_id?: string | null;
          veiculo_id?: string | null;
          qtd_tecnicos?: number;
          turno?: 'diurno' | 'noturno' | null;
          raio_operacional_km?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      veiculos: {
        Row: {
          id: string;
          codigo: string;
          tipo: 'caminhao' | 'pickup' | 'moto' | 'van' | null;
          modelo: string | null;
          placa: string | null;
          capacidade: string | null;
          status: 'disponivel' | 'em_uso' | 'manutencao';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          tipo?: 'caminhao' | 'pickup' | 'moto' | 'van' | null;
          modelo?: string | null;
          placa?: string | null;
          capacidade?: string | null;
          status?: 'disponivel' | 'em_uso' | 'manutencao';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          codigo?: string;
          tipo?: 'caminhao' | 'pickup' | 'moto' | 'van' | null;
          modelo?: string | null;
          placa?: string | null;
          capacidade?: string | null;
          status?: 'disponivel' | 'em_uso' | 'manutencao';
          created_at?: string;
          updated_at?: string;
        };
      };
      ocorrencias: {
        Row: {
          id: string;
          protocolo: string;
          tipo: 'sem_energia' | 'cabo_rompido' | 'curto_circuito' | 'sobrecarga' | 'manutencao_preventiva' | 'religacao' | 'outro';
          descricao: string | null;
          latitude: number;
          longitude: number;
          status: 'nova' | 'em_analise' | 'equipe_em_deslocamento' | 'equipe_no_local' | 'diagnostico' | 'em_reparo' | 'em_teste' | 'aguardando_religacao' | 'restabelecida' | 'cancelada';
          prioridade: 'urgente' | 'prioridade' | 'ordem_chamada';
          consumidores_afetados: number;
          ia_prioridade_final: string | null;
          ia_previsao_restabelecimento: string | null;
          data_hora_criacao: string;
          data_hora_encerramento: string | null;
          evento_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          protocolo: string;
          tipo: 'sem_energia' | 'cabo_rompido' | 'curto_circuito' | 'sobrecarga' | 'manutencao_preventiva' | 'religacao' | 'outro';
          descricao?: string | null;
          latitude: number;
          longitude: number;
          status?: string;
          prioridade?: string;
          consumidores_afetados?: number;
          ia_prioridade_final?: string | null;
          ia_previsao_restabelecimento?: string | null;
          data_hora_criacao?: string;
          data_hora_encerramento?: string | null;
          evento_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          protocolo?: string;
          tipo?: string;
          descricao?: string | null;
          latitude?: number;
          longitude?: number;
          status?: string;
          prioridade?: string;
          consumidores_afetados?: number;
          ia_prioridade_final?: string | null;
          ia_previsao_restabelecimento?: string | null;
          data_hora_criacao?: string;
          data_hora_encerramento?: string | null;
          evento_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      despachos_ocorrencias: {
        Row: {
          id: string;
          ocorrencia_id: string;
          equipe_id: string;
          posicao: number | null;
          pontuacao: number | null;
          distancia_km: number | null;
          eta_minutos: number | null;
          enviado_em: string;
          respondido_em: string | null;
          status: 'ofertada' | 'aceita' | 'recusada' | 'expirada';
          motivo: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ocorrencia_id: string;
          equipe_id: string;
          posicao?: number | null;
          pontuacao?: number | null;
          distancia_km?: number | null;
          eta_minutos?: number | null;
          enviado_em?: string;
          respondido_em?: string | null;
          status?: string;
          motivo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          ocorrencia_id?: string;
          equipe_id?: string;
          posicao?: number | null;
          pontuacao?: number | null;
          distancia_km?: number | null;
          eta_minutos?: number | null;
          enviado_em?: string;
          respondido_em?: string | null;
          status?: string;
          motivo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      atendimentos: {
        Row: {
          id: string;
          ocorrencia_id: string;
          equipe_id: string;
          data_hora_aceite: string | null;
          data_hora_saida: string | null;
          data_hora_chegada: string | null;
          data_hora_inicio_diagnostico: string | null;
          data_hora_fim_diagnostico: string | null;
          data_hora_inicio_reparo: string | null;
          data_hora_fim_reparo: string | null;
          data_hora_inicio_teste: string | null;
          data_hora_fim_teste: string | null;
          data_hora_religacao: string | null;
          data_hora_restabelecimento: string | null;
          data_hora_encerramento: string | null;
          observacoes: string | null;
          status: 'em_andamento' | 'concluido' | 'cancelado';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ocorrencia_id: string;
          equipe_id: string;
          data_hora_aceite?: string | null;
          data_hora_saida?: string | null;
          data_hora_chegada?: string | null;
          data_hora_inicio_diagnostico?: string | null;
          data_hora_fim_diagnostico?: string | null;
          data_hora_inicio_reparo?: string | null;
          data_hora_fim_reparo?: string | null;
          data_hora_inicio_teste?: string | null;
          data_hora_fim_teste?: string | null;
          data_hora_religacao?: string | null;
          data_hora_restabelecimento?: string | null;
          data_hora_encerramento?: string | null;
          observacoes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          ocorrencia_id?: string;
          equipe_id?: string;
          data_hora_aceite?: string | null;
          data_hora_saida?: string | null;
          data_hora_chegada?: string | null;
          data_hora_inicio_diagnostico?: string | null;
          data_hora_fim_diagnostico?: string | null;
          data_hora_inicio_reparo?: string | null;
          data_hora_fim_reparo?: string | null;
          data_hora_inicio_teste?: string | null;
          data_hora_fim_teste?: string | null;
          data_hora_religacao?: string | null;
          data_hora_restabelecimento?: string | null;
          data_hora_encerramento?: string | null;
          observacoes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      diagnosticos: {
        Row: {
          id: string;
          ocorrencia_id: string;
          atendimento_id: string | null;
          tipo_problema: string | null;
          descricao: string | null;
          gravidade: 'baixa' | 'media' | 'alta' | 'critica' | null;
          servico_necessario: string | null;
          material_necessario: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ocorrencia_id: string;
          atendimento_id?: string | null;
          tipo_problema?: string | null;
          descricao?: string | null;
          gravidade?: 'baixa' | 'media' | 'alta' | 'critica' | null;
          servico_necessario?: string | null;
          material_necessario?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ocorrencia_id?: string;
          atendimento_id?: string | null;
          tipo_problema?: string | null;
          descricao?: string | null;
          gravidade?: 'baixa' | 'media' | 'alta' | 'critica' | null;
          servico_necessario?: string | null;
          material_necessario?: string | null;
        };
      };
      testes: {
        Row: {
          id: string;
          ocorrencia_id: string;
          atendimento_id: string | null;
          tipo_teste: string | null;
          resultado: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ocorrencia_id: string;
          atendimento_id?: string | null;
          tipo_teste?: string | null;
          resultado?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ocorrencia_id?: string;
          atendimento_id?: string | null;
          tipo_teste?: string | null;
          resultado?: string | null;
        };
      };
      localizacoes_equipes: {
        Row: {
          id: string;
          equipe_id: string;
          latitude: number;
          longitude: number;
          data_hora: string;
          status: string | null;
          velocidade: number | null;
          direcao: number | null;
          ocorrencia_atual_id: string | null;
          precisao_metros: number | null;
          bateria_percentual: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          equipe_id: string;
          latitude: number;
          longitude: number;
          data_hora?: string;
          status?: string | null;
          velocidade?: number | null;
          direcao?: number | null;
          ocorrencia_atual_id?: string | null;
          precisao_metros?: number | null;
          bateria_percentual?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          equipe_id?: string;
          latitude?: number;
          longitude?: number;
          data_hora?: string;
          status?: string | null;
          velocidade?: number | null;
          direcao?: number | null;
          ocorrencia_atual_id?: string | null;
          precisao_metros?: number | null;
          bateria_percentual?: number | null;
        };
      };
      pausas_equipes: {
        Row: {
          id: string;
          equipe_id: string;
          tipo: 'cafe_manha' | 'almoco' | 'cafe_tarde' | 'jantar' | 'descanso';
          inicio_planejado: string | null;
          fim_planejado: string | null;
          inicio_real: string | null;
          fim_real: string | null;
          status: 'planejada' | 'em_andamento' | 'concluida' | 'cancelada';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          equipe_id: string;
          tipo: 'cafe_manha' | 'almoco' | 'cafe_tarde' | 'jantar' | 'descanso';
          inicio_planejado?: string | null;
          fim_planejado?: string | null;
          inicio_real?: string | null;
          fim_real?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          equipe_id?: string;
          tipo?: string;
          inicio_planejado?: string | null;
          fim_planejado?: string | null;
          inicio_real?: string | null;
          fim_real?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      pontos_criticos: {
        Row: {
          id: string;
          nome: string;
          tipo: 'hospital' | 'subestacao' | 'escola' | 'abastecimento' | 'outro' | null;
          latitude: number;
          longitude: number;
          nivel_criticidade: 'baixa' | 'media' | 'alta' | 'critica' | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          tipo?: string | null;
          latitude: number;
          longitude: number;
          nivel_criticidade?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          tipo?: string | null;
          latitude?: number;
          longitude?: number;
          nivel_criticidade?: string | null;
        };
      };
    };
  };
}
