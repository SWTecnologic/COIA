# Schema do Banco de Dados - Família M Motoboy

## Tabelas Necessárias no Supabase

### 1. user_profiles
```sql
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);
```

### 2. motoboys
```sql
CREATE TABLE motoboys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  vehicle_type TEXT CHECK (vehicle_type IN ('moto', 'bicicleta', 'carro')) NOT NULL,
  account_status TEXT CHECK (account_status IN ('ativo', 'bloqueado')) DEFAULT 'ativo',
  operational_status TEXT CHECK (operational_status IN ('online', 'offline')) DEFAULT 'offline',
  current_latitude DECIMAL,
  current_longitude DECIMAL,
  total_earnings DECIMAL DEFAULT 0,
  total_deliveries INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE motoboys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Motoboys can view own data" ON motoboys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Motoboys can update own data" ON motoboys
  FOR UPDATE USING (auth.uid() = user_id);
```

### 3. orders
```sql
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  motoboy_id UUID REFERENCES motoboys(id),
  status TEXT CHECK (status IN (
    'pendente', 
    'aceito', 
    'a_caminho_da_retirada', 
    'mercadoria_retirada', 
    'a_caminho_da_entrega', 
    'concluido', 
    'cancelado'
  )) DEFAULT 'pendente',
  pickup_address TEXT NOT NULL,
  pickup_latitude DECIMAL NOT NULL,
  pickup_longitude DECIMAL NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_latitude DECIMAL NOT NULL,
  delivery_longitude DECIMAL NOT NULL,
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  total_amount DECIMAL NOT NULL,
  app_fee DECIMAL DEFAULT 0,
  motoboy_earnings DECIMAL DEFAULT 0,
  distance_km DECIMAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Motoboys can view assigned orders" ON orders
  FOR SELECT USING (
    motoboy_id IN (
      SELECT id FROM motoboys WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Motoboys can update assigned orders" ON orders
  FOR UPDATE USING (
    motoboy_id IN (
      SELECT id FROM motoboys WHERE user_id = auth.uid()
    )
  );
```

## Triggers para Updated_at

```sql
-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_motoboys_updated_at 
  BEFORE UPDATE ON motoboys 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON orders 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Índices para Performance

```sql
-- Índices para consultas frequentes
CREATE INDEX idx_motoboys_user_id ON motoboys(user_id);
CREATE INDEX idx_motoboys_operational_status ON motoboys(operational_status);
CREATE INDEX idx_motoboys_location ON motoboys(current_latitude, current_longitude);

CREATE INDEX idx_orders_motoboy_id ON orders(motoboy_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_pickup_location ON orders(pickup_latitude, pickup_longitude);
```

## Realtime Subscriptions

Para habilitar realtime nas tabelas:

```sql
-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE motoboys;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
```