from app.modulos.correlacao import haversine_m

def test_haversine_distancia_zero():
    assert haversine_m(-19.9, -43.95, -19.9, -43.95) == 0.0

def test_haversine_500m_aprox():
    # 0.0045 grau de latitude ≈ 500m
    d = haversine_m(-19.9, -43.95, -19.9045, -43.95)
    assert 480 < d < 520

def test_haversine_km():
    # BH → Contagem (aprox 20 km)
    d = haversine_m(-19.9245, -43.9352, -19.9318, -44.0536)
    assert 10_000 < d < 15_000