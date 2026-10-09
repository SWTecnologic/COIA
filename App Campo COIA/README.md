# Família M Motoboy App

Sistema completo de recebimento e entrega de pedidos para motoboys, desenvolvido com React Native, Expo e Supabase.

## 🚀 Configuração Inicial

### 1. Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e configure as seguintes variáveis:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Google Maps API Key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# App Configuration
EXPO_PUBLIC_APP_NAME=Família M Motoboy
EXPO_PUBLIC_APP_VERSION=1.0.0
EXPO_PUBLIC_ENVIRONMENT=development
```

### 2. Configuração do Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Configure as tabelas do banco de dados (veja schema em `types/database.ts`)
3. Ative Row Level Security (RLS) em todas as tabelas
4. Configure as políticas de acesso apropriadas

### 3. Google Maps API

1. Acesse o [Google Cloud Console](https://console.cloud.google.com)
2. Crie um projeto ou selecione um existente
3. Ative a Maps SDK for Android
4. Crie uma chave de API e configure as restrições
5. Adicione a chave no arquivo `.env`

### 4. Instalação e Execução

```bash
# Instalar dependências
npm install

# Executar no Android (recomendado)
npm run dev:android

# Ou executar geral
npm run dev
```

### 5. Build para Produção

```bash
# Build de desenvolvimento
eas build --profile development --platform android

# Build de produção
eas build --profile production --platform android
```

## 🚀 Tecnologias

- **React Native** - Framework para desenvolvimento mobile
- **Expo** - Plataforma de desenvolvimento e deploy
- **TypeScript** - Linguagem de programação tipada
- **Supabase** - Backend-as-a-Service (Auth, Database, Realtime)
- **Expo Router** - Sistema de navegação
- **react-native-maps** - Google Maps nativo
- **Expo Location** - Geolocalização em tempo real
- **Expo Notifications** - Notificações push

## 📱 Funcionalidades

### 🔐 Autenticação
- Login e cadastro via Supabase Auth
- Recuperação de senha
- Perfil completo obrigatório

### 🗺️ Mapa Principal
- Google Maps nativo com alta performance
- Localização em tempo real do motoboy
- Visualização de rotas de retirada e entrega
- Marcadores personalizados para cada tipo de local

### 📦 Sistema de Pedidos
- Distribuição automática por proximidade
- Modal de pedidos sobre o mapa
- Fluxo completo: aceitar → retirada → entrega → conclusão
- Atualizações em tempo real via Supabase Realtime

### 💰 Controle de Ganhos
- Cálculo automático de taxa do app
- Visualização de ganhos diários e totais
- Estatísticas completas de entregas
- Histórico detalhado de transações

### 🔔 Notificações
- Notificações push para novos pedidos
- Alertas de cancelamento
- Feedback visual para cada ação

### 📊 Histórico e Relatórios
- Histórico completo de pedidos
- Detalhes de cada entrega
- Estatísticas de performance
- Exportação de dados

## 🏗️ Arquitetura

### Estrutura de Pastas
```
app/
├── (auth)/          # Telas de autenticação
├── (tabs)/          # Telas principais com navegação por tabs
├── _layout.tsx      # Layout raiz
└── index.tsx        # Tela inicial

components/          # Componentes reutilizáveis
contexts/           # Contextos React (Auth, etc.)
hooks/             # Hooks customizados
lib/               # Configurações e utilitários
types/             # Definições de tipos TypeScript
```

### Database Schema
O app utiliza as seguintes tabelas no Supabase:

- **user_profiles** - Dados do perfil do usuário
- **motoboys** - Informações específicas do motoboy
- **orders** - Pedidos e entregas

## 🔧 Configuração

### 1. Variáveis de Ambiente
Configure no Supabase as seguintes variáveis:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Google Maps
Adicione sua chave do Google Maps no `app.json`:

```json
{
  "android": {
    "config": {
      "googleMaps": {
        "apiKey": "YOUR_GOOGLE_MAPS_API_KEY"
      }
    }
  }
}
```

### 3. Expo Dev Client
Este app requer Expo Dev Client para funcionar com bibliotecas nativas:

```bash
npm run dev
```

## 📋 Fluxo de Uso

### 1. Cadastro/Login
- Motoboy se cadastra com email, senha, nome e telefone
- Sistema cria automaticamente perfil e registro de motoboy
- Obrigatório completar perfil antes de acessar o mapa

### 2. Recebimento de Pedidos
- Sistema distribui pedidos automaticamente por proximidade
- Motoboy recebe notificação e modal com detalhes
- Pode aceitar ou recusar o pedido

### 3. Execução da Entrega
- Rota automática para local de retirada
- Confirmação de retirada da mercadoria
- Rota automática para local de entrega
- Confirmação de entrega e conclusão

### 4. Controle Financeiro
- Cálculo automático de ganhos e taxas
- Atualização em tempo real dos totais
- Histórico completo disponível

## 🔒 Segurança

- Row Level Security (RLS) habilitado em todas as tabelas
- Autenticação obrigatória para todas as operações
- Validação de dados no cliente e servidor
- Permissões específicas por tipo de usuário
- Variáveis de ambiente para dados sensíveis
- Validação de configuração na inicialização

## 📱 Compatibilidade

- **Android**: Totalmente compatível (foco principal)
- **iOS**: Compatível com ajustes menores
- **Web**: Limitado (sem maps nativos)

## 🐛 Troubleshooting

### Erro de Configuração
- Verifique se todas as variáveis de ambiente estão configuradas
- Confirme se as chaves do Supabase e Google Maps são válidas

### Problemas com Maps
- Verifique se a Google Maps API está ativada
- Confirme se as permissões de localização estão concedidas

### Problemas de Build
- Execute `npm run clean` para limpar o cache
- Verifique se todas as dependências estão instaladas

## 🚀 Deploy

O app pode ser deployado via:
- Expo EAS Build para stores
- Expo Dev Client para desenvolvimento
- Build local para distribuição

## 📋 Checklist de Produção

- [ ] Configurar variáveis de ambiente de produção
- [ ] Configurar banco de dados Supabase
- [ ] Configurar Google Maps API
- [ ] Testar fluxo completo de pedidos
- [ ] Configurar notificações push
- [ ] Testar em dispositivos Android reais
- [ ] Configurar políticas RLS no Supabase
- [ ] Configurar build de produção no EAS

## 📞 Suporte

Para suporte técnico ou dúvidas sobre implementação, consulte:
- Documentação do Expo
- Documentação do Supabase
- Issues do repositório