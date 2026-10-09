# Fluxo do Aplicativo - Família M Motoboy

## 1. Inicialização do App

### Verificações Iniciais
- ✅ Validar variáveis de ambiente
- ✅ Testar conexão com Supabase
- ✅ Verificar permissões de localização
- ✅ Configurar notificações

### Roteamento Inicial
```
app/index.tsx → Verifica autenticação
├── Usuário logado → /(tabs)
└── Usuário não logado → /(auth)/login
```

## 2. Fluxo de Autenticação

### 2.1 Login (/(auth)/login)
- Input: email, senha
- Validação local
- Supabase Auth: `signInWithPassword`
- Sucesso → Carregar dados do usuário → /(tabs)

### 2.2 Cadastro (/(auth)/register)
- Input: nome, telefone, email, senha
- Validação local
- Supabase Auth: `signUp`
- Criar registros:
  - `user_profiles` (nome, telefone)
  - `motoboys` (veículo padrão: moto)
- Sucesso → Login automático

### 2.3 Recuperação de Senha
- Input: email
- Supabase Auth: `resetPasswordForEmail`
- Email enviado → Voltar para login

## 3. Verificação de Perfil

### Dados Obrigatórios
- ✅ Nome completo
- ✅ Telefone
- ✅ Tipo de veículo

### Fluxo de Verificação
```
/(tabs)/_layout.tsx → Verifica perfil completo
├── Perfil completo → Acesso liberado
└── Perfil incompleto → Redirecionar para /(tabs)/profile
```

## 4. Tela Principal - Mapa (/(tabs)/index)

### 4.1 Inicialização
- Solicitar permissões de localização
- Iniciar tracking de localização
- Carregar mapa com Google Maps (expo-maps)
- Conectar Supabase Realtime

### 4.2 Estados do Motoboy
- **Offline**: Não recebe pedidos
- **Online**: Disponível para receber pedidos

### 4.3 Atualização de Localização
- Intervalo: 10 segundos
- Distância mínima: 10 metros
- Atualizar `motoboys.current_latitude/longitude`
- Apenas quando status = 'online'

## 5. Sistema de Pedidos

### 5.1 Distribuição Automática
**Lógica no Backend/Admin:**
1. Novo pedido criado
2. Buscar motoboys online próximos (raio inicial: 5km)
3. Selecionar o mais próximo
4. Atribuir pedido: `orders.motoboy_id`
5. Enviar via Realtime

### 5.2 Recebimento de Pedido
**Hook useOrders:**
```javascript
// Subscription Realtime
supabase
  .channel('orders')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'orders'
  }, (payload) => {
    // Verificar se é para este motoboy
    if (payload.new.motoboy_id === motoboy.id) {
      setPendingOrder(payload.new);
      // Enviar notificação local
      Notifications.scheduleNotificationAsync({...});
    }
  })
```

### 5.3 Modal de Pedido Pendente
**Informações exibidas:**
- Número do pedido
- Nome do cliente
- Distância total
- Valor da corrida
- Localização no mapa (retirada + entrega)

**Ações disponíveis:**
- ✅ Aceitar pedido
- ❌ Recusar pedido (timeout: 30s)

## 6. Fluxo da Corrida

### 6.1 Pedido Aceito
```javascript
// Status: 'aceito'
await updateOrderStatus(orderId, 'aceito');
// Rota: Motoboy → Retirada
// Botão: "Ir para retirada"
```

### 6.2 Indo para Retirada
```javascript
// Status: 'a_caminho_da_retirada'
await updateOrderStatus(orderId, 'a_caminho_da_retirada');
// Rota: Motoboy → Retirada
// Botão: "Confirmar retirada"
```

### 6.3 Mercadoria Retirada
```javascript
// Status: 'mercadoria_retirada'
await updateOrderStatus(orderId, 'mercadoria_retirada');
// Rota: Retirada → Entrega
// Botão: "Ir para entrega"
```

### 6.4 Indo para Entrega
```javascript
// Status: 'a_caminho_da_entrega'
await updateOrderStatus(orderId, 'a_caminho_da_entrega');
// Rota: Retirada → Entrega
// Botão: "Confirmar entrega"
```

### 6.5 Entrega Concluída
```javascript
// Status: 'concluido'
await updateOrderStatus(orderId, 'concluido');
// Atualizar estatísticas do motoboy:
// - total_earnings += motoboy_earnings
// - total_deliveries += 1
```

## 7. Cálculo de Ganhos

### 7.1 Estrutura Financeira
```javascript
const order = {
  total_amount: 25.00,    // Valor total do pedido
  app_fee: 5.00,          // Taxa do app (20%)
  motoboy_earnings: 20.00 // Ganho líquido do motoboy
};
```

### 7.2 Tela de Ganhos (/(tabs)/earnings)
**Estatísticas do dia:**
- Ganho líquido
- Número de entregas
- Total bruto
- Taxa do app

**Histórico:**
- Ganhos diários (últimos 30 dias)
- Resumo total (todas as entregas)

## 8. Histórico (/(tabs)/history)

### 8.1 Lista de Pedidos
- Pedidos concluídos e cancelados
- Ordenação: mais recente primeiro
- Informações: data, cliente, valor, status

### 8.2 Detalhes do Pedido
- Modal com informações completas
- Endereços de retirada e entrega
- Dados financeiros
- Timestamps de cada etapa

## 9. Perfil (/(tabs)/profile)

### 9.1 Informações Pessoais
- Email (não editável)
- Nome completo
- Telefone
- Tipo de veículo

### 9.2 Estatísticas
- Total de entregas
- Ganhos totais
- Status da conta
- Média por entrega

### 9.3 Ações
- Salvar alterações
- Sair da conta

## 10. Notificações

### 10.1 Tipos de Notificação
- 🔔 Novo pedido disponível
- ❌ Pedido cancelado
- ℹ️ Atualizações do sistema

### 10.2 Configuração
```javascript
// Canal Android
Notifications.setNotificationChannelAsync('default', {
  name: 'default',
  importance: Notifications.AndroidImportance.MAX,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#2563EB',
  sound: true,
});
```

## 11. Estados de Erro

### 11.1 Sem Localização
- Solicitar permissões
- Mostrar tela de erro com instruções

### 11.2 Sem Conexão Supabase
- Validar variáveis de ambiente
- Mostrar erro de configuração

### 11.3 Perfil Incompleto
- Redirecionar para tela de perfil
- Bloquear acesso ao mapa

## 12. Performance e Otimização

### 12.1 Localização
- Throttling de updates (5 segundos mínimo)
- Apenas quando online
- Accuracy threshold: 100 metros

### 12.2 Realtime
- Subscription específica por motoboy
- Cleanup automático de subscriptions
- Rate limiting: 10 eventos/segundo

### 12.3 Cache
- Cache de dados do usuário
- Refresh automático em mudanças
- Offline fallback para dados críticos